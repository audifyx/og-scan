/**
 * Moved from web/api/share.ts into the web.js connector (LAZY).
 * Vercel Hobby allows max 12 serverless functions — standalone api/ files
 * are folded into connectors instead. Routed via vercel.json:
 * /share/:mint -> /api/web?path=share&mint=:mint.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Serves the OG-meta page for /share/:mint with a guaranteed text/html content-type.
// (Vercel external rewrites downgrade the upstream content-type to text/plain, which
// makes browsers show the HTML as code — so we proxy it first-party here.)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const mint = String(req.query.mint || "").trim();
  const app = String(req.query.app || "");
  const dest = app === "ogdex" ? `https://www.ogscan.fun/ORBITX_DEX/token/${encodeURIComponent(mint)}` : `https://www.ogscan.fun/t/${encodeURIComponent(mint)}`;
  try {
    const r = await fetch(`https://ffjipnkhcebjvttliptb.supabase.co/functions/v1/token-og?mint=${encodeURIComponent(mint)}${app ? `&app=${encodeURIComponent(app)}` : ""}`);
    const html = await r.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).send(html);
  } catch {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${dest}"></head><body><a href="${dest}">Opening report…</a></body></html>`);
  }
}
