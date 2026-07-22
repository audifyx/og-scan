// OrbitX Launchpad — DEPLOYMENT LANE SELECT. V3 HUD redesign.
// Two lanes, identical fees. All fee numbers come from the live fee lib.
import { Link } from "react-router-dom";
import { Rocket, ShieldCheck, Wand2, TrendingUp, ArrowRight, Zap, HandCoins, Check, Plug } from "lucide-react";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft, BASE_LAUNCH_FEE_USD } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";

function Spec({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 font-mono text-[12px] text-muted-foreground">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--og-lime))]" />
      <span>{children}</span>
    </li>
  );
}

export default function LaunchpadChoose() {
  const creatorPct = (CREATOR_FEE_BPS / 100).toFixed(2);
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-[hsl(var(--og-lime))]">// select deployment lane</div>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight">
          CHOOSE YOUR <span className="lpx-glow text-[hsl(var(--og-lime))]">LAUNCH</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Both lanes live on <span className="text-[hsl(var(--og-lime))]">Solana mainnet</span> · both mint an <span className="font-mono text-[hsl(var(--og-gold))]">obx</span> vanity address · identical fees.
        </p>
      </div>

      {/* fee parity band */}
      <div className="lpx-panel lpx-panel--gold mb-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-3 font-mono text-[10px] uppercase tracking-widest">
        <span className="font-bold text-[hsl(var(--og-gold))]">Identical fees · both lanes</span>
        {isLaunchFeePromoActive() ? (
          <span className="font-black text-[hsl(var(--og-lime))]">launches FREE — <s className="font-normal text-muted-foreground opacity-60">{fmtUsd(BASE_LAUNCH_FEE_USD)}</s> · {launchFeePromoDaysLeft()} days left</span>
        ) : (
          <span className="text-muted-foreground">{fmtUsd(ORBITX_FEE_USD)} flat launch</span>
        )}
        <span className="text-muted-foreground">{creatorPct}% of every trade → you</span>
        <span className="inline-flex items-center gap-1 text-[hsl(var(--og-lime))]"><HandCoins className="h-3.5 w-3.5" /> claim in-app</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* ── PUMP LANE ── */}
        <div className="lpx-panel group relative flex flex-col overflow-hidden p-6 transition hover:shadow-[0_0_50px_-18px_hsl(var(--og-cyan)/0.6)]">
          <div className="absolute right-4 top-4 rounded-md border border-[hsl(var(--og-lime))]/30 bg-[hsl(var(--og-lime))]/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[hsl(var(--og-lime))]">
            ◈ Mainnet live
          </div>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[hsl(var(--og-cyan))]/35 bg-[hsl(var(--og-cyan))]/10">
              <TrendingUp className="h-5 w-5 text-[hsl(var(--og-cyan))]" />
            </div>
            <div>
              <div className="font-display text-lg font-black">PUMP LANE</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">bonding curve · fastest to trading</div>
            </div>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Launch instantly with <span className="text-foreground">zero liquidity to seed</span> — price builds from buys and sells, then auto-graduates to a real pool.
          </p>
          <ul className="mb-6 space-y-2">
            <Spec>Zero seeded liquidity — just deploy</Spec>
            <Spec>{creatorPct}% creator fee on every trade (pump.fun native)</Spec>
            <Spec>One-click claim across all your pump coins</Spec>
            <Spec>Auto-ground <span className="font-bold text-[hsl(var(--og-gold))]">…obx</span> vanity contract address</Spec>
          </ul>
          <Link to="/orbitxlaunch/create/pump" className="lpx-btn mt-auto w-full !border-[hsl(var(--og-cyan))]/50 !text-[hsl(var(--og-cyan))] hover:!bg-[hsl(var(--og-cyan))]/15">
            <Zap className="h-4 w-4" /> Deploy pump-style <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* ── CUSTOM LANE ── */}
        <div className="lpx-panel lpx-panel--hot group relative flex flex-col overflow-hidden p-6">
          <div className="lpx-sweep" />
          <div className="absolute right-4 top-4 rounded-md border border-[hsl(var(--og-gold))]/35 bg-[hsl(var(--og-gold))]/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[hsl(var(--og-gold))]">
            ★ Full control
          </div>
          <div className="relative mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[hsl(var(--og-lime))]/40 bg-[hsl(var(--og-lime))]/10">
              <Rocket className="h-5 w-5 text-[hsl(var(--og-lime))]" />
            </div>
            <div>
              <div className="font-display text-lg font-black">CUSTOM LANE</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">own mint · anti-vamp · mainnet</div>
            </div>
          </div>
          <p className="relative mb-4 text-sm leading-relaxed text-muted-foreground">
            Your own on-chain mint with <span className="text-foreground">full control</span> — supply, decimals, revocable authorities, optional Raydium pool, clone protection.
          </p>
          <ul className="relative mb-6 space-y-2">
            <Spec>Own Token-2022 mint + on-chain metadata</Spec>
            <Spec>{creatorPct}% creator fee enforced on-chain — claim in-app</Spec>
            <Spec>Liquidity optional — launch for ~0.01 SOL{isLaunchFeePromoActive() ? " network cost · launch fee FREE" : ` + ${fmtUsd(ORBITX_FEE_USD)}`}</Spec>
            <Spec>Revoke mint/freeze · burn LP · browser-side <span className="font-bold text-[hsl(var(--og-gold))]">OBX</span> vanity grind</Spec>
          </ul>
          <Link to="/orbitxlaunch/create/custom" className="lp-cta relative mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-5 py-3 font-display text-xs font-black uppercase tracking-wider">
            <Wand2 className="h-4 w-4" /> Deploy custom <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>


      {/* ── API LANE (third lane — multi-chain) ── */}
      <div className="lpx-panel group relative mt-4 flex flex-col overflow-hidden p-6 transition hover:shadow-[0_0_50px_-18px_hsl(var(--og-gold)/0.55)] md:flex-row md:items-center md:gap-6">
        <div className="absolute right-4 top-4 rounded-md border border-[hsl(var(--og-gold))]/35 bg-[hsl(var(--og-gold))]/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-[hsl(var(--og-gold))]">
          ⬡ New · multi-chain
        </div>
        <div className="mb-3 flex items-center gap-3 md:mb-0 md:min-w-[250px]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10">
            <Plug className="h-5 w-5 text-[hsl(var(--og-gold))]" />
          </div>
          <div>
            <div className="font-display text-lg font-black">API LANE</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">pump.fun-style APIs · every chain</div>
          </div>
        </div>
        <p className="mb-3 flex-1 text-sm leading-relaxed text-muted-foreground md:mb-0">
          Launch through <span className="text-foreground">provider APIs</span> — PumpPortal live on Solana today, Clanker on Base in beta, and the OrbitX EVM Factory rolling out across ETH, Base, BNB, Robinhood Chain and 9 more.
        </p>
        <Link to="/orbitxlaunch/create/api" className="lpx-btn mt-2 w-full !border-[hsl(var(--og-gold))]/50 !text-[hsl(var(--og-gold))] hover:!bg-[hsl(var(--og-gold))]/15 md:mt-0 md:w-auto">
          <Plug className="h-4 w-4" /> Open API lane <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-[hsl(var(--og-lime))]" />
        same fees either way — pump is fastest to trading · custom gives full control + on-chain creator fees
      </p>
    </div>
  );
}
