import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Coins,
  Copy,
  ExternalLink,
  Flame,
  Globe2,
  LayoutGrid,
  MessageCircle,
  Radio,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Scanlines } from "@/components/Scanlines";
import { AuthButton } from "@/components/AuthButton";
import { OGSCAN_DEV_WALLET, OGSCAN_TOKEN_MINT, shortAddr } from "@/lib/og";
import { cn } from "@/lib/utils";

const OGSCAN_TELEGRAM_URL = "https://t.me/ogscanner";
const OGSCAN_BACKUP_X_URL = "https://x.com/ogscanbackup";

type CommunityCard = {
  title: string;
  eyebrow: string;
  Icon: LucideIcon;
  ctaLabel: string;
  url: string;
  description: string;
  accent: "cyan" | "lime";
};

type SplashToolLink = {
  title: string;
  href: string;
  description: string;
  Icon: LucideIcon;
  accent: "cyan" | "lime" | "gold";
};

const communityCards: CommunityCard[] = [
  {
    title: "Telegram",
    eyebrow: "Live community",
    Icon: MessageCircle,
    ctaLabel: "Join the chat",
    url: OGSCAN_TELEGRAM_URL,
    description: "The fastest place for OGScan updates, feedback, bug reports, and community notes.",
    accent: "lime",
  },
  {
    title: "Backup X",
    eyebrow: "Official posts",
    Icon: Radio,
    ctaLabel: "Follow on X",
    url: OGSCAN_BACKUP_X_URL,
    description: "Follow our backup X for DEX progress, launch notes, and important announcements.",
    accent: "cyan",
  },
];

const splashToolLinks: SplashToolLink[] = [
  {
    title: "Truth Scan",
    href: "/scanner",
    description: "Scan any mint for first-mint proof, dominance score, OG/Legacy status, LP safety, holder risk, and forensic quick actions.",
    Icon: Search,
    accent: "lime",
  },
  {
    title: "Launch Radar",
    href: "/snipe-feed",
    description: "Watch fresh Solana launches, Pump.fun migrations, repeat dev wallets, launch quality, CTO signals, and risk flags.",
    Icon: Target,
    accent: "cyan",
  },
  {
    title: "Market Feed",
    href: "/feed",
    description: "Track live runners, trending catalysts, whale pressure, pair liquidity, DEX boosts, bundle risk, and transaction flow.",
    Icon: Flame,
    accent: "gold",
  },
  {
    title: "Command Deck",
    href: "/app",
    description: "Open the full OGScan dashboard with every scanner, launch, market, swap, roadmap, and token-intel tool.",
    Icon: Radar,
    accent: "cyan",
  },
];

const issueTips: string[] = [
  "Paste a CA into Truth Scan for first mint, dominance, risk, holders, and LP safety",
  "Use Launch Radar to catch Pump.fun migrations, repeat devs, CTO signals, and new-launch risk",
  "Use Market Feed for live runners, catalysts, whales, DEX boosts, bundle risk, and transaction flow",
];

type HowToStep = {
  step: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  accent: "lime" | "cyan" | "gold";
};

const howToSteps: HowToStep[] = [
  {
    step: "01",
    title: "Paste any CA",
    description: "Drop any Solana mint address into Truth Scan. No wallet connection required.",
    Icon: Clipboard,
    accent: "lime",
  },
  {
    step: "02",
    title: "Get the full picture",
    description: "See on-chain OG status, first-mint proof, dominance score, LP safety, holder risk, and more — instantly.",
    Icon: ShieldCheck,
    accent: "cyan",
  },
  {
    step: "03",
    title: "Act before the market",
    description: "Use Launch Radar and Market Feed to watch live launches, migrations, whale moves, and CTO signals in real time.",
    Icon: Zap,
    accent: "gold",
  },
];

type StatBadge = {
  label: string;
  value: string;
};

const statBadges: StatBadge[] = [
  { value: "30+", label: "Intel tools" },
  { value: "Solana", label: "Chain focus" },
  { value: "On-chain", label: "OG verified" },
  { value: "Live", label: "Real-time data" },
];

const BetaHome = memo(() => {
  const [copied, setCopied] = useState<"coin" | null>(null);

  const launchNotes: string[] = useMemo<string[]>(
    () => ["No wallet needed", "First mint proof", "Real-time intel"],
    [],
  );

  const copyValue = useCallback(async (kind: "coin", value: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout((): void => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }, []);

  const copyCoinCa = useCallback((): void => {
    void copyValue("coin", OGSCAN_TOKEN_MINT);
  }, [copyValue]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Scanlines />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_16%_0%,hsl(var(--og-cyan)/0.26),transparent_30%),radial-gradient(circle_at_78%_8%,hsl(var(--og-lime)/0.2),transparent_32%),radial-gradient(circle_at_50%_95%,hsl(var(--og-gold)/0.08),transparent_34%),linear-gradient(180deg,#020716_0%,hsl(var(--background))_48%,#020409_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg opacity-25" />
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-white/[0.05] to-transparent" />

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 pb-24 sm:px-6 lg:px-8 lg:pb-8">
        <header className="sticky top-3 z-40 rounded-[1.5rem] border border-white/10 bg-[#031020]/88 p-2 shadow-[0_20px_80px_-48px_hsl(var(--og-cyan))] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3 px-1">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-og-lime bg-og-ink shadow-og">
                <img src="/icon.png" alt="OG Scan icon" className="h-full w-full object-cover" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-og-cyan shadow-og" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-black uppercase tracking-[0.24em] text-white">OGScan</p>
                <p className="truncate font-mono text-[9px] uppercase tracking-[0.25em] text-og-cyan">Solana memecoin intelligence</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                to="/app"
                className="hidden min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] px-4 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:border-og-cyan hover:text-og-cyan sm:inline-flex"
              >
                Command deck
              </Link>
              <AuthButton />
              <Link
                to="/scanner"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-og-lime bg-og-lime px-4 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-og-ink shadow-[0_0_34px_-10px_hsl(var(--og-lime))] transition hover:bg-white active:scale-[0.98]"
              >
                Truth scan <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* Stats bar */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {statBadges.map((s: StatBadge) => (
            <div key={s.label} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2">
              <span className="font-display text-sm font-black uppercase tracking-tight text-og-lime">{s.value}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="grid flex-1 items-center gap-5 py-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-7 lg:py-8">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_36px_130px_-78px_hsl(var(--og-cyan))] backdrop-blur-xl sm:p-7 lg:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-og-cyan via-og-lime to-white" />
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-og-lime/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-og-cyan/10 blur-3xl" />

            <div className="relative">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-og-lime/40 bg-og-lime/10 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-og-lime">
                <Sparkles className="h-3.5 w-3.5" /> Forensic tools live
              </div>

              <h1 className="font-display text-[2.4rem] font-black uppercase leading-[0.86] tracking-tighter text-white text-glow sm:text-7xl lg:text-8xl">
                Find the real OG before the market does.
              </h1>

              <div className="mt-5 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                <Link
                  to="/scanner"
                  className="group relative overflow-hidden rounded-[1.4rem] border border-og-lime bg-og-lime px-5 py-4 text-og-ink shadow-[0_0_48px_-12px_hsl(var(--og-lime))] transition hover:bg-white active:scale-[0.985]"
                >
                  <div className="absolute inset-y-0 right-0 w-24 bg-white/30 blur-2xl transition group-hover:translate-x-4" />
                  <div className="relative flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] opacity-70">Main workspace</p>
                      <p className="mt-1 font-display text-2xl font-black uppercase leading-none sm:text-3xl">Open Truth Scan</p>
                    </div>
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-og-ink text-og-lime">
                      <Search className="h-6 w-6" />
                    </div>
                  </div>
                </Link>

                <Link
                  to="/app"
                  className="inline-flex min-h-[88px] items-center justify-between gap-3 rounded-[1.4rem] border border-white/12 bg-white/[0.07] px-5 py-4 font-display text-xl font-black uppercase text-white transition hover:border-og-cyan hover:text-og-cyan active:scale-[0.985]"
                >
                  Open command deck <ArrowRight className="h-5 w-5" />
                </Link>
              </div>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
                OGScan gives traders a Solana-only intelligence stack: scan any mint, prove first origin, rank dominance, detect copycats, inspect LP safety, follow migrations, watch dev wallets, and track live market catalysts.
              </p>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {launchNotes.map((step: string, index: number) => (
                  <div key={step} className="rounded-[1.1rem] border border-white/10 bg-black/24 p-3">
                    <span className="mb-2 grid h-7 w-7 place-items-center rounded-full border border-og-cyan/50 bg-og-cyan/10 font-mono text-[10px] font-black text-og-cyan">
                      {index + 1}
                    </span>
                    <p className="text-sm font-bold leading-relaxed text-white/82">{step}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={OGSCAN_TELEGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-og-cyan/45 bg-og-cyan/10 px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-og-cyan transition hover:bg-og-cyan hover:text-og-ink active:scale-[0.98]"
                >
                  Join Telegram <ExternalLink className="h-4 w-4" />
                </a>
                <a
                  href={OGSCAN_BACKUP_X_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/12 bg-black/24 px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:border-white hover:bg-white hover:text-og-ink active:scale-[0.98]"
                >
                  Follow backup X <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-og-lime">
                    <Flame className="h-4 w-4" /> Tool stack
                  </div>
                  <h2 className="font-display text-2xl font-black uppercase tracking-tight text-white">Pick your tool</h2>
                </div>
                <Link to="/app" className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.2em] text-white/70 transition hover:text-og-cyan">
                  Deck
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {splashToolLinks.map((tool: SplashToolLink) => (
                  <SplashToolCard key={tool.href} tool={tool} />
                ))}
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-og-lime/35 bg-og-lime/10 p-4 shadow-og">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-og-lime">
                <Coins className="h-4 w-4" /> Token is live
              </div>
              <p className="text-sm font-semibold leading-6 text-white/86">
                Official CA: <span className="font-mono text-og-gold">{shortAddr(OGSCAN_TOKEN_MINT, 6)}</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Dev wallet: <span className="font-mono text-og-cyan">{shortAddr(OGSCAN_DEV_WALLET, 5)}</span>
              </p>
              <button
                type="button"
                onClick={copyCoinCa}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-og-gold/60 bg-og-gold/10 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-og-gold transition hover:bg-og-gold hover:text-og-ink"
              >
                {copied === "coin" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === "coin" ? "CA copied" : "Copy official CA"}
              </button>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {communityCards.map((card: CommunityCard) => (
                <CommunityCardView key={card.title} card={card} />
              ))}
            </div>

            <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-og-cyan">
                <Globe2 className="h-4 w-4" /> What to check first
              </div>
              <ul className="space-y-2">
                {issueTips.map((tip: string) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-og-lime" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-white/60">
                Start with the mint scanner when you need a fast verdict, then open the live feeds when you want market context around the same coin.
              </p>
            </section>
          </aside>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mb-6 text-center">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-og-cyan">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">Start in 3 steps</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {howToSteps.map((s: HowToStep) => {
            const accentBorder = s.accent === "gold" ? "border-og-gold/40" : s.accent === "cyan" ? "border-og-cyan/40" : "border-og-lime/40";
            const accentText = s.accent === "gold" ? "text-og-gold" : s.accent === "cyan" ? "text-og-cyan" : "text-og-lime";
            const accentBg = s.accent === "gold" ? "bg-og-gold/10" : s.accent === "cyan" ? "bg-og-cyan/10" : "bg-og-lime/10";
            return (
              <div key={s.step} className="relative rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5">
                <div className={cn("mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border", accentBorder, accentBg)}>
                  <s.Icon className={cn("h-5 w-5", accentText)} />
                </div>
                <p className={cn("mb-1 font-mono text-[10px] font-black uppercase tracking-[0.24em]", accentText)}>{s.step}</p>
                <h3 className="font-display text-xl font-black uppercase tracking-tight text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{s.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#020814]/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-2xl sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-[1fr_0.8fr] gap-2">
          <Link to="/scanner" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-og-lime px-4 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-og-ink shadow-[0_0_32px_-10px_hsl(var(--og-lime))] active:scale-95">
            <Search className="h-4 w-4" /> Truth scan
          </Link>
          <Link to="/app" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.09] px-4 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white active:scale-95">
            <LayoutGrid className="h-4 w-4" /> Deck
          </Link>
        </div>
      </div>
    </main>
  );
});

BetaHome.displayName = "BetaHome";

const SplashToolCard = memo(({ tool }: { tool: SplashToolLink }) => {
  const accentClass: string =
    tool.accent === "gold"
      ? "border-og-gold/45 bg-og-gold/10 text-og-gold"
      : tool.accent === "cyan"
        ? "border-og-cyan/45 bg-og-cyan/10 text-og-cyan"
        : "border-og-lime/45 bg-og-lime/10 text-og-lime";

  return (
    <Link
      to={tool.href}
      className={cn(
        "group relative overflow-hidden rounded-[1.25rem] border bg-black/20 p-3 transition hover:-translate-y-0.5 active:scale-[0.985]",
        tool.accent === "gold" ? "border-og-gold/20 hover:border-og-gold/50 hover:bg-og-gold/5"
          : tool.accent === "cyan" ? "border-og-cyan/20 hover:border-og-cyan/50 hover:bg-og-cyan/5"
          : "border-og-lime/20 hover:border-og-lime/50 hover:bg-og-lime/5",
      )}
    >
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition group-hover:opacity-100",
        tool.accent === "gold" ? "via-og-gold/50" : tool.accent === "cyan" ? "via-og-cyan/50" : "via-og-lime/50"
      )} />
      <div className="flex items-start gap-3">
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border", accentClass)}>
          <tool.Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-black uppercase leading-none text-white">{tool.title}</h3>
            <ArrowRight className={cn("h-4 w-4 shrink-0 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100",
              tool.accent === "gold" ? "text-og-gold" : tool.accent === "cyan" ? "text-og-cyan" : "text-og-lime"
            )} />
          </div>
          <p className="mt-2 text-sm leading-5 text-white/58">{tool.description}</p>
        </div>
      </div>
    </Link>
  );
});

SplashToolCard.displayName = "SplashToolCard";

const CommunityCardView = memo(({ card }: { card: CommunityCard }) => {
  const accentClass: string = card.accent === "cyan" ? "border-og-cyan/45 bg-og-cyan/10 text-og-cyan" : "border-og-lime/45 bg-og-lime/10 text-og-lime";
  const underlineClass: string = card.accent === "cyan" ? "decoration-og-cyan/50 hover:text-og-cyan" : "decoration-og-lime/50 hover:text-og-lime";

  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-start gap-3">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full border", accentClass)}>
          <card.Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">{card.eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-white">{card.title}</h2>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground">{card.description}</p>
      <a href={card.url} target="_blank" rel="noreferrer" className={cn("mt-3 inline-flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white underline underline-offset-4 transition", underlineClass)}>
        {card.ctaLabel} <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </section>
  );
});

CommunityCardView.displayName = "CommunityCardView";

export default BetaHome;
