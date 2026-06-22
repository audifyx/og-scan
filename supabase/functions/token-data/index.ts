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
      // Helius DAS getAsset (legacy /v0/tokens was removed by Helius).
      const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "meta", method: "getAsset", params: { id: token_address } }),
      });
      const j = await response.json();
      const a = j?.result;
      const token = a ? {
        token: token_address,
        name: a.content?.metadata?.name ?? null,
        symbol: a.content?.metadata?.symbol ?? null,
        image: a.content?.links?.image ?? a.content?.files?.[0]?.uri ?? null,
        decimals: a.token_info?.decimals ?? null,
        supply: a.token_info?.supply ?? null,
      } : null;
      return new Response(JSON.stringify({ success: true, token }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
