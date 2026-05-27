import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  MessageCircle,
  Radio,
  Search,
  ShieldCheck,
  Target,
  Zap,
  Radar,
  ChevronRight,
} from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
import { OGSCAN_TOKEN_MINT, shortAddr } from "@/lib/og";
import { cn } from "@/lib/utils";

const OGSCAN_TELEGRAM_URL = "https://t.me/ogscanner";
const OGSCAN_BACKUP_X_URL = "https://x.com/ogscanbackup";

/* ─── Animated radar SVG ─── */
const RadarAnimation = memo(() => {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow */}
      <div className="pointer-events-none absolute h-80 w-80 rounded-full bg-og-lime/8 blur-[60px]" />
      <div className="pointer-events-none absolute h-48 w-48 rounded-full bg-og-cyan/12 blur-[40px]" />

      {/* Radar rings */}
      <div className="relative h-64 w-64 sm:h-72 sm:w-72">
        {/* Spinning sweep */}
        <div className="absolute inset-0 spin-slow">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <defs>
              <radialGradient id="sweep" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--og-lime) / 0.55)" />
                <stop offset="100%" stopColor="hsl(var(--og-lime) / 0)" />
              </radialGradient>
            </defs>
            <path d="M100 100 L100 4 A96 96 0 0 1 194 112 Z" fill="url(#sweep)" />
          </svg>
        </div>

        {/* Static rings */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          <circle cx="100" cy="100" r="96" stroke="hsl(var(--og-lime) / 0.35)" strokeWidth="0.8" fill="none" />
          <circle cx="100" cy="100" r="72" stroke="hsl(var(--og-cyan) / 0.28)" strokeWidth="0.6" fill="none" strokeDasharray="3 5" />
          <circle cx="100" cy="100" r="48" stroke="hsl(var(--og-lime) / 0.2)" strokeWidth="0.5" fill="none" />
          <circle cx="100" cy="100" r="24" stroke="hsl(var(--og-cyan) / 0.15)" strokeWidth="0.4" fill="none" />
          {/* Crosshairs */}
          <line x1="100" y1="4" x2="100" y2="196" stroke="hsl(var(--og-lime) / 0.12)" strokeWidth="0.4" />
          <line x1="4" y1="100" x2="196" y2="100" stroke="hsl(var(--og-cyan) / 0.12)" strokeWidth="0.4" />
        </svg>

        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-og-lime bg-og-ink shadow-[0_0_32px_-6px_hsl(var(--og-lime))]">
            <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover" />
          </div>
        </div>

        {/* Blips */}
        <Blip x="10%" y="22%" label="MINT" tone="lime" />
        <Blip x="65%" y="14%" label="OG" tone="cyan" />
        <Blip x="68%" y="68%" label="DEX" tone="gold" />
        <Blip x="8%" y="70%" label="LP" tone="lime" />
      </div>
    </div>
  );
});
RadarAnimation.displayName = "RadarAnimation";

const Blip = ({
  x, y, label, tone = "cyan",
}: {
  x: string; y: string; label: string; tone?: "lime" | "gold" | "cyan";
}) => {
  const color =
    tone === "lime"
      ? "text-og-lime border-og-lime/50 bg-og-lime/10"
      : tone === "gold"
      ? "text-og-gold border-og-gold/50 bg-og-gold/10"
      : "text-og-cyan border-og-cyan/50 bg-og-cyan/10";
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest backdrop-blur", color)}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        {label}
      </div>
    </div>
  );
};

/* ─── Tool cards ─── */
const tools = [
  {
    title: "Truth Scan",
    href: "/scanner",
    desc: "Prove first origin, rank dominance, LP safety, holder risk.",
    Icon: Search,
    accent: "lime" as const,
  },
  {
    title: "Launch Radar",
    href: "/snipe-feed",
    desc: "Live Pump.fun migrations, repeat devs, CTO signals.",
    Icon: Target,
    accent: "cyan" as const,
  },
  {
    title: "Market Feed",
    href: "/feed",
    desc: "Runners, whale pressure, DEX boosts, bundle risk.",
    Icon: Flame,
    accent: "gold" as const,
  },
  {
    title: "Command Deck",
    href: "/app",
    desc: "Every scanner, intel tool, and live feed in one place.",
    Icon: Radar,
    accent: "cyan" as const,
  },
];

const steps = [
  { n: "01", title: "Paste any CA", body: "Drop any Solana mint address into Truth Scan. No wallet needed.", accent: "lime" as const },
  { n: "02", title: "Get the full picture", body: "On-chain OG status, first-mint proof, dominance, LP safety, holder risk — instantly.", accent: "cyan" as const },
  { n: "03", title: "Act before the market", body: "Watch live launches, migrations, whale moves, and CTO signals in real time.", accent: "gold" as const },
];

/* ─── Main component ─── */
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
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ── Background ── */}
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(ellipse_at_20%_0%,hsl(var(--og-cyan)/0.18),transparent_40%),radial-gradient(ellipse_at_80%_5%,hsl(var(--og-lime)/0.14),transparent_40%),radial-gradient(ellipse_at_50%_100%,hsl(var(--og-gold)/0.06),transparent_40%)]" />
      <div className="pointer-events-none fixed inset-0 -z-20 grid-bg opacity-[0.18]" />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-og-lime/60 bg-og-ink shadow-[0_0_18px_-4px_hsl(var(--og-lime))]">
              <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover" />
              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-og-lime" />
            </div>
            <div>
              <p className="font-display text-sm font-black uppercase tracking-[0.2em] text-white">OGScan</p>
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-og-cyan/80">Solana intelligence</p>
            </div>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/app"
              className="hidden items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/70 transition hover:border-og-cyan/50 hover:text-og-cyan sm:flex"
            >
              Deck <ChevronRight className="h-3 w-3" />
            </Link>
            <AuthButton />
            <Link
              to="/scanner"
              className="flex items-center gap-2 rounded-full border border-og-lime bg-og-lime px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-og-ink shadow-[0_0_28px_-8px_hsl(var(--og-lime))] transition hover:bg-white active:scale-95"
            >
              Truth Scan <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-24">
        {/* Left */}
        <div className="order-2 lg:order-1">
          {/* Live badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-og-lime/35 bg-og-lime/8 px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-og-lime">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-lime opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-og-lime" />
            </span>
            Solana mainnet · live
          </div>

          {/* Headline */}
          <h1 className="font-display text-[clamp(3rem,9vw,6.5rem)] font-black uppercase leading-[0.85] tracking-tighter">
            <span className="block text-white">Find the</span>
            <span className="block text-og-lime text-glow">real OG</span>
            <span className="block text-white/90">before the</span>
            <span className="block text-white/75">market does.</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
            Scan any Solana mint, prove first origin, rank dominance, detect copycats, inspect LP safety — no wallet needed.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/scanner"
              className="group relative flex min-h-[3.5rem] items-center justify-between gap-4 overflow-hidden rounded-2xl border border-og-lime bg-og-lime px-6 py-4 text-og-ink shadow-[0_0_56px_-14px_hsl(var(--og-lime))] transition hover:bg-white hover:shadow-[0_0_72px_-10px_hsl(var(--og-lime))] active:scale-[0.98]"
            >
              <span className="absolute inset-y-0 right-0 w-20 bg-white/25 blur-2xl transition group-hover:translate-x-4" />
              <span className="relative">
                <span className="block font-mono text-[9px] font-black uppercase tracking-[0.24em] opacity-60">Main workspace</span>
                <span className="mt-0.5 block font-display text-xl font-black uppercase leading-none">Open Truth Scan</span>
              </span>
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-og-ink text-og-lime">
                <Search className="h-5 w-5" />
              </span>
            </Link>

            <Link
              to="/app"
              className="flex min-h-[3.5rem] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-4 font-display text-lg font-black uppercase text-white/80 transition hover:border-og-cyan/50 hover:bg-white/[0.09] hover:text-og-cyan active:scale-[0.98]"
            >
              Command Deck <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          {/* Stat pills */}
          <div className="mt-7 flex flex-wrap gap-2">
            {["30+ intel tools", "Solana only", "On-chain OG proof", "Real-time data"].map((s) => (
              <div key={s} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/45">
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Right — radar */}
        <div className="order-1 flex items-center justify-center lg:order-2">
          <RadarAnimation />
        </div>
      </section>

      {/* ── Tool grid ── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-8">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-og-cyan">Intelligence stack</p>
          <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">Pick your tool</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => {
            const ring =
              tool.accent === "gold"
                ? "border-og-gold/20 hover:border-og-gold/50 hover:shadow-[0_0_40px_-18px_hsl(var(--og-gold))]"
                : tool.accent === "cyan"
                ? "border-og-cyan/20 hover:border-og-cyan/50 hover:shadow-[0_0_40px_-18px_hsl(var(--og-cyan))]"
                : "border-og-lime/20 hover:border-og-lime/50 hover:shadow-[0_0_40px_-18px_hsl(var(--og-lime))]";
            const icon =
              tool.accent === "gold"
                ? "border-og-gold/40 bg-og-gold/10 text-og-gold"
                : tool.accent === "cyan"
                ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan"
                : "border-og-lime/40 bg-og-lime/10 text-og-lime";
            const arrow =
              tool.accent === "gold" ? "text-og-gold" : tool.accent === "cyan" ? "text-og-cyan" : "text-og-lime";

            return (
              <Link
                key={tool.href}
                to={tool.href}
                className={cn(
                  "group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-white/[0.045] p-5 transition hover:-translate-y-0.5 active:scale-[0.98]",
                  ring,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full border", icon)}>
                    <tool.Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className={cn("mt-1 h-4 w-4 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100", arrow)} />
                </div>
                <div>
                  <h3 className="font-display text-xl font-black uppercase leading-none text-white">{tool.title}</h3>
                  <p className="mt-2 text-sm leading-5 text-white/52">{tool.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-og-cyan">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">Start in 3 steps</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => {
            const ac =
              s.accent === "gold"
                ? { border: "border-og-gold/30", bg: "bg-og-gold/8", text: "text-og-gold" }
                : s.accent === "cyan"
                ? { border: "border-og-cyan/30", bg: "bg-og-cyan/8", text: "text-og-cyan" }
                : { border: "border-og-lime/30", bg: "bg-og-lime/8", text: "text-og-lime" };
            return (
              <div key={s.n} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-6">
                <div className={cn("pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl", ac.bg)} />
                <span className={cn("font-mono text-5xl font-black leading-none opacity-20", ac.text)}>{s.n}</span>
                <h3 className="mt-3 font-display text-xl font-black uppercase tracking-tight text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Token + Community ── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Official token */}
          <div className="relative overflow-hidden rounded-2xl border border-og-gold/30 bg-og-gold/[0.07] p-5">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-og-gold/8 blur-3xl" />
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.24em] text-og-gold">Token is live</p>
            <p className="mt-1 font-display text-2xl font-black uppercase text-white">Official CA</p>
            <p className="mt-2 font-mono text-xs text-white/50">{shortAddr(OGSCAN_TOKEN_MINT, 8)}</p>
            <button
              type="button"
              onClick={copyCa}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-og-gold/40 bg-og-gold/10 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-og-gold transition hover:bg-og-gold hover:text-og-ink active:scale-95"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy CA"}
            </button>
          </div>

          {/* Telegram */}
          <a
            href={OGSCAN_TELEGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-og-cyan/25 bg-white/[0.045] p-5 transition hover:border-og-cyan/50 hover:bg-og-cyan/[0.06]"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-og-cyan/6 blur-3xl" />
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-og-cyan/40 bg-og-cyan/10 text-og-cyan">
              <MessageCircle className="h-5 w-5" />
            </div>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-og-cyan">Live community</p>
            <p className="mt-1 font-display text-xl font-black uppercase text-white">Telegram</p>
            <p className="mt-2 text-sm leading-5 text-white/52">Updates, feedback, bug reports, and community notes.</p>
            <div className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-og-cyan">
              Join the chat <ExternalLink className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </a>

          {/* X */}
          <a
            href={OGSCAN_BACKUP_X_URL}
            target="_blank"
            rel="noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-5 transition hover:border-white/25 hover:bg-white/[0.07]"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/4 blur-3xl" />
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white/8 text-white/70">
              <Radio className="h-5 w-5" />
            </div>
            <p className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-white/50">Official posts</p>
            <p className="mt-1 font-display text-xl font-black uppercase text-white">Backup X</p>
            <p className="mt-2 text-sm leading-5 text-white/52">DEX progress, launch notes, and announcements.</p>
            <div className="mt-4 inline-flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
              Follow on X <ExternalLink className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </a>
        </div>
      </section>

      {/* ── Mobile bottom CTA bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-background/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-2xl sm:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/scanner"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-og-lime font-mono text-[10px] font-black uppercase tracking-[0.16em] text-og-ink shadow-[0_0_28px_-8px_hsl(var(--og-lime))] active:scale-95"
          >
            <Search className="h-4 w-4" /> Truth Scan
          </Link>
          <Link
            to="/app"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] font-mono text-[10px] font-black uppercase tracking-[0.16em] text-white active:scale-95"
          >
            <Zap className="h-4 w-4" /> Deck
          </Link>
        </div>
      </div>
    </main>
  );
});

BetaHome.displayName = "BetaHome";
export default BetaHome;
