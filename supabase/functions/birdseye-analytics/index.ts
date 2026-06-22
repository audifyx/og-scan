import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const BIRDSEYE_API_KEY = Deno.env.get("BIRDEYE_API_KEY") || Deno.env.get("BIRDSEYE_API_KEY");
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const { address, type = "overview" } = await req.json();
    if (!address) {
      throw new Error("Token address is required");
    }
    const birdeyeUrl = `https://api.birdseye.so/v1/${type}?address=${address}`;
    const response = await fetch(birdeyeUrl, {
      headers: {
        "X-API-Key": BIRDSEYE_API_KEY || ""
      }
    });
    if (!response.ok) {
      throw new Error(`BirdEye API error: ${response.statusText}`);
    }
    const data = await response.json();
    return new Response(JSON.stringify({
      success: true,
      data: data,
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
