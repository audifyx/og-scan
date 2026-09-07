/**
 * Dark-desk PDF for orbitx_full_report. RESEARCH ONLY watermark.
 * Filename: ORBITX_{TICKER}_{YYYYMMDD}_{HHMM}UTC.pdf
 */
import { DISCLAIMER, TRACE_INCOMPLETE } from "./full-report-verdict.js";

function stampUtc(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return { yyyymmdd: `${y}${m}${d}`, hhmm: `${hh}${mm}` };
}

function safeTicker(t) {
  const s = String(t || "TOKEN").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  return s || "TOKEN";
}

function line(v) {
  if (v == null || v === "") return "UNKNOWN";
  return String(v);
}

function clusterLine(c) {
  if (!c) return "UNKNOWN";
  if (c.display === TRACE_INCOMPLETE || c.note === TRACE_INCOMPLETE) return TRACE_INCOMPLETE;
  if (c.traced === true && c.pct === 0) return String(c.display);
  if (c.pct == null) return "UNKNOWN";
  return `${c.pct}% · traced ${c.traced ? "true" : "false"}`;
}

export function pdfFilename(ticker, date = new Date()) {
  const { yyyymmdd, hhmm } = stampUtc(date);
  return `ORBITX_${safeTicker(ticker)}_${yyyymmdd}_${hhmm}UTC.pdf`;
}

export async function renderFullReportPdf(dossier) {
  const { jsPDF } = await import("jspdf");
  const d = dossier || {};
  const cover = d.cover || {};
  const snap = d.snapshot || {};
  const price = d.priceHistory || {};
  const contract = d.contract || {};
  const filename = pdfFilename(cover.ticker);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ca = String(cover.ca || "");

  const paint = () => {
    doc.setFillColor(10, 14, 22);
    doc.rect(0, 0, W, H, "F");
    doc.setTextColor(40, 48, 64);
    doc.setFontSize(42);
    doc.text("RESEARCH ONLY", W / 2, H / 2, { align: "center", angle: 32 });
  };
  const footer = () => {
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 168);
    doc.text("ORBITX DESK · RESEARCH ONLY · Not financial advice", 40, H - 22);
    if (ca) doc.text(ca, W - 40, H - 22, { align: "right" });
  };
  const heading = (t, y) => {
    doc.setFontSize(14);
    doc.setTextColor(0, 229, 255);
    doc.text(String(t), 40, y);
    return y + 18;
  };
  const body = (lines, y, size = 10) => {
    doc.setFontSize(size);
    doc.setTextColor(230, 236, 245);
    for (const ln of lines) {
      if (y > H - 48) {
        footer();
        doc.addPage();
        paint();
        y = 48;
      }
      const text = String(ln || "").slice(0, 110);
      doc.text(text, 40, y);
      y += size + 4;
    }
    return y;
  };

  paint();
  let y = 56;
  doc.setFontSize(11);
  doc.setTextColor(0, 229, 255);
  doc.text("ORBITX · FULL INTEL DESK", 40, y);
  y += 28;
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(`${line(cover.name)}  $${line(cover.ticker)}`, 40, y);
  y += 28;
  doc.setFontSize(14);
  doc.setTextColor(255, 196, 0);
  doc.text(`VERDICT  ${line(cover.verdict)}   ·   CONF ${line(cover.confidence)}   ·   ${line(cover.age)}`, 40, y);
  y += 24;
  doc.setFontSize(10);
  doc.setTextColor(200, 210, 220);
  doc.text(ca || "CA UNKNOWN", 40, y);
  y += 28;
  y = body(
    [
      `Price ${line(snap.price)}   MC ${line(snap.mcap)}   FDV ${line(snap.fdv)}   LP ${line(snap.liquidity)}`,
      `ATH ${line(price.ath)}   ATL ${line(price.atl)}   from ATH ${line(price.pctFromAth)}%`,
      `Mint ${line(contract.mintAuthority)}  Freeze ${line(contract.freezeAuthority)}  LP lock ${line(contract.lpLock)}`,
      `canBuy ${line(contract.canBuy)}  canSell ${line(contract.canSell)}  round-trip ${line(contract.roundTripPct)}%`,
      `Bundles ${clusterLine(d.bundles)}`,
      `Snipers ${clusterLine(d.snipers)}`,
      `Insiders ${clusterLine(d.insiders)}`,
    ],
    y,
  );

  footer();
  doc.addPage();
  paint();
  y = heading("HOLDERS · DEV · EXIT DESK", 48);
  const dev = d.dev || {};
  const holders = d.holders || {};
  y = body(
    [
      `Dev ${line(dev.wallet)}   % now ${line(dev.pctNow)}   sold ${line(dev.sold)}`,
      `Other tokens ${line(dev.otherTokens)}   social vs launch ${line(dev.socialAgeVsLaunch)}`,
      `Whales ${line(holders.whaleCount)}   top10 ex-LP ${line(holders.top10PctWithoutLp)}%`,
    ],
    y,
  );
  const know = Array.isArray(d.whatYouShouldKnow) ? d.whatYouShouldKnow : [];
  y = heading("WHAT YOU SHOULD KNOW", y + 10);
  y = body(know.length ? know : ["UNKNOWN"], y);
  y = heading("SOURCES + GAPS", y + 10);
  y = body([...(d.sources || []), ...(d.gaps || []).map((g) => `GAP ${g}`), DISCLAIMER], y);
  footer();

  const dataUri = doc.output("datauristring");
  const base64 = String(dataUri).replace(/^data:application\/pdf;filename=generated.pdf;base64,/, "").replace(
    /^data:application\/pdf;base64,/,
    "",
  );
  return { filename, pdfBase64: base64, bytes: doc.output("arraybuffer") };
}
