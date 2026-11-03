import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
import { fetchScreener, searchCoins, type MarketCoin } from "./tradeApi";
import { fmtPct, fmtUsd } from "./tradeFmt";
import TokenAvatar from "./TokenAvatar";
import TerminalHeader from "./TerminalHeader";
import DexAdSlot from "./DexAdSlot";
import DexFilters from "./DexFilters";
import DexTrending from "./DexTrending";
import DexBoosts from "./DexBoosts";
import DexListings from "./DexListings";
import TokenCard from "./TokenCard";
import { scoreToken } from "./tokenScore";
import { applyDexFilters, DEFAULT_DEX_FILTERS, type DexFilterState } from "./dexFeed";
import "./trade-home.css";
import "./terminal-mobile.css";

type Cat = "discover" | "pump" | "curated";

const CATS: { id: Cat; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "pump", label: "Pump" },
  { id: "curated", label: "Curated" },
];

const TABS: Record<Cat, { id: string; label: string }[]> = {
  discover: [
    { id: "trending", label: "Trending" },
    { id: "runners", label: "Runners" },
    { id: "new", label: "New" },
    { id: "fomo", label: "FOMO" },
    { id: "jupiter", label: "Jupiter" },
  ],
  pump: [
    { id: "unbonded", label: "Bonding" },
    { id: "migrated", label: "Graduated" },
    { id: "moonshot", label: "Moonshot" },
    { id: "newpairs", label: "New pairs" },
  ],
  curated: [
    { id: "og", label: "OG" },
    { id: "kols", label: "KOLs" },
    { id: "celebrity", label: "Celebrity" },
    { id: "organic", label: "Organic" },
    { id: "listed", label: "Listed" },
  ],
};

const LAST_MINT_KEY = "orbitx.trade.lastMint";

function chgClass(n: number) {
  if (n > 0) return "th__chg--up";
  if (n < 0) return "th__chg--down";
  return "th__chg--flat";
}

function CoinLogo({ coin, size = "card" }: { coin: MarketCoin; size?: "card" | "feat" }) {
  const px = size === "feat" ? 44 : 36;
  return (
    <TokenAvatar
      image={coin.image}
      symbol={coin.symbol}
      mint={coin.mint}
      size={px}
      className={size === "feat" ? "th__feat-img" : "th__logo"}
      fallbackClassName={size === "feat" ? "th__feat-fallback" : "th__logo-fallback"}
    />
  );
}

export default function TradeHome() {
  const navigate = useNavigate();
  const [cat, setCat] = useState<Cat>("discover");
  const [tab, setTab] = useState("trending");
  const [coins, setCoins] = useState<MarketCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MarketCoin[]>([]);
  const [searching, setSearching] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [filters, setFilters] = useState<DexFilterState>(DEFAULT_DEX_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setTab(TABS[cat][0].id);
  }, [cat]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    setLoadErr("");
    fetchScreener(tab, 200).then((rows) => {
      if (!on) return;
      setCoins(rows);
      setLoading(false);
      if (!rows.length) {
        setLoadErr("No coins returned — feed may be unavailable");
      }
    });
    return () => {
      on = false;
    };
  }, [tab, reloadTick]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      searchCoins(q.trim()).then((rows) => {
        setResults(rows.slice(0, 48));
        setSearching(false);
      });
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const searchingMode = q.trim().length >= 2;
  const rawList = searchingMode ? results : coins;
  const list = applyDexFilters(rawList, filters);
  const subTabs = TABS[cat];
  const featured = !searchingMode && !loading ? coins.slice(0, 3) : [];
  // The "Trending" sub-tab renders DexTrending's computed ranking (same
  // ogdex feed, ranked by 24h volume + txns + price move) instead of the
  // plain feed list. The fetchScreener("trending") call above still runs —
  // it feeds the spotlight tiles.
  const isTrendingView = cat === "discover" && tab === "trending" && !searchingMode;

  // Honest score from the coin's own mapped fields (Jupiter audit +
  // liquidity/volume/txns). Unknown inputs earn 0 and are disclosed by
  // TokenCard as "partial data" — never invented.
  const scoreFor = (c: MarketCoin) =>
    scoreToken({
      liquidityUsd: c.liquidity,
      top10Pct: c.top10Pct,
      mintRevoked: c.mintRevoked,
      freezeRevoked: c.freezeRevoked,
      volume24hUsd: c.volume24h,
      txns24h: c.txns24h,
    });

  const openCoin = (mint: string) => {
    try {
      sessionStorage.setItem(LAST_MINT_KEY, mint);
    } catch {
      /* ignore */
    }
    navigate(`/trade/token/${mint}`);
  };

  const displaySym = (c: MarketCoin) => c.symbol?.trim() || c.mint.slice(0, 4);
  const displayName = (c: MarketCoin) => c.name?.trim() || "Unknown token";

  return (
    <div className="th orbitx-terminal">
      <div className="th__glow" />
      <div className="th__noise" aria-hidden />

      <div className="th__top">
        <TerminalHeader
          countLabel={
            loading || searching
              ? "Syncing…"
              : searchingMode
                ? `${list.length} results`
                : `${list.length} coins in ${subTabs.find((t) => t.id === tab)?.label || "feed"}`
          }
          live
          isLoading={loading || searching}
          stats={[{ label: "Feed", value: subTabs.find((t) => t.id === tab)?.label ?? "—" }]}
        />

        {featured.length > 0 && (
          <section className="th__spotlight" aria-label="Top in feed">
            <button
              type="button"
              className="th__spot-mobile"
              onClick={() => openCoin(featured[0].mint)}
            >
              <CoinLogo coin={featured[0]} size="feat" />
              <div className="th__spot-mobile-body">
                <div className="th__spot-mobile-top">
                  <span className="th__spot-tag">Lead</span>
                  <span className={`th__chg ${chgClass(featured[0].change24h)}`}>
                    {fmtPct(featured[0].change24h)}
                  </span>
                </div>
                <p className="th__spot-sym">{displaySym(featured[0])}</p>
                <p className="th__spot-meta">
                  {fmtUsd(featured[0].price)}
                  <span className="th__spot-dot">·</span>
                  MCap {fmtUsd(featured[0].mcap)}
                </p>
              </div>
            </button>

            <div className="th__spot-desk">
              {featured.map((c, i) => (
                <button
                  key={c.mint}
                  type="button"
                  className="th__spot-tile"
                  onClick={() => openCoin(c.mint)}
                >
                  <div className="th__spot-tile-head">
                    <span className="th__spot-tag">{i === 0 ? "Lead" : `Top ${i + 1}`}</span>
                    <span className={`th__chg ${chgClass(c.change24h)}`}>{fmtPct(c.change24h)}</span>
                  </div>
                  <div className="th__spot-tile-row">
                    <CoinLogo coin={c} size="feat" />
                    <div className="min-w-0">
                      <p className="th__spot-sym truncate">{displaySym(c)}</p>
                      <p className="th__spot-meta truncate">{displayName(c)}</p>
                    </div>
                  </div>
                  <div className="th__spot-tile-foot">
                    <span>{fmtUsd(c.price)}</span>
                    <span>MCap {fmtUsd(c.mcap)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="th__cats" role="tablist" aria-label="Market categories">
          {CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              className={`th__cat ${cat === c.id ? "th__cat--on" : ""}`}
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="th__subs" role="tablist" aria-label="Feed filters">
          {subTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`th__sub ${tab === t.id ? "th__sub--on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="th__search-wrap">
          <Search className="th__search-icon" strokeWidth={2} />
          <input
            className="th__search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ticker or paste mint"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {q ? (
            <button type="button" className="th__search-clear" onClick={() => setQ("")} aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Mobile filter sheet (terminal-mobile.css): slides up ≤767px,
            renders inline as a normal panel ≥768px. */}
        <button type="button" className="term-filter-open" onClick={() => setFiltersOpen(true)}>
          Filters
        </button>
        <div
          className="term-filter-backdrop"
          data-open={filtersOpen}
          onClick={() => setFiltersOpen(false)}
        />
        <section
          className="term-filter-sheet"
          data-open={filtersOpen}
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <div className="term-filter-sheet__grabber" />
          <DexFilters value={filters} onChange={setFilters} />
          <button
            type="button"
            className="term-filter-sheet__close"
            onClick={() => setFiltersOpen(false)}
          >
            Done
          </button>
        </section>
      </div>

      <div className="th__list">
        <DexAdSlot placement="home-top" className="th__ad-top" />
        {isTrendingView ? (
          <>
            <DexAdSlot placement="trending" className="th__ad-top" />
            <DexTrending
              coins={coins}
              loading={loading}
              error={loadErr || null}
              onSelect={(c) => openCoin(c.mint)}
            />
          </>
        ) : loading && !list.length ? (
          <div className="th__loading">
            <Loader2 className="th__spin" />
            <p>Loading markets…</p>
          </div>
        ) : !list.length ? (
          <div className="th__empty">
            <p className="th__empty-title">
              {searchingMode ? "No matches" : "Feed empty"}
            </p>
            <p className="th__empty-copy">
              {searchingMode
                ? "Try another ticker or paste a mint address"
                : loadErr || "No coins in this feed right now"}
            </p>
            {!searchingMode && (
              <button
                type="button"
                className="th__retry"
                onClick={() => setReloadTick((n) => n + 1)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry feed
              </button>
            )}
          </div>
        ) : (
          <div className="th__cards">
            {list.map((c, i) => (
              <Fragment key={c.mint}>
                <TokenCard coin={c} score={scoreFor(c)} onSelect={openCoin} />
                {i === 4 ? <DexAdSlot placement="home-feed" /> : null}
              </Fragment>
            ))}
          </div>
        )}

        <div className="th__sections">
          <DexBoosts onSelectMint={openCoin} />
          <DexListings onSelect={(c) => openCoin(c.mint)} />
        </div>

        <footer className="th__footer">
          <p className="th__footer-brand">OrbitX Terminal</p>
          <p className="th__footer-copy">Live Solana market data · data only</p>
          <p className="th__footer-meta">
            {searchingMode ? "Search" : subTabs.find((t) => t.id === tab)?.label || "Feed"} · updated live
          </p>
        </footer>
      </div>
    </div>
  );
}
