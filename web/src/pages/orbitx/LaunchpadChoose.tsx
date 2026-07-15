// Orbitx Launchpad — "Choose your launch" fork: Pump.fun style vs Custom Orbitx.
import { Link } from "react-router-dom";
import { Rocket, ShieldCheck, Wand2, Droplets, Coins, TrendingUp, Lock, ArrowRight, Zap } from "lucide-react";

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--og-lime))]" />
      <span>{children}</span>
    </li>
  );
}

export default function LaunchpadChoose() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Choose your launch</h1>
        <p className="mt-1 text-sm text-muted-foreground">Two ways to launch on Orbitx — both mint an <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> vanity address.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pump.fun style */}
        <div className="flex flex-col rounded-3xl border border-white/10 bg-black/30 p-6 transition hover:border-[hsl(var(--og-cyan))]/40">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--og-cyan))]/15"><TrendingUp className="h-5 w-5 text-[hsl(var(--og-cyan))]" /></div>
            <div>
              <div className="font-black text-foreground">Pump.fun style</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Bonding curve · fastest</div>
            </div>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Launch instantly with <span className="text-foreground">no liquidity to seed</span> — price and liquidity build from buys &amp; sells on a bonding curve, then auto-graduate to a real pool.</p>
          <ul className="mb-6 space-y-2">
            <Feature>Zero seeded liquidity — just launch</Feature>
            <Feature>Liquidity forms from trading, auto-graduates</Feature>
            <Feature>OBX vanity contract address</Feature>
            <Feature>Battle-tested bonding-curve mechanics</Feature>
          </ul>
          <a href="/ORBITX_DEX/launchpad" className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[hsl(var(--og-cyan))] px-5 py-3 text-sm font-bold text-black transition hover:bg-[hsl(var(--og-cyan))]/90">
            <Zap className="h-4 w-4" /> Launch pump-style <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        {/* Custom Orbitx */}
        <div className="relative flex flex-col rounded-3xl border border-[hsl(var(--og-gold))]/30 bg-gradient-to-b from-[hsl(var(--og-gold))]/10 to-black/30 p-6 transition hover:border-[hsl(var(--og-gold))]/60">
          <div className="absolute right-4 top-4 rounded-full bg-[hsl(var(--og-gold))]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[hsl(var(--og-gold))]">Full control</div>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--og-gold))]/15"><Rocket className="h-5 w-5 text-[hsl(var(--og-gold))]" /></div>
            <div>
              <div className="font-black text-foreground">Custom Orbitx</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Own mint · anti-vamp</div>
            </div>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">Your own SPL mint with full control — supply, decimals, revocable authorities, optional liquidity, and clone protection.</p>
          <ul className="mb-6 space-y-2">
            <Feature>Own SPL mint + Metaplex metadata</Feature>
            <Feature>Anti-vamp: unique name / ticker / CA</Feature>
            <Feature>Liquidity optional — launch for ~0.01 SOL + $2</Feature>
            <Feature>Revoke mint/freeze, lock or burn LP</Feature>
          </ul>
          <Link to="/orbitxlaunch/create/custom" className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[hsl(var(--og-gold))] px-5 py-3 text-sm font-bold text-black transition hover:bg-[hsl(var(--og-gold))]/90">
            <Wand2 className="h-4 w-4" /> Launch custom <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">Not sure? Pump-style is fastest and cheapest to get trading. Custom gives you full control and clone protection.</p>
    </div>
  );
}
