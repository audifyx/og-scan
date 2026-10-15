import { useState, useRef, useEffect } from "react";
import {
  LayoutGrid, Home, TrendingUp, ArrowRight, Lock, Crosshair, Users,
  BarChart3, Image, Briefcase, GraduationCap, Headphones, Compass, Building2,
} from "lucide-react";

const APPS = [
  { id: "hub", label: "Hub", href: "/", Icon: Home, gradient: "linear-gradient(135deg, #5eead4, #14b8a6)" },
  { id: "dex", label: "OrbitX DEX", href: "/ORBITX_DEX", Icon: TrendingUp, gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)" },
  { id: "trade", label: "Trade", href: "/trade", Icon: ArrowRight, gradient: "linear-gradient(135deg, #a78bfa, #7c3aed)" },
  { id: "shop", label: "Shop", href: "/shop", Icon: Lock, gradient: "linear-gradient(135deg, #5eead4, #0d9488)" },
  { id: "supercomputer", label: "Super Comp...", href: "/supercomputer", Icon: Crosshair, gradient: "linear-gradient(135deg, #5eead4, #14b8a6)" },
  { id: "social", label: "Social", href: "/social", Icon: Users, gradient: "linear-gradient(135deg, #c084fc, #9333ea)" },
  { id: "city", label: "City", href: "/Orbitxcity", Icon: BarChart3, gradient: "linear-gradient(135deg, #4ade80, #16a34a)" },
  { id: "nft", label: "NFT Market", href: "/nft", Icon: Image, gradient: "linear-gradient(135deg, #4ade80, #059669)" },
  { id: "bagwork", label: "Bagwork", href: "/bagwork", Icon: Briefcase, gradient: "linear-gradient(135deg, #fcd34d, #d97706)" },
  { id: "education", label: "Education", href: "/education", Icon: GraduationCap, gradient: "linear-gradient(135deg, #67e8f9, #0891b2)" },
  { id: "support", label: "Support", href: "/support", Icon: Headphones, gradient: "linear-gradient(135deg, #a78bfa, #7c3aed)" },
  { id: "scanner", label: "Scanner", href: "/ORBITX_DEX/scanner", Icon: Compass, gradient: "linear-gradient(135deg, #5eead4, #0d9488)" },
  { id: "hq", label: "HQ", href: "/hq", Icon: Building2, gradient: "linear-gradient(135deg, #f472b6, #db2777)" },
];

export default function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const ek = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", ek);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", ek); };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open ]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} className="app-switcher-btn" aria-label="All apps" title="All apps">
        <span className="app-switcher-btn__icon"><LayoutGrid size={18} /></span>
        <span className="app-switcher-btn__label">Apps</span>
      </button>

      {open && (
        <div className="app-switcher-overlay" onClick={() => setOpen(false)}>
          <div className="app-switcher-sheet" onClick={e => e.stopPropagation()}>
            <div className="app-switcher-sheet__title">ORBITX</div>
            <div className="app-switcher-sheet__grid">
              {APPS.map(app => (
                <a key={app.id} href={app.href} className="app-switcher-sheet__app" onClick={() => setOpen(false)}>
                  <span className="app-switcher-sheet__tile" style={{ background: app.gradient }}>
                    <app.Icon size={30} color="#fff" strokeWidth={1.8} />
                  </span>
                  <span className="app-switcher-sheet__label">{app.label}</span>
                </a>
              ))}
            </div>
            <div className="app-switcher-sheet__foot">Shop · City · Trade · Social</div>
            <button className="app-switcher-sheet__close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <style>{`
        .app-switcher-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px 10px 12px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(59,130,246,0.22), rgba(90,162,255,0.08));
          border: 1px solid rgba(90,162,255,0.35);
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.22,1,0.36,1);
          box-shadow: 0 4px 16px rgba(59,130,246,0.25), inset 0 1px 0 rgba(255,255,255,0.12);
        }
        .app-switcher-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(59,130,246,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
          border-color: rgba(90,162,255,0.55);
        }
        .app-switcher-btn:active { transform: translateY(0); }
        .app-switcher-btn__icon {
          display: grid;
          place-items: center;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: rgba(59,130,246,0.3);
          color: #7db4ff;
        }
        .app-switcher-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.82);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          z-index: 2000;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 48px 20px 20px;
          animation: appSwFade 0.25s ease;
        }
        @keyframes appSwFade { from { opacity: 0; } to { opacity: 1; } }
        .app-switcher-sheet {
          width: 100%;
          max-width: 520px;
          max-height: 82vh;
          overflow-y: auto;
          background: #060609;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 28px;
          padding: 28px 24px 20px;
          box-shadow: 0 32px 96px rgba(0,0,0,0.8);
          animation: appSwPop 0.32s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes appSwPop {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .app-switcher-sheet__title {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 0.22em;
          color: rgba(255,255,255,0.55);
          margin-bottom: 22px;
          padding-left: 4px;
        }
        .app-switcher-sheet__grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px 12px;
        }
        .app-switcher-sheet__app {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          transition: transform 0.15s;
        }
        .app-switcher-sheet__app:hover { transform: scale(1.06); }
        .app-switcher-sheet__app:active { transform: scale(0.96); }
        .app-switcher-sheet__tile {
          width: 68px;
          height: 68px;
          border-radius: 22px;
          display: grid;
          place-items: center;
          box-shadow: 0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25);
          border: 1px solid rgba(255,255,255,0.12);
        }
        .app-switcher-sheet__label {
          font-size: 12.5px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          text-align: center;
          line-height: 1.2;
          max-width: 76px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .app-switcher-sheet__foot {
          margin-top: 26px;
          padding-top: 18px;
          border-top: 1px solid rgba(255,255,255,0.08);
          text-align: center;
          font-size: 13px;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.04em;
        }
        .app-switcher-sheet__close {
          display: block;
          margin: 16px auto 4px;
          padding: 10px 32px;
          border-radius: 999px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.7);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .app-switcher-sheet__close:hover { background: rgba(255,255,255,0.12); color: #fff; }
        @media (max-width: 420px) {
          .app-switcher-sheet__grid { gap: 16px 8px; }
          .app-switcher-sheet__tile { width: 60px; height: 60px; border-radius: 19px; }
        }
      `}</style>
    </div>
  );
}
