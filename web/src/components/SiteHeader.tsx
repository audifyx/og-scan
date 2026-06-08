import { Activity, AtSign, Coins, ExternalLink, Globe2, LayoutGrid, Newspaper, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { OGSCAN_SITE_URL, OGSCAN_TECH_POST_URL, OGSCAN_TOKEN_MINT, OGSCAN_X_URL, shortAddr } from "@/lib/og";
import { AuthButton } from "@/components/AuthButton";

type NavItem = { id: string; label: string };

type Props = {
  navItems: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
};

const PRIMARY_NAV_IDS: string[] = ["scanner", "snipe-feed", "og-finder", "migrations", "market-pulse"];

export const SiteHeader = ({ navItems, activeId, onNavigate }: Props) => {
  const primaryItems: NavItem[] = navItems.filter((item: NavItem) => PRIMARY_NAV_IDS.includes(item.id));
  const secondaryItems: NavItem[] = navItems.filter((item: NavItem) => !PRIMARY_NAV_IDS.includes(item.id));

  return (
    <header className="sticky top-0 z-40 glass-nav shadow-[0_24px_80px_-58px_hsl(var(--og-cyan)/0.6)]">
      {/* Token live announcement bar */}
      <div className="relative overflow-hidden border-b border-og-gold/30 bg-gradient-to-r from-og-gold/[0.07] via-og-gold/[0.13] to-og-gold/[0.07] px-4 py-2 text-center font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-og-gold">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,hsl(var(--og-gold)/0.08),transparent_70%)]" />
        <span className="relative inline-flex items-center justify-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-gold opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-og-gold" />
          </span>
          <Coins className="h-3 w-3" /> Token live · official CA {shortAddr(OGSCAN_TOKEN_MINT, 5)}
        </span>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button type="button" onClick={() => onNavigate("overview")} className="group flex min-w-0 shrink-0 items-center gap-3 text-left">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-og-lime bg-og-ink shadow-og">
            <img src="/icon.png" alt="OG Scan icon" className="h-full w-full object-cover" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-og-cyan shadow-og" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold tracking-[0.22em] text-foreground">ogscan<span className="text-og-lime">.fun</span></div>
            <div className="truncate text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Tool command deck</div>
          </div>
        </button>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label="Primary tool navigation">
          {primaryItems.map((item: NavItem) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "rounded-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition",
                activeId === item.id
                  ? "border-og-lime bg-og-lime text-og-ink shadow-og"
                  : "border-white/10 bg-white/[0.045] text-muted-foreground hover:border-og-lime/70 hover:text-og-lime",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate("scanner")}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-og-lime bg-og-lime px-3 text-[10px] font-black uppercase tracking-[0.18em] text-og-ink shadow-[0_0_34px_-12px_hsl(var(--og-lime))] transition hover:bg-white active:scale-[0.98] sm:px-4"
          >
            <Search className="h-3.5 w-3.5" /> Scanner
          </button>
          <button
            type="button"
            onClick={() => onNavigate("overview")}
            className="hidden min-h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/72 transition hover:border-og-cyan hover:text-og-cyan md:inline-flex"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> All tools
          </button>
          <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-2 py-1 text-[10px] uppercase tracking-[0.26em] text-og-cyan lg:inline-flex">
            <Activity className="h-3 w-3" /> MAINNET
          </span>
          <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/70 transition hover:border-og-lime hover:text-og-lime sm:inline-flex" title="Open ogscan.fun">
            <Globe2 className="h-3.5 w-3.5" /> Site
          </a>
          <a href={OGSCAN_TECH_POST_URL} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/70 transition hover:border-og-gold hover:text-og-gold lg:inline-flex" title="Read the tech post">
            <Newspaper className="h-3.5 w-3.5" /> Post
          </a>
          <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/70 transition hover:border-og-lime hover:text-og-lime md:inline-flex" title="Follow ogscan.fun on X">
            <AtSign className="h-3.5 w-3.5" /> X <ExternalLink className="h-3 w-3" />
          </a>
          <AuthButton />
        </div>
      </div>

      <nav className="ios-scroll flex gap-2 overflow-x-auto border-t border-white/10 px-4 py-2 xl:hidden" aria-label="Mobile feature navigation">
        {[...primaryItems, ...secondaryItems].map((item: NavItem) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition",
              activeId === item.id
                ? "border-og-lime bg-og-lime text-og-ink"
                : "border-white/10 bg-white/[0.045] text-muted-foreground hover:text-og-lime",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
