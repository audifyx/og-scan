// wallet-og — OG/Twitter meta for a wallet PnL flex card so X/Telegram render a
// rich preview. Stats are passed in by the share button (the user's own flex);
// humans are redirected to the live OG DEX wallet page. verify_jwt=false.
const SITE = "https://orbitx.world";
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (a: string) => (a && a.length > 10 ? a.slice(0, 4) + "…" + a.slice(-4) : a || "wallet");

Deno.serve((req) => {
  const u = new URL(req.url);
  const address = u.searchParams.get("address") || "";
  const pnl = u.searchParams.get("pnl");
  const win = u.searchParams.get("win");
  const trades = u.searchParams.get("trades");
  const app = u.searchParams.get("app") || "ogdex";
  const dest = app === "ogdex" ? `${SITE}/ORBITX_DEX/wallet/${encodeURIComponent(address)}` : `${SITE}/wallet/${encodeURIComponent(address)}`;
  const image = `${SITE}/orbitx-banner.jpg`;

  const pnlNum = Number(pnl);
  const pnlStr = pnl != null && isFinite(pnlNum) ? (pnlNum >= 0 ? "+$" : "-$") + Math.abs(pnlNum).toLocaleString(undefined, { maximumFractionDigits: 0 }) : null;
  const bits = [];
  if (pnlStr) bits.push(`PnL ${pnlStr}`);
  if (win) bits.push(`${win}% win rate`);
  if (trades) bits.push(`${trades} trades`);
  const title = `${short(address)} · ${pnlStr ? `${pnlStr} PnL` : "Wallet"} — OG DEX`;
  const desc = `${bits.join(" · ") || "Wallet portfolio + realized/unrealized PnL"}. Tracked on OG DEX — the data tools most platforms hide.`;

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="OG DEX">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(dest)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(dest)}">
<link rel="canonical" href="${esc(dest)}">
</head><body style="background:#05070d;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<a href="${esc(dest)}" style="color:#8ab4ff">Opening wallet…</a>
<script>location.replace(${JSON.stringify(dest)});</script>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=120" } });
});
