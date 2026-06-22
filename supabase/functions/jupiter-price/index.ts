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
    const { ids, showExtraInfo = true } = await req.json();
    if (!ids || ids.length === 0) {
      throw new Error("At least one token ID is required");
    }
    const priceUrl = new URL(`${JUPITER_API_URL}/price`);
    ids.forEach((id)=>priceUrl.searchParams.append("ids", id));
    if (showExtraInfo) {
      priceUrl.searchParams.set("showExtraInfo", "true");
    }
    const priceResponse = await fetch(priceUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${JUPITER_API_KEY}`
      }
    });
    if (!priceResponse.ok) {
      throw new Error(`Jupiter price error: ${priceResponse.statusText}`);
    }
    const priceData = await priceResponse.json();
    return new Response(JSON.stringify({
      success: true,
      data: priceData,
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
