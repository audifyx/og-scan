import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SocialTopBar } from "./SocialTopBar";
import { BottomNav } from "./BottomNav";

import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

const TAB_ID_MAP: Record<string, string> = {
  home: "overview",
  scanner: "scanner",
  feed: "feed",
  spaces: "spaces",
  social: "social",
  community: "community",
  tools: "tools",
  profile: "profile",
  discover: "discover",
  charts: "charts",
  "live-trading": "live-trading",
  "live-feed-page": "live-feed-page",
  research: "research",
  "token-manager": "token-manager",
  "trading-hub": "trading-hub",
  communities: "communities",
  memes: "memes",
  listings: "listings",
};

const getTabFromPath = (pathname: string): string => {
  const segment = pathname.replace(/^\/|\/$/g, "").split("/")[0].toLowerCase();
  return TAB_ID_MAP[segment] || "overview";
};

/* Category tab groups — render a "tabs at the top lead to each tool" bar
   (same pattern as the Tools tab) for routed pages that belong together. */
const SECTION_GROUPS: { title: string; tabs: { to: string; label: string }[] }[] = [
  {
    title: "Signals",
    tabs: [
      { to: "/reports", label: "Reports" },
      { to: "/track-record", label: "Track Record" },
      { to: "/alerts", label: "Alerts" },
      { to: "/intelligence", label: "AI Intelligence" },
    ],
  },
];

const SectionTabBar = () => {
  const { pathname } = useLocation();
  const group = SECTION_GROUPS.find((g) => g.tabs.some((t) => pathname === t.to || pathname.startsWith(t.to + "/")));
  if (!group) return null;
  return (
    <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-background/90 px-3 py-2.5 backdrop-blur sm:px-5">
      <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 pr-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{group.title}</span>
        {group.tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "shrink-0 rounded-xl border px-3.5 py-1.5 text-[11px] font-bold transition",
                active ? "border-emerald-400/50 bg-emerald-500/[0.08] text-emerald-300" : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/75",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { pathname } = useLocation();

  const activeTab = getTabFromPath(pathname);

  return (
    <div className="min-h-screen bg-background text-foreground flex relative">
      {/* Premium ambient backdrop — subtle brand glows + grid, behind everything */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(900px 520px at 12% -8%, hsl(var(--og-lime)/0.08), transparent 60%)," +
            "radial-gradient(820px 520px at 100% 0%, hsl(var(--og-cyan)/0.07), transparent 58%)," +
            "radial-gradient(760px 700px at 50% 116%, hsl(var(--og-gold)/0.05), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(circle at 50% 22%, #000, transparent 80%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 22%, #000, transparent 80%)",
        }}
      />
      {/* Cosmic photo backdrop — galaxy, glass-blurred */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/bg/bg-galaxy.jpg)", opacity: 0.26 }}
      >
        <div className="absolute inset-0 bg-background/68 backdrop-blur-[3px]" />
      </div>



      {/* Main content — offset by sidebar width on desktop, bottom padding for mobile nav */}
      <main className="main-scroll flex-1 overflow-auto min-h-screen pb-[68px] lg:pb-0 relative z-10">
        <SocialTopBar />
        <SectionTabBar />
        {children}
      </main>

    </div>
  );
};
