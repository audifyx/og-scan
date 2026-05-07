import { Crosshair, SearchCode, Zap } from "lucide-react";

type HeroProps = {
  onScanClick: () => void;
  onSwapClick: () => void;
};

export const Hero = ({ onScanClick, onSwapClick }: HeroProps) => {
  return (
    <section className="relative overflow-hidden border-b border-og-grid">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute inset-0 noise" />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-og-lime/15 blur-[120px]" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-6 py-20 lg:flex-row lg:items-center lg:py-28">
        <div className="flex-1">
          <div className="mb-6 inline-flex items-center gap-2 border border-og-lime/40 bg-og-lime/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-og-lime">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-lime opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-og-lime" />
            </span>
            LIVE FEED // SOLANA MAINNET
          </div>

          <h1 className="font-display text-[clamp(3rem,9vw,7.5rem)] font-bold leading-[0.85] tracking-tighter">
            <span className="block text-og-gold text-glow-gold flicker">ogscan</span>
            <span className="block text-foreground text-glow">.fun</span>
            <span className="block text-[0.35em] mt-3 text-muted-foreground tracking-[0.4em]">
              OG_COIN_RADAR.SOL
            </span>
          </h1>

          <div className="mt-6 max-w-2xl space-y-4">
            <p className="text-lg font-semibold leading-snug text-foreground sm:text-2xl">
              This is OG. That is OG. Everyone claims OG — but which one is actually OG?
            </p>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              OG SCAN identifies true early pairs on Solana: not what is trending later, not influencer noise,
              but what was there first. The origin. The real starting point.
            </p>
          </div>

          <div className="mt-6 grid max-w-2xl gap-2 sm:grid-cols-3">
            {[
              "First pair ever created",
              "Clean real-time data",
              "No-noise signal UI",
            ].map((item) => (
              <div key={item} className="border border-og-grid bg-og-ink/70 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                <span className="mr-2 text-og-lime">//</span>{item}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onScanClick}
              className="group relative inline-flex items-center gap-2 border border-og-lime bg-og-lime px-5 py-3 text-sm font-bold uppercase tracking-widest text-og-ink transition hover:bg-og-lime/90 pulse-glow"
            >
              <SearchCode className="h-4 w-4" />
              Run Scanner
              <span className="ml-2 text-[10px] opacity-70 group-hover:opacity-100">[/]</span>
            </button>
            <button
              onClick={onSwapClick}
              className="inline-flex items-center gap-2 border border-og-gold bg-transparent px-5 py-3 text-sm font-bold uppercase tracking-widest text-og-gold transition hover:bg-og-gold hover:text-og-ink"
            >
              <Zap className="h-4 w-4" />
              Swap on Jupiter
            </button>
          </div>

          <div className="mt-8 border-l-2 border-og-lime/70 bg-og-lime/5 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.26em] text-og-lime">
            We detect trends before they exist · scanning the chain for OG signals
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <div className="border-l-2 border-og-lime/60 pl-3">
              <div className="text-og-lime">JUPITER</div>
              <div className="text-foreground/70">routing</div>
            </div>
            <div className="border-l-2 border-og-gold/60 pl-3">
              <div className="text-og-gold">BIRDEYE</div>
              <div className="text-foreground/70">candles</div>
            </div>
            <div className="border-l-2 border-og-cyan/60 pl-3">
              <div className="text-og-cyan">HELIUS</div>
              <div className="text-foreground/70">tape</div>
            </div>
          </div>
        </div>

        <div className="relative flex-1 lg:flex lg:justify-end">
          <RadarBadge />
        </div>
      </div>
    </section>
  );
};

const RadarBadge = () => {
  return (
    <div className="relative mx-auto h-[320px] w-[320px] sm:h-[420px] sm:w-[420px]">
      <div className="absolute inset-0 spin-slow">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <defs>
            <radialGradient id="rg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(78 100% 55% / 0.55)" />
              <stop offset="100%" stopColor="hsl(78 100% 55% / 0)" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="98" stroke="hsl(78 100% 55% / 0.5)" strokeWidth="0.6" fill="none" />
          <circle cx="100" cy="100" r="74" stroke="hsl(78 100% 55% / 0.35)" strokeWidth="0.4" fill="none" strokeDasharray="2 4" />
          <circle cx="100" cy="100" r="50" stroke="hsl(78 100% 55% / 0.25)" strokeWidth="0.4" fill="none" />
          <circle cx="100" cy="100" r="26" stroke="hsl(78 100% 55% / 0.18)" strokeWidth="0.3" fill="none" />
          <line x1="100" y1="2" x2="100" y2="198" stroke="hsl(78 100% 55% / 0.2)" strokeWidth="0.3" />
          <line x1="2" y1="100" x2="198" y2="100" stroke="hsl(78 100% 55% / 0.2)" strokeWidth="0.3" />
          <path d="M100 100 L100 2 A98 98 0 0 1 196 110 Z" fill="url(#rg)" />
        </svg>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-og-gold/15 blur-2xl" />
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-og-gold bg-og-ink shadow-og-gold sm:h-52 sm:w-52">
            <div className="absolute inset-2 rounded-full border border-og-gold/40" />
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,hsl(78_100%_55%/0.45),transparent_60%)]" />
            <span className="font-display text-5xl font-bold text-og-gold text-glow-gold sm:text-6xl">
              OG
            </span>
            <Crosshair className="absolute right-3 top-3 h-3 w-3 text-og-lime" />
            <Crosshair className="absolute bottom-3 left-3 h-3 w-3 text-og-lime" />
          </div>
        </div>
      </div>

      {/* Floating data blips */}
      <Blip x="10%" y="20%" label="0x9F.4A" />
      <Blip x="78%" y="18%" label="OG/SOL" />
      <Blip x="14%" y="78%" label="+312%" tone="lime" />
      <Blip x="80%" y="74%" label="MCAP 4.2M" tone="gold" />
    </div>
  );
};

const Blip = ({ x, y, label, tone = "cyan" }: { x: string; y: string; label: string; tone?: "lime" | "gold" | "cyan" }) => {
  const color = tone === "lime" ? "text-og-lime border-og-lime/60" : tone === "gold" ? "text-og-gold border-og-gold/60" : "text-og-cyan border-og-cyan/60";
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div className={`flex items-center gap-1 border ${color} bg-og-ink/80 px-2 py-1 text-[9px] uppercase tracking-widest`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </div>
    </div>
  );
};
