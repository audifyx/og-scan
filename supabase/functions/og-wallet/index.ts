// og-wallet — portfolio snapshot for a Solana wallet, mirroring the site's
// getWalletOverview (Helius DAS searchAssets + native balance + Jupiter SOL price).
// POST { address } -> { ok, wallet }

const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const JUPITER_BASE = "https://lite-api.jup.ag";
const SOL_MINT = "So11111111111111111111111111111111111111112";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function dasSearch(owner: string): Promise<any> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "das", method: "searchAssets",
      params: { ownerAddress: owner, tokenType: "fungible", displayOptions: { showNativeBalance: true }, limit: 100 },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json();
  return j.result;
}

async function solPrice(): Promise<number> {
  try {
    const r = await fetch(`${JUPITER_BASE}/price/v3?ids=${SOL_MINT}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    return j[SOL_MINT]?.usdPrice ?? 0;
  } catch { return 0; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { address } = await req.json().catch(() => ({ address: "" }));
    const addr = String(address || "").trim();
    if (!ADDR_RE.test(addr)) return json({ ok: false, error: "Provide a valid Solana wallet address." }, 400);

    const [result, sp] = await Promise.all([dasSearch(addr), solPrice()]);
    const items = result?.items || [];
    const assets = items.map((it: any) => ({
      mint: it.id,
      name: it.content?.metadata?.name ?? "Unknown",
      symbol: it.content?.metadata?.symbol ?? "???",
      amount: it.token_info?.balance ? it.token_info.balance / Math.pow(10, it.token_info?.decimals ?? 0) : 0,
      pricePerToken: it.token_info?.price_info?.price_per_token ?? 0,
      valueUsd: it.token_info?.price_info?.total_price ?? 0,
    })).filter((a: any) => a.amount > 0);

    const sol = result?.nativeBalance?.lamports ? result.nativeBalance.lamports / 1e9 : 0;
    const solUsd = sol * sp;
    const totalTokenValueUsd = assets.reduce((s: number, a: any) => s + (a.valueUsd || 0), 0);
    const top = assets.slice().sort((a: any, b: any) => (b.valueUsd || 0) - (a.valueUsd || 0)).slice(0, 12);

    return json({
      ok: true,
      wallet: {
        address: addr, sol, solUsd, solPrice: sp,
        tokenCount: assets.length,
        totalTokenValueUsd,
        totalValueUsd: solUsd + totalTokenValueUsd,
        top,
      },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
