import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const ALCHEMY_RPC_URL = Deno.env.get("ALCHEMY_SOLANA_RPC");
const HELIOS_RPC_1 = Deno.env.get("HELIOS_RPC_1");
const QUIKNODE_RPC_URL = Deno.env.get("QUIKNODE_RPC_URL");
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  try {
    const { method, params = [], provider = 'alchemy' } = await req.json();
    let rpcUrl = ALCHEMY_RPC_URL;
    if (provider === 'helios') rpcUrl = HELIOS_RPC_1;
    if (provider === 'quiknode') rpcUrl = QUIKNODE_RPC_URL;
    if (!rpcUrl) {
      throw new Error(`RPC provider '${provider}' not configured`);
    }
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: method,
        params: params
      })
    });
    if (!response.ok) {
      throw new Error(`RPC error: ${response.statusText}`);
    }
    const data = await response.json();
    return new Response(JSON.stringify({
      success: true,
      data: data,
      provider: provider,
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
