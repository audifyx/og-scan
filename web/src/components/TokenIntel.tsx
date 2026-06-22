/**
 * TokenIntel — Merged deep-dive for any token.
 * Combines Market Pulse (OgStats), Pairs, Whales + Wallet X-Ray + Copy Trading, TX Feed, and Charts.
 */
import { lazy, Suspense, useState } from "react";
import { Activity, Radar, Crown, Radio, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmeraldHeader, SegmentedTabs } from "@/components/ToolPageShell";
import { shortAddr } from "@/lib/og";

import { OgStats } from "@/components/OgStats";
import { PairTracker } from "@/components/PairTracker";
import { Whales } from "@/components/Whales";
import { TxFeed } from "@/components/TxFeed";
import { WalletXRay } from "@/components/wallets-20x/WalletXRay";
import { CopyTradingFeed } from "@/components/wallets-20x/CopyTradingFeed";

const ChartsPage = lazy(() => import("@/pages/Charts"));

type IntelTab = "vitals" | "pairs" | "whales" | "tx-feed" | "charts";

const INTEL_TABS: { id: IntelTab; label: string; Icon: typeof Activity }[] = [
  { id: "vitals",  label: "Vitals",  Icon: Activity },
  { id: "pairs",   label: "Pairs",   Icon: Radar },
  { id: "whales",  label: "Whales",  Icon: Crown },
  { id: "tx-feed", label: "TX Feed", Icon: Radio },
  { id: "charts",  label: "Charts",  Icon: LineChart },
];

type Props = {
  mint: string;
  onSelect: (mint: string) => void;
  initialTab?: IntelTab;
};

export const TokenIntel = ({ mint, onSelect, initialTab = "vitals" }: Props) => {
  const [active, setActive] = useState<IntelTab>(initialTab);
  const [selectedWallet, setSelectedWallet] = useState("");

  return (
    <section className="space-y-4">
      <EmeraldHeader
        icon={Activity}
        title="Token Intel"
        subtitle="Deep-dive any token — vitals, new pairs, whale concentration, live TX tape, and charts in one view."
        badge="Deep Dive"
      />

      <SegmentedTabs tabs={INTEL_TABS} active={active} onChange={setActive} />

      {/* Content */}
      {active === "vitals" && <OgStats mint={mint} onSelect={onSelect} />}
      {active === "pairs" && <PairTracker onSelect={onSelect} />}
      {active === "whales" && (
        <div className="space-y-4">
          <Whales mint={mint} onSelectWallet={setSelectedWallet} />
          {selectedWallet ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-og-cyan">Wallet X-Ray: {shortAddr(selectedWallet)}</h3>
                <button onClick={() => setSelectedWallet("")} className="text-[10px] text-white/40 hover:text-white">Clear</button>
              </div>
              <WalletXRay walletAddress={selectedWallet} compact={false} />
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-8 text-center">
              <p className="text-xs text-white/30 uppercase tracking-widest">Select a whale to inspect their wallet</p>
            </div>
          )}
          <CopyTradingFeed onSelectMint={onSelect} />
        </div>
      )}
      {active === "tx-feed" && <TxFeed mint={mint} />}
      {active === "charts" && (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-6 w-6 border-2 border-[#22d3ee] border-t-transparent rounded-full animate-spin" /></div>}>
          <ChartsPage />
        </Suspense>
      )}
    </section>
  );
};
