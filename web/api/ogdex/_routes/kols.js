import { callFn, send, cache, dbSelect, dbInsert, dbUpdate, readBody, ADMIN_PASS } from "../_lib.js";
import { parseSwap } from "../_swap.js";
import { enrichTokens } from "../_market.js";
import { computePnl } from "../_pnl.js";
import { readFileSync } from "fs";

const SOL = "So11111111111111111111111111111111111111112";
let SEED = { kols: [] };
try { SEED = JSON.parse(readFileSync(new URL("../_kols.json", import.meta.url), "utf8")); } catch {}

const pub = (p) => ({
  kolId: p.kol_id || p.id || null, name: p.name, twitter: p.x_handle || null,
  twitterUrl: p.x_url || (p.x_handle ? `https://x.com/${String(p.x_handle).replace(/^@/, "")}` : null),
  avatar: p.image_url || null, address: p.address || p.wallet_address, tags: p.tags || [],
  status: p.status || "active", notes: p.notes || null, pnl: p.pnl ?? null, winRate: p.win_rate ?? null,
  followers: p.followers_count ?? null, isActive: p.is_active ?? (p.status !== "disputed"),
});
const seedDirectory = () => { const m = {}; for (const k of SEED.kols) m[k.address] = { name: k.name, twitter: k.twitter, tags: k.tags, status: k.status, notes: k.notes, address: k.address }; return m; };

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { jsonrpc: "2.0", id: 1, method, params });
  return r?.data?.result ?? r?.result ?? null;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST") return add(req, res);
  const sp = url.searchParams;

  if (sp.get("pnl")) return pnlRefresh(res, sp);
  if (sp.get("directory")) return directory(res);
  if (sp.get("feed")) return feed(res, sp);
  if (sp.get("activity")) return activity(res, sp);
  if (sp.get("address")) return profile(res, sp.get("address"));
  return list(res);
}

async function directory(res) {
  cache(res, 60, 300);
  try {
    const rows = await dbSelect("ogdex_kol_directory", "select=address,name,x_handle,x_url,image_url,tags,status,notes,pnl,win_rate,kol_id&limit=2000");
    const map = {}; for (const r of rows) map[r.address] = pub(r);
    return send(res, 200, { ok: true, count: Object.keys(map).length, directory: map });
  } catch (e) { return send(res, 200, { ok: true, fromSeed: true, directory: seedDirectory(), error: String(e?.message || e) }); }
}

async function list(res) {
  cache(res, 30, 120);
  try {
    const rows = await dbSelect("kol_profiles", "select=*&order=is_active.desc,followers_count.desc.nullslast,name.asc&limit=1000");
    return send(res, 200, { ok: true, count: rows.length, kols: rows.map(pub) });
  } catch (e) { return send(res, 200, { ok: true, fromSeed: true, kols: SEED.kols.map((k) => pub({ ...k, x_handle: k.twitter, wallet_address: k.address })), error: String(e?.message || e) }); }
}

async function profile(res, address) {
  cache(res, 30, 120);
  try {
    const dir = await dbSelect("ogdex_kol_directory", `select=*&address=eq.${address}&limit=1`);
    if (!dir.length) return send(res, 200, { ok: false, error: "not a tracked KOL" });
    const kolId = dir[0].kol_id;
    const [prof, wallets] = await Promise.all([
      dbSelect("kol_profiles", `id=eq.${kolId}&limit=1`),
      dbSelect("kol_wallets", `kol_id=eq.${kolId}&select=wallet_address,label,is_primary`),
    ]);
    const p = prof[0] || dir[0];
    return send(res, 200, { ok: true, kol: pub({ ...p, kol_id: kolId }), wallets: wallets.map((w) => ({ address: w.wallet_address, label: w.label, primary: w.is_primary })) });
  } catch (e) { return send(res, 200, { ok: false, error: String(e?.message || e) }); }
}

async function activity(res, sp) {
  const address = (sp.get("activity") || "").trim();
  const limit = Math.min(Number(sp.get("limit")) || 20, 40);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return send(res, 400, { ok: false, error: "wallet required" });
  cache(res, 15, 45);
  try {
    const sigs = (await rpc("getSignaturesForAddress", [address, { limit }])) || [];
    const txs = await Promise.all(sigs.slice(0, limit).map((s) => rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)));
    const swaps = txs.map((t) => parseSwap(t, address)).filter(Boolean);
    const meta = await enrichTokens(swaps.map((s) => s.mint));
    const act = swaps.map((s) => { const m = meta[s.mint] || {}; return { ...s, symbol: m.symbol || null, name: m.name || null, image: m.image || null, priceUsd: m.price ?? null, mcap: m.mcap ?? null, usdValue: m.price ? s.tokenAmount * m.price : null }; });
    return send(res, 200, { ok: true, address, activity: act });
  } catch (e) { return send(res, 200, { ok: false, error: String(e?.message || e), activity: [] }); }
}

const GT_HDR = { Accept: "application/json;version=20230302" };

// Batch-enrich a list of mints with token metadata from GeckoTerminal
async function enrichMints(mints) {
  const unique = [...new Set(mints.filter(Boolean))];
  if (!unique.length) return {};
  const meta = {};
  // Chunk into groups of 25 (GeckoTerminal limit)
  const chunks = [];
  for (let i = 0; i < unique.length; i += 25) chunks.push(unique.slice(i, i + 25));
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const r = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/tokens/multi/${chunk.join(",")}`,
        { headers: GT_HDR }
      );
      const d = r.ok ? await r.json() : null;
      for (const item of (d?.data || [])) {
        const a = item.attributes || {};
        if (a.address) meta[a.address] = {
          name: a.name || null,
          symbol: a.symbol || null,
          icon: a.image_url || null,
        };
      }
    } catch {}
  }));
  return meta;
}

async function feed(res, sp) {
  const limit = Math.min(Number(sp.get("limit")) || 60, 120);
  const side = sp.get("side"); const kolId = sp.get("kolId"); const token = sp.get("token");
  cache(res, 5, 20);
  // Ingest new swaps with a hard time budget so the feed always responds fast.
  // Ingestion is parallelized (see ingestBatch); typical completion is 1-3s.
  try {
    await Promise.race([
      ingestBatch(sp),
      new Promise((r) => setTimeout(r, Number(process.env.KOL_INGEST_BUDGET_MS) || 6500)),
    ]);
  } catch {}
  try {
    let q = `select=*&order=tx_timestamp.desc&limit=${limit}`;
    if (side) q += `&tx_type=eq.${side}`;
    if (kolId) q += `&kol_id=eq.${kolId}`;
    if (token) q += `&or=(token_in.eq.${token},token_out.eq.${token})`;
    const rows = await dbSelect("ogdex_kol_feed", q);

    // Enrich ONLY mints that are genuinely missing symbol/name in the DB
    // (previously every mint was re-fetched from GeckoTerminal on every load).
    const missingMints = [...new Set(
      rows
        .filter(r => !(r.tx_type === "buy" ? r.symbol_out : r.symbol_in))
        .map(r => r.tx_type === "buy" ? r.token_out : r.token_in)
        .filter(m => m && m !== SOL && !MINT_META_CACHE[m])
    )];
    const fresh = missingMints.length ? await enrichMints(missingMints) : {};
    Object.assign(MINT_META_CACHE, fresh);

    return send(res, 200, { ok: true, count: rows.length, feed: rows.map(r => fmtFeed(r, MINT_META_CACHE)) });
  } catch (e) { return send(res, 200, { ok: false, error: String(e?.message || e), feed: [] }); }
}

// Warm-instance cache of mint -> {name,symbol,icon} so repeat feed loads skip GeckoTerminal.
const MINT_META_CACHE = {};
function fmtFeed(r, tokenMeta = {}) {
  const buy = r.tx_type === "buy";
  const mint   = buy ? r.token_out : r.token_in;
  const dbSym  = buy ? r.symbol_out : r.symbol_in;
  const enriched = (mint && tokenMeta[mint]) || {};
  // Prefer enriched metadata from GeckoTerminal; fall back to DB value
  const symbol    = enriched.symbol || dbSym || null;
  const tokenName = enriched.name   || dbSym || null;
  const tokenIcon = enriched.icon   || null;
  return {
    id: r.id, side: r.tx_type, kolId: r.kol_id, kolAddress: r.kol_address,
    name: r.name, twitter: r.x_handle, tags: r.tags || [], avatar: r.image_url, kolStatus: r.kol_status,
    mint, symbol, tokenName, tokenIcon,
    tokenAmount: buy ? r.amount_out : r.amount_in,
    solAmount:   buy ? r.amount_in  : r.amount_out,
    priceUsd: r.price_usd,
    usdValue: (r.price_usd && (buy ? r.amount_out : r.amount_in)) ? r.price_usd * (buy ? r.amount_out : r.amount_in) : null,
    time: r.tx_timestamp ? new Date(r.tx_timestamp).getTime() : null, txHash: r.tx_hash };
}
async function ingestBatch(sp) {
  // Wallets scanned per feed poll (parallel). Rotates through the directory so
  // every tracked wallet is swept in a handful of polls instead of dozens.
  const BATCH = Math.min(Number(sp.get("batch")) || 20, 40);
  const SIGS_PER_WALLET = 10;   // look-back per wallet (was 6)
  const TX_PER_WALLET = 6;      // new txs parsed per wallet per pass (was 3)
  const offset = Number(sp.get("offset")) || Math.floor(Date.now() / 60000) % 10;
  const wallets = await dbSelect("ogdex_kol_directory", "select=address,kol_id,kol_wallet_id,is_active&is_active=is.true&kol_wallet_id=not.is.null&limit=500");
  if (!wallets.length) return;
  const start = (offset * BATCH) % wallets.length;
  let slice = wallets.slice(start, start + BATCH);
  if (slice.length < BATCH) slice = slice.concat(wallets.slice(0, BATCH - slice.length));

  // 1) Fetch signatures for all wallets in parallel.
  const sigsAll = await Promise.all(slice.map((w) =>
    rpc("getSignaturesForAddress", [w.address, { limit: SIGS_PER_WALLET }]).then((r) => r || []).catch(() => [])
  ));

  // 2) One dedupe query for ALL candidate hashes (was one query per wallet).
  const allHashes = sigsAll.flatMap((sigs) => sigs.map((x) => x.signature)).filter(Boolean);
  if (!allHashes.length) return;
  const existing = await dbSelect("kol_transactions", `select=tx_hash&tx_hash=in.(${allHashes.join(",")})`).catch(() => []);
  const seen = new Set(existing.map((e) => e.tx_hash));

  // 3) Fetch + parse fresh transactions for all wallets in parallel.
  const jobs = [];
  slice.forEach((w, i) => {
    const fresh = (sigsAll[i] || []).map((x) => x.signature).filter((h) => h && !seen.has(h)).slice(0, TX_PER_WALLET);
    for (const h of fresh) {
      jobs.push(
        rpc("getTransaction", [h, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }])
          .then((tx) => { const sw = parseSwap(tx, w.address); return sw ? { ...sw, kol_id: w.kol_id, kol_wallet_id: w.kol_wallet_id } : null; })
          .catch(() => null)
      );
    }
  });
  const swapsAll = (await Promise.all(jobs)).filter(Boolean);
  if (!swapsAll.length) return;

  // 4) Enrich + insert all rows in ONE batched request (was one insert per swap).
  const meta = await enrichTokens(swapsAll.map((s) => s.mint)).catch(() => ({}));
  const rows = swapsAll.map((s) => {
    const m = meta[s.mint] || {}; const buy = s.side === "buy";
    return {
      kol_id: s.kol_id, kol_wallet_id: s.kol_wallet_id, tx_hash: s.txHash, tx_type: s.side,
      token_in: buy ? SOL : s.mint, token_out: buy ? s.mint : SOL, symbol_in: buy ? "SOL" : (m.symbol || null), symbol_out: buy ? (m.symbol || null) : "SOL",
      amount_in: buy ? s.solAmount : s.tokenAmount, amount_out: buy ? s.tokenAmount : s.solAmount, price_usd: m.price ?? null,
      tx_status: "success", blockchain: "solana", tx_timestamp: new Date(s.time || Date.now()).toISOString(),
    };
  });
  try { await dbInsert("kol_transactions", rows); }
  catch { for (const row of rows) { try { await dbInsert("kol_transactions", row); } catch {} } }
}

async function pnlRefresh(res, sp) {
  if (sp.get("pass") !== String(ADMIN_PASS)) return send(res, 401, { ok: false, error: "unauthorized" });
  const batch = Math.min(Number(sp.get("batch")) || 10, 14);
  const offset = Number(sp.get("offset")) || 0;
  try {
    const kols = await dbSelect("kol_profiles", `select=id,wallet_address&order=name.asc&offset=${offset}&limit=${batch}`);
    let n = 0;
    for (const k of kols) {
      try { const r = await computePnl(k.wallet_address, 40); await dbUpdate("kol_profiles", `id=eq.${k.id}`, { pnl: Math.round(r.realizedPnlUsd * 100) / 100, win_rate: r.winRate }); n++; } catch {}
    }
    return send(res, 200, { ok: true, updated: n, offset, batch });
  } catch (e) { return send(res, 200, { ok: false, error: String(e?.message || e) }); }
}

async function add(req, res) {
  try {
    const b = await readBody(req);
    if (!b.pass || String(b.pass) !== String(ADMIN_PASS)) return send(res, 401, { ok: false, error: "unauthorized" });
    const address = String(b.address || "").trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return send(res, 400, { ok: false, error: "valid Solana address required" });
    const row = { name: b.name || address.slice(0, 6), x_handle: b.twitter || null, x_url: b.twitter ? `https://x.com/${String(b.twitter).replace(/^@/, "")}` : null,
      wallet_address: address, blockchain: "solana", tags: Array.isArray(b.tags) ? b.tags : ["KOL"], status: b.status || "active", notes: b.notes || null, is_active: b.status !== "disputed", source: "admin" };
    const ins = await dbInsert("kol_profiles", row); const kol = ins[0] || row;
    if (kol.id) { try { await dbInsert("kol_wallets", { kol_id: kol.id, wallet_address: address, blockchain: "solana", label: "Primary", is_primary: true }); } catch {} }
    return send(res, 200, { ok: true, kol: pub(kol) });
  } catch (e) { return send(res, 400, { ok: false, error: String(e?.message || e) }); }
}
