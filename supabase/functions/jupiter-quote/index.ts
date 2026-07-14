import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const JUPITER_BASE = "https://lite-api.jup.ag";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  try {
    const { inputMint, outputMint, amount, slippageBps = 50, platformFeeBps } = await req.json();
    const quoteUrl = new URL(`${JUPITER_BASE}/swap/v1/quote`);
    quoteUrl.searchParams.set("inputMint", inputMint);
    quoteUrl.searchParams.set("outputMint", outputMint);
    quoteUrl.searchParams.set("amount", amount.toString());
    quoteUrl.searchParams.set("slippageBps", slippageBps.toString());
    if (platformFeeBps) quoteUrl.searchParams.set("platformFeeBps", String(platformFeeBps));
    const quoteResponse = await fetch(quoteUrl.toString());
    if (!quoteResponse.ok) throw new Error(`Jupiter API error: ${quoteResponse.status} ${quoteResponse.statusText}`);
    const quoteData = await quoteResponse.json();
    return new Response(JSON.stringify({ success: true, quote: quoteData, timestamp: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
