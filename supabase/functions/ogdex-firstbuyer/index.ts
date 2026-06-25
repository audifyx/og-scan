// ogdex-firstbuyer — finds the FIRST on-chain buyer of any Solana token.
// Strategy (no Birdeye, no paid indexer):
//   1) Helius: walk the mint's signature history to genesis and parse the first
//      transaction where a wallet acquires the token while spending SOL.
//   2) Creator's launch buy — for fair launches (pump.fun etc.) the creator is
//      the genuine first acquirer; returned so we ALWAYS have a real answer.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const KV_BUCKET = "ogdex-kv";
async function kvGet(path: string) {
  try { const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${KV_BUCKET}/${path}`, { headers: { apikey: SRK, Authorization: `Bearer ${SRK}` } }); return r.ok ? await r.json() : null; } catch { return null; }
}
async function kvPut(path: string, obj: unknown) {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { method: "POST", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: KV_BUCKET, name: KV_BUCKET, public: false }) }).catch(() => {});
    await fetch(`${SUPABASE_URL}/storage/v1/object/${KV_BUCKET}/${path}`, { method: "POST", headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", "x-upsert": "true" }, body: JSON.stringify(obj) });
  } catch { /* best effort */ }
}
const SOLMINTS = new Set(["So11111111111111111111111111111111111111112", "11111111111111111111111111111111"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, s-maxage=86400" } });
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

let _dbg: any = {};

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  return j?.result ?? null;
}

// --- Helius genesis walk ---
function buyerFromTx(tx: any, mint: string) {
  try {
    if (!tx || tx.meta?.err) return null;
    const pre = tx.meta?.preTokenBalances || [], post = tx.meta?.postTokenBalances || [];
    const byOwner: Record<string, number> = {};
    for (const b of post) if (b.mint === mint && b.owner) byOwner[b.owner] = (byOwner[b.owner] || 0) + Number(b.uiTokenAmount?.uiAmount || 0);
    for (const b of pre) if (b.mint === mint && b.owner) byOwner[b.owner] = (byOwner[b.owner] || 0) - Number(b.uiTokenAmount?.uiAmount || 0);
    let wallet: string | null = null, best = 0;
    for (const [o, d] of Object.entries(byOwner)) if (d > best) { best = d; wallet = o; }
    if (!wallet || best <= 0) return null;
    const keys = (tx.transaction?.message?.accountKeys || []).map((k: any) => (typeof k === "string" ? k : k.pubkey));
    const idx = keys.indexOf(wallet);
    let solDelta = 0;
    if (idx >= 0 && tx.meta?.preBalances && tx.meta?.postBalances) solDelta = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / 1e9;
    return { wallet, tokenAmount: best, solSpent: Math.abs(Math.min(solDelta, 0)) || undefined, txHash: tx.transaction?.signatures?.[0] || null, time: (tx.blockTime || 0) * 1000 };
  } catch { return null; }
}
async function heliusFirst(mint: string) {
  const MAX_PAGES = 30, PAGE = 1000;
  let before: string | null = null, all: any[] = [], genesis = false;
  for (let i = 0; i < MAX_PAGES; i++) {
    const opts: any = { limit: PAGE }; if (before) opts.before = before;
    const sigs = (await rpc("getSignaturesForAddress", [mint, opts])) || [];
    if (!sigs.length) { genesis = true; break; }
    all = all.concat(sigs);
    before = sigs[sigs.length - 1].signature;
    if (sigs.length < PAGE) { genesis = true; break; }
  }
  _dbg.helius = { sigs: all.length, genesis };
  if (!genesis) return null;
  const oldest = all.reverse().slice(0, 40);
  const txs = await Promise.all(oldest.map((s: any) => rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)));
  for (const tx of txs) { const b = buyerFromTx(tx, mint); if (b) return { traced: true, source: "helius", kind: "first_buy", ...b }; }
  return null;
}

// --- Creator launch buy (fair-launch first acquirer) ---
async function pumpCoin(mint: string) {
  try { const r = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }); return r.ok ? await r.json() : null; } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  _dbg = {};
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const mint = String(body.mint || url.searchParams.get("mint") || "");
    if (!mint) return json({ ok: false, error: "mint required" }, 400);
    const creatorHint = body.creator || null;

    // First buy is immutable — serve from cache when available.
    const cacheKey = `firstbuyer/${mint}.json`;
    if (!body.debug && !body.refresh) {
      const cached = await kvGet(cacheKey);
      if (cached && cached.firstBuyer?.traced) return json({ ok: true, mint, firstBuyer: cached.firstBuyer, cached: true });
    }

    let fb = await heliusFirst(mint);
    if (!fb) {
      // Always-an-answer fallback: the creator is the genesis acquirer.
      const pump = await pumpCoin(mint);
      const creator = pump?.creator || creatorHint || null;
      if (creator) {
        fb = {
          traced: true, source: pump ? "pump.fun" : "creator", kind: "creator_launch", isDev: true, approximate: true,
          wallet: creator, time: pump?.created_timestamp || null,
          note: "Creator / launch wallet — the first acquirer at launch (full trade history is too large for an exact tx trace).",
        };
      }
    }
    if (fb && creatorHint && fb.wallet) (fb as any).isDev = fb.wallet === creatorHint || (fb as any).isDev || false;
    if (!fb) fb = { traced: false, note: "Could not resolve first buyer." };
    if (fb.traced) kvPut(cacheKey, { firstBuyer: fb, at: Date.now() });

    return json({ ok: true, mint, firstBuyer: fb, _debug: body.debug ? _dbg : undefined });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
