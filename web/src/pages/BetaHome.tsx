import { memo, useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Apple,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  Globe2,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Scanlines } from "@/components/Scanlines";
import { cn } from "@/lib/utils";

const EXPO_APP_URL = "https://rork.app/?exp=p_ct333efmdotyxkemvlyk6--expo.rork.live&p=ct333efmdotyxkemvlyk6&app=false";
const IOS_EXPO_GO_URL = "https://apps.apple.com/us/app/expo-go/id982107779";
const ANDROID_EXPO_GO_URL = "https://play.google.com/store/apps/details?id=host.exp.exponent";

type PlatformCard = {
  title: string;
  eyebrow: string;
  Icon: LucideIcon;
  storeLabel: string;
  storeUrl: string;
  accent: "cyan" | "lime";
};

const platformCards: PlatformCard[] = [
  {
    title: "iOS",
    eyebrow: "Apple beta path",
    Icon: Apple,
    storeLabel: "Download Expo Go",
    storeUrl: IOS_EXPO_GO_URL,
    accent: "cyan",
  },
  {
    title: "Android",
    eyebrow: "Google beta path",
    Icon: Smartphone,
    storeLabel: "Download Expo Go",
    storeUrl: ANDROID_EXPO_GO_URL,
    accent: "lime",
  },
];

const issueTips: string[] = ["Check your internet connection", "Restart Expo Go", "Try opening the link in your browser first"];

const BetaHome = memo(() => {
  const [copied, setCopied] = useState<boolean>(false);

  const betaSteps: string[] = useMemo<string[]>(
    () => ["Download Expo Go for your phone", "Open the beta link below", "The OGScan app loads automatically in Expo Go"],
    [],
  );

  const copyBetaLink = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(EXPO_APP_URL);
      setCopied(true);
      window.setTimeout((): void => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Scanlines />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_0%,hsl(var(--og-cyan)/0.22),transparent_31%),radial-gradient(circle_at_90%_10%,hsl(var(--og-lime)/0.18),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--og-ink))_58%,#020511)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg opacity-30" />

      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 border border-og-grid bg-og-ink/82 p-3 shadow-og backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-og-lime bg-og-ink shadow-og">
              <img src="/icon.png" alt="OG Scan icon" className="h-full w-full object-cover" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-og-cyan shadow-og" />
            </div>
            <div>
              <p className="font-display text-sm font-black uppercase tracking-[0.28em] text-white">OGScan</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-og-cyan">Community beta</p>
            </div>
          </div>
          <Link
            to="/scanner"
            className="hidden border border-og-lime bg-og-lime px-4 py-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-og-ink transition hover:bg-transparent hover:text-og-lime sm:inline-flex"
          >
            Enter app
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-5 py-7 lg:grid-cols-[1.04fr_0.96fr] lg:gap-8 lg:py-10">
          <section className="relative overflow-hidden border border-og-grid bg-og-ink/84 p-5 shadow-[0_0_0_1px_hsl(var(--og-grid)),0_34px_120px_-72px_hsl(var(--og-cyan))] sm:p-7 lg:p-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-og-cyan via-og-lime to-white" />
            <div className="absolute right-4 top-4 hidden border border-og-cyan/40 bg-og-cyan/10 px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.26em] text-og-cyan sm:block">
              Beta is live
            </div>

            <div className="mb-5 inline-flex items-center gap-2 border border-og-lime/45 bg-og-lime/10 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[0.26em] text-og-lime">
              <Sparkles className="h-3.5 w-3.5" /> Community access open
            </div>

            <h1 className="font-display text-4xl font-black uppercase leading-[0.92] tracking-tighter text-white text-glow sm:text-6xl lg:text-7xl">
              Hey community beta is open
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Hey! We&apos;re excited to announce our beta is live. Here&apos;s how to get started with OGScan on your phone.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              {betaSteps.map((step: string, index: number) => (
                <div key={step} className="border border-og-grid bg-black/24 p-3">
                  <span className="mb-2 grid h-7 w-7 place-items-center border border-og-cyan/50 bg-og-cyan/10 font-mono text-[10px] font-black text-og-cyan">
                    {index + 1}
                  </span>
                  <p className="text-xs font-bold leading-relaxed text-white/82">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href={EXPO_APP_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 border border-og-lime bg-og-lime px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-og-ink shadow-og transition hover:bg-white hover:text-og-ink active:scale-[0.98]"
              >
                Open beta link <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={copyBetaLink}
                className={cn(
                  "inline-flex min-h-12 flex-1 items-center justify-center gap-2 border px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.18em] transition active:scale-[0.98]",
                  copied
                    ? "border-og-cyan bg-og-cyan text-og-ink"
                    : "border-og-grid bg-black/24 text-white hover:border-og-cyan hover:text-og-cyan",
                )}
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy beta link"}
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {platformCards.map((platform: PlatformCard) => (
                <PlatformCardView key={platform.title} platform={platform} />
              ))}
            </div>

            <section className="border border-og-gold/40 bg-og-gold/10 p-4 shadow-og-gold">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.24em] text-og-gold">
                <AlertTriangle className="h-4 w-4" /> Please note
              </div>
              <p className="text-sm leading-6 text-white/78">
                I&apos;m building this as I write this post. The app is still being actively developed—expect bugs, missing features, and things that might not work yet. We&apos;re still cooking!
              </p>
            </section>

            <section className="border border-og-grid bg-og-ink/82 p-4">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.24em] text-og-cyan">
                <Globe2 className="h-4 w-4" /> Having issues?
              </div>
              <ul className="space-y-2">
                {issueTips.map((tip: string) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-og-lime" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-og-grid pt-3 text-xs leading-5 text-white/60">
                Found a bug or have feedback? Hit us up—we&apos;d love to hear from you.
              </p>
            </section>
          </aside>
        </div>

        <footer className="pb-4 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.28em] text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-og-lime" /> Want the web tools instead?
          </div>
          <Link
            to="/scanner"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 border border-white/20 bg-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-og-ink transition hover:border-og-lime hover:bg-og-lime sm:w-auto"
          >
            Or go ahead and enter OG scanner <ArrowRight className="h-4 w-4" />
          </Link>
        </footer>
      </section>
    </main>
  );
});

BetaHome.displayName = "BetaHome";

const PlatformCardView = memo(({ platform }: { platform: PlatformCard }) => {
  const accentClass: string = platform.accent === "cyan" ? "border-og-cyan/45 bg-og-cyan/10 text-og-cyan" : "border-og-lime/45 bg-og-lime/10 text-og-lime";

  return (
    <section className="border border-og-grid bg-og-ink/82 p-4 shadow-og">
      <div className="flex items-start gap-3">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center border", accentClass)}>
          <platform.Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] font-black uppercase tracking-[0.26em] text-muted-foreground">{platform.eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-tight text-white">{platform.title}</h2>
        </div>
      </div>

      <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="font-mono text-og-cyan">1.</span>
          <a href={platform.storeUrl} target="_blank" rel="noreferrer" className="font-bold text-white underline decoration-og-cyan/50 underline-offset-4 transition hover:text-og-cyan">
            {platform.storeLabel}
          </a>
        </li>
        <li className="flex gap-2">
          <span className="font-mono text-og-cyan">2.</span>
          <a href={EXPO_APP_URL} target="_blank" rel="noreferrer" className="font-bold text-white underline decoration-og-lime/50 underline-offset-4 transition hover:text-og-lime">
            Open the OGScan beta link
          </a>
        </li>
      </ol>
    </section>
  );
});

PlatformCardView.displayName = "PlatformCardView";

export default BetaHome;
