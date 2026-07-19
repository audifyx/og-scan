// OrbitX Launchpad — V3 "Mission Control" shell for all /orbitxlaunch/* routes.
// Full-bleed HUD: brand block + live Solana network readout + wallet console.
// No sidebar — section nav is a slim HUD tab strip. Scoped .lp-v3 theme
// remaps accents to phosphor green / gold for every launchpad page.
import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Rocket, Home, PlusCircle, Info, UserCircle2, HandCoins, Wallet, Flame, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ORBITX_FEE_USD, fmtUsd, isLaunchFeePromoActive, launchFeePromoDaysLeft, BASE_LAUNCH_FEE_USD } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { HELIUS_RPC } from "@/lib/og";
import { shortAddr } from "./_shared";
import { useChainTelemetry, useSolUsd, fmtInt } from "./lpx";

const TABS = [
  { to: "/orbitxlaunch", label: "MISSION", icon: Home, end: true },
  { to: "/orbitxlaunch/create", label: "DEPLOY", icon: PlusCircle, end: false },
  { to: "/orbitxlaunch/claim", label: "CLAIM FEES", icon: HandCoins, end: false, hot: true },
  { to: "/orbitxlaunch/rescue", label: "RESCUE", icon: Flame, end: false, hot: true },
  { to: "/orbitxlaunch/profile", label: "PROFILE", icon: UserCircle2, end: false },
  { to: "/orbitxlaunch/about", label: "ABOUT", icon: Info, end: false },
];

/* ── Lightweight Phantom wallet console (self-contained) ── */
type PhantomLike = {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
};

function getPhantom(): PhantomLike | null {
  const w = window as unknown as { solana?: PhantomLike };
  return w.solana ?? null;
}

function WalletConsole() {
  const [addr, setAddr] = useState<string | null>(null);
  const [sol, setSol] = useState<number | null>(null);

  useEffect(() => {
    const p = getPhantom();
    if (!p) return;
    p.connect({ onlyIfTrusted: true })
      .then((r) => setAddr(r.publicKey.toString()))
      .catch(() => undefined);
  }, []);

  // Real balance readout for the connected wallet.
  useEffect(() => {
    if (!addr) { setSol(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(HELIUS_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [addr] }),
        });
        const j = await r.json();
        const lamports = j?.result?.value;
        if (alive && typeof lamports === "number") setSol(lamports / 1e9);
      } catch { /* fail soft */ }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [addr]);

  const onClick = async () => {
    const p = getPhantom();
    if (!p) { window.open("https://phantom.app", "_blank", "noopener,noreferrer"); return; }
    if (addr) {
      try { await p.disconnect?.(); } catch { /* noop */ }
      setAddr(null);
      return;
    }
    try {
      const r = await p.connect();
      setAddr(r.publicKey.toString());
    } catch { /* user rejected */ }
  };

  if (!addr) {
    return (
      <button type="button" onClick={onClick} className="pf-btn">
        <Wallet className="h-4 w-4" /> Connect Wallet
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg-2))] px-2.5 py-1.5">
      <span className="h-2 w-2 rounded-full bg-[hsl(var(--pf-green))]" />
      <div className="leading-none">
        <div className="pf-mono text-[10px] font-bold text-[hsl(var(--pf-ink))]">{shortAddr(addr)}</div>
        <div className="mt-0.5 pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">
          {sol != null ? `${sol.toFixed(3)} SOL` : "wallet linked"}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="ml-1 rounded-full border border-[hsl(var(--pf-border))] px-2 py-1 pf-mono text-[9px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))] transition hover:border-[hsl(var(--pf-red))] hover:text-[hsl(var(--pf-red))]"
      >
        Disconnect
      </button>
    </div>
  );
}

/* ── Live network readout (real slot / TPS / RPC latency / SOL price) ── */
function NetworkStrip() {
  const tel = useChainTelemetry();
  const solUsd = useSolUsd();
  const ok = tel.data?.ok ?? false;

  return (
    <div className="pf-ticker">
      <div className="pf-ticker-track">
        {Array.from({ length: 2 }).map((_, dup) => (
          <span key={dup} className="inline-flex items-center gap-6 pf-mono text-[11px] uppercase tracking-wide">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[hsl(var(--pf-green))]" : "bg-[hsl(var(--pf-red))]"}`} />
              Solana mainnet {ok ? "live" : "degraded"}
            </span>
            <span>slot {fmtInt(tel.data?.slot)}</span>
            <span>{fmtInt(tel.data?.tps)} tps</span>
            <span>rpc {tel.data?.latencyMs != null ? `${tel.data.latencyMs}ms` : "—"}</span>
            <span>sol ${solUsd.data ? solUsd.data.price.toFixed(2) : "—"}</span>
            {isLaunchFeePromoActive() ? (
              <span className="font-bold">★ FREE launches — {launchFeePromoDaysLeft()}d left · {(CREATOR_FEE_BPS / 100).toFixed(2)}% creator fee</span>
            ) : (
              <span>{fmtUsd(ORBITX_FEE_USD)} flat launch · {(CREATOR_FEE_BPS / 100).toFixed(2)}% creator fee</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function LaunchpadLayout() {
  return (
    <AppLayout>
      <div className="lp-classic relative min-h-screen">
        {/* scrolling ticker — the pump.fun signature top ribbon */}
        <NetworkStrip />

        {/* ── classic header: wordmark left, tabs center, wallet right ── */}
        <div className="sticky top-0 z-20 border-b-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg-2))]">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
            {/* brand */}
            <Link to="/orbitxlaunch" className="group flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-green))]">
                <Rocket className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
              </div>
              <div className="leading-none">
                <div className="text-lg font-black tracking-tight text-[hsl(var(--pf-ink))]">
                  orbit<span className="text-[hsl(var(--pf-green))]">x</span>.fun
                </div>
              </div>
            </Link>

            {/* wallet + quick deploy */}
            <div className="ml-auto flex items-center gap-2">
              <Link to="/orbitxlaunch/create" className="pf-btn hidden md:inline-flex">
                <Zap className="h-4 w-4" /> Start a new coin
              </Link>
              <WalletConsole />
            </div>
          </div>

          {/* section nav — plain pill tabs, no glow */}
          <div className="mx-auto flex w-full max-w-7xl items-center gap-0.5 overflow-x-auto border-t border-[hsl(var(--pf-border))] px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) => cn("pf-nav-link flex items-center gap-1.5 whitespace-nowrap", isActive && "active")}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5">
          <Outlet />

          {/* ── classic footer ── */}
          <footer className="mt-12 border-t-2 border-[hsl(var(--pf-ink))] pt-4">
            <div className="grid grid-cols-1 gap-2 pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))] sm:grid-cols-3">
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-gold))]" /> {isLaunchFeePromoActive() ? <>launches FREE for {launchFeePromoDaysLeft()} more days · then {fmtUsd(BASE_LAUNCH_FEE_USD)} flat</> : <>{fmtUsd(ORBITX_FEE_USD)} flat launch fee · both lanes</>}</div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-green))]" /> {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade → creator</div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--pf-blue))]" /> claim in-app · same wallet that launched</div>
            </div>
          </footer>
        </div>
      </div>
    </AppLayout>
  );
}
