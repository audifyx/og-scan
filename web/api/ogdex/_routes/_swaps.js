// OG DEX — a wallet's recent on-chain trades (buy/sell swaps), enriched with
// token name/symbol/image so the UI can render a feed with 1-tap "Ape" links.
//
// Fixes (wallet-data audit):
// - RPC: was direct callFn("rpc-proxy") — a proxy outage silently returned
//   trades: [] with ok: true. Now resilientRpc (proxy -> public fallback).
// - Classification: parseSwap is now program-based (DEX program must be
//   invoked) so plain transfers are no longer mislabeled as swaps.
// - USDC-leg swaps: the old `solAmount > 0` filter dropped real swaps paid
//   in stables (solAmount 0). Removed — kind === "swap" is the filter.
// - Pagination + completeness: `before` cursor, hasMore/nextBefore, scanned /
//   fetched / failedFetches — "0 swaps" now says how much history was read.
import { send, cache } from "../_lib.js";
import { scanWalletTxs } from "../_txscan.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag";
const GT = "https://api.geckoterminal.com/api/v2";
const isAddr = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || "");

async function gtMeta(mints) {
  const out = {};
  const uniq = [...new Set(mints.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 30) {
    const chunk = uniq.slice(i, i + 30);
    try {
      const r = await fetch(`${GT}/networks/solana/tokens/multi/${chunk.join(",")}`, {
        headers: { Accept: "application/json;version=20230302" },
      });
      if (!r.ok) continue;
      const d = await r.json();
      for (const t of d?.data || []) {
        const a = t.attributes || {};
        out[a.address] = {
          name: a.name,
          symbol: a.symbol,
          image: a.image_url && a.image_url !== "missing.png" ? a.image_url : null,
        };
      }
    } catch {}
  }
  return out;
}

async function solPrice() {
  try {
    const r = await fetch(`${JUP}/price/v3?ids=${SOL_MINT}`);
    const d = await r.json();
    return Number(d[SOL_MINT]?.usdPrice) || 0;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const address = (url.searchParams.get("address") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 40, 1), 100);
  const before = (url.searchParams.get("before") || "").trim() || null;
  if (!isAddr(address)) return send(res, 400, { ok: false, error: "valid wallet address required" });
  cache(res, 15, 45);
  try {
    // Fetch more signatures than the trade limit — many txs aren't swaps.
    const scan = await scanWalletTxs(address, {
      limit: Math.min(Math.max(limit * 2, 40), 200),
      before,
    });
    if (scan.signatures.length === 0 && scan.source === null && !scan.complete) {
      return send(res, 200, {
        ok: false,
        error: "trade_history_unavailable",
        message: "Signature history could not be retrieved from any RPC — not zero trades, unknown.",
        address,
        count: 0,
        trades: [],
        scanned: 0,
        complete: false,
        hasMore: false,
        nextBefore: null,
        retrievedAt: scan.retrievedAt,
      });
    }
    const swaps = scan.swaps
      .sort((a, b) => b.time - a.time)
      .slice(0, limit);

    const [meta, sp] = await Promise.all([
      gtMeta(swaps.map((s) => s.mint)),
      solPrice(),
    ]);

    const trades = swaps.map((s) => {
      const md = meta[s.mint] || {};
      return {
        txHash: s.txHash,
        side: s.side,
        mint: s.mint,
        tokenAmount: s.tokenAmount,
        solAmount: s.solAmount,
        time: s.time,
        usd: sp ? s.solAmount * sp : null,
        name: md.name || null,
        symbol: md.symbol || null,
        image: md.image || null,
      };
    });

    return send(res, 200, {
      ok: true,
      address,
      solPrice: sp,
      count: trades.length,
      trades,
      scanned: scan.scanned,
      fetched: scan.fetched,
      failedFetches: scan.failedFetches,
      complete: scan.complete,
      hasMore: scan.hasMore,
      nextBefore: scan.nextBefore,
      source: scan.source,
      retrievedAt: scan.retrievedAt,
    });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}
