import { memo, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Copy,
  Fingerprint,
  Flame,
  LockKeyhole,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { OGSCAN_TOKEN_MINT, shortAddr } from "@/lib/og";
import { cn } from "@/lib/utils";

const appTabs = [
  { label: "Scan", Icon: Search, active: true },
  { label: "Radar", Icon: Radar },
  { label: "Feed", Icon: Flame },
  { label: "Social", Icon: Users },
];

const homeTiles = [
  { label: "Truth Scan", value: "92", sub: "OG confidence", Icon: ShieldCheck, color: "text-og-lime border-og-lime/30 bg-og-lime/10" },
  { label: "Launch Radar", value: "18", sub: "fresh mints", Icon: Target, color: "text-og-cyan border-og-cyan/30 bg-og-cyan/10" },
  { label: "Market Pulse", value: "Hot", sub: "whale pressure", Icon: TrendingUp, color: "text-[#f472b6] border-[#f472b6]/30 bg-[#f472b6]/10" },
  { label: "Wallet Intel", value: "Live", sub: "risk stream", Icon: Wallet, color: "text-og-gold border-og-gold/30 bg-og-gold/10" },
];

const dockActions = [
  { label: "Log in", href: "/auth", Icon: LockKeyhole, color: "border border-white/10 bg-white/[0.08] text-white" },
  { label: "Sign up", href: "/auth?mode=signup", Icon: Fingerprint, color: "bg-og-lime text-og-ink" },
];

const MobilePreview = memo(() => (
  <div className="mx-auto w-full max-w-[360px]">
    <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#07101f] p-3 shadow-[0_30px_90px_-48px_rgba(34,211,238,0.95)]">
      <div className="absolute left-1/2 top-2 h-1.5 w-20 -translate-x-1/2 rounded-full bg-white/18" />
      <div className="overflow-hidden rounded-[1.55rem] border border-white/10 bg-[#0b1423]">
        <div className="relative min-h-[580px] p-4">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_4%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_90%_16%,rgba(163,230,53,0.14),transparent_28%),radial-gradient(circle_at_50%_98%,rgba(244,114,182,0.12),transparent_34%)]" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                  <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover" />
                </div>
                <div>
                  <p className="text-[13px] font-black text-white">OGScan</p>
                  <p className="text-[10px] font-semibold text-white/45">Command home</p>
                </div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.07] text-white/70">
                <Bell className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-og-cyan">Live scan</p>
                  <h2 className="mt-2 text-3xl font-black leading-[0.95] text-white">Find the real OG.</h2>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-og-lime/35 bg-og-lime/10 text-og-lime">
                  <Radar className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-white/45">
                  <span>Risk sweep</span>
                  <span className="text-og-lime">clean</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-og-lime via-og-cyan to-[#f472b6]" />
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {homeTiles.map((tile) => (
                <div key={tile.label} className="rounded-[1.15rem] border border-white/10 bg-white/[0.055] p-3">
                  <div className={cn("mb-3 grid h-9 w-9 place-items-center rounded-2xl border", tile.color)}>
                    <tile.Icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-black text-white">{tile.value}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-white/70">{tile.label}</p>
                  <p className="text-[10px] text-white/35">{tile.sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.055] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-black text-white">Hot route</p>
                <p className="rounded-full bg-og-gold/15 px-2 py-1 text-[9px] font-black text-og-gold">NEW</p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f472b6]/12 text-[#f472b6]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-white">Pump.fun migration cluster</p>
                  <p className="text-[11px] text-white/40">4 linked wallets • 2 repeats</p>
                </div>
                <ArrowRight className="h-4 w-4 text-white/35" />
              </div>
            </div>
          </div>

          <div className="absolute inset-x-4 bottom-4 grid grid-cols-4 gap-2 rounded-[1.25rem] border border-white/10 bg-[#111b2a]/92 p-2 backdrop-blur-xl">
            {appTabs.map((tab) => (
              <div key={tab.label} className={cn("flex h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-bold", tab.active ? "bg-white text-[#08111f]" : "text-white/45")}>
                <tab.Icon className="h-4 w-4" />
                {tab.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
));
MobilePreview.displayName = "MobilePreview";

const BetaHome = memo(() => {
  const [copied, setCopied] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("og_ref_code", ref);
  }, [searchParams]);

  const copyCa = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(OGSCAN_TOKEN_MINT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#050914] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_82%_10%,rgba(163,230,53,0.14),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(244,114,182,0.12),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 grid-bg opacity-[0.12]" />

      <nav className="relative z-20 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-2xl border border-white/15 bg-white/10">
            <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em]">OGScan</p>
            <p className="text-[10px] font-semibold text-white/40">mobile intel suite</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/auth" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.07] text-white/70 transition hover:text-white" aria-label="Sign in">
            <LockKeyhole className="h-4 w-4" />
          </Link>
          <Link to="/auth?mode=signup" className="hidden min-h-10 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-[#07101d] transition active:scale-95 sm:inline-flex">
            Start <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 px-4 pb-28 pt-8 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:pb-16 lg:pt-10">
        <div className="order-2 lg:order-1">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-og-lime/25 bg-og-lime/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-og-lime">
            <span className="h-2 w-2 rounded-full bg-og-lime shadow-[0_0_18px_hsl(var(--og-lime))]" />
            Solana mainnet live
          </div>

          <h1 className="max-w-xl text-5xl font-black leading-[0.92] tracking-normal text-white sm:text-6xl lg:text-7xl">
            Token intel that feels like an app.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/58 sm:text-lg">
            Scan contracts, watch launches, track wallets, and jump into Spaces from a cleaner mobile-first command screen.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link to="/auth?mode=signup" className="flex min-h-14 items-center justify-between rounded-2xl bg-og-lime px-5 font-black text-og-ink shadow-[0_20px_50px_-32px_hsl(var(--og-lime))] transition active:scale-[0.98]">
              Create account
              <Fingerprint className="h-5 w-5" />
            </Link>
            <Link to="/auth" className="flex min-h-14 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.08] px-5 font-black text-white transition active:scale-[0.98]">
              Sign in
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              ["30+", "tools"],
              ["Live", "launches"],
              ["OG", "proof"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-3">
                <p className="text-xl font-black">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-og-gold/20 bg-og-gold/[0.07] p-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-og-gold">Official CA</p>
              <p className="truncate font-mono text-xs text-white/62">{shortAddr(OGSCAN_TOKEN_MINT, 8)}</p>
            </div>
            <button
              type="button"
              onClick={copyCa}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-og-gold/30 bg-og-gold/10 text-og-gold transition active:scale-95"
              aria-label="Copy token address"
            >
              {copied ? <CheckCircle2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <MobilePreview />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07101d]/95 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-2xl sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          {dockActions.map((action) => (
            <Link key={action.href} to={action.href} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-black", action.color)}>
              <action.Icon className="h-4 w-4" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
});

BetaHome.displayName = "BetaHome";
export default BetaHome;
