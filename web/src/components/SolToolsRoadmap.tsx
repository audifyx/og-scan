import { memo, type ComponentType } from "react";
import {
  Blocks,
  CheckCircle2,
  Compass,
  ExternalLink,
  Flag,
  Globe2,
  MessageCircle,
  Network,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { OGSCAN_SITE_URL, OGSCAN_X_URL } from "@/lib/og";

const communityLinks: { label: string; href: string; detail: string }[] = [
  { label: "X", href: OGSCAN_X_URL, detail: "Public updates" },
  { label: "Website", href: OGSCAN_SITE_URL, detail: "Main platform" },
  { label: "X Community", href: "https://twitter.com/i/communities/2007536315483685053", detail: "Early users" },
  { label: "Telegram", href: "https://t.me/orbitxwrld", detail: "Scanner chat" },
  { label: "Updates", href: "https://t.me/OrbitXupdates", detail: "Announcements" },
];

type Tone = "lime" | "cyan" | "gold" | "red";

type RoadmapCard = {
  title: string;
  eyebrow: string;
  body: string;
  Icon: ComponentType<{ className?: string }>;
  tone: Tone;
  bullets: string[];
};

const roadmapCards: RoadmapCard[] = [
  {
    title: "Build a real home for crypto communities",
    eyebrow: "Our goal",
    body: "Crypto is scattered across platforms that were never designed for token communities. SolTools is the answer: tools, discovery, and community rails in one place.",
    Icon: Flag,
    tone: "lime",
    bullets: ["Crypto-native profiles", "Project-owned communities", "Signal over scam noise"],
  },
  {
    title: "Start with useful tools first",
    eyebrow: "Our plan",
    body: "OGScan begins as a lightweight scanner for blockchain history, first-pair discovery, token analytics, and launch intelligence before expanding into the wider SolTools ecosystem.",
    Icon: Compass,
    tone: "cyan",
    bullets: ["Blockchain scanning", "Token history", "Discovery dashboards"],
  },
  {
    title: "Grow the early operator community",
    eyebrow: "Next step",
    body: "The first wave should be active traders, project owners, developers, community leaders, and real users who help shape what SolTools becomes.",
    Icon: Users,
    tone: "gold",
    bullets: ["Beta testers", "Founder feedback", "Community-led roadmap"],
  },
  {
    title: "Become the social layer for crypto",
    eyebrow: "Long term vision",
    body: "Not just another tracker. SolTools should become the place where alpha, spaces, project communities, analytics, and social systems live together.",
    Icon: Network,
    tone: "lime",
    bullets: ["On-platform discussions", "Project community hubs", "Trader discovery graph"],
  },
];

const phases: { phase: string; title: string; status: string; items: string[]; tone: Tone }[] = [
  {
    phase: "01",
    title: "OGScan foundation",
    status: "Current focus",
    tone: "lime",
    items: ["Beta testing", "Platform stability", "Scanner UX", "Live-market tools"],
  },
  {
    phase: "02",
    title: "Community loop",
    status: "Building next",
    tone: "cyan",
    items: ["Active trader feedback", "Project owner onboarding", "Community leaders", "Developer input"],
  },
  {
    phase: "03",
    title: "Mobile rollout",
    status: "Future launch",
    tone: "gold",
    items: ["Google Play Store", "Apple App Store", "Larger public rollout", "Creator onboarding"],
  },
  {
    phase: "04",
    title: "SolTools ecosystem",
    status: "Big vision",
    tone: "lime",
    items: ["Social layer", "Spaces/discussions", "Multi-chain support", "Crypto community OS"],
  },
];

const chains: { name: string; status: string; tone: Tone }[] = [
  { name: "Solana", status: "First", tone: "lime" },
  { name: "Base", status: "Expansion", tone: "cyan" },
  { name: "Ethereum", status: "Expansion", tone: "gold" },
  { name: "Monad", status: "Expansion", tone: "cyan" },
  { name: "More chains", status: "Over time", tone: "lime" },
];

const toneClasses = (tone: Tone): { border: string; text: string; bg: string; shadow: string } => {
  if (tone === "cyan") return { border: "border-og-cyan/50", text: "text-og-cyan", bg: "bg-og-cyan/10", shadow: "shadow-[inset_3px_0_0_hsl(var(--og-cyan)/0.55)]" };
  if (tone === "gold") return { border: "border-og-gold/50", text: "text-og-gold", bg: "bg-og-gold/10", shadow: "shadow-[inset_3px_0_0_hsl(var(--og-gold)/0.55)]" };
  if (tone === "red") return { border: "border-og-blood/50", text: "text-og-blood", bg: "bg-og-blood/10", shadow: "shadow-[inset_3px_0_0_hsl(var(--og-blood)/0.55)]" };
  return { border: "border-og-lime/50", text: "text-og-lime", bg: "bg-og-lime/10", shadow: "shadow-[inset_3px_0_0_hsl(var(--og-lime)/0.55)]" };
};

export const SolToolsRoadmap = memo(() => {
  return (
    <section className="relative overflow-hidden border border-og-lime/35 bg-og-ink/90 shadow-og">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,hsl(var(--og-lime)/0.18),transparent_30%),radial-gradient(circle_at_78%_18%,hsl(var(--og-cyan)/0.16),transparent_32%),linear-gradient(180deg,hsl(var(--og-ink)/0.2),hsl(var(--background)/0.94))]" />
      <div className="absolute -right-32 top-24 h-80 w-80 rounded-full border border-og-cyan/20" />
      <div className="absolute -left-24 bottom-24 h-72 w-72 rounded-full border border-og-lime/20" />

      <div className="relative p-5 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 border border-og-lime/45 bg-og-lime/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-og-lime">
              <Zap className="h-3.5 w-3.5" /> SolTools roadmap
            </div>
            <h2 className="font-display text-[clamp(3rem,8vw,7.6rem)] font-black uppercase leading-[0.82] tracking-tighter">
              <span className="block text-og-gold text-glow-gold">Crypto needs</span>
              <span className="block text-og-lime text-glow">a real home.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-lg font-semibold leading-relaxed text-foreground sm:text-2xl">
              OGScan is the first product inside SolTools: a lightweight scanning layer that grows into a full social ecosystem for crypto communities.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              The mission is simple: stop forcing crypto communities into broken places filled with bots, scams, scattered chats, and disappearing community features. Build the platform crypto should have already had.
            </p>
          </div>

          <div className="relative overflow-hidden border border-og-grid bg-og-ink/78 p-5 shadow-[inset_0_0_0_1px_hsl(var(--og-lime)/0.08)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-og-lime to-transparent" />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-og-cyan">mission control</div>
                <div className="mt-1 font-display text-2xl font-bold uppercase tracking-tight text-foreground">From scanner to ecosystem</div>
              </div>
              <Rocket className="h-8 w-8 text-og-lime" />
            </div>
            <div className="grid gap-3">
              <SignalRow Icon={ShieldCheck} label="Now" value="Useful crypto tools first" tone="lime" />
              <SignalRow Icon={Users} label="Next" value="Grow the early community" tone="cyan" />
              <SignalRow Icon={Blocks} label="Then" value="Project hubs + social systems" tone="gold" />
              <SignalRow Icon={Globe2} label="Scale" value="Multi-chain crypto community layer" tone="lime" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {roadmapCards.map((card) => (
            <RoadmapMissionCard key={card.eyebrow} {...card} />
          ))}
        </div>

        <div className="mt-8 grid gap-4 xl:grid-cols-[1fr_0.75fr]">
          <div className="border border-og-grid bg-og-ink/76 p-4 sm:p-5">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-og-lime">execution path</div>
                <h3 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-foreground">Roadmap phases</h3>
              </div>
              <div className="inline-flex w-fit items-center gap-2 border border-og-cyan/45 bg-og-cyan/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-og-cyan">
                <Sparkles className="h-3.5 w-3.5" /> community-guided
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {phases.map((phase) => (
                <PhaseCard key={phase.phase} {...phase} />
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="border border-og-cyan/40 bg-og-ink/76 p-4 sm:p-5 shadow-[inset_3px_0_0_hsl(var(--og-cyan)/0.5)]">
              <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-og-cyan">
                <Network className="h-3.5 w-3.5" /> Chain expansion
              </div>
              <div className="grid gap-2">
                {chains.map((chain) => (
                  <ChainRow key={chain.name} {...chain} />
                ))}
              </div>
            </div>

            <div className="border border-og-gold/40 bg-og-gold/5 p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-og-gold">
                <Smartphone className="h-3.5 w-3.5" /> Mobile & platform growth
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Current focus is beta testing, platform stability, stronger tools, community growth, and scaling infrastructure. Future rollout targets Google Play, Apple App Store, public launch, and creator/project onboarding.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden border border-og-lime/35 bg-og-lime/5">
          <div className="border-b border-og-grid p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-og-lime">official links</div>
                <h3 className="mt-1 font-display text-2xl font-bold uppercase tracking-tight text-foreground">Join the early SolTools network</h3>
              </div>
              <MessageCircle className="hidden h-8 w-8 text-og-lime sm:block" />
            </div>
          </div>
          <div className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-5">
            {communityLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group flex min-h-[88px] flex-col justify-between border border-og-grid bg-og-ink/78 p-3 transition hover:border-og-lime hover:bg-og-lime/10"
              >
                <span className="flex items-center justify-between gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-og-lime">
                  {link.label} <ExternalLink className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">{link.detail}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
});

SolToolsRoadmap.displayName = "SolToolsRoadmap";

const SignalRow = memo(({ Icon, label, value, tone }: { Icon: ComponentType<{ className?: string }>; label: string; value: string; tone: Tone }) => {
  const toneClass = toneClasses(tone);

  return (
    <div className={`flex items-center gap-3 border ${toneClass.border} ${toneClass.bg} p-3`}>
      <div className={`grid h-9 w-9 shrink-0 place-items-center border ${toneClass.border} ${toneClass.text}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className={`font-mono text-[9px] uppercase tracking-[0.28em] ${toneClass.text}`}>{label}</div>
        <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
});

SignalRow.displayName = "SignalRow";

const RoadmapMissionCard = memo(({ title, eyebrow, body, Icon, tone, bullets }: RoadmapCard) => {
  const toneClass = toneClasses(tone);

  return (
    <article className={`relative overflow-hidden border ${toneClass.border} bg-og-ink/78 p-5 ${toneClass.shadow}`}>
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full border border-current opacity-10" />
      <div className="relative flex items-start gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center border ${toneClass.border} ${toneClass.bg} ${toneClass.text}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className={`font-mono text-[10px] uppercase tracking-[0.32em] ${toneClass.text}`}>{eyebrow}</div>
          <h3 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-foreground">{title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {bullets.map((bullet) => (
              <div key={bullet} className="flex items-center gap-2 border border-og-grid bg-background/30 px-2.5 py-2 text-[10px] uppercase tracking-widest text-foreground/75">
                <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${toneClass.text}`} />
                {bullet}
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
});

RoadmapMissionCard.displayName = "RoadmapMissionCard";

const PhaseCard = memo(({ phase, title, status, items, tone }: { phase: string; title: string; status: string; items: string[]; tone: Tone }) => {
  const toneClass = toneClasses(tone);

  return (
    <article className={`border ${toneClass.border} bg-og-ink/72 p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`font-mono text-[10px] uppercase tracking-[0.3em] ${toneClass.text}`}>{status}</div>
          <h4 className="mt-1 font-display text-xl font-bold uppercase tracking-tight text-foreground">{title}</h4>
        </div>
        <div className={`border ${toneClass.border} ${toneClass.bg} px-2.5 py-1 font-mono text-xs font-black ${toneClass.text}`}>{phase}</div>
      </div>
      <ul className="mt-4 grid gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${toneClass.bg}`} />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
});

PhaseCard.displayName = "PhaseCard";

const ChainRow = memo(({ name, status, tone }: { name: string; status: string; tone: Tone }) => {
  const toneClass = toneClasses(tone);

  return (
    <div className="flex items-center justify-between gap-3 border border-og-grid bg-background/30 px-3 py-2">
      <span className="font-display text-lg font-bold uppercase tracking-tight text-foreground">{name}</span>
      <span className={`border ${toneClass.border} ${toneClass.bg} px-2 py-1 font-mono text-[9px] uppercase tracking-[0.24em] ${toneClass.text}`}>{status}</span>
    </div>
  );
});

ChainRow.displayName = "ChainRow";
