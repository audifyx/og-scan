import { ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  Coins,
  Compass,
  Gift,
  Hash,
  Headset,
  Home,
  LineChart,
  Mail,
  Menu,
  Mic,
  Pencil,
  MessageSquare,
  Radio,
  Shield,
  TrendingUp,
  Trophy,
  Tv,
  User,
  Users,
  Wallet,
  Wrench,
  X,
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
  | "profile"
  | "token-manager"
  | "live-feed-page"
  | "trading-hub";

export type NavItem = {
  id?: TabId;
  to?: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  eyebrow: string;
  /** Written to localStorage before navigating — lets CommunityHub know which sub-tab to open */
  commEntry?: string;
};

const NavRow = ({
  item,
  activeId,
  currentPath,
  onNavigate,
  onClose,
  onPrefetch,
}: {
  item: NavItem;
  activeId: TabId;
  currentPath: string;
  onNavigate: (t: string) => void;
  onClose: () => void;
  onPrefetch?: (t: string) => void;
}) => {
  const isTabActive = item.id && activeId === item.id;
  const isPathActive = item.to && (currentPath === item.to || currentPath.startsWith(item.to + "/"));
  const isActive = isTabActive || isPathActive;

  const handleClick = () => {
    if (item.commEntry) {
      try { localStorage.setItem("og_comm_entry", item.commEntry); } catch {}
      window.dispatchEvent(new CustomEvent("og:comm-entry", { detail: item.commEntry }));
    }
    onClose();
    if (item.id) onNavigate(item.id);
  };

  const content = (
    <>
      <span className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition",
        isActive ? "border-og-lime/40 bg-og-lime/10 text-og-lime" : "border-white/10 bg-white/[0.04]",
      )}>
        <item.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight">{item.label}</span>
        <span className="block truncate text-[10px] text-white/35">{item.eyebrow}</span>
      </span>
      {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-og-lime" />}
    </>
  );

  if (item.to) {
    return (
      <Link
        to={item.to}
        onClick={onClose}
        onMouseEnter={() => item.id && onPrefetch?.(item.id)}
        onFocus={() => item.id && onPrefetch?.(item.id)}
        onTouchStart={() => item.id && onPrefetch?.(item.id)}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
          isActive ? "bg-white/[0.09] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/90",
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => item.id && onPrefetch?.(item.id)}
      onFocus={() => item.id && onPrefetch?.(item.id)}
      onTouchStart={() => item.id && onPrefetch?.(item.id)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
        isActive ? "bg-white/[0.09] text-white" : "text-white/55 hover:bg-white/[0.04] hover:text-white/90",
      )}
    >
      {content}
    </button>
  );
};

export const AppSidebar = ({
  activeId,
  mint,
  open,
  onClose,
  onChangeMint,
  onNavigate,
  onPrefetch,
}: {
  activeId: TabId;
  mint: string;
  open: boolean;
  onClose: () => void;
  onChangeMint: () => void;
  onNavigate: (t: string) => void;
  onPrefetch?: (t: string) => void;
}) => {
  const location = useLocation();
  const { isAdmin } = useAdmin();

  const primaryItems: NavItem[] = [
    { id: "overview", icon: Home, label: "Home", eyebrow: "Command hub" },
    { id: "our-coin", icon: Coins, label: "OFFICIAL OGS", eyebrow: "Official token room" },
    { id: "tools", icon: Wrench, label: "Tools", eyebrow: "Scanners & Feeds" },
    { id: "profile", icon: User, label: "Profile", eyebrow: "Your account" },
  ];

  const discoverItems: NavItem[] = [
    { id: "discover", icon: Compass, label: "Discover", eyebrow: "LaunchPad · Explore · Live Feed" },
  ];

  const communityItems: NavItem[] = [
    { id: "community", icon: Hash, label: "Social", eyebrow: "Channels · Rooms · Spaces · Voice" },
  ];

  const tradingItems: NavItem[] = [
    { to: "/wallets", icon: Wallet, label: "Phantom Trading Terminal", eyebrow: "Phantom Trade" },
    { id: "trading-hub" as TabId, icon: TrendingUp, label: "Trading Hub", eyebrow: "Launch · Lobbies · Callouts" },
    { to: "/messages", icon: Mail, label: "Messages", eyebrow: "Direct messages" },
    { to: "/support", icon: Headset, label: "Support Chat", eyebrow: "Tickets + live help" },
    { id: "token-manager" as TabId, icon: Pencil, label: "Token Manager", eyebrow: "Free metadata update" },
  ];

  const adminAppsItems: NavItem[] = [
    { to: "/admin", icon: Shield, label: "Admin Panel", eyebrow: "Dashboard + apps hub" },
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-border bg-card/80 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0",
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
            <div className="text-[10px] font-semibold tracking-widest text-primary/80">PRO TRADING SUITE</div>
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

      <nav className="sidebar-scrollbar flex-1 overflow-y-auto px-2 py-3 pr-1">
        <div className="mb-1 mt-2">
          <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Navigation</p>
          <div className="space-y-0.5">
            {primaryItems.map((item) => (
              <NavRow
                key={item.id ?? item.to}
                item={item}
                activeId={activeId}
                currentPath={location.pathname}
                onNavigate={onNavigate}
                onClose={onClose}
                onPrefetch={onPrefetch}
              />
            ))}
          </div>
        </div>

        <div className="mb-1 mt-4">
          <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Discover</p>
          <div className="space-y-0.5">
            {discoverItems.map((item) => (
              <NavRow
                key={item.id ?? item.to}
                item={item}
                activeId={activeId}
                currentPath={location.pathname}
                onNavigate={onNavigate}
                onClose={onClose}
                onPrefetch={onPrefetch}
              />
            ))}
          </div>
        </div>

        <div className="mb-1 mt-4">
          <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Community</p>
          <div className="space-y-0.5">
            {communityItems.map((item, i) => (
              <NavRow
                key={`${item.id ?? item.to}-${i}`}
                item={item}
                activeId={activeId}
                currentPath={location.pathname}
                onNavigate={onNavigate}
                onClose={onClose}
                onPrefetch={onPrefetch}
              />
            ))}
          </div>
        </div>

        <div className="mb-1 mt-4">
          <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Trading</p>
          <div className="space-y-0.5">
            {tradingItems.map((item) => (
              <NavRow
                key={item.to ?? item.id}
                item={item}
                activeId={activeId}
                currentPath={location.pathname}
                onNavigate={onNavigate}
                onClose={onClose}
                onPrefetch={onPrefetch}
              />
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="mb-1 mt-4">
            <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Admin Apps</p>
            <div className="space-y-0.5">
              {adminAppsItems.map((item) => (
                <NavRow
                  key={item.to}
                  item={item}
                  activeId={activeId}
                  currentPath={location.pathname}
                  onNavigate={onNavigate}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-white/[0.07] px-3 py-2">
        <button
          type="button"
          onClick={onChangeMint}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-white/[0.07]"
        >
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">Active mint</div>
            <div className="mt-0.5 font-mono text-[11px] font-semibold text-white/80">{shortAddr(mint, 6)}</div>
          </div>
          <Menu className="h-3.5 w-3.5 text-white/30" />
        </button>
      </div>
    </aside>
  );
};
