import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
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

  try {
    const { reportId, photoUrl } = await req.json() as { reportId: string; photoUrl: string };

    if (!reportId || !photoUrl) {
      return new Response(JSON.stringify({ error: 'Missing reportId or photoUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Claude Haiku vision to verify the photo contains gum
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'url', url: photoUrl },
              },
              {
                type: 'text',
                text: 'Does this image show a piece of chewing gum on a surface (ground, pavement, wall, etc.)? Answer only "yes" or "no".',
              },
            ],
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('Claude API error:', errText);
      return new Response(JSON.stringify({ isGum: false, error: 'Vision API error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const claudeData = await claudeResponse.json();
    const answer = (claudeData.content?.[0]?.text ?? '').toLowerCase().trim();
    const isGum = answer.startsWith('yes');

    if (isGum) {
      // Use service role to bypass RLS for the update
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get the report to find the user_id
      const { data: report } = await supabase
        .from('gum_reports')
        .select('user_id')
        .eq('id', reportId)
        .single();

      if (report) {
        await supabase.rpc('mark_report_verified', {
          p_report_id: reportId,
          p_user_id: report.user_id,
        });
      }
    }

    return new Response(JSON.stringify({ isGum }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('verify-gum error:', err);
    return new Response(JSON.stringify({ isGum: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
