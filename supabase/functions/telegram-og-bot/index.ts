import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async (req)=>{
  try {
    const body = await req.json().catch(()=>({}));
    const message = body?.message;
    if (!message?.chat?.id) {
      return new Response('ok');
    }
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    const chatId = message.chat.id;
    const text = message.text || 'message received';
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: `OG Scanner Echo: ${text}`
      })
    });
    return new Response('ok');
  } catch (e) {
    return new Response(JSON.stringify({
      error: String(e)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
