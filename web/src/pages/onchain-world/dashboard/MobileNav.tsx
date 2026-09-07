import { Activity, Bot, Globe, List, Search, Wallet } from "lucide-react";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { cn } from "@/lib/utils";

const ITEMS = [
  { id: "world" as const, label: "World", icon: Globe },
  { id: "feed" as const, label: "Feed", icon: Search },
  { id: "agents" as const, label: "Agents", icon: Bot },
  { id: "events" as const, label: "Events", icon: List },
  { id: "tx" as const, label: "Tx", icon: Activity },
  { id: "wallet" as const, label: "Wallet", icon: Wallet },
];

export function MobileNav() {
  const panel = useOrbitxStore((s) => s.mobilePanel);
  const setPanel = useOrbitxStore((s) => s.setMobilePanel);

  return (
    <nav
      aria-label="On-chain pages"
      className="pointer-events-none flex shrink-0 justify-center px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-1 lg:hidden"
    >
      <div className="pointer-events-auto flex h-14 w-full max-w-[28rem] items-stretch gap-0.5 rounded-full border border-line bg-bg-raised/90 px-1.5 shadow-[0_18px_40px_rgb(0_0_0_/_0.55)] backdrop-blur-xl">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const on = panel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPanel(item.id)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium tracking-wide",
                on ? "bg-fg text-bg" : "text-dim hover:text-fg",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
