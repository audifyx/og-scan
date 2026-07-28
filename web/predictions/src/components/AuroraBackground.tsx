'use client';
import { useEffect, useRef } from 'react';

/**
 * OrbitX animated background.
 * Layers (back -> front):
 *  1. deep radial base
 *  2. three drifting gradient "aurora" orbs (CSS keyframes, GPU transforms)
 *  3. a 3D perspective grid floor that slowly pans toward the viewer
 *  4. a lightweight canvas starfield/particle drift (delta-time, rAF)
 *  5. fine film grain + vignette
 * Fully fixed, pointer-events:none, behind all content. Reduced-motion aware,
 * and the canvas pauses when the tab is hidden to save battery.
 */
export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let last = performance.now();
    let running = true;

    type P = { x: number; y: number; z: number; r: number; vx: number; vy: number; tw: number };
    let parts: P[] = [];

    const COLORS = ['rgba(61,139,255,', 'rgba(168,85,247,', 'rgba(34,197,94,', 'rgba(255,255,255,'];

    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(120, Math.floor((w * h) / 14000));
      parts = Array.from({ length: count }, () => {
        const z = Math.random() * 0.9 + 0.1;
        return {
          x: Math.random() * w, y: Math.random() * h, z,
          r: z * 1.8 + 0.3,
          vx: (Math.random() - 0.5) * 6 * z,
          vy: (Math.random() - 0.5) * 6 * z,
          tw: Math.random() * Math.PI * 2,
        };
      });
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.tw += dt * 2;
        if (p.x < -5) p.x = w + 5; if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5; if (p.y > h + 5) p.y = -5;
        const a = (0.35 + Math.sin(p.tw) * 0.3) * p.z;
        const c = COLORS[(Math.floor(p.x + p.y)) % COLORS.length];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = c + a.toFixed(3) + ')';
        ctx.fill();
      }
      // occasional connecting lines for depth
      ctx.lineWidth = 0.5;
      for (let i = 0; i < parts.length; i += 3) {
        const a = parts[i], b = parts[(i + 7) % parts.length];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 16000) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(61,139,255,${(0.10 * (1 - d2 / 16000)).toFixed(3)})`;
          ctx.stroke();
        }
      }
      if (running) raf = requestAnimationFrame(draw);
    };

    if (!reduce) {
      raf = requestAnimationFrame(draw);
    } else {
      // single static frame
      draw(performance.now());
    }

    const onVis = () => {
      running = !document.hidden;
      if (running && !reduce) { last = performance.now(); raf = requestAnimationFrame(draw); }
      else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* base */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(125% 90% at 50% -10%, #1a2236 0%, #131826 45%, #0e1320 100%)' }} />

      {/* aurora orbs */}
      <div className="absolute -top-40 -left-32 h-[46rem] w-[46rem] rounded-full blur-[120px] opacity-[0.18]"
           style={{ background: 'radial-gradient(circle, rgba(124,108,255,.55), transparent 62%)', animation: 'auroraDrift 26s ease-in-out infinite' }} />
      <div className="absolute top-1/4 -right-40 h-[42rem] w-[42rem] rounded-full blur-[130px] opacity-[0.15]"
           style={{ background: 'radial-gradient(circle, rgba(61,139,255,.50), transparent 62%)', animation: 'auroraDrift 32s ease-in-out infinite reverse' }} />
      <div className="absolute bottom-[-18rem] left-1/3 h-[40rem] w-[40rem] rounded-full blur-[140px] opacity-[0.13]"
           style={{ background: 'radial-gradient(circle, rgba(99,102,241,.45), transparent 64%)', animation: 'auroraDrift 38s ease-in-out infinite' }} />

      {/* 3D perspective grid floor */}
      <div className="absolute inset-x-0 bottom-0 h-[55%] [perspective:600px]">
        <div className="absolute inset-0 origin-bottom bg-grid opacity-[0.06]"
             style={{ transform: 'rotateX(72deg) scale(1.8)', transformOrigin: 'bottom center', animation: 'gridPan 5s linear infinite', maskImage: 'linear-gradient(to top, black, transparent 78%)', WebkitMaskImage: 'linear-gradient(to top, black, transparent 78%)' }} />
      </div>

      {/* particle canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-50" />

      {/* grain + vignette */}
      <div className="absolute inset-0 opacity-[0.13] mix-blend-soft-light"
           style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 30%, transparent 55%, rgba(5,8,16,.7) 100%)' }} />
    </div>
  );
}
