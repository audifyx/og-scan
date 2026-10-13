// OG DEX — full wallet transaction history with pagination.
//
// The MCP had no way to retrieve a wallet's individual on-chain transactions:
// orbitx_get_swaps returned only swaps (and silently [] on RPC failure), so
// an agent could not actually research a wallet. This route returns every
// scanned tx classified as swap / transfer / failed / other, with fees,
// token deltas, and explicit completeness — plus a `before` cursor for paging
// through the entire history.
//
// Query: ?address=<wallet>&limit=<1..100, default 50>&before=<signature>
import { send, cache } from "../_lib.js";
import { scanWalletTxs } from "../_txscan.js";

const isAddr = (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || "");

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const address = (url.searchParams.get("address") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
  const before = (url.searchParams.get("before") || "").trim() || null;
  if (!isAddr(address)) return send(res, 400, { ok: false, error: "valid wallet address required" });
  cache(res, 15, 45);
  try {
    const scan = await scanWalletTxs(address, { limit, before });
    if (scan.signatures.length === 0 && scan.source === null && !scan.complete) {
      return send(res, 200, {
        ok: false,
        error: "transaction_history_unavailable",
        message: "Transaction history could not be retrieved from any RPC — not zero transactions, unknown.",
        address,
        count: 0,
        transactions: [],
        scanned: 0,
        complete: false,
        hasMore: false,
        nextBefore: null,
        retrievedAt: scan.retrievedAt,
      });
    }
    return send(res, 200, {
      ok: true,
      address,
      count: scan.txs.length,
      transactions: scan.txs,
      swaps: scan.swaps.length,
      transfers: scan.transfers.length,
      failed: scan.failed.length,
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
