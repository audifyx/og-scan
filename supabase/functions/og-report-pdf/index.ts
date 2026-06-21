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
      signal: AbortSignal.timeout(45000),
    });
    if (!r.ok) return "";
    return (await r.text()).slice(0, maxChars);
  } catch { return ""; }
}

async function gatherSocial(mint: string): Promise<any> {
  const out: any = { xHandle: null, xUrl: null, website: null, telegram: null, followers: null, posts: null, boosts: null, dexId: null, xText: "", siteText: "" };
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { signal: AbortSignal.timeout(45000) });
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

async function getHoldersCtx(mint: string): Promise<any> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/og-holders`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
      body: JSON.stringify({ mint }), signal: AbortSignal.timeout(45000),
    });
    const j = await r.json();
    if (!j.ok) return null;
    return { top10pct: j.top10pct, risk: j.concentrationRisk, top: (j.holders || []).slice(0, 5).map((h: any) => ({ pct: Number(h.pct||0).toFixed(2), label: h.label })) };
  } catch { return null; }
}

async function synthesize(scan: any, social: any): Promise<any> {
  const holdersCtx = await getHoldersCtx(scan.token.mint);
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
"securityImplications": {"mint":"1-line implication of mint authority status","freeze":"1-line implication of freeze authority","liquidity":"1-line implication of LP status","minLiq":"1-line implication","verified":"1-line implication","deploy":"1-line implication of deploy pattern","poolAge":"1-line implication of pool age"},
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
"proFactors": {"Age / Novelty":"<newScore>|<short rationale>","Holder Profile":"pro|rationale","Narrative Strength":"pro|rationale","KOL / Smart Money":"pro|rationale","Risk Flags (Security)":"pro|rationale","Volume & Liquidity":"pro|rationale"},
"proScore": "<integer 0-100, your category-adjusted score, consistent with the verdict>",
"finalVerdict": "1 paragraph final verdict",
"monitoring": ["bullet", "..."]
}`;
  const prompt = `You are OG SCAN PRO, a god-tier Solana token intelligence analyst. Produce an ADVANCED INTELLIGENCE DOSSIER for this token as STRICT JSON only (no markdown, no commentary). Ground every number in the REAL DATA provided; for narrative/social/KOL use what you genuinely know about this specific token/CA and the wider meta — if unknown, give measured, non-fabricated, clearly-hedged analysis (never invent fake handles or fake on-chain events). Write with depth, specificity and conviction \u2014 god-tier analyst voice, first-principles, NFA. Use the REAL holder %s, follower counts, and website lore provided. Each paragraph field should be 2-4 substantive sentences. Do not restate the contract address as an 'implication'.

REAL DATA:
${JSON.stringify(facts)}

REAL SOCIAL/NARRATIVE CONTEXT (keyless sources - use ONLY this; NEVER invent handles, tweets, or engagement numbers not present here):
Official X: ${social.xUrl || "unknown"} | followers: ${social.followers || "unknown"} | posts: ${social.posts || "unknown"}
Telegram: ${social.telegram || "unknown"} | Website: ${social.website || "unknown"} | DEX: ${social.dexId || "unknown"} | Dex boosts: ${social.boosts ?? "none"}
OFFICIAL WEBSITE CONTENT (basis for Narrative Archaeology):
${(social.siteText || "none").slice(0, 1800)}
X PROFILE CONTENT:
${(social.xText || "none").slice(0, 1200)}
TOP HOLDER DISTRIBUTION: ${holdersCtx ? JSON.stringify(holdersCtx) : "unavailable"}

Rules: Base "narrative"/"firstPrinciples" on the website content above. Base social/KOL on the real official handle + any real names in the context. If you lack tweet-level engagement data, set "socialTable" and "kolTable" to [] and describe presence qualitatively using the real follower/post counts. Do NOT fabricate.

GROUNDING: Treat the WEBSITE CONTENT as the ground-truth origin/lore (never call documented lore fabricated). CONSISTENCY: proScore must agree with proVerdictTitle and finalVerdict (bullish verdict => higher score, bearish => lower). Use the real holder %s, follower counts and lore in your prose. Avoid generic hedging.

Return ONLY this JSON shape:
${schema}`;
  // Call the NVIDIA model directly (single completion) instead of the heavy
  // enhanced-intelligence agent — much faster and controllable for JSON output.
  const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
  const NVIDIA_BASE = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
  const MODEL = Deno.env.get("NVIDIA_DOSSIER_MODEL") || "meta/llama-3.1-8b-instruct";
  const tolerant = (raw: string): any => {
    let txt = String(raw || "").trim();
    const a = txt.indexOf("{"); if (a < 0) return null;
    const b = txt.lastIndexOf("}");
    if (b > a) { try { return JSON.parse(txt.slice(a, b + 1)); } catch { /* repair below */ } }
    // brace-balance repair for truncated output
    txt = txt.slice(a);
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') inStr = !inStr;
      else if (!inStr) { if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { end = i; break; } } }
    }
    if (end > 0) { try { return JSON.parse(txt.slice(0, end + 1)); } catch { /* fallthrough */ } }
    return null;
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${NVIDIA_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "You are OG SCAN PRO. Output ONLY a single valid minified JSON object. No markdown, no prose, no code fences. Ensure the JSON is complete and closed." },
            { role: "user", content: prompt },
          ],
          temperature: 0.45,
          max_tokens: 2200,
        }),
        signal: AbortSignal.timeout(45000),
      });
      const j = await r.json();
      const parsed = tolerant(j.choices?.[0]?.message?.content || "");
      if (parsed && Object.keys(parsed).length > 5) return parsed;
    } catch { /* retry */ }
  }
  return {};
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


// ---------- HTML report: AI vibecode + deterministic fallback ----------
function esc(s: any): string { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function fUsd(n: any): string { const v = Number(n); if (!isFinite(v) || !v) return "N/A"; if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B"; if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M"; if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K"; return "$" + v.toFixed(2); }
function fNum(n: any): string { return (n == null || !isFinite(Number(n))) ? "N/A" : Number(n).toLocaleString(); }

function htmlTemplate(scan: any, ai: any, social: any, theme: any = {}): string {
  const t = scan.token, sig = scan.score.signals, f = scan.flags;
  const DEF: Record<string,string> = { "--bg":"#0a0b0d","--card":"#14161a","--card2":"#1b1e24","--line":"#262b33","--ink":"#e8edf2","--mut":"#8b94a0","--green":"#2fe38a","--blue":"#5b8def","--gold":"#e8c63d","--red":"#ff5470" };
  const TV = (theme && theme.vars && typeof theme.vars === "object") ? theme.vars : {};
  const colors: Record<string,string> = { ...DEF };
  for (const k of Object.keys(DEF)) { const v = TV[k]; if (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.trim())) colors[k] = v.trim(); }
  const rootVars = ":root{" + Object.entries(colors).map(([k,v])=>k+":"+v).join(";") + "}";
  const extraCss = (theme && typeof theme.extraCss === "string") ? theme.extraCss.slice(0, 4000) : "";
  const extraSection = (theme && typeof theme.extraSection === "string") ? theme.extraSection.slice(0, 6000) : "";
  const fontName = (theme && typeof theme.font === "string") ? theme.font : "";
  const headFont = (theme && typeof theme.headingFont === "string") ? theme.headingFont : "";
  const animate = !theme || theme.animate !== false;
  const extraSecs: string[] = Array.isArray(theme && theme.extraSections) ? theme.extraSections : (extraSection ? [extraSection] : []);
  const gfUrl = (n: string) => "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(n).replace(/%20/g, "+") + ":wght@400;600;700;900&display=swap";
  const fontLink = (fontName || headFont) ? ('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="' + gfUrl(fontName || headFont) + '" rel="stylesheet">' + ((headFont && headFont !== fontName) ? ('<link href="' + gfUrl(headFont) + '" rel="stylesheet">') : "")) : "";
  const fontCss = (fontName ? ("body{font-family:'" + fontName + "',-apple-system,Segoe UI,Roboto,sans-serif}") : "") + (headFont ? ("h1,h2,h3,.brand,.token .nm{font-family:'" + headFont + "',inherit}") : "");
  const pchg = (v: any) => { if (v == null || !isFinite(Number(v))) return '<span style="color:var(--mut)">N/A</span>'; const n = Number(v); return '<span style="color:' + (n >= 0 ? "var(--green)" : "var(--red)") + '">' + (n >= 0 ? "+" : "") + n.toFixed(1) + '%</span>'; };
  const sym = (t.symbol || "TOKEN").replace(/^\$/, "");
  const day = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const sec = scan.score.total;
  const proScore = Number.isFinite(Number(ai.proScore)) ? Math.max(0, Math.min(100, Math.round(Number(ai.proScore)))) : sec;
  const mc = ai.marketContext || {}, si = ai.securityImplications || {};
  const volTotal = (t.buyVolume24h || 0) + (t.sellVolume24h || 0);
  const badge = (label: string, ok: boolean | null, warn = false) => `<span class="badge ${ok === true ? "ok" : ok === false ? "bad" : warn ? "warn" : "neutral"}">${esc(label)}</span>`;
  const bar = (label: string, v: number) => `<div class="bar"><span class="bl">${esc(label)}</span><div class="bt"><div class="bf" style="width:${Math.max(0, Math.min(100, v))}%"></div></div><span class="bv">${v}</span></div>`;
  const mrow = (k: string, v: string, c?: string) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td><td class="c">${esc(c || "")}</td></tr>`;
  const verdictColor = proScore >= 66 ? "#2fe38a" : proScore >= 40 ? "#e8c63d" : "#ff5470";

  const secRows = [
    ["Mint Authority", f.mintAuthorityDisabled === true ? "DISABLED" : f.mintAuthorityDisabled === false ? "ENABLED" : "UNKNOWN", f.mintAuthorityDisabled === true, si.mint],
    ["Freeze Authority", f.freezeAuthorityDisabled === true ? "DISABLED" : f.freezeAuthorityDisabled === false ? "ENABLED" : "UNKNOWN", f.freezeAuthorityDisabled === true, si.freeze],
    ["Liquidity", f.lpPulled ? "PULLED / DEAD" : "INTACT", !f.lpPulled, si.liquidity],
    ["Min Liquidity", f.minLiquidity ? "MET" : "BELOW MIN", !!f.minLiquidity, si.minLiq],
    ["Jupiter Verified", f.isVerified ? "YES" : "NO", !!f.isVerified, si.verified],
    ["Deploy Pattern", f.isPumpFun ? (f.migratedFromPumpFun ? "PUMP.FUN (MIGRATED)" : "PUMP.FUN") : "NON-PUMP.FUN", null, si.deploy],
    ["Pool Age", t.poolAgeDays != null ? t.poolAgeDays + "d" : "N/A", (t.poolAgeDays ?? 0) >= 7, si.poolAge],
  ].map((r: any) => `<tr><td class="k">${esc(r[0])}</td><td>${badge(r[1], r[2], true)}</td><td class="c">${esc(r[3] || "")}</td></tr>`).join("");

  const fd: [string, string][] = [["Age / Novelty", String(sig.age)], ["Holder Profile", String(sig.holderProfile)], ["Narrative Strength", "n/s"], ["KOL / Smart Money", "n/s"], ["Risk Flags (Security)", (f.lpPulled || f.unsafeAuthority) ? "Mixed" : "Good"], ["Volume & Liquidity", String(sig.athMcap)]];
  const pf = ai.proFactors || {};
  const split = (k: string): [string, string] => { const v = pf[k]; if (!v) return ["-", ""]; const p = String(v).split("|"); return [p[0]?.trim() || "-", p.slice(1).join("|").trim()]; };
  const scoreRows = fd.map(([n, o]) => { const [pr, rt] = split(n); return `<tr><td class="k">${esc(n)}</td><td>${esc(o)}</td><td class="pro">${esc(pr)}</td><td class="c">${esc(rt)}</td></tr>`; }).join("") +
    `<tr class="total"><td>OVERALL OG SCORE</td><td class="bad">${sec}/100</td><td class="pro">${proScore}/100</td><td class="c">Category-adjusted PRO synthesis</td></tr>`;

  const kolRows = (Array.isArray(ai.kolTable) && ai.kolTable.length) ? `<table class="tbl"><thead><tr><th>KOL / Entity</th><th>Role</th><th>Notes</th></tr></thead><tbody>${ai.kolTable.slice(0, 8).map((k: any) => `<tr><td class="link">${esc(k.entity)}</td><td>${esc(k.role)}</td><td class="c">${esc(k.notes)}</td></tr>`).join("")}</tbody></table>` : "";
  const links: string[] = [];
  if (social?.xUrl) links.push(`<a href="${esc(social.xUrl)}">X ${social.handle ? "@" + esc(social.handle) : ""}${social.followers ? " · " + esc(social.followers) + " followers" : ""}</a>`);
  if (social?.website) links.push(`<a href="${esc(social.website)}">Website</a>`);
  if (social?.telegram) links.push(`<a href="${esc(social.telegram)}">Telegram</a>`);
  links.push(`<a href="${esc(t.dexUrl)}">DexScreener</a>`);
  if (t.pumpFunUrl) links.push(`<a href="${esc(t.pumpFunUrl)}">pump.fun</a>`);

  const risks = (ai.memeRisks && ai.memeRisks.length ? ai.memeRisks : ["Pure speculative asset — capital at severe risk.", "Narrative fatigue: attention rotates fast.", "Liquidity/slippage on large size.", "Concentration & platform risk."]).map((r: string) => `<li>${esc(r)}</li>`).join("");
  const mon = (ai.monitoring && ai.monitoring.length) ? `<h3>Recommended Monitoring</h3><ul>${ai.monitoring.slice(0, 8).map((m: string) => `<li>${esc(m)}</li>`).join("")}</ul>` : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OG SCAN PRO — ${esc(t.name)} ($${esc(sym)})</title>
${fontLink}
<style>
${rootVars}
*{box-sizing:border-box;margin:0;padding:0}
body{background:radial-gradient(1200px 600px at 70% -10%,#10261d 0,transparent 60%),var(--bg);color:var(--ink);font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;padding:0 0 60px}
.wrap{max-width:880px;margin:0 auto;padding:0 20px}
header{background:linear-gradient(180deg,#0d1512,transparent);border-bottom:2px solid var(--green);padding:34px 0 26px;text-align:center;margin-bottom:8px}
.brand{font-size:13px;letter-spacing:4px;color:var(--green);font-weight:800}
h1{font-size:40px;font-weight:900;letter-spacing:1px;background:linear-gradient(90deg,#2fe38a,#7af0c0);-webkit-background-clip:text;background-clip:text;color:transparent;margin:6px 0 2px}
.sub{color:var(--mut);letter-spacing:2px;font-size:13px}
.token{display:flex;flex-direction:column;align-items:center;gap:6px;background:var(--card);border:1px solid var(--green);border-radius:16px;padding:22px;margin:22px 0}
.token .nm{font-size:26px;font-weight:800;color:var(--green)}
.token .ca{font-family:ui-monospace,Menlo,monospace;color:var(--mut);font-size:12px;word-break:break-all;text-align:center}
.token .tag{color:var(--blue);font-size:15px;text-align:center}
.section{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px;margin:18px 0}
h2{color:var(--green);font-size:19px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
h3{color:var(--green);font-size:14px;margin:16px 0 8px;opacity:.9}
.verdicts{display:grid;gap:10px;margin:6px 0 14px}
.vbar{border-radius:12px;padding:14px 18px;font-weight:800;color:#06140e}
.vbar.orig{background:linear-gradient(90deg,#ff5470,#ff7a91);color:#fff}
.vbar.pro{background:linear-gradient(90deg,#2fe38a,#1fb673);color:#06140e}
.callout{border-left:3px solid var(--blue);background:#0f1722;color:#c7d3e6;padding:12px 14px;border-radius:8px;font-style:italic;margin:12px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:6px 0}
.stat{background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:14px}
.stat .l{color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:1px}
.stat .n{font-size:20px;font-weight:800;margin-top:3px}
table.tbl{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0}
.tbl th{background:#0e1014;color:#cfd6df;text-align:left;padding:10px 12px;font-size:11px;letter-spacing:.5px}
.tbl td{border-bottom:1px solid var(--line);padding:10px 12px;vertical-align:top}
.tbl td.k{color:var(--mut)} .tbl td.v{font-weight:700} .tbl td.c{color:var(--mut);font-size:12px} .tbl td.pro{color:var(--green);font-weight:800} .tbl td.bad{color:var(--red);font-weight:800} .tbl td.link{color:var(--blue);font-weight:700}
.tbl tr.total td{background:#0f1a14;font-weight:800;border-top:2px solid var(--green)}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800}
.badge.ok{background:rgba(47,227,138,.15);color:var(--green)} .badge.bad{background:rgba(255,84,112,.15);color:var(--red)} .badge.warn{background:rgba(232,198,61,.15);color:var(--gold)} .badge.neutral{background:#222831;color:var(--mut)}
.bar{display:flex;align-items:center;gap:10px;margin:7px 0}.bl{width:120px;color:var(--mut);font-size:12px}.bt{flex:1;height:9px;background:#0e1014;border-radius:6px;overflow:hidden}.bf{height:100%;background:linear-gradient(90deg,#2fe38a,#7af0c0)}.bv{width:30px;text-align:right;font-weight:700;font-size:12px}
.score{display:flex;align-items:center;justify-content:center;gap:24px;margin:8px 0}
.ring{--p:0;width:120px;height:120px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(${verdictColor} calc(var(--p)*1%),#1b1e24 0)}
.ring .in{width:92px;height:92px;border-radius:50%;background:var(--card);display:grid;place-items:center;text-align:center}
.ring .in b{font-size:28px;color:${verdictColor}}.ring .in span{font-size:10px;color:var(--mut)}
ul{padding-left:20px}li{margin:5px 0}
.links a{display:inline-block;margin:4px 10px 4px 0;color:var(--blue);text-decoration:none;border:1px solid var(--line);padding:6px 12px;border-radius:20px;font-size:13px}
.disc{border:1px solid rgba(255,84,112,.4);background:rgba(255,84,112,.07);color:#ff9aab;border-radius:12px;padding:14px;font-size:12px;margin-top:16px}
footer{text-align:center;color:var(--mut);font-size:12px;margin-top:24px}
.cta{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:linear-gradient(90deg,#10261d,#0f1722);border:1px solid var(--green);border-radius:16px;padding:18px 20px;margin:18px 0}
.cta b{color:var(--green)}.cta span{color:var(--mut);font-size:13px}
.ctabtn{background:linear-gradient(90deg,var(--green),#1fb673);color:#06140e;font-weight:800;text-decoration:none;padding:11px 18px;border-radius:12px;white-space:nowrap}
.hero{height:170px;background-size:cover;background-position:center;border-radius:0 0 22px 22px}
.logo{width:78px;height:78px;border-radius:50%;border:3px solid var(--green);object-fit:cover;background:var(--card);margin-top:-50px;box-shadow:0 6px 24px rgba(0,0,0,.5)}
.chev{float:right;transition:transform .3s ease;opacity:.6;font-size:14px}
.section.collapsed .chev{transform:rotate(-90deg)}
.sbody{overflow:hidden;transition:max-height .4s ease,opacity .3s ease;max-height:6000px;opacity:1}
.section.collapsed .sbody{max-height:0;opacity:0;margin:0}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}body.anim .section,body.anim .token,body.anim .cta,body.anim .hero{animation:fadeUp .55s ease both}body.anim .section:nth-of-type(2){animation-delay:.05s}body.anim .section:nth-of-type(3){animation-delay:.1s}body.anim .section:nth-of-type(4){animation-delay:.15s}body.anim .section:nth-of-type(5){animation-delay:.2s}
.stat,.ctabtn,.badge{transition:transform .2s ease,box-shadow .2s ease,filter .2s ease}
.stat:hover{transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,.35);border-color:var(--green)}
.ctabtn:hover{filter:brightness(1.08);transform:translateY(-1px)}
h2{cursor:pointer}
${fontCss}
${extraCss}
</style></head><body>
<header><div class="wrap"><div class="brand">OG SCAN PRO</div><h1>ADVANCED TOKEN INTELLIGENCE DOSSIER</h1><div class="sub">NFA · REAL-TIME SYNTHESIS · ${esc(day)}</div></div></header>
<div class="wrap">
${t.banner ? (`<div class="hero" style="background-image:linear-gradient(180deg,rgba(0,0,0,.15),var(--bg)),url(` + "'" + esc(t.banner) + "'" + `)"></div>`) : ""}
<div class="token">${t.image ? (`<img class="logo" src="${esc(t.image)}" alt="logo">`) : ""}<div class="nm">${esc(t.name)} ($${esc(sym)})</div><div class="ca">${esc(t.mint)}</div>${ai.subtitle ? `<div class="tag">${esc(ai.subtitle)}</div>` : ""}</div>
<div class="cta"><div><b>This is a sample report.</b><br><span>For the complete report \u2014 full holder lists, complete transaction history, and every data point \u2014 visit OG Scan.</span></div><a class="ctabtn" href="https://ogscan.fun">Get the Full Report \u2192</a></div>

<div class="section"><h2>⚖️ Verdict Evolution</h2>
<div class="score"><div class="ring" style="--p:${proScore}"><div class="in"><b>${proScore}</b><span>PRO / 100</span></div></div>
<div style="flex:1"><div class="verdicts"><div class="vbar orig">ORIGINAL: ${esc(scan.verdict)} — ${sec}/100</div><div class="vbar pro">PRO: ${esc(ai.proVerdictTitle || "Category-adjusted re-evaluation")}</div></div></div></div>
${ai.reassessment ? `<div class="callout">${esc(ai.reassessment)}</div>` : ""}</div>

<div class="section"><h2>📊 Real-Time Market Snapshot</h2>
<div class="grid">
<div class="stat"><div class="l">Price</div><div class="n">${t.priceUsd != null ? "$" + Number(t.priceUsd).toPrecision(4) : "N/A"}</div></div>
<div class="stat"><div class="l">Market Cap</div><div class="n">${fUsd(t.mcap)}</div></div>
<div class="stat"><div class="l">Liquidity</div><div class="n">${fUsd(t.liquidity)}</div></div>
<div class="stat"><div class="l">24h Volume</div><div class="n">${fUsd(volTotal)}</div></div>
<div class="stat"><div class="l">Holders</div><div class="n">${fNum(t.holderCount)}</div></div>
<div class="stat"><div class="l">Top Holders</div><div class="n">${t.topHoldersPct != null ? Number(t.topHoldersPct).toFixed(1) + "%" : "N/A"}</div></div>
<div class="stat"><div class="l">Age</div><div class="n">${t.ageDays != null ? "~" + t.ageDays + "d" : "N/A"}</div></div>
<div class="stat"><div class="l">Txns 24h</div><div class="n">${fNum(t.txns24h)}</div></div>
<div class="stat"><div class="l">Organic</div><div class="n">${t.organicScore != null ? Math.round(t.organicScore) : "N/A"}</div></div>
<div class="stat"><div class="l">5m</div><div class="n">${pchg(t.priceChange5m)}</div></div>
<div class="stat"><div class="l">1h</div><div class="n">${pchg(t.priceChange1h)}</div></div>
<div class="stat"><div class="l">6h</div><div class="n">${pchg(t.priceChange6h)}</div></div>
<div class="stat"><div class="l">24h</div><div class="n">${pchg(t.priceChange24h)}</div></div>
<div class="stat"><div class="l">Net Buyers 24h</div><div class="n">${t.netBuyers24h != null ? ((t.netBuyers24h >= 0 ? "+" : "") + fNum(t.netBuyers24h)) : "N/A"}</div></div>
<div class="stat"><div class="l">Momentum</div><div class="n">${t.momentum != null ? t.momentum + "/100" : "N/A"}${t.momentumLabel ? " <span style=\"font-size:11px;color:var(--mut)\">" + esc(t.momentumLabel) + "</span>" : ""}</div></div>
</div>
${ai.keyInsight ? `<div class="callout"><b>Key Insight:</b> ${esc(ai.keyInsight)}</div>` : ""}</div>

<div class="section"><h2>🔎 On-Chain Fundamentals</h2>
<table class="tbl"><thead><tr><th>Flag</th><th>Status</th><th>Implication</th></tr></thead><tbody>${secRows}</tbody></table>
${ai.txnFlow ? `<h3>Transaction Flow (24h)</h3><p>${esc(ai.txnFlow)}</p>` : ""}
${ai.godTierObservation ? `<div class="callout">${esc(ai.godTierObservation)}</div>` : ""}
${ai.holderDistribution ? `<h3>Holder Distribution</h3><p>${esc(ai.holderDistribution)}</p>` : ""}
${ai.riskNote ? `<p style="margin-top:8px"><b style="color:var(--gold)">Risk Note:</b> ${esc(ai.riskNote)}</p>` : ""}</div>

<div class="section"><h2>🧠 Narrative & Social Intelligence</h2>
<div class="links">${links.join("")}</div>
${ai.narrative ? `<p style="margin-top:10px">${esc(ai.narrative)}</p>` : ""}
${ai.firstPrinciples ? `<div class="callout"><b>First-Principles Advantage:</b> ${esc(ai.firstPrinciples)}</div>` : ""}
${ai.socialActivity ? `<h3>X / Twitter Activity</h3><p>${esc(ai.socialActivity)}</p>` : ""}
${kolRows ? `<h3>KOL & Influencer Map</h3>${kolRows}` : ""}
${ai.godTierSynthesis ? `<div class="callout"><b>God-Tier Synthesis:</b> ${esc(ai.godTierSynthesis)}</div>` : ""}</div>

<div class="section"><h2>🛡️ Risk Matrix & Score Re-Evaluation</h2>
<h3>OG Signals</h3>${bar("Age", sig.age)}${bar("ATH Mcap", sig.athMcap)}${bar("Holder Profile", sig.holderProfile)}${bar("Deploy", sig.deployPattern)}${bar("Pool Age", sig.poolAge)}
<h3>Inherent Risks</h3><ul>${risks}</ul>
${ai.boughtSold ? `<h3>Bought vs Sold</h3><p>${esc(ai.boughtSold)}</p>` : ""}
<h3>OG Score Re-Evaluation</h3><table class="tbl"><thead><tr><th>Factor</th><th>Original</th><th>PRO</th><th>Rationale</th></tr></thead><tbody>${scoreRows}</tbody></table>
${ai.finalVerdict ? `<div class="callout"><b>Final Verdict:</b> ${esc(ai.finalVerdict)}</div>` : ""}</div>

${extraSecs.join("\n")}
<div class="section"><h2>📚 Appendix</h2>
<p style="color:var(--mut);font-size:13px">Sources: DexScreener, Jupiter, Helius, OG Scan scoring engine${social?.website ? ", " + esc(social.website) : ""}.</p>
${mon}
<div class="disc"><b>NOT FINANCIAL ADVICE.</b> AI-augmented intelligence synthesis for educational purposes only. Crypto, especially meme coins, carries extreme risk — you could lose all capital. Always DYOR.</div></div>
<footer>— OG SCAN PRO · Generated ${esc(day)} · ogscan.fun —</footer>
</div>
<script>
(function(){
  document.querySelectorAll('.section').forEach(function(sec){
    var h=sec.querySelector('h2'); if(!h) return;
    var b=document.createElement('div'); b.className='sbody';
    while(h.nextSibling){ b.appendChild(h.nextSibling); }
    sec.appendChild(b);
    h.insertAdjacentHTML('beforeend','<span class=\\"chev\\">\\u25BE</span>');
    h.addEventListener('click',function(){ sec.classList.toggle('collapsed'); });
  });
  if(${animate}){ document.body.classList.add('anim'); }
})();
</script>
</body></html>`;
}

async function customizeTheme(instructions: string): Promise<any> {
  if (!instructions || !instructions.trim()) return {};
  const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
  const NVIDIA_BASE = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";
  const MODEL = Deno.env.get("NVIDIA_THEME_MODEL") || "meta/llama-3.3-70b-instruct";
  const prompt = `A user wants a custom visual theme (and optionally an extra section) for a crypto token intelligence report web page. Their EXACT request: "${instructions}"\n\n` +
    `Return ONLY minified JSON: {"vars":{"--bg":"#hex","--card":"#hex","--card2":"#hex","--line":"#hex","--ink":"#hex","--mut":"#hex","--green":"#hex","--blue":"#hex","--gold":"#hex","--red":"#hex"},"font":"","headingFont":"","animate":true,"interactive":true,"extraCss":"","extraSections":[],"headline":""}\n\n` +
    `RULES (honor the user's request precisely):\n` +
    `- COLORS: if they name colors (purple, pink, gold, red, blue, matrix-green, orange, neon, pastel, etc.), USE THEM exactly. --green is the PRIMARY accent, --blue SECONDARY, --gold/--red are status colors. --bg must stay dark for readability unless they ask for light; --ink must strongly contrast --bg.\n` +
    `- FONTS: if they request a font/typography style, set "font" to a valid Google Fonts family name for body text (e.g. "Inter","Orbitron","Space Grotesk","Poppins","JetBrains Mono") and "headingFont" for headings (e.g. "Orbitron"). Pick fonts that match the vibe (futuristic=>Orbitron, clean=>Inter, playful=>Poppins). Leave "" to keep defaults.\n` +
    `- ANIMATIONS: set "animate" true (default) for tasteful entrance/hover animations; add custom @keyframes/animations/hover effects in "extraCss" if they ask for specific motion.\n` +
    `- DROPDOWNS/INTERACTIVITY: set "interactive" true (default) so sections are collapsible; the page already supports this.\n` +
    `- extraSections: array of FULL extra sections ONLY if explicitly requested (roadmap, FAQ, tokenomics, etc.). Each item: a complete <div class=\"section\"><h2>Title</h2> ... </div> reusing existing classes (section, grid, stat, tbl, callout, badge, bar). Otherwise [].\n` +
    `- extraCss: optional CSS rules for animations/hover/glows/custom styling of existing classes. Pure CSS only \u2014 NO <script>, NO @import, NO url(), NO external resources.\n` +
    `Output JSON only, no markdown.`;
  try {
    const r = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: "You output only one minified JSON object. No markdown, no commentary." }, { role: "user", content: prompt }], temperature: 0.4, max_tokens: 1500 }),
      signal: AbortSignal.timeout(40000),
    });
    const j = await r.json();
    let txt = String(j.choices?.[0]?.message?.content || "").trim();
    const a = txt.indexOf("{"), b = txt.lastIndexOf("}");
    if (a >= 0 && b > a) txt = txt.slice(a, b + 1);
    const parsed = JSON.parse(txt);
    if (typeof parsed.extraCss === "string" && /<\/?script|@import|url\s*\(|javascript:/i.test(parsed.extraCss)) parsed.extraCss = "";
    const cleanSec = (h: any) => (typeof h === "string" && !/<script|onerror=|onclick=|javascript:/i.test(h)) ? h.slice(0, 6000) : "";
    if (Array.isArray(parsed.extraSections)) parsed.extraSections = parsed.extraSections.map(cleanSec).filter(Boolean).slice(0, 4);
    else if (typeof parsed.extraSection === "string") parsed.extraSections = [cleanSec(parsed.extraSection)].filter(Boolean);
    else parsed.extraSections = [];
    const fontOk = (x: any) => (typeof x === "string" && /^[a-zA-Z0-9 ]{2,40}$/.test(x.trim())) ? x.trim() : "";
    parsed.font = fontOk(parsed.font); parsed.headingFont = fontOk(parsed.headingFont);
    return parsed;
  } catch { return {}; }
}async function saveReport(html: string, scan: any, query: string, instructions: string): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    const path = `${id}.html`;
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/reports/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE, "Content-Type": "text/html", "x-upsert": "true" },
      body: html,
    });
    if (!up.ok) { console.error("report upload", up.status, await up.text().catch(()=> "")); return null; }
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/reports/${path}`;
    await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ id, query, instructions: instructions || null, token_name: scan.token.name, token_symbol: scan.token.symbol, token_mint: scan.token.mint, source: "telegram", html_path: path, public_url: publicUrl }),
    }).catch((e) => console.error("report insert", e));
    return publicUrl;
  } catch (e) { console.error("saveReport", e); return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const q = String(body.query || "").trim();
    if (!q) return jsonResp({ ok: false, error: "Provide a mint or ticker." }, 400);
    const scan = await getScan(q);
    if (!scan || !scan.ok) return jsonResp({ ok: false, error: scan?.error || "Token not found." }, 404);
    const social = await gatherSocial(scan.token.mint);
    if (body.mode === "html") {
      const instr = String(body.instructions || "").slice(0, 600);
      const [aiH, theme] = await Promise.all([synthesize(scan, social), instr ? customizeTheme(instr) : Promise.resolve({})]);
      const html = htmlTemplate(scan, aiH, social, theme);
      const symH = (scan.token.symbol || "token").replace(/[^a-zA-Z0-9]/g, "");
      const publicUrl = await saveReport(html, scan, q, instr);
      return new Response(html, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="OG_SCAN_PRO_${symH}.html"`, ...(publicUrl ? { "X-Report-Url": publicUrl } : {}) } });
    }
    const ai = await synthesize(scan, social);
    if (body.mode === "data") return jsonResp({ ok: true, scan, ai, social });
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
