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
    const top = accounts.slice(0, 10);
    // Resolve the OWNER wallet behind each top token account (one batched call).
    let owners: (string | null)[] = [];
    try {
      const mul = await rpc("getMultipleAccounts", [top.map((a: any) => a.address), { encoding: "jsonParsed" }]);
      owners = (mul?.value || []).map((v: any) => v?.data?.parsed?.info?.owner || null);
    } catch { owners = []; }
    const holders = top.map((a: any, i: number) => {
      const pct = total > 0 ? (a.uiAmount / total) * 100 : null;
      return {
        rank: i + 1,
        owner: owners[i] || null,
        tokenAccount: a.address,
        uiAmount: a.uiAmount || 0,
        pct,
        label: pct == null ? null : pct >= 10 ? "mega-whale" : pct >= 5 ? "whale" : pct >= 2 ? "large" : "holder",
      };
    });
    const top10pct = total > 0 ? top.reduce((s: number, a: any) => s + (a.uiAmount || 0), 0) / total * 100 : null;
    // concentration risk rating
    let risk = "unknown";
    if (top10pct != null) risk = top10pct >= 50 ? "very high" : top10pct >= 30 ? "high" : top10pct >= 20 ? "moderate" : top10pct >= 10 ? "low" : "very low";
    return json({ ok: true, mint: m, totalSupply: total, top10pct, concentrationRisk: risk, holders });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
