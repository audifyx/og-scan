/**
 * Moved from web/api/share-wallet.ts into the web.js connector (LAZY).
 * Vercel Hobby allows max 12 serverless functions — standalone api/ files
 * are folded into connectors instead. Routed via vercel.json:
 * /sharew/:address -> /api/web?path=share-wallet&address=:address.
 *
 * NOTE: this was _share-wallet.ts — converted to plain .js because Vercel does
 * not bundle .ts files dynamically imported from the .js web.js LAZY map, so
 * the share-wallet route 500'd in prod (same failure as _share.ts).
 */

// Serves the OG-meta page for /sharew/:address (wallet PnL flex card) with a
// guaranteed text/html content-type. Proxies the wallet-og edge function.
export default async function handler(req, res) {
  const address = String(req.query.address || "").trim();
  const qs = new URLSearchParams();
  qs.set("address", address);
  for (const k of ["pnl", "win", "trades", "app"]) if (req.query[k] != null) qs.set(k, String(req.query[k]));
  const dest = `https://www.ogscan.fun/ORBITX_DEX/wallet/${encodeURIComponent(address)}`;
  try {
    const r = await fetch(`https://ibojtmeqgzabgeiwbvhf.supabase.co/functions/v1/wallet-og?${qs.toString()}`);
    const html = await r.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=120");
    return res.status(200).send(html);
  } catch {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${dest}"></head><body><a href="${dest}">Opening wallet…</a></body></html>`);
  }
}
