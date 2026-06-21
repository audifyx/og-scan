// og-card — generates a 1200x630 branded share image (PNG) for a report or token.
// GET ?id=<reportId>  or  ?mint=<mint>. Pulls name/symbol/score/mcap from the
// reports table + scan_log, renders an SVG, rasterizes via resvg-wasm.
// Deploy --no-verify-jwt (used as og:image + embed image, must be public).
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WASM_URL = "https://esm.sh/@resvg/resvg-wasm@2.6.2/index_bg.wasm";
const FONT_URL = `${SUPABASE_URL}/storage/v1/object/public/assets/DejaVuSans-Bold.ttf`;
const H = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` };

let wasmReady = false;
let fontBuf: Uint8Array | null = null;
async function ensure() {
  if (!wasmReady) { await initWasm(await (await fetch(WASM_URL)).arrayBuffer()); wasmReady = true; }
  if (!fontBuf) fontBuf = new Uint8Array(await (await fetch(FONT_URL)).arrayBuffer());
}

const fmtUsd = (n: any) => {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "--";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
};
const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 28);
async function rest(path: string): Promise<any[]> { try { return await (await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H })).json(); } catch { return []; } }

function verdictFor(score: number | null): string {
  if (score == null) return "AI token intelligence for Solana";
  if (score >= 80) return "Strong fundamentals - Grim approves";
  if (score >= 60) return "Solid signals - worth a look";
  if (score >= 40) return "Mixed - do your own research";
  return "High risk - tread carefully";
}

function svgCard(d: { name: string; sym: string; score: number | null; mcap: string }) {
  const s = d.score;
  const sc = s == null ? "#8b94a0" : s >= 80 ? "#22e38a" : s >= 60 ? "#b6f23d" : s >= 40 ? "#fbbf24" : "#f87171";
  const scoreBlock = s == null ? "" : `
    <rect x="820" y="200" width="316" height="230" rx="24" fill="${sc}1a" stroke="${sc}" stroke-width="2"/>
    <text x="978" y="332" font-family="D" font-weight="bold" font-size="116" fill="${sc}" text-anchor="middle">${s}</text>
    <text x="978" y="388" font-family="D" font-weight="bold" font-size="24" fill="#8b94a0" text-anchor="middle">GRIM SCORE</text>`;
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="g" cx="14%" cy="-5%" r="95%"><stop offset="0%" stop-color="#16210d"/><stop offset="55%" stop-color="#07080b"/></radialGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="0" y="0" width="1200" height="8" fill="#b6f23d"/>
  <text x="64" y="92" font-family="D" font-weight="bold" font-size="30" fill="#b6f23d">OG SCAN</text>
  <text x="64" y="126" font-family="D" font-size="20" fill="#8b94a0">AI token intelligence for Solana</text>
  <text x="64" y="300" font-family="D" font-weight="bold" font-size="74" fill="#ffffff">${esc(d.name)}</text>
  <text x="64" y="356" font-family="D" font-weight="bold" font-size="38" fill="#8b94a0">$${esc(d.sym)}</text>
  <text x="64" y="472" font-family="D" font-size="24" fill="#8b94a0">Market Cap</text>
  <text x="64" y="516" font-family="D" font-weight="bold" font-size="46" fill="#ffffff">${d.mcap}</text>
  ${scoreBlock}
  <text x="64" y="582" font-family="D" font-size="23" fill="#22d3ee">${esc(verdictFor(d.score)).slice(0,60)}</text>
  <text x="1136" y="592" font-family="D" font-weight="bold" font-size="24" fill="#b6f23d" text-anchor="end">ogscan.fun</text>
  </svg>`;
}

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    const id = u.searchParams.get("id");
    let mint = u.searchParams.get("mint");
    let name = "Token", sym = "", score: number | null = null, mcap = "--";

    if (id) {
      const r = await rest(`reports?select=token_name,token_symbol,token_mint&id=eq.${encodeURIComponent(id)}&limit=1`);
      if (r[0]) { name = r[0].token_name || name; sym = r[0].token_symbol || ""; mint = r[0].token_mint || mint; }
    }
    if (mint) {
      const sl = await rest(`scan_log?select=og_score,market_cap,symbol,name&mint=eq.${encodeURIComponent(mint)}&order=created_at.desc&limit=1`);
      if (sl[0]) { score = sl[0].og_score ?? score; mcap = fmtUsd(sl[0].market_cap); if (!sym) sym = sl[0].symbol || ""; if (name === "Token") name = sl[0].name || name; }
    }

    // direct overrides (used by the poller for fresh migrations w/o a scan_log row)
    const qName = u.searchParams.get("name"); if (qName) name = qName;
    const qSym = u.searchParams.get("sym"); if (qSym) sym = qSym;
    const qScore = u.searchParams.get("score"); if (qScore != null && qScore !== "") score = Number(qScore);
    const qMc = u.searchParams.get("mc"); if (qMc != null && qMc !== "") mcap = fmtUsd(qMc);

    await ensure();
    const svg = svgCard({ name, sym, score, mcap });
    const png = new Resvg(svg, { font: { fontBuffers: [fontBuf!], defaultFontFamily: "D", loadSystemFonts: false }, fitTo: { mode: "width", value: 1200 } }).render().asPng();
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } });
  } catch (e) {
    return new Response("error: " + (e as Error).message, { status: 500 });
  }
});
