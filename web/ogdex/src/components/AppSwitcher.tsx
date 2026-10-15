import { useState, useRef, useEffect } from "react";
import {
  LayoutGrid, Home, TrendingUp, ArrowRight, Lock, Crosshair, Users,
  BarChart3, Image, Briefcase, GraduationCap, Headphones, Compass, Building2, X,
} from "lucide-react";

const APPS = [
  { id: "hub", label: "Hub", href: "/", Icon: Home, gradient: "linear-gradient(145deg, #5eead4 0%, #14b8a6 60%, #0f766e 100%)", glow: "rgba(45,212,191,0.45)" },
  { id: "dex", label: "OrbitX DEX", href: "/ORBITX_DEX", Icon: TrendingUp, gradient: "linear-gradient(145deg, #60a5fa 0%, #2563eb 60%, #1e40af 100%)", glow: "rgba(59,130,246,0.45)" },
  { id: "trade", label: "Trade", href: "/trade", Icon: ArrowRight, gradient: "linear-gradient(145deg, #c4b5fd 0%, #8b5cf6 60%, #6d28d9 100%)", glow: "rgba(139,92,246,0.45)" },
  { id: "shop", label: "Shop", href: "/shop", Icon: Lock, gradient: "linear-gradient(145deg, #5eead4 0%, #0d9488 60%, #115e59 100%)", glow: "rgba(45,212,191,0.45)" },
  { id: "supercomputer", label: "Super Comp...", href: "/supercomputer", Icon: Crosshair, gradient: "linear-gradient(145deg, #5eead4 0%, #14b8a6 60%, #0f766e 100%)", glow: "rgba(45,212,191,0.45)" },
  { id: "social", label: "Social", href: "/social", Icon: Users, gradient: "linear-gradient(145deg, #c084fc 0%, #9333ea 60%, #7e22ce 100%)", glow: "rgba(168,85,247,0.45)" },
  { id: "city", label: "City", href: "/Orbitxcity", Icon: BarChart3, gradient: "linear-gradient(145deg, #4ade80 0%, #16a34a 60%, #15803d 100%)", glow: "rgba(74,222,128,0.45)" },
  { id: "nft", label: "NFT Market", href: "/nft", Icon: Image, gradient: "linear-gradient(145deg, #4ade80 0%, #059669 60%, #047857 100%)", glow: "rgba(74,222,128,0.45)" },
  { id: "bagwork", label: "Bagwork", href: "/bagwork", Icon: Briefcase, gradient: "linear-gradient(145deg, #fde68a 0%, #f59e0b 60%, #b45309 100%)", glow: "rgba(245,158,11,0.45)" },
  { id: "education", label: "Education", href: "/education", Icon: GraduationCap, gradient: "linear-gradient(145deg, #67e8f9 0%, #0891b2 60%, #0e7490 100%)", glow: "rgba(103,232,249,0.45)" },
  { id: "support", label: "Support", href: "/support", Icon: Headphones, gradient: "linear-gradient(145deg, #a78bfa 0%, #7c3aed 60%, #6d28d9 100%)", glow: "rgba(167,139,250,0.45)" },
  { id: "scanner", label: "Scanner", href: "/ORBITX_DEX/scanner", Icon: Compass, gradient: "linear-gradient(145deg, #5eead4 0%, #0d9488 60%, #115e59 100%)", glow: "rgba(45,212,191,0.45)" },
  { id: "hq", label: "HQ", href: "/hq", Icon: Building2, gradient: "linear-gradient(145deg, #f9a8d4 0%, #ec4899 60%, #be185d 100%)", glow: "rgba(236,72,153,0.45)" },
];

export default function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ek = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", ek);
    return () => document.removeEventListener("keydown", ek);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open ]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(true)} className="app-switcher-btn" aria-label="All apps" title="All apps">
        <LayoutGrid size={20} />
      </button>

      {open && (
        <div className="asw-overlay" onClick={() => setOpen(false)}>
          <div className="asw-sheet" onClick={e => e.stopPropagation()}>
            <div className="asw-sheet__title">ORBITX</div>
            <div className="asw-sheet__grid">
              {APPS.map(app => (
                <a key={app.id} href={app.href} className="asw-app" onClick={() => setOpen(false)}>
                  <span className="asw-app__tile" style={{ ["--tile-bg" as string]: app.gradient, ["--tile-glow" as string]: app.glow }}>
                    <span className="asw-app__tile-shine" />
                    <app.Icon size={32} color="#fff" strokeWidth={1.7} />
                  </span>
                  <span className="asw-app__label">{app.label}</span>
                </a>
              ))}
            </div>
            <div className="asw-sheet__foot">Shop · City · Trade · Social</div>
          </div>
          <button onClick={() => setOpen(false)} className="asw-close" aria-label="Close">
            <X size={28} />
          </button>
        </div>
      )}

      <style>{`
        .app-switcher-btn {
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          border-radius: 16px;
          background: linear-gradient(145deg, rgba(59,130,246,0.3), rgba(37,99,235,0.15));
          border: 1px solid rgba(96,165,250,0.5);
          color: #93c5fd;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.22,1,0.36,1);
          box-shadow:
            0 6px 20px rgba(59,130,246,0.35),
            inset 0 1px 0 rgba(255,255,255,0.2),
            inset 0 -2px 4px rgba(0,0,0,0.25);
          position: relative;
          overflow: hidden;
        }
        .app-switcher-btn::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
          transform: translateX(-100%);
          transition: transform 0.6s;
        }
        .app-switcher-btn:hover::before { transform: translateX(100%); }
        .app-switcher-btn:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow:
            0 10px 32px rgba(59,130,246,0.5),
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -2px 4px rgba(0,0,0,0.2);
          border-color: rgba(147,197,253,0.7);
          color: #dbeafe;
        }
        .app-switcher-btn:active { transform: translateY(0) scale(0.96); }
        .asw-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2,3,8,0.88);
          backdrop-filter: blur(20px) saturate(1.2);
          -webkit-backdrop-filter: blur(20px) saturate(1.2);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: aswFade 0.28s ease;
        }
        @keyframes aswFade { from { opacity: 0; } to { opacity: 1; } }
        .asw-sheet {
          width: 100%;
          max-width: 480px;
          max-height: 78vh;
          overflow-y: auto;
          background: linear-gradient(160deg, #0c0d14 0%, #060609 50%, #0a0b12 100%);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 32px;
          padding: 32px 28px 24px;
          box-shadow:
            0 40px 120px rgba(0,0,0,0.85),
            0 0 80px rgba(59,130,246,0.08),
            inset 0 1px 0 rgba(255,255,255,0.08);
          animation: aswPop 0.38s cubic-bezier(0.22,1,0.36,1);
          scrollbar-width: none;
        }
        .asw-sheet::-webkit-scrollbar { display: none; }
        @keyframes aswPop {
          from { opacity: 0; transform: translateY(32px) scale(0.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .asw-sheet__title {
          font-size: 23px;
          font-weight: 800;
          letter-spacing: 0.28em;
          background: linear-gradient(90deg, rgba(255,255,255,0.65), rgba(255,255,255,0.35));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 28px;
          padding-left: 4px;
        }
        .asw-sheet__grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px 14px;
        }
        .asw-app {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          transition: transform 0.18s cubic-bezier(0.22,1,0.36,1);
        }
        .asw-app:hover { transform: translateY(-4px) scale(1.06); }
        .asw-app:active { transform: scale(0.94); }
        .asw-app__tile {
          width: 74px;
          height: 74px;
          border-radius: 24px;
          display: grid;
          place-items: center;
          background: var(--tile-bg);
          border: 1px solid rgba(255,255,255,0.2);
          position: relative;
          overflow: hidden;
          box-shadow:
            0 10px 28px rgba(0,0,0,0.5),
            inset 0 2px 0 rgba(255,255,255,0.28),
            inset 0 -3px 6px rgba(0,0,0,0.22);
          transition: box-shadow 0.2s;
        }
        .asw-app:hover .asw-app__tile {
          box-shadow:
            0 14px 40px rgba(0,0,0,0.55),
            0 0 32px var(--tile-glow),
            inset 0 2px 0 rgba(255,255,255,0.32),
            inset 0 -3px 6px rgba(0,0,0,0.2);
        }
        .asw-app__tile-shine {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.22), transparent);
          border-radius: 24px 24px 0 0;
          pointer-events: none;
        }
        .asw-app__label {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          text-align: center;
          line-height: 1.25;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 0 2px 10px rgba(0,0,0,0.6);
          letter-spacing: 0.01em;
        }
        .asw-sheet__foot {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.07);
          text-align: center;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.32);
          letter-spacing: 0.06em;
        }
        .asw-close {
          position: absolute;
          bottom: 44px;
          left: 50%;
          transform: translateX(-50%);
          width: 72px;
          height: 72px;
          border-radius: 26px;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, rgba(45,212,191,0.28), rgba(13,148,136,0.14));
          border: 1px solid rgba(94,234,212,0.45);
          color: #5eead4;
          cursor: pointer;
          transition: all 0.24s cubic-bezier(0.22,1,0.36,1);
          box-shadow:
            0 10px 32px rgba(45,212,191,0.3),
            inset 0 2px 0 rgba(255,255,255,0.2),
            inset 0 -3px 6px rgba(0,0,0,0.25);
          overflow: hidden;
          position: absolute;
        }
        .asw-close::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.16), transparent);
          border-radius: 26px 26px 0 0;
          pointer-events: none;
        }
        .asw-close:hover {
          transform: translateX(-50%) scale(1.1) rotate(90deg);
          box-shadow:
            0 14px 44px rgba(45,212,191,0.45),
            inset 0 2px 0 rgba(255,255,255,0.25),
            inset 0 -3px 6px rgba(0,0,0,0.2);
          border-color: rgba(153,246,228,0.7);
          color: #99f6e4;
        }
        .asw-close:active { transform: translateX(-50%) scale(0.94); }
        @media (max-width: 420px) {
          .asw-sheet__grid { gap: 20px 10px; }
          .asw-app__tile { width: 64px; height: 64px; border-radius: 21px; }
          .asw-app__label { font-size: 12px; }
          .asw-sheet { padding: 26px 20px 20px; border-radius: 28px; }
        }
      `}</style>
    </div>
  );
}
