// ============================================================
// OG Scan — viral scan card PNG exporter (pure canvas, no deps).
// Draws a branded 1200x630 share card and triggers a download.
// ============================================================

import type { ScanCardPayload } from "./social";
import type { OgTier } from "./classification";

const TIER_HEX: Record<OgTier, string> = {
  OG_TOKEN: "#78dc78", SAFE_CLONE: "#38c4dc", RISKY_TOKEN: "#f0be46", DANGEROUS_TOKEN: "#f0505a",
};

export function downloadScanCardImage(card: ScanCardPayload): void {
  const W = 1200, H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const accent = TIER_HEX[card.tier] ?? "#38c4dc";

  // background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b0f14"); g.addColorStop(1, "#10161e");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // accent glow + side bar
  ctx.fillStyle = accent; ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.arc(W - 120, 120, 260, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 14, H);

  // border
  ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, W - 56, H - 56);

  const PAD = 70;
  // header
  ctx.fillStyle = accent; ctx.font = "bold 34px Helvetica, Arial, sans-serif";
  ctx.fillText("OG SCAN", PAD, 95);
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "20px Helvetica, Arial, sans-serif";
  ctx.fillText(card.title, PAD, 125);
  ctx.textAlign = "right";
  ctx.fillText(card.date, W - PAD, 95);
  ctx.textAlign = "left";

  // ticker
  ctx.fillStyle = "#e8eef5"; ctx.font = "bold 92px Helvetica, Arial, sans-serif";
  ctx.fillText(card.ticker, PAD, 250);

  // tier label
  ctx.fillStyle = accent; ctx.font = "bold 54px Helvetica, Arial, sans-serif";
  ctx.fillText(card.tierLabel, PAD, 320);

  // confidence / risk
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "28px Helvetica, Arial, sans-serif";
  ctx.fillText(`Confidence ${card.confidence}%      Risk ${card.risk}/100`, PAD, 372);

  // top signals
  ctx.font = "24px Helvetica, Arial, sans-serif";
  let sy = 430;
  for (const sig of card.topSignals.slice(0, 3)) {
    ctx.fillStyle = accent; ctx.fillText("•", PAD, sy);
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillText(sig.label, PAD + 26, sy);
    sy += 38;
  }

  // CA + footer
  ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.font = "20px monospace";
  ctx.fillText(`CA: ${card.ca}`, PAD, H - 90);
  ctx.fillStyle = accent; ctx.font = "bold 24px Helvetica, Arial, sans-serif";
  ctx.fillText(card.footer, PAD, H - 54);
  ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "20px Helvetica, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`by ${card.attribution}`, W - PAD, H - 54);
  ctx.textAlign = "left";

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OGScan_${card.ticker.replace(/[^A-Za-z0-9]/g, "")}_card.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}
