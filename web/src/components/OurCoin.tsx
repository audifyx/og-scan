import { memo, useCallback, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  AtSign,
  Check,
  Coins,
  Copy,
  ExternalLink,
  Globe2,
  Link2,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { OGSCAN_SITE_URL, OGSCAN_X_URL, shortAddr } from "@/lib/og";

/**
 * Fill these in when the official coin details are ready.
 * Once `contractAddress` is set, the DexScreener + chart placeholders become live links.
 */
type OurCoinProfile = {
  name: string;
  symbol: string;
  contractAddress: string;
  siteUrl: string;
  xUrl: string;
  dexScreenerUrl: string;
  chartEmbedUrl: string;
};

const OUR_COIN_PROFILE: OurCoinProfile = {
  name: "ogscan.fun",
  symbol: "$OGSCAN",
  contractAddress: "",
  siteUrl: OGSCAN_SITE_URL,
  xUrl: OGSCAN_X_URL,
  dexScreenerUrl: "",
  chartEmbedUrl: "",
};

const buildDexScreenerUrl = (contractAddress: string, overrideUrl: string): string => {
  if (overrideUrl.trim()) return overrideUrl.trim();
  if (!contractAddress.trim()) return "";
  return `https://dexscreener.com/solana/${contractAddress.trim()}`;
};

const buildChartEmbedUrl = (contractAddress: string, overrideUrl: string): string => {
  if (overrideUrl.trim()) return overrideUrl.trim();
  if (!contractAddress.trim()) return "";
  return `https://dexscreener.com/solana/${contractAddress.trim()}?embed=1&theme=dark&trades=0&info=0`;
};

export const OurCoin = memo(() => {
  const [copied, setCopied] = useState<boolean>(false);
  const contractAddress = OUR_COIN_PROFILE.contractAddress.trim();
  const hasContract = contractAddress.length > 20;
  const dexScreenerUrl = useMemo<string>(
    () => buildDexScreenerUrl(contractAddress, OUR_COIN_PROFILE.dexScreenerUrl),
    [contractAddress]
  );
  const chartEmbedUrl = useMemo<string>(
    () => buildChartEmbedUrl(contractAddress, OUR_COIN_PROFILE.chartEmbedUrl),
    [contractAddress]
  );

  const copyContract = useCallback((): void => {
    if (!hasContract) return;
    void navigator.clipboard.writeText(contractAddress).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }, [contractAddress, hasContract]);

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--og-lime)/0.13),transparent_28%),radial-gradient(circle_at_92%_12%,hsl(var(--og-cyan)/0.12),transparent_34%)]" />

      <div className="relative grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="border border-og-gold/40 bg-og-ink/80 p-4 shadow-og-gold sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-gold">
                <span className="h-px w-10 bg-og-gold" /> /OFFICIAL · COIN · HUB
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
                <span className="text-foreground">OUR COIN</span>{" "}
                <span className="text-og-gold text-glow-gold">LAUNCH BAY</span>
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Reserved command center for the official {OUR_COIN_PROFILE.name} coin. Website
                and X profile are live now. CA, DexScreener and chart stay staged until the
                contract address is ready, so the wrong token never gets promoted.
              </p>
            </div>

            <div className="border border-og-lime/50 bg-og-lime/5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-og-lime">
              <div className="flex items-center gap-2">
                <Radio className="h-3 w-3 animate-pulse" /> STATUS
              </div>
              <div className="mt-1 text-foreground">SOCIALS LIVE · AWAITING CA</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <TokenIdentityCard />
            <InfoSlot
              Icon={Wallet}
              label="CA"
              value={hasContract ? shortAddr(contractAddress, 6) : "placeholder · paste CA"}
              accent="text-og-gold"
              action={
                <button
                  type="button"
                  onClick={copyContract}
                  disabled={!hasContract}
                  className="inline-flex items-center gap-1 border border-og-grid px-2 py-1 text-[9px] uppercase tracking-widest text-foreground/60 transition enabled:hover:border-og-lime enabled:hover:text-og-lime disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "COPIED" : "COPY"}
                </button>
              }
            />
            <InfoSlot
              Icon={AtSign}
              label="X"
              value={OUR_COIN_PROFILE.xUrl ? "@ogscanfun connected" : "placeholder · add @handle"}
              accent="text-og-cyan"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_300px]">
            <div className="relative min-h-[360px] overflow-hidden border border-og-grid bg-black/35">
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-og-grid bg-og-ink/90 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-2 text-og-cyan">
                  <TrendingUp className="h-3 w-3" /> LIVE CHART
                </span>
                <span>{hasContract ? "DexScreener feed" : "chart placeholder"}</span>
              </div>

              {chartEmbedUrl ? (
                <iframe
                  title={`${OUR_COIN_PROFILE.symbol} DexScreener chart`}
                  src={chartEmbedUrl}
                  className="h-[420px] w-full border-0 pt-8"
                  loading="lazy"
                />
              ) : (
                <ChartPlaceholder />
              )}
            </div>

            <div className="grid gap-3">
              <ActionLink
                Icon={Globe2}
                label="Website"
                detail="Open ogscan.fun"
                href={OUR_COIN_PROFILE.siteUrl}
                tone="lime"
              />
              <ActionLink
                Icon={ExternalLink}
                label="DexScreener"
                detail={dexScreenerUrl ? "Open official pair" : "placeholder · auto-builds from CA"}
                href={dexScreenerUrl}
                tone="gold"
              />
              <ActionLink
                Icon={AtSign}
                label="X / Twitter"
                detail={OUR_COIN_PROFILE.xUrl ? "Open official X" : "placeholder · add social link"}
                href={OUR_COIN_PROFILE.xUrl}
                tone="cyan"
              />
              <div className="border border-og-grid bg-og-ink/70 p-3">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-og-lime">
                  <ShieldCheck className="h-3 w-3" /> CONNECTION MAP
                </div>
                <div className="space-y-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <PipelineStep active label="Reserve official coin tab" />
                  <PipelineStep active label="Connect website + X channels" />
                  <PipelineStep active={hasContract} label="Attach CA" />
                  <PipelineStep active={Boolean(dexScreenerUrl)} label="Open DexScreener route" />
                  <PipelineStep active={Boolean(chartEmbedUrl)} label="Render live chart" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="border border-og-cyan/35 bg-og-cyan/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-og-cyan">
              <Sparkles className="h-3 w-3" /> READY SLOTS
            </div>
            <div className="grid gap-2">
              <SetupCard label="Contract address" value="CA placeholder" status={hasContract ? "connected" : "waiting"} />
              <SetupCard label="Website" value="ogscan.fun" status={OUR_COIN_PROFILE.siteUrl ? "connected" : "waiting"} />
              <SetupCard label="X profile" value="@ogscanfun" status={OUR_COIN_PROFILE.xUrl ? "connected" : "waiting"} />
              <SetupCard label="DexScreener" value="pair/chart placeholder" status={dexScreenerUrl ? "connected" : "waiting"} />
            </div>
          </div>

          <div className="border border-og-grid bg-og-ink/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-og-gold">
              <Zap className="h-3 w-3" /> WHAT HAPPENS NEXT
            </div>
            <p className="text-sm text-muted-foreground">
              Website and X profile are connected. Send the CA when ready and this tab can flip into
              a live official coin page with copyable contract address, DexScreener route
              and chart embed.
            </p>
            <div className="mt-4 border border-dashed border-og-gold/35 bg-og-gold/5 p-3 font-mono text-[10px] uppercase tracking-widest text-og-gold">
              CA slot is intentionally empty so no wrong token gets promoted before launch.
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
});

OurCoin.displayName = "OurCoin";

const TokenIdentityCard = memo(() => (
  <div className="md:col-span-1 border border-og-grid bg-og-ink/70 p-3">
    <div className="mb-3 flex items-center gap-3">
      <div className="relative grid h-12 w-12 place-items-center overflow-hidden border border-og-gold bg-og-gold/10">
        <Coins className="h-6 w-6 text-og-gold" />
        <span className="absolute inset-x-0 bottom-0 h-px bg-og-gold shadow-[0_0_12px_hsl(var(--og-gold))]" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-base font-bold text-foreground">{OUR_COIN_PROFILE.symbol}</div>
        <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
          {OUR_COIN_PROFILE.name}
        </div>
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-og-grid pt-2 font-mono text-[10px] uppercase tracking-widest">
      <span className="text-muted-foreground">profile</span>
      <span className="text-og-gold">official</span>
    </div>
  </div>
));

TokenIdentityCard.displayName = "TokenIdentityCard";

const InfoSlot = memo(
  ({
    Icon,
    label,
    value,
    accent,
    action,
  }: {
    Icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
    accent: string;
    action?: ReactNode;
  }) => (
    <div className="border border-og-grid bg-og-ink/70 p-3">
      <div className={`mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] ${accent}`}>
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="min-h-8 text-xs text-foreground/80">{value}</div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
);

InfoSlot.displayName = "InfoSlot";

const ActionLink = memo(
  ({
    Icon,
    label,
    detail,
    href,
    tone,
  }: {
    Icon: ComponentType<{ className?: string }>;
    label: string;
    detail: string;
    href: string;
    tone: "lime" | "gold" | "cyan";
  }) => {
    const toneClass: Record<typeof tone, string> = {
      lime: "text-og-lime border-og-lime/40 hover:bg-og-lime hover:text-og-ink",
      gold: "text-og-gold border-og-gold/40 hover:bg-og-gold hover:text-og-ink",
      cyan: "text-og-cyan border-og-cyan/40 hover:bg-og-cyan hover:text-og-ink",
    };
    const className = `group flex items-center justify-between gap-3 border bg-og-ink/70 p-3 transition ${
      href ? toneClass[tone] : "cursor-not-allowed border-og-grid text-foreground/45 opacity-70"
    }`;

    if (!href) {
      return (
        <div className={className} aria-disabled="true">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-widest">{label}</span>
              <span className="block text-[10px] text-muted-foreground">{detail}</span>
            </span>
          </span>
          <Link2 className="h-4 w-4" />
        </div>
      );
    }

    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span>
            <span className="block font-mono text-[10px] uppercase tracking-widest">{label}</span>
            <span className="block text-[10px] text-muted-foreground group-hover:text-og-ink/70">{detail}</span>
          </span>
        </span>
        <ExternalLink className="h-4 w-4" />
      </a>
    );
  }
);

ActionLink.displayName = "ActionLink";

const PipelineStep = memo(({ active, label }: { active: boolean; label: string }) => (
  <div className="flex items-center justify-between gap-3 border border-og-grid/70 bg-og-ink/50 px-2 py-1.5">
    <span>{label}</span>
    <span className={active ? "text-og-lime" : "text-foreground/35"}>{active ? "ONLINE" : "WAIT"}</span>
  </div>
));

PipelineStep.displayName = "PipelineStep";

const SetupCard = memo(
  ({ label, value, status }: { label: string; value: string; status: "connected" | "waiting" }) => (
    <div className="flex items-center justify-between gap-3 border border-og-grid bg-og-ink/60 p-3">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-foreground">{label}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{value}</div>
      </div>
      <span
        className={`shrink-0 border px-2 py-1 font-mono text-[9px] uppercase tracking-widest ${
          status === "connected" ? "border-og-lime/50 text-og-lime" : "border-og-gold/40 text-og-gold"
        }`}
      >
        {status}
      </span>
    </div>
  )
);

SetupCard.displayName = "SetupCard";

const ChartPlaceholder = memo(() => (
  <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden pt-8">
    <div className="absolute inset-0 grid-bg opacity-60" />
    <div className="absolute left-0 right-0 top-16 h-px bg-og-cyan/40 scan-line" />
    <svg viewBox="0 0 640 300" className="absolute inset-x-0 bottom-4 h-72 w-full text-og-lime/80" aria-hidden="true">
      <defs>
        <linearGradient id="our-coin-chart-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 248 L45 236 L82 244 L128 214 L170 220 L210 184 L252 196 L296 142 L338 158 L380 116 L420 132 L466 86 L512 104 L552 58 L600 76 L640 42 L640 300 L0 300 Z"
        fill="url(#our-coin-chart-fill)"
      />
      <path
        d="M0 248 L45 236 L82 244 L128 214 L170 220 L210 184 L252 196 L296 142 L338 158 L380 116 L420 132 L466 86 L512 104 L552 58 L600 76 L640 42"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
    <div className="relative z-10 max-w-sm border border-og-gold/40 bg-og-ink/90 p-5 text-center shadow-og-gold">
      <Activity className="mx-auto mb-3 h-7 w-7 text-og-gold" />
      <div className="font-display text-xl font-bold text-og-gold">CHART ARMED</div>
      <p className="mt-2 text-sm text-muted-foreground">
        Waiting for the official contract address. Once added, this panel becomes the live
        DexScreener chart.
      </p>
    </div>
  </div>
));

ChartPlaceholder.displayName = "ChartPlaceholder";
