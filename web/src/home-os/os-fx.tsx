import { useEffect, useRef, useState } from "react";
import { useTheme } from "./os-theme-provider";
import type { DeviceThemeId } from "./theme-registry";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: string;
  alpha: number;
  char?: string;
  rot?: number;
  vr?: number;
}

interface FxConfig {
  count: number;
  colors: string[];
  kind: "dust" | "rise" | "orbs" | "bubbles" | "confetti" | "matrix" | "rain" | "pixels" | "none";
  maxAlpha: number;
}

const FX: Record<DeviceThemeId, FxConfig> = {
  orbitx:    { count: 26, colors: ["#d6ff3d", "#ffffff"], kind: "dust", maxAlpha: 0.5 },
  xbox360:   { count: 30, colors: ["#7ac142", "#a4d65e"], kind: "rise", maxAlpha: 0.55 },
  ps4:       { count: 26, colors: ["#2d7ff9", "#5aa2ff"], kind: "orbs", maxAlpha: 0.5 },
  wii:       { count: 30, colors: ["#2aa9e0", "#7cc7ec", "#ffd166", "#ff9ecf"], kind: "bubbles", maxAlpha: 0.55 },
  tds:       { count: 28, colors: ["#ff7a59", "#ffd166", "#5aa2ff"], kind: "confetti", maxAlpha: 0.6 },
  gameboy:   { count: 0, colors: [], kind: "none", maxAlpha: 0 },
  winpc:     { count: 0, colors: [], kind: "none", maxAlpha: 0 },
  ios:       { count: 0, colors: [], kind: "none", maxAlpha: 0 },
  macos:     { count: 0, colors: [], kind: "none", maxAlpha: 0 },
  linux:     { count: 42, colors: ["#33ff66"], kind: "matrix", maxAlpha: 0.5 },
  cyberpunk: { count: 50, colors: ["#ff2a6d", "#05d9e8"], kind: "rain", maxAlpha: 0.55 },
  midnight:  { count: 0, colors: [], kind: "none", maxAlpha: 0 },
  arcade:    { count: 36, colors: ["#ffe74c", "#ff5da2", "#05d9e8"], kind: "pixels", maxAlpha: 0.6 },
};

const MATRIX_CHARS = "アイウエオカキクケコサシスセソ0123456789$#";

function spawn(cfg: FxConfig, w: number, h: number): Particle {
  const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
  const base: Particle = {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: 0, vy: 0,
    size: 1 + Math.random() * 2.5,
    color,
    alpha: 0.25 + Math.random() * (cfg.maxAlpha - 0.25),
  };
  switch (cfg.kind) {
    case "dust":
      base.vx = (Math.random() - 0.5) * 0.25;
      base.vy = (Math.random() - 0.5) * 0.25;
      break;
    case "rise":
      base.vx = (Math.random() - 0.5) * 0.2;
      base.vy = -(0.2 + Math.random() * 0.5);
      base.y = h + 10;
      break;
    case "orbs":
      base.vx = (Math.random() - 0.5) * 0.3;
      base.vy = (Math.random() - 0.5) * 0.3;
      base.size = 2 + Math.random() * 5;
      break;
    case "bubbles":
      base.vx = (Math.random() - 0.5) * 0.3;
      base.vy = -(0.3 + Math.random() * 0.6);
      base.size = 2 + Math.random() * 6;
      base.y = h + 10;
      break;
    case "confetti":
      base.vx = (Math.random() - 0.5) * 1.2;
      base.vy = 0.5 + Math.random() * 1.4;
      base.size = 3 + Math.random() * 5;
      base.rot = Math.random() * Math.PI;
      base.vr = (Math.random() - 0.5) * 0.1;
      base.y = -10;
      break;
    case "matrix":
      base.vx = 0;
      base.vy = 1 + Math.random() * 2.5;
      base.size = 12 + Math.random() * 6;
      base.char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
      base.y = Math.random() * -h;
      break;
    case "rain":
      base.vx = -0.6;
      base.vy = 3 + Math.random() * 4;
      base.size = 8 + Math.random() * 14;
      base.y = -20;
      break;
    case "pixels":
      base.vx = (Math.random() - 0.5) * 0.6;
      base.vy = (Math.random() - 0.5) * 0.6;
      base.size = 3 + Math.random() * 4;
      break;
  }
  return base;
}

function OsParticles({ device }: { device: DeviceThemeId }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cfg = FX[device];
    const canvas = ref.current;
    if (!canvas || cfg.kind === "none" || cfg.count === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const parts: Particle[] = Array.from({ length: cfg.count }, () => spawn(cfg, w, h));
    let running = true;
    const onVis = () => { running = !document.hidden; };

    document.addEventListener("visibilitychange", onVis);

    const tick = () => {
      if (!running) { raf = requestAnimationFrame(tick); return; }
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.rot !== undefined && p.vr !== undefined) p.rot += p.vr;
        // recycle
        if (p.y > h + 24 || p.y < -24 || p.x > w + 24 || p.x < -24) {
          parts[i] = spawn(cfg, w, h);
          continue;
        }
        ctx.globalAlpha = p.alpha;
        if (cfg.kind === "matrix" && p.char) {
          ctx.fillStyle = p.color;
          ctx.font = `${p.size}px monospace`;
          ctx.fillText(p.char, p.x, p.y);
          if (Math.random() < 0.02) p.char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        } else if (cfg.kind === "rain") {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 4, p.y - p.size);
          ctx.stroke();
        } else if (cfg.kind === "confetti" || cfg.kind === "pixels") {
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot ?? 0);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        } else if (cfg.kind === "bubbles" || cfg.kind === "orbs") {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [device]);

  const cfg = FX[device];
  if (cfg.kind === "none") return null;
  return <canvas ref={ref} className="os-particles" aria-hidden />;
}

const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

export function OsFx() {
  const { theme, setDevice } = useTheme();
  const [toast, setToast] = useState<string | null>(null);
  const seq = useRef<string[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showToast = (msg: string) => {
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2600);
    };

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      seq.current = [...seq.current, e.key].slice(-KONAMI.length);
      if (seq.current.join(",") === KONAMI.join(",")) {
        seq.current = [];
        setDevice("arcade");
        showToast("INSERT COIN · 1UP");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [setDevice]);

  return (
    <>
      <OsParticles device={theme.device} />
      <div className="os-toast" data-show={toast !== null} role="status" aria-live="polite">
        {toast ?? ""}
      </div>
    </>
  );
}
