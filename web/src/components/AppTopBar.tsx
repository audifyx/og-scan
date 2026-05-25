import { ComponentType } from "react";
import { Search, Menu, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortAddr } from "@/lib/og";
import { AuthButton } from "@/components/AuthButton";

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

type TabAccent = "blue" | "white" | "cyan" | "gold" | "lime";
type TabGroup = "Main" | "Forensics" | "Market" | "Project";

type TabConfig = {
  id: TabId;
  label: string;
  slug: string;
  pageNumber: number;
  eyebrow: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  accent: TabAccent;
  group: TabGroup;
  showInNav?: boolean;
  mergedInto?: TabId;
};

const accentText = (a: TabAccent): string =>
  a === "gold" ? "text-og-gold" : a === "cyan" ? "text-og-cyan" : a === "white" ? "text-white" : "text-og-lime";

const accentIcon = (a: TabAccent): string =>
  a === "gold"
    ? "border-og-gold/40 bg-og-gold/10 text-og-gold"
    : a === "cyan"
      ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan"
      : a === "white"
        ? "border-white/20 bg-white/8 text-white"
        : "border-og-lime/40 bg-og-lime/10 text-og-lime";

export const AppTopBar = ({
  tab,
  mint,
  activeId,
  onOpenSidebar,
  onChangeMint,
  onNavigate,
}: {
  tab: TabConfig;
  mint: string;
  activeId: TabId;
  onOpenSidebar: () => void;
  onChangeMint: () => void;
  onNavigate: (t: string) => void;
}) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full flex-col border-b border-white/[0.07] bg-[#070d14]/80 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between pl-14 pr-4 lg:pl-6 lg:pr-6">
        <div className="flex items-center gap-4">
          <div className="hidden h-5 w-px bg-white/10 lg:block" />

          <div className="flex items-center gap-2">
            <div className={cn("hidden h-8 w-8 items-center justify-center rounded-lg border sm:flex", accentIcon(tab.accent))}>
              <tab.Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-white/30">{tab.eyebrow}</span>
                <ChevronRight className="h-3 w-3 text-white/10" />
                <span className={cn("text-xs font-black uppercase tracking-wider", accentText(tab.accent))}>{tab.label}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onChangeMint}
            className="group hidden items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:border-og-cyan/40 hover:bg-white/[0.07] sm:flex"
          >
            <Search className="h-3.5 w-3.5 text-white/30 transition group-hover:text-og-cyan" />
            <span className="font-mono text-[11px] font-semibold text-white/60 group-hover:text-white/90">
              {shortAddr(mint, 6)}
            </span>
          </button>
          <AuthButton />
        </div>
      </div>
    </header>
  );
};
