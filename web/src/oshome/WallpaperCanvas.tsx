import { useEffect, useRef } from "react";
import { getAnimatedWallpaper, sceneFor, type WallpaperScene } from "../themes/wallpapers";

/**
 * WallpaperCanvas — renders the active animated wallpaper (idea 9)
 * on a full-bleed canvas inside .osh-wallpaper. Listens for
 * orbitx:awallpaper changes. Capped DPR, pauses when tab hidden,
 * honors prefers-reduced-motion.
 */

function rand(a: number, b: number) {
  return a + Math.random() * (b - a);
}

interface Star { x: number; y: number; z: number; r: number }
interface Drop { x: number; y: number; speed: number; len: number; char: string }
interface Blob { x: number; y: number; r: number; hue: number; vx: number; vy: number }
interface Bldg { x: number; w: number; h: number; hue: number; seed: number }

const GLYPHS = "01$Ξλ◉+*";

export default function WallpaperCanvas({ forceScene }: { forceScene?: WallpaperScene }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let scene: WallpaperScene = forceScene ?? sceneFor(getAnimatedWallpaper());
    let stars: Star[] = [];
    let drops: Drop[] = [];
    let blobs: Blob[] = [];
    let bldgs: Bldg[] = [];
    let W = 0;
    let H = 0;

    const resize = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      W = Math.max(1, Math.floor(rect.width * dpr));
      H = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = W;
      canvas.height = H;
      seed();
    };

    const seed = () => {
      stars = Array.from({ length: 140 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        z: rand(0.2, 1), r: rand(0.5, 1.8),
      }));
      drops = Array.from({ length: 46 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        speed: rand(2, 7), len: rand(8, 26),
        char: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      }));
      blobs = Array.from({ length: 7 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: rand(W * 0.15, W * 0.4), hue: rand(90, 320),
        vx: rand(-0.25, 0.25), vy: rand(-0.2, 0.2),
      }));
      bldgs = [];
      let x = 0;
      while (x < W) {
        const w = rand(30, 90);
        bldgs.push({ x, w, h: rand(H * 0.15, H * 0.55), hue: rand(80, 200), seed: Math.random() * 10 });
        x += w + rand(4, 18);
      }
    };

    const accent = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--dt-accent").trim() || "#17ff4d";

    let t = 0;
    const frame = () => {
      t += 0.016;
      g.clearRect(0, 0, W, H);
      if (scene === "starfield") {
        for (const s of stars) {
          s.x -= s.z * 1.4;
          if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
          g.globalAlpha = 0.25 + s.z * 0.65;
          g.fillStyle = "#cfe8ff";
          g.beginPath();
          g.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      } else if (scene === "matrix") {
        g.font = `${Math.max(12, W / 90)}px monospace`;
        const col = accent();
        for (const d of drops) {
          d.y += d.speed;
          if (d.y - d.len > H) { d.y = -20; d.x = Math.random() * W; }
          const grad = g.createLinearGradient(0, d.y - d.len, 0, d.y);
          grad.addColorStop(0, "transparent");
          grad.addColorStop(1, col);
          g.globalAlpha = 0.75;
          g.fillStyle = grad;
          g.fillText(d.char, d.x, d.y);
        }
        g.globalAlpha = 1;
      } else if (scene === "aurora") {
        for (const b of blobs) {
          b.x += b.vx; b.y += b.vy;
          if (b.x < -b.r) b.x = W + b.r; if (b.x > W + b.r) b.x = -b.r;
          if (b.y < -b.r) b.y = H + b.r; if (b.y > H + b.r) b.y = -b.r;
          const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
          grad.addColorStop(0, `hsla(${b.hue}, 90%, 55%, 0.16)`);
          grad.addColorStop(1, "transparent");
          g.fillStyle = grad;
          g.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        }
      } else if (scene === "nebula") {
        const a = accent();
        for (const b of blobs) {
          const breathe = 1 + Math.sin(t * 0.7 + b.hue) * 0.12;
          const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * breathe);
          grad.addColorStop(0, a + "22");
          grad.addColorStop(1, "transparent");
          g.fillStyle = grad;
          g.fillRect(b.x - b.r * breathe, b.y - b.r * breathe, b.r * breathe * 2, b.r * breathe * 2);
        }
      } else {
        // cityflyover — drifting neon skyline silhouette
        const horizon = H * 0.72;
        const off = (t * 24) % (W * 0.5);
        for (const b of bldgs) {
          const bx = ((b.x - off) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25;
          g.fillStyle = "rgba(4,8,14,0.92)";
          g.fillRect(bx, horizon - b.h, b.w, b.h);
          g.fillStyle = `hsla(${b.hue}, 95%, 60%, 0.85)`;
          for (let wy = horizon - b.h + 8; wy < horizon - 8; wy += 14) {
            for (let wx = bx + 5; wx < bx + b.w - 5; wx += 12) {
              if (((wx * 7 + wy * 13 + b.seed * 91) | 0) % 3 === 0) g.fillRect(wx, wy, 4, 6);
            }
          }
        }
        g.fillStyle = "rgba(2,4,10,0.9)";
        g.fillRect(0, horizon, W, H - horizon);
        g.strokeStyle = accent();
        g.globalAlpha = 0.5;
        g.beginPath(); g.moveTo(0, horizon); g.lineTo(W, horizon); g.stroke();
        g.globalAlpha = 1;
      }
      raf = requestAnimationFrame(frame);
    };

    const onChange = () => {
      scene = forceScene ?? sceneFor(getAnimatedWallpaper());
      document.documentElement.dataset.awallpaper = getAnimatedWallpaper();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("orbitx:awallpaper", onChange);
    document.documentElement.dataset.awallpaper = getAnimatedWallpaper();
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orbitx:awallpaper", onChange);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [forceScene]);

  return <canvas ref={ref} className="osh-aw-canvas" aria-hidden />;
}
