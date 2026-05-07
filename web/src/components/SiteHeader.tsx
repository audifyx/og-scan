import { Activity, AtSign, ExternalLink, Globe2, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { OGSCAN_SITE_URL, OGSCAN_TECH_POST_URL, OGSCAN_X_URL } from "@/lib/og";

type NavItem = { id: string; label: string };

type Props = {
  mint: string;
  navItems: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
};

export const SiteHeader = ({ mint, navItems, activeId, onNavigate }: Props) => {
  return (
    <header className="sticky top-0 z-40 border-b border-og-grid bg-og-ink/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="group flex shrink-0 items-center gap-3">
          <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-og-lime bg-og-ink shadow-og">
            <img src="/icon.png" alt="OG Scan icon" className="h-full w-full object-cover" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-og-cyan shadow-og" />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-[0.24em] text-foreground">ogscan<span className="text-og-lime">.fun</span></div>
            <div className="text-[9px] uppercase tracking-[0.38em] text-muted-foreground">Solana OG signal deck</div>
          </div>
        </a>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Feature navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition",
                activeId === item.id
                  ? "border-og-lime bg-og-lime text-og-ink"
                  : "border-transparent text-muted-foreground hover:border-og-grid hover:bg-og-lime/10 hover:text-og-lime",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 border border-og-grid bg-og-ink px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-og-cyan xl:inline-flex">
            <Activity className="h-3 w-3" /> MAINNET
          </span>
          <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 border border-og-grid bg-og-ink px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/70 transition hover:border-og-lime hover:text-og-lime sm:inline-flex" title="Open ogscan.fun">
            <Globe2 className="h-3.5 w-3.5" /> Site
          </a>
          <a href={OGSCAN_TECH_POST_URL} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 border border-og-grid bg-og-ink px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/70 transition hover:border-og-gold hover:text-og-gold md:inline-flex" title="Read the tech post">
            <Newspaper className="h-3.5 w-3.5" /> Post
          </a>
          <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-og-lime bg-og-lime px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-og-ink transition hover:bg-og-lime/90" title="Follow ogscan.fun on X">
            <AtSign className="h-3.5 w-3.5" /> X <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-og-grid px-4 py-2 lg:hidden" aria-label="Mobile feature navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "shrink-0 border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition",
              activeId === item.id
                ? "border-og-lime bg-og-lime text-og-ink"
                : "border-og-grid bg-og-ink/70 text-muted-foreground hover:text-og-lime",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
