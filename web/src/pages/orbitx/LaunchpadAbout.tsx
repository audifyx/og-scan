// Orbitx Launchpad — About: how it works, honestly. DEX glass/terminal aesthetic.
import { Link } from "react-router-dom";
import { ShieldCheck, Droplets, Coins, Wand2, Flame, Rocket, Info, TrendingUp } from "lucide-react";
import { SectionLabel } from "./_shared";

function InfoCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="og-glass-card lift p-5">
      <div className="mb-2.5 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[hsl(var(--og-gold))]/25 bg-[hsl(var(--og-gold))]/10"><Icon className="h-4 w-4 text-[hsl(var(--og-gold))]" /></div>
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export default function LaunchpadAbout() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">// how it works</div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">About Orbitx Launchpad</h1>
        <p className="mt-1 text-sm text-muted-foreground">Two launch lanes — <span className="text-[hsl(var(--og-cyan))]">Pump-style</span> bonding curve or a fully <span className="text-[hsl(var(--og-gold))]">Custom</span> SPL mint — with clone protection baked in.</p>
      </div>

      <SectionLabel accent="gold">The mechanics</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon={TrendingUp} title="Pump-style lane">
          Launch instantly with no liquidity to seed — price and liquidity build from buys &amp; sells on a bonding curve, then auto-graduate to a real pool. Fastest, cheapest way to get trading.
        </InfoCard>
        <InfoCard icon={Coins} title="Custom SPL mint">
          The custom lane creates a real SPL token with Metaplex metadata — its own supply, decimals, and authorities you control (and can revoke for trust). No shared curve, full control.
        </InfoCard>
        <InfoCard icon={Wand2} title="Vanity CA under “obx”">
          Both lanes vanity-grind the contract address so it starts with <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> — an on-brand, recognizable CA for every Orbitx token.
        </InfoCard>
        <InfoCard icon={ShieldCheck} title="Anti-vamp: no clones">
          Names, tickers, and CAs are globally unique and enforced at the database level. A leetspeak-aware normalizer plus similarity detection blocks look-alikes — so vamps can't ride your name.
        </InfoCard>
        <InfoCard icon={Flame} title="Vamp penalty">
          If a copycat slips through as a borderline match, it can launch but its creator fees are force-routed to <span className="text-foreground">OBX buybacks</span> — a copy earns the original nothing.
        </InfoCard>
        <InfoCard icon={Droplets} title="Custom liquidity">
          On the custom lane, seed a pool on Raydium/Meteora/Orca at launch. The SOL you add is <span className="text-foreground">your capital</span> (recoverable, or lock/burn for trust). Only true extra cost is the DEX's ~0.15 SOL pool fee.
        </InfoCard>
      </div>

      <div className="og-glass-card mt-6 border-[hsl(var(--og-cyan))]/25 p-4 text-sm text-muted-foreground">
        <span className="font-display font-bold uppercase tracking-wide text-[hsl(var(--og-cyan))]">Status //</span> the launchpad UI, both launch lanes, anti-vamp registry, and fee model are live. Custom-lane on-chain minting + pool creation roll out devnet-first, then mainnet after testing — so you never launch blind.
      </div>

      <div className="mt-6 flex justify-center">
        <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-6 py-3 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25"><Rocket className="h-4 w-4" /> Launch a token</Link>
      </div>
    </div>
  );
}
