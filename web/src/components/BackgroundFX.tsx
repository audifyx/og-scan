import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/* ────────────────────────────────────────────────────────────────
   BackgroundFX — animated / 3D desktop backgrounds for the Hub.
   Modes: nebula (aurora blobs) · starfield (3D fly-through canvas)
   grid3d (synthwave perspective floor) · orbs (parallax depth orbs)
   matrix (code rain canvas) · custom (user wallpaper) · minimal
   Persisted in localStorage under `hub-bgfx` / `hub-wallpaper`.
   ──────────────────────────────────────────────────────────────── */

export type BuiltinMode = "nebula" | "starfield" | "grid3d" | "orbs" | "matrix" | "custom" | "minimal";
export type BgMode = BuiltinMode | (string & {});
export const BG_KEY = "hub-bgfx";
export const WALLPAPER_KEY = "hub-wallpaper";
const MODES: BuiltinMode[] = ["nebula", "starfield", "grid3d", "orbs", "matrix", "custom", "minimal"];

export const readBgMode = (): BgMode => {
  try {
    const v = localStorage.getItem(BG_KEY) as BgMode | null;
    if (v && ((MODES as string[]).includes(v) || BG_THEMES.some((t) => t.id === v))) return v;
    // migrate: users who already set a wallpaper keep it
    if (localStorage.getItem(WALLPAPER_KEY)) return "custom";
  } catch { /* noop */ }
  return "nebula";
};

export const BG_META: Record<BuiltinMode, { name: string; desc: string; icon: string }> = {
  nebula:    { name: "Nebula",       desc: "Drifting aurora clouds",      icon: "🌌" },
  starfield: { name: "Warp Field",   desc: "3D stars flying past you",    icon: "✨" },
  grid3d:    { name: "Grid Horizon", desc: "Synthwave 3D floor",          icon: "🌆" },
  orbs:      { name: "Deep Orbs",    desc: "Parallax depth spheres",      icon: "🪐" },
  matrix:    { name: "Code Rain",    desc: "Falling glyph streams",       icon: "🟩" },
  custom:    { name: "Your Image",   desc: "Upload any wallpaper",        icon: "🖼️" },
  minimal:   { name: "Minimal",      desc: "Pure deep-space black",       icon: "⬛" },
};

/* ── canvas engines ─────────────────────────────────────────── */
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function runStarfield(canvas: HTMLCanvasElement, opts?: { hue?: number }): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, raf = 0, alive = true;
  const N = 260;
  const baseHue = opts?.hue ?? 200;
  const hueSpread = opts?.hue != null ? 46 : 80;
  const stars = Array.from({ length: N }, () => ({
    x: (Math.random() * 2 - 1), y: (Math.random() * 2 - 1), z: Math.random(), pz: 0, hue: baseHue + Math.random() * hueSpread,
  }));
  const resize = () => { W = canvas.clientWidth * DPR; H = canvas.clientHeight * DPR; canvas.width = W; canvas.height = H; };
  resize();
  window.addEventListener("resize", resize);
  const tick = () => {
    if (!alive) return;
    if (document.hidden) { raf = requestAnimationFrame(tick); return; }
    ctx.fillStyle = "rgba(4,6,12,0.45)";
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, f = Math.min(W, H) * 0.9;
    for (const s of stars) {
      s.pz = s.z; s.z -= 0.0042;
      if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; s.pz = 1; }
      const px = cx + (s.x / s.z) * f * 0.5, py = cy + (s.y / s.z) * f * 0.5;
      const ppx = cx + (s.x / s.pz) * f * 0.5, ppy = cy + (s.y / s.pz) * f * 0.5;
      if (px < 0 || px > W || py < 0 || py > H) continue;
      const t = 1 - s.z, size = t * 2.4 * DPR, a = Math.min(1, t * 1.4);
      ctx.strokeStyle = `hsla(${s.hue},90%,72%,${a * 0.85})`;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ppx, ppy); ctx.lineTo(px, py); ctx.stroke();
    }
    raf = requestAnimationFrame(tick);
  };
  ctx.fillStyle = "#04060c"; ctx.fillRect(0, 0, W, H);
  raf = requestAnimationFrame(tick);
  return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
}

function runMatrix(canvas: HTMLCanvasElement, opts?: { color?: string }): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, raf = 0, alive = true, cols = 0, drops: number[] = [];
  const mHead = opts?.color ? hexToRgba(opts.color, 0.92) : "rgba(190,255,210,0.9)";
  const mTrail = opts?.color ? hexToRgba(opts.color, 0.5) : "rgba(52,211,153,0.55)";
  const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01$◎ΞΔΣΩ<>[]{}=+*/#";
  const FS = 15 * DPR;
  const resize = () => {
    W = canvas.clientWidth * DPR; H = canvas.clientHeight * DPR; canvas.width = W; canvas.height = H;
    cols = Math.floor(W / FS); drops = Array.from({ length: cols }, () => Math.random() * -60);
    ctx.fillStyle = "#030705"; ctx.fillRect(0, 0, W, H);
  };
  resize();
  window.addEventListener("resize", resize);
  let last = 0;
  const tick = (ts: number) => {
    if (!alive) return;
    if (document.hidden || ts - last < 50) { raf = requestAnimationFrame(tick); return; }
    last = ts;
    ctx.fillStyle = "rgba(3,7,5,0.16)"; ctx.fillRect(0, 0, W, H);
    ctx.font = `${FS}px monospace`;
    for (let i = 0; i < cols; i++) {
      const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
      const y = drops[i] * FS;
      ctx.fillStyle = mHead;
      ctx.fillText(ch, i * FS, y);
      ctx.fillStyle = mTrail;
      ctx.fillText(ch, i * FS, y - FS);
      if (y > H && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
}

/* ── themed scenes (data-driven, palette-parameterized) ─────── */
export interface BgTheme {
  id: string;
  name: string;
  desc: string;
  icon: string;
  category: string;
  engine: "aurora" | "orbs" | "grid" | "stars" | "rain";
  colors: string[]; // 2-4 hex colors, brightest first
  hue?: number;      // base hue for the "stars" engine
}

export const BG_THEMES: BgTheme[] = [
  // Sports
  { id: "sports-stadium", name: "Stadium Lights", desc: "Floodlit pitch glow", icon: "🏟️", category: "Sports", engine: "aurora", colors: ["#39ff14", "#00e676", "#0e7490", "#b2ebf2"] },
  { id: "sports-hardwood", name: "Hardwood Court", desc: "Bouncing court energy", icon: "🏀", category: "Sports", engine: "orbs", colors: ["#ffab00", "#ff6a00", "#ffd700", "#ff6e40"] },
  { id: "sports-grand-prix", name: "Grand Prix", desc: "Neon race circuit", icon: "🏎️", category: "Sports", engine: "grid", colors: ["#ff1a1a", "#f7ff00", "#ff5e8a", "#7b2ff7"] },
  { id: "sports-ice-rink", name: "Ice Rink", desc: "Frozen arena shimmer", icon: "🏒", category: "Sports", engine: "aurora", colors: ["#b2ebf2", "#29b6f6", "#e0f7fa", "#1de9b6"] },
  { id: "sports-title-fight", name: "Title Fight", desc: "Spotlight ring glow", icon: "🥊", category: "Sports", engine: "orbs", colors: ["#ff2d2d", "#ffd700", "#ff4081", "#ffab00"] },
  // TV Shows
  { id: "tv-upside-down", name: "Upside Down", desc: "Eerie red drift", icon: "🙃", category: "TV Shows", engine: "aurora", colors: ["#ff1744", "#7c4dff", "#b026ff", "#3d1560"] },
  { id: "tv-sitcom-sunset", name: "Sitcom Sunset", desc: "Warm studio glow", icon: "📺", category: "TV Shows", engine: "aurora", colors: ["#ffab91", "#ff6e40", "#ffab00", "#ff4081"] },
  { id: "tv-crime-noir", name: "Crime Noir", desc: "Moody blue city", icon: "🕵️", category: "TV Shows", engine: "grid", colors: ["#3d5afe", "#29b6f6", "#5b7cff", "#1a237e"] },
  { id: "tv-saturday-cartoons", name: "Saturday Cartoons", desc: "Bright cartoon pop", icon: "🎨", category: "TV Shows", engine: "orbs", colors: ["#ff2d95", "#f7ff00", "#00f0ff", "#39ff14"] },
  { id: "tv-reality-neon", name: "Reality Neon", desc: "Glossy neon haze", icon: "✨", category: "TV Shows", engine: "aurora", colors: ["#ff4081", "#b026ff", "#ff2d95", "#7c4dff"] },
  // Movies
  { id: "movie-space-saga", name: "Space Saga", desc: "Hyperspace star jump", icon: "🚀", category: "Movies", engine: "stars", colors: ["#ffd700", "#0066ff"], hue: 210 },
  { id: "movie-code-matrix", name: "Code Matrix", desc: "Falling green code", icon: "🟩", category: "Movies", engine: "rain", colors: ["#39ff14"] },
  { id: "movie-hero-skyline", name: "Hero Skyline", desc: "Caped city grid", icon: "🦸", category: "Movies", engine: "grid", colors: ["#0066ff", "#ff2d2d", "#ffd700", "#3d5afe"] },
  { id: "movie-western-dusk", name: "Western Dusk", desc: "Desert sundown haze", icon: "🤠", category: "Movies", engine: "aurora", colors: ["#ff6a00", "#ffab00", "#ff6e40", "#c1121f"] },
  { id: "movie-crimson-horror", name: "Crimson Horror", desc: "Blood-red fog", icon: "🩸", category: "Movies", engine: "aurora", colors: ["#c1121f", "#ff1744", "#4a0a10", "#7c0a02"] },
  // Music Bands
  { id: "band-rock-arena", name: "Rock Arena", desc: "Stage light bloom", icon: "🎸", category: "Music Bands", engine: "orbs", colors: ["#ff6a00", "#ff2d2d", "#ffd700", "#ffab00"] },
  { id: "band-synthpop-80s", name: "Synthpop 80s", desc: "Retro neon floor", icon: "🎹", category: "Music Bands", engine: "grid", colors: ["#ff2d95", "#00f0ff", "#b026ff", "#0066ff"] },
  { id: "band-jazz-lounge", name: "Jazz Lounge", desc: "Smoky gold mood", icon: "🎷", category: "Music Bands", engine: "aurora", colors: ["#ffd700", "#7c4dff", "#ffab00", "#3d1560"] },
  { id: "band-metal-inferno", name: "Metal Inferno", desc: "Molten fire orbs", icon: "🤘", category: "Music Bands", engine: "orbs", colors: ["#ff4d00", "#ff1a1a", "#ffd700", "#ff6a00"] },
  { id: "band-indie-pastel", name: "Indie Pastel", desc: "Soft pastel drift", icon: "🎧", category: "Music Bands", engine: "aurora", colors: ["#b388ff", "#69f0ae", "#ffab91", "#b2ebf2"] },
  // Hyper Dimension (3D / 4D / 5D)
  { id: "dim-prism-3d", name: "Prism 3D", desc: "Refracted 3D floor", icon: "🔺", category: "Hyper Dimension", engine: "grid", colors: ["#00f0ff", "#ff2d95", "#f7ff00", "#b026ff"] },
  { id: "dim-hypercube-4d", name: "Hypercube 4D", desc: "Nested cube depth", icon: "🧊", category: "Hyper Dimension", engine: "orbs", colors: ["#b026ff", "#00f0ff", "#ff2d95", "#7c4dff"] },
  { id: "dim-tesseract-5d", name: "Tesseract 5D", desc: "Warping star tunnel", icon: "🌀", category: "Hyper Dimension", engine: "stars", colors: ["#7c4dff", "#00f0ff"], hue: 265 },
  { id: "dim-fractal-4d", name: "Fractal 4D", desc: "Recursive green bloom", icon: "❇️", category: "Hyper Dimension", engine: "aurora", colors: ["#00e676", "#00f0ff", "#39ff14", "#1de9b6"] },
  { id: "dim-quantum-5d", name: "Quantum 5D", desc: "Quantum star field", icon: "⚛️", category: "Hyper Dimension", engine: "stars", colors: ["#ff2d95", "#b026ff"], hue: 322 },
];

export const BG_THEME_CATEGORIES = [...new Set(BG_THEMES.map((t) => t.category))];

function themeVars(t: BgTheme): CSSProperties {
  const [c1, c2 = c1, c3 = c2, c4 = c3] = t.colors;
  return { ["--tc1"]: c1, ["--tc2"]: c2, ["--tc3"]: c3, ["--tc4"]: c4 } as CSSProperties;
}

function themePreviewStyle(t: BgTheme): CSSProperties {
  const [a, b = a, c = b] = t.colors;
  if (t.engine === "grid") return { background: `linear-gradient(180deg, ${b} 0%, #0a0620 72%), #05070f` };
  if (t.engine === "rain") return { background: `linear-gradient(180deg, ${hexToRgba(a, 0.35)} 0%, #030705 82%), #030705` };
  if (t.engine === "stars") return { background: `radial-gradient(1px 1px at 30% 40%, #fff, transparent), radial-gradient(1.5px 1.5px at 68% 62%, ${a}, transparent), radial-gradient(1px 1px at 82% 28%, ${b}, transparent), #04060c` };
  return { background: `radial-gradient(circle at 28% 30%, ${a} 0%, transparent 58%), radial-gradient(circle at 74% 72%, ${b} 0%, transparent 60%), radial-gradient(circle at 55% 48%, ${hexToRgba(c, 0.6)} 0%, transparent 66%), #05070f` };
}

function ThemedScene({ theme }: { theme: BgTheme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (theme.engine === "stars") return runStarfield(c, { hue: theme.hue });
    if (theme.engine === "rain") return runMatrix(c, { color: theme.colors[0] });
  }, [theme]);

  const vars = themeVars(theme);
  if (theme.engine === "aurora") return (
    <div className="tw-aurora" style={vars}>
      <i className="twb twb-a" /><i className="twb twb-b" /><i className="twb twb-c" /><i className="twb twb-d" />
      <div className="bgfx-stars-static" />
    </div>
  );
  if (theme.engine === "orbs") return (
    <div className="tw-orbs" style={vars}>
      <i className="torb to1" /><i className="torb to2" /><i className="torb to3" />
      <i className="torb to4" /><i className="torb to5" /><i className="torb to6" />
      <div className="bgfx-stars-static" />
    </div>
  );
  if (theme.engine === "grid") return (
    <div className="tw-grid" style={vars}>
      <div className="twg-sky" />
      <div className="twg-sun" />
      <div className="twg-floor"><div className="twg-grid" /></div>
      <div className="twg-haze" />
    </div>
  );
  // stars / rain -> canvas
  return <canvas ref={ref} className="bgfx-canvas" />;
}

/* ── main component ─────────────────────────────────────────── */
export function BackgroundFX({ mode, wallpaper }: { mode: BgMode; wallpaper: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = BG_THEMES.find((t) => t.id === mode) || null;
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    if (mode === "starfield") return runStarfield(c);
    if (mode === "matrix") return runMatrix(c);
  }, [mode]);

  return (
    <div className="bgfx" aria-hidden>
      <style>{bgfxCSS}</style>
      {theme && <ThemedScene theme={theme} />}
      {mode === "custom" && wallpaper && (
        <>
          <div className="bgfx-wallpaper" style={{ backgroundImage: `url(${wallpaper})` }} />
          <div className="bgfx-wp-tint" />
        </>
      )}
      {mode === "nebula" && (
        <div className="bgfx-nebula">
          <i className="nb nb-a" /><i className="nb nb-b" /><i className="nb nb-c" /><i className="nb nb-d" />
          <div className="bgfx-stars-static" />
        </div>
      )}
      {mode === "grid3d" && (
        <div className="bgfx-grid3d">
          <div className="g3-sky" />
          <div className="g3-sun" />
          <div className="g3-floor"><div className="g3-grid" /></div>
          <div className="g3-haze" />
        </div>
      )}
      {mode === "orbs" && (
        <div className="bgfx-orbs">
          <i className="orb o1" /><i className="orb o2" /><i className="orb o3" />
          <i className="orb o4" /><i className="orb o5" /><i className="orb o6" />
          <div className="bgfx-stars-static" />
        </div>
      )}
      {(mode === "starfield" || mode === "matrix") && <canvas ref={canvasRef} className="bgfx-canvas" />}
      <div className="bgfx-vignette" />
    </div>
  );
}

/* ── customize modal ────────────────────────────────────────── */
export function BgCustomizeModal({ open, mode, hasWallpaper, onClose, onMode, onWallpaper }: {
  open: boolean; mode: BgMode; hasWallpaper: boolean;
  onClose: () => void; onMode: (m: BgMode) => void; onWallpaper: (dataUrl: string | null) => void;
}) {
  const [url, setUrl] = useState("");
  if (!open) return null;
  const pickFile = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev: any) => { if (ev.target?.result) onWallpaper(ev.target.result as string); };
      reader.readAsDataURL(file);
    };
    input.click();
  };
  return (
    <div className="bgp-overlay" onClick={onClose}>
      <style>{bgfxCSS}</style>
      <div className="bgp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="bgp-head">
          <span className="bgp-title">🎨 Customize background</span>
          <button className="bgp-close" onClick={onClose}>✕</button>
        </div>
        <div className="bgp-sub">Animated scenes render live behind your desktop. Your pick is saved on this device.</div>
        <div className="bgp-grid">
          {MODES.map((m) => (
            <button key={m} className={`bgp-tile ${mode === m ? "bgp-on" : ""}`} onClick={() => onMode(m)}>
              <span className={`bgp-prev bgp-prev-${m}`}>
                {m === "grid3d" && <i className="bgp-prev-grid" />}
                {m === "orbs" && (<><i className="bgp-po bgp-po1" /><i className="bgp-po bgp-po2" /></>)}
                {m === "nebula" && (<><i className="bgp-pn bgp-pn1" /><i className="bgp-pn bgp-pn2" /></>)}
                <b className="bgp-prev-ic">{BG_META[m].icon}</b>
              </span>
              <span className="bgp-name">{BG_META[m].name}</span>
              <span className="bgp-desc">{BG_META[m].desc}</span>
              {mode === m && <span className="bgp-check">✓</span>}
            </button>
          ))}
        </div>
        {BG_THEME_CATEGORIES.map((cat) => (
          <div key={cat} className="bgp-cat-sec">
            <div className="bgp-cat">{cat}</div>
            <div className="bgp-grid">
              {BG_THEMES.filter((t) => t.category === cat).map((t) => (
                <button key={t.id} className={`bgp-tile ${mode === t.id ? "bgp-on" : ""}`} onClick={() => onMode(t.id)}>
                  <span className="bgp-prev" style={themePreviewStyle(t)}>
                    <b className="bgp-prev-ic">{t.icon}</b>
                  </span>
                  <span className="bgp-name">{t.name}</span>
                  <span className="bgp-desc">{t.desc}</span>
                  {mode === t.id && <span className="bgp-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="bgp-wp">
          <div className="bgp-wp-title">Custom image</div>
          <div className="bgp-wp-row">
            <button className="bgp-btn bgp-btn-primary" onClick={pickFile}>⬆ Upload image</button>
            {hasWallpaper && <button className="bgp-btn" onClick={() => onWallpaper(null)}>Remove image</button>}
          </div>
          <div className="bgp-wp-row">
            <input className="bgp-input" placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) { onWallpaper(url.trim()); setUrl(""); } }} />
            <button className="bgp-btn" disabled={!url.trim()} onClick={() => { onWallpaper(url.trim()); setUrl(""); }}>Set</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const bgfxCSS = `
.bgfx{position:absolute;inset:0;overflow:hidden;z-index:0;pointer-events:none;background:#04060c}
.bgfx-canvas{position:absolute;inset:0;width:100%;height:100%}
.bgfx-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 38%,transparent 0%,rgba(2,4,9,.42) 78%,rgba(2,4,9,.78) 100%)}
.bgfx-wallpaper{position:absolute;inset:-24px;background-size:cover;background-position:center;transform:translate(var(--par-x,0),var(--par-y,0)) scale(1.05);transition:transform .3s ease-out;filter:saturate(1.05)}
.bgfx-wp-tint{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,5,10,.42),rgba(3,5,10,.6))}
/* nebula */
.bgfx-nebula{position:absolute;inset:0}
.nb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;will-change:transform}
.nb-a{width:52vw;height:52vw;left:-12vw;top:-16vh;background:#04060c}
.nb-a{background:radial-gradient(circle,#20419a 0%,transparent 65%);animation:nbf 26s ease-in-out infinite alternate}
.nb-b{width:44vw;height:44vw;right:-10vw;top:8vh;background:radial-gradient(circle,#5b21b6 0%,transparent 62%);animation:nbf 32s -8s ease-in-out infinite alternate-reverse}
.nb-c{width:40vw;height:40vw;left:22vw;bottom:-18vh;background:radial-gradient(circle,#0e7490 0%,transparent 62%);animation:nbf 38s -16s ease-in-out infinite alternate}
.nb-d{width:26vw;height:26vw;right:18vw;bottom:6vh;background:radial-gradient(circle,#9945FF 0%,transparent 60%);opacity:.32;animation:nbf 24s -4s ease-in-out infinite alternate-reverse}
@keyframes nbf{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(5vw,-4vh,0) scale(1.12)}100%{transform:translate3d(-4vw,3vh,0) scale(.94)}}
.bgfx-stars-static{position:absolute;inset:0;background-image:radial-gradient(1px 1px at 12% 22%,rgba(255,255,255,.7),transparent),radial-gradient(1px 1px at 68% 12%,rgba(255,255,255,.5),transparent),radial-gradient(1.5px 1.5px at 42% 64%,rgba(255,255,255,.6),transparent),radial-gradient(1px 1px at 84% 48%,rgba(255,255,255,.45),transparent),radial-gradient(1px 1px at 26% 84%,rgba(255,255,255,.5),transparent),radial-gradient(1.5px 1.5px at 92% 78%,rgba(255,255,255,.4),transparent),radial-gradient(1px 1px at 55% 33%,rgba(255,255,255,.35),transparent);animation:stwk 5s ease-in-out infinite alternate}
@keyframes stwk{from{opacity:.55}to{opacity:1}}
/* grid3d */
.bgfx-grid3d{position:absolute;inset:0;perspective:520px;background:linear-gradient(180deg,#050510 0%,#0b0721 46%,#1b0f3a 60%)}
.g3-sky{position:absolute;inset:0 0 46% 0;background:radial-gradient(ellipse at 50% 100%,rgba(123,97,255,.28) 0%,transparent 60%)}
.g3-sun{position:absolute;left:50%;top:30%;width:200px;height:200px;transform:translateX(-50%);border-radius:50%;background:linear-gradient(180deg,#ffd166 0%,#ff5e8a 55%,#7b2ff7 100%);box-shadow:0 0 90px rgba(255,94,138,.55),0 0 200px rgba(123,47,247,.4);-webkit-mask:repeating-linear-gradient(180deg,#000 0 12px,transparent 12px 17px);mask:repeating-linear-gradient(180deg,#000 0 12px,transparent 12px 17px);animation:g3sun 9s ease-in-out infinite alternate}
@keyframes g3sun{from{transform:translateX(-50%) translateY(0)}to{transform:translateX(-50%) translateY(14px)}}
.g3-floor{position:absolute;left:-40%;right:-40%;top:52%;bottom:-4%;transform-style:preserve-3d;transform:rotateX(62deg);overflow:hidden;border-top:1px solid rgba(123,97,255,.6)}
.g3-grid{position:absolute;inset:-100% 0 0 0;background-image:linear-gradient(rgba(123,97,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(123,97,255,.5) 1px,transparent 1px);background-size:56px 56px;animation:g3move 1.6s linear infinite}
@keyframes g3move{from{transform:translateY(0)}to{transform:translateY(56px)}}
.g3-haze{position:absolute;left:0;right:0;top:44%;height:22%;background:linear-gradient(180deg,transparent,rgba(11,7,33,.9) 48%,transparent);filter:blur(6px)}
/* orbs */
.bgfx-orbs{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 20%,#0b1026 0%,#04060c 70%)}
.orb{position:absolute;border-radius:50%;will-change:transform;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.5) 0%,rgba(122,162,255,.55) 18%,rgba(47,80,255,.35) 52%,rgba(10,14,40,.0) 72%);filter:blur(1px) saturate(1.2)}
.o1{width:340px;height:340px;left:6%;top:12%;animation:ofl 16s ease-in-out infinite alternate;transform:translate3d(calc(var(--par-x,0px)*2.4),calc(var(--par-y,0px)*2.4),0)}
.o2{width:190px;height:190px;right:12%;top:20%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.55) 0%,rgba(196,132,255,.5) 20%,rgba(120,40,220,.32) 52%,transparent 72%);animation:ofl 13s -3s ease-in-out infinite alternate-reverse}
.o3{width:120px;height:120px;left:38%;top:56%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.5) 0%,rgba(94,234,212,.45) 20%,rgba(13,148,136,.3) 55%,transparent 72%);animation:ofl 18s -7s ease-in-out infinite alternate}
.o4{width:66px;height:66px;right:30%;bottom:18%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.6) 0%,rgba(253,186,116,.5) 22%,rgba(217,119,6,.3) 55%,transparent 72%);animation:ofl 11s -2s ease-in-out infinite alternate-reverse}
.o5{width:240px;height:240px;right:-4%;bottom:-6%;opacity:.6;animation:ofl 21s -10s ease-in-out infinite alternate}
.o6{width:42px;height:42px;left:20%;bottom:30%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.7) 0%,rgba(244,114,182,.55) 25%,rgba(190,24,93,.3) 58%,transparent 75%);animation:ofl 9s -5s ease-in-out infinite alternate}
@keyframes ofl{0%{transform:translate3d(0,0,0) scale(1)}100%{transform:translate3d(26px,-34px,0) scale(1.08)}}
/* picker modal */
.bgp-overlay{position:fixed;inset:0;z-index:400;background:rgba(2,4,9,.6);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:18px;animation:bgpf .18s ease both}
@keyframes bgpf{from{opacity:0}to{opacity:1}}
.bgp-panel{width:100%;max-width:640px;max-height:88vh;overflow-y:auto;border-radius:22px;background:linear-gradient(180deg,rgba(17,20,30,.98),rgba(9,11,18,.99));border:1px solid rgba(255,255,255,.12);box-shadow:0 40px 120px rgba(0,0,0,.8);padding:18px 18px 20px;animation:bgpu .3s cubic-bezier(.34,1.56,.64,1) both}
@keyframes bgpu{from{transform:translateY(26px) scale(.97);opacity:0}to{transform:none;opacity:1}}
.bgp-head{display:flex;align-items:center;justify-content:space-between}
.bgp-title{font-size:16px;font-weight:900;color:#fff;letter-spacing:-.01em}
.bgp-close{width:28px;height:28px;border-radius:99px;background:rgba(255,255,255,.1);border:0;color:rgba(255,255,255,.6);cursor:pointer;font-size:11px}
.bgp-close:hover{background:rgba(255,255,255,.2);color:#fff}
.bgp-sub{font-size:11.5px;color:rgba(255,255,255,.42);margin:6px 0 14px;line-height:1.5}
.bgp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.bgp-tile{position:relative;display:flex;flex-direction:column;gap:3px;padding:10px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;text-align:left;font-family:inherit;transition:all .18s}
.bgp-tile:hover{border-color:rgba(90,162,255,.4);background:rgba(47,128,255,.07);transform:translateY(-2px)}
.bgp-on{border-color:#2F80FF!important;background:rgba(47,128,255,.12)!important;box-shadow:0 0 0 1px #2F80FF,0 8px 26px rgba(47,128,255,.25)}
.bgp-prev{position:relative;height:64px;border-radius:11px;overflow:hidden;display:grid;place-items:center;margin-bottom:5px;background:#05070f;border:1px solid rgba(255,255,255,.06)}
.bgp-prev-ic{font-size:20px;z-index:2;filter:drop-shadow(0 2px 8px rgba(0,0,0,.8))}
.bgp-prev-nebula{background:#070a18}
.bgp-pn{position:absolute;border-radius:50%;filter:blur(14px)}
.bgp-pn1{width:70px;height:70px;left:-12px;top:-16px;background:#20419a}
.bgp-pn2{width:60px;height:60px;right:-10px;bottom:-18px;background:#5b21b6}
.bgp-prev-starfield{background:radial-gradient(1px 1px at 20% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 20%,#fff,transparent),radial-gradient(1.5px 1.5px at 45% 65%,#fff,transparent),radial-gradient(1px 1px at 85% 55%,#9cf,transparent),radial-gradient(1px 1px at 30% 80%,#fff,transparent),#04060c}
.bgp-prev-grid3d{background:linear-gradient(180deg,#0b0721 0%,#1b0f3a 100%)}
.bgp-prev-grid{position:absolute;left:-30%;right:-30%;bottom:-40%;top:45%;transform:rotateX(58deg);background-image:linear-gradient(rgba(123,97,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(123,97,255,.6) 1px,transparent 1px);background-size:14px 14px;perspective:200px}
.bgp-prev-orbs{background:radial-gradient(ellipse at 50% 20%,#0b1026 0%,#04060c 75%)}
.bgp-po{position:absolute;border-radius:50%}
.bgp-po1{width:34px;height:34px;left:14px;top:12px;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.6),rgba(122,162,255,.5) 30%,transparent 70%)}
.bgp-po2{width:20px;height:20px;right:20px;bottom:10px;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.6),rgba(196,132,255,.5) 30%,transparent 70%)}
.bgp-prev-matrix{background:linear-gradient(180deg,rgba(52,211,153,.25) 0%,rgba(3,7,5,.9) 80%),#030705}
.bgp-prev-custom{background:linear-gradient(135deg,#1f2937,#0b1220)}
.bgp-prev-minimal{background:#05060a}
.bgp-name{font-size:12.5px;font-weight:800;color:#fff}
.bgp-desc{font-size:10px;color:rgba(255,255,255,.4);font-weight:600}
.bgp-check{position:absolute;top:8px;right:8px;width:20px;height:20px;border-radius:99px;background:#2F80FF;color:#fff;font-size:11px;font-weight:900;display:grid;place-items:center;box-shadow:0 2px 10px rgba(47,128,255,.6)}
.bgp-wp{margin-top:16px;border-top:1px solid rgba(255,255,255,.08);padding-top:13px}
.bgp-wp-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.45);margin-bottom:9px}
.bgp-wp-row{display:flex;gap:8px;margin-bottom:8px}
.bgp-btn{padding:9px 14px;border-radius:11px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s}
.bgp-btn:hover{background:rgba(255,255,255,.1)}
.bgp-btn:disabled{opacity:.4;cursor:default}
.bgp-btn-primary{background:linear-gradient(135deg,#2F80FF,#1a5cd4);border-color:transparent}
.bgp-btn-primary:hover{filter:brightness(1.15)}
.bgp-input{flex:1;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(255,255,255,.05);color:#fff;padding:9px 12px;font-size:12px;outline:0;font-family:inherit}
.bgp-input:focus{border-color:rgba(47,128,255,.5)}
/* themed scenes */
.tw-aurora{position:absolute;inset:0;background:#04060c}
.twb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;will-change:transform}
.twb-a{width:52vw;height:52vw;left:-12vw;top:-16vh;background:radial-gradient(circle,var(--tc1) 0%,transparent 65%);animation:nbf 26s ease-in-out infinite alternate}
.twb-b{width:44vw;height:44vw;right:-10vw;top:8vh;background:radial-gradient(circle,var(--tc2) 0%,transparent 62%);animation:nbf 32s -8s ease-in-out infinite alternate-reverse}
.twb-c{width:40vw;height:40vw;left:22vw;bottom:-18vh;background:radial-gradient(circle,var(--tc3) 0%,transparent 62%);animation:nbf 38s -16s ease-in-out infinite alternate}
.twb-d{width:26vw;height:26vw;right:18vw;bottom:6vh;background:radial-gradient(circle,var(--tc4) 0%,transparent 60%);opacity:.34;animation:nbf 24s -4s ease-in-out infinite alternate-reverse}
.tw-orbs{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 20%,#0b1026 0%,#04060c 70%)}
.torb{position:absolute;border-radius:50%;will-change:transform;filter:blur(1px) saturate(1.25)}
.to1{width:340px;height:340px;left:6%;top:12%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.5) 0%,var(--tc1) 30%,transparent 72%);animation:ofl 16s ease-in-out infinite alternate}
.to2{width:190px;height:190px;right:12%;top:20%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.55) 0%,var(--tc2) 30%,transparent 72%);animation:ofl 13s -3s ease-in-out infinite alternate-reverse}
.to3{width:120px;height:120px;left:38%;top:56%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.5) 0%,var(--tc3) 30%,transparent 72%);animation:ofl 18s -7s ease-in-out infinite alternate}
.to4{width:66px;height:66px;right:30%;bottom:18%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.6) 0%,var(--tc4) 30%,transparent 72%);animation:ofl 11s -2s ease-in-out infinite alternate-reverse}
.to5{width:240px;height:240px;right:-4%;bottom:-6%;opacity:.6;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.4) 0%,var(--tc1) 30%,transparent 72%);animation:ofl 21s -10s ease-in-out infinite alternate}
.to6{width:42px;height:42px;left:20%;bottom:30%;background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.7) 0%,var(--tc2) 30%,transparent 75%);animation:ofl 9s -5s ease-in-out infinite alternate}
.tw-grid{position:absolute;inset:0;perspective:520px;background:linear-gradient(180deg,#050510 0%,#0b0721 46%,#160a30 60%)}
.twg-sky{position:absolute;inset:0 0 46% 0;background:radial-gradient(ellipse at 50% 100%,var(--tc1) 0%,transparent 62%);opacity:.42}
.twg-sun{position:absolute;left:50%;top:30%;width:200px;height:200px;transform:translateX(-50%);border-radius:50%;background:linear-gradient(180deg,var(--tc2) 0%,var(--tc3) 55%,var(--tc4) 100%);box-shadow:0 0 90px var(--tc3);-webkit-mask:repeating-linear-gradient(180deg,#000 0 12px,transparent 12px 17px);mask:repeating-linear-gradient(180deg,#000 0 12px,transparent 12px 17px);animation:g3sun 9s ease-in-out infinite alternate}
.twg-floor{position:absolute;left:-40%;right:-40%;top:52%;bottom:-4%;transform-style:preserve-3d;transform:rotateX(62deg);overflow:hidden;border-top:1px solid var(--tc1)}
.twg-grid{position:absolute;inset:-100% 0 0 0;background-image:linear-gradient(var(--tc1) 1px,transparent 1px),linear-gradient(90deg,var(--tc1) 1px,transparent 1px);background-size:56px 56px;animation:g3move 1.6s linear infinite;opacity:.7}
.twg-haze{position:absolute;left:0;right:0;top:44%;height:22%;background:linear-gradient(180deg,transparent,rgba(11,7,33,.9) 48%,transparent);filter:blur(6px)}
.bgp-cat-sec{margin-top:2px}
.bgp-cat{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.5);margin:16px 0 8px}
`;
