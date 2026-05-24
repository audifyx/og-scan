/**
 * OGBanner3D — Interactive 3D-style banners for use across the app.
 * Uses CSS transforms + mouse tracking for a parallax tilt effect.
 * Several variants for different sections.
 */

import { useRef, useState, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── Tilt wrapper ─────────────────────────────────────────────────────────────

interface TiltProps {
  children: ReactNode;
  className?: string;
  intensity?: number; // how many degrees max tilt (default 8)
  glareOpacity?: number; // 0–1 (default 0.12)
}

const Tilt3D = ({ children, className, intensity = 8, glareOpacity = 0.12 }: TiltProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setStyle({
        rotateX: (0.5 - y) * intensity * 2,
        rotateY: (x - 0.5) * intensity * 2,
        glareX: x * 100,
        glareY: y * 100,
      });
    },
    [intensity],
  );

  const onLeave = useCallback(() => {
    setStyle({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  }, []);

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden rounded-2xl transition-transform duration-200 ease-out", className)}
      style={{
        perspective: "1000px",
        transformStyle: "preserve-3d",
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div
        className="w-full h-full"
        style={{
          transform: `rotateX(${style.rotateX}deg) rotateY(${style.rotateY}deg)`,
          transition: "transform 200ms ease-out",
          transformStyle: "preserve-3d",
        }}
      >
        {children}
        {/* Glare overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: `radial-gradient(circle at ${style.glareX}% ${style.glareY}%, rgba(255,255,255,${glareOpacity}), transparent 60%)`,
          }}
        />
      </div>
    </div>
  );
};

// ─── Banner Variants ──────────────────────────────────────────────────────────

export const OGBannerHero = () => (
  <Tilt3D className="mx-4 lg:mx-6 mb-6" intensity={6}>
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08]">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#060c13] via-[#0d1b2a] to-[#060c13]" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(34,211,238,0.05)_50%,transparent_75%)] bg-[length:300%_300%] animate-[shimmer_8s_ease-in-out_infinite]" />
      </div>
      {/* Scanline overlay */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(34,211,238,0.03)_2px,rgba(34,211,238,0.03)_4px)] pointer-events-none" />
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Floating orbs */}
      <div className="absolute top-[-20%] right-[-10%] w-[300px] h-[300px] rounded-full bg-[#22d3ee]/8 blur-[80px] animate-pulse" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[250px] h-[250px] rounded-full bg-[#a855f7]/8 blur-[80px] animate-pulse" style={{ animationDelay: "1s" }} />
      <div className="absolute top-[30%] left-[40%] w-[150px] h-[150px] rounded-full bg-[#22d3ee]/5 blur-[60px] animate-pulse" style={{ animationDelay: "2s" }} />

      <div className="relative px-6 py-8 sm:px-8 sm:py-10 flex flex-col sm:flex-row items-center gap-6" style={{ transform: "translateZ(30px)" }}>
        {/* Logo */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#22d3ee] to-[#a855f7] blur-2xl opacity-40 animate-pulse" />
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#0d1b2a] to-[#060c13] border border-[#22d3ee]/30 flex items-center justify-center shadow-2xl shadow-[#22d3ee]/20">
            <span className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-[#22d3ee] via-white to-[#a855f7] bg-clip-text text-transparent tracking-tighter">
              OG
            </span>
          </div>
        </div>
        {/* Text */}
        <div className="text-center sm:text-left flex-1">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">
            OG SCAN
          </h2>
          <p className="text-sm text-[#22d3ee]/70 font-semibold tracking-widest uppercase mb-3">
            Originals Only · On-Chain Forensics
          </p>
          <p className="text-xs text-white/40 max-w-md leading-relaxed">
            Find the true OG token before the market does. Forensic blockchain intelligence for Solana.
          </p>
        </div>
        {/* Live badge */}
        <div className="shrink-0 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-[#22d3ee]/25 bg-[#22d3ee]/10 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-[#22d3ee] shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <span className="text-xs font-bold text-[#22d3ee] tracking-wider">LIVE</span>
          </div>
          <span className="text-[10px] text-white/25 font-mono">v2.0</span>
        </div>
      </div>

      {/* Bottom glow line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#22d3ee]/40 to-transparent" />
    </div>
  </Tilt3D>
);

export const OGBannerPromo = ({ title, subtitle, accent = "cyan" }: { title: string; subtitle: string; accent?: "cyan" | "purple" | "gold" | "lime" }) => {
  const colors = {
    cyan: { glow: "#22d3ee", from: "from-[#22d3ee]/15", via: "via-[#22d3ee]/5" },
    purple: { glow: "#a855f7", from: "from-[#a855f7]/15", via: "via-[#a855f7]/5" },
    gold: { glow: "#eab308", from: "from-[#eab308]/15", via: "via-[#eab308]/5" },
    lime: { glow: "#84cc16", from: "from-[#84cc16]/15", via: "via-[#84cc16]/5" },
  };
  const c = colors[accent];

  return (
    <Tilt3D className="mb-4" intensity={5}>
      <div className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-r ${c.from} ${c.via} to-transparent`}>
        {/* Scanlines */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(255,255,255,0.015)_3px,rgba(255,255,255,0.015)_6px)] pointer-events-none" />
        {/* Glow */}
        <div className="absolute right-0 top-0 w-[200px] h-[200px] rounded-full blur-[80px] opacity-20" style={{ backgroundColor: c.glow }} />
        
        <div className="relative px-5 py-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border border-white/10" style={{ backgroundColor: `${c.glow}15` }}>
            <span className="text-lg font-black" style={{ color: c.glow }}>⚡</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white text-sm truncate">{title}</p>
            <p className="text-[11px] text-white/40 truncate">{subtitle}</p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent to-transparent" style={{ backgroundImage: `linear-gradient(to right, transparent, ${c.glow}40, transparent)` }} />
      </div>
    </Tilt3D>
  );
};

export const OGBannerCTA = ({ text, buttonText, onClick }: { text: string; buttonText: string; onClick?: () => void }) => (
  <Tilt3D className="mx-4 lg:mx-6 my-4" intensity={7}>
    <div className="relative overflow-hidden rounded-2xl border border-[#a855f7]/20 bg-gradient-to-br from-[#a855f7]/10 via-[#060c13] to-[#22d3ee]/10">
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(168,85,247,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,0.04)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />
      {/* Scanlines */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(168,85,247,0.02)_2px,rgba(168,85,247,0.02)_4px)] pointer-events-none" />
      
      <div className="relative px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm font-semibold text-white/80 text-center sm:text-left">{text}</p>
        <button
          onClick={onClick}
          className="shrink-0 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#22d3ee] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#a855f7]/20 transition hover:shadow-[#a855f7]/40 hover:scale-105 active:scale-95"
        >
          {buttonText}
        </button>
      </div>
    </div>
  </Tilt3D>
);

export const OGBannerStats = () => (
  <Tilt3D className="mx-4 lg:mx-6 mb-6" intensity={4} glareOpacity={0.08}>
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#060c13]/80">
      {/* Scan line animation */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(34,211,238,0.02)_2px,rgba(34,211,238,0.02)_4px)] pointer-events-none" />
      <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-transparent via-[#22d3ee]/30 to-transparent animate-pulse" />

      <div className="relative px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Tokens Scanned", value: "1.2M+", color: "#22d3ee" },
          { label: "Rugs Detected", value: "47K+", color: "#ef4444" },
          { label: "OGs Verified", value: "89K+", color: "#84cc16" },
          { label: "Active Users", value: "12K+", color: "#a855f7" },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-lg sm:text-xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] text-white/35 font-semibold uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  </Tilt3D>
);

// Keyframe for shimmer (add to global CSS or inline)
const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: 0% 0%; }
  50% { background-position: 100% 100%; }
  100% { background-position: 0% 0%; }
}
`;

// Inject keyframes
if (typeof document !== "undefined") {
  const id = "og-banner-keyframes";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = shimmerKeyframes;
    document.head.appendChild(style);
  }
}

export { Tilt3D };
export default OGBannerHero;
