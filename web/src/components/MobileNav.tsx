import { ComponentType } from "react";
import { Home, Search, Wrench, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

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

type NavItem = {
  id: TabId;
  icon: ComponentType<{ className?: string }>;
  label: string;
};

export const MobileNav = ({ activeId, onNavigate }: { activeId: TabId; onNavigate: (t: string) => void }) => {
  const items: NavItem[] = [
    { id: "overview",   icon: Home,     label: "Home" },
    { id: "scanner",    icon: Search,   label: "Scan" },
    { id: "tools",      icon: Wrench,   label: "Tools" },
    { id: "community",  icon: Users,    label: "Social" },
    { id: "profile",    icon: User,     label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.07] bg-card/90 px-2 pb-safe pt-2 backdrop-blur-lg lg:hidden">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 transition-all duration-200",
                isActive ? "text-og-lime" : "text-white/30 hover:text-white/60",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_hsl(var(--og-lime)/0.4)]")} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
              {isActive && <span className="absolute -bottom-1 h-0.5 w-4 rounded-full bg-og-lime" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
