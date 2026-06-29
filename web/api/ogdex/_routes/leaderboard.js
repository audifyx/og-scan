// OG DEX — trader PnL leaderboard. Computes realized PnL + win rate from recent
// swap history for the tracked KOL / smart-money wallets, ranked best-first.
// Heavy to compute, so the result is cached in Storage KV for ~1h.
import { send, cache, dbSelect, kvGet, kvPut } from "../_lib.js";
import { computePnl } from "../_pnl.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const STATIC_KOLS = require("../_kols.json").kols;

const isAddr = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || "");
const CACHE_KEY = "leaderboard/kol-v1.json";
const TTL_MS = 60 * 60 * 1000;
const MAX_WALLETS = 50;

async function mapLimit(items, limit, fn) {
  const out = []; let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  });
  await Promise.all(workers);
  return out;
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const refresh = url.searchParams.get("refresh") === "1";
  const walletsParam = (url.searchParams.get("wallets") || "").split(",").map((s) => s.trim()).filter(isAddr);

  // Serve cache (skip when explicit wallets requested).
  if (!walletsParam.length && !refresh) {
    const cached = await kvGet(CACHE_KEY);
    if (cached && Date.now() - (cached.at || 0) < TTL_MS) { cache(res, 300, 1800); return send(res, 200, { ...cached, cached: true }); }
  }

  try {
    // Build the wallet set + metadata.
    // Primary: static _kols.json (always available)
    // Augmented by: DB ogdex_kol_directory (adds avatars, updated handles)
    let meta = {};
    let wallets = walletsParam;
    if (!wallets.length) {
      // Seed from static list first (guaranteed fallback)
      for (const k of STATIC_KOLS) {
        if (!isAddr(k.address)) continue;
        if (k.status === "disputed") continue;
        meta[k.address] = {
          name: k.name || null,
          twitter: k.twitter ? String(k.twitter).replace(/^@/, "") : null,
          twitterUrl: k.twitter ? `https://x.com/${String(k.twitter).replace(/^@/, "")}` : null,
          avatar: null,
          tags: k.tags || [],
        };
      }
      // Augment with DB rows (override name/avatar if present)
      const rows = await dbSelect("ogdex_kol_directory", "select=address,name,x_handle,x_url,image_url,tags,status&limit=300").catch(() => []);
      for (const r of rows) {
        if (!isAddr(r.address)) continue;
        if (r.status === "disputed") continue;
        meta[r.address] = {
          name: r.name || meta[r.address]?.name || null,
          twitter: r.x_handle ? String(r.x_handle).replace(/^@/, "") : (meta[r.address]?.twitter || null),
          twitterUrl: r.x_url || (r.x_handle ? `https://x.com/${String(r.x_handle).replace(/^@/, "")}` : meta[r.address]?.twitterUrl || null),
          avatar: r.image_url || null,
          tags: r.tags || meta[r.address]?.tags || [],
        };
      }
      wallets = Object.keys(meta).slice(0, MAX_WALLETS);
    }
    if (!wallets.length) return send(res, 200, { ok: false, error: "no wallets to rank" });

    const computed = await mapLimit(wallets, 4, async (w) => {
      try {
        const p = await computePnl(w, { sigLimit: 40 });
        return {
          address: w, ...(meta[w] || {}),
          realizedPnlUsd: p.realizedPnlUsd ?? 0,
          realizedPnlSol: p.realizedPnlSol ?? 0,
          winRate: p.winRate ?? null,
          closedTrades: p.closedTrades ?? 0,
          openPositions: p.openPositions ?? 0,
          totalSwaps: p.totalSwaps ?? 0,
        };
      } catch { return null; }
    });

    const entries = computed.filter((e) => e && (e.closedTrades > 0 || e.totalSwaps > 0))
      .sort((a, b) => (b.realizedPnlUsd || 0) - (a.realizedPnlUsd || 0))
      .map((e, i) => ({ rank: i + 1, ...e }));

    const payload = { ok: true, at: Date.now(), count: entries.length, entries };
    if (!walletsParam.length) await kvPut(CACHE_KEY, payload).catch(() => {});
    cache(res, 300, 1800);
    return send(res, 200, payload);
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}
