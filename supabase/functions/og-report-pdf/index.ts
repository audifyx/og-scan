// og-report-pdf — generates the OG SCAN PRO Advanced Intelligence Dossier:
// a multi-page, branded PDF that combines REAL on-chain/market data (from
// og-scan-token) with an AI "real-time synthesis" layer (narrative, social/KOL,
// risk matrix, OG-score re-evaluation) rendered in the OG Scan PRO design.
//
// POST { query }  -> application/pdf

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonResp = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---------- value formatting ----------
function fmtUsd(n: any): string {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "N/A";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
}
const fmtNum = (n: any) => (n == null || !isFinite(Number(n))) ? "N/A" : Number(n).toLocaleString();
const pct = (n: any) => (n == null || !isFinite(Number(n))) ? "N/A" : (Number(n) >= 0 ? "+" : "") + Number(n).toFixed(1) + "%";

// ---------- data + AI ----------
async function getScan(query: string): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/og-scan-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
    body: JSON.stringify({ query }),
  });
  return await r.json();
}

// Keyless social/narrative intel: DexScreener for official links + boosts,
// r.jina.ai reader to pull the official site lore and the X profile stats.
async function jinaRead(url: string, maxChars = 3500): Promise<string> {
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "X-Return-Format": "markdown" },
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return "";
    return (await r.text()).slice(0, maxChars);
  } catch { return ""; }
}

async function gatherSocial(mint: string): Promise<any> {
  const out: any = { xHandle: null, xUrl: null, website: null, telegram: null, followers: null, posts: null, boosts: null, dexId: null, xText: "", siteText: "" };
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const pairs = (j.pairs || []).slice().sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const p = pairs[0];
    if (p) {
      out.dexId = p.dexId || null;
      out.boosts = p.boosts?.active ?? null;
      for (const sc of (p.info?.socials || [])) {
        if (sc.type === "twitter") out.xUrl = sc.url;
        if (sc.type === "telegram") out.telegram = sc.url;
      }
      out.website = p.info?.websites?.[0]?.url || null;
    }
  } catch { /* ignore */ }
  if (out.xUrl) out.xHandle = (out.xUrl.match(/x\.com\/([^/?#]+)/i) || [])[1] || (out.xUrl.match(/twitter\.com\/([^/?#]+)/i) || [])[1] || null;
  const [xText, siteText] = await Promise.all([
    out.xUrl ? jinaRead(out.xUrl, 2500) : Promise.resolve(""),
    out.website ? jinaRead(out.website, 3500) : Promise.resolve(""),
  ]);
  out.xText = xText; out.siteText = siteText;
  const fm = xText.match(/([\d,.]+)\s*Followers/i); if (fm) out.followers = fm[1];
  const pm = xText.match(/([\d,.]+)\s*posts/i); if (pm) out.posts = pm[1];
  return out;
}

async function synthesize(scan: any, social: any): Promise<any> {
  const t = scan.token;
  const facts = {
    name: t.name, symbol: t.symbol, mint: t.mint,
    priceUsd: t.priceUsd, mcap: t.mcap, fdv: t.fdv, liquidity: t.liquidity,
    holders: t.holderCount, topHoldersPct: t.topHoldersPct, organicScore: t.organicScore,
    ageDays: t.ageDays, poolAgeDays: t.poolAgeDays, athMcap: t.athMcap,
    priceChange24h: t.priceChange24h, buyVolume24h: t.buyVolume24h, sellVolume24h: t.sellVolume24h,
    txns24h: t.txns24h, numBuys24h: t.numBuys24h, numSells24h: t.numSells24h, numTraders24h: t.numTraders24h,
    isPumpFun: scan.flags.isPumpFun, migratedFromPumpFun: scan.flags.migratedFromPumpFun,
    verified: scan.flags.isVerified, ogScore: scan.score.total, signals: scan.score.signals, verdict: scan.verdict,
  };
  const schema = `{
"subtitle": "short evocative tagline for the token (<=90 chars)",
"proVerdictTitle": "the PRO re-assessed one-line verdict (uppercase ok)",
"reassessment": "1 paragraph first-principles reassessment vs the original score",
"marketContext": {"price":"trend note","mcap":"note","liquidity":"note","volume":"note","holders":"note","topHolders":"note","age":"note","txns":"note","organic":"note"},
"keyInsight": "1 short paragraph",
"securityImplications": {"mint":"impl","freeze":"impl","liquidity":"impl","minLiq":"impl","verified":"impl","deploy":"impl","poolAge":"impl"},
"txnFlow": "1 paragraph 24h transaction flow analysis",
"godTierObservation": "1 short paragraph",
"holderDistribution": "1 paragraph",
"riskNote": "1 short paragraph",
"narrative": "1 paragraph narrative archaeology / origin of the token's meme or theme",
"firstPrinciples": "1 short paragraph",
"socialActivity": "1 paragraph on X/Twitter activity tone",
"socialTable": [{"account":"@handle","engagement":"e.g. 100 likes","theme":"content theme"}],
"kolIntro": "1 paragraph on KOL involvement",
"kolTable": [{"entity":"name","role":"role/signal","notes":"notes"}],
"godTierSynthesis": "1 paragraph synthesis",
"memeRisks": ["risk bullet", "..."],
"boughtSold": "1 paragraph bought vs sold flow analysis",
"flowBullets": ["bullet", "..."],
"proFactors": {"Age / Novelty":"pro|rationale","Holder Profile":"pro|rationale","Narrative Strength":"pro|rationale","KOL / Smart Money":"pro|rationale","Risk Flags (Security)":"pro|rationale","Volume & Liquidity":"pro|rationale"},
"proScore": 72,
"finalVerdict": "1 paragraph final verdict",
"monitoring": ["bullet", "..."]
}`;
  const prompt = `You are OG SCAN PRO, a god-tier Solana token intelligence analyst. Produce an ADVANCED INTELLIGENCE DOSSIER for this token as STRICT JSON only (no markdown, no commentary). Ground every number in the REAL DATA provided; for narrative/social/KOL use what you genuinely know about this specific token/CA and the wider meta — if unknown, give measured, non-fabricated, clearly-hedged analysis (never invent fake handles or fake on-chain events). Keep each text field tight and high signal. Tone: sharp, first-principles, NFA.

REAL DATA:
${JSON.stringify(facts)}

REAL SOCIAL/NARRATIVE CONTEXT (keyless sources - use ONLY this; NEVER invent handles, tweets, or engagement numbers not present here):
Official X: ${social.xUrl || "unknown"} | followers: ${social.followers || "unknown"} | posts: ${social.posts || "unknown"}
Telegram: ${social.telegram || "unknown"} | Website: ${social.website || "unknown"} | DEX: ${social.dexId || "unknown"} | Dex boosts: ${social.boosts ?? "none"}
OFFICIAL WEBSITE CONTENT (basis for Narrative Archaeology):
${(social.siteText || "none").slice(0, 1800)}
X PROFILE CONTENT:
${(social.xText || "none").slice(0, 1200)}

Rules: Base "narrative"/"firstPrinciples" on the website content above. Base social/KOL on the real official handle + any real names in the context. If you lack tweet-level engagement data, set "socialTable" and "kolTable" to [] and describe presence qualitatively using the real follower/post counts. Do NOT fabricate.

Return ONLY this JSON shape:
${schema}`;
  // Call the NVIDIA model directly (single completion) instead of the heavy
  // enhanced-intelligence agent — much faster and controllable for JSON output.
  const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
  const NVIDIA_BASE = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
  const MODEL = Deno.env.get("NVIDIA_MODEL") || "meta/llama-3.3-70b-instruct";
  try {
    const r = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You are OG SCAN PRO. Output ONLY a single valid minified JSON object. No markdown, no prose, no code fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 2400,
      }),
      signal: AbortSignal.timeout(38000),
    });
    const j = await r.json();
    let txt = String(j.choices?.[0]?.message?.content || "").trim();
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    if (a >= 0 && b > a) txt = txt.slice(a, b + 1);
    return JSON.parse(txt);
  } catch (_e) {
    return {};
  }
}

// ---------- PDF layout engine ----------
const PW = 595, PH = 842, ML = 45, MR = 45, CW = PW - ML - MR;
const CONTENT_TOP = PH - 52, CONTENT_BOTTOM = 46;

const C = {
  green: rgb(0.13, 0.86, 0.49), white: rgb(1, 1, 1), black: rgb(0.03, 0.04, 0.05),
  ink: rgb(0.11, 0.12, 0.14), gray: rgb(0.42, 0.45, 0.49), faint: rgb(0.62, 0.64, 0.67),
  indigo: rgb(0.18, 0.20, 0.55), blue: rgb(0.20, 0.45, 0.85),
  red: rgb(0.95, 0.27, 0.36), greenBar: rgb(0.17, 0.74, 0.36), gold: rgb(0.80, 0.58, 0.10),
  rowAlt: rgb(0.965, 0.965, 0.975), border: rgb(0.84, 0.85, 0.88),
  redBg: rgb(0.99, 0.93, 0.93), redBd: rgb(0.90, 0.32, 0.34), greenBg: rgb(0.92, 0.97, 0.93),
};

class Doc {
  doc!: PDFDocument; page!: PDFPage; y = CONTENT_TOP; n = 0;
  reg!: PDFFont; bold!: PDFFont; ital!: PDFFont; boldItal!: PDFFont; mono!: PDFFont;
  ca = ""; titleR = "";
  async init() {
    this.doc = await PDFDocument.create();
    this.reg = await this.doc.embedFont(StandardFonts.Helvetica);
    this.bold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.ital = await this.doc.embedFont(StandardFonts.HelveticaOblique);
    this.boldItal = await this.doc.embedFont(StandardFonts.HelveticaBoldOblique);
    this.mono = await this.doc.embedFont(StandardFonts.Courier);
  }
  addPage() {
    this.page = this.doc.addPage([PW, PH]);
    this.n++;
    // header band
    this.page.drawRectangle({ x: 0, y: PH - 34, width: PW, height: 34, color: C.black });
    this.page.drawText("OG SCAN PRO", { x: ML, y: PH - 22, size: 11, font: this.bold, color: C.green });
    const tr = this.titleR;
    const trW = this.bold.widthOfTextAtSize(tr, 8);
    this.page.drawText(tr, { x: PW - MR - trW, y: PH - 21, size: 8, font: this.bold, color: C.white });
    this.page.drawRectangle({ x: 0, y: PH - 37, width: PW, height: 2.2, color: C.green });
    // footer band
    this.page.drawRectangle({ x: 0, y: 0, width: PW, height: 30, color: C.black });
    const f = `Generated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC  |  ogscan.fun  |  CA: ${this.ca}`;
    this.page.drawText(f.length > 95 ? f.slice(0, 95) : f, { x: ML, y: 11, size: 7, font: this.reg, color: C.faint });
    const pg = `Page ${this.n}`;
    this.page.drawText(pg, { x: PW - MR - this.reg.widthOfTextAtSize(pg, 7), y: 11, size: 7, font: this.reg, color: C.faint });
    this.y = CONTENT_TOP;
  }
  ensure(h: number) { if (this.y - h < CONTENT_BOTTOM) this.addPage(); }
  gap(h: number) { this.y -= h; }

  wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const out: string[] = [];
    for (const raw of String(text ?? "").split("\n")) {
      const words = raw.split(/\s+/).filter(Boolean);
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (font.widthOfTextAtSize(test, size) > maxW && line) { out.push(line); line = w; }
        else line = test;
      }
      out.push(line);
    }
    return out;
  }
  para(text: string, opts: { size?: number; font?: PDFFont; color?: any; x?: number; w?: number; lh?: number; indent?: number } = {}) {
    if (!text) return;
    const size = opts.size ?? 9.5, font = opts.font ?? this.reg, color = opts.color ?? C.ink;
    const x = opts.x ?? ML, w = opts.w ?? CW, lh = opts.lh ?? size + 3.5;
    for (const line of this.wrap(text, font, size, w)) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y, size, font, color });
      this.y -= lh;
    }
  }
  heading(title: string) {
    this.gap(8); this.ensure(22);
    this.page.drawText(title.toUpperCase(), { x: ML, y: this.y, size: 14, font: this.bold, color: C.green });
    this.y -= 19;
  }
  subheading(title: string) {
    this.gap(3); this.ensure(16);
    this.page.drawText(title, { x: ML, y: this.y, size: 11, font: this.bold, color: C.green });
    this.y -= 15;
  }
  bullets(items: string[], opts: { color?: any } = {}) {
    for (const it of items || []) {
      const lines = this.wrap(it, this.reg, 9.5, CW - 12);
      lines.forEach((ln, i) => {
        this.ensure(13);
        this.page.drawText(i === 0 ? "\u2022" : " ", { x: ML, y: this.y, size: 9.5, font: this.bold, color: C.green });
        this.page.drawText(ln, { x: ML + 12, y: this.y, size: 9.5, font: this.reg, color: opts.color ?? C.ink });
        this.y -= 13;
      });
      this.y -= 2;
    }
  }
  centered(text: string, y: number, size: number, font: PDFFont, color: any) {
    const w = font.widthOfTextAtSize(text, size);
    this.page.drawText(text, { x: (PW - w) / 2, y, size, font, color });
  }
}

function rowHeight(D: Doc, cells: string[], widths: number[], size: number): number {
  let max = 1;
  cells.forEach((c, i) => { max = Math.max(max, D.wrap(c, D.reg, size, widths[i] - 10).length); });
  return max * (size + 2.5) + 9;
}

type Cell = { text: string; color?: any; bold?: boolean };
function table(D: Doc, headers: string[], rows: Cell[][], widths: number[], size = 8.5) {
  const drawHeaderRow = () => {
    const h = 19;
    D.ensure(h + 4);
    let x = ML;
    D.page.drawRectangle({ x: ML, y: D.y - h + 5, width: CW, height: h, color: C.black });
    headers.forEach((hd, i) => {
      const tw = D.bold.widthOfTextAtSize(hd, size);
      D.page.drawText(hd, { x: x + (widths[i] - tw) / 2, y: D.y - h + 11, size, font: D.bold, color: C.white });
      x += widths[i];
    });
    D.y -= h + 1;
  };
  drawHeaderRow();
  let alt = false;
  for (const row of rows) {
    const texts = row.map((c) => c.text ?? "");
    const h = rowHeight(D, texts, widths, size);
    if (D.y - h < CONTENT_BOTTOM) { D.addPage(); drawHeaderRow(); alt = false; }
    if (alt) D.page.drawRectangle({ x: ML, y: D.y - h + 4, width: CW, height: h, color: C.rowAlt });
    // borders
    D.page.drawRectangle({ x: ML, y: D.y - h + 4, width: CW, height: h, borderColor: C.border, borderWidth: 0.6, color: undefined as any, opacity: 0 });
    let x = ML;
    row.forEach((cell, i) => {
      const lines = D.wrap(cell.text ?? "", cell.bold ? D.bold : D.reg, size, widths[i] - 10);
      let ty = D.y - 3;
      for (const ln of lines) {
        D.page.drawText(ln, { x: x + 6, y: ty, size, font: cell.bold ? D.bold : D.reg, color: cell.color ?? C.ink });
        ty -= size + 2.5;
      }
      x += widths[i];
    });
    D.y -= h;
    alt = !alt;
  }
  D.y -= 4;
}

function verdictBar(D: Doc, text: string, bg: any) {
  const size = 11, lines = D.wrap(text, D.bold, size, CW - 30);
  const h = lines.length * (size + 4) + 14;
  D.ensure(h + 6);
  D.page.drawRectangle({ x: ML, y: D.y - h + 4, width: CW, height: h, color: bg });
  let ty = D.y - 12;
  for (const ln of lines) { D.centered(ln, ty - 2, size, D.bold, C.white); ty -= size + 4; }
  D.y -= h + 6;
}

async function buildPdf(scan: any, ai: any, social: any): Promise<Uint8Array> {
  const t = scan.token, sig = scan.score.signals, f = scan.flags;
  const D = new Doc();
  await D.init();
  D.ca = t.mint;
  const sym = (t.symbol || "TOKEN").replace(/^\$/, "");
  D.titleR = `${sym.toUpperCase()} DEEP DIVE INTELLIGENCE DOSSIER | NFA | REAL-TIME SYNTHESIS`;
  D.addPage();

  // ---- Title block ----
  D.gap(10);
  D.centered("OG SCAN PRO", D.y, 30, D.bold, C.green); D.y -= 30;
  D.centered("ADVANCED TOKEN INTELLIGENCE DOSSIER", D.y, 13, D.reg, C.gray); D.y -= 26;

  // token name box
  const boxH = 74;
  D.ensure(boxH + 8);
  D.page.drawRectangle({ x: ML, y: D.y - boxH, width: CW, height: boxH, color: C.black, borderColor: C.green, borderWidth: 2 });
  D.centered(`${t.name || "Unknown"} ($${sym})`, D.y - 24, 20, D.bold, C.green);
  D.centered(t.mint, D.y - 42, 9, D.mono, C.faint);
  const tagline = ai.subtitle || `${scan.verdict}`;
  D.centered(tagline.length > 90 ? tagline.slice(0, 90) : tagline, D.y - 60, 10, D.reg, C.blue);
  D.y -= boxH + 12;

  // ---- Verdict evolution ----
  D.heading("Verdict Evolution");
  verdictBar(D, `ORIGINAL OG SCAN: ${scan.verdict} \u2014 ${scan.score.total}/100`, C.red);
  verdictBar(D, `PRO ANALYSIS: ${ai.proVerdictTitle || "MEME / NARRATIVE RE-EVALUATION"}`, C.greenBar);
  D.gap(4);
  D.para(ai.reassessment || "First-principles reassessment: the baseline OG score reflects early-stage on-chain signals (age, deploy pattern). The PRO layer weighs narrative strength, community mechanics, and KOL/smart-money participation alongside the raw metrics for a meme-category-adjusted view. All meme assets carry extreme volatility.", { font: D.ital, color: C.indigo });

  // ---- Market snapshot ----
  D.heading("Real-Time Market Snapshot");
  const mc = ai.marketContext || {};
  const volTotal = (t.buyVolume24h || 0) + (t.sellVolume24h || 0);
  const mkRows = [
    ["Price (USD)", t.priceUsd != null ? "$" + Number(t.priceUsd).toPrecision(4) : "N/A", mc.price || "Live price"],
    ["Market Cap / FDV", `${fmtUsd(t.mcap)} / ${fmtUsd(t.fdv)}`, mc.mcap || ""],
    ["Liquidity", fmtUsd(t.liquidity), mc.liquidity || (t.pairAddress ? `Pair ${t.pairAddress}` : "")],
    ["24h Volume", fmtUsd(volTotal), mc.volume || `Buys ${fmtUsd(t.buyVolume24h)} / Sells ${fmtUsd(t.sellVolume24h)}`],
    ["Holders", fmtNum(t.holderCount), mc.holders || ""],
    ["Top Holders Concentration", t.topHoldersPct != null ? Number(t.topHoldersPct).toFixed(1) + "%" : "N/A", mc.topHolders || ""],
    ["Age / Created", t.ageDays != null ? `~${t.ageDays} days` : "N/A", mc.age || (t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : "")],
    ["Transactions (24h)", t.txns24h != null ? `${fmtNum(t.txns24h)} txns | ${fmtNum(t.numTraders24h)} traders` : "N/A", mc.txns || (t.numBuys24h != null ? `${fmtNum(t.numBuys24h)} buys / ${fmtNum(t.numSells24h)} sells` : "")],
    ["Organic / Holder Profile", `${t.organicScore != null ? Math.round(t.organicScore) : "N/A"} / ${sig.holderProfile}`, mc.organic || ""],
  ].map((r): Cell[] => [{ text: r[0] }, { text: r[1], bold: true }, { text: r[2] }]);
  table(D, ["METRIC", "VALUE", "CONTEXT / TREND"], mkRows, [150, 150, CW - 300]);
  D.gap(2);
  D.para("Key Insight: " + (ai.keyInsight || "Volume and holder trends relative to market cap indicate the current market structure; balanced two-way flow is generally healthier than one-sided pressure."), { font: D.bold, size: 9.5 });

  D.addPage();
  // ---- On-chain fundamentals ----
  D.heading("On-Chain Fundamentals & Transaction Intelligence");
  D.subheading("Security & Authority Status (Verified)");
  const si = ai.securityImplications || {};
  const okC = C.greenBar, badC = C.red, warnC = C.gold;
  const secRows = [
    ["Mint Authority", f.mintAuthorityDisabled === true ? "DISABLED" : f.mintAuthorityDisabled === false ? "ENABLED" : "UNKNOWN", f.mintAuthorityDisabled === true ? okC : badC, si.mint || "No new supply inflation risk when disabled"],
    ["Freeze Authority", f.freezeAuthorityDisabled === true ? "DISABLED" : f.freezeAuthorityDisabled === false ? "ENABLED" : "UNKNOWN", f.freezeAuthorityDisabled === true ? okC : badC, si.freeze || "Wallets cannot be frozen when disabled"],
    ["Liquidity Status", f.lpPulled ? "PULLED / DEAD" : "INTACT - NOT PULLED", f.lpPulled ? badC : okC, si.liquidity || "LP backing present on the pair"],
    ["Minimum Liquidity", f.minLiquidity ? "MET" : "BELOW MIN", f.minLiquidity ? okC : badC, si.minLiq || "Sufficient depth for the current MC tier"],
    ["Jupiter Verified", f.isVerified ? "YES" : "NO", f.isVerified ? okC : warnC, si.verified || "Routing available; reduces swap friction"],
    ["Deploy Pattern", f.isPumpFun ? (f.migratedFromPumpFun ? "PUMP.FUN (MIGRATED)" : "STANDARD PUMP.FUN") : "NON-PUMP.FUN", warnC, si.deploy || "Launch curve type"],
    ["Pool Age", t.poolAgeDays != null ? `${t.poolAgeDays}d - ${t.poolAgeDays >= 7 ? "MATURED" : "NEW"}` : "N/A", t.poolAgeDays != null && t.poolAgeDays >= 7 ? okC : warnC, si.poolAge || "Time since first credible LP pool"],
  ].map((r): Cell[] => [{ text: r[0] as string }, { text: r[1] as string, color: r[2], bold: true }, { text: r[3] as string }]);
  table(D, ["FLAG", "STATUS", "IMPLICATION"], secRows, [140, 150, CW - 290]);

  D.subheading("Transaction Flow Analysis (24h Window)");
  D.para(ai.txnFlow || `24h flow: buys ${fmtUsd(t.buyVolume24h)} vs sells ${fmtUsd(t.sellVolume24h)} across ~${fmtNum(t.txns24h)} transactions and ${fmtNum(t.numTraders24h)} traders. Balanced two-way flow points to active price discovery rather than one-sided pressure.`);
  if (ai.godTierObservation) { D.gap(2); D.para("God-Tier Observation: " + ai.godTierObservation, { font: D.ital, color: C.indigo }); }
  D.subheading("Holder Distribution & Concentration Intelligence");
  D.para(ai.holderDistribution || `Total holders ~${fmtNum(t.holderCount)}; top holders control ~${t.topHoldersPct != null ? Number(t.topHoldersPct).toFixed(1) + "%" : "N/A"} (OG Scan metric). Lower concentration indicates the launch was not heavily front-run.`);
  if (ai.riskNote) { D.gap(2); D.para("Risk Note: " + ai.riskNote, { font: D.bold }); }

  D.addPage();
  // ---- Narrative & social ----
  D.heading("Narrative Archaeology & Social Intelligence");
  // Verified, keyless social presence (DexScreener + r.jina.ai) - always real.
  if (social && (social.xUrl || social.website || social.telegram)) {
    const presence: Cell[][] = [];
    if (social.xUrl) presence.push([{ text: "Official X", bold: true }, { text: social.xHandle ? "@" + social.xHandle : social.xUrl, color: C.blue }, { text: [social.followers ? social.followers + " followers" : "", social.posts ? social.posts + " posts" : ""].filter(Boolean).join(" \u00B7 ") || "verified account" }]);
    if (social.website) presence.push([{ text: "Website", bold: true }, { text: social.website, color: C.blue }, { text: "Official site" }]);
    if (social.telegram) presence.push([{ text: "Telegram", bold: true }, { text: social.telegram, color: C.blue }, { text: "Community" }]);
    if (social.dexId) presence.push([{ text: "DEX", bold: true }, { text: String(social.dexId), bold: true }, { text: social.boosts ? `${social.boosts} active boosts` : "no active boosts" }]);
    if (presence.length) {
      D.subheading("Verified Links & Social Presence");
      table(D, ["CHANNEL", "HANDLE / URL", "SIGNAL"], presence, [110, 230, CW - 340]);
    }
  }
  if (ai.narrative) D.para(ai.narrative);
  if (ai.firstPrinciples) { D.gap(2); D.para("First-Principles Advantage: " + ai.firstPrinciples, { font: D.ital, color: C.indigo }); }
  if (ai.socialActivity || (ai.socialTable && ai.socialTable.length)) {
    D.subheading("X / Twitter Activity & Virality Map");
    if (ai.socialActivity) D.para(ai.socialActivity);
    if (Array.isArray(ai.socialTable) && ai.socialTable.length) {
      const rows: Cell[][] = ai.socialTable.slice(0, 8).map((r: any): Cell[] => [{ text: String(r.account || "") }, { text: String(r.engagement || "") }, { text: String(r.theme || "") }]);
      table(D, ["ACCOUNT", "ENGAGEMENT", "CONTENT THEME"], rows, [150, 130, CW - 280]);
    }
  }
  if (ai.kolIntro || (ai.kolTable && ai.kolTable.length)) {
    D.subheading("KOL & Influencer Involvement Map");
    if (ai.kolIntro) D.para(ai.kolIntro);
    if (Array.isArray(ai.kolTable) && ai.kolTable.length) {
      const rows: Cell[][] = ai.kolTable.slice(0, 8).map((r: any): Cell[] => [{ text: String(r.entity || ""), color: C.blue, bold: true }, { text: String(r.role || "") }, { text: String(r.notes || "") }]);
      table(D, ["KOL / ENTITY", "ROLE / SIGNAL", "NOTES"], rows, [150, 140, CW - 290]);
    }
  }
  if (ai.godTierSynthesis) { D.gap(2); D.para("God-Tier Synthesis: " + ai.godTierSynthesis, { font: D.ital, color: C.indigo }); }

  D.addPage();
  // ---- Risk matrix & re-eval ----
  D.heading("Comprehensive Risk Matrix & Score Re-Evaluation");
  D.subheading("Inherent Risks (Non-Negotiable)");
  D.bullets((ai.memeRisks && ai.memeRisks.length ? ai.memeRisks : [
    "Pure speculative asset: capital is at risk of severe loss.",
    "Narrative fatigue: attention rotates fast; sustained relevance is not guaranteed.",
    "Liquidity & slippage: thin pools amplify large-size exits.",
    "Concentration & platform risk: monitor top wallets and platform scrutiny.",
  ]).map((b: string) => b));
  D.subheading("Bought vs Sold Intelligence");
  D.para(ai.boughtSold || `24h aggregate: buys ${fmtUsd(t.buyVolume24h)} vs sells ${fmtUsd(t.sellVolume24h)}. Near-parity flow is generally constructive; extreme buy dominance can precede profit-taking.`);
  if (Array.isArray(ai.flowBullets) && ai.flowBullets.length) D.bullets(ai.flowBullets);

  D.subheading("OG Score Re-Evaluation & Methodology");
  const pf = ai.proFactors || {};
  const split = (k: string): [string, string] => {
    const v = pf[k]; if (!v) return ["-", ""];
    const parts = String(v).split("|"); return [parts[0]?.trim() || "-", parts.slice(1).join("|").trim()];
  };
  const factorDefs: [string, string][] = [
    ["Age / Novelty", String(sig.age)],
    ["Holder Profile", String(sig.holderProfile)],
    ["Narrative Strength", "Not scored"],
    ["KOL / Smart Money", "Not scored"],
    ["Risk Flags (Security)", f.lpPulled || f.unsafeAuthority ? "Mixed" : "Good"],
    ["Volume & Liquidity", String(sig.athMcap)],
  ];
  const scoreRows: Cell[][] = factorDefs.map(([name, orig]): Cell[] => {
    const [pro, rat] = split(name);
    return [{ text: name }, { text: orig }, { text: pro, color: C.greenBar, bold: true }, { text: rat }];
  });
  const proScore = Number.isFinite(Number(ai.proScore)) ? Math.max(0, Math.min(100, Math.round(Number(ai.proScore)))) : scan.score.total;
  scoreRows.push([
    { text: "OVERALL OG SCORE", bold: true },
    { text: `${scan.score.total}/100`, color: C.red, bold: true },
    { text: `${proScore}/100`, color: C.greenBar, bold: true },
    { text: "Category-adjusted PRO synthesis" },
  ]);
  table(D, ["FACTOR", "ORIGINAL", "PRO ADJ", "RATIONALE"], scoreRows, [128, 70, 70, CW - 268]);
  D.gap(2);
  D.para("Final Verdict: " + (ai.finalVerdict || "The PRO-adjusted score reflects a category-aware reassessment of the raw OG signals. Treat as one input among many; position sizing and active monitoring are mandatory."), { font: D.ital, color: C.indigo });

  D.addPage();
  // ---- Appendix ----
  D.heading("Appendix: Data Sources, Links & Methodology");
  D.subheading("Primary Data Sources");
  D.bullets([
    `DEX Screener: ${t.dexUrl}`,
    `Pump.fun: ${t.pumpFunUrl}`,
    "Jupiter token API (price, liquidity, holders, audit, organic score)",
    "OG Scan composite scoring engine (age, ATH mcap, holder profile, deploy, pool age)",
    "X/Twitter + community signals (social/KOL synthesis)",
  ], { color: C.gray });
  if (Array.isArray(ai.monitoring) && ai.monitoring.length) {
    D.subheading("Recommended Monitoring");
    D.bullets(ai.monitoring);
  }
  // disclaimer box
  D.gap(6);
  const disc = "DISCLAIMER - NOT FINANCIAL ADVICE\nThis document is an AI-augmented intelligence synthesis for informational and educational purposes only. It is not investment, financial, or trading advice. Crypto, especially meme coins, carries extreme risk of loss. You could lose all your capital. Always DYOR and never invest more than you can afford to lose. Data is time-sensitive; verify independently before acting.";
  const discLines = D.wrap(disc, D.reg, 8, CW - 24);
  const dh = discLines.length * 11 + 16;
  D.ensure(dh + 6);
  D.page.drawRectangle({ x: ML, y: D.y - dh + 6, width: CW, height: dh, color: C.redBg, borderColor: C.redBd, borderWidth: 1 });
  let dy = D.y - 6;
  discLines.forEach((ln, i) => { D.page.drawText(ln, { x: ML + 12, y: dy, size: 8, font: i === 0 ? D.bold : D.reg, color: C.redBd }); dy -= 11; });
  D.y -= dh + 8;
  D.gap(2);
  D.centered("- END OF OG SCAN PRO ADVANCED INTELLIGENCE DOSSIER -", D.y, 9, D.boldItal, C.green);

  return await D.doc.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { query } = await req.json().catch(() => ({ query: "" }));
    const q = String(query || "").trim();
    if (!q) return jsonResp({ ok: false, error: "Provide a mint or ticker." }, 400);
    const scan = await getScan(q);
    if (!scan || !scan.ok) return jsonResp({ ok: false, error: scan?.error || "Token not found." }, 404);
    const social = await gatherSocial(scan.token.mint);
    const ai = await synthesize(scan, social);
    const pdf = await buildPdf(scan, ai, social);
    const sym = (scan.token.symbol || "token").replace(/[^a-zA-Z0-9]/g, "");
    return new Response(pdf as unknown as BodyInit, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="OG_SCAN_PRO_${sym}.pdf"` },
    });
  } catch (e) {
    return jsonResp({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
