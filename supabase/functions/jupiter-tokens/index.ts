import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const JUPITER_BASE = "https://lite-api.jup.ag";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  try {
    const { query, mint } = await req.json();
    const term = query || mint;
    if (!term) throw new Error("query or mint is required");
    const url = `${JUPITER_BASE}/tokens/v2/search?query=${encodeURIComponent(term)}`;
    const tokensResponse = await fetch(url);
    if (!tokensResponse.ok) throw new Error(`Jupiter tokens error: ${tokensResponse.status} ${tokensResponse.statusText}`);
    const tokensData = await tokensResponse.json();
    return new Response(JSON.stringify({ success: true, tokens: tokensData, timestamp: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
