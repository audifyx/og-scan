import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getScreener, getTrendingSocial, search, getListings, Row, Listing, SocialItem, fmtUsd, compact, short } from "../lib/api";
import TokenLogo from "../components/TokenLogo";
import Change from "../components/Change";
import Verified from "../components/Verified";
import FeaturedBanner from "../components/FeaturedBanner";
import HeroBanner from "../components/HeroBanner";
import {
  Flame, Sprout, Sparkles, ArrowUpDown, Loader2, Droplets, TrendingUp, Crown,
  Star, Rocket, BadgeCheck, Moon, Zap, Unlink, Globe, ChevronRight, Activity,
  CheckCircle2, Grid3x3, Users
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Category = "discover" | "pumpfun" | "curated" | "multichain" | "social";
type Tab =
  | "trending" | "runners" | "new" | "fomo" | "jupiter" // Discover
  | "unbonded" | "migrated" | "moonshot" | "newpairs"  // Pump.fun
  | "og" | "kols" | "celebrity" | "organic" | "listed" // Curated
  | "multichain"                                      // Multi-chain
  | "social";                                         // Trending Social

interface TabDef {
  id: Tab;
  label: string;
  icon: any;
  noInterval?: boolean;
  desc?: string;
}

// ── Category & Tab Config ────────────────────────────────────────────────────

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

const INTERVALS = ["5m","1h","6h","24h"];

const CHAINS = [
  { id: "ethereum", label: "Ethereum",  color: "text-blue-400",   dot: "#60a5fa" },
  { id: "bsc",      label: "BNB Chain", color: "text-yellow-400", dot: "#facc15" },
  { id: "base",     label: "Base",      color: "text-blue-500",   dot: "#3b82f6" },
  { id: "polygon",  label: "Polygon",   color: "text-purple-400", dot: "#c084fc" },
  { id: "arbitrum", label: "Arbitrum",  color: "text-cyan-400",   dot: "#22d3ee" },
  { id: "avalanche",label: "Avax",      color: "text-red-400",    dot: "#f87171" },
  { id: "sui",      label: "SUI",       color: "text-sky-400",    dot: "#38bdf8" },
  { id: "ton",      label: "TON",       color: "text-blue-300",   dot: "#93c5fd" },
];

type SortKey = "mcap"|"liquidity"|"volume"|"change"|"holderCount"|"organicScore";

// ── Component ────────────────────────────────────────────────────────────────

export default function Screener() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";

  const [category, setCategory] = useState<Category>("discover");
  const [tab, setTab]           = useState<Tab>("trending");
  const [interval, setInterval] = useState("24h");
  const [chain, setChain]       = useState("ethereum");
  const [rows, setRows]         = useState<Row[]>([]);
  const [socialItems, setSocialItems] = useState<SocialItem[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading]   = useState(true);
  const [sort, setSort]         = useState<SortKey>("volume");
  const [desc, setDesc]         = useState(true);
  const nav = useNavigate();

  const subTabs = TABS_BY_CAT[category];
  const cur = subTabs.find((t) => t.id === tab) || subTabs[0];
  const isMultichain = category === "multichain";
  const isSocial    = category === "social";
  const isUnbonded  = tab === "unbonded" || tab === "newpairs";

  // Switch category → switch to that category's default sub-tab
  const switchCategory = (cat: Category) => {
    setCategory(cat);
    setTab(DEFAULT_TAB[cat]);
    setRows([]);
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setRows([]);
  };

  // Fetch — race-safe (request-id guard) with retry-on-empty/error so a single
  // transient upstream hiccup never leaves a category stuck empty until a manual
  // page refresh.
  const reqId = useRef(0);
  const MAX_RETRY = 3;
  useEffect(() => {
    const myId = ++reqId.current;
    const alive = () => reqId.current === myId;
    setLoading(true);
    const load = async () => {
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
    };
    load();
    const skip = q || tab === "listed" || cur?.noInterval || isMultichain || isSocial;
    const auto = skip ? null : window.setInterval(() => { if (alive()) load(); }, 25000);
    return () => { if (auto) clearInterval(auto); };
  }, [tab, interval, q, chain, category]);

  const changeKeyEff = (r: Row) => {
    if (cur?.noInterval) return r.change24h;
    return interval === "5m" ? r.change5m : interval === "1h" ? r.change1h : interval === "6h" ? r.change6h : r.change24h;
  };

  const sorted = useMemo(() => {
    if (tab === "runners" || tab === "unbonded" || tab === "pumping") return [...rows];
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = sort === "change" ? changeKeyEff(a) : (a as any)[sort];
      const vb = sort === "change" ? changeKeyEff(b) : (b as any)[sort];
      return ((vb ?? -Infinity) as number) - ((va ?? -Infinity) as number);
    });
    return desc ? arr : arr.reverse();
  }, [rows, sort, desc, interval, tab]);

  const setSortKey = (k: SortKey) => { if (k === sort) setDesc(!desc); else { setSort(k); setDesc(true); } };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {!q && <HeroBanner />}
      {!q && <FeaturedBanner />}

      {q && <h2 className="text-lg font-semibold mb-4">Results for "{q}"</h2>}

      {!q && (
        <div className="mb-4 space-y-2 mt-3">

          {/* ── Category row ── */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = cat.id === category;
              return (
                <button
                  key={cat.id}
                  onClick={() => switchCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 whitespace-nowrap
                    ${active
                      ? "text-white border-accent/60 shadow-glow-blue"
                      : "text-muted border-line hover:text-white hover:border-accent/30 bg-panel"}`}
                  style={active ? { background: "linear-gradient(135deg, rgba(47,128,255,0.22), rgba(153,69,255,0.16))" } : undefined}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-accent" : ""}`} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* ── Sub-tab row ── */}
          <div className="flex items-center gap-1 flex-wrap md:flex-nowrap">
            {subTabs.map((t) => {
              const Icon = t.icon;
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${active ? "text-white bg-accent/10" : "text-muted hover:text-white hover:bg-white/5"}`}
                  title={t.desc}
                >
                  <Icon className={`w-3 h-3 shrink-0 ${active ? "text-accent" : ""}`} />
                  {t.label}
                  {active && <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-accent" />}
                </button>
              );
            })}

            {/* Interval selector (when applicable) */}
            {!cur?.noInterval && !isMultichain && (
              <div className="flex gap-0.5 bg-panel border border-line rounded-lg p-0.5 ml-1">
                {INTERVALS.map((iv) => (
                  <button key={iv} onClick={() => setInterval(iv)}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all
                      ${interval === iv ? "bg-panel2 text-white" : "text-muted hover:text-white"}`}>
                    {iv}
                  </button>
                ))}
              </div>
            )}

            {/* Chain selector for multi-chain */}
            {isMultichain && (
              <div className="flex gap-1 flex-wrap ml-1">
                {CHAINS.map((c) => (
                  <button key={c.id} onClick={() => setChain(c.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all
                      ${chain === c.id
                        ? `border-accent/50 bg-accent/10 ${c.color}`
                        : "border-line text-muted hover:text-white hover:border-white/20"}`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} />
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* Count pill */}
            <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
              {loading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <span className="w-1.5 h-1.5 rounded-full bg-up animate-pulse inline-block" />}
              <span>
                {loading ? "loading…"
                  : tab === "listed" ? `${listings.length} listed`
                  : isMultichain ? `${rows.length} pools · ${CHAINS.find(c => c.id === chain)?.label}`
                  : `${rows.length} tokens`}
              </span>
            </div>
          </div>

          {/* Sub-tab description hint */}
          {cur?.desc && !loading && (
            <p className="text-[11px] text-muted/60">{cur.desc}</p>
          )}
        </div>
      )}

      {/* ── Social trending feed ── */}
      {isSocial && !q ? (
        <SocialFeed items={socialItems} loading={loading} />
      ) : tab === "listed" && !q ? (
        <ListedView listings={listings} loading={loading} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: isUnbonded ? 700 : 860 }}>
              <thead>
                <tr className="text-muted text-xs border-b border-line">
                  <th className="text-left font-medium px-4 py-3 w-8">#</th>
                  <th className="text-left font-medium px-2 py-3">Token</th>
                  {isUnbonded ? (
                    <>
                      <th className="text-left font-medium px-2 py-3">Market Cap</th>
                      <th className="text-left font-medium px-2 py-3 w-44">Bonding</th>
                      <th className="text-left font-medium px-2 py-3">Holders</th>
                    </>
                  ) : (
                    <>
                      <Th onClick={() => setSortKey("change")} active={sort === "change"}>
                        Price ({cur?.noInterval ? "24h" : interval})
                      </Th>
                      <Th onClick={() => setSortKey("mcap")} active={sort === "mcap"}>MCap</Th>
                      <Th onClick={() => setSortKey("liquidity")} active={sort === "liquidity"}>Liq</Th>
                      <Th onClick={() => setSortKey("volume")} active={sort === "volume"}>Vol</Th>
                      <Th onClick={() => setSortKey("holderCount")} active={sort === "holderCount"}>Holders</Th>
                      {!isMultichain && (
                        <Th onClick={() => setSortKey("organicScore")} active={sort === "organicScore"}>Organic</Th>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-line/50">
                    <td colSpan={isUnbonded ? 5 : (isMultichain ? 6 : 7)} className="px-4 py-3">
                      <div className="h-5 bg-panel2 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}
                {sorted.map((r: any, i) => {
                  const isExternal = r.chain && r.chain !== "solana";
                  return (
                    <tr
                      key={(r.mint || r.poolAddress || i) + i}
                      onClick={() => isExternal ? null : nav(`/token/${r.mint}`)}
                      className={`border-b border-line/50 transition-colors
                        ${isExternal ? "cursor-default" : "hover:bg-panel2/60 cursor-pointer"}`}
                    >
                      <td className="px-4 py-3 text-muted text-xs">{i + 1}</td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          <TokenLogo src={r.icon} sym={r.symbol} />
                          <div className="min-w-0">
                            <div className="font-semibold truncate max-w-[150px] flex items-center gap-1.5">
                              {r.symbol || short(r.mint)}
                              {r.isVerified && <Verified />}
                              {isMultichain && r.chain && (
                                <span className="pill bg-panel2 text-muted text-[9px] uppercase !px-1.5 !py-0">
                                  {r.chain.replace("_pos","").replace("-network","")}
                                </span>
                              )}
                            </div>
                            <div className="text-muted text-xs truncate max-w-[150px]">
                              {r.name !== r.symbol ? r.name : null || short(r.mint)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {isUnbonded ? (
                        <>
                          <td className="px-2 py-3">{r.mcap != null ? fmtUsd(r.mcap, { compact: true }) : "—"}</td>
                          <td className="px-2 py-3"><BondingBar pct={r.bondingPct} /></td>
                          <td className="px-2 py-3">{r.holderCount != null ? compact(r.holderCount) : "—"}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-3">
                            <div className="font-medium">{r.priceUsd != null ? fmtUsd(r.priceUsd) : "—"}</div>
                            <Change v={changeKeyEff(r)} className="text-xs" />
                          </td>
                          <td className="px-2 py-3">{r.mcap != null ? fmtUsd(r.mcap, { compact: true }) : "—"}</td>
                          <td className="px-2 py-3">
                            <span className="inline-flex items-center gap-1">
                              <Droplets className="w-3 h-3 text-muted" />
                              {r.liquidity != null ? "$" + compact(r.liquidity) : "—"}
                            </span>
                          </td>
                          <td className="px-2 py-3">{r.volume != null ? "$" + compact(r.volume) : "—"}</td>
                          <td className="px-2 py-3">{r.holderCount != null ? compact(r.holderCount) : "—"}</td>
                          {!isMultichain && (
                            <td className="px-2 py-3">
                              {r.organicScore != null
                                ? <span className={`pill ${organicCls(r.organicScore)}`}>{Math.round(r.organicScore)}</span>
                                : "—"}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
                {!loading && sorted.length === 0 && (
                  <tr>
                    <td colSpan={isUnbonded ? 5 : (isMultichain ? 6 : 7)} className="px-4 py-12 text-center text-muted">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-2xl opacity-30">🔍</span>
                        <span>No tokens found.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BondingBar({ pct }: { pct: number | null | undefined }) {
  const p = Math.min(100, Math.max(0, pct ?? 0));
  const cls = p >= 80 ? "bg-up" : p >= 50 ? "bg-accent" : p >= 25 ? "bg-yellow-500" : "bg-panel2";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-panel2 rounded-full overflow-hidden max-w-[90px]">
        <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs text-muted w-8 text-right tabular-nums">{p}%</span>
    </div>
  );
}

function ListedView({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  if (loading) return (
    <div className="grid place-items-center py-20 text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>
  );
  if (!listings.length) return (
    <div className="card p-10 text-center">
      <p className="text-muted mb-3">No community listings yet.</p>
      <Link to="/submit" className="btn bg-accent text-black font-semibold inline-flex">List your token →</Link>
    </div>
  );
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
      {listings.map((a) => {
        const inner = (
          <div className="card p-4 flex items-center gap-3 hover:border-accent/50 transition-colors h-full">
            {a.logo_url
              ? <img src={a.logo_url} className="w-12 h-12 rounded-full object-cover border border-line shrink-0" />
              : <div className="w-12 h-12 rounded-full bg-panel2 grid place-items-center text-xs text-muted shrink-0">
                  {(a.symbol || "?").slice(0, 3)}
                </div>}
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate flex items-center gap-1.5">
                {a.project_name || a.symbol || "Project"}
                <Verified />
                <span className="pill bg-panel2 text-muted text-[10px] uppercase">{a.chain}</span>
                {a.featured && <span className="pill bg-accent2/20 text-accent2 text-[10px]">AD</span>}
              </div>
              <div className="text-xs text-muted truncate">{a.description || short(a.contract_address)}</div>
              {a.metadata?.mcap && <div className="text-xs text-muted mt-0.5">MC {fmtUsd(a.metadata.mcap, { compact: true })}</div>}
            </div>
          </div>
        );
        return a.chain === "solana"
          ? <Link key={a.id} to={`/token/${a.contract_address}`}>{inner}</Link>
          : <a key={a.id} href={a.links?.website || `https://dexscreener.com/search?q=${a.contract_address}`}
              target="_blank" rel="noreferrer">{inner}</a>;
      })}
    </div>
  );
}

function Th({ children, onClick, active }: { children: any; onClick?: () => void; active?: boolean }) {
  return (
    <th className="text-left font-medium px-2 py-3 select-none">
      <button onClick={onClick} className={`inline-flex items-center gap-1 hover:text-white transition-colors ${active ? "text-white" : ""}`}>
        {children}<ArrowUpDown className="w-3 h-3 opacity-40" />
      </button>
    </th>
  );
}

function organicCls(s: number) {
  if (s >= 70) return "bg-up/15 text-up";
  if (s >= 40) return "bg-accent/15 text-accent";
  if (s >= 20) return "bg-yellow-500/15 text-yellow-400";
  return "bg-down/15 text-down";
}

// ── Social Trending Feed Component ──────────────────────────────────────────
function SocialFeed({ items, loading }: { items: SocialItem[]; loading: boolean }) {
  const nav = useNavigate();
  if (loading && !items.length) return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-panel2 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-panel2 rounded w-1/3" />
              <div className="h-3 bg-panel2 rounded w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
  if (!items.length) return (
    <div className="card p-12 text-center text-muted">No trending data available right now.</div>
  );
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const canNav = item.chain === "solana" && item.mint;
        return (
          <div
            key={(item.mint || item.symbol || i) + i}
            onClick={() => canNav ? nav(`/token/${item.mint}`) : null}
            className={`card p-4 transition-all border border-line hover:border-accent/30
              ${canNav ? "cursor-pointer hover:bg-panel2/50" : "cursor-default"}`}
          >
            <div className="flex items-start gap-3">
              {/* Token logo */}
              <TokenLogo src={item.icon} sym={item.symbol || "?"} size={44} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="font-bold text-sm">{item.symbol || short(item.mint || "?")}</span>
                  {item.name && item.name !== item.symbol && (
                    <span className="text-muted text-xs truncate max-w-[160px]">{item.name}</span>
                  )}
                  <span className={`pill text-[9px] uppercase ml-auto
                    ${item.source === "coingecko" ? "bg-green-500/15 text-green-400" :
                      item.source === "geckoterminal" ? "bg-accent/15 text-accent" :
                      "bg-panel2 text-muted"}`}>
                    {item.source === "coingecko" ? "CoinGecko"
                      : item.source === "geckoterminal" ? "GeckoTerminal"
                      : "DexScreener"}
                  </span>
                </div>

                {/* AI: why it's trending */}
                {item.aiSummary && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-accent/[0.06] border border-accent/15 px-2.5 py-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                    <p className="text-[12.5px] text-white/85 leading-snug">{item.aiSummary}</p>
                  </div>
                )}

                {/* Reason chips */}
                {item.reasons?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {item.reasons.slice(0, 3).map((r, j) => (
                      <span key={j} className="pill bg-panel2 text-muted text-[10px]">{r}</span>
                    ))}
                  </div>
                )}

                {/* Live stats */}
                {(item.priceUsd != null || item.mcap != null || item.change24h != null || item.liquidity != null) && (
                  <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
                    {item.priceUsd != null && <span>{fmtUsd(item.priceUsd)}</span>}
                    {item.mcap != null && <span>MC <span className="text-white/70">${compact(item.mcap)}</span></span>}
                    {item.volume != null && <span>Vol <span className="text-white/70">${compact(item.volume)}</span></span>}
                    {item.liquidity != null && <span>Liq <span className="text-white/70">${compact(item.liquidity)}</span></span>}
                    {item.change24h != null && <Change v={item.change24h} className="text-xs" />}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-center text-xs text-muted/50 pt-2">
        Data from GeckoTerminal · CoinGecko · DexScreener
      </p>
    </div>
  );
}
