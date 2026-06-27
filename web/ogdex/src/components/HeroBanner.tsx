import { ShieldCheck, Rocket, Sparkles, Globe } from "lucide-react";

export default function HeroBanner() {
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl"
      style={{
        background: "#000000",
        border: "1px solid rgba(47,128,255,0.22)",
        boxShadow: "0 0 0 1px rgba(0,0,0,1), 0 0 40px rgba(47,128,255,0.08) inset",
      }}>

      {/* Blue glow blob — top-right ambient light */}
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(47,128,255,0.18) 0%, transparent 70%)" }} />
      {/* Subtle grid texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(47,128,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(47,128,255,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
      {/* Top hairline accent */}
      <div className="absolute inset-x-0 top-0 h-[1px]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(47,128,255,0.8), rgba(153,69,255,0.5), transparent)" }} />

      <div className="relative flex flex-col sm:flex-row items-center gap-5 px-5 sm:px-7 py-5 sm:py-6">

        {/* ── Left: Logo box with blue glow ─────────────────────────────── */}
        <div className="shrink-0 relative">
          <div className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: "0 0 28px 4px rgba(47,128,255,0.45), 0 0 0 1px rgba(47,128,255,0.35)" }} />
          <img
            src="/OGDEX/ogdex-logo.png"
            alt="OG DEX"
            width={88}
            height={88}
            className="w-[80px] h-[80px] sm:w-[88px] sm:h-[88px] rounded-2xl relative z-10 block"
            style={{ border: "1px solid rgba(47,128,255,0.4)" }}
          />
        </div>

        {/* ── Center: Badge + headline + tagline + features ──────────────── */}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 mb-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] text-white"
            style={{
              background: "rgba(47,128,255,0.12)",
              border: "1px solid rgba(47,128,255,0.35)",
              boxShadow: "0 0 12px rgba(47,128,255,0.15) inset",
            }}>
            <Sparkles className="w-3 h-3" style={{ color: "#FFC53D" }} />
            Solana On-Chain Intelligence
          </div>

          {/* Headline */}
          <h1 className="font-display text-3xl sm:text-[42px] font-extrabold tracking-tight leading-none mb-2 text-white">
            OG<span className="text-brand-gradient">DEX</span>
            <span className="hidden sm:inline font-semibold text-xl ml-2.5 align-middle"
              style={{ color: "rgba(255,255,255,0.35)" }}>
              · Token Screener
            </span>
          </h1>

          {/* Tagline */}
          <p className="text-[13px] sm:text-sm font-medium mb-3"
            style={{ color: "rgba(255,255,255,0.65)" }}>
            OG Score&nbsp;·&nbsp;organic momentum&nbsp;·&nbsp;instant safety checks&nbsp;·&nbsp;live multi-chain discovery
          </p>

          {/* Feature pills row */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-2">
            {[
              { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: "Safety checks",   color: "#2F80FF" },
              { icon: <Rocket      className="w-3.5 h-3.5" />, label: "Pump.fun live",   color: "#9945FF" },
              { icon: <Globe       className="w-3.5 h-3.5" />, label: "16 chains",       color: "#2F80FF" },
              { icon: <Sparkles    className="w-3.5 h-3.5" />, label: "OG Score™",       color: "#FFC53D" },
            ].map(({ icon, label, color }) => (
              <span key={label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${color}33`,
                  boxShadow: `0 0 8px ${color}18 inset`,
                }}>
                <span style={{ color }}>{icon}</span>
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right: Blue box stat ────────────────────────────────────────── */}
        <div className="shrink-0 hidden sm:flex flex-col items-center justify-center rounded-xl px-5 py-4 text-center"
          style={{
            background: "rgba(47,128,255,0.10)",
            border: "1px solid rgba(47,128,255,0.28)",
            boxShadow: "0 0 24px rgba(47,128,255,0.12) inset",
            minWidth: "110px",
          }}>
          <div className="text-2xl font-black text-white font-display">16+</div>
          <div className="text-[11px] font-semibold uppercase tracking-widest mt-0.5"
            style={{ color: "rgba(47,128,255,0.9)" }}>chains</div>
          <div className="mt-2 pt-2 w-full" style={{ borderTop: "1px solid rgba(47,128,255,0.2)" }}>
            <div className="text-lg font-black text-white font-display">OG™</div>
            <div className="text-[11px] font-semibold uppercase tracking-widest"
              style={{ color: "rgba(47,128,255,0.9)" }}>Score</div>
          </div>
        </div>

      </div>
    </div>
  );
}
