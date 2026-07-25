/**
 * OrbitX City — procedural texture factory.
 * Spray-paint graffiti, neon ad screens, and the live-market mega screen are
 * all generated on 2D canvases at runtime (zero binary assets, fully themable).
 */
import * as THREE from "three";
import { mulberry32 } from "./collision";
import type { ScreenerRow } from "./marketData";
import { fmtPct, fmtUsd } from "./marketData";

export const GRAFFITI_TAGS = [
  "WAGMI",
  "HODL",
  "GM DEGEN",
  "APE SZN",
  "PUMP IT",
  "TO THE MOON",
  "DIAMOND HANDS",
  "ORBITX",
  "LFG",
  "1000X",
  "RUG FREE ZONE",
  "SOL SZN",
  "PROBABLY NOTHING",
  "FEW UNDERSTAND",
  "SER...",
  "NGMI?",
  "BUY THE DIP",
  "TRUE OG ONLY",
];

const PALETTES: Array<[string, string]> = [
  ["#17ff4d", "#0affc2"],
  ["#ff4d9a", "#ff9ae0"],
  ["#3de7ff", "#8ff5ff"],
  ["#f5c542", "#ffe28a"],
  ["#a78bfa", "#d9c8ff"],
  ["#ff6b35", "#ffd166"],
];

const GRAFFITI_FONT = "'Arial Black', Impact, 'JetBrains Mono', sans-serif";
const MONO_FONT = "'JetBrains Mono', 'Space Mono', monospace";

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Multi-layer spray-paint tag: halo, outline, gradient fill, drips, splatter. */
export function createGraffitiTexture(text: string, seed: number): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(seed);
  const [colorA, colorB] = PALETTES[Math.floor(rand() * PALETTES.length)];

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate((rand() - 0.5) * 0.16);

  // Fit font size to canvas
  let fontSize = 118;
  const italic = rand() > 0.5 ? "italic " : "";
  do {
    ctx.font = `${italic}900 ${fontSize}px ${GRAFFITI_FONT}`;
    if (ctx.measureText(text).width <= W * 0.84) break;
    fontSize -= 6;
  } while (fontSize > 34);
  const tw = ctx.measureText(text).width;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 1 — soft spray halo
  ctx.shadowColor = colorA;
  ctx.shadowBlur = 34;
  ctx.strokeStyle = colorA;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 18;
  ctx.strokeText(text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // 2 — hard dark outline
  ctx.strokeStyle = "#05070d";
  ctx.lineWidth = 12;
  ctx.strokeText(text, 0, 0);

  // 3 — vertical neon gradient fill
  const grad = ctx.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2);
  grad.addColorStop(0, colorB);
  grad.addColorStop(1, colorA);
  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);

  // 4 — white shine pass
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeText(text, -3, -4);
  ctx.globalAlpha = 1;

  // 5 — paint drips from the baseline
  const dripCount = 4 + Math.floor(rand() * 5);
  const baseY = fontSize * 0.3;
  for (let i = 0; i < dripCount; i++) {
    const dx = -tw / 2 + rand() * tw;
    const len = 14 + rand() * 58;
    const w = 4 + rand() * 4;
    ctx.fillStyle = rand() > 0.5 ? colorA : colorB;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(dx - w / 2, baseY, w, len);
    ctx.beginPath();
    ctx.arc(dx, baseY + len, w * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6 — splatter field
  for (let i = 0; i < 46; i++) {
    const sx = (rand() - 0.5) * (tw + 120);
    const sy = (rand() - 0.5) * fontSize * 1.7;
    ctx.fillStyle = rand() > 0.5 ? colorA : colorB;
    ctx.globalAlpha = 0.15 + rand() * 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 1 + rand() * 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 7 — underline swoosh
  ctx.strokeStyle = colorB;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(-tw / 2 - 24, baseY + 14);
  ctx.quadraticCurveTo((rand() - 0.5) * 80, baseY + 34 + rand() * 14, tw / 2 + 24, baseY + 6);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
  return toTexture(canvas);
}

/** Neon ad screen for billboards: title, subtitle, sparkline, scanlines. */
export function createAdTexture(
  title: string,
  subtitle: string,
  accent: string,
  seed: number,
): THREE.CanvasTexture {
  const W = 512;
  const H = 288;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(seed);

  // Backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#070d18");
  bg.addColorStop(1, "#03050a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ambient glow blob
  const glow = ctx.createRadialGradient(W * 0.75, H * 0.3, 10, W * 0.75, H * 0.3, 220);
  glow.addColorStop(0, `${accent}33`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Sparkline (fake pump chart)
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  let y = H * 0.72;
  ctx.moveTo(16, y);
  for (let x = 16; x <= W - 16; x += 24) {
    y = Math.max(H * 0.3, Math.min(H * 0.86, y + (rand() - 0.58) * 40));
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Title
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 54px ${GRAFFITI_FONT}`;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 26;
  ctx.fillStyle = accent;
  ctx.fillText(title, 22, 86);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffffff";
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.4;
  ctx.strokeText(title, 22, 86);
  ctx.globalAlpha = 1;

  // Subtitle
  ctx.font = `700 22px ${MONO_FONT}`;
  ctx.fillStyle = "#dce9ff";
  ctx.fillText(subtitle, 24, 126);

  // Footer strip
  ctx.fillStyle = `${accent}22`;
  ctx.fillRect(0, H - 34, W, 34);
  ctx.font = `700 14px ${MONO_FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText("SPONSORED · ORBITX ADNET", 22, H - 12);

  // Scanlines
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1.4);

  // Border
  ctx.strokeStyle = `${accent}88`;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  return toTexture(canvas);
}

/** Live market mega-screen renderer — call on a persistent canvas. */
export function drawMegaScreen(
  ctx: CanvasRenderingContext2D,
  rows: ScreenerRow[],
  blink: boolean,
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#050b14");
  bg.addColorStop(1, "#02040a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = "#0a1a12";
  ctx.fillRect(0, 0, W, 74);
  ctx.font = `900 44px ${GRAFFITI_FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "#17ff4d";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#17ff4d";
  ctx.fillText("ORBITX LIVE", 26, 52);
  ctx.shadowBlur = 0;

  if (blink) {
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(W - 120, 38, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `700 24px ${MONO_FONT}`;
  ctx.fillStyle = "#ff8080";
  ctx.fillText("LIVE", W - 98, 47);

  // Rows
  const list = rows.slice(0, 7);
  const rowH = 62;
  const startY = 118;
  ctx.font = `700 30px ${MONO_FONT}`;
  if (list.length === 0) {
    ctx.fillStyle = "#5b708c";
    ctx.fillText("AWAITING MARKET FEED…", 26, startY + 20);
  }
  list.forEach((r, i) => {
    const y = startY + i * rowH;
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(0, y - 38, W, rowH - 8);
    }
    ctx.fillStyle = "#e8f1ff";
    ctx.fillText(`$${(r.symbol ?? "???").toUpperCase().slice(0, 8)}`, 26, y);
    ctx.fillStyle = "#9fb6d4";
    ctx.fillText(fmtUsd(r.priceUsd), W * 0.42, y);
    const ch = Number(r.change24h);
    ctx.fillStyle = Number.isFinite(ch) && ch < 0 ? "#ff5d5d" : "#17ff4d";
    ctx.fillText(fmtPct(r.change24h), W * 0.72, y);
  });

  // Footer
  ctx.fillStyle = "#0a1420";
  ctx.fillRect(0, H - 44, W, 44);
  ctx.font = `700 20px ${MONO_FONT}`;
  ctx.fillStyle = "#3de7ff";
  ctx.fillText("ORBITX ADNET · REAL WALLETS · REAL MARKETS · /ORBITX_DEX", 26, H - 15);

  // Scanlines + vignette
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  for (let sy = 0; sy < H; sy += 5) ctx.fillRect(0, sy, W, 1.6);
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H);
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}
