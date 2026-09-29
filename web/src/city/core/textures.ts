import * as THREE from "three";

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export interface Facade {
  map: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
}

const FACADE_STYLES = [
  { base: "#232b36", win: "#9fb6cc", lit: "#ffd98a", cols: 8, rows: 12 }, // office blue
  { base: "#4a3226", win: "#c8b49a", lit: "#ffcf7a", cols: 6, rows: 9 },  // brick
  { base: "#14181f", win: "#7de3f4", lit: "#b8f4ff", cols: 10, rows: 14 }, // dark glass
  { base: "#2e2a33", win: "#d8cfae", lit: "#ffe9a8", cols: 5, rows: 7 },  // residential
  { base: "#1f2d3a", win: "#a8c8e8", lit: "#fff2b8", cols: 7, rows: 11 }, // concrete
];

/** Building facade with a matching emissive (lit windows) map for night. */
export function facadeTexture(style: number): Facade {
  const s = FACADE_STYLES[style % FACADE_STYLES.length];
  const [c, ctx] = canvas(256, 256);
  const [ce, etx] = canvas(256, 256);
  ctx.fillStyle = s.base;
  ctx.fillRect(0, 0, 256, 256);
  etx.fillStyle = "#000";
  etx.fillRect(0, 0, 256, 256);
  // subtle vertical grime
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "rgba(255,255,255,0.06)");
  grad.addColorStop(1, "rgba(0,0,0,0.25)");
  const cw = 256 / s.cols;
  const ch = 256 / s.rows;
  for (let r = 0; r < s.rows; r++) {
    for (let col = 0; col < s.cols; col++) {
      const x = col * cw + cw * 0.22;
      const y = r * ch + ch * 0.22;
      const w = cw * 0.56;
      const h = ch * 0.56;
      const lit = Math.random() < 0.42;
      ctx.fillStyle = lit ? s.lit : s.win;
      ctx.globalAlpha = lit ? 0.95 : 0.5;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x, y + h * 0.45, w, h * 0.1); // mullion shadow
      if (lit) {
        etx.fillStyle = s.lit;
        etx.fillRect(x, y, w, h);
      }
    }
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  // ground floor lobby band
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 256 - ch * 0.9, 256, ch * 0.9);
  return { map: toTexture(c), emissive: toTexture(ce) };
}

/** Asphalt strip with dashed center line. Tile along the road length (v axis). */
export function roadTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 256);
  ctx.fillStyle = "#1b1e24";
  ctx.fillRect(0, 0, 128, 256);
  // noise
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.12)";
    ctx.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  // edge lines
  ctx.fillStyle = "#d8d8d8";
  ctx.fillRect(6, 0, 3, 256);
  ctx.fillRect(119, 0, 3, 256);
  // center dashes
  ctx.fillStyle = "#e8c33a";
  for (let y = 0; y < 256; y += 64) ctx.fillRect(61, y + 8, 6, 32);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function sidewalkTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = "#3a3f47";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.1)";
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.moveTo(64, 0); ctx.lineTo(64, 128);
  ctx.moveTo(0, 64); ctx.lineTo(128, 64);
  ctx.stroke();
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export interface BillboardFace {
  texture: THREE.CanvasTexture;
  draw: (lines: { text: string; color: string; big?: boolean }[]) => void;
}

/** Updatable billboard canvas for live market data. */
export function billboardFace(w = 512, h = 256): BillboardFace {
  const [c, ctx] = canvas(w, h);
  const texture = toTexture(c);
  const draw = (lines: { text: string; color: string; big?: boolean }[]) => {
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "rgba(0,255,159,0.10)");
    g.addColorStop(1, "rgba(91,141,239,0.10)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#00ff9f";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.textAlign = "center";
    const n = lines.length;
    lines.forEach((l, i) => {
      const y = h * ((i + 1) / (n + 1)) + (l.big ? 14 : 8);
      ctx.font = l.big ? `800 64px system-ui, sans-serif` : `700 34px system-ui, sans-serif`;
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, w / 2, y);
    });
    texture.needsUpdate = true;
  };
  draw([{ text: "ORBITX CITY", color: "#00ff9f", big: true }]);
  return { texture, draw };
}
