'use client';
import { useEffect, useRef } from 'react';

// Lightweight 3D-feel animated background: a depth particle field flying
// toward the viewer + parallax gradient orbs + a perspective grid floor.
export function SplashBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0, cx = 0, cy = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const N = 110;
    type P = { x: number; y: number; z: number };
    const pts: P[] = [];
    const reset = (p: P) => { p.x = (Math.random() - 0.5) * 2; p.y = (Math.random() - 0.5) * 2; p.z = Math.random(); };
    for (let i = 0; i < N; i++) { const p = { x: 0, y: 0, z: 0 }; reset(p); pts.push(p); }

    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight; cx = w / 2; cy = h / 2;
      canvas.width = w * DPR; canvas.height = h * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.z -= 0.0035;
        if (p.z <= 0.02) reset(p), (p.z = 1);
        const k = 0.9 / p.z;
        const sx = cx + p.x * k * cx;
        const sy = cy + p.y * k * cy;
        if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
        const r = Math.max(0.4, (1 - p.z) * 3.2);
        const a = Math.min(0.7, (1 - p.z) * 0.9);
        const cyanish = (p.x + p.y) > 0;
        ctx.beginPath();
        ctx.fillStyle = cyanish ? `rgba(61,139,255,${a})` : `rgba(168,85,247,${a})`;
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      {/* gradient orbs */}
      <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] rounded-full bg-cyan/20 blur-[120px] animate-pulse-slow" />
      <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full bg-purple/20 blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-0 left-1/3 w-[28rem] h-[28rem] rounded-full bg-win/10 blur-[120px]" />
      {/* particle field */}
      <canvas ref={ref} className="absolute inset-0 w-full h-full" />
      {/* perspective grid floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[45vh] opacity-30"
        style={{
          backgroundImage: 'linear-gradient(rgba(61,139,255,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(61,139,255,.25) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          transform: 'perspective(420px) rotateX(62deg)',
          transformOrigin: 'bottom',
          maskImage: 'linear-gradient(to top, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to top, black, transparent)',
        }}
      />
    </div>
  );
}
