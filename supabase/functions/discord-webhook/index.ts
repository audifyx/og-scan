import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_WEBHOOK_URL");
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const { message, title, color } = await req.json();
    const response = await fetch(DISCORD_WEBHOOK_URL || "", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [
          {
            title: title || "Soltools Alert",
            description: message,
            color: color || 5814783,
            timestamp: new Date().toISOString()
          }
        ]
      })
    });
    if (!response.ok) throw new Error("Discord webhook failed");
    return new Response(JSON.stringify({
      success: true
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400
    });
  }
});
