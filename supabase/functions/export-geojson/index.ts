/**
 * GeoJSON export endpoint for city / researcher data consumers.
 *
 * GET /functions/v1/export-geojson?bbox=minLng,minLat,maxLng,maxLat&verified_only=true
 *
 * Protected by an API token passed in the Authorization header:
 *   Authorization: Bearer <EXPORT_API_TOKEN>
 *
 * The token is set as a Supabase secret:
 *   supabase secrets set EXPORT_API_TOKEN=<your-token>
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPORT_API_TOKEN = Deno.env.get('EXPORT_API_TOKEN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Token auth
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace('Bearer ', '').trim();
  if (EXPORT_API_TOKEN && token !== EXPORT_API_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const bbox = url.searchParams.get('bbox'); // minLng,minLat,maxLng,maxLat
  const verifiedOnly = url.searchParams.get('verified_only') === 'true';
  const surfaceFilter = url.searchParams.get('surface'); // optional

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let query = supabase
    .from('gum_reports')
    .select('id, latitude, longitude, surface_type, is_verified, gps_accuracy, created_at, profiles(username)')
    .eq('status', 'active')
    .limit(10000);

  if (verifiedOnly) query = query.eq('is_verified', true);
  if (surfaceFilter) query = query.eq('surface_type', surfaceFilter);

  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
    if ([minLng, minLat, maxLng, maxLat].some(isNaN)) {
      return new Response(JSON.stringify({ error: 'Invalid bbox. Use: minLng,minLat,maxLng,maxLat' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    query = query
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const geojson = {
    type: 'FeatureCollection',
    features: (data ?? []).map((r: any) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [r.longitude, r.latitude],
      },
      properties: {
        id: r.id,
        surface_type: r.surface_type,
        is_verified: r.is_verified,
        gps_accuracy_meters: r.gps_accuracy,
        reported_by: r.profiles?.username ?? null,
        created_at: r.created_at,
      },
    })),
  };

  return new Response(JSON.stringify(geojson), {
    headers: { ...corsHeaders, 'Content-Type': 'application/geo+json' },
  });
});
