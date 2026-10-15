import { useState, useRef, useEffect } from "react";
import {
  LayoutGrid, Home, TrendingUp, ArrowRight, Lock, Crosshair, Users,
  BarChart3, Image, Briefcase, GraduationCap, Headphones, Compass, Building2, X,
} from "lucide-react";

const APPS = [
  { id: "hub", label: "Hub", href: "/", Icon: Home, gradient: "linear-gradient(135deg, #5eead4, #0d9488)", glow: "rgba(45,212,191,0.5)" },
  { id: "dex", label: "OrbitX DEX", href: "/ORBITX_DEX", Icon: TrendingUp, gradient: "linear-gradient(135deg, #60a5fa, #1e40af)", glow: "rgba(59,130,246,0.5)" },
  { id: "trade", label: "Trade", href: "/trade", Icon: ArrowRight, gradient: "linear-gradient(135deg, #c084fc, #7c3aed)", glow: "rgba(168,85,247,0.5)" },
  { id: "shop", label: "Shop", href: "/shop", Icon: Lock, gradient: "linear-gradient(135deg, #5eead4, #0f766e)", glow: "rgba(45,212,191,0.5)" },
  { id: "supercomputer", label: "Super Comp", href: "/supercomputer", Icon: Crosshair, gradient: "linear-gradient(135deg, #5eead4, #14b8a6)", glow: "rgba(45,212,191,0.5)" },
  { id: "social", label: "Social", href: "/social", Icon: Users, gradient: "linear-gradient(135deg, #c084fc, #9333ea)", glow: "rgba(168,85,247,0.5)" },
  { id: "city", label: "City", href: "/Orbitxcity", Icon: BarChart3, gradient: "linear-gradient(135deg, #4ade80, #15803d)", glow: "rgba(74,222,128,0.5)" },
  { id: "nft", label: "NFT Market", href: "/nft", Icon: Image, gradient: "linear-gradient(135deg, #4ade80, #059669)", glow: "rgba(74,222,128,0.5)" },
  { id: "bagwork", label: "Bagwork", href: "/bagwork", Icon: Briefcase, gradient: "linear-gradient(135deg, #fcd34d, #b45309)", glow: "rgba(252,211,77,0.5)" },
  { id: "education", label: "Education", href: "/education", Icon: GraduationCap, gradient: "linear-gradient(135deg, #67e8f9, #0e7490)", glow: "rgba(103,232,249,0.5)" },
  { id: "support", label: "Support", href: "/support", Icon: Headphones, gradient: "linear-gradient(135deg, #a78bfa, #6d28d9)", glow: "rgba(167,139,250,0.5)" },
  { id: "scanner", label: "Scanner", href: "/ORBITX_DEX/scanner", Icon: Compass, gradient: "linear-gradient(135deg, #5eead4, #0d9488)", glow: "rgba(45,212,191,0.5)" },
  { id: "hq", label: "HQ", href: "/hq", Icon: Building2, gradient: "linear-gradient(135deg, #f472b6, #be185d)", glow: "rgba(244,114,182,0.5)" },
];

const getRadius = () => (typeof window !== "undefined" && window.innerWidth < 560 ? 126 : 168);

export default function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [radius, setRadius] = useState(168);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setRadius(getRadius());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const ek = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", ek);
    return () => document.removeEventListener("keydown", ek);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open ]);

  const hoveredApp = APPS.find(a => a.id === hovered);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(true)} className="app-switcher-btn" aria-label="All apps" title="All apps">
        <LayoutGrid size={20} />
      </button>

      {open && (
        <div className="wheel-overlay" onClick={() => setOpen(false)}>
          <div className="wheel-title">ORBITX</div>

          <div className="wheel" onClick={e => e.stopPropagation()}>
            {/* Center hub */}
            <div className="wheel-center">
              <img src="/ORBITX_DEX/ogdex-logo.png" alt="OrbitX" className="wheel-center__logo" />
              <div className="wheel-center__label">{hoveredApp ? hoveredApp.label : "APPS"}</div>
            </div>

            {/* App nodes around the wheel */}
            {APPS.map((app, i) => {
              const angle = (i / APPS.length) * 360 - 90;
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;
              const isHover = hovered === app.id;
              return (
                <a
                  key={app.id}
                  href={app.href}
                  className="wheel-node"
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  onMouseEnter={() => setHovered(app.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setOpen(false)}
                >
                  <span
                    className="wheel-node__tile"
                    style={{
                      background: app.gradient,
                      boxShadow: isHover
                        ? `0 0 32px ${app.glow}, 0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)`
                        : `0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.22)`,
                      transform: isHover ? "scale(1.18)" : "scale(1)",
                    }}
                  >
                    <app.Icon size={28} color="#fff" strokeWidth={1.9} />
                  </span>
                  <span className="wheel-node__label" style={{ opacity: isHover ? 1 : 0.75 }}>
                    {app.label}
                  </span>
                </a>
              );
            })}

            {/* Decorative rings */}
            <div className="wheel-ring wheel-ring--1" />
            <div className="wheel-ring wheel-ring--2" />
          </div>

          {/* Premium close button */}
          <button onClick={() => setOpen(false)} className="wheel-close" aria-label="Close">
            <X size={26} />
          </button>

          <div className="wheel-hint">Select an app to launch</div>
        </div>
      )}

      <style>{`
        .app-switcher-btn {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(59,130,246,0.28), rgba(90,162,255,0.1));
          border: 1px solid rgba(90,162,255,0.45);
          color: #8ebbff;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.22,1,0.36,1);
          box-shadow: 0 4px 18px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.2);
        }
        .app-switcher-btn:hover {
          transform: translateY(-2px) scale(1.06);
          box-shadow: 0 10px 28px rgba(59,130,246,0.5), inset 0 1px 0 rgba(255,255,255,0.25);
          border-color: rgba(120,180,255,0.7);
          color: #c2daff;
        }
        .app-switcher-btn:active { transform: translateY(0) scale(0.97); }
        .wheel-overlay {
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at center, rgba(8,10,18,0.92), rgba(0,0,0,0.97));
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: wheelFade 0.3s ease;
          overflow: hidden;
        }
        @keyframes wheelFade { from { opacity: 0; } to { opacity: 1; } }
        .wheel-title {
          position: absolute;
          top: 40px;
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0.3em;
          color: rgba(255,255,255,0.4);
        }
        .wheel {
          position: relative;
          width: 480px;
          height: 480px;
          animation: wheelPop 0.45s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes wheelPop {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        .wheel-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 110px;
          height: 110px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #1a1f2e, #060609 70%);
          border: 1px solid rgba(255,255,255,0.14);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: 0 0 48px rgba(59,130,246,0.22), inset 0 1px 0 rgba(255,255,255,0.1);
          z-index: 2;
        }
        .wheel-center__logo { width: 40px; height: 40px; object-fit: contain; }
        .wheel-center__label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          max-width: 90px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .wheel-node {
          position: absolute;
          top: 50%;
          left: 50%;
          margin: -38px 0 0 -38px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          z-index: 1;
          transition: transform 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        .wheel-node__tile {
          width: 76px;
          height: 76px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,0.16);
          transition: all 0.18s cubic-bezier(0.22,1,0.36,1);
          cursor: pointer;
        }
        .wheel-node__label {
          font-size: 11.5px;
          font-weight: 700;
          color: #fff;
          text-shadow: 0 2px 8px rgba(0,0,0,0.8);
          white-space: nowrap;
          transition: opacity 0.15s;
        }
        .wheel-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.06);
          pointer-events: none;
        }
        .wheel-ring--1 { width: 336px; height: 336px; transform: translate(-50%,-50%); }
        .wheel-ring--2 { width: 440px; height: 440px; transform: translate(-50%,-50%); border-color: rgba(255,255,255,0.04); }
        .wheel-close {
          position: absolute;
          bottom: 56px;
          left: 50%;
          transform: translateX(-50%);
          width: 68px;
          height: 68px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, rgba(45,212,191,0.25), rgba(20,184,166,0.12));
          border: 1px solid rgba(94,234,212,0.4);
          color: #5eead4;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.22,1,0.36,1);
          box-shadow: 0 8px 28px rgba(45,212,191,0.25), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .wheel-close:hover {
          transform: translateX(-50%) scale(1.08) rotate(90deg);
          box-shadow: 0 12px 36px rgba(45,212,191,0.4), inset 0 1px 0 rgba(255,255,255,0.25);
          border-color: rgba(94,234,212,0.65);
          color: #99f6e4;
        }
        .wheel-close:active { transform: translateX(-50%) scale(0.96); }
        .wheel-hint {
          position: absolute;
          bottom: 140px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }
        @media (max-width: 560px) {
          .wheel { width: 360px; height: 360px; }
          .wheel-node__tile { width: 62px; height: 62px; border-radius: 20px; }
          .wheel-node { margin: -31px 0 0 -31px; }
          .wheel-ring--1 { width: 252px; height: 252px; }
          .wheel-ring--2 { width: 330px; height: 330px; }
          .wheel-center { width: 92px; height: 92px; }
        }
      `}</style>
    </div>
  );
}
