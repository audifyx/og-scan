import { useNavigate } from "react-router-dom";
import {
  Rocket, MessageSquare, Bell, ArrowRight, Zap, Users,
  TrendingUp, Radio, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Hub cards ─────────────────────────────────────────────────────────── */

const hubs = [
  {
    to: "/launch",
    icon: Rocket,
    label: "Token Launcher",
    eyebrow: "Launch & track tokens",
    description: "Create and launch Solana tokens, manage your portfolio of launched assets, and track live price action.",
    accentFrom: "from-og-lime/20",
    accentTo: "to-emerald-500/10",
    border: "border-og-lime/20 hover:border-og-lime/45",
    iconBg: "bg-og-lime/15 border-og-lime/30 text-og-lime",
    glow: "shadow-[0_0_60px_-20px_hsl(var(--og-lime))]",
    tag: "Launch",
    tagColor: "bg-og-lime/15 text-og-lime border-og-lime/25",
    stats: [
      { label: "Launch Fee", value: "$3" },
      { label: "On-chain", value: "Solana" },
    ],
  },
  {
    to: "/trading-lobbies",
    icon: MessageSquare,
    label: "Trading Lobbies",
    eyebrow: "Voice + live charts",
    description: "Join live trading rooms with voice, shared watchlists, and real-time chart discussion with other traders.",
    accentFrom: "from-og-cyan/20",
    accentTo: "to-sky-500/10",
    border: "border-og-cyan/20 hover:border-og-cyan/45",
    iconBg: "bg-og-cyan/15 border-og-cyan/30 text-og-cyan",
    glow: "shadow-[0_0_60px_-20px_hsl(var(--og-cyan))]",
    tag: "Live",
    tagColor: "bg-og-cyan/15 text-og-cyan border-og-cyan/25",
    stats: [
      { label: "Voice", value: "LiveKit" },
      { label: "Charts", value: "Live" },
    ],
  },
  {
    to: "/callouts",
    icon: Bell,
    label: "Callouts",
    eyebrow: "Trade alerts",
    description: "Post and track token and wallet callouts. Monitor community calls, copy trade signals, and measure accuracy.",
    accentFrom: "from-violet-500/20",
    accentTo: "to-purple-500/10",
    border: "border-violet-400/20 hover:border-violet-400/45",
    iconBg: "bg-violet-500/15 border-violet-400/30 text-violet-200",
    glow: "shadow-[0_0_60px_-20px_rgba(167,139,250,0.6)]",
    tag: "Signals",
    tagColor: "bg-violet-500/15 text-violet-200 border-violet-400/25",
    stats: [
      { label: "Tokens", value: "SOL" },
      { label: "Wallets", value: "Track" },
    ],
  },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

// Named export for use inside the tab system (no layout wrapper)
export function TradingHubContent({ onNavigate }: { onNavigate?: (tab: string) => void } = {}) {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-8 lg:px-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-og-lime/30 bg-og-lime/10">
              <TrendingUp className="h-5 w-5 text-og-lime" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Trading Hub</h1>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">Pro Trading Suite</p>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-white/45 max-w-md leading-relaxed">
            Everything you need to trade, launch, and connect — all in one place.
          </p>
        </div>

        {/* ── Hub cards ──────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hubs.map((hub) => {
            const Icon = hub.icon;
            return (
              <button
                key={hub.to}
                type="button"
                onClick={() => navigate(hub.to)}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border bg-white/[0.03] p-6 text-left transition-all duration-300",
                  "hover:bg-white/[0.06] active:scale-[0.98]",
                  hub.border,
                  hub.glow,
                )}
              >
                {/* glow bg */}
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", hub.accentFrom, hub.accentTo)} />

                {/* tag */}
                <span className={cn("relative mb-4 inline-flex items-center self-start rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest", hub.tagColor)}>
                  {hub.tag}
                </span>

                {/* icon + label */}
                <div className="relative flex items-center gap-3 mb-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", hub.iconBg)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[15px] font-black text-white leading-tight">{hub.label}</p>
                    <p className="text-[10px] text-white/35 uppercase tracking-wider">{hub.eyebrow}</p>
                  </div>
                </div>

                {/* description */}
                <p className="relative text-[12px] text-white/50 leading-relaxed flex-1 mb-5">
                  {hub.description}
                </p>

                {/* stats row */}
                <div className="relative flex items-center gap-3 mb-5">
                  {hub.stats.map((s) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">{s.label}</span>
                      <span className="text-[11px] font-bold text-white/60">{s.value}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="relative flex items-center justify-between pt-4 border-t border-white/[0.07]">
                  <span className="text-[12px] font-semibold text-white/50 group-hover:text-white/80 transition-colors">Open</span>
                  <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/70 transition-all group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Quick links ────────────────────────────────────────────────── */}
        <div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-4">Quick Access</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Launch Token",  to: "/launch",           icon: Rocket, color: "text-og-lime" },
              { label: "Join Lobby",    to: "/trading-lobbies",  icon: Radio,  color: "text-og-cyan" },
              { label: "Post Callout",  to: "/callouts",         icon: Zap,    color: "text-violet-300" },
              { label: "Leaderboard",   to: "/leaderboard",      icon: Users,  color: "text-amber-300" },
            ].map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.to}
                  type="button"
                  onClick={() => navigate(link.to)}
                  className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.06] hover:border-white/[0.12] active:scale-[0.97]"
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", link.color)} />
                  <span className="text-[11px] font-semibold text-white/60 truncate">{link.label}</span>
                  <ChevronRight className="h-3 w-3 text-white/20 ml-auto shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

      </div>
  );
}

// Default export kept for any direct /trading-hub route
export default TradingHubContent;
