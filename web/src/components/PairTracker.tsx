import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Radar,
  Plus,
  X,
  ShieldCheck,
  Droplets,
  Users,
  Calendar,
  Sparkles,
  Filter,
  Bell,
  Flame,
  BadgeDollarSign,
  BellOff,
  Pause,
  Play,
} from "lucide-react";
import { CopyMintButton } from "@/components/CopyMintButton";
import {
  jupSearchToken,
  jupGetTokens,
  jupTrending,
  jupTopOrganic,
  fmtUsd,
  fmtNum,
  fmtPct,
  shortAddr,
  timeAgo,
  enrichTokensWithMarketIntel,
  shortDate,
  tokenDexPaidLabel,
  tokenMigrationDateIso,
  type JupTokenInfo,
} from "@/lib/og";

type Props = { onSelect: (mint: string) => void };

const STORAGE_TICKERS = "og_scanner.tracked_tickers";
const STORAGE_SEEN = "og_scanner.seen_pairs";
const STORAGE_FILTER = "og_scanner.quality_filter.v3";
const STORAGE_MODE = "og_scanner.tracker_mode.v2";

type Mode = "tickers" | "any" | "all";

type DexTokenProfile = {
  chainId?: string;
  tokenAddress?: string;
  url?: string;
  description?: string;
  icon?: string;
  header?: string;
  openGraph?: string;
};

type DexBoost = {
  chainId?: string;
  tokenAddress?: string;
  url?: string;
  amount?: number;
  totalAmount?: number;
  icon?: string;
  description?: string;
};

type DexFreshToken = {
  mint: string;
  icon?: string;
  description?: string;
  sourceUrl?: string;
};

type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: { m5?: { buys?: number; sells?: number }; h1?: { buys?: number; sells?: number }; h6?: { buys?: number; sells?: number }; h24?: { buys?: number; sells?: number } };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string; header?: string; openGraph?: string };
};

type Quality = {
  minLiq: number;
  minHolders: number;
  requireAudit: boolean;
  requireVerified: boolean;
  maxTop10: number;
  maxAgeDays: number;
};

const DEFAULT_QUALITY: Quality = {
  minLiq: 0,
  minHolders: 0,
  requireAudit: false,
  requireVerified: false,
  maxTop10: 100,
  maxAgeDays: 30,
};

const GOOD_QUALITY: Quality = {
  minLiq: 5_000,
  minHolders: 25,
  requireAudit: false,
  requireVerified: false,
  maxTop10: 65,
  maxAgeDays: 14,
};

const STRICT_QUALITY: Quality = {
  minLiq: 25_000,
  minHolders: 100,
  requireAudit: true,
  requireVerified: false,
  maxTop10: 45,
  maxAgeDays: 7,
};

function qualityEquals(a: Quality, b: Quality): boolean {
  return (
    a.minLiq === b.minLiq &&
    a.minHolders === b.minHolders &&
    a.requireAudit === b.requireAudit &&
    a.requireVerified === b.requireVerified &&
    a.maxTop10 === b.maxTop10 &&
    a.maxAgeDays === b.maxAgeDays
  );
}

function passesQuality(t: JupTokenInfo, q: Quality): boolean {
  const liquidity = t.liquidity ?? 0;
  if (liquidity < q.minLiq) return false;

  if (q.minHolders > 0) {
    if (typeof t.holderCount !== "number") return false;
    if (t.holderCount < q.minHolders) return false;
  }

  if (q.requireAudit) {
    if (!t.audit?.mintAuthorityDisabled) return false;
    if (!t.audit?.freezeAuthorityDisabled) return false;
  }

  if (q.requireVerified && !t.isVerified) return false;

  if (q.maxTop10 < 100 && typeof t.audit?.topHoldersPercentage === "number") {
    if (t.audit.topHoldersPercentage > q.maxTop10) return false;
  }

  if (q.maxAgeDays > 0 && t.firstPool?.createdAt) {
    const created = new Date(t.firstPool.createdAt).getTime();
    const ageDays = (Date.now() - created) / 86_400_000;
    if (ageDays > q.maxAgeDays) return false;
  }

  return true;
}

async function fetchTracked(tickers: string[]): Promise<JupTokenInfo[]> {
  const out: JupTokenInfo[] = [];
  for (const tk of tickers) {
    try {
      const res = await jupSearchToken(tk);
      const matched = res.filter(
        (t) => (t.symbol ?? "").toLowerCase() === tk.toLowerCase()
      );
      out.push(...matched);
    } catch {
      /* skip */
    }
  }
  const map = new Map<string, JupTokenInfo>();
  for (const t of out) if (!map.has(t.id)) map.set(t.id, t);
  return enrichTokensWithMarketIntel(Array.from(map.values()), { includeAth: true, maxAth: 12 });
}

// Free-form keyword scan: any symbol / name / address match.
async function fetchAny(query: string): Promise<JupTokenInfo[]> {
  if (!query.trim()) return [];
  try {
    const res = await jupSearchToken(query.trim());
    return enrichTokensWithMarketIntel(res, { includeAth: true, maxAth: 12 });
  } catch {
    return [];
  }
}

async function fetchDexFreshTokens(): Promise<DexFreshToken[]> {
  const endpoints = [
    "https://api.dexscreener.com/token-profiles/latest/v1",
    "https://api.dexscreener.com/token-boosts/latest/v1",
  ];
  const results = await Promise.allSettled(
    endpoints.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) return [];
      return (await res.json()) as Array<DexTokenProfile | DexBoost>;
    })
  );
  const tokens = new Map<string, DexFreshToken>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      if (item.chainId !== "solana" || !item.tokenAddress) continue;
      const previous = tokens.get(item.tokenAddress);
      tokens.set(item.tokenAddress, {
        mint: item.tokenAddress,
        icon: previous?.icon ?? item.icon,
        description: previous?.description ?? item.description,
        sourceUrl: previous?.sourceUrl ?? item.url,
      });
    }
  }
  return Array.from(tokens.values());
}

async function fetchDexPairsForMints(mints: string[]): Promise<DexPair[]> {
  const chunks: string[][] = [];
  for (let index = 0; index < mints.length; index += 30) chunks.push(mints.slice(index, index + 30));

  const results = await Promise.allSettled(
    chunks.map(async (chunk) => {
      const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${chunk.join(",")}`);
      if (!res.ok) return [];
      return (await res.json()) as DexPair[];
    })
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

function dexPairToToken(pair: DexPair, fresh?: DexFreshToken): JupTokenInfo | null {
  const mint = pair.baseToken?.address ?? fresh?.mint;
  if (!mint) return null;
  const price = pair.priceUsd ? Number(pair.priceUsd) : undefined;
  const h24 = pair.txns?.h24;
  const buyVolume = pair.volume?.h24 ? pair.volume.h24 * ((h24?.buys ?? 1) / Math.max(1, (h24?.buys ?? 0) + (h24?.sells ?? 0))) : undefined;
  const sellVolume = pair.volume?.h24 != null && buyVolume != null ? Math.max(0, pair.volume.h24 - buyVolume) : undefined;

  return {
    id: mint,
    name: pair.baseToken?.name ?? fresh?.description ?? "Fresh Solana token",
    symbol: pair.baseToken?.symbol ?? "NEW",
    icon: pair.info?.imageUrl ?? fresh?.icon,
    decimals: 0,
    usdPrice: Number.isFinite(price) ? price : undefined,
    liquidity: pair.liquidity?.usd,
    mcap: pair.marketCap,
    fdv: pair.fdv,
    stats24h: {
      priceChange: pair.priceChange?.h24 ?? pair.priceChange?.h1 ?? pair.priceChange?.m5,
      buyVolume,
      sellVolume,
      numBuys: h24?.buys,
      numSells: h24?.sells,
      numTraders: (h24?.buys ?? 0) + (h24?.sells ?? 0),
    },
    stats1h: { priceChange: pair.priceChange?.h1 },
    stats5m: { priceChange: pair.priceChange?.m5 },
    firstPool: { createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : new Date().toISOString() },
    migrationCreatedAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : undefined,
    dexBoostActive: undefined,
    dexUrl: pair.url,
    pairAddress: pair.pairAddress,
    pairDexId: pair.dexId,
  };
}

function mergeTokenData(primary: JupTokenInfo, fallback: JupTokenInfo): JupTokenInfo {
  return {
    ...fallback,
    ...primary,
    icon: primary.icon ?? fallback.icon,
    usdPrice: primary.usdPrice ?? fallback.usdPrice,
    liquidity: primary.liquidity ?? fallback.liquidity,
    mcap: primary.mcap ?? fallback.mcap,
    fdv: primary.fdv ?? fallback.fdv,
    stats24h: primary.stats24h ?? fallback.stats24h,
    stats1h: primary.stats1h ?? fallback.stats1h,
    stats5m: primary.stats5m ?? fallback.stats5m,
    firstPool: primary.firstPool?.createdAt ? primary.firstPool : fallback.firstPool,
    allTimeHighUsd: primary.allTimeHighUsd ?? fallback.allTimeHighUsd,
    allTimeHighAt: primary.allTimeHighAt ?? fallback.allTimeHighAt,
    migrationCreatedAt: primary.migrationCreatedAt ?? fallback.migrationCreatedAt,
    dexPaidAmount: primary.dexPaidAmount ?? fallback.dexPaidAmount,
    dexBoostAmount: primary.dexBoostAmount ?? fallback.dexBoostAmount,
    dexBoostTotalAmount: primary.dexBoostTotalAmount ?? fallback.dexBoostTotalAmount,
    dexBoostActive: primary.dexBoostActive ?? fallback.dexBoostActive,
    dexUrl: primary.dexUrl ?? fallback.dexUrl,
    pairAddress: primary.pairAddress ?? fallback.pairAddress,
    pairDexId: primary.pairDexId ?? fallback.pairDexId,
  };
}

async function fetchJupiterDiscovery(): Promise<JupTokenInfo[]> {
  const map = new Map<string, JupTokenInfo>();
  const sources = await Promise.allSettled([
    jupTrending("5m", 50),
    jupTrending("1h", 50),
    jupTrending("24h", 50),
    jupTopOrganic("1h", 50),
    jupTopOrganic("24h", 50),
  ]);
  for (const s of sources) {
    if (s.status !== "fulfilled") continue;
    for (const t of s.value) if (!map.has(t.id)) map.set(t.id, t);
  }
  return Array.from(map.values());
}

// Discover mode: DexScreener latest Solana profiles/boosts first, Jupiter discovery as fallback.
async function fetchAllFresh(): Promise<JupTokenInfo[]> {
  const map = new Map<string, JupTokenInfo>();
  const [dexFresh, jupiterTokens] = await Promise.all([fetchDexFreshTokens(), fetchJupiterDiscovery()]);
  const dexFreshByMint = new Map(dexFresh.map((token) => [token.mint, token]));
  const dexMints = dexFresh.map((token) => token.mint);

  const [dexTokens, dexPairs] = await Promise.all([
    dexMints.length > 0 ? jupGetTokens(dexMints.slice(0, 30)) : Promise.resolve([]),
    dexMints.length > 0 ? fetchDexPairsForMints(dexMints.slice(0, 60)) : Promise.resolve([]),
  ]);

  for (const pair of dexPairs) {
    const fallback = dexPairToToken(pair, dexFreshByMint.get(pair.baseToken?.address ?? ""));
    if (fallback && !map.has(fallback.id)) map.set(fallback.id, fallback);
  }

  for (const t of dexTokens) {
    const fallback = map.get(t.id);
    map.set(t.id, fallback ? mergeTokenData(t, fallback) : t);
  }

  // If neither Jupiter nor DexScreener pair enrichment is ready yet, still show the fresh token instead of an empty tool.
  for (const token of dexFresh) {
    if (!map.has(token.mint)) {
      map.set(token.mint, {
        id: token.mint,
        name: token.description ?? "Fresh Solana token",
        symbol: "NEW",
        icon: token.icon,
        decimals: 0,
        firstPool: { createdAt: new Date().toISOString() },
      });
    }
  }

  for (const t of jupiterTokens) if (!map.has(t.id)) map.set(t.id, t);
  return enrichTokensWithMarketIntel(Array.from(map.values()), { includeAth: true, maxAth: 12 });
}

export const PairTracker = ({ onSelect }: Props) => {
  const [tickers, setTickers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TICKERS);
      if (saved) {
        const arr = JSON.parse(saved) as string[];
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch {
      /* noop */
    }
    return ["OG"];
  });
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MODE);
      if (saved === "tickers" || saved === "any" || saved === "all") return saved;
    } catch {
      /* noop */
    }
    return "all";
  });
  const [anyQuery, setAnyQuery] = useState("");
  const [anySubmitted, setAnySubmitted] = useState("");
  const [quality, setQuality] = useState<Quality>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FILTER);
      if (saved) return { ...DEFAULT_QUALITY, ...(JSON.parse(saved) as Partial<Quality>) };
    } catch {
      /* noop */
    }
    return DEFAULT_QUALITY;
  });
  const [showFilters, setShowFilters] = useState(true);
  const [paused, setPaused] = useState(false);
  const [alerts, setAlerts] = useState(true);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SEEN);
      if (saved) {
        const arr = JSON.parse(saved) as string[];
        if (Array.isArray(arr)) seenRef.current = new Set(arr);
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TICKERS, JSON.stringify(tickers));
    } catch {
      /* noop */
    }
  }, [tickers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FILTER, JSON.stringify(quality));
    } catch {
      /* noop */
    }
  }, [quality]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MODE, mode);
    } catch {
      /* noop */
    }
  }, [mode]);

  const queryKey =
    mode === "tickers"
      ? ["pair-tracker", "tickers", tickers.join(",")]
      : mode === "any"
        ? ["pair-tracker", "any", anySubmitted]
        : ["pair-tracker", "all"];

  const enabled =
    mode === "tickers"
      ? tickers.length > 0
      : mode === "any"
        ? anySubmitted.length >= 1
        : true;

  const { data, isFetching, dataUpdatedAt } = useQuery({
    queryKey,
    queryFn: () => {
      if (mode === "tickers") return fetchTracked(tickers);
      if (mode === "any") return fetchAny(anySubmitted);
      return fetchAllFresh();
    },
    enabled,
    refetchInterval: paused ? false : 20_000,
    staleTime: 10_000,
  });

  const all = data ?? [];
  const filtered = useMemo(() => {
    return all
      .filter((t) => passesQuality(t, quality))
      .sort((a, b) => {
        const da = a.firstPool?.createdAt ? new Date(a.firstPool.createdAt).getTime() : 0;
        const db = b.firstPool?.createdAt ? new Date(b.firstPool.createdAt).getTime() : 0;
        if (db !== da) return db - da;
        return (b.liquidity ?? 0) - (a.liquidity ?? 0);
      });
  }, [all, quality]);

  // Detect new pairs since last fetch
  useEffect(() => {
    if (!filtered.length) return;
    const seen = seenRef.current;
    const fresh: string[] = [];
    for (const t of filtered) {
      if (!seen.has(t.id)) {
        if (seen.size > 0) fresh.push(t.id); // only flash on subsequent loads
        seen.add(t.id);
      }
    }
    if (fresh.length) {
      setFlashIds((prev) => {
        const next = new Set(prev);
        for (const id of fresh) next.add(id);
        return next;
      });
      if (alerts && typeof window !== "undefined") {
        // soft beep using WebAudio
        try {
          const Ctx = (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
          const ctx = new Ctx();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "square";
          o.frequency.value = 880;
          g.gain.value = 0.04;
          o.connect(g).connect(ctx.destination);
          o.start();
          setTimeout(() => {
            o.stop();
            ctx.close();
          }, 120);
        } catch {
          /* ignore */
        }
      }
      setTimeout(() => {
        setFlashIds((prev) => {
          const next = new Set(prev);
          for (const id of fresh) next.delete(id);
          return next;
        });
      }, 6000);
    }
    try {
      localStorage.setItem(STORAGE_SEEN, JSON.stringify(Array.from(seen).slice(-500)));
    } catch {
      /* noop */
    }
  }, [filtered, alerts]);

  const addTicker = (raw: string) => {
    const v = raw.trim().replace(/^\$/, "").toUpperCase();
    if (!v) return;
    if (tickers.includes(v)) return;
    setTickers([...tickers, v].slice(0, 12));
    setInput("");
  };

  const removeTicker = (t: string) => {
    setTickers(tickers.filter((x) => x !== t));
  };

  const totalRaw = all.length;
  const dropped = totalRaw - filtered.length;

  return (
    <section className="relative">
      <div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-og-cyan">
              <span className="h-px w-10 bg-og-cyan" /> /LIVE · PAIR · TRACKER
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              <span className="text-foreground">NEW PAIRS,</span>{" "}
              <span className="text-og-cyan text-glow">FILTERED CLEAN</span>
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Live fresh-pair radar now opens on ALL fresh Solana pairs by default, with tracked tickers and manual search still available.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
            <button
              onClick={() => setPaused((p) => !p)}
              className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 transition ${
                paused
                  ? "border-og-blood/60 text-og-blood"
                  : "border-og-lime/60 text-og-lime"
              }`}
            >
              {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {paused ? "PAUSED" : "LIVE"}
            </button>
            <button
              onClick={() => setAlerts((a) => !a)}
              className="inline-flex items-center gap-1.5 border border-og-grid px-2.5 py-1.5 text-foreground/70 transition hover:border-og-gold hover:text-og-gold"
            >
              {alerts ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
              {alerts ? "ALERTS" : "MUTED"}
            </button>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 transition ${
                showFilters
                  ? "border-og-gold text-og-gold"
                  : "border-og-grid text-foreground/70 hover:border-og-gold hover:text-og-gold"
              }`}
            >
              <Filter className="h-3 w-3" /> {showFilters ? "FILTERS ON" : "SHOW FILTERS"}
            </button>
          </div>
        </div>

        {/* Mode switch */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            mode:
          </span>
          {(
            [
              { id: "tickers", label: "TRACKED" },
              { id: "any", label: "SEARCH ANY" },
              { id: "all", label: "ALL FRESH" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
                mode === m.id
                  ? "border-og-cyan bg-og-cyan/10 text-og-cyan"
                  : "border-og-grid text-foreground/60 hover:border-og-cyan/60 hover:text-og-cyan"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Mode-specific input */}
        {mode === "tickers" && (
          <div className="flex flex-wrap items-center gap-2 border border-og-grid bg-og-ink/80 p-3">
            <Radar className={`h-4 w-4 ${isFetching ? "animate-pulse text-og-cyan" : "text-og-gold"}`} />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              tracking:
            </span>
            {tickers.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 border border-og-cyan/40 bg-og-cyan/5 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-og-cyan"
              >
                ${t}
                <button
                  onClick={() => removeTicker(t)}
                  className="text-og-cyan/60 transition hover:text-og-blood"
                  aria-label={`Stop tracking ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTicker(input);
              }}
              className="og-search-box og-search-box-sm ml-auto px-2"
            >
              <Plus className="h-3 w-3 text-og-gold" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="add ticker"
                className="og-search-input og-search-input-sm w-32 font-mono text-[11px] uppercase tracking-widest"
              />
            </form>
          </div>
        )}

        {mode === "any" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAnySubmitted(anyQuery.trim());
            }}
            className="og-search-box px-3"
          >
            <Radar className={`h-4 w-4 ${isFetching ? "animate-pulse text-og-cyan" : "text-og-gold"}`} />
            <input
              value={anyQuery}
              onChange={(e) => setAnyQuery(e.target.value)}
              placeholder="search any token · symbol, name, or mint address"
              className="og-search-input px-1 font-mono text-sm tracking-wide"
            />
            <button
              type="submit"
              className="og-search-action px-4 font-mono text-[10px] uppercase tracking-widest text-og-cyan transition"
            >
              SCAN
            </button>
          </form>
        )}

        {mode === "all" && (
          <div className="flex flex-wrap items-center gap-2 border border-og-cyan/35 bg-og-cyan/10 p-3">
            <Radar className={`h-4 w-4 ${isFetching ? "animate-pulse text-og-cyan" : "text-og-cyan"}`} />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/70">
              live feed: DexScreener newest Solana listings + pair data + Jupiter enrichment
            </span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-og-lime">
              {isFetching ? "sweeping..." : "auto-refresh 20s"}
            </span>
          </div>
        )}

        {/* Filters drawer */}
        {showFilters && (
          <div className="mt-3 border border-og-gold/30 bg-og-gold/5 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-og-gold">
                active filters
              </span>
              <PresetButton label="OPEN" active={qualityEquals(quality, DEFAULT_QUALITY)} onClick={() => setQuality(DEFAULT_QUALITY)} />
              <PresetButton label="GOOD" active={qualityEquals(quality, GOOD_QUALITY)} onClick={() => setQuality(GOOD_QUALITY)} />
              <PresetButton label="STRICT" active={qualityEquals(quality, STRICT_QUALITY)} onClick={() => setQuality(STRICT_QUALITY)} />
              <button
                onClick={() => setQuality(DEFAULT_QUALITY)}
                className="ml-auto border border-og-grid px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-foreground/60 transition hover:border-og-lime hover:text-og-lime"
              >
                RESET
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <FilterNum
                label="MIN LIQ ($)"
                value={quality.minLiq}
                onChange={(v) => setQuality({ ...quality, minLiq: v })}
                step={1000}
              />
              <FilterNum
                label="MIN HOLDERS"
                value={quality.minHolders}
                onChange={(v) => setQuality({ ...quality, minHolders: v })}
                step={10}
              />
              <FilterNum
                label="MAX TOP10 %"
                value={quality.maxTop10}
                onChange={(v) => setQuality({ ...quality, maxTop10: v })}
                step={5}
              />
              <FilterNum
                label="MAX AGE (D)"
                value={quality.maxAgeDays}
                onChange={(v) => setQuality({ ...quality, maxAgeDays: v })}
                step={1}
              />
              <FilterToggle
                label="MINT+FREEZE OFF"
                value={quality.requireAudit}
                onChange={(v) => setQuality({ ...quality, requireAudit: v })}
              />
              <FilterToggle
                label="VERIFIED ONLY"
                value={quality.requireVerified}
                onChange={(v) => setQuality({ ...quality, requireVerified: v })}
              />
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>
            <span className="text-og-lime">{filtered.length}</span> good ·{" "}
            <span className="text-og-blood">{dropped}</span> filtered ·{" "}
            <span className="text-foreground">{totalRaw}</span> total
          </span>
          <span>
            {dataUpdatedAt
              ? `last sweep ${timeAgo(Math.floor(dataUpdatedAt / 1000))} ago`
              : "—"}
          </span>
        </div>

        {/* Pair list */}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 && !isFetching && (
            <div className="md:col-span-2 xl:col-span-3 border border-dashed border-og-grid p-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
              NO PAIRS PASS THE BAR · TAP OPEN OR RESET FILTERS
            </div>
          )}
          {filtered.map((t) => (
            <PairCard
              key={t.id}
              t={t}
              flash={flashIds.has(t.id)}
              onSelect={() => onSelect(t.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const PresetButton = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
      active
        ? "border-og-lime bg-og-lime/10 text-og-lime"
        : "border-og-grid text-foreground/60 hover:border-og-gold hover:text-og-gold"
    }`}
  >
    {label}
  </button>
);

const FilterNum = ({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
}) => (
  <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-widest text-og-gold/80">
    {label}
    <input
      type="number"
      value={value}
      step={step}
      min={0}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="og-filter-input px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-og-gold"
    />
  </label>
);

const FilterToggle = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    onClick={() => onChange(!value)}
    className={`flex flex-col items-start justify-center gap-1 border px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
      value
        ? "border-og-lime text-og-lime"
        : "border-og-grid text-foreground/60 hover:border-og-gold hover:text-og-gold"
    }`}
  >
    {label}
    <span className="text-[9px]">{value ? "ON" : "OFF"}</span>
  </button>
);

const PairCard = ({
  t,
  flash,
  onSelect,
}: {
  t: JupTokenInfo;
  flash: boolean;
  onSelect: () => void;
}) => {
  const created = t.firstPool?.createdAt ? new Date(t.firstPool.createdAt) : null;
  const ageMs = created ? Date.now() - created.getTime() : 0;
  const ageDays = ageMs / 86_400_000;
  const ageHours = ageMs / 3_600_000;
  const isFresh = ageHours < 24;
  const ch = t.stats24h?.priceChange ?? 0;
  const up = ch >= 0;
  const ageLabel =
    ageHours < 1
      ? `${Math.max(1, Math.floor(ageMs / 60_000))}m`
      : ageHours < 24
        ? `${Math.floor(ageHours)}h`
        : `${Math.floor(ageDays)}d`;
  const dexPaid = tokenDexPaidLabel(t);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
      className={`group relative flex cursor-pointer flex-col gap-3 border bg-og-ink/70 p-4 text-left transition ${
        flash
          ? "border-og-cyan animate-pulse shadow-[0_0_24px_rgba(0,229,255,0.35)]"
          : isFresh
            ? "border-og-lime/60 hover:border-og-lime"
            : "border-og-grid hover:border-og-gold"
      }`}
    >
      {flash && (
        <span className="absolute -top-2 left-3 inline-flex items-center gap-1 bg-og-cyan px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-og-ink">
          <Sparkles className="h-3 w-3" /> JUST DETECTED
        </span>
      )}
      {!flash && isFresh && (
        <span className="absolute -top-2 left-3 bg-og-lime px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-og-ink">
          NEW · &lt;24H
        </span>
      )}

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden border border-og-grid bg-og-ink">
          {t.icon ? (
            <img src={t.icon} alt={t.symbol} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-og-lime">
              {t.symbol?.[0]}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-sm font-bold text-foreground">${t.symbol}</span>
            {t.isVerified && <ShieldCheck className="h-3 w-3 text-og-lime" />}
          </div>
          <div className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">
            {t.name}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs text-foreground">{fmtUsd(t.usdPrice)}</div>
          <div className={`font-mono text-[10px] ${up ? "text-og-lime" : "text-og-blood"}`}>
            {fmtPct(ch)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Stat icon={Droplets} label="LIQ" value={fmtUsd(t.liquidity)} />
        <Stat icon={Flame} label="ATH" value={fmtUsd(t.allTimeHighUsd)} accent="text-og-gold" />
        <Stat
          icon={Calendar}
          label="MIGR"
          value={shortDate(tokenMigrationDateIso(t))}
          accent={isFresh ? "text-og-lime" : "text-og-cyan"}
        />
        <Stat icon={BadgeDollarSign} label="DEX" value={dexPaid} accent={dexPaid === "—" ? undefined : "text-og-lime"} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-og-grid/60 pt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>CA {shortAddr(t.id, 5)} · age {ageLabel} · hldr {fmtNum(t.holderCount)}</span>
        <span className="inline-flex items-center gap-2">
          <CopyMintButton mint={t.id} label="copy" copiedLabel="copied" className="px-2 py-1" iconClassName="h-3 w-3" />
          <span className="text-og-gold">OPEN →</span>
        </span>
      </div>
    </article>
  );
};

const Stat = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) => (
  <div>
    <div className="flex items-center gap-1 text-foreground/40">
      <Icon className="h-2.5 w-2.5" /> {label}
    </div>
    <div className={accent ?? "text-foreground"}>{value}</div>
  </div>
);
