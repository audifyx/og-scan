import { Link } from "react-router-dom";
import { Rocket, ShoppingBag, ShieldCheck, Sparkles } from "lucide-react";

export default function HeroBanner() {
  return (
    <div className="relative mb-4 overflow-hidden rounded-3xl border ring-brand" style={{ borderColor: "rgba(47,128,255,0.25)" }}>
      {/* Custom OG SCAN key visual */}
      <div className="absolute inset-0 bg-cover bg-center scale-105" style={{ backgroundImage: "url(/OGDEX/ogdex-hero.jpg)" }} />
      {/* Glass legibility gradients */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(4,6,14,0.92) 0%, rgba(4,6,14,0.62) 42%, rgba(4,6,14,0.18) 70%, rgba(4,6,14,0.45) 100%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(4,6,14,0.95) 0%, transparent 55%)" }} />
      {/* Top sheen */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(47,128,255,0.7), rgba(255,197,61,0.5), transparent)" }} />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 sm:px-8 py-6 sm:py-8">
        <div className="flex items-center gap-3.5 min-w-0">
          <img src="/OGDEX/ogdex-logo.png" alt="OG DEX" width={64} height={64}
            className="w-14 h-14 sm:w-[68px] sm:h-[68px] rounded-2xl ring-brand shrink-0 animate-float-slow" />
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 mb-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ background: "rgba(47,128,255,0.12)", border: "1px solid rgba(47,128,255,0.3)", color: "#7FB0FF" }}>
              <Sparkles className="w-3 h-3" style={{ color: "#FFC53D" }} /> Solana On-Chain Intelligence
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight leading-none">
              OG<span className="text-brand-gradient">DEX</span>
              <span className="hidden sm:inline text-muted font-bold text-lg align-middle"> · Token Screener</span>
            </h1>
            <p className="text-[12px] sm:text-sm text-muted mt-1.5 leading-snug max-w-md">
              OG Score · organic momentum · instant safety checks · live multi-chain discovery
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" style={{ color: "#2F80FF" }} /> Safety checks</span>
              <span className="inline-flex items-center gap-1"><Rocket className="w-3.5 h-3.5" style={{ color: "#9945FF" }} /> Pump.fun live</span>
              <span className="inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" style={{ color: "#FFC53D" }} /> 16 chains</span>
            </div>
          </div>
        </div>

        <div className="flex flex-row sm:flex-col gap-2 sm:ml-auto sm:shrink-0">
          <Link to="/launch" className="flex-1 sm:flex-none btn brand-gradient text-black font-bold inline-flex items-center gap-1.5 justify-center shadow-glow-blue">
            <Rocket className="w-3.5 h-3.5" /> Launch a Token
          </Link>
          <Link to="/store" className="flex-1 sm:flex-none btn inline-flex items-center gap-1.5 justify-center text-white transition-all"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <ShoppingBag className="w-3.5 h-3.5" /> List &amp; Boost
          </Link>
        </div>
      </div>
    </div>
  );
}
