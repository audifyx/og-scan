import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const JUPITER_API_KEY = Deno.env.get("JUPITER_API_KEY");
const JUPITER_API_URL = "https://api.jup.ag/v1";
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const { inputMint, outputMint, amount, slippageBps = 50, wallet, platformFeeBps } = await req.json();
    // Get quote from Jupiter
    const quoteUrl = new URL(`${JUPITER_API_URL}/quote`);
    quoteUrl.searchParams.set("inputMint", inputMint);
    quoteUrl.searchParams.set("outputMint", outputMint);
    quoteUrl.searchParams.set("amount", amount.toString());
    quoteUrl.searchParams.set("slippageBps", slippageBps.toString());
    if (platformFeeBps) quoteUrl.searchParams.set("platformFeeBps", String(platformFeeBps));
    const quoteResponse = await fetch(quoteUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${JUPITER_API_KEY}`
      }
    });
    if (!quoteResponse.ok) {
      throw new Error(`Jupiter quote error: ${quoteResponse.statusText}`);
    }
    const quote = await quoteResponse.json();
    return new Response(JSON.stringify({
      success: true,
      quote: quote,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});
