import { Activity, AtSign, CalendarClock, Copy, ExternalLink, Globe2, Newspaper, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { OGSCAN_SITE_URL, OGSCAN_TECH_POST_URL, OGSCAN_X_URL, shortAddr } from "@/lib/og";

type NavItem = { id: string; label: string };

type Props = {
  navItems: NavItem[];
  activeId: string;
  mint: string;
  query: string;
  onQueryChange: (nextQuery: string) => void;
  onRunSearch: (query?: string) => void;
  onCopyMint: () => void;
  onNavigate: (id: string) => void;
};

export const SiteHeader = ({
  navItems,
  activeId,
  mint,
  query,
  onQueryChange,
  onRunSearch,
  onCopyMint,
  onNavigate,
}: Props) => {
  return (
    <header className="sticky top-0 z-40 border-b border-og-grid bg-og-ink/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <button onClick={() => onNavigate("home")} className="group flex shrink-0 items-center gap-3 text-left" aria-label="Open OGScan home">
          <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-og-lime bg-og-ink shadow-og">
            <img src="/icon.png" alt="OG Scan icon" className="h-full w-full object-cover" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-og-cyan shadow-og" />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-[0.24em] text-foreground">
              ogscan<span className="text-og-lime">.fun</span>
            </div>
            <div className="text-[9px] uppercase tracking-[0.38em] text-muted-foreground">SolTools signal hub</div>
          </div>
        </button>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label="Tool page navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition",
                activeId === item.id
                  ? "border-og-lime bg-og-lime text-og-ink shadow-og"
                  : "border-transparent text-muted-foreground hover:border-og-grid hover:bg-og-lime/10 hover:text-og-lime",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onRunSearch();
          }}
          className="hidden w-full max-w-xs items-center border border-og-grid bg-black/35 pl-3 focus-within:border-og-lime lg:flex"
        >
          <Search className="h-4 w-4 shrink-0 text-og-lime" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search ticker or paste CA"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
            enterKeyHint="search"
          />
          <button type="submit" className="border-l border-og-grid px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-og-lime transition hover:bg-og-lime hover:text-og-ink">
            Scan
          </button>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
          <span className="hidden items-center gap-2 border border-og-grid bg-og-ink px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-og-cyan 2xl:inline-flex">
            <Activity className="h-3 w-3" /> MAINNET
          </span>
          <span className="hidden items-center gap-1.5 border border-og-gold/55 bg-og-gold/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-og-gold md:inline-flex">
            <CalendarClock className="h-3.5 w-3.5" /> Token soon
          </span>
          <button
            onClick={onCopyMint}
            className="hidden items-center gap-1.5 border border-og-grid bg-og-ink px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/70 transition hover:border-og-cyan hover:text-og-cyan sm:inline-flex"
            title="Copy target contract address"
          >
            <Copy className="h-3.5 w-3.5" /> {shortAddr(mint, 4)}
          </button>
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

      <div className="border-t border-og-grid px-4 py-2 text-center font-mono text-[10px] uppercase tracking-[0.26em] text-og-gold">
        No token out yet · coming soon
      </div>

      <div className="border-t border-og-grid px-4 py-2 lg:hidden">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onRunSearch();
          }}
          className="mx-auto flex max-w-2xl items-center border border-og-grid bg-black/35 pl-3 focus-within:border-og-lime"
        >
          <Search className="h-4 w-4 shrink-0 text-og-lime" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search ticker or paste CA"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" className="border-l border-og-grid px-3 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-og-lime">
            Scan
          </button>
        </form>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-og-grid px-4 py-2 xl:hidden" aria-label="Mobile tool page navigation">
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
