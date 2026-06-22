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
    const { query, mint } = await req.json();
    let url = `${JUPITER_API_URL}/tokens`;
    if (query) {
      url += `?search=${encodeURIComponent(query)}`;
    } else if (mint) {
      url += `?mint=${encodeURIComponent(mint)}`;
    }
    const tokensResponse = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${JUPITER_API_KEY}`
      }
    });
    if (!tokensResponse.ok) {
      throw new Error(`Jupiter tokens error: ${tokensResponse.statusText}`);
    }
    const tokensData = await tokensResponse.json();
    return new Response(JSON.stringify({
      success: true,
      tokens: tokensData,
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
