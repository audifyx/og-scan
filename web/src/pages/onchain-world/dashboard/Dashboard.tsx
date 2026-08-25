import { BottomPanel } from "@/pages/onchain-world/dashboard/BottomPanel";
import { CenterStage } from "@/pages/onchain-world/dashboard/CenterStage";
import { EventBreakdown } from "@/pages/onchain-world/dashboard/EventBreakdown";
import { LiveEvents } from "@/pages/onchain-world/dashboard/LiveEvents";
import { MobileNav } from "@/pages/onchain-world/dashboard/MobileNav";
import { StatusBar } from "@/pages/onchain-world/dashboard/StatusBar";
import { TopBar } from "@/pages/onchain-world/dashboard/TopBar";
import { WalletPanel } from "@/pages/onchain-world/dashboard/WalletPanel";
import { TooltipProvider } from "@/pages/onchain-world/dashboard/ui/tooltip";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import { cn } from "@/lib/utils";
import "../ox-dash.css";
import "../onchain-world.css";

export function Dashboard() {
  const mobile = useOrbitxStore((s) => s.mobilePanel);

  return (
    <TooltipProvider>
      <div className="ox-dash flex h-dvh flex-col overflow-hidden bg-bg text-fg">
        <TopBar />
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 max-lg:gap-0 max-lg:p-0 lg:grid-cols-[18rem_minmax(0,1fr)_17.5rem]">
          <section
            aria-label="Events"
            className={cn(
              "min-h-0 h-full flex-col gap-2",
              mobile === "events" ? "flex" : "hidden",
              "lg:flex",
            )}
          >
            <LiveEvents />
            <EventBreakdown />
          </section>

          <section
            aria-label={mobile === "tx" ? "Transactions" : "World"}
            className={cn(
              "min-h-0 h-full flex-col gap-2",
              mobile === "world" || mobile === "tx" ? "flex" : "hidden",
              "lg:flex",
            )}
          >
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col",
                mobile === "tx" && "hidden lg:flex",
              )}
            >
              <CenterStage />
            </div>
            <div
              className={cn(
                "min-h-0",
                mobile === "world" && "hidden lg:block",
                mobile === "tx" && "flex-1 lg:flex-none",
                "lg:h-60 lg:shrink-0",
              )}
            >
              <BottomPanel />
            </div>
          </section>

          <section
            aria-label="Wallet"
            className={cn(
              "min-h-0 h-full",
              mobile === "wallet" ? "flex flex-col" : "hidden",
              "lg:flex lg:flex-col",
            )}
          >
            <WalletPanel />
          </section>
        </div>
        <StatusBar />
        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
