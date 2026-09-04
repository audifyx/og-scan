import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { canUseWebGL, prefersReducedMotion } from "./hubSpaceQuality";

const HubSpaceCanvas = lazy(() => import("./HubSpaceCanvas"));

function SpaceFallback() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = prefersReducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let alive = true;
    let w = 0;
    let h = 0;
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      s: 0.4 + Math.random() * 1.6,
    }));

    const resize = () => {
      w = canvas.clientWidth * dpr;
      h = canvas.clientHeight * dpr;
      canvas.width = w;
      canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      if (!alive) return;
      const g = ctx.createRadialGradient(w * 0.62, h * 0.58, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      g.addColorStop(0, "#12324a");
      g.addColorStop(0.35, "#08101c");
      g.addColorStop(1, "#02040a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const nebula = ctx.createRadialGradient(w * 0.22, h * 0.18, 0, w * 0.22, h * 0.18, w * 0.45);
      nebula.addColorStop(0, "rgba(192, 132, 252, 0.28)");
      nebula.addColorStop(1, "rgba(192, 132, 252, 0)");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      const cyan = ctx.createRadialGradient(w * 0.78, h * 0.72, 0, w * 0.78, h * 0.72, w * 0.4);
      cyan.addColorStop(0, "rgba(45, 212, 191, 0.22)");
      cyan.addColorStop(1, "rgba(45, 212, 191, 0)");
      ctx.fillStyle = cyan;
      ctx.fillRect(0, 0, w, h);

      const planetX = w * 0.68;
      const planetY = h * 0.62;
      const pr = Math.min(w, h) * 0.18;
      const pg = ctx.createRadialGradient(planetX - pr * 0.3, planetY - pr * 0.35, pr * 0.1, planetX, planetY, pr);
      pg.addColorStop(0, "#3aa0c4");
      pg.addColorStop(0.45, "#14506a");
      pg.addColorStop(1, "#061018");
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(planetX, planetY, pr, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(186, 214, 255, 0.28)";
      ctx.lineWidth = Math.max(2, pr * 0.06);
      ctx.beginPath();
      ctx.ellipse(planetX, planetY, pr * 1.7, pr * 0.38, -0.35, 0, Math.PI * 2);
      ctx.stroke();

      for (const star of stars) {
        const tw = reduced ? 0.7 : 0.45 + Math.sin(t * 0.001 + star.z * 12) * 0.35;
        ctx.fillStyle = `rgba(235, 245, 255, ${tw})`;
        ctx.fillRect(star.x * w, star.y * h, star.s * dpr, star.s * dpr);
      }

      if (!reduced && !document.hidden) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="ox-deck__space-fallback" aria-hidden />;
}

class SpaceErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <SpaceFallback />;
    return this.props.children;
  }
}

export function HubSpaceBackground() {
  const [ready, setReady] = useState(false);
  const [webgl, setWebgl] = useState(true);

  useEffect(() => {
    setWebgl(canUseWebGL());
    setReady(true);
  }, []);

  if (!ready) return <div className="ox-deck__space-placeholder" aria-hidden />;
  if (!webgl) return <SpaceFallback />;

  return (
    <SpaceErrorBoundary>
      <Suspense fallback={<SpaceFallback />}>
        <HubSpaceCanvas />
      </Suspense>
    </SpaceErrorBoundary>
  );
}
