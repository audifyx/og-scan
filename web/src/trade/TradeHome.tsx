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

function RecentsList({ coins, onCoin, onClearRecents }: { coins: MarketCoin[]; onCoin: (mint: string) => void; onClearRecents: () => void }) {
  if (!coins.length) return null;
  
  return (
    <div className="th__recents">
      <div className="th__recents-header">
        <h3 className="th__recents-title">Recents</h3>
        <button type="button" onClick={onClearRecents} className="th__recents-clear">
          Clear all
        </button>
      </div>
      <div className="th__recents-list">
        {coins.map((c) => (
          <button
            key={c.mint}
            type="button"
            className="th__recent-item"
            onClick={() => onCoin(c.mint)}
          >
            <div className="th__recent-left">
              <CoinLogo coin={c} />
              <div className="th__recent-info">
                <p className="th__recent-sym">{c.symbol}</p>
                <p className="th__recent-mcap">{fmtUsd(c.mcap)}</p>
              </div>
            </div>
            <div className="th__recent-right">
              <p className="th__recent-price">{fmtUsd(c.price)}</p>
              <span className={`th__recent-pct ${pctClass(c.change24h)}`}>
                {fmtPct(c.change24h)}
              </span>
            </div>
            <button
              type="button"
              className="th__recent-remove"
              onClick={(e) => {
                e.stopPropagation();
                // Remove from recents
              }}
              aria-label="Remove from recents"
            >
              ✕
            </button>
          </button>
        ))}
      </div>
    </div>
  );
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
  const [recents, setRecents] = useState<MarketCoin[]>([]);

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

  const openCoin = (mint: string) => {
    try {
      sessionStorage.setItem(LAST_MINT_KEY, mint);
      // Add to recents
      const coin = list.find(c => c.mint === mint);
      if (coin) {
        setRecents(prev => [coin, ...prev.filter(c => c.mint !== mint)].slice(0, 10));
      }
    } catch {
      /* ignore */
    }
    navigate(`/trade/token/${mint}`);
  };

  const clearRecents = () => {
    setRecents([]);
  };

  return (
    <div className="th">
      <div className="th__glow" />
      <div className="th__noise" aria-hidden />

      <div className="th__top">
        {/* Recents section at top */}
        {recents.length > 0 && !searchingMode && (
          <RecentsList coins={recents.slice(0, 3)} onCoin={openCoin} onClearRecents={clearRecents} />
        )}

        <div className="th__brand-row">
          <div>
            <p className="th__kicker">OrbitX Trade</p>
            <h1 className="th__title">Markets</h1>
            <p className="th__subtitle">
              {loading || searching
                ? "Syncing…"
                : searchingMode
                  ? `${list.length} results`
                  : `${list.length} coins`}
            </p>
          </div>
          <div className="th__live" aria-live="polite">
            <span className="th__live-dot" />
            Live
          </div>
        </div>

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
            {list.map((c) => (
              <button key={c.mint} type="button" className="th__card" onClick={() => openCoin(c.mint)}>
                <CoinLogo coin={c} />
                <div className="th__main">
                  <div className="th__row1">
                    <span className="th__sym">{c.symbol}</span>
                    <span className="th__name">{c.name}</span>
                  </div>
                  <div className="th__row2">
                    <span className="th__price">{fmtUsd(c.price)}</span>
                    <span className="th__chip">Vol {fmtUsd(c.volume24h)}</span>
                    {c.liquidity > 0 && <span className="th__chip">Liq {fmtUsd(c.liquidity)}</span>}
                    {c.holders != null && c.holders > 0 && (
                      <span className="th__chip">H {fmtNum(c.holders)}</span>
                    )}
                  </div>
                  {c.supply > 0 && (
                    <div className="th__row3">
                      <span className="th__supply">Supply {fmtNum(c.supply)}</span>
                    </div>
                  )}
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
        </footer>
      </div>
    </div>
  );
}
