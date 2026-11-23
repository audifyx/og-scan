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

import { sanitizeOgHtml } from "../shared/share-sanitize.js";

// Serves the OG-meta page for /sharew/:address (wallet PnL flex card) with a
// guaranteed text/html content-type. Proxies the wallet-og edge function.
export default async function handler(req, res) {
  const address = String(req.query.address || "").trim();
  const qs = new URLSearchParams();
  qs.set("address", address);
  // pnl/win/trades are display numbers — forward only numeric values so
  // arbitrary text can never reach the edge function's HTML (audit B1).
  for (const k of ["pnl", "win", "trades"]) {
    const v = req.query[k];
    if (v != null && /^-?\d+(\.\d+)?%?$/.test(String(v).trim())) qs.set(k, String(v).trim());
  }
  if (req.query.app != null) qs.set("app", String(req.query.app));
  const dest = `https://orbitx.world/ORBITX_DEX/wallet/${encodeURIComponent(address)}`;
  try {
    const r = await fetch(`https://fnwrvcrrihkucwomszzk.supabase.co/functions/v1/wallet-og?${qs.toString()}`);
    const html = await r.text();
    // wallet-og edge fn still points at the retired ogscan.fun domain (and a
    // dead /OGDEX route) until it is redeployed — rewrite its URLs to the live domain.
    const fixed = sanitizeOgHtml(
      html
        .replaceAll("https://www.ogscan.fun", "https://orbitx.world")
        .replaceAll("https://ogscan.fun", "https://orbitx.world")
        .replaceAll("/OGDEX/wallet/", "/ORBITX_DEX/wallet/")
        .replaceAll("/OGDEX/ogdex-banner.jpg", "/orbitx-banner.jpg"),
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=120");
    return res.status(200).send(fixed);
  } catch {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${dest}"></head><body><a href="${dest}">Opening wallet…</a></body></html>`);
  }
}
