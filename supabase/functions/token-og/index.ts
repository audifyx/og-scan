// token-og — public OG/Twitter meta for a scanned coin so Telegram/X/Discord
// render a rich preview card (banner image + OG score). Humans are redirected
// to the live page at ogscan.fun/t/<mint>. verify_jwt=false (crawled publicly).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = "https://ogscan.fun";

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtUsd = (n: any) => {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "--";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
};

Deno.serve(async (req) => {
  const mint = new URL(req.url).searchParams.get("mint") || "";
  const dest = `${SITE}/t/${encodeURIComponent(mint)}`;
  let title = "Token Scan — OG Scan";
  let desc = "Live on-chain intelligence: rug score, holders, dev DNA and market data.";
  let image = `${SITE}/og-default.png`;

  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/og-scan-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
      body: JSON.stringify({ query: mint, source: "web" }),
    });
    const j = await r.json();
    if (j?.ok && j.token) {
      const t = j.token;
      const score = j.score?.total ?? "?";
      const sym = t.symbol ? `$${t.symbol}` : (t.name || "Token");
      title = `${esc(sym)} · OG Score ${score}/100 — OG Scan`;
      desc = `${esc(j.verdict || "")} · MC ${fmtUsd(t.mcap)} · Liq ${fmtUsd(t.liquidity)} · ${Number(t.holderCount || 0).toLocaleString()} holders. Full live report on OG Scan.`;
      image = t.banner || t.openGraph || t.image || image;
    }
  } catch { /* fall back to defaults */ }

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="OG Scan">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(dest)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(dest)}">
<link rel="canonical" href="${esc(dest)}">
</head><body style="background:#05070d;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<a href="${esc(dest)}" style="color:#8ab4ff">Opening report…</a>
<script>location.replace(${JSON.stringify(dest)});</script>
</body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
});
