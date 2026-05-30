/**
 * Refreshes the neighbourhood_stats table for the current week.
 * Should be called on a cron schedule — e.g. every Sunday at midnight:
 *
 *   supabase scheduler create \
 *     --schedule "0 0 * * 0" \
 *     --function neighbourhood-stats
 *
 * Can also be triggered manually via POST with service-role auth.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase.rpc('refresh_neighbourhood_stats');

  if (error) {
    console.error('Failed to refresh neighbourhood stats:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, refreshed_at: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
