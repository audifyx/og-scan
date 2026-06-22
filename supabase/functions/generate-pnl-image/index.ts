import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const GEMINI_API = Deno.env.get("gemini_api");
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const { username, pnl, roi, trades } = await req.json();
    // Generate image using Gemini vision
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Create a trading summary image with these stats: PnL: $${pnl}, ROI: ${roi}%, Trades: ${trades}. Username: ${username}. Format as SVG data.`
              }
            ]
          }
        ]
      })
    });
    const data = await response.json();
    const imageData = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return new Response(JSON.stringify({
      success: true,
      image: imageData
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
