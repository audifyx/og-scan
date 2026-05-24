/**
 * ProDashboard — Premium/Pro feature showcase + gated tools.
 * Shows: AI token analysis, advanced alerts, whale tracking, priority data.
 * Free tier preview with upgrade prompts for premium features.
 */
import { useState } from "react";
import { Crown, Zap, Shield, TrendingUp, Bell, BarChart3, Eye, Brain, Rocket, Star, Lock, Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProFeature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isFree: boolean;
  comingSoon?: boolean;
}

const FEATURES: ProFeature[] = [
  { id: "ai-analysis", title: "AI Token Analysis", description: "GPT-powered deep analysis of any token's fundamentals, team, and risk", icon: <Brain className="h-5 w-5" />, isFree: false },
  { id: "whale-alerts", title: "Real-time Whale Alerts", description: "Instant notifications when whales buy/sell your tracked tokens", icon: <Bell className="h-5 w-5" />, isFree: false },
  { id: "advanced-charts", title: "Advanced Charts", description: "Multi-timeframe charts with drawing tools and indicators", icon: <BarChart3 className="h-5 w-5" />, isFree: true },
  { id: "portfolio", title: "Portfolio Tracker", description: "Track all your holdings with P&L, cost basis, and performance", icon: <TrendingUp className="h-5 w-5" />, isFree: true },
  { id: "scanner-pro", title: "Scanner Pro", description: "Unlimited scans with priority API access and deeper analysis", icon: <Shield className="h-5 w-5" />, isFree: false },
  { id: "copy-trade", title: "Copy Trade Signals", description: "Follow top traders and get notified of their moves in real-time", icon: <Eye className="h-5 w-5" />, isFree: false },
  { id: "early-alerts", title: "Early Launch Alerts", description: "Be first to know about new launches matching your filters", icon: <Rocket className="h-5 w-5" />, isFree: false },
  { id: "priority-data", title: "Priority Data Feed", description: "Faster data updates, no rate limits, historical data access", icon: <Zap className="h-5 w-5" />, isFree: false, comingSoon: true },
];

const TIERS = [
  {
    name: "Free",
    price: "$0",
    features: ["Basic scanning", "Community access", "Discover feed", "Paper trading", "Spaces access"],
    accent: "border-white/[0.08]",
    badge: null,
  },
  {
    name: "OG Pro",
    price: "$9.99/mo",
    features: ["Everything in Free", "AI Token Analysis", "Whale Alerts", "Scanner Pro", "Copy Trade Signals", "Early Launch Alerts", "Priority Support"],
    accent: "border-primary/30 bg-primary/5",
    badge: "Most Popular",
  },
  {
    name: "OG Elite",
    price: "$24.99/mo",
    features: ["Everything in Pro", "Priority Data Feed", "Custom Webhooks", "API Access", "White-label reports", "1-on-1 support"],
    accent: "border-amber-500/30 bg-amber-500/5",
    badge: "Best Value",
  },
];

export const ProDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<"features" | "pricing">("features");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-white">OG Pro</h2>
            <p className="text-[11px] text-white/30">Unlock advanced tools for serious traders</p>
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30">Coming Soon</Badge>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {(["features", "pricing"] as const).map(v => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all",
              activeView === v ? "bg-primary/10 text-primary" : "text-white/20"
            )}
          >
            {v === "features" ? "⚡ Features" : "💎 Pricing"}
          </button>
        ))}
      </div>

      {activeView === "features" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FEATURES.map(f => (
            <div
              key={f.id}
              className={cn("rounded-xl border p-4 transition-all hover:border-primary/20",
                f.isFree ? "border-white/[0.08] bg-white/[0.02]" : "border-white/[0.06] bg-white/[0.01]"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-xl",
                  f.isFree ? "bg-primary/10 text-primary" : "bg-white/[0.04] text-white/20"
                )}>
                  {f.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white">{f.title}</p>
                    {f.comingSoon ? (
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[7px]">Soon</Badge>
                    ) : f.isFree ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[7px]">Free</Badge>
                    ) : (
                      <Lock className="h-2.5 w-2.5 text-white/15" />
                    )}
                  </div>
                  <p className="text-[10px] text-white/25 mt-0.5">{f.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TIERS.map(tier => (
            <div key={tier.name} className={cn("rounded-xl border p-4 relative", tier.accent)}>
              {tier.badge && (
                <Badge className="absolute -top-2 right-3 bg-primary text-white text-[8px]">{tier.badge}</Badge>
              )}
              <p className="text-lg font-black text-white">{tier.name}</p>
              <p className="text-2xl font-black text-primary mt-1">{tier.price}</p>
              <div className="mt-3 space-y-1.5">
                {tier.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-[10px] text-white/40">{f}</span>
                  </div>
                ))}
              </div>
              <button className={cn("w-full mt-4 py-2 rounded-lg text-xs font-bold transition-all",
                tier.name === "Free"
                  ? "bg-white/[0.04] text-white/30"
                  : "bg-primary text-white hover:bg-primary/80"
              )}>
                {tier.name === "Free" ? "Current Plan" : "Coming Soon"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProDashboard;
