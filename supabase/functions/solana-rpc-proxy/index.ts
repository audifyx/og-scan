import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SOLANA_RPC_ALLOWED, SOLANA_RPC_BATCH_MAX } from "../_shared/solana_rpc_allow.ts";

const _alchemy = Deno.env.get("ALCHEMY_API_KEY") || "";
const _helius = Deno.env.get("HELIUS_API_KEY") || "";
const _quiknode = Deno.env.get("QUICKNODE_WSS") || "";
const ALCHEMY_RPC_URL = _alchemy ? (_alchemy.startsWith("http") ? _alchemy : `https://solana-mainnet.g.alchemy.com/v2/${_alchemy}`) : undefined;
const HELIOS_RPC_1 = _helius ? (_helius.startsWith("http") ? _helius : `https://mainnet.helius-rpc.com/?api-key=${_helius}`) : undefined;
const QUIKNODE_RPC_URL = _quiknode ? _quiknode.replace(/^wss:/, "https:") : undefined;

const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

function rpcUrl(provider: string) {
  let url = ALCHEMY_RPC_URL;
  if (provider === "helios") url = HELIOS_RPC_1;
  if (provider === "quiknode") url = QUIKNODE_RPC_URL;
  return url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  try {
    const body = await req.json();
    const calls = Array.isArray(body) ? body : [body];
    if (calls.length > SOLANA_RPC_BATCH_MAX) {
      throw new Error(`batch too large (max ${SOLANA_RPC_BATCH_MAX})`);
    }
    const provider = String((Array.isArray(body) ? undefined : body?.provider) || "alchemy");
    const url = rpcUrl(provider);
    if (!url) throw new Error(`RPC provider '${provider}' not configured`);

    const results = [];
    for (const item of calls) {
      const method = typeof item?.method === "string" ? item.method : "";
      if (!SOLANA_RPC_ALLOWED.has(method)) {
        results.push({ jsonrpc: "2.0", id: item?.id ?? 1, error: { code: -32601, message: "method not allowed" } });
        continue;
      }
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: item?.id ?? Date.now(),
          method,
          params: Array.isArray(item.params) ? item.params : [],
        }),
      });
      if (!response.ok) throw new Error(`RPC error: ${response.statusText}`);
      results.push(await response.json());
    }

    const data = Array.isArray(body) ? results : results[0];
    return new Response(JSON.stringify({
      success: true,
      data,
      provider,
      timestamp: new Date().toISOString(),
    }), { headers: cors });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 400, headers: cors });
  }
});
