import type { VercelRequest, VercelResponse } from "@vercel/node";

// GET /api/kol/transactions?wallet=<address>&limit=25
// Returns parsed buy/sell trade events for a wallet via Helius enhanced txs.
const HELIUS_KEY =
  process.env.HELIUS_SECRET || process.env.HELIUS_API_KEY || process.env.REACT_APP_HELIUS_KEY || "";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function parseTrade(tx: any, wallet: string) {
  const tts: any[] = Array.isArray(tx?.tokenTransfers) ? tx.tokenTransfers : [];
  const nts: any[] = Array.isArray(tx?.nativeTransfers) ? tx.nativeTransfers : [];

  const recv = tts.filter((t) => t?.toUserAccount === wallet && t?.mint && t.mint !== SOL_MINT);
  const sent = tts.filter((t) => t?.fromUserAccount === wallet && t?.mint && t.mint !== SOL_MINT);

  const wsolIn = tts.filter((t) => t?.toUserAccount === wallet && t?.mint === SOL_MINT).reduce((s, t) => s + (Number(t.tokenAmount) || 0), 0);
  const wsolOut = tts.filter((t) => t?.fromUserAccount === wallet && t?.mint === SOL_MINT).reduce((s, t) => s + (Number(t.tokenAmount) || 0), 0);
  const solIn = wsolIn + nts.filter((n) => n?.toUserAccount === wallet).reduce((s, n) => s + (Number(n.amount) || 0), 0) / 1e9;
  const solOut = wsolOut + nts.filter((n) => n?.fromUserAccount === wallet).reduce((s, n) => s + (Number(n.amount) || 0), 0) / 1e9;

  let action: "buy" | "sell";
  let transfer: any;
  let solAmount: number;

  if (recv.length && !sent.length) {
    action = "buy"; transfer = recv[0]; solAmount = solOut;
  } else if (sent.length && !recv.length) {
    action = "sell"; transfer = sent[0]; solAmount = solIn;
  } else if (recv.length && sent.length) {
    action = "buy"; transfer = recv[0]; solAmount = solOut;
  } else {
    return null;
  }

  const isSwap = String(tx?.type || "").toUpperCase().includes("SWAP");
  if (!isSwap && solAmount <= 0) return null; // plain transfer, not a trade

  return {
    signature: String(tx?.signature || ""),
    timestamp: Number(tx?.timestamp) || 0,
    action,
    mint: String(transfer?.mint || ""),
    tokenAmount: Number(transfer?.tokenAmount) || 0,
    solAmount: Number(solAmount.toFixed(6)),
    source: String(tx?.source || ""),
    type: String(tx?.type || ""),
    description: String(tx?.description || ""),
    wallet,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const wallet = String(req.query.wallet || "").trim();
  if (!BASE58.test(wallet)) return res.status(400).json({ ok: false, error: "invalid wallet address" });
  if (!HELIUS_KEY) return res.status(500).json({ ok: false, error: "Helius API key not configured (set HELIUS_SECRET in Vercel env)" });

  const limit = Math.max(1, Math.min(Number(req.query.limit) || 25, 100));
  try {
    const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_KEY}&limit=${limit}`;
    const r = await fetch(url);
    if (!r.ok) {
      const body = await r.text();
      return res.status(502).json({ ok: false, error: `Helius ${r.status}`, detail: body.slice(0, 300) });
    }
    const txs = (await r.json()) as any[];
    const events = (Array.isArray(txs) ? txs : []).map((tx) => parseTrade(tx, wallet)).filter(Boolean);
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    return res.status(200).json({ ok: true, wallet, count: events.length, events });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
