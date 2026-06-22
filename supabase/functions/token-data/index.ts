import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const { token_address, action } = await req.json();
    if (action === "get_metadata") {
      // Fetch from Helius
      const response = await fetch(`https://api.helius.xyz/v0/tokens?api-key=${HELIUS_API_KEY}`);
      const tokens = await response.json();
      const token = tokens.find((t)=>t.token === token_address);
      return new Response(JSON.stringify({
        success: true,
        token
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    if (action === "trending") {
      // Get trending tokens
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=solana&order=liquidity&direction=desc`);
      const data = await response.json();
      return new Response(JSON.stringify({
        success: true,
        trending: data.pairs?.slice(0, 10)
      }), {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      error: "Unknown action"
    }), {
      status: 400
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 400
    });
  }
});
