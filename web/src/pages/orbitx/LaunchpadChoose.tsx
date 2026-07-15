// Orbitx Launchpad — "Choose your launch" fork: Pump.fun style vs Custom Orbitx.
import { Link } from "react-router-dom";
import { Rocket, ShieldCheck, Wand2, TrendingUp, ArrowRight, Zap } from "lucide-react";

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 font-mono text-[13px] text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--og-lime))]" />
      <span>{children}</span>
    </li>
  );
}

export default function LaunchpadChoose() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">// select launch mode</div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Choose your launch</h1>
        <p className="mt-1 text-sm text-muted-foreground">Both mint an <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> vanity address.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pump.fun style */}
        <div className="og-glass-card lift group flex flex-col p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--og-cyan))]/60 to-transparent" />
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(var(--og-cyan))]/30 bg-[hsl(var(--og-cyan))]/10"><TrendingUp className="h-5 w-5 text-[hsl(var(--og-cyan))]" /></div>
            <div>
              <div className="font-display text-base font-bold text-foreground">Pump.fun style</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">bonding curve · fastest</div>
            </div>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">Launch instantly with <span className="text-foreground">no liquidity to seed</span> — price and liquidity build from buys &amp; sells, then auto-graduate to a real pool.</p>
          <ul className="mb-6 space-y-2">
            <Feature>Zero seeded liquidity — just launch</Feature>
            <Feature>Liquidity forms from trading, auto-graduates</Feature>
            <Feature>OBX vanity contract address</Feature>
            <Feature>Battle-tested bonding-curve mechanics</Feature>
          </ul>
          <Link to="/orbitxlaunch/create/pump" className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--og-cyan))]/50 bg-[hsl(var(--og-cyan))]/15 px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-cyan))] transition hover:bg-[hsl(var(--og-cyan))]/25">
            <Zap className="h-4 w-4" /> Launch pump-style <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Custom Orbitx */}
        <div className="og-glass-card lift group relative flex flex-col p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(var(--og-gold))]/70 to-transparent" />
          <div className="absolute right-4 top-4 rounded-md border border-[hsl(var(--og-gold))]/30 bg-[hsl(var(--og-gold))]/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--og-gold))]">Full control</div>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(var(--og-gold))]/30 bg-[hsl(var(--og-gold))]/10"><Rocket className="h-5 w-5 text-[hsl(var(--og-gold))]" /></div>
            <div>
              <div className="font-display text-base font-bold text-foreground">Custom Orbitx</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">own mint · anti-vamp</div>
            </div>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">Your own SPL mint with full control — supply, decimals, revocable authorities, optional liquidity, and clone protection.</p>
          <ul className="mb-6 space-y-2">
            <Feature>Own SPL mint + Metaplex metadata</Feature>
            <Feature>Anti-vamp: unique name / ticker / CA</Feature>
            <Feature>Liquidity optional — launch for ~0.01 SOL + $2</Feature>
            <Feature>Revoke mint/freeze, lock or burn LP</Feature>
          </ul>
          <Link to="/orbitxlaunch/create/custom" className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25">
            <Wand2 className="h-4 w-4" /> Launch custom <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center font-mono text-xs text-muted-foreground">// pump-style is fastest &amp; cheapest to get trading · custom gives full control + clone protection</p>
    </div>
  );
}
