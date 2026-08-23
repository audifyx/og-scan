// OrbitX Launchpad — choose deployment lane (metal theme).
import { Link } from "react-router-dom";
import { Rocket, ShieldCheck, Wand2, TrendingUp, ArrowRight, Zap, HandCoins, Check, Plug } from "lucide-react";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft, BASE_LAUNCH_FEE_USD } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS, TRADE_FEE_CREATOR_SHARE_PCT, TRADE_FEE_PLATFORM_SHARE_PCT } from "@/lib/platformFee";
import { TabHero } from "./TabHero";

function Spec({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 font-mono text-[12px] text-[#A8B0BC]">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#60A5FA]" />
      <span>{children}</span>
    </li>
  );
}

export default function LaunchpadChoose() {
  const creatorPct = (CREATOR_FEE_BPS / 100).toFixed(2);
  const splitLabel = `${TRADE_FEE_CREATOR_SHARE_PCT}% you · ${TRADE_FEE_PLATFORM_SHARE_PCT}% platform`;

  return (
    <div className="mx-auto max-w-4xl">
      <TabHero
        icon={Rocket}
        accent="gold"
        eyebrow="Create · Solana mainnet"
        title="Choose your launch lane"
        subtitle="Pump bonding curve or full-control custom mint — same fees, obx vanity CA, anti-vamp on both."
      />

      <div className="ox-panel ox-panel--gold pf-card mb-6 grid gap-3 p-4 md:grid-cols-3">
        {[
          { kind: "flywheel", title: "Flywheel (default)", to: "/orbitxlaunch/create/pump?kind=flywheel" },
          { kind: "bagworking", title: "Bagworking + flywheel", to: "/orbitxlaunch/create/pump?kind=bagworking" },
          { kind: "standard", title: "Custom only", to: "/orbitxlaunch/create/custom?kind=standard" },
        ].map((k) => (
          <Link key={k.kind} to={k.to} className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-center hover:border-[#F0C75E]/50">
            <div className="pf-mono text-[9px] uppercase tracking-[0.24em] text-[#F0C75E]">{k.kind}</div>
            <div className="font-display text-base font-black text-white">{k.title}</div>
          </Link>
        ))}
      </div>

      <div className="ox-panel ox-panel--gold pf-card mb-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-3 font-mono text-[10px] uppercase tracking-widest">
        <span className="font-bold text-[#F0C75E]">Identical fees · both lanes</span>
        {isLaunchFeePromoActive() ? (
          <span className="font-black text-[#60A5FA]">
            launches FREE — <s className="font-normal text-[#A8B0BC] opacity-60">{fmtUsd(BASE_LAUNCH_FEE_USD)}</s> · {launchFeePromoDaysLeft()} days left
          </span>
        ) : (
          <span className="text-[#A8B0BC]">{fmtUsd(ORBITX_FEE_USD)} flat launch</span>
        )}
        <span className="text-[#A8B0BC]">{creatorPct}% of every trade → you</span>
        <span className="inline-flex items-center gap-1 text-[#60A5FA]"><HandCoins className="h-3.5 w-3.5" /> claim in-app</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="ox-panel ox-panel--accent pf-card group relative flex flex-col p-6 transition hover:border-[rgba(59,130,246,0.45)]">
          <div className="ox-lane-badge absolute right-4 top-4 border-[rgba(59,130,246,0.35)] bg-[rgba(59,130,246,0.1)] text-[#60A5FA]">
            Mainnet live
          </div>
          <div className="mb-3 flex items-center gap-3">
            <div className="ox-lane-icon border-[rgba(59,130,246,0.35)] text-[#60A5FA]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-black text-white">Pump lane</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#A8B0BC]">bonding curve · flywheel default</div>
            </div>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-[#A8B0BC]">
            Launch instantly with <span className="text-white">zero liquidity to seed</span> — price builds from buys and sells, then auto-graduates. Every pump-style coin ships with the <span className="text-white">flywheel</span> (Community / Buy-Burn / Creator / Rewards).
          </p>
          <ul className="mb-6 space-y-2">
            <Spec>Zero seeded liquidity — just deploy</Spec>
            <Spec>{creatorPct}% trade fee every buy/sell ({splitLabel})</Spec>
            <Spec>One-click claim across all your pump coins</Spec>
            <Spec>Flywheel allocations on every pump launch (must total 100%)</Spec>
            <Spec>Auto-ground <span className="font-bold text-[#F0C75E]">…obx</span> vanity contract address</Spec>
          </ul>
          <Link to="/orbitxlaunch/create/pump?kind=flywheel" className="ox-btn ox-btn--blue mt-auto w-full">
            <Zap className="h-4 w-4" /> Deploy pump + flywheel <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="ox-panel pf-card group relative flex flex-col p-6 transition hover:border-[rgba(212,175,55,0.45)]">
          <div className="ox-lane-badge absolute right-4 top-4 border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.1)] text-[#F0C75E]">
            Full control
          </div>
          <div className="mb-3 flex items-center gap-3">
            <div className="ox-lane-icon border-[rgba(212,175,55,0.35)] text-[#F0C75E]">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-black text-white">Custom lane</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#A8B0BC]">own mint · anti-vamp · mainnet</div>
            </div>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-[#A8B0BC]">
            Your own on-chain mint with <span className="text-white">full control</span> — supply, decimals, revocable authorities, optional Raydium pool, clone protection.
          </p>
          <ul className="mb-6 space-y-2">
            <Spec>Own Token-2022 mint + on-chain metadata</Spec>
            <Spec>{creatorPct}% on-chain trade fee — claim in-app ({splitLabel})</Spec>
            <Spec>Liquidity optional — launch for ~0.01 SOL{isLaunchFeePromoActive() ? " network cost · launch fee FREE" : ` + ${fmtUsd(ORBITX_FEE_USD)}`}</Spec>
            <Spec>Revoke mint/freeze · burn LP · browser-side <span className="font-bold text-[#F0C75E]">OBX</span> vanity grind</Spec>
          </ul>
          <Link to="/orbitxlaunch/create/custom" className="pf-btn mt-auto inline-flex w-full items-center justify-center gap-1.5">
            <Wand2 className="h-4 w-4" /> Deploy custom <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="ox-panel pf-card group relative mt-4 flex flex-col p-6 transition hover:border-[rgba(212,175,55,0.35)] md:flex-row md:items-center md:gap-6">
        <div className="ox-lane-badge absolute right-4 top-4 border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.1)] text-[#F0C75E]">
          New · multi-chain
        </div>
        <div className="mb-3 flex items-center gap-3 md:mb-0 md:min-w-[250px]">
          <div className="ox-lane-icon border-[rgba(212,175,55,0.35)] text-[#F0C75E]">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg font-black text-white">API lane</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#A8B0BC]">pump.fun-style APIs · every chain</div>
          </div>
        </div>
        <p className="mb-3 flex-1 text-sm leading-relaxed text-[#A8B0BC] md:mb-0">
          Launch through <span className="text-white">provider APIs</span> — PumpPortal live on Solana today, Clanker on Base in beta, and the OrbitX EVM Factory rolling out across ETH, Base, BNB, Robinhood Chain and 9 more.
        </p>
        <Link to="/orbitxlaunch/create/api" className="ox-btn mt-2 w-full md:mt-0 md:w-auto" style={{ borderColor: "rgba(212,175,55,0.5)", color: "#F0C75E" }}>
          <Plug className="h-4 w-4" /> Open API lane <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-[#A8B0BC]">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-[#60A5FA]" />
        same fees either way — {creatorPct}% trade fee · {splitLabel} · pump is fastest · custom = full control
      </p>
    </div>
  );
}
