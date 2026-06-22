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
    const { quoteResponse, userPublicKey, wrapUnwrapSOL = true, dynamicComputeUnitLimit = true, prioritizationFeeLamports } = await req.json();
    const swapUrl = `${JUPITER_API_URL}/swap`;
    const body = {
      quoteResponse: quoteResponse,
      userPublicKey: userPublicKey,
      wrapUnwrapSOL: wrapUnwrapSOL,
      dynamicComputeUnitLimit: dynamicComputeUnitLimit
    };
    if (prioritizationFeeLamports) {
      body.prioritizationFeeLamports = prioritizationFeeLamports;
    }
    const swapResponse = await fetch(swapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${JUPITER_API_KEY}`
      },
      body: JSON.stringify(body)
    });
    if (!swapResponse.ok) {
      throw new Error(`Jupiter swap error: ${swapResponse.statusText}`);
    }
    const swapData = await swapResponse.json();
    return new Response(JSON.stringify({
      success: true,
      swapTransaction: swapData,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (error) {
    console.error("Error:", error);
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
