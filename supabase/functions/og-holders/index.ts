// og-holders — top holder distribution for a token (Helius getTokenLargestAccounts
// + getTokenSupply). POST { mint } -> { ok, holders }
const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function rpc(method: string, params: any[]): Promise<any> {
  const r = await fetch(HELIUS_RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "og", method, params }), signal: AbortSignal.timeout(12000) });
  const j = await r.json();
  return j.result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { mint } = await req.json().catch(() => ({ mint: "" }));
    const m = String(mint || "").trim();
    if (!MINT_RE.test(m)) return json({ ok: false, error: "Provide a valid token mint." }, 400);
    const [largest, supply] = await Promise.all([
      rpc("getTokenLargestAccounts", [m, { commitment: "confirmed" }]),
      rpc("getTokenSupply", [m]),
    ]);
    const accounts = largest?.value || [];
    const total = supply?.value?.uiAmount || 0;
    const holders = accounts.slice(0, 10).map((a: any, i: number) => ({
      rank: i + 1,
      uiAmount: a.uiAmount || 0,
      pct: total > 0 ? (a.uiAmount / total) * 100 : null,
    }));
    const top10pct = total > 0 ? accounts.slice(0, 10).reduce((s: number, a: any) => s + (a.uiAmount || 0), 0) / total * 100 : null;
    return json({ ok: true, mint: m, totalSupply: total, top10pct, holders });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
