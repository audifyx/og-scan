import { BottomPanel } from "@/pages/onchain-world/dashboard/BottomPanel";
import { CenterStage } from "@/pages/onchain-world/dashboard/CenterStage";
import { EventBreakdown } from "@/pages/onchain-world/dashboard/EventBreakdown";
import { LiveEvents } from "@/pages/onchain-world/dashboard/LiveEvents";
import { MobileNav } from "@/pages/onchain-world/dashboard/MobileNav";
import { StatusBar } from "@/pages/onchain-world/dashboard/StatusBar";
import { TokenPanel } from "@/pages/onchain-world/dashboard/TokenPanel";
import { TopBar } from "@/pages/onchain-world/dashboard/TopBar";
import { TrendingFeed } from "@/pages/onchain-world/dashboard/TrendingFeed";
import { WalletPanel } from "@/pages/onchain-world/dashboard/WalletPanel";
import { TooltipProvider } from "@/pages/onchain-world/dashboard/ui/tooltip";
import { useOrbitxStore } from "@/pages/onchain-world/lib/orbitx/store";
import "../ox-dash.css";
import "../onchain-world.css";

export function Dashboard() {
  const page = useOrbitxStore((s) => s.mobilePanel);
  const selectedToken = useOrbitxStore((s) => s.selectedToken);
  const depth = selectedToken ? <TokenPanel /> : <WalletPanel />;

  return (
    <TooltipProvider>
      <div className="ox-dash fixed inset-0 z-[80] flex flex-col overflow-hidden bg-bg text-fg">
        <TopBar />
        <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)_minmax(168px,22vh)]">
          <div className="flex min-h-0 flex-col overflow-hidden border-r border-line">
            <div className="min-h-0 flex-[1.15]">
              <TrendingFeed />
            </div>
            <div className="min-h-0 flex-1 border-t border-line">
              <LiveEvents />
            </div>
          </div>
          <section aria-label="World" className="flex min-h-0 flex-col overflow-hidden">
            <CenterStage />
          </section>
          <div className="flex min-h-0 flex-col overflow-hidden border-l border-line">
            <div className="min-h-0 flex-1 overflow-hidden">{depth}</div>
            <div className="shrink-0 border-t border-line">
              <EventBreakdown />
            </div>
          </div>
          <div className="col-span-3 min-h-0 border-t border-line">
            <BottomPanel />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden lg:hidden">
          {page === "world" ? (
            <section aria-label="World" className="flex h-full min-h-0 flex-col">
              <CenterStage />
            </section>
          ) : null}
          {page === "feed" ? (
            <section aria-label="Trending" className="flex h-full min-h-0 flex-col">
              <TrendingFeed />
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
              {depth}
            </section>
          ) : null}
        </div>
        <StatusBar />
        <MobileNav />
      </div>
    </TooltipProvider>
  );
}
