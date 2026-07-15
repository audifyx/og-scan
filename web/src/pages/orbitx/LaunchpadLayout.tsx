// Orbitx Launchpad — shared shell (chrome + section nav) for all /orbitxlaunch/* routes.
// V3 design: terminal/cyberpunk. Scoped .lp-v3 theme remaps accents to electric
// purple / neon cyan / acid green for every launchpad page. Routes unchanged.
import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Rocket, Home, PlusCircle, Info, UserCircle2, HandCoins, Zap, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORBITX_FEE_USD, fmtUsd } from "@/lib/orbitx/fee";
import { CREATOR_FEE_BPS } from "@/lib/platformFee";
import { shortAddr } from "./_shared";

const TABS = [
  { to: "/orbitxlaunch", label: "HOME", icon: Home, end: true },
  { to: "/orbitxlaunch/create", label: "LAUNCH", icon: PlusCircle, end: false },
  { to: "/orbitxlaunch/claim", label: "CLAIM FEES", icon: HandCoins, end: false, hot: true },
  { to: "/orbitxlaunch/profile", label: "PROFILE", icon: UserCircle2, end: false },
  { to: "/orbitxlaunch/about", label: "ABOUT", icon: Info, end: false },
];

const TICKER = [
  "MAINNET LIVE",
  `${fmtUsd(ORBITX_FEE_USD)} FLAT LAUNCH FEE — BOTH LANES`,
  `${(CREATOR_FEE_BPS / 100).toFixed(2)}% CREATOR FEE ON EVERY BUY/SELL`,
  "CLAIM FEES IN-APP — SAME WALLET THAT LAUNCHED",
  "ANTI-VAMP // UNIQUE NAME · TICKER · CA",
  "OBX VANITY ADDRESSES",
  "PUMP + CUSTOM LANES",
];

/* ── Lightweight Phantom wallet button (self-contained, additive only) ── */
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

function WalletButton() {
  const [addr, setAddr] = useState<string | null>(null);

  useEffect(() => {
    const p = getPhantom();
    if (!p) return;
    p.connect({ onlyIfTrusted: true })
      .then((r) => setAddr(r.publicKey.toString()))
      .catch(() => undefined);
  }, []);

  const onClick = async () => {
    const p = getPhantom();
    if (!p) {
      window.open("https://phantom.app", "_blank", "noopener,noreferrer");
      return;
    }
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

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-display text-xs font-bold uppercase tracking-wider transition",
        addr
          ? "border border-[hsl(var(--og-lime))]/45 bg-[hsl(var(--og-lime))]/10 text-[hsl(var(--og-lime))] hover:bg-[hsl(var(--og-lime))]/20"
          : "lp-cta text-white",
      )}
    >
      <Wallet className="h-4 w-4" />
      {addr ? shortAddr(addr) : "Connect Wallet"}
    </button>
  );
}

export default function LaunchpadLayout() {
  return (
    <AppLayout>
      <div className="og-tool-shell lp-v3 relative min-h-screen">
        {/* backdrop: grid + code rain + particles + nebula glows + scanlines */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="grid-bg absolute inset-0 opacity-[0.5]" />
          <div className="lp-rain absolute inset-0" />
          <div className="lp-particles absolute inset-0 opacity-60" />
          <div className="absolute -top-24 left-1/3 h-80 w-80 rounded-full bg-[hsl(var(--og-gold))]/12 blur-[110px]" />
          <div className="absolute top-40 right-10 h-64 w-64 rounded-full bg-[hsl(var(--og-cyan))]/10 blur-[100px]" />
          <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-[120px]" />
          <div className="lp-scanlines absolute inset-0" />
        </div>

        {/* ── System ticker ── */}
        <div className="border-b border-white/5 bg-black/40 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--og-lime))]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--og-lime))] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--og-lime))]" />
              </span>
              LIVE
            </span>
            {TICKER.map((t, i) => (
              <span key={i} className="flex shrink-0 items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="text-white/15">{"//"}</span>
                <span className={i === 1 || i === 2 ? "text-[hsl(var(--og-gold))]" : undefined}>{t}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-4">
          {/* ── Top bar: brand + wallet ── */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link to="/orbitxlaunch" className="group flex items-center gap-3">
              <div className="pulse-glow relative flex h-11 w-11 items-center justify-center rounded-xl border border-[hsl(var(--og-gold))]/40 bg-[hsl(var(--og-gold))]/10">
                <Rocket className="h-5 w-5 text-[hsl(var(--og-gold))]" strokeWidth={2.4} />
                <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full border border-black bg-[hsl(var(--og-lime))]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/60" />
                </span>
              </div>
              <div className="leading-none">
                <div className="font-display text-xl font-bold tracking-tight text-foreground">
                  ORBITX<span className="text-glow-gold text-[hsl(var(--og-gold))]">·LAUNCHPAD</span>
                  <span className="ml-2 rounded border border-[hsl(var(--og-cyan))]/30 bg-[hsl(var(--og-cyan))]/10 px-1.5 py-0.5 align-middle font-mono text-[9px] font-bold tracking-widest text-[hsl(var(--og-cyan))]">V3</span>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  custom solana launches • anti-vamp
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                to="/orbitxlaunch/create"
                className="hidden items-center gap-1.5 rounded-lg border border-[hsl(var(--og-gold))]/50 bg-[hsl(var(--og-gold))]/15 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-[hsl(var(--og-gold))] transition hover:bg-[hsl(var(--og-gold))]/25 md:inline-flex"
              >
                <Zap className="h-4 w-4" /> Launch
              </Link>
              <WalletButton />
            </div>
          </div>

          {/* ── Section nav ── */}
          <nav className="glass-nav mb-6 flex items-center gap-1 overflow-x-auto rounded-xl p-1">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition",
                    isActive
                      ? t.hot
                        ? "bg-[hsl(var(--og-lime))]/15 text-[hsl(var(--og-lime))] shadow-[inset_0_0_0_1px_hsl(var(--og-lime)/0.4)]"
                        : "bg-[hsl(var(--og-gold))]/15 text-[hsl(var(--og-gold))] shadow-[inset_0_0_0_1px_hsl(var(--og-gold)/0.4)]"
                      : t.hot
                        ? "text-[hsl(var(--og-lime))]/80 hover:bg-[hsl(var(--og-lime))]/10 hover:text-[hsl(var(--og-lime))]"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )
                }
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                {t.hot && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--og-lime))]" />}
              </NavLink>
            ))}
          </nav>

          <div className="og-page-fade-in">
            <Outlet />
          </div>

          {/* ── Fee ribbon footer ── */}
          <div className="mt-10 grid grid-cols-1 gap-2 rounded-xl border border-white/8 bg-black/30 p-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--og-gold))]" /> {fmtUsd(ORBITX_FEE_USD)} flat launch fee · both lanes</div>
            <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--og-lime))]" /> {(CREATOR_FEE_BPS / 100).toFixed(2)}% of every trade → creator</div>
            <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--og-cyan))]" /> claim in-app · same wallet that launched</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
