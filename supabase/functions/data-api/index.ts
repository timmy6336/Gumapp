/**
 * Authenticated data API for city clients and researchers.
 *
 * Authentication: pass your API token in the Authorization header:
 *   Authorization: Bearer <token>
 *
 * Tokens are managed in the api_clients table (hashed).
 * Create a new client:
 *   1. Generate a random token: openssl rand -hex 32
 *   2. Hash it: echo -n "<token>" | sha256sum
 *   3. Insert into api_clients: { name: "City of X", token_hash: "<hash>" }
 *
 * Endpoints:
 *   GET /functions/v1/data-api/reports
 *     ?bbox=minLng,minLat,maxLng,maxLat  (required)
 *     &verified_only=true                 (optional)
 *     &surface=sidewalk                   (optional)
 *     &format=geojson|json               (optional, default: geojson)
 *
 *   GET /functions/v1/data-api/neighbourhood-stats
 *     ?bbox=minLng,minLat,maxLng,maxLat  (required)
 *     &weeks=4                            (optional, default: 4, max: 52)
 *
 *   GET /functions/v1/data-api/summary
 *     ?bbox=minLng,minLat,maxLng,maxLat  (required)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseBbox(bbox: string | null) {
  if (!bbox) return null;
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  return { minLng, minLat, maxLng, maxLat };
}

async function validateToken(supabase: ReturnType<typeof createClient>, authHeader: string | null) {
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '').trim();
  const hash = createHash('sha256').update(token).digest('hex');

  const { data } = await supabase
    .from('api_clients')
    .select('id')
    .eq('token_hash', hash)
    .eq('is_active', true)
    .single();

  if (data) {
    // Update last_used_at (fire-and-forget)
    supabase
      .from('api_clients')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);
    return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  // Auth
  const authorized = await validateToken(supabase, req.headers.get('authorization'));
  if (!authorized) return json({ error: 'Unauthorized' }, 401);

  const pathParts = url.pathname.split('/').filter(Boolean);
  const endpoint = pathParts[pathParts.length - 1];
  const bbox = parseBbox(url.searchParams.get('bbox'));

  if (!bbox && endpoint !== 'summary') {
    return json({ error: 'bbox parameter required: minLng,minLat,maxLng,maxLat' }, 400);
  }

  if (endpoint === 'reports') {
    const verifiedOnly = url.searchParams.get('verified_only') === 'true';
    const surface = url.searchParams.get('surface');
    const format = url.searchParams.get('format') ?? 'geojson';

    let query = supabase
      .from('gum_reports')
      .select('id, latitude, longitude, surface_type, is_verified, gps_accuracy, status, created_at')
      .eq('status', 'active')
      .gte('latitude', bbox!.minLat)
      .lte('latitude', bbox!.maxLat)
      .gte('longitude', bbox!.minLng)
      .lte('longitude', bbox!.maxLng)
      .limit(10000);

    if (verifiedOnly) query = query.eq('is_verified', true);
    if (surface) query = query.eq('surface_type', surface);

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);

    if (format === 'geojson') {
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: (data ?? []).map((r: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
          properties: {
            id: r.id,
            surface_type: r.surface_type,
            is_verified: r.is_verified,
            gps_accuracy_meters: r.gps_accuracy,
            created_at: r.created_at,
          },
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/geo+json' },
      });
    }

    return json({ data, count: data?.length ?? 0 });
  }

  if (endpoint === 'neighbourhood-stats') {
    const weeks = Math.min(parseInt(url.searchParams.get('weeks') ?? '4'), 52);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);

    const { data, error } = await supabase
      .from('neighbourhood_stats')
      .select('*')
      .gte('week_start', cutoff.toISOString().split('T')[0])
      .gte('grid_lat', bbox!.minLat)
      .lte('grid_lat', bbox!.maxLat)
      .gte('grid_lng', bbox!.minLng)
      .lte('grid_lng', bbox!.maxLng)
      .order('week_start', { ascending: false });

    if (error) return json({ error: error.message }, 500);
    return json({ data, count: data?.length ?? 0, weeks });
  }

  if (endpoint === 'summary') {
    const [reportsRes, statsRes] = await Promise.all([
      supabase
        .from('gum_reports')
        .select('status, is_verified, surface_type', { count: 'exact' }),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true }),
    ]);

    const reports = reportsRes.data ?? [];
    const bySurface: Record<string, number> = {};
    let active = 0, verified = 0;

    for (const r of reports) {
      if (r.status === 'active') active++;
      if (r.is_verified) verified++;
      if (r.surface_type) bySurface[r.surface_type] = (bySurface[r.surface_type] ?? 0) + 1;
    }

    return json({
      total_reports: reports.length,
      active_reports: active,
      verified_reports: verified,
      total_users: statsRes.count ?? 0,
      verification_rate: reports.length > 0 ? +(verified / reports.length * 100).toFixed(1) : 0,
      by_surface: bySurface,
      generated_at: new Date().toISOString(),
    });
  }

  return json({ error: 'Unknown endpoint. Use: /reports, /neighbourhood-stats, /summary' }, 404);
});
