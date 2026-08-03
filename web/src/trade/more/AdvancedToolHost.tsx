import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";

const loaders: Record<string, () => Promise<{ default: ComponentType }>> = {
  "Token Sniper": () => import("@/components/tools/TokenSniper").then((m) => ({ default: m.TokenSniper })),
  "Wallet Profiler": () => import("@/components/tools/WalletProfiler").then((m) => ({ default: m.WalletProfiler })),
  "Holder Analysis": () => import("@/components/tools/HolderAnalysis").then((m) => ({ default: m.HolderAnalysis })),
  "Liquidity Scanner": () => import("@/components/tools/LiquidityScanner").then((m) => ({ default: m.LiquidityScanner })),
  "Staking Calculator": () => import("@/components/tools/StakingCalculator").then((m) => ({ default: m.StakingCalculator })),
  "Impermanent Loss": () =>
    import("@/components/tools/ImpermanentLossCalculator").then((m) => ({ default: m.ImpermanentLossCalculator })),
  "Jupiter Routes": () =>
    import("@/components/advanced-tools/JupiterRouteTracker").then((m) => ({ default: m.JupiterRouteTracker })),
  "Program Monitor": () =>
    import("@/components/advanced-tools/ProgramInteractionMonitor").then((m) => ({
      default: m.ProgramInteractionMonitor,
    })),
  "LP Scanner": () =>
    import("@/components/advanced-tools/LPPositionScanner").then((m) => ({ default: m.LPPositionScanner })),
  "Token Metadata": () =>
    import("@/components/advanced-tools/TokenMetadataInspector").then((m) => ({
      default: m.TokenMetadataInspector,
    })),
  "Wallet Age": () =>
    import("@/components/advanced-tools/WalletAgeCalculator").then((m) => ({ default: m.WalletAgeCalculator })),
  "Token Creator": () =>
    import("@/components/advanced-tools/TokenCreatorTracker").then((m) => ({ default: m.TokenCreatorTracker })),
  "Risk Detector": () => import("@/components/advanced-tools/RiskDetector").then((m) => ({ default: m.RiskDetector })),
  "Stake Tracker": () =>
    import("@/components/advanced-tools/StakeAccountTracker").then((m) => ({ default: m.StakeAccountTracker })),
  "Transfer Profiler": () =>
    import("@/components/advanced-tools/TransferProfiler").then((m) => ({ default: m.TransferProfiler })),
  "Rug Detector": () => import("@/components/advanced-tools/RugDetector").then((m) => ({ default: m.RugDetector })),
  "Burn Watcher": () => import("@/components/advanced-tools/BurnWatcher").then((m) => ({ default: m.BurnWatcher })),
  "Wallet Graph": () =>
    import("@/components/advanced-tools/WalletRelationshipGraph").then((m) => ({
      default: m.WalletRelationshipGraph,
    })),
  "MEV Tracker": () => import("@/components/advanced-tools/MEVTracker").then((m) => ({ default: m.MEVTracker })),
  "Fee Analyzer": () => import("@/components/advanced-tools/FeeAnalyzer").then((m) => ({ default: m.FeeAnalyzer })),
  "Whale Concentration": () =>
    import("@/components/advanced-tools/WhaleConcentration").then((m) => ({ default: m.WhaleConcentration })),
  "Trading Style": () =>
    import("@/components/advanced-tools/TradingStyleClassifier").then((m) => ({
      default: m.TradingStyleClassifier,
    })),
  "Liquidity Sniper": () =>
    import("@/components/advanced-tools/LiquiditySniper").then((m) => ({ default: m.LiquiditySniper })),
  "Airdrop Analyzer": () =>
    import("@/components/advanced-tools/AirdropAnalyzer").then((m) => ({ default: m.AirdropAnalyzer })),
  "Wash Trading": () =>
    import("@/components/advanced-tools/WashTradingScanner").then((m) => ({ default: m.WashTradingScanner })),
  "Token Locks": () =>
    import("@/components/advanced-tools/TokenLockMonitor").then((m) => ({ default: m.TokenLockMonitor })),
  "SOL Depletion": () =>
    import("@/components/advanced-tools/SolDepletionWarning").then((m) => ({ default: m.SolDepletionWarning })),
  "Profit Curve": () =>
    import("@/components/advanced-tools/ProfitCurveGenerator").then((m) => ({ default: m.ProfitCurveGenerator })),
  "Insider Detector": () =>
    import("@/components/advanced-tools/InsiderDetector").then((m) => ({ default: m.InsiderDetector })),
  "Multi-Wallet": () =>
    import("@/components/advanced-tools/MultiWalletMerge").then((m) => ({ default: m.MultiWalletMerge })),
};

const cache = new Map<string, ComponentType>();

function getLazy(key: string): ComponentType | null {
  if (!loaders[key]) return null;
  if (!cache.has(key)) {
    cache.set(key, lazy(loaders[key]));
  }
  return cache.get(key)!;
}

export default function AdvancedToolHost({ toolKey }: { toolKey: string }) {
  const Comp = getLazy(toolKey);
  if (!Comp) {
    return <p className="text-sm text-white/45">Tool unavailable.</p>;
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-[#050505] p-3 [&_*]:max-w-full">
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 py-16 text-white/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tool…
          </div>
        }
      >
        <Comp />
      </Suspense>
    </div>
  );
}
