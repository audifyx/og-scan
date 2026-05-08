import {
  Activity,
  AtSign,
  BarChart3,
  CalendarClock,
  Coins,
  Compass,
  Copy,
  Crosshair,
  ExternalLink,
  Flame,
  Globe2,
  Layers3,
  Map,
  Newspaper,
  Radar,
  Rocket,
  Search,
  ShieldCheck,
  Target,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
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

const NAV_ICONS: Record<string, LucideIcon> = {
  home: Compass,
  "snipe-feed": Target,
  scanner: Search,
  pairs: Radar,
  "og-finder": Crosshair,
  migrations: Rocket,
  trending: Flame,
  swap: Zap,
  token: Coins,
  roadmap: Map,
  tech: Layers3,
};

const SUBTITLES: Record<string, string> = {
  home: "Command center",
  "snipe-feed": "Live launches",
  scanner: "Search coins",
  pairs: "Fresh pairs",
  "og-finder": "Copycat scan",
  migrations: "Graduations",
  trending: "Hot coins",
  swap: "Route preview",
  token: "Official notice",
  roadmap: "Ecosystem plan",
  tech: "Data stack",
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
  const primaryNav: NavItem[] = navItems.filter((item) => item.id !== "token" && item.id !== "roadmap" && item.id !== "tech");
  const systemNav: NavItem[] = navItems.filter((item) => item.id === "token" || item.id === "roadmap" || item.id === "tech");

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] border-r border-og-cyan/20 bg-[#03110f]/96 shadow-[28px_0_90px_-70px_hsl(var(--og-cyan))] backdrop-blur-2xl lg:flex lg:flex-col">
        <div className="flex items-center gap-3 border-b border-og-grid/70 px-5 py-5">
          <button onClick={() => onNavigate("home")} className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-og-lime text-og-ink shadow-[0_0_34px_-12px_hsl(var(--og-lime))]" aria-label="Open OGScan home">
            <img src="/icon.png" alt="OG Scan icon" className="h-full w-full object-cover" />
          </button>
          <div className="min-w-0">
            <div className="font-display text-sm font-black uppercase tracking-[0.12em] text-og-gold">SOL TOOLS</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.3em] text-muted-foreground">OGScan suite</div>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onRunSearch();
          }}
          className="mx-4 mt-4 flex items-center gap-2 rounded-2xl border border-og-grid bg-black/30 px-3 py-2.5 focus-within:border-og-lime"
        >
          <Search className="h-4 w-4 shrink-0 text-og-lime" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search CA or ticker"
            className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
            enterKeyHint="search"
          />
        </form>

        <div className="flex-1 overflow-y-auto px-3 py-5 ios-scroll">
          <NavGroup title="Main" items={primaryNav} activeId={activeId} onNavigate={onNavigate} />
          <NavGroup title="Project" items={systemNav} activeId={activeId} onNavigate={onNavigate} />

          <div className="mt-5 grid grid-cols-2 gap-2">
            <MiniLink href={OGSCAN_X_URL} icon={AtSign} label="X" />
            <MiniLink href={OGSCAN_SITE_URL} icon={Globe2} label="Site" />
            <MiniLink href={OGSCAN_TECH_POST_URL} icon={Newspaper} label="Post" />
            <button onClick={onCopyMint} className="rounded-2xl border border-og-grid bg-white/[0.035] px-3 py-3 text-left transition hover:border-og-cyan hover:bg-og-cyan/10">
              <Copy className="mb-2 h-4 w-4 text-og-cyan" />
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Target</div>
              <div className="mt-1 font-mono text-[10px] font-bold text-foreground">{shortAddr(mint, 4)}</div>
            </button>
          </div>
        </div>

        <div className="border-t border-og-grid/70 p-4">
          <button
            onClick={() => onNavigate("token")}
            className="group flex w-full items-center gap-3 rounded-3xl border border-og-gold/25 bg-og-gold/[0.07] p-3 text-left transition hover:border-og-gold/60"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-og-gold text-og-ink">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-black uppercase tracking-tight text-og-gold">No token out yet</span>
              <span className="mt-0.5 block text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Coming soon</span>
            </span>
            <ExternalLink className="h-4 w-4 text-og-gold/60 transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-og-grid bg-og-ink/94 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => onNavigate("home")} className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-og-lime" aria-label="Open OGScan home">
            <img src="/icon.png" alt="OG Scan icon" className="h-full w-full object-cover" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-black uppercase tracking-[0.16em] text-og-gold">SolTools</div>
            <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Token monitor</div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-og-lime/40 bg-og-lime/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-og-lime">
            <Activity className="h-3 w-3" /> Live
          </span>
          <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full border border-og-grid text-og-cyan">
            <AtSign className="h-4 w-4" />
          </a>
        </div>

        <div className="px-4 pb-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onRunSearch();
            }}
            className="flex items-center gap-2 rounded-2xl border border-og-grid bg-black/35 px-3 py-2.5 focus-within:border-og-lime"
          >
            <Search className="h-4 w-4 shrink-0 text-og-lime" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search ticker or paste CA"
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button type="submit" className="rounded-full bg-og-lime px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest text-og-ink">
              Scan
            </button>
          </form>
        </div>

        <div className="border-t border-og-grid/70 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-[0.26em] text-og-gold">
          No token out yet · coming soon
        </div>

        <nav className="flex gap-2 overflow-x-auto border-t border-og-grid/70 px-4 py-2 ios-scroll" aria-label="Mobile tool page navigation">
          {navItems.map((item) => {
            const Icon = NAV_ICONS[item.id] ?? Wrench;
            const active = activeId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition",
                  active
                    ? "border-og-lime bg-og-lime text-og-ink shadow-[0_0_24px_-10px_hsl(var(--og-lime))]"
                    : "border-og-grid bg-white/[0.035] text-muted-foreground hover:text-og-lime",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>
    </>
  );
};

const NavGroup = ({
  title,
  items,
  activeId,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
}) => (
  <div className="mb-5">
    <div className="mb-2 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.34em] text-og-cyan/70">{title}</div>
    <div className="space-y-1.5">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.id] ?? Wrench;
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-3xl border px-3 py-3 text-left transition",
              active
                ? "border-og-lime/35 bg-og-lime/[0.11] text-og-lime shadow-[inset_4px_0_0_hsl(var(--og-lime))]"
                : "border-transparent text-foreground/58 hover:border-og-grid hover:bg-white/[0.035] hover:text-foreground",
            )}
          >
            <span className={cn("grid h-8 w-8 place-items-center rounded-2xl border", active ? "border-og-lime/30 bg-og-lime/15" : "border-og-grid/50 bg-black/20 group-hover:text-og-cyan")}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-sm font-black tracking-tight">{item.label}</span>
              <span className="mt-0.5 block truncate text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{SUBTITLES[item.id] ?? "Tool page"}</span>
            </span>
            {active ? <span className="h-1.5 w-1.5 rounded-full bg-og-lime shadow-[0_0_16px_hsl(var(--og-lime))]" /> : null}
          </button>
        );
      })}
    </div>
  </div>
);

const MiniLink = ({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) => (
  <a href={href} target="_blank" rel="noreferrer" className="rounded-2xl border border-og-grid bg-white/[0.035] px-3 py-3 transition hover:border-og-lime hover:bg-og-lime/10">
    <Icon className="mb-2 h-4 w-4 text-og-lime" />
    <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Open</div>
    <div className="mt-1 font-display text-xs font-black text-foreground">{label}</div>
  </a>
);
