import { ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LineChart,
  TrendingUp,
  Radio,
  Wallet,
  Trophy,
  Bot,
  Wrench,
  Rocket,
  Crown,
  X,
  Menu,
  Sparkles,
  Shield,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OGSCAN_TOKEN_MINT, shortAddr } from "@/lib/og";
import { useAdmin } from "@/hooks/useAdmin";

type TabId =
  | "overview"
  | "our-coin"
  | "roadmap"
  | "market-pulse"
  | "snipe-feed"
  | "feed"
  | "scanner"
  | "og-finder"
  | "pairs"
  | "migrations"
  | "trending"
  | "whales"
  | "tx-feed"
  | "swap"
  | "tech"
  | "news-signal"
  | "communities"
  | "discover"
  | "memes"
  | "spaces"
  | "social"
  | "community"
  | "tools"
  | "profile";

export type ExternalNavItem = {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  eyebrow: string;
};

const ExternalNavLink = ({ item, currentPath, onClose }: { item: ExternalNavItem; currentPath: string; onClose: () => void }) => {
  const isActive = currentPath === item.to || currentPath.startsWith(item.to + "/");
  return (
    <Link
      to={item.to}
      onClick={onClose}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
        isActive ? "bg-white/[0.09] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/90",
      )}
    >
      <span className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition",
        isActive ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan" : "border-white/10 bg-white/[0.04]",
      )}>
        <item.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight">{item.label}</span>
        <span className="block truncate text-[10px] text-white/35">{item.eyebrow}</span>
      </span>
      {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-og-cyan" />}
    </Link>
  );
};

export const AppSidebar = ({
  activeId,
  mint,
  open,
  onClose,
  onChangeMint,
  onNavigate,
}: {
  activeId: TabId;
  mint: string;
  open: boolean;
  onClose: () => void;
  onChangeMint: () => void;
  onNavigate: (t: string) => void;
}) => {
  const location = useLocation();
  const { isAdmin } = useAdmin();

  const tradingItems: ExternalNavItem[] = [
    { to: "/charts",          icon: LineChart,    label: "Charts",          eyebrow: "Live charts" },
    { to: "/live-trading",    icon: TrendingUp,   label: "Live Trading",    eyebrow: "P&L · Signals" },
    { to: "/live-feed-page",  icon: Radio,        label: "Live Feed",       eyebrow: "Tape stream" },
    { to: "/wallets",         icon: Wallet,       label: "Wallets",         eyebrow: "Tracked wallets" },
    { to: "/leaderboard",     icon: Trophy,       label: "Leaderboard",     eyebrow: "Top traders" },
  ];

  const moreItems: ExternalNavItem[] = [
    { to: "/alpha-chat",      icon: Bot,          label: "Alpha Chat",      eyebrow: "AI assistant" },
    { to: "/advanced-tools",  icon: Wrench,       label: "Advanced Tools",  eyebrow: "30+ pro tools" },
    { to: "/pumpv5",          icon: Rocket,       label: "Launch Pad",      eyebrow: "Token listings" },

    ...(isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin Panel", eyebrow: "Owner dashboard" } as ExternalNavItem] : []),
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-white/[0.07] bg-[#060c13] transition-transform duration-300 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
        <button type="button" onClick={() => onNavigate("overview")} className="flex items-center gap-3 text-left">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-og-lime/50 bg-og-lime/10">
            <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover" />
            <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-og-lime shadow-[0_0_6px_hsl(var(--og-lime))]" />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-wide text-white">OGScan</div>
            <div className="text-[10px] font-semibold tracking-widest text-og-cyan/80">PRO TRADING SUITE</div>
          </div>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: "none" }}>
        <div className="mb-1 mt-3">
          <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Trading</p>
          <div className="space-y-0.5">
            {tradingItems.map((item) => (
              <ExternalNavLink key={item.to} item={item} currentPath={location.pathname} onClose={onClose} />
            ))}
          </div>
        </div>

        <div className="mb-1 mt-3">
          <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">More</p>
          <div className="space-y-0.5">
            {moreItems.map((item) => (
              <ExternalNavLink key={item.to} item={item} currentPath={location.pathname} onClose={onClose} />
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t border-white/[0.07] px-3 py-2">
        <button
          type="button"
          onClick={onChangeMint}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-og-cyan/40 hover:bg-white/[0.07]"
        >
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">Active mint</div>
            <div className="mt-0.5 font-mono text-[11px] font-semibold text-white/80">{shortAddr(mint, 6)}</div>
          </div>
          <Menu className="h-3.5 w-3.5 text-white/30" />
        </button>
      </div>

      {/* Premium removed */}

      <div className="border-t border-white/[0.07] px-3 pb-4 pt-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">Official Token</div>
        <div className="mt-1 font-mono text-[10px] text-white/50">
          CA {shortAddr(OGSCAN_TOKEN_MINT, 5)}
        </div>
      </div>
    </aside>
  );
};
