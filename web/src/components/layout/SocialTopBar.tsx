import { Hash, Mic, Headphones, User, Home, LayoutGrid, Wrench } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

/** New-theme top header for the social app (replaces the side tab bar). */
const TABS: { id: string; label: string; Icon: typeof Home }[] = [
  { id: "overview",    label: "Home",      Icon: Home },
  { id: "community",   label: "Community", Icon: Hash },
  { id: "spaces",      label: "Spaces",    Icon: Mic },
  { id: "voice-rooms", label: "Voice",     Icon: Headphones },
  { id: "profile",     label: "Profile",   Icon: User },
];

const ROUTE_FOR: Record<string, string> = { overview: "/app", community: "/community", spaces: "/spaces", "voice-rooms": "/voice-rooms", profile: "/profile" };

export function SocialTopBar({ activeId, onNavigate }: { activeId?: string; onNavigate?: (id: string) => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const current = activeId ?? (Object.entries(ROUTE_FOR).find(([, r]) => loc.pathname === r || loc.pathname.startsWith(r + "/"))?.[0] ?? "overview");
  const go = (id: string) => { if (onNavigate) onNavigate(id); else nav(ROUTE_FOR[id] || "/app"); };
  return (
    <header className="stb">
      <style>{css}</style>
      <a className="stb-brand" href="/app"><span className="stb-mark" />OGSCAN</a>

      <nav className="stb-tabs">
        {TABS.map((t) => {
          const active = current === t.id || (t.id === "community" && current === "social");
          return (
            <button key={t.id} onClick={() => go(t.id)} className={`stb-tab ${active ? "active" : ""}`}>
              <t.Icon className="h-4 w-4" /><span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="stb-right">
        <a className="stb-link" href="/social"><LayoutGrid className="h-4 w-4" /><span>Social</span></a>
        <a className="stb-link" href="/OGDEX"><Wrench className="h-4 w-4" /><span>OG Dex</span></a>
        <a className="stb-cta" href="/app">Hub</a>
      </div>
    </header>
  );
}

const css = `
.stb{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:14px;padding:12px clamp(14px,3vw,28px);
  background:rgba(5,6,8,.78);backdrop-filter:saturate(160%) blur(18px);border-bottom:1px solid rgba(255,255,255,.08);}
.stb-brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.16em;font-size:14px;color:#fff;text-decoration:none;flex-shrink:0;}
.stb-mark{width:15px;height:15px;border-radius:5px;background:conic-gradient(from 140deg,#2F80FF,#9945FF,#2F80FF);box-shadow:0 4px 14px rgba(47,128,255,.5);}
.stb-tabs{display:flex;align-items:center;gap:4px;flex:1;overflow-x:auto;scrollbar-width:none;}
.stb-tabs::-webkit-scrollbar{display:none;}
.stb-tab{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;border:0;cursor:pointer;background:transparent;color:#a7adba;
  font-size:13.5px;font-weight:600;padding:9px 14px;border-radius:12px;transition:all .18s;}
.stb-tab:hover{color:#fff;background:rgba(255,255,255,.05);}
.stb-tab.active{color:#fff;background:linear-gradient(120deg,rgba(47,128,255,.18),rgba(153,69,255,.18));box-shadow:inset 0 0 0 1px rgba(47,128,255,.35);}
.stb-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.stb-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#a7adba;padding:8px 12px;border-radius:10px;text-decoration:none;transition:all .18s;}
.stb-link:hover{color:#fff;background:rgba(255,255,255,.05);}
.stb-cta{font-size:13px;font-weight:700;color:#000;padding:9px 18px;border-radius:980px;text-decoration:none;background:linear-gradient(120deg,#2F80FF,#9945FF);box-shadow:0 8px 20px -8px rgba(47,128,255,.8);transition:transform .15s,filter .2s;}
.stb-cta:hover{filter:brightness(1.08);transform:translateY(-1px);}
@media(max-width:760px){.stb-tab span,.stb-link span{display:none}.stb-link{padding:8px}}
`;
