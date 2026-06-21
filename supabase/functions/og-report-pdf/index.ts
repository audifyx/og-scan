// og-report-pdf — generates a branded OG Scan PDF report for a token using the
// same data + OG score as og-scan-token (and the website). Returns application/pdf.
// Used by the Telegram super bot's /report command.
//
// POST { query }  -> PDF bytes
// NOTE: this is a clean server-rendered report. A pixel-identical copy of the
// in-app (html2canvas) PDF requires a headless-browser render service; tracked
// as a follow-up.

import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function fmtUsd(n: any): string {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "N/A";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
}
const pct = (n: any) => (n == null || !isFinite(Number(n))) ? "N/A" : (Number(n) >= 0 ? "+" : "") + Number(n).toFixed(1) + "%";

async function getScan(query: string): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/og-scan-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
    body: JSON.stringify({ query }),
  });
  return await r.json();
}

async function buildPdf(scan: any): Promise<Uint8Array> {
  const t = scan.token, sig = scan.score.signals, f = scan.flags;
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const W = 595;
  const ink = rgb(0.10, 0.11, 0.13);
  const sub = rgb(0.45, 0.47, 0.5);
  const lime = rgb(0.65, 0.85, 0.20);
  const gold = rgb(0.95, 0.75, 0.20);
  const blood = rgb(0.85, 0.25, 0.25);
  const line = rgb(0.88, 0.89, 0.9);

  let y = 800;
  const text = (s: string, x: number, yy: number, size = 11, font = reg, color = ink) =>
    page.drawText(String(s ?? ""), { x, y: yy, size, font, color });

  // Header band
  page.drawRectangle({ x: 0, y: 812, width: W, height: 30, color: rgb(0.06, 0.07, 0.09) });
  text("OG SCAN  -  TOKEN INTELLIGENCE REPORT", 40, 821, 12, bold, rgb(0.85, 0.95, 0.6));

  // Title
  text(`${t.name || "Unknown"}  ($${t.symbol || "?"})`, 40, 780, 22, bold, ink);
  text(`${t.mint}`, 40, 762, 9, reg, sub);

  // Verdict + score box
  const scoreColor = scan.score.total >= 66 ? lime : scan.score.total >= 33 ? gold : blood;
  page.drawRectangle({ x: 40, y: 700, width: W - 80, height: 48, borderColor: line, borderWidth: 1, color: rgb(0.98, 0.98, 0.99) });
  text("VERDICT", 52, 730, 8, bold, sub);
  text(scan.verdict, 52, 712, 14, bold, scoreColor);
  text("OG SCORE", W - 180, 730, 8, bold, sub);
  text(`${scan.score.total}/100`, W - 180, 708, 20, bold, scoreColor);

  // Key metrics grid
  let gy = 670;
  text("MARKET", 40, gy, 9, bold, sub); gy -= 6;
  page.drawLine({ start: { x: 40, y: gy }, end: { x: W - 40, y: gy }, thickness: 0.7, color: line }); gy -= 18;
  const rows: [string, string][] = [
    ["Price", t.priceUsd != null ? "$" + Number(t.priceUsd).toPrecision(4) : "N/A"],
    ["Market cap", fmtUsd(t.mcap)],
    ["FDV", fmtUsd(t.fdv)],
    ["Liquidity", fmtUsd(t.liquidity)],
    ["ATH market cap", fmtUsd(t.athMcap)],
    ["24h change", pct(t.priceChange24h)],
    ["24h volume", fmtUsd((t.buyVolume24h || 0) + (t.sellVolume24h || 0))],
    ["Holders", t.holderCount != null ? Number(t.holderCount).toLocaleString() : "N/A"],
    ["Top holders", t.topHoldersPct != null ? Number(t.topHoldersPct).toFixed(1) + "%" : "N/A"],
    ["Organic score", t.organicScore != null ? Math.round(t.organicScore) + (t.organicScoreLabel ? " (" + t.organicScoreLabel + ")" : "") : "N/A"],
    ["Created", t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : "N/A"],
  ];
  for (const [k, v] of rows) {
    text(k, 52, gy, 10, reg, sub);
    text(v, 280, gy, 10, bold, ink);
    gy -= 18;
  }

  // OG signal bars
  gy -= 8;
  text("OG SIGNALS", 40, gy, 9, bold, sub); gy -= 6;
  page.drawLine({ start: { x: 40, y: gy }, end: { x: W - 40, y: gy }, thickness: 0.7, color: line }); gy -= 20;
  const bars: [string, number][] = [
    ["Age", sig.age], ["ATH mcap", sig.athMcap], ["Holder profile", sig.holderProfile],
    ["Deploy pattern", sig.deployPattern], ["Pool age", sig.poolAge],
  ];
  for (const [k, v] of bars) {
    text(k, 52, gy, 10, reg, sub);
    const bx = 200, bw = 280;
    page.drawRectangle({ x: bx, y: gy - 2, width: bw, height: 8, color: rgb(0.92, 0.93, 0.94) });
    const c = v >= 66 ? lime : v >= 33 ? gold : blood;
    page.drawRectangle({ x: bx, y: gy - 2, width: bw * Math.max(0, Math.min(100, v)) / 100, height: 8, color: c });
    text(String(v), bx + bw + 8, gy, 10, bold, ink);
    gy -= 20;
  }

  // Risk flags
  gy -= 8;
  text("RISK FLAGS", 40, gy, 9, bold, sub); gy -= 6;
  page.drawLine({ start: { x: 40, y: gy }, end: { x: W - 40, y: gy }, thickness: 0.7, color: line }); gy -= 18;
  const flag = (label: string, ok: boolean) => {
    text(`${ok ? "[OK]" : "[!]"}  ${label}`, 52, gy, 10, bold, ok ? rgb(0.2, 0.55, 0.25) : blood);
    gy -= 16;
  };
  flag("Mint authority disabled", f.mintAuthorityDisabled === true);
  flag("Freeze authority disabled", f.freezeAuthorityDisabled === true);
  flag("Liquidity intact (not pulled)", !f.lpPulled);
  flag("Meets min liquidity", !!f.minLiquidity);
  flag("Jupiter verified", !!f.isVerified);
  text(f.isPumpFun ? (f.migratedFromPumpFun ? "pump.fun: migrated" : "pump.fun: bonding curve") : "pump.fun: no", 52, gy, 10, reg, sub);

  // Footer
  page.drawLine({ start: { x: 40, y: 60 }, end: { x: W - 40, y: 60 }, thickness: 0.7, color: line });
  text(`Generated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC  -  ogscan.fun`, 40, 46, 9, reg, sub);
  text(t.dexUrl || "", 40, 34, 8, reg, rgb(0.2, 0.45, 0.8));

  return await doc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { query } = await req.json().catch(() => ({ query: "" }));
    const q = String(query || "").trim();
    if (!q) return new Response(JSON.stringify({ ok: false, error: "Provide a mint or ticker." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const scan = await getScan(q);
    if (!scan || !scan.ok) return new Response(JSON.stringify({ ok: false, error: scan?.error || "Token not found." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const pdf = await buildPdf(scan);
    const sym = (scan.token.symbol || "token").replace(/[^a-zA-Z0-9]/g, "");
    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="ogscan_${sym}.pdf"` },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
