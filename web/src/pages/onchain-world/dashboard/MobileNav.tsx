import { Activity, Globe, List, Wallet } from "lucide-react";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { cn } from "@/lib/utils";

const ITEMS = [
  { id: "world" as const, label: "World", icon: Globe },
  { id: "events" as const, label: "Events", icon: List },
  { id: "tx" as const, label: "Tx", icon: Activity },
  { id: "wallet" as const, label: "Wallet", icon: Wallet },
];

export function MobileNav() {
  const panel = useOrbitxStore((s) => s.mobilePanel);
  const setPanel = useOrbitxStore((s) => s.setMobilePanel);

  return (
    <nav className="flex h-14 shrink-0 items-stretch border-t border-line bg-bg-raised lg:hidden">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const on = panel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setPanel(item.id)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs font-medium tracking-wide",
              on ? "text-accent" : "text-dim",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
