import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getScreener, getTrendingSocial, search, getListings, Row, Listing, SocialItem, fmtUsd, compact } from "../lib/api";
import FeaturedBanner from "../components/FeaturedBanner";
import HeroBanner from "../components/HeroBanner";
import { StatDeck, ViewToggle, LiveRefresh } from "../components/DexAdvanced";
import {
  TokenFeedGrid, SocialFeedPro, ListedFeedPro, FeedSkeleton, computeFeedStats, FeedLayout,
} from "../components/ScreenerFeed";
import {
  Flame, Sprout, Sparkles, Loader2, TrendingUp, Crown, Star, Rocket, BadgeCheck,
  Moon, Zap, Globe, Activity, Users, Search, LayoutGrid, ArrowUpDown,
} from "lucide-react";

type Category = "discover" | "pumpfun" | "curated" | "multichain" | "social";
type Tab =
  | "trending" | "runners" | "new" | "fomo" | "jupiter"
  | "unbonded" | "migrated" | "moonshot" | "newpairs"
  | "og" | "kols" | "celebrity" | "organic" | "listed"
  | "multichain" | "social";

interface TabDef { id: Tab; label: string; icon: any; noInterval?: boolean; desc?: string; }

const CATEGORIES: { id: Category; label: string; icon: any }[] = [
  { id: "discover",   label: "Discover",    icon: Flame },
  { id: "pumpfun",    label: "Pump.fun",    icon: Activity },
  { id: "curated",    label: "Curated",     icon: Crown },
  { id: "multichain", label: "Multi-chain", icon: Globe },
  { id: "social",     label: "Trending",    icon: TrendingUp },
];

const TABS_BY_CAT: Record<Category, TabDef[]> = {
  discover: [
    { id: "trending", label: "Trending",  icon: Flame,       desc: "Top traded right now" },
    { id: "runners",  label: "Runners",   icon: TrendingUp,  desc: "Biggest 24h gainers", noInterval: true },
    { id: "new",      label: "New",       icon: Sparkles,    desc: "Recently launched",   noInterval: true },
    { id: "fomo",     label: "FOMO",      icon: Zap,         desc: "Highest 1h spikes",   noInterval: true },
    { id: "jupiter",  label: "Jupiter ✓", icon: BadgeCheck,  desc: "Jupiter-verified tokens with real volume", noInterval: true },
  ],
  pumpfun: [
    { id: "unbonded",  label: "Unbonded",   icon: Activity,    desc: "Actively trading on bonding curve",  noInterval: true },
    { id: "migrated",  label: "Migrated",   icon: Rocket,      desc: "Graduated — sorted by volume",       noInterval: true },
    { id: "moonshot",  label: "Moonshot",   icon: Moon,        desc: "Moonshot-verified launches",          noInterval: true },
    { id: "newpairs",  label: "New Pairs",  icon: Sparkles,    desc: "Freshest coins on pump.fun",          noInterval: true },
  ],
  curated: [
    { id: "og",        label: "OG",         icon: Crown,       desc: "Established verified tokens",   noInterval: true },
    { id: "kols",      label: "KOL Picks",  icon: Users,       desc: "Most bought by tracked KOLs",   noInterval: true },
    { id: "celebrity", label: "Celebrity",  icon: Star,        desc: "Celebrity & influencer tokens", noInterval: true },
    { id: "organic",   label: "Organic",    icon: Sprout,      desc: "Real organic growth" },
    { id: "listed",    label: "Listed",     icon: BadgeCheck,  desc: "Community-listed tokens",       noInterval: true },
  ],
  multichain: [
    { id: "multichain", label: "Trending", icon: TrendingUp,  desc: "Trending pools sorted by volume", noInterval: true },
  ],
  social: [
    { id: "social", label: "Feed", icon: Flame, desc: "Trending tokens with why they're moving", noInterval: true },
  ],
};

const DEFAULT_TAB: Record<Category, Tab> = {
  discover: "trending", pumpfun: "unbonded", curated: "og", multichain: "multichain", social: "social",
};

const INTERVALS = ["5m", "1h", "6h", "24h"];

const CHAINS = [
  { id: "ethereum", label: "ETH",  color: "text-blue-400",   dot: "#60a5fa" },
  { id: "bsc",      label: "BNB",  color: "text-yellow-400", dot: "#facc15" },
  { id: "base",     label: "Base", color: "text-blue-500",   dot: "#3b82f6" },
  { id: "polygon",  label: "MATIC",color: "text-purple-400", dot: "#c084fc" },
  { id: "arbitrum", label: "ARB",  color: "text-cyan-400",   dot: "#22d3ee" },
  { id: "avalanche",label: "AVAX", color: "text-red-400",    dot: "#f87171" },
  { id: "sui",      label: "SUI",  color: "text-sky-400",    dot: "#38bdf8" },
  { id: "ton",      label: "TON",  color: "text-blue-300",   dot: "#93c5fd" },
  { id: "robinhood",label: "HOOD", color: "text-green-400",  dot: "#00C805" },
];

type SortKey = "mcap" | "liquidity" | "volume" | "change" | "holderCount" | "organicScore";

export default function Screener() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";

  const [category, setCategory] = useState<Category>("discover");
  const [tab, setTab] = useState<Tab>("trending");
  const [interval, setInterval] = useState("24h");
  const [chain, setChain] = useState("ethereum");
  const [rows, setRows] = useState<Row[]>([]);
  const [socialItems, setSocialItems] = useState<SocialItem[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("volume");
  const [desc, setDesc] = useState(true);
  const [layout, setLayout] = useState<FeedLayout>("grid");
  const nav = useNavigate();

  const subTabs = TABS_BY_CAT[category];
  const cur = subTabs.find((t) => t.id === tab) || subTabs[0];
  const isMultichain = category === "multichain";
  const isSocial = category === "social";
  const isUnbonded = tab === "unbonded" || tab === "newpairs";

  const switchCategory = (cat: Category) => { setCategory(cat); setTab(DEFAULT_TAB[cat]); setRows([]); };
  const switchTab = (t: Tab) => { setTab(t); setRows([]); };

  const reqId = useRef(0);
  const MAX_RETRY = 3;

  const load = useCallback(async () => {
    const myId = ++reqId.current;
    const alive = () => reqId.current === myId;
    setLoading(true);
    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
      const last = attempt === MAX_RETRY;
      try {
        if (q) {
          const d = await search(q);
          if (!alive()) return;
          const r = d.rows || [];
          if (r.length || last) { setRows(r); break; }
        } else if (tab === "listed") {
          const d = await getListings();
          if (!alive()) return;
          setListings(d.rows || []); break;
        } else if (category === "social" || tab === "social") {
          const d = await getTrendingSocial();
          if (!alive()) return;
          const items = d.items || [];
          if (items.length || last) { setSocialItems(items); break; }
        } else {
          const d = isMultichain ? await getScreener("trending", interval, 100, chain) : await getScreener(tab, interval, 100);
          if (!alive()) return;
          const r = d.rows || [];
          if (r.length || last) { setRows(r); break; }
        }
      } catch {
        if (!alive()) return;
        if (last) break;
      }
      await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
      if (!alive()) return;
    }
    if (alive()) setLoading(false);
  }, [tab, interval, q, chain, category, isMultichain]);

  useEffect(() => {
    load();
    const skip = q || tab === "listed" || cur?.noInterval || isMultichain || isSocial;
    const auto = skip ? null : window.setInterval(load, 25000);
    return () => { if (auto) clearInterval(auto); };
  }, [load, q, tab, cur?.noInterval, isMultichain, isSocial]);

  const changeKeyEff = (r: Row) => {
    if (cur?.noInterval) return r.change24h;
    return interval === "5m" ? r.change5m : interval === "1h" ? r.change1h : interval === "6h" ? r.change6h : r.change24h;
  };

  const sorted = useMemo(() => {
    if (tab === "runners" || tab === "unbonded") return [...rows];
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = sort === "change" ? changeKeyEff(a) : (a as any)[sort];
      const vb = sort === "change" ? changeKeyEff(b) : (b as any)[sort];
      return ((vb ?? -Infinity) as number) - ((va ?? -Infinity) as number);
    });
    return desc ? arr : arr.reverse();
  }, [rows, sort, desc, interval, tab, cur?.noInterval]);

  const feedStats = useMemo(() => computeFeedStats(rows), [rows]);

  const SORT_OPTS: { key: SortKey; label: string }[] = [
    { key: "volume", label: "Volume" },
    { key: "mcap", label: "MCap" },
    { key: "liquidity", label: "Liquidity" },
    { key: "change", label: "Change" },
    { key: "holderCount", label: "Holders" },
    { key: "organicScore", label: "Organic" },
  ];

  return (
    <div className="space-y-4">
      {!q && <HeroBanner />}
      {!q && <FeaturedBanner />}

      {q && (
        <div className="dex-panel flex flex-wrap items-center gap-3">
          <Search className="h-5 w-5 text-accent shrink-0" />
          <div>
            <div className="term-label !text-[var(--ox-gold-hi)]">Search results</div>
            <h2 className="font-display text-lg font-black text-white">"{q}"</h2>
          </div>
          <span className="ml-auto pill bg-panel2 text-muted text-xs">{rows.length} matches</span>
        </div>
      )}

      {!q && (
        <>
          {/* Category rail */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button key={cat.id} type="button" onClick={() => switchCategory(cat.id)}
                  className={`dex-cat-pill ${cat.id === category ? "dex-cat-pill--on" : ""}`}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />{cat.label}
                </button>
              );
            })}
          </div>

          {/* Control deck */}
          <div className="dex-panel space-y-3 !p-4">
            <div className="flex flex-wrap items-center gap-2">
              {subTabs.map((t) => {
                const Icon = t.icon;
                const active = t.id === tab;
                return (
                  <button key={t.id} type="button" onClick={() => switchTab(t.id)} title={t.desc}
                    className={`dex-feed-tab ${active ? "dex-feed-tab--on" : ""}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="dex-control-rail">
              {!cur?.noInterval && !isMultichain && (
                <div className="dex-tab-segment-wrap">
                  {INTERVALS.map((iv) => (
                    <button key={iv} type="button" onClick={() => setInterval(iv)}
                      className={`dex-tab-segment ${interval === iv ? "dex-tab-segment--on" : ""}`}>{iv}</button>
                  ))}
                </div>
              )}

              {isMultichain && (
                <div className="flex gap-1 flex-wrap">
                  {CHAINS.map((c) => (
                    <button key={c.id} type="button" onClick={() => { setRows([]); setChain(c.id); }}
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition
                        ${chain === c.id ? `border-accent/50 bg-accent/10 ${c.color}` : "border-line text-muted hover:text-white"}`}>
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.dot }} />{c.label}
                    </button>
                  ))}
                </div>
              )}

              {!isSocial && tab !== "listed" && (
                <div className="flex items-center gap-1.5 ml-auto">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted" />
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                    className="rounded-lg border border-line bg-panel2 px-2 py-1 text-[11px] font-bold text-white outline-none">
                    {SORT_OPTS.filter((o) => !isMultichain || o.key !== "organicScore").map((o) => (
                      <option key={o.key} value={o.key}>Sort: {o.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setDesc(!desc)} className="dex-tab-segment text-[11px]">{desc ? "↓ Desc" : "↑ Asc"}</button>
                </div>
              )}

              {!isSocial && tab !== "listed" && <ViewToggle mode={layout} onChange={setLayout} />}
              <LiveRefresh onClick={load} loading={loading} />
              <span className="dex-live-pill">
                {loading ? <Loader2 className="h-3 w-3 animate-spin text-[var(--ox-blue-hi)]" /> : <span className="h-1.5 w-1.5 rounded-full bg-up animate-pulse" />}
                {loading ? "syncing…" : tab === "listed" ? `${listings.length} listed` : isMultichain ? `${rows.length} · ${CHAINS.find((c) => c.id === chain)?.label}` : `${rows.length} tokens`}
              </span>
            </div>

            {cur?.desc && <p className="text-[11px] text-white/50 font-medium">{cur.desc}</p>}
          </div>

          {/* Market pulse for token feeds */}
          {!isSocial && tab !== "listed" && rows.length > 0 && !loading && (
            <StatDeck items={[
              { label: "FEED", value: feedStats.count, sub: cur?.label, tone: "blue" },
              { label: "24H VOL", value: fmtUsd(feedStats.vol, { compact: true }), sub: "aggregate", tone: "gold" },
              { label: "LIQUIDITY", value: fmtUsd(feedStats.liq, { compact: true }), sub: "pooled", tone: "plain" },
              { label: "GAINERS", value: `${feedStats.gainers}/${feedStats.count}`, sub: "positive 24h", tone: "up" },
              { label: "AVG 24H", value: `${feedStats.avgCh >= 0 ? "+" : ""}${feedStats.avgCh.toFixed(1)}%`, tone: feedStats.avgCh >= 0 ? "up" : "down" },
              { label: "HOLDERS", value: compact(feedStats.holders), sub: "combined", tone: "plain" },
            ]} />
          )}
        </>
      )}

      {/* Feeds */}
      {isSocial && !q ? (
        <SocialFeedPro items={socialItems} loading={loading} />
      ) : tab === "listed" && !q ? (
        <ListedFeedPro listings={listings} loading={loading} />
      ) : loading && sorted.length === 0 ? (
        <FeedSkeleton layout={layout} />
      ) : sorted.length === 0 ? (
        <div className="dex-panel py-16 text-center">
          <LayoutGrid className="h-10 w-10 text-muted/40 mx-auto mb-3" />
          <p className="text-muted font-semibold">No tokens found in this feed.</p>
          <p className="text-[11px] text-muted/60 mt-1">Try another tab, interval, or chain.</p>
        </div>
      ) : (
        <TokenFeedGrid
          rows={sorted}
          layout={layout}
          isUnbonded={isUnbonded}
          changeKey={changeKeyEff}
          isMultichain={isMultichain}
          onRowClick={(r) => nav(`/token/${r.mint}${isMultichain && r.chain ? `?chain=${r.chain}` : ""}`)}
        />
      )}

      {!q && !loading && (
        <p className="text-center text-[10px] text-muted/50 pb-2">
          Live data · Jupiter · GeckoTerminal · DexScreener · auto-refresh 25s on interval feeds
        </p>
      )}
    </div>
  );
}
