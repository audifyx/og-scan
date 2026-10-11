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

interface FacadeStyle {
  name: string;
  base: string;      // wall color
  trim: string;      // cornice / frame color
  glassTop: string;  // window glass gradient top (sky reflection)
  glassBot: string;  // window glass gradient bottom
  awning: string;    // awning stripe color
  sign: string;     // storefront sign bg
  glass: boolean;    // full curtain-wall glass
}

const FACADE_STYLES: FacadeStyle[] = [
  { name: "brick",    base: "#a2593f", trim: "#7c3f2c", glassTop: "#cfe4f2", glassBot: "#8fb4cc", awning: "#2e6f8e", sign: "#f5efe2", glass: false },
  { name: "beige",    base: "#cbbfa8", trim: "#a89a80", glassTop: "#d6e8f4", glassBot: "#93b8d2", awning: "#b3402e", sign: "#2b3a4a", glass: false },
  { name: "glass",    base: "#6f97b8", trim: "#4a6a86", glassTop: "#dceefb", glassBot: "#7ba7c9", awning: "#3a4a5a", sign: "#10161d", glass: true },
  { name: "white",    base: "#ece9e1", trim: "#c9c4b6", glassTop: "#cfe0ee", glassBot: "#8aa9c2", awning: "#3f7d4e", sign: "#d84f35", glass: false },
  { name: "sand",     base: "#d9b981", trim: "#b8945a", glassTop: "#d8e6f2", glassBot: "#8fb0c8", awning: "#8e5a2e", sign: "#274a63", glass: false },
];

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: FacadeStyle) {
  // dark frame
  ctx.fillStyle = s.trim;
  ctx.fillRect(x, y, w, h);
  const ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
  // glass with sky reflection gradient
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, s.glassTop);
  g.addColorStop(1, s.glassBot);
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, iw, ih);
  // diagonal reflection streak
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.moveTo(ix + iw * 0.15, iy + ih);
  ctx.lineTo(ix + iw * 0.45, iy);
  ctx.lineTo(ix + iw * 0.65, iy);
  ctx.lineTo(ix + iw * 0.35, iy + ih);
  ctx.closePath();
  ctx.fill();
  // random blinds / tint variation
  const r = Math.random();
  if (r < 0.25) {
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (let by = iy + 4; by < iy + ih - 2; by += 6) ctx.fillRect(ix, by, iw, 2);
  } else if (r < 0.4) {
    ctx.fillStyle = "rgba(20,30,40,0.30)";
    ctx.fillRect(ix, iy, iw, ih);
  }
  // mullion cross
  ctx.fillStyle = s.trim;
  ctx.fillRect(ix + iw / 2 - 1, iy, 2, ih);
  ctx.fillRect(ix, iy + ih / 2 - 1, iw, 2);
}

/** Realistic daytime building facade. Tile covers ~14m x 14m. Emissive map is black (daytime, no glow). */
export function facadeTexture(style: number): Facade {
  const s = FACADE_STYLES[style % FACADE_STYLES.length];
  const [c, ctx] = canvas(256, 256);
  const [ce, etx] = canvas(256, 256);
  etx.fillStyle = "#000";
  etx.fillRect(0, 0, 256, 256);

  // wall base with subtle texture noise
  ctx.fillStyle = s.base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  if (s.name === "brick") {
    // brick courses
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let y = 0; y < 256; y += 8) ctx.fillRect(0, y, 256, 1);
    for (let y = 0; y < 256; y += 8) {
      const off = (y / 8) % 2 === 0 ? 0 : 12;
      for (let x = off; x < 256; x += 24) ctx.fillRect(x, y, 2, 8);
    }
  }

  const cols = 5;
  const cw = 256 / cols;
  const GF_H = 72;          // ground floor height (px)
  const topY = 256 - GF_H;

  if (s.glass) {
    // full curtain wall: continuous glass with mullions
    for (let r = 0; r < 4; r++) {
      const y0 = r * (topY / 4);
      const h = topY / 4;
      for (let col = 0; col < cols; col++) {
        drawWindow(ctx, col * cw + 2, y0 + 4, cw - 4, h - 8, s);
      }
    }
    // horizontal spandrel bands
    ctx.fillStyle = s.trim;
    for (let r = 0; r <= 4; r++) ctx.fillRect(0, r * (topY / 4) - 2, 256, 4);
  } else {
    // punched windows, 3 upper floors
    for (let r = 0; r < 3; r++) {
      const y0 = r * (topY / 3);
      const h = topY / 3;
      for (let col = 0; col < cols; col++) {
        drawWindow(ctx, col * cw + cw * 0.18, y0 + h * 0.14, cw * 0.64, h * 0.72, s);
      }
    }
  }

  // cornice band at top
  ctx.fillStyle = shade(s.trim, -18);
  ctx.fillRect(0, 0, 256, 10);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(0, 10, 256, 3);

  // ---- ground floor storefront ----
  ctx.fillStyle = shade(s.base, -34);
  ctx.fillRect(0, topY, 256, GF_H);
  // stone base
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 256 - 12, 256, 12);
  // sign band
  ctx.fillStyle = s.sign;
  ctx.fillRect(10, topY + 6, 236, 20);
  // fake sign lettering (light bars)
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  let sx = 24;
  while (sx < 220) {
    const sw = 8 + Math.random() * 18;
    ctx.fillRect(sx, topY + 12, sw, 8);
    sx += sw + 8;
  }
  // glass storefront panes + door
  for (let col = 0; col < cols; col++) {
    const px = col * cw + 6, pw = cw - 12, py = topY + 32, ph = GF_H - 32 - 14;
    const isDoor = col === 2;
    ctx.fillStyle = s.trim;
    ctx.fillRect(px, py, pw, ph);
    const g2 = ctx.createLinearGradient(0, py, 0, py + ph);
    g2.addColorStop(0, s.glassTop);
    g2.addColorStop(1, s.glassBot);
    ctx.fillStyle = g2;
    ctx.fillRect(px + 3, py + 3, pw - 6, ph - 3);
    if (isDoor) {
      ctx.fillStyle = "rgba(20,26,32,0.55)";
      ctx.fillRect(px + pw / 2 - 2, py + 3, 4, ph - 3);
      ctx.fillStyle = "#d8d8d8";
      ctx.fillRect(px + pw / 2 + 5, py + ph / 2, 3, 8); // handle
    }
  }
  // striped awning
  const awY = topY + 28;
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = (x / 16) % 2 === 0 ? s.awning : "#f2ede2";
    ctx.fillRect(x, awY, 16, 5);
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, awY + 5, 256, 4);

  return { map: toTexture(c), emissive: toTexture(ce) };
}

/** Light warm-gray asphalt with lane markings. Tile along road length (v axis). */
export function roadTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 256);
  ctx.fillStyle = "#8f9296";
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  // edge lines (white)
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(6, 0, 4, 256);
  ctx.fillRect(118, 0, 4, 256);
  // center dashes (yellow)
  ctx.fillStyle = "#e8b93a";
  for (let y = 0; y < 256; y += 64) ctx.fillRect(61, y + 10, 6, 34);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Zebra crosswalk stripes on asphalt. Bars run along canvas-y. */
export function crosswalkTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = "#8f9296";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  ctx.fillStyle = "rgba(245,245,245,0.92)";
  for (let x = 8; x < 128; x += 24) ctx.fillRect(x, 8, 12, 112);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Light tan concrete sidewalk with expansion joints. */
export function sidewalkTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = "#c9c0ae";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 350; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  ctx.strokeStyle = "rgba(90,80,65,0.45)";
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

/** Lush green grass with tonal variation. */
export function grassTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = "#5da24a";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const g = 120 + Math.floor(Math.random() * 60);
    ctx.fillStyle = `rgba(${g * 0.55},${g},${g * 0.5},0.5)`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Light gray commercial roofing with seams. */
export function roofTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = "#a9adb1";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 250; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= 128; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
  for (let y = 0; y <= 128; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Soft white cloud puff for sky sprites. */
export function cloudTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 128);
  ctx.clearRect(0, 0, 256, 128);
  const blobs: [number, number, number][] = [
    [70, 80, 42], [120, 66, 52], [175, 78, 44], [100, 92, 36], [150, 92, 38],
  ];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.7, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c);
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
    ctx.fillStyle = "#0a1420";
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "rgba(0,255,159,0.14)");
    g.addColorStop(1, "rgba(91,141,239,0.14)");
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
