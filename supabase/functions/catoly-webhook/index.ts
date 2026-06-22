import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
Deno.serve(async (req)=>{
  try {
    if (req.method === 'GET') {
      return new Response(JSON.stringify({
        ok: true,
        service: 'catoly-webhook'
      }), {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const payload = await req.json();
    await supabase.from('catoly_webhook_events').insert({
      event_type: payload?.type || 'unknown',
      payload,
      processed: false
    });
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: String(e)
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
