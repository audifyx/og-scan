import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, X } from "lucide-react";
import { fetchScreener, searchCoins, type MarketCoin } from "./tradeApi";
import { fmtNum, fmtPct, fmtUsd } from "./tradeFmt";
import "./trade-home.css";

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

function pctClass(n: number) {
  if (n > 0) return "th__chg--up";
  if (n < 0) return "th__chg--down";
  return "th__chg--flat";
}

function CoinLogo({ coin, size = "card" }: { coin: MarketCoin; size?: "card" | "feat" }) {
  const cls = size === "feat" ? "th__feat-img" : "th__logo";
  const fallback = size === "feat" ? "th__feat-fallback" : "th__logo-fallback";
  if (coin.image) {
    return <img src={coin.image} alt="" className={cls} loading="lazy" />;
  }
  return <div className={fallback}>{(coin.symbol || "?").slice(0, 2)}</div>;
}

export default function TradeHome() {
  const navigate = useNavigate();
  const [cat, setCat] = useState<Cat>("discover");
  const [tab, setTab] = useState("trending");
  const [coins, setCoins] = useState<MarketCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MarketCoin[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setTab(TABS[cat][0].id);
  }, [cat]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchScreener(tab, 200).then((rows) => {
      if (!on) return;
      setCoins(rows);
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [tab]);

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
  const list = searchingMode ? results : coins;
  const subTabs = TABS[cat];
  const featured = !searchingMode ? coins.slice(0, 3) : [];

  const openCoin = (mint: string) => {
    try {
      sessionStorage.setItem(LAST_MINT_KEY, mint);
    } catch {
      /* ignore */
    }
    navigate(`/trade/token/${mint}`);
  };

  return (
    <div className="th">
      <div className="th__glow" />
      <div className="th__noise" aria-hidden />

      <div className="th__top">
        <div className="th__brand-row">
          <div>
            <p className="th__kicker">OrbitX Trade</p>
            <h1 className="th__title">Markets</h1>
            <p className="th__subtitle">
              {loading || searching
                ? "Syncing…"
                : searchingMode
                  ? `${list.length} results`
                  : `${list.length} coins in ${subTabs.find((t) => t.id === tab)?.label || "feed"}`}
            </p>
          </div>
          <div className="th__live" aria-live="polite">
            <span className="th__live-dot" />
            Live
          </div>
        </div>

        {featured.length > 0 && (
          <section className="th__spotlight" aria-label="Top in feed">
            {/* Mobile: single compact lead row */}
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
                <p className="th__spot-sym">{featured[0].symbol}</p>
                <p className="th__spot-meta">
                  {fmtUsd(featured[0].price)}
                  <span className="th__spot-dot">·</span>
                  MCap {fmtUsd(featured[0].mcap)}
                </p>
              </div>
            </button>

            {/* Desktop / tablet: equal professional tiles */}
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
                      <p className="th__spot-sym truncate">{c.symbol}</p>
                      <p className="th__spot-meta truncate">{c.name}</p>
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

        <div className="th__cols">
          <span>#</span>
          <span>Token</span>
          <span>Mcap</span>
          <span>24h</span>
        </div>
      </div>

      <div className="th__list">
        {loading && !list.length ? (
          <div className="th__loading">
            <Loader2 className="th__spin" />
            <p>Loading markets…</p>
          </div>
        ) : !list.length ? (
          <div className="th__empty">
            <p>{searchingMode ? "No matches for that search" : "No coins in this feed"}</p>
          </div>
        ) : (
          <div className="th__cards">
            {list.map((c, i) => (
              <button key={c.mint} type="button" className="th__card" onClick={() => openCoin(c.mint)}>
                <span className="th__rank">{i + 1}</span>
                <CoinLogo coin={c} />
                <div className="th__main">
                  <div className="th__row1">
                    <span className="th__sym">{c.symbol}</span>
                    <span className="th__name">{c.name}</span>
                  </div>
                  <div className="th__row2">
                    <span>{fmtUsd(c.price)}</span>
                    <span className="th__chip">Vol {fmtUsd(c.volume24h)}</span>
                    {c.liquidity > 0 && <span className="th__chip">Liq {fmtUsd(c.liquidity)}</span>}
                    {c.holders != null && c.holders > 0 && (
                      <span className="th__chip">H {fmtNum(c.holders)}</span>
                    )}
                  </div>
                </div>
                <div className="th__stats">
                  <p className="th__mcap">{fmtUsd(c.mcap)}</p>
                  <span className={`th__pct ${pctClass(c.change24h)}`}>{fmtPct(c.change24h)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <footer className="th__footer">
          <p className="th__footer-brand">OrbitX Trade</p>
          <p className="th__footer-copy">Live Solana markets · non-custodial desk</p>
          <p className="th__footer-meta">
            {searchingMode ? "Search" : subTabs.find((t) => t.id === tab)?.label || "Feed"} · updated live
          </p>
        </footer>
      </div>
    </div>
  );
}
