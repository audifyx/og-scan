// Orbitx Launchpad — About: how it works, honestly.
import { Link } from "react-router-dom";
import { ShieldCheck, Droplets, Coins, Wand2, Flame, Rocket, Info } from "lucide-react";

function Card({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--og-gold))]/10"><Icon className="h-4.5 w-4.5 text-[hsl(var(--og-gold))]" /></div>
        <h3 className="font-bold text-foreground">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

export default function LaunchpadAbout() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">About Orbitx Launchpad</h1>
        <p className="mt-1 text-sm text-muted-foreground">A custom Solana launchpad — your own SPL mint, your own liquidity, and clone protection baked in. Not pump.fun.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card icon={Coins} title="Custom SPL mint">
          Every launch creates a real SPL token with Metaplex metadata — its own supply, decimals, and authorities you control (and can revoke for trust). No shared bonding curve, no middleman.
        </Card>
        <Card icon={Wand2} title="Vanity CA under “obx”">
          The contract address is vanity-ground so it starts with <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> — an on-brand, recognizable CA for every Orbitx token.
        </Card>
        <Card icon={ShieldCheck} title="Anti-vamp: no clones">
          Names, tickers, and contract addresses are globally unique and enforced at the database level. A leetspeak-aware normalizer plus similarity detection blocks look-alikes — so vamps can't ride your name.
        </Card>
        <Card icon={Flame} title="Vamp penalty">
          If a copycat still slips through as a borderline match, it can launch but its creator fees are force-routed to <span className="text-foreground">OBX buybacks</span> — a copy earns the original nothing.
        </Card>
        <Card icon={Droplets} title="Automatic liquidity">
          Seed a liquidity pool on Raydium/Meteora/Orca at launch. The SOL you add is <span className="text-foreground">your capital</span> (recoverable, or lock/burn it for trust) — the token becomes instantly tradable. The only true extra cost is the DEX's ~0.15 SOL pool-creation fee.
        </Card>
        <Card icon={Info} title="What it costs">
          Pass-through on-chain cost (mint ≈ 0.01 SOL, +~0.15 SOL if you auto-create a pool) plus a flat <span className="text-foreground">$2 Orbitx fee</span> (priced live in SOL). The liquidity you seed is separate — that's your position, not a fee.
        </Card>
      </div>

      <div className="mt-6 rounded-2xl border border-[hsl(var(--og-cyan))]/20 bg-[hsl(var(--og-cyan))]/5 p-4 text-sm text-muted-foreground">
        <span className="font-bold text-[hsl(var(--og-cyan))]">Status:</span> the launchpad UI, anti-vamp registry, and fee model are live. On-chain minting + automatic pool creation roll out devnet-first, then mainnet after testing — so you never launch blind.
      </div>

      <div className="mt-6 flex justify-center">
        <Link to="/orbitxlaunch/create" className="inline-flex items-center gap-1.5 rounded-xl bg-[hsl(var(--og-gold))] px-6 py-3 text-sm font-bold text-black hover:bg-[hsl(var(--og-gold))]/90"><Rocket className="h-4 w-4" /> Launch a token</Link>
      </div>
    </div>
  );
}
