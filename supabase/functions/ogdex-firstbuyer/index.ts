// ogdex-firstbuyer — finds the FIRST on-chain buyer of any Solana token.
// Strategy (no Birdeye, no paid indexer):
//   1) Bitquery indexed earliest DEX buy (used only if quota available).
//   2) Helius: walk the mint's signature history to genesis and parse the first
//      transaction where a wallet acquires the token while spending SOL.
//   3) Creator's launch buy — for fair launches (pump.fun etc.) the creator is
//      the genuine first acquirer; returned so we ALWAYS have a real answer.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY") || "";
const CLIENT_ID = Deno.env.get("BITQUERY_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("BITQUERY_CLIENT_SECRET") || "";
const RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const EAP = "https://streaming.bitquery.io/eap";
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

// --- Bitquery (best effort; skipped silently if quota exhausted) ---
let _tok: { token: string; exp: number } | null = null;
async function bqToken() {
  if (_tok && _tok.exp > Date.now() + 30000) return _tok.token;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: "api" });
  const r = await fetch("https://oauth2.bitquery.io/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json(); if (!j.access_token) throw new Error("no token");
  _tok = { token: j.access_token, exp: Date.now() + Number(j.expires_in || 3600) * 1000 };
  return _tok.token;
}
async function bitqueryFirst(mint: string) {
  try {
    if (!CLIENT_ID) return null;
    const t = await bqToken();
    const q = `query($mint:String!){Solana{DEXTrades(limit:{count:1},orderBy:{ascending:Block_Time},where:{Trade:{Buy:{Currency:{MintAddress:{is:$mint}}}}}){Block{Time}Transaction{Signature Signer}Trade{Buy{Amount AmountInUSD Account{Address Owner}}Sell{Amount Currency{MintAddress}}Dex{ProtocolName}}}}}`;
    const r = await fetch(EAP, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ query: q, variables: { mint } }) });
    const txt = await r.text(); let j: any; try { j = JSON.parse(txt); } catch { _dbg.bq = "non-json:" + txt.slice(0, 60); return null; }
    if (j.errors) { _dbg.bq = "err"; return null; }
    const tr = j?.data?.Solana?.DEXTrades?.[0]; if (!tr) return null;
    const buy = tr.Trade?.Buy || {}, sell = tr.Trade?.Sell || {};
    return {
      traced: true, source: "bitquery", wallet: buy.Account?.Owner || buy.Account?.Address || tr.Transaction?.Signer || null,
      tokenAmount: num(buy.Amount), solSpent: SOLMINTS.has(sell.Currency?.MintAddress || "") ? num(sell.Amount) : undefined,
      usd: num(buy.AmountInUSD), txHash: tr.Transaction?.Signature || null,
      time: tr.Block?.Time ? new Date(tr.Block.Time).getTime() : null, dex: tr.Trade?.Dex?.ProtocolName || null, kind: "first_buy",
    };
  } catch (e) { _dbg.bq = String((e as Error)?.message || e).slice(0, 60); return null; }
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

    let fb = await bitqueryFirst(mint);
    if (!fb) fb = await heliusFirst(mint);
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

    return json({ ok: true, mint, firstBuyer: fb, _debug: body.debug ? _dbg : undefined });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
