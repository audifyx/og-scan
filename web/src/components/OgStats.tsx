import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Users,
  Activity,
  Flame,
  Search,
  Loader2,
  Radar,
  DatabaseZap,
  RadioTower,
  CandlestickChart,
  Calendar,
  BadgeDollarSign,
} from "lucide-react";
import { CopyMintButton } from "@/components/CopyMintButton";
import {
  enrichTokensWithMarketIntel,
  jupGetTokens,
  jupSearchToken,
  birdeyeOhlcv,
  fmtUsd,
  fmtNum,
  fmtPct,
  shortAddr,
  shortDate,
  tokenDexPaidLabel,
  tokenMigrationDateIso,
  type JupTokenInfo,
} from "@/lib/og";

type Props = { mint: string; onSelect: (mint: string) => void };

const QUICK_SEARCHES: string[] = ["OG", "BONK", "WIF", "POPCAT", "MOG", "FARTCOIN"];

export const OgStats = ({ mint, onSelect }: Props) => {
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");

  useEffect(() => {
    const timer: number = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const { data: tokens, isLoading } = useQuery({
    queryKey: ["og-token", mint, "market-intel-v1"],
    queryFn: async () => enrichTokensWithMarketIntel(await jupGetTokens([mint]), { includeAth: true, maxAth: 1 }),
    refetchInterval: 20_000,
    enabled: !!mint,
  });
  const t: JupTokenInfo | undefined = tokens?.[0];

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["vitals-search", debouncedQuery, "market-intel-v1"],
    queryFn: async () => enrichTokensWithMarketIntel(await jupSearchToken(debouncedQuery), { includeAth: true, maxAth: 6 }),
    staleTime: 30_000,
    enabled: debouncedQuery.length >= 2,
  });

  const topSearchResults: JupTokenInfo[] = useMemo(() => {
    return (searchResults ?? [])
      .filter((token) => token.id !== mint)
      .slice(0, 6);
  }, [mint, searchResults]);

  const submitSearch = useCallback((raw: string) => {
    const cleaned: string = raw.trim().replace(/^\$/, "");
    if (!cleaned) return;

    const directMintLike: boolean = cleaned.length >= 32 && !cleaned.includes(" ");
    const firstHit: JupTokenInfo | undefined = searchResults?.[0];

    if (directMintLike) {
      onSelect(cleaned);
      setQuery("");
      setDebouncedQuery("");
      return;
    }

    if (firstHit) {
      onSelect(firstHit.id);
      setQuery("");
      setDebouncedQuery("");
      return;
    }

    setDebouncedQuery(cleaned);
  }, [onSelect, searchResults]);

  const selectToken = useCallback((tokenMint: string) => {
    onSelect(tokenMint);
    setQuery("");
    setDebouncedQuery("");
  }, [onSelect]);

  const { data: candles } = useQuery({
    queryKey: ["og-ohlcv", mint],
    queryFn: () => birdeyeOhlcv(mint, "15m"),
    refetchInterval: 60_000,
    enabled: !!mint,
  });

  return (
    <section id="og-stats" className="relative">
      <div className="overflow-hidden border border-og-grid bg-og-ink/45 shadow-[0_0_70px_rgba(188,255,0,0.07)]">
        <div className="relative border-b border-og-grid p-4 sm:p-6">
          <div className="absolute inset-0 grid-bg opacity-25" />
          <div className="absolute right-0 top-0 h-28 w-28 bg-og-lime/10 blur-3xl" />
          <div className="relative grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)] lg:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-lime">
                <span className="h-px w-10 bg-og-lime" />
                VITALS · TOKEN COMMAND CENTER
              </div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
                <span className="text-foreground">SEARCH ANY </span>
                <span className="text-og-gold text-glow-gold">SOLANA PAIR</span>
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Vitals no longer locks to a preset quote coin. Type a ticker, token name, or mint address and the panel retargets the live Jupiter + Birdeye + Helius feed.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <PipelineChip Icon={DatabaseZap} label="Jupiter metadata" />
                <PipelineChip Icon={CandlestickChart} label="Birdeye candles" accent="gold" />
                <PipelineChip Icon={RadioTower} label="Helius holders" accent="cyan" />
              </div>
            </div>

            <div className="relative">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitSearch(query);
                }}
                className="space-y-3"
              >
                <div className="og-search-box pl-3">
                  <Search className="h-4 w-4 text-og-cyan" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search $OG, WIF, BONK, token name, or mint…"
                    className="og-search-input px-1 font-mono text-sm tracking-wide"
                  />
                  {isSearching && <Loader2 className="mr-3 h-4 w-4 animate-spin text-og-lime" />}
                  <button
                    type="submit"
                    className="og-search-action px-5 text-[11px] font-bold uppercase tracking-widest text-og-cyan transition"
                  >
                    LOAD
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 px-1 py-1">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">quick scan</span>
                  {QUICK_SEARCHES.map((ticker) => (
                    <button
                      key={ticker}
                      type="button"
                      onClick={() => setQuery(ticker)}
                      className="border border-og-grid bg-og-ink/70 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/70 transition hover:border-og-gold hover:text-og-gold"
                    >
                      ${ticker}
                    </button>
                  ))}
                </div>
              </form>

              {debouncedQuery.length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-[360px] overflow-y-auto border border-og-grid bg-og-ink/95 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.65)] backdrop-blur">
                  {topSearchResults.length > 0 ? (
                    <div className="grid gap-2">
                      {topSearchResults.map((token) => (
                        <SearchResult key={token.id} token={token} onSelect={() => selectToken(token.id)} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                      {isSearching ? "Searching token graph…" : "No matches yet — paste an exact mint or try another ticker."}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <ActiveTarget t={t} mint={mint} loading={isLoading} />
          <SignalPanel t={t} />
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 pt-0 sm:p-6 sm:pt-0 lg:grid-cols-3">
          <PriceBlock t={t} candles={candles} loading={isLoading} />
          <Stat label="MARKET CAP" value={fmtUsd(t?.mcap)} accent="gold" />
          <Stat label="LIQUIDITY" value={fmtUsd(t?.liquidity)} accent="cyan" />
          <Stat label="ALL TIME HIGH" value={fmtUsd(t?.allTimeHighUsd)} sub={<span className="text-[10px] uppercase tracking-widest">{shortDate(t?.allTimeHighAt)}</span>} icon={<Flame className="h-4 w-4" />} accent="gold" />
          <Stat label="MIGRATION DAY" value={shortDate(t ? tokenMigrationDateIso(t) : undefined)} sub={<span className="text-[10px] uppercase tracking-widest">Pool/date only · not OG proof</span>} icon={<Calendar className="h-4 w-4" />} accent="cyan" />
          <Stat label="DEX PAID / BOOST" value={t ? tokenDexPaidLabel(t) : "—"} sub={<span className="text-[10px] uppercase tracking-widest">DexScreener boost spend when public</span>} icon={<BadgeDollarSign className="h-4 w-4" />} />

          <Stat label="24H VOLUME" value={fmtUsd((t?.stats24h?.buyVolume ?? 0) + (t?.stats24h?.sellVolume ?? 0))} sub={
            <span className="flex gap-3 text-[10px]">
              <span className="text-og-lime">B {fmtUsd(t?.stats24h?.buyVolume)}</span>
              <span className="text-og-blood">S {fmtUsd(t?.stats24h?.sellVolume)}</span>
            </span>
          } />
          <Stat label="HOLDERS" value={fmtNum(t?.holderCount)} icon={<Users className="h-4 w-4" />} />
          <Stat label="24H TRADERS" value={fmtNum(t?.stats24h?.numTraders)} sub={
            <span className="flex gap-3 text-[10px]">
              <span className="text-og-lime">B {fmtNum(t?.stats24h?.numBuys)}</span>
              <span className="text-og-blood">S {fmtNum(t?.stats24h?.numSells)}</span>
            </span>
          } icon={<Activity className="h-4 w-4" />} />

          <AuditBlock t={t} />
          <ScoreBlock t={t} />
          <BuzzBlock t={t} />
        </div>
      </div>
    </section>
  );
};

const PipelineChip = ({
  Icon,
  label,
  accent = "lime",
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent?: "lime" | "gold" | "cyan";
}) => {
  const cls: string = accent === "gold" ? "border-og-gold/35 text-og-gold" : accent === "cyan" ? "border-og-cyan/35 text-og-cyan" : "border-og-lime/35 text-og-lime";
  return (
    <span className={`inline-flex items-center gap-1.5 border bg-og-ink/60 px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
};

const SearchResult = ({ token, onSelect }: { token: JupTokenInfo; onSelect: () => void }) => {
  const change: number = token.stats24h?.priceChange ?? 0;
  const up: boolean = change >= 0;
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
      className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border border-og-grid bg-og-ink/80 p-3 text-left transition hover:border-og-lime hover:bg-og-lime/5"
    >
      <div className="h-10 w-10 overflow-hidden border border-og-grid bg-og-ink">
        {token.icon ? (
          <img src={token.icon} alt={token.symbol} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-og-lime">{token.symbol?.[0] ?? "?"}</div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm font-bold text-foreground">${token.symbol}</span>
          {token.isVerified && <ShieldCheck className="h-3 w-3 shrink-0 text-og-lime" />}
          <span className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">CA {shortAddr(token.id, 4)}</span>
        </div>
        <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">{token.name}</div>
      </div>
      <div className="text-right font-mono">
        <div className="text-xs text-foreground">{fmtUsd(token.usdPrice)}</div>
        <div className={`text-[10px] ${up ? "text-og-lime" : "text-og-blood"}`}>{fmtPct(change)}</div>
        <CopyMintButton mint={token.id} label="copy" copiedLabel="copied" className="mt-1 px-2 py-1" iconClassName="h-3 w-3" />
      </div>
    </article>
  );
};

const ActiveTarget = ({ t, mint, loading }: { t?: JupTokenInfo; mint: string; loading: boolean }) => {
  return (
    <div className="relative overflow-hidden border border-og-grid bg-og-ink/70 p-4">
      <div className="absolute right-3 top-3 text-[10px] uppercase tracking-[0.35em] text-og-lime/50">ACTIVE TARGET</div>
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden border border-og-lime/30 bg-og-ink">
          {t?.icon ? (
            <img src={t.icon} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center text-lg text-og-lime">{t?.symbol?.[0] ?? "?"}</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-3xl font-bold text-og-gold text-glow-gold">
              {loading ? "Loading…" : `${t?.symbol ?? "TOKEN"}`}
            </h3>
            {t?.isVerified && (
              <span className="inline-flex items-center gap-1 border border-og-lime/40 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-og-lime">
                <ShieldCheck className="h-3 w-3" /> verified
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{t?.name ?? "Search above to load a Solana token."}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-foreground/50">
            <span>CA {shortAddr(mint, 7)}</span>
            <CopyMintButton mint={mint} label="copy" copiedLabel="copied" className="px-2 py-1" iconClassName="h-3 w-3" />
          </div>
        </div>
      </div>
    </div>
  );
};

const SignalPanel = ({ t }: { t?: JupTokenInfo }) => {
  const buyVolume: number = t?.stats24h?.buyVolume ?? 0;
  const sellVolume: number = t?.stats24h?.sellVolume ?? 0;
  const totalVolume: number = buyVolume + sellVolume;
  const buyDominance: number = totalVolume > 0 ? Math.round((buyVolume / totalVolume) * 100) : 0;
  const riskFlags: number = [
    !t?.audit?.mintAuthorityDisabled,
    !t?.audit?.freezeAuthorityDisabled,
    (t?.audit?.topHoldersPercentage ?? 0) > 35,
  ].filter(Boolean).length;
  const status: string = riskFlags === 0 ? "CLEAN" : riskFlags === 1 ? "WATCH" : "DANGER";
  const statusClass: string = riskFlags === 0 ? "text-og-lime" : riskFlags === 1 ? "text-og-gold" : "text-og-blood";

  return (
    <div className="border border-og-grid bg-og-ink/70 p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-og-cyan">
        <span className="inline-flex items-center gap-2"><Radar className="h-3 w-3" /> live signal</span>
        <span className={statusClass}>{status}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <MiniMetric label="Buy pressure" value={`${buyDominance}%`} tone="lime" />
        <MiniMetric label="Organic" value={t?.organicScore != null ? t.organicScore.toFixed(0) : "—"} tone="gold" />
        <MiniMetric label="Top holders" value={t?.audit?.topHoldersPercentage != null ? `${t.audit.topHoldersPercentage.toFixed(1)}%` : "—"} tone="cyan" />
      </div>
      <div className="mt-4 h-2 overflow-hidden border border-og-grid bg-og-ink">
        <div className="h-full bg-og-lime transition-all" style={{ width: `${buyDominance}%` }} />
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">24h buy/sell pressure · retargets from search</div>
    </div>
  );
};

const MiniMetric = ({ label, value, tone }: { label: string; value: string; tone: "lime" | "gold" | "cyan" }) => {
  const color: string = tone === "gold" ? "text-og-gold" : tone === "cyan" ? "text-og-cyan" : "text-og-lime";
  return (
    <div className="border border-og-grid bg-og-ink/60 p-2">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
};

const PriceBlock = ({ t, candles, loading }: { t?: JupTokenInfo; candles?: { c: number; h: number; l: number }[]; loading: boolean }) => {
  const change = t?.stats24h?.priceChange ?? 0;
  const up = change >= 0;
  const path = useMemo(() => {
    if (!candles || candles.length < 2) return "";
    const w = 300, h = 80;
    const ys = candles.map((c) => c.c);
    const min = Math.min(...ys), max = Math.max(...ys);
    const range = max - min || 1;
    return candles
      .map((c, i) => {
        const x = (i / (candles.length - 1)) * w;
        const y = h - ((c.c - min) / range) * h;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [candles]);

  return (
    <div className="relative col-span-1 overflow-hidden border border-og-lime/40 bg-og-ink shadow-og lg:col-span-3">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-og-lime">PRICE/USD</div>
          <div className="mt-2 font-display text-5xl font-bold text-foreground text-glow sm:text-6xl">
            {loading ? <span className="opacity-50">…</span> : fmtUsd(t?.usdPrice)}
          </div>
          <div className={`mt-3 inline-flex items-center gap-2 px-2 py-1 text-xs uppercase tracking-widest ${up ? "bg-og-lime/15 text-og-lime" : "bg-og-blood/15 text-og-blood"}`}>
            {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            24H {fmtPct(change)}
          </div>
          <div className="mt-3 flex gap-4 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>5M <span className={(t?.stats5m?.priceChange ?? 0) >= 0 ? "text-og-lime" : "text-og-blood"}>{fmtPct(t?.stats5m?.priceChange)}</span></span>
            <span>1H <span className={(t?.stats1h?.priceChange ?? 0) >= 0 ? "text-og-lime" : "text-og-blood"}>{fmtPct(t?.stats1h?.priceChange)}</span></span>
          </div>
        </div>
        <div className="relative h-[80px] w-full max-w-md">
          {path ? (
            <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="h-full w-full">
              <defs>
                <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={up ? "hsl(var(--og-lime) / 0.5)" : "hsl(var(--og-blood) / 0.5)"} />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path d={`${path} L300,80 L0,80 Z`} fill="url(#lg)" />
              <path d={path} fill="none" stroke={up ? "hsl(var(--og-lime))" : "hsl(var(--og-blood))"} strokeWidth="1.5" />
            </svg>
          ) : (
            <div className="grid h-full place-items-center text-[10px] uppercase tracking-widest text-muted-foreground">CANDLES OFFLINE</div>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  sub,
  icon,
  accent = "lime",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: "lime" | "gold" | "cyan";
}) => {
  const ring = accent === "gold" ? "border-og-gold/40" : accent === "cyan" ? "border-og-cyan/40" : "border-og-grid";
  const accentText = accent === "gold" ? "text-og-gold" : accent === "cyan" ? "text-og-cyan" : "text-og-lime";
  return (
    <div className={`relative border ${ring} bg-og-ink/70 p-4`}>
      <div className={`flex items-center justify-between text-[10px] uppercase tracking-[0.3em] ${accentText}`}>
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 font-display text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="mt-2 text-muted-foreground">{sub}</div>}
    </div>
  );
};

const AuditBlock = ({ t }: { t?: JupTokenInfo }) => {
  const items = [
    { label: "MINT REVOKED", ok: t?.audit?.mintAuthorityDisabled === true },
    { label: "FREEZE REVOKED", ok: t?.audit?.freezeAuthorityDisabled === true },
    { label: "VERIFIED", ok: t?.isVerified === true },
  ];
  return (
    <div className="border border-og-grid bg-og-ink/70 p-4">
      <div className="text-[10px] uppercase tracking-[0.3em] text-og-cyan">AUDIT</div>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-widest">{i.label}</span>
            {i.ok ? (
              <span className="inline-flex items-center gap-1 text-og-lime"><ShieldCheck className="h-3 w-3" /> OK</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-og-blood"><ShieldAlert className="h-3 w-3" /> WATCH</span>
            )}
          </li>
        ))}
        <li className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground uppercase tracking-widest">TOP HOLDERS %</span>
          <span className="text-og-gold">{t?.audit?.topHoldersPercentage != null ? `${t.audit.topHoldersPercentage.toFixed(1)}%` : "—"}</span>
        </li>
      </ul>
    </div>
  );
};

const ScoreBlock = ({ t }: { t?: JupTokenInfo }) => {
  const score = t?.organicScore ?? 0;
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="border border-og-grid bg-og-ink/70 p-4">
      <div className="text-[10px] uppercase tracking-[0.3em] text-og-gold">ORGANIC SCORE</div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="font-display text-4xl font-bold text-og-gold text-glow-gold">{score.toFixed(0)}</span>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{t?.organicScoreLabel ?? "—"}</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden border border-og-grid bg-og-ink">
        <div className="h-full bg-og-gold" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">jupiter heuristic · 0–100</div>
    </div>
  );
};

const BuzzBlock = ({ t }: { t?: JupTokenInfo }) => {
  return (
    <div className="border border-og-grid bg-og-ink/70 p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-og-lime">
        <span>SOCIAL HEAT</span>
        <Flame className="h-4 w-4" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">CT LIKES</div>
          <div className="font-display text-2xl font-bold text-foreground">{fmtNum(t?.ctLikes)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">SMART CT</div>
          <div className="font-display text-2xl font-bold text-og-cyan">{fmtNum(t?.smartCtLikes)}</div>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        <div>first pool · {shortDate(t?.firstPool?.createdAt)}</div>
        <div>migration · {shortDate(t ? tokenMigrationDateIso(t) : undefined)} · DEX {t ? tokenDexPaidLabel(t) : "—"}</div>
      </div>
    </div>
  );
};
