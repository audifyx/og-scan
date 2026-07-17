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
import { ORBITX_FEE_USD, fmtUsd } from "@/lib/orbitx/fee";
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
      <button type="button" onClick={onClick} className="lp-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-display text-xs font-bold uppercase tracking-wider">
        <Wallet className="h-4 w-4" /> Connect Wallet
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--og-lime))]/35 bg-black/50 px-2.5 py-1.5">
      <span className="lpx-led" />
      <div className="leading-none">
        <div className="font-mono text-[10px] font-bold text-[hsl(var(--og-lime))]">{shortAddr(addr)}</div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {sol != null ? `${sol.toFixed(3)} SOL` : "wallet linked"}
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="ml-1 rounded border border-white/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground transition hover:border-[hsl(var(--og-blood))]/50 hover:text-[hsl(var(--og-blood))]"
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
    <div className="flex items-center gap-4 overflow-x-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="flex shrink-0 items-center gap-1.5">
        <span className={ok ? "lpx-led" : "lpx-led lpx-led--red"} />
        <span className={ok ? "font-bold text-[hsl(var(--og-lime))]" : "font-bold text-[hsl(var(--og-blood))]"}>
          Solana mainnet {ok ? "live" : "degraded"}
        </span>
      </span>
      <span className="shrink-0">slot <span className="text-[hsl(var(--og-lime))]">{fmtInt(tel.data?.slot)}</span></span>
      <span className="shrink-0">{fmtInt(tel.data?.tps)} <span className="text-white/30">tps</span></span>
      <span className="shrink-0">rpc <span className="text-[hsl(var(--og-lime))]">{tel.data?.latencyMs != null ? `${tel.data.latencyMs}ms` : "—"}</span></span>
      <span className="shrink-0">sol <span className="text-[hsl(var(--og-gold))]">{solUsd.data ? `$${solUsd.data.price.toFixed(2)}` : "—"}</span></span>
      <span className="hidden shrink-0 sm:inline">{fmtUsd(ORBITX_FEE_USD)} flat launch · {(CREATOR_FEE_BPS / 100).toFixed(2)}% creator fee</span>
    </div>
  );
}

export default function LaunchpadLayout() {
  return (
    <AppLayout>
      <div className="og-tool-shell lp-v3 relative min-h-screen">
        {/* backdrop: green grid + code rain + particles + glows + scanlines */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="grid-bg absolute inset-0 opacity-[0.55]" />
          <div className="lp-rain absolute inset-0" />
          <div className="lp-particles absolute inset-0 opacity-60" />
          <div className="absolute -top-24 left-1/3 h-80 w-80 rounded-full bg-[hsl(var(--og-lime))]/10 blur-[120px]" />
          <div className="absolute top-40 right-10 h-64 w-64 rounded-full bg-[hsl(var(--og-gold))]/8 blur-[100px]" />
          <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-[hsl(var(--og-cyan))]/8 blur-[120px]" />
          <div className="lp-scanlines absolute inset-0" />
        </div>

        {/* ── Command header ── */}
        <div className="border-b border-[hsl(var(--og-lime))]/15 bg-black/55 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
            {/* brand */}
            <Link to="/orbitxlaunch" className="group flex items-center gap-2.5">
              <div className="pulse-glow relative flex h-10 w-10 items-center justify-center rounded-lg border border-[hsl(var(--og-gold))]/45 bg-[hsl(var(--og-gold))]/10">
                <Rocket className="h-5 w-5 text-[hsl(var(--og-gold))]" strokeWidth={2.4} />
              </div>
              <div className="leading-none">
                <div className="font-display text-lg font-black tracking-tight text-foreground">
                  ORBIT<span className="lpx-glow-gold text-[hsl(var(--og-gold))]">X</span>
                </div>
                <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.34em] text-muted-foreground">Beyond launch</div>
              </div>
            </Link>

            {/* center emblem */}
            <div className="order-last w-full text-center sm:order-none sm:w-auto sm:flex-1">
              <div className="inline-flex flex-col items-center rounded-lg border border-[hsl(var(--og-lime))]/25 bg-[hsl(var(--og-lime))]/[0.05] px-5 py-1">
                <div className="lpx-glow font-display text-sm font-black uppercase tracking-[0.22em] text-[hsl(var(--og-lime))]">
                  Launchpad V3
                </div>
                <div className="font-mono text-[8px] uppercase tracking-[0.4em] text-muted-foreground">Deploy · Protect · Earn</div>
              </div>
            </div>

            {/* wallet + quick deploy */}
            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/orbitxlaunch/create"
                className="hidden items-center gap-1.5 rounded-lg border border-[hsl(var(--og-lime))]/45 bg-[hsl(var(--og-lime))]/10 px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-lime))] transition hover:bg-[hsl(var(--og-lime))]/20 md:inline-flex"
              >
                <Zap className="h-4 w-4" /> Deploy
              </Link>
              <WalletConsole />
            </div>
          </div>

          {/* live telemetry strip + section nav */}
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1.5 border-t border-white/5 px-4 py-1.5">
            <NetworkStrip />
            <nav className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition",
                      isActive
                        ? t.hot
                          ? "bg-[hsl(var(--og-gold))]/15 text-[hsl(var(--og-gold))] shadow-[inset_0_0_0_1px_hsl(var(--og-gold)/0.45)]"
                          : "bg-[hsl(var(--og-lime))]/12 text-[hsl(var(--og-lime))] shadow-[inset_0_0_0_1px_hsl(var(--og-lime)/0.45)]"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                    )
                  }
                >
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                  {t.hot && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--og-gold))]" />}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5">
          <div className="og-page-fade-in">
            <Outlet />
          </div>

          {/* ── HUD footer ── */}
          <footer className="mt-12">
            <div className="mb-3 flex items-center justify-center gap-3">
              <span className="h-px w-16 bg-gradient-to-r from-transparent to-[hsl(var(--og-lime))]/50" />
              <span className="lpx-glow text-center font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[hsl(var(--og-lime))]">
                Built for creators · Backed by technology · Secured by OrbitX
              </span>
              <span className="h-px w-16 bg-gradient-to-l from-transparent to-[hsl(var(--og-lime))]/50" />
            </div>
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-[hsl(var(--og-lime))]/12 bg-black/35 p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:grid-cols-3">
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--og-gold))]" /> {fmtUsd(ORBITX_FEE_USD)} flat launch fee · both lanes</div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--og-lime))]" /> {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade → creator</div>
              <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--og-cyan))]" /> claim in-app · same wallet that launched</div>
            </div>
          </footer>
        </div>
      </div>
    </AppLayout>
  );
}
