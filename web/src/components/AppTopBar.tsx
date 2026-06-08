import { ComponentType } from "react";
import { Menu, ChevronRight } from "lucide-react";
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
    <header className="sticky top-0 z-30 flex h-16 w-full flex-col glass-nav">
      <div className="relative flex h-16 w-full items-center justify-center px-4 lg:px-6">
        {/* Left: hamburger */}
        <div className="absolute left-4 flex items-center gap-4">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-white/50 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Center: breadcrumb */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold uppercase tracking-widest text-white/30">{tab.eyebrow}</span>
          <ChevronRight className="h-3 w-3 text-white/10" />
          <span className={cn("text-xs font-black uppercase tracking-wider", accentText(tab.accent))}>{tab.label}</span>
        </div>

        {/* Right: search + auth */}
        <div className="absolute right-4 flex items-center gap-3">
          <AuthButton />
        </div>
      </div>
    </header>
  );
};
