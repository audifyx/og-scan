// ogdex-xray — early-buyer forensics for any Solana token.
// Walks the mint's signature history to genesis (Helius), parses the EARLIEST
// buy transactions, and classifies:
//   - early buyers (the first N wallets to acquire the token while spending SOL)
//   - snipers     (bought in the launch slot, within 30s, or among the first 15 buys)
//   - bundles     (same-slot clusters where >=3 distinct wallets bought together —
//                  a strong same-block bundler signal)
// No Birdeye / paid indexer. KV-cached at xray/{mint}.json (results are immutable).
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

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, s-maxage=86400" } });

let _dbg: any = {};

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  return j?.result ?? null;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Retrying RPC for the funding pass — survives the rate-limit burst after the genesis walk.
async function rpcSafe(method: string, params: unknown[], tries = 4): Promise<any> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      if (r.status === 429) { await sleep(300 * (i + 1)); continue; }
      const j = await r.json();
      if (j?.error) { await sleep(250 * (i + 1)); continue; }
      return j?.result ?? null;
    } catch { await sleep(250 * (i + 1)); }
  }
  return null;
}

// Parse a single tx for net token acquisition (a "buy") of `mint` plus SOL spent.
function buyFromTx(tx: any, mint: string) {
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
    return {
      wallet, tokenAmount: best,
      solSpent: Math.abs(Math.min(solDelta, 0)) || 0,
      txHash: tx.transaction?.signatures?.[0] || null,
      slot: tx.slot || 0,
      time: (tx.blockTime || 0) * 1000,
    };
  } catch { return null; }
}

// ── Funding-source tracing (insider clusters) ──────────────────────────────────
// A wallet's "funder" is whoever sent it its first SOL. Early buyers that share
// the same funder are likely the same operator / a coordinated insider group.
const INFRA = new Set([
  "11111111111111111111111111111111", // system program
  "So11111111111111111111111111111111111111112",
]);
function funderFromTx(tx: any, wallet: string) {
  try {
    if (!tx || tx.meta?.err) return null;
    const instrs = tx.transaction?.message?.instructions || [];
    for (const ix of instrs) {
      if (ix.program === "system" && ix.parsed?.type === "transfer") {
        const info = ix.parsed.info;
        if (info?.destination === wallet && info?.source && info.source !== wallet && !INFRA.has(info.source)) return info.source;
      }
    }
    // balance-delta fallback: wallet gained SOL, biggest loser is the sender
    const keys = (tx.transaction?.message?.accountKeys || []).map((k: any) => (typeof k === "string" ? k : k.pubkey));
    const wi = keys.indexOf(wallet);
    if (wi >= 0 && tx.meta?.preBalances && tx.meta?.postBalances) {
      const gained = tx.meta.postBalances[wi] - tx.meta.preBalances[wi];
      if (gained > 0) {
        let sender: string | null = null, worst = 0;
        for (let i = 0; i < keys.length; i++) {
          if (i === wi) continue;
          const d = tx.meta.postBalances[i] - tx.meta.preBalances[i];
          if (d < worst) { worst = d; sender = keys[i]; }
        }
        if (sender && !INFRA.has(sender)) return sender;
      }
    }
  } catch { /* ignore */ }
  return null;
}
async function findFunder(wallet: string) {
  const PAGE = 1000, MAX = 2;
  let before: string | null = null, all: any[] = [];
  for (let i = 0; i < MAX; i++) {
    const opts: any = { limit: PAGE }; if (before) opts.before = before;
    const sigs = (await rpcSafe("getSignaturesForAddress", [wallet, opts])) || [];
    if (!sigs.length) break;
    all = all.concat(sigs);
    before = sigs[sigs.length - 1].signature;
    if (sigs.length < PAGE) break;
  }
  if (!all.length) return null;
  const oldest = all.reverse().slice(0, 5);
  const txs = await Promise.all(oldest.map((sg: any) => rpcSafe("getTransaction", [sg.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)));
  for (const tx of txs) { const f = funderFromTx(tx, wallet); if (f) return f; }
  return null;
}
async function traceFunding(wallets: string[]) {
  const cap = wallets.slice(0, 12);
  // Trace in small batches — tracing all at once overwhelms the RPC (rate limits → nulls).
  await sleep(300); // let the post-genesis-walk rate-limit burst settle
  const found: (readonly [string, string | null])[] = [];
  for (let i = 0; i < cap.length; i += 2) {
    const batch = cap.slice(i, i + 2);
    const res = await Promise.all(batch.map(async (w) => [w, await findFunder(w).catch(() => null)] as const));
    found.push(...res);
    await sleep(150);
  }
  const funders: Record<string, string> = {};
  const byFunder: Record<string, string[]> = {};
  for (const [w, f] of found) {
    if (!f) continue;
    funders[w] = f;
    (byFunder[f] ||= []).push(w);
  }
  const clusters = Object.entries(byFunder)
    .filter(([, ws]) => ws.length >= 2)
    .map(([funder, ws]) => ({ funder, wallets: ws, size: ws.length }))
    .sort((a, b) => b.size - a.size);
  _dbg.funding = { traced: cap.length, found: Object.keys(funders).length };
  return { funders, clusters };
}

async function walkGenesis(mint: string) {
  const MAX_PAGES = 18, PAGE = 1000;
  let before: string | null = null, all: any[] = [], genesis = false;
  for (let i = 0; i < MAX_PAGES; i++) {
    const opts: any = { limit: PAGE }; if (before) opts.before = before;
    const sigs = (await rpc("getSignaturesForAddress", [mint, opts])) || [];
    if (!sigs.length) { genesis = true; break; }
    all = all.concat(sigs);
    before = sigs[sigs.length - 1].signature;
    if (sigs.length < PAGE) { genesis = true; break; }
  }
  _dbg.helius = { sigs: all.length, genesis, pages: Math.ceil(all.length / PAGE) };
  return { all: all.reverse(), genesis };
}

async function analyze(mint: string, limit = 50) {
  const { all, genesis } = await walkGenesis(mint);
  if (!all.length) return { traced: false, genesis, note: "No signatures found." };
  // Take the oldest signatures and resolve their full txs.
  const oldest = all.slice(0, Math.min(80, all.length));
  const txs: any[] = [];
  // Resolve in small batches to be gentle on the RPC.
  for (let i = 0; i < oldest.length; i += 10) {
    const batch = oldest.slice(i, i + 10);
    const resolved = await Promise.all(batch.map((s: any) => rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)));
    txs.push(...resolved);
  }
  // Extract buys in chronological order, de-duped by first acquisition per wallet.
  const buysAll: any[] = [];
  for (const tx of txs) { const b = buyFromTx(tx, mint); if (b) buysAll.push(b); }
  buysAll.sort((a, b) => (a.slot - b.slot) || (a.time - b.time));
  if (!buysAll.length) return { traced: false, genesis, note: "No buy transactions parsed near genesis." };

  // The pool/bonding-curve receives the full tradeable supply at genesis with no SOL
  // spent — it is NOT a buyer. Detect and exclude it.
  const launchSlot0 = buysAll[0].slot;
  let poolWallet: string | null = null, poolMax = 0;
  for (const b of buysAll) {
    if (b.slot === launchSlot0 && b.solSpent === 0 && b.tokenAmount > poolMax) { poolMax = b.tokenAmount; poolWallet = b.wallet; }
  }
  const realBuys = buysAll.filter((b) => b.wallet !== poolWallet);
  if (!realBuys.length) return { traced: false, genesis, note: "Only pool genesis tx found." };

  const launchSlot = realBuys[0].slot;
  const launchTime = realBuys[0].time;

  // First acquisition per wallet (chronological).
  const seen = new Set<string>();
  const firstBuys: any[] = [];
  for (const b of realBuys) { if (!seen.has(b.wallet)) { seen.add(b.wallet); firstBuys.push(b); } }

  // Same-slot bundle clusters: slots with >=3 distinct wallets buying together.
  const bySlot: Record<string, Set<string>> = {};
  for (const b of firstBuys) { (bySlot[b.slot] ||= new Set()).add(b.wallet); }
  const bundles = Object.entries(bySlot)
    .filter(([, wallets]) => wallets.size >= 3)
    .map(([slot, wallets]) => ({ slot: Number(slot), wallets: [...wallets], size: wallets.size }))
    .sort((a, b) => b.size - a.size);
  const bundledWallets = new Set<string>();
  for (const b of bundles) for (const w of b.wallets) bundledWallets.add(w);

  // Sniper = bought in the launch slot OR within 20s of the first real buy.
  const isSniper = (b: any) => b.slot === launchSlot || (!!launchTime && !!b.time && (b.time - launchTime) <= 20_000);
  const snipers = firstBuys.filter(isSniper).map((b) => ({ ...b, bundled: bundledWallets.has(b.wallet) }));

  const earlyBuyers = firstBuys.slice(0, limit).map((b, i) => ({
    rank: i + 1, wallet: b.wallet, tokenAmount: b.tokenAmount, solSpent: b.solSpent,
    txHash: b.txHash, slot: b.slot, time: b.time,
    secondsAfterLaunch: launchTime && b.time ? Math.round((b.time - launchTime) / 1000) : null,
    sniper: isSniper(b),
    bundled: bundledWallets.has(b.wallet),
  }));

  const sniperPct = firstBuys.length ? Math.round((snipers.length / firstBuys.length) * 100) : 0;
  const bundlePct = firstBuys.length ? Math.round((bundledWallets.size / firstBuys.length) * 100) : 0;

  // Insider clusters: early buyers funded by the same wallet. Time-boxed so a slow
  // RPC never blows the function budget — we ship whatever resolved in time.
  const fundingTimeout = new Promise<{ funders: Record<string, string>; clusters: any[] }>((res) => setTimeout(() => res({ funders: {}, clusters: [] }), 22000));
  const { funders, clusters } = await Promise.race([traceFunding(firstBuys.map((b) => b.wallet)), fundingTimeout]);
  const insiderWallets = new Set<string>();
  for (const c of clusters) for (const w of c.wallets) insiderWallets.add(w);
  const insiderPct = firstBuys.length ? Math.round((insiderWallets.size / firstBuys.length) * 100) : 0;

  const tag = (w: string) => ({ funder: funders[w] || null, insider: insiderWallets.has(w) });
  const earlyBuyers2 = earlyBuyers.map((b) => ({ ...b, ...tag(b.wallet) }));
  const snipers2 = snipers.slice(0, 30).map((b: any) => ({ ...b, ...tag(b.wallet) }));

  return {
    traced: true, genesis, source: "helius",
    launchSlot, launchTime, pool: poolWallet,
    counts: {
      earlyBuyers: firstBuys.length,
      snipers: snipers.length,
      bundledWallets: bundledWallets.size,
      bundles: bundles.length,
      insiders: insiderWallets.size,
      insiderClusters: clusters.length,
      sniperPct, bundlePct, insiderPct,
    },
    earlyBuyers: earlyBuyers2,
    snipers: snipers2,
    bundles: bundles.slice(0, 15),
    insiderClusters: clusters.slice(0, 10),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  _dbg = {};
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const mint = String(body.mint || url.searchParams.get("mint") || "");
    if (!mint) return json({ ok: false, error: "mint required" }, 400);

    const cacheKey = `xray/${mint}.json`;
    
    // Fast path: return cached result instantly
    if (!body.debug && !body.refresh) {
      const cached = await kvGet(cacheKey);
      if (cached) return json({ ok: true, mint, xray: cached.xray, cached: true });
    }

    // Timeout-constrained analysis: abort after 5s for instant response
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    let xray;
    try {
      xray = await Promise.race([
        analyze(mint, Number(body.limit) || 50),
        new Promise((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("analysis timeout"))))
      ]) as any;
      clearTimeout(timeoutId);
    } catch (timeoutErr) {
      clearTimeout(timeoutId);
      // On timeout, return any stale cache or "unavailable"
      const staleCache = await kvGet(cacheKey).catch(() => null);
      if (staleCache) {
        return json({ ok: true, mint, xray: staleCache.xray, cached: true, note: "cached (analysis timeout)" });
      }
      // No prior cache, tell client analysis is unavailable
      return json({ ok: false, mint, error: "analysis timeout — try again in a moment", unavailable: true });
    }

    if (xray.traced) kvPut(cacheKey, { xray, at: Date.now() }).catch(() => {});

    return json({ ok: true, mint, xray, _debug: body.debug ? _dbg : undefined });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) });
  }
});
