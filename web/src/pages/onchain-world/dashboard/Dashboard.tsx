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
import "../ox-dash.css";
import "../onchain-world.css";

export function Dashboard() {
  const page = useOrbitxStore((s) => s.mobilePanel);

  return (
    <TooltipProvider>
      <div className="ox-dash fixed inset-0 z-[80] flex flex-col overflow-hidden bg-bg text-fg">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-hidden">
          {page === "world" ? (
            <section aria-label="World" className="flex h-full min-h-0 flex-col">
              <CenterStage />
            </section>
          ) : null}
          {page === "events" ? (
            <section aria-label="Events" className="flex h-full min-h-0 flex-col">
              <LiveEvents />
              <EventBreakdown />
            </section>
          ) : null}
          {page === "tx" ? (
            <section aria-label="Transactions" className="flex h-full min-h-0 flex-col">
              <BottomPanel />
            </section>
          ) : null}
          {page === "wallet" ? (
            <section aria-label="Wallet" className="flex h-full min-h-0 flex-col">
              <WalletPanel />
            </section>
          ) : null}
        </div>
        <StatusBar />
        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
