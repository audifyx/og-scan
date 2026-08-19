/**
 * OrbitX City — procedural texture factory.
 * Spray-paint graffiti, neon ad screens, and live-token billboards are
 * all generated on 2D canvases at runtime (zero binary assets, fully themable).
 */
import * as THREE from "three";
import { mulberry32 } from "./collision";
import type { ScreenerRow } from "./marketData";
import { fmtPct, fmtUsd, shortMint } from "./marketData";
import type { ChartCandle } from "./tokenApi";
import type { TokenDetail } from "./types";

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
  ["#00ff9f", "#39ff14"],
  ["#ff4d6a", "#ff9ae0"],
  ["#5b8def", "#8ff5ff"],
  ["#c5a26f", "#e0c48a"],
  ["#b388ff", "#d9c8ff"],
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

/**
 * Procedural skyscraper facade: window grid with lit/dark variance, floor
 * bands, entrance level, grime gradient. Used as both color map and emissive
 * map so lit windows bloom at night. One texture per building tier.
 */
export function createFacadeTexture(
  seed: number,
  widthUnits: number,
  heightUnits: number,
  baseColor: string,
  accent: string,
  groundFloor: boolean,
): THREE.CanvasTexture {
  const cols = Math.max(2, Math.round(widthUnits / 1.35));
  const rows = Math.max(2, Math.round(heightUnits / 1.7));
  const W = Math.min(512, Math.max(128, cols * 36));
  const H = Math.min(1024, Math.max(128, rows * 44));
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(seed);

  // Wall base with vertical shading + grime near the ground
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, baseColor);
  wall.addColorStop(0.75, baseColor);
  wall.addColorStop(1, "#05070c");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);

  // Subtle panel seams
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let c = 1; c < cols; c++) {
    const x = (c / cols) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  const cellW = W / cols;
  const cellH = H / rows;
  const winW = cellW * 0.56;
  const winH = cellH * 0.6;
  const litPalette = ["#f0d7a0", "#ffe9b8", "#e8c99a", "#c8d8e8", "#00ff9f"];

  const groundRows = groundFloor ? 1 : 0;
  for (let r = 0; r < rows - groundRows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + (cellW - winW) / 2;
      const y = r * cellH + (cellH - winH) / 2;
      const roll = rand();
      if (roll < 0.32) {
        ctx.fillStyle = "#12161a";
        ctx.fillRect(x, y, winW, winH);
        ctx.fillStyle = "rgba(180,200,210,0.16)";
        ctx.fillRect(x, y, winW, winH * 0.4);
      } else if (roll < 0.9) {
        const color = litPalette[Math.floor(rand() * litPalette.length)]!;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.62 + rand() * 0.32;
        ctx.fillRect(x, y, winW, winH);
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#fff6d0";
        ctx.fillRect(x + 1, y + 1, winW - 2, winH * 0.35);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#0a0d10";
        ctx.fillRect(x, y, winW, winH);
      }
      // Frame
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, winW, winH);
    }
  }

  // Ground level: dark storefront band + quiet accent strip + door
  if (groundFloor) {
    const gy = (rows - 1) * cellH;
    ctx.fillStyle = "#161a1e";
    ctx.fillRect(0, gy, W, cellH);
    ctx.fillStyle = `${accent}33`;
    ctx.fillRect(0, gy, W, 3);
    const doorW = cellW * 0.7;
    ctx.fillStyle = "#2a3036";
    ctx.fillRect(W / 2 - doorW / 2, gy + cellH * 0.22, doorW, cellH * 0.78);
    ctx.fillStyle = "rgba(220,230,235,0.18)";
    ctx.fillRect(W / 2 - doorW / 2 + 4, gy + cellH * 0.3, doorW - 8, cellH * 0.55);
    for (let c = 0; c < cols; c++) {
      if (Math.abs(c - (cols - 1) / 2) < 0.7) continue;
      ctx.fillStyle = "rgba(160,180,190,0.12)";
      ctx.fillRect(c * cellW + cellW * 0.15, gy + cellH * 0.3, cellW * 0.7, cellH * 0.55);
    }
  }

  return toTexture(canvas);
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

  ctx.shadowColor = colorA;
  ctx.shadowBlur = 34;
  ctx.strokeStyle = colorA;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 18;
  ctx.strokeText(text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "#05070d";
  ctx.lineWidth = 12;
  ctx.strokeText(text, 0, 0);

  const grad = ctx.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2);
  grad.addColorStop(0, colorB);
  grad.addColorStop(1, colorA);
  ctx.fillStyle = grad;
  ctx.fillText(text, 0, 0);

  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeText(text, -3, -4);
  ctx.globalAlpha = 1;

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

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#070d18");
  bg.addColorStop(1, "#03050a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.75, H * 0.3, 10, W * 0.75, H * 0.3, 220);
  glow.addColorStop(0, `${accent}33`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

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

  ctx.font = `700 22px ${MONO_FONT}`;
  ctx.fillStyle = "#dce9ff";
  ctx.fillText(subtitle, 24, 126);

  ctx.fillStyle = `${accent}22`;
  ctx.fillRect(0, H - 34, W, 34);
  ctx.font = `700 14px ${MONO_FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText("SPONSORED · ORBITX ADNET", 22, H - 12);

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1.4);

  ctx.strokeStyle = `${accent}88`;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  return toTexture(canvas);
}

/** Draw a live token ad into an existing canvas (price, mcap, sparkline, QR). */
export function drawLiveTokenBoard(
  ctx: CanvasRenderingContext2D,
  token: TokenDetail | null,
  candles: ChartCandle[],
  accent: string,
  fallbackTitle: string,
  qrImage?: CanvasImageSource | null,
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#050b14");
  bg.addColorStop(1, "#02040a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.2, 40, 8, W * 0.2, 40, 180);
  glow.addColorStop(0, `${accent}40`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const title = token ? `$${token.symbol.toUpperCase()}` : fallbackTitle;
  const name = token?.name ?? "Loading…";

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 48px ${GRAFFITI_FONT}`;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 20;
  ctx.fillStyle = accent;
  ctx.fillText(title.slice(0, 12), 22, 62);
  ctx.shadowBlur = 0;

  ctx.font = `700 18px ${MONO_FONT}`;
  ctx.fillStyle = "#c8d8f0";
  ctx.fillText(name.slice(0, 28), 24, 92);

  // Stats row
  ctx.font = `700 22px ${MONO_FONT}`;
  ctx.fillStyle = "#e8f1ff";
  ctx.fillText(fmtUsd(token?.priceUsd), 24, 140);
  const ch = Number(token?.change24h);
  ctx.fillStyle = Number.isFinite(ch) && ch < 0 ? "#ff5d5d" : "#17ff4d";
  ctx.fillText(fmtPct(token?.change24h), 200, 140);

  ctx.fillStyle = "#9fb6d4";
  ctx.font = `700 15px ${MONO_FONT}`;
  ctx.fillText(`MC ${fmtUsd(token?.mcap)}`, 24, 172);
  ctx.fillText(`VOL ${fmtUsd(token?.volume24h)}`, 200, 172);
  if (token?.mint) ctx.fillText(shortMint(token.mint, 4), 360, 172);

  // Sparkline from candles
  if (candles.length > 1) {
    const closes = candles.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const left = 22;
    const right = W - 110;
    const top = 195;
    const bottom = H - 52;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    closes.forEach((c, i) => {
      const x = left + (i / (closes.length - 1)) * (right - left);
      const y = bottom - ((c - min) / range) * (bottom - top);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // QR code linking to the token's DEX page (scannable from stream/screenshots)
  const qx = W - 88;
  const qy = H - 96;
  if (qrImage) {
    ctx.drawImage(qrImage, qx, qy, 68, 68);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(qx, qy, 68, 68);
    ctx.fillStyle = "#05070d";
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if ((r + c * 3 + (token?.symbol?.length ?? 0)) % 3 !== 0) {
          ctx.fillRect(qx + 6 + c * 8, qy + 6 + r * 8, 7, 7);
        }
      }
    }
  }

  ctx.fillStyle = `${accent}22`;
  ctx.fillRect(0, H - 34, W, 34);
  ctx.font = `700 13px ${MONO_FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText("TAP / [E] · BUY WITH WALLET · ORBITX ADNET", 22, H - 12);

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  for (let sy = 0; sy < H; sy += 4) ctx.fillRect(0, sy, W, 1.4);
  ctx.strokeStyle = `${accent}88`;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, W - 4, H - 4);
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

  ctx.fillStyle = "#0a1420";
  ctx.fillRect(0, H - 44, W, 44);
  ctx.font = `700 20px ${MONO_FONT}`;
  ctx.fillStyle = "#3de7ff";
  ctx.fillText("ORBITX ADNET · REAL WALLETS · REAL MARKETS · /ORBITX_DEX", 26, H - 15);

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  for (let sy = 0; sy < H; sy += 5) ctx.fillRect(0, sy, W, 1.6);
}
