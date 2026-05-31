import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Copy,
  Eye,
  Fingerprint,
  Flame,
  Globe,
  LockKeyhole,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { OGSCAN_TOKEN_MINT, shortAddr } from "@/lib/og";
import { cn } from "@/lib/utils";

const appTabs = [
  { label: "Scan", Icon: Search, active: true },
  { label: "Radar", Icon: Radar },
  { label: "Feed", Icon: Flame },
  { label: "Social", Icon: Users },
];

const navItems = [
  { label: "Scanner", Icon: Radar, active: true },
  { label: "Launch Radar", Icon: Target },
  { label: "Market Pulse", Icon: TrendingUp },
  { label: "Wallet Intel", Icon: Wallet },
  { label: "Live Feed", Icon: Flame },
  { label: "Spaces", Icon: Users },
];

const homeTiles = [
  { label: "Truth Scan", value: "92", sub: "OG confidence", Icon: ShieldCheck, color: "text-og-lime border-og-lime/30 bg-og-lime/10" },
  { label: "Launch Radar", value: "18", sub: "fresh mints", Icon: Target, color: "text-og-cyan border-og-cyan/30 bg-og-cyan/10" },
  { label: "Market Pulse", value: "Hot", sub: "whale pressure", Icon: TrendingUp, color: "text-[#f472b6] border-[#f472b6]/30 bg-[#f472b6]/10" },
  { label: "Wallet Intel", value: "Live", sub: "risk stream", Icon: Wallet, color: "text-og-gold border-og-gold/30 bg-og-gold/10" },
];

const features = [
  { title: "Contract truth scan", body: "Honeypot, mint authority, LP locks and rug vectors in one sweep.", Icon: ShieldCheck, color: "text-og-lime" },
  { title: "Launch radar", body: "Catch fresh mints and migrations the second they go live.", Icon: Target, color: "text-og-cyan" },
  { title: "Wallet intelligence", body: "Cluster linked wallets, track whales and dev behavior.", Icon: Fingerprint, color: "text-og-gold" },
  { title: "Live alpha feed", body: "Trending tokens, news signals and Spaces in real time.", Icon: Flame, color: "text-[#f472b6]" },
];

const dockActions = [
  { label: "Log in", href: "/auth", Icon: LockKeyhole, color: "border border-white/10 bg-white/[0.08] text-white" },
  { label: "Sign up", href: "/auth?mode=signup", Icon: Fingerprint, color: "bg-og-lime text-og-ink" },
];

const LOGO = "/icon-192x192.png";

function useTicker(seed: number, min: number, max: number, intervalMs = 2200) {
  const [val, setVal] = useState(seed);
  useEffect(() => {
    const id = setInterval(() => {
      setVal(() => Math.round(min + Math.random() * (max - min)));
    }, intervalMs);
    return () => clearInterval(id);
  }, [min, max, intervalMs]);
  return val;
}

const ScannerBars = memo(() => {
  const [bars, setBars] = useState<number[]>(() => [72, 54, 88, 41, 63, 79]);
  useEffect(() => {
    const id = setInterval(() => {
      setBars((prev) => prev.map(() => 28 + Math.round(Math.random() * 68)));
    }, 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex h-16 items-end gap-1.5">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md bg-gradient-to-t from-og-lime/30 to-og-cyan transition-all duration-700 ease-out"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
});
ScannerBars.displayName = "ScannerBars";

const WebAppPreview = memo(() => {
  const confidence = useTicker(92, 88, 98);
  const mints = useTicker(18, 11, 27);
  const whales = useTicker(34, 22, 48, 2600);

  const live = useMemo(
    () => [
      { name: "Pump.fun migration cluster", meta: "4 linked wallets · 2 repeats", tag: "NEW", tone: "text-og-gold bg-og-gold/15" },
      { name: "Clean LP lock detected", meta: "burned · authority revoked", tag: "SAFE", tone: "text-og-lime bg-og-lime/15" },
      { name: "Whale accumulation spike", meta: "+312 SOL last 5m", tag: "HOT", tone: "text-[#f472b6] bg-[#f472b6]/15" },
    ],
    [],
  );

  return (
    <div className="og-float relative w-full">
      <div className="overflow-hidden rounded-2xl border border-white/12 bg-[#0a1322]/95 shadow-[0_40px_120px_-50px_rgba(34,211,238,0.85)] backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/8 bg-white/[0.03] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <div className="ml-3 flex flex-1 items-center gap-2 rounded-lg border border-white/8 bg-black/30 px-3 py-1.5">
            <LockKeyhole className="h-3 w-3 text-og-lime" />
            <span className="text-[11px] font-semibold text-white/45">ogscan.app/scanner</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-og-lime/25 bg-og-lime/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-og-lime">
            <span className="og-pulse-dot h-1.5 w-1.5 rounded-full bg-og-lime" /> Live
          </div>
        </div>

        <div className="grid grid-cols-[180px_1fr]">
          <aside className="border-r border-white/8 bg-black/20 p-3">
            <div className="mb-4 flex items-center gap-2 px-1">
              <img src={LOGO} alt="OGScan" className="h-7 w-7 rounded-lg border border-white/15" />
              <span className="text-sm font-black text-white">OGScan</span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12px] font-bold transition",
                    item.active ? "bg-og-lime/12 text-og-lime" : "text-white/45 hover:text-white/70",
                  )}
                >
                  <item.Icon className="h-4 w-4" />
                  {item.label}
                </div>
              ))}
            </nav>
          </aside>

          <div className="relative min-h-[420px] p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.12),transparent_40%),radial-gradient(circle_at_95%_10%,rgba(163,230,53,0.10),transparent_40%)]" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-og-cyan">Token truth scan</p>
                  <h3 className="mt-1 text-2xl font-black text-white">Find the real OG.</h3>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-og-lime/30 bg-og-lime/10 text-og-lime">
                  <Radar className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { Icon: ShieldCheck, label: "OG confidence", value: `${confidence}`, c: "text-og-lime border-og-lime/25 bg-og-lime/[0.07]" },
                  { Icon: Target, label: "Fresh mints", value: `${mints}`, c: "text-og-cyan border-og-cyan/25 bg-og-cyan/[0.07]" },
                  { Icon: Wallet, label: "Whales active", value: `${whales}`, c: "text-og-gold border-og-gold/25 bg-og-gold/[0.07]" },
                ].map((s) => (
                  <div key={s.label} className={cn("rounded-2xl border p-3", s.c)}>
                    <s.Icon className="h-4 w-4" />
                    <p className="mt-2 text-2xl font-black tabular-nums text-white">{s.value}</p>
                    <p className="text-[10px] font-bold text-white/45">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-[1.4fr_1fr] gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[12px] font-black text-white">
                      <BarChart3 className="h-4 w-4 text-og-cyan" /> Volume sweep
                    </p>
                    <span className="text-[10px] font-bold text-og-lime">+18.4%</span>
                  </div>
                  <ScannerBars />
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[12px] font-black text-white">Risk sweep</p>
                  <div className="mt-3 space-y-2.5">
                    {["Honeypot", "Mint authority", "LP locked"].map((r, i) => (
                      <div key={r}>
                        <div className="mb-1 flex justify-between text-[10px] font-bold text-white/45">
                          <span>{r}</span>
                          <span className="text-og-lime">clean</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn("og-bar-grow h-full rounded-full bg-gradient-to-r from-og-lime to-og-cyan", `og-anim-delay-${i + 1}`)}
                            style={{ width: `${78 + i * 6}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {live.map((row) => (
                  <div key={row.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-og-cyan">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-white">{row.name}</p>
                      <p className="text-[11px] text-white/40">{row.meta}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-1 text-[9px] font-black", row.tone)}>{row.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
WebAppPreview.displayName = "WebAppPreview";

const MobilePreview = memo(() => {
  const confidence = useTicker(92, 88, 98);
  return (
    <div className="og-float mx-auto w-full max-w-[340px]">
      <div className="relative overflow-hidden rounded-[2.4rem] border border-white/15 bg-[#07101f] p-3 shadow-[0_40px_110px_-46px_rgba(34,211,238,0.95)]">
        <div className="absolute left-1/2 top-2.5 z-10 h-1.5 w-20 -translate-x-1/2 rounded-full bg-white/18" />
        <div className="overflow-hidden rounded-[1.9rem] border border-white/10 bg-[#0b1423]">
          <div className="relative min-h-[640px] p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_4%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_90%_16%,rgba(163,230,53,0.14),transparent_28%),radial-gradient(circle_at_50%_98%,rgba(244,114,182,0.12),transparent_34%)]" />
            <div className="relative">
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                    <img src={LOGO} alt="OGScan" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-[13px] font-black text-white">OGScan</p>
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-white/45">
                      <span className="og-pulse-dot h-1.5 w-1.5 rounded-full bg-og-lime" /> Command home
                    </p>
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
                  <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-og-lime/35 bg-og-lime/10 text-og-lime">
                    <span className="og-ping-ring absolute inset-0 rounded-2xl border border-og-lime/40" />
                    <Radar className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-white/45">
                    <span>OG confidence</span>
                    <span className="text-og-lime tabular-nums">{confidence}/100</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-og-lime via-og-cyan to-[#f472b6] transition-all duration-700"
                      style={{ width: `${confidence}%` }}
                    />
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
            </div>

            <div className="absolute inset-x-4 bottom-4 grid grid-cols-4 gap-2 rounded-[1.25rem] border border-white/10 bg-[#111b2a]/92 p-2 backdrop-blur-xl">
              {appTabs.map((tab) => (
                <div
                  key={tab.label}
                  className={cn(
                    "flex h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-bold",
                    tab.active ? "bg-white text-[#08111f]" : "text-white/45",
                  )}
                >
                  <tab.Icon className="h-4 w-4" />
                  {tab.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
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
      <div className="pointer-events-none fixed inset-0">
        <div className="og-aurora-1 absolute -left-32 top-0 h-[34rem] w-[34rem] rounded-full bg-og-cyan/14 blur-[140px]" />
        <div className="og-aurora-2 absolute -right-24 top-24 h-[30rem] w-[30rem] rounded-full bg-og-lime/12 blur-[130px]" />
        <div className="og-aurora-1 absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-[#f472b6]/10 blur-[130px]" />
      </div>
      <div className="grid-bg pointer-events-none fixed inset-0 opacity-[0.10]" />

      <nav className="relative z-20 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="og-fade-up flex items-center gap-2">
          <img src={LOGO} alt="OGScan" className="h-9 w-9 rounded-xl border border-white/15" />
          <span className="text-lg font-black tracking-tight">OGScan</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="og-fade-up og-anim-delay-1 inline-flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white transition active:scale-95"
          >
            <LockKeyhole className="h-4 w-4" />
            <span className="hidden sm:inline">Log in</span>
          </Link>
          <Link
            to="/auth?mode=signup"
            className="og-fade-up og-anim-delay-2 hidden min-h-10 items-center gap-2 rounded-2xl bg-og-lime px-4 text-sm font-black text-og-ink transition active:scale-95 sm:inline-flex"
          >
            Start <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 pb-28 pt-6 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:pb-16 lg:pt-10">
        <div className="order-2 lg:order-1">
          <div className="og-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-og-lime/25 bg-og-lime/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-og-lime">
            <span className="og-pulse-dot h-2 w-2 rounded-full bg-og-lime shadow-[0_0_18px_hsl(var(--og-lime))]" />
            Solana mainnet live
          </div>

          <h1 className="og-fade-up og-anim-delay-1 max-w-xl text-5xl font-black leading-[0.92] tracking-normal sm:text-6xl lg:text-7xl">
            Token intel that feels like <span className="og-gradient-text">an app.</span>
          </h1>
          <p className="og-fade-up og-anim-delay-2 mt-5 max-w-lg text-base leading-7 text-white/58 sm:text-lg">
            Scan contracts, watch launches, track wallets, and jump into Spaces from a cleaner
            command screen. A real mobile app on your phone, a full desktop workspace on the web.
          </p>

          <div className="og-fade-up og-anim-delay-3 mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              to="/auth?mode=signup"
              className="group flex min-h-14 items-center justify-between rounded-2xl bg-og-lime px-5 font-black text-og-ink shadow-[0_20px_50px_-32px_hsl(var(--og-lime))] transition active:scale-[0.98]"
            >
              Create account
              <Fingerprint className="h-5 w-5 transition-transform group-hover:scale-110" />
            </Link>
            <Link
              to="/auth"
              className="group flex min-h-14 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.08] px-5 font-black text-white transition active:scale-[0.98]"
            >
              Sign in
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="og-fade-up og-anim-delay-4 mt-6 grid gap-2.5 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 transition hover:border-white/20 hover:bg-white/[0.07]">
                <f.Icon className={cn("h-5 w-5", f.color)} />
                <p className="mt-2 text-sm font-black text-white">{f.title}</p>
                <p className="mt-0.5 text-[12px] leading-5 text-white/45">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="og-fade-up og-anim-delay-5 mt-5 grid grid-cols-3 gap-2">
            {[
              ["30+", "tools"],
              ["Live", "launches"],
              ["OG", "proof"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-3 text-center">
                <p className="text-xl font-black">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{label}</p>
              </div>
            ))}
          </div>

          <div className="og-fade-up og-anim-delay-6 mt-4 flex items-center justify-between rounded-2xl border border-og-gold/20 bg-og-gold/[0.07] p-3">
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

          <div className="og-fade-up og-anim-delay-6 mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-white/40">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-og-lime" /> Non-custodial</span>
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-og-cyan" /> Real-time data</span>
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-og-gold" /> Web + mobile</span>
            <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-[#f472b6]" /> No wallet connect needed</span>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <div className="og-fade-in og-anim-delay-2 hidden lg:block">
            <WebAppPreview />
          </div>
          <div className="og-fade-in og-anim-delay-2 lg:hidden">
            <MobilePreview />
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07101d]/95 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-2xl sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          {dockActions.map((action) => (
            <Link
              key={action.href}
              to={action.href}
              className={cn("flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-black", action.color)}
            >
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
