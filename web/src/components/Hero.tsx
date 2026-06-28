import { ArrowRight, Crosshair, ExternalLink, SearchCode, ShieldCheck, Zap } from "lucide-react";
import { OGSCAN_BRAND_IMAGE, OGSCAN_SITE_URL, OGSCAN_X_URL } from "@/lib/og";

type HeroProps = {
  onScanClick: () => void;
  onSwapClick: () => void;
};

const heroSignals: string[] = ["Created on-chain", "Migration separate", "Copycat check", "Direct tool pages"];

export const Hero = ({ onScanClick, onSwapClick }: HeroProps) => {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 grid-bg opacity-32" />
      <div className="absolute inset-0 noise" />
      {/* Glow orbs — larger and more dramatic */}
      <div className="pointer-events-none absolute -top-56 left-[15%] h-[700px] w-[700px] rounded-full bg-og-cyan/12 blur-[140px]" />
      <div className="pointer-events-none absolute -right-40 top-16 h-[600px] w-[600px] rounded-full bg-og-lime/18 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 left-[40%] h-[300px] w-[300px] rounded-full bg-og-cyan/8 blur-[100px]" />

      <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:py-14">
        {/* Left column */}
        <div className="order-2 lg:order-1">
          {/* Badges */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-og-lime/40 bg-og-lime/10 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-og-lime">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-lime opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-og-lime" />
              </span>
              Solana mainnet live
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/70">
              <ShieldCheck className="h-3.5 w-3.5 text-og-cyan" /> OG = mint creation date
            </div>
          </div>

          {/* Headline — restored punchy original */}
          <h1 className="max-w-4xl font-display text-[clamp(3.2rem,8vw,7rem)] font-black uppercase leading-[0.84] tracking-tighter">
            <span className="block text-white text-glow-gold">Find the real OG</span>
            <span className="block text-og-lime text-glow">before the</span>
            <span className="block text-white">market does.</span>
          </h1>

          {/* Subheading */}
          <p className="mt-6 max-w-2xl text-lg font-semibold leading-7 text-white/85 sm:text-xl sm:leading-8">
            Paste any mint, prove first origin, rank dominance — stop guessing which token is actually OG.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Price action and migrations don't decide OG status. OGScan focuses on on-chain creation data, then layers in liquidity, ATH, DEX signals, boosts, and safety context.
          </p>

          {/* CTAs */}
          <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-[1.3fr_0.7fr]">
            <button
              onClick={onScanClick}
              className="group relative inline-flex min-h-[4.5rem] items-center justify-between gap-4 overflow-hidden rounded-[1.4rem] border border-og-lime bg-og-lime px-5 py-4 text-left text-og-ink shadow-[0_0_60px_-14px_hsl(var(--og-lime))] transition hover:bg-white hover:shadow-[0_0_80px_-12px_hsl(var(--og-lime))] active:scale-[0.985]"
            >
              <span className="absolute inset-y-0 right-0 w-28 bg-white/30 blur-2xl transition group-hover:translate-x-6" />
              <span className="relative">
                <span className="block font-mono text-[10px] font-black uppercase tracking-[0.24em] opacity-65">Main workspace</span>
                <span className="mt-1 block font-display text-2xl font-black uppercase leading-none sm:text-[1.75rem]">Open Truth Scan</span>
              </span>
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-og-ink text-og-lime shadow-inner transition group-hover:scale-110">
                <SearchCode className="h-6 w-6" />
              </span>
            </button>
            <button
              onClick={onSwapClick}
              className="group inline-flex min-h-[4.5rem] items-center justify-between gap-3 rounded-[1.4rem] border border-white/12 bg-white/[0.06] px-5 py-4 text-left font-display text-lg font-black uppercase text-white/80 transition hover:border-og-cyan/60 hover:bg-white/[0.09] hover:text-og-cyan active:scale-[0.985]"
            >
              Swap <Zap className="h-5 w-5 transition group-hover:text-og-cyan" />
            </button>
          </div>

          {/* Signal pills */}
          <div className="mt-5 grid max-w-xl gap-2 sm:grid-cols-4">
            {heroSignals.map((item: string) => (
              <div key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-center font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/55 transition hover:border-og-lime/30 hover:text-white/75">
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Right column — Tool stack panel */}
        <div className="order-1 lg:order-2">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_40px_140px_-80px_hsl(var(--og-cyan))] backdrop-blur-xl sm:p-4">
            {/* Top gradient bar */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-og-cyan via-og-lime to-og-cyan/40" />

            {/* Brand image link */}
            <a href={OGSCAN_X_URL} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-[1.45rem] border border-white/10 bg-black/50">
              <div className="relative aspect-[16/9] max-h-[300px] w-full overflow-hidden sm:aspect-[21/10]">
                <div className="absolute inset-0 grid-bg opacity-36" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,hsl(var(--og-lime)/0.18),transparent_34%),linear-gradient(180deg,hsl(var(--og-ink)/0.08),hsl(var(--og-ink)/0.72))]" />
                <img src={OGSCAN_BRAND_IMAGE} alt="OG Scan radar banner" className="relative h-full w-full object-contain p-4 transition duration-700 group-hover:scale-[1.03] sm:p-6" />
                <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-og-lime/35 bg-og-ink/75 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-og-lime backdrop-blur">
                  X <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            </a>

            {/* Radar + Tool map */}
            <div className="mt-3 grid gap-3 sm:grid-cols-[0.95fr_1.05fr]">
              <RadarBadge />
              <div className="rounded-[1.35rem] border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.24em] text-og-cyan">Tool map</p>
                <div className="mt-3 space-y-2">
                  {[
                    { label: "Scanner", accent: "text-og-lime border-og-lime/25 bg-og-lime/5" },
                    { label: "Snipe Feed", accent: "text-og-cyan border-og-cyan/25 bg-og-cyan/5" },
                    { label: "OG Finder", accent: "text-white/80 border-white/15 bg-white/5" },
                    { label: "Migrations", accent: "text-og-gold border-og-gold/25 bg-og-gold/5" },
                  ].map((tool, index) => (
                    <div key={tool.label} className={`flex items-center justify-between rounded-full border ${tool.accent} px-3 py-2 transition hover:brightness-110`}>
                      <span className="font-display text-sm font-black uppercase text-white">{tool.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-og-lime/70">0{index + 1}</span>
                    </div>
                  ))}
                </div>
                <a href={OGSCAN_SITE_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/50 underline underline-offset-4 transition hover:text-og-lime">
                  ogscan.fun <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const RadarBadge = () => {
  return (
    <div className="relative mx-auto h-[220px] w-full min-w-[220px] overflow-hidden rounded-[1.35rem] border border-white/10 bg-og-ink/80 sm:h-full">
      <div className="absolute inset-0 grid-bg opacity-25" />
      {/* Outer glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--og-lime)/0.06),transparent_70%)]" />
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 spin-slow">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <defs>
            <radialGradient id="rg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--og-lime) / 0.52)" />
              <stop offset="100%" stopColor="hsl(var(--og-lime) / 0)" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="98" stroke="hsl(var(--og-lime) / 0.45)" strokeWidth="0.6" fill="none" />
          <circle cx="100" cy="100" r="74" stroke="hsl(var(--og-cyan) / 0.35)" strokeWidth="0.4" fill="none" strokeDasharray="2 4" />
          <circle cx="100" cy="100" r="50" stroke="hsl(var(--og-lime) / 0.25)" strokeWidth="0.4" fill="none" />
          <circle cx="100" cy="100" r="26" stroke="hsl(var(--og-gold) / 0.2)" strokeWidth="0.3" fill="none" />
          <line x1="100" y1="2" x2="100" y2="198" stroke="hsl(var(--og-lime) / 0.18)" strokeWidth="0.3" />
          <line x1="2" y1="100" x2="198" y2="100" stroke="hsl(var(--og-cyan) / 0.18)" strokeWidth="0.3" />
          <path d="M100 100 L100 2 A98 98 0 0 1 196 110 Z" fill="url(#rg)" />
        </svg>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-og-gold bg-og-ink shadow-og-gold sm:h-32 sm:w-32">
          <img src="/og-icon.svg" alt="OG Scan" className="absolute inset-0 h-full w-full scale-125 object-cover" />
          <div className="absolute inset-2 rounded-full border border-og-gold/40" />
          <Crosshair className="absolute right-3 top-3 h-3 w-3 text-og-lime" />
          <Crosshair className="absolute bottom-3 left-3 h-3 w-3 text-og-lime" />
        </div>
      </div>

      <Blip x="7%" y="18%" label="CHAIN" />
      <Blip x="68%" y="16%" label="OG/SOL" />
      <Blip x="9%" y="76%" label="MINT" tone="lime" />
      <Blip x="64%" y="74%" label="DEX+" tone="gold" />
    </div>
  );
};

const Blip = ({ x, y, label, tone = "cyan" }: { x: string; y: string; label: string; tone?: "lime" | "gold" | "cyan" }) => {
  const color = tone === "lime" ? "text-og-lime border-og-lime/60" : tone === "gold" ? "text-og-gold border-og-gold/60" : "text-og-cyan border-og-cyan/60";
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div className={`flex items-center gap-1 rounded-full border ${color} bg-og-ink/80 px-2 py-1 text-[9px] uppercase tracking-widest`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </div>
    </div>
  );
};
