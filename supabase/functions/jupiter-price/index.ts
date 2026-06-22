import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const JUPITER_BASE = "https://lite-api.jup.ag";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  try {
    const { ids } = await req.json();
    const idList = Array.isArray(ids) ? ids : String(ids || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (idList.length === 0) throw new Error("At least one token ID is required");
    const priceUrl = new URL(`${JUPITER_BASE}/price/v3`);
    priceUrl.searchParams.set("ids", idList.join(","));
    const priceResponse = await fetch(priceUrl.toString());
    if (!priceResponse.ok) throw new Error(`Jupiter price error: ${priceResponse.status} ${priceResponse.statusText}`);
    const priceData = await priceResponse.json();
    return new Response(JSON.stringify({ success: true, data: priceData, timestamp: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
