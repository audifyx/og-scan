// Renders a small price sparkline (with area fill + peak marker) to a PNG data URL.
import type { SeriesPoint } from "./intelligence";

export function renderSparklinePng(series: SeriesPoint[], opts?: { peakIndex?: number; accent?: string }): string | null {
  const pts = series.filter((p) => typeof p.price === "number" && Number.isFinite(p.price));
  if (pts.length < 2) return null;
  const W = 600, H = 180, pad = 16;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const accent = opts?.accent ?? "#38c4dc";

  ctx.fillStyle = "#10161e"; ctx.fillRect(0, 0, W, H);

  const prices = pts.map((p) => p.price as number);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || Math.abs(max) || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const yv = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);

  // area fill
  ctx.beginPath();
  ctx.moveTo(x(0), yv(prices[0]));
  prices.forEach((v, i) => ctx.lineTo(x(i), yv(v)));
  ctx.lineTo(x(prices.length - 1), H - pad);
  ctx.lineTo(x(0), H - pad);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(56,196,220,0.35)");
  grad.addColorStop(1, "rgba(56,196,220,0)");
  ctx.fillStyle = grad; ctx.fill();

  // line
  ctx.beginPath();
  prices.forEach((v, i) => { const fx = x(i), fy = yv(v); if (i) ctx.lineTo(fx, fy); else ctx.moveTo(fx, fy); });
  ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.stroke();

  // peak marker
  const peak = opts?.peakIndex ?? prices.indexOf(max);
  if (peak >= 0 && peak < prices.length) {
    ctx.fillStyle = "#f0be46";
    ctx.beginPath(); ctx.arc(x(peak), yv(prices[peak]), 4, 0, Math.PI * 2); ctx.fill();
  }
  try { return canvas.toDataURL("image/png"); } catch { return null; }
}
