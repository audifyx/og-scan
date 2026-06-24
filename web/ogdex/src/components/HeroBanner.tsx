import { Link } from "react-router-dom";
import { Rocket, ShoppingBag, ShieldCheck } from "lucide-react";

export default function HeroBanner() {
  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-white/10 ring-brand">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/OGDEX/ogdex-banner.jpg)" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg/85 to-transparent" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/OGDEX/ogdex-logo.png" alt="OG DEX" width={64} height={64}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl ring-brand shrink-0 animate-float-slow" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight leading-tight">
              OG<span className="text-brand-gradient">DEX</span>
              <span className="hidden sm:inline text-muted font-semibold text-base"> — Solana Token Screener</span>
            </h1>
            <p className="text-[11px] sm:text-sm text-muted mt-0.5 leading-snug">
              OG Score · organic momentum · instant safety checks · live multi-chain discovery
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-accent" /> Safety checks</span>
              <span className="inline-flex items-center gap-1"><Rocket className="w-3.5 h-3.5 text-accent2" /> Pump.fun live</span>
            </div>
          </div>
        </div>

        <div className="flex flex-row sm:flex-col gap-2 sm:ml-auto sm:shrink-0">
          <Link to="/launch" className="flex-1 sm:flex-none btn brand-gradient text-black font-bold inline-flex items-center gap-1.5 justify-center shadow-lg shadow-accent/20">
            <Rocket className="w-3.5 h-3.5" /> Launch a Token
          </Link>
          <Link to="/store" className="flex-1 sm:flex-none btn bg-white/10 border border-white/10 text-white hover:bg-white/15 inline-flex items-center gap-1.5 justify-center">
            <ShoppingBag className="w-3.5 h-3.5" /> List &amp; Boost
          </Link>
        </div>
      </div>
    </div>
  );
}
