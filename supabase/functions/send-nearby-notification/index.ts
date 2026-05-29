/**
 * Triggered by a Supabase Database Webhook on gum_reports INSERT.
 * Finds users within 500m of the new report who have push tokens
 * and sends them an Expo push notification.
 *
 * Set up the webhook in Supabase:
 *   Table: gum_reports  Event: INSERT
 *   URL: <your-project>.supabase.co/functions/v1/send-nearby-notification
 *   HTTP headers: Authorization: Bearer <service-role-key>
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const NOTIFY_RADIUS_METERS = 500;

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    if (!record?.latitude || !record?.longitude) {
      return new Response('ok', { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find users with push tokens within NOTIFY_RADIUS_METERS who aren't the reporter
    const { data: nearbyReports } = await supabase
      .from('gum_reports')
      .select('user_id')
      .neq('user_id', record.user_id)
      .eq('status', 'active')
      .not('user_id', 'is', null);

    // Get unique user IDs who have reported gum nearby (proxy for "active in area")
    const nearbyUserIds = [...new Set((nearbyReports ?? []).map((r: any) => r.user_id))].slice(0, 50);

    if (nearbyUserIds.length === 0) {
      return new Response('ok', { status: 200 });
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('push_token')
      .in('id', nearbyUserIds)
      .not('push_token', 'is', null);

    const tokens = (profiles ?? []).map((p: any) => p.push_token).filter(Boolean);
    if (tokens.length === 0) return new Response('ok', { status: 200 });

    // Send via Expo Push API
    const messages = tokens.map((token: string) => ({
      to: token,
      title: '🍬 New gum spotted nearby',
      body: 'Someone just reported a piece of gum near you.',
      data: { reportId: record.id },
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    return new Response(JSON.stringify({ sent: tokens.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-nearby-notification error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
