/**
 * OrbitX Markets — home screen.
 * Layout: featured top token · category tabs · filter chips · search · ranked token list.
 * Theme: black / white / blue / gold.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Flame,
  Globe,
  Loader2,
  RefreshCw,
  Rocket,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { fetchScreener, searchCoins, type MarketCoin } from "./tradeApi";
import { fmtNum, fmtPct, fmtUsd } from "./tradeFmt";
import TokenAvatar from "./TokenAvatar";
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

const CHIP_ICONS: Record<string, typeof TrendingUp> = {
  trending: TrendingUp,
  runners: Rocket,
  new: Globe,
  fomo: Flame,
  jupiter: Sparkles,
};

const LAST_MINT_KEY = "orbitx.trade.lastMint";

function chgClass(n: number) {
  if (n > 0) return "mk__chg--up";
  if (n < 0) return "mk__chg--down";
  return "mk__chg--flat";
}

/** Live 24h sparkline for the featured token (DexScreener-backed candles). */
function Sparkline({ mint }: { mint: string }) {
  const [pts, setPts] = useState<number[]>([]);
  useEffect(() => {
    let on = true;
    fetch(`/api/ogdex/chart?mint=${mint}&interval=1h&limit=24`)
      .then((r) => r.json())
      .then((d) => {
        if (!on) return;
        const vals = ((d?.candles || []) as any[])
          .map((k) => Number(k.close ?? k[4] ?? 0))
          .filter((v) => v > 0);
        if (vals.length > 1) setPts(vals);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [mint]);
  if (pts.length < 2) return <div className="mk-spark mk-spark--empty" aria-hidden />;
  const w = 240;
  const h = 72;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const rng = max - min || 1;
  const step = w / (pts.length - 1);
  const d = pts
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(h - 5 - ((v - min) / rng) * (h - 12)).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mk-spark" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={d}
        fill="none"
        stroke="#5aa2ff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeaturedCard({ coin, onOpen }: { coin: MarketCoin; onOpen: (mint: string) => void }) {
  const [desc, setDesc] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    fetch(`/api/ogdex/token?mint=${coin.mint}`)
      .then((r) => r.json())
      .then((d) => {
        if (!on) return;
        const t = d?.meta?.description || d?.token?.description || null;
        if (typeof t === "string" && t.trim()) setDesc(t.trim().slice(0, 140));
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [coin.mint]);
  const sym = coin.symbol?.trim() || coin.mint.slice(0, 4);
  const name = coin.name?.trim() || "Unknown token";
  return (
    <section className="mk-feat" aria-label="Featured top token">
      <p className="mk-feat__kicker">Featured top token</p>
      <div className="mk-feat__grid">
        <div className="mk-feat__left">
          <TokenAvatar image={coin.image} symbol={sym} mint={coin.mint} size={76} className="mk-feat__img" />
          <div className="min-w-0">
            <h2 className="mk-feat__sym">{sym}</h2>
            <p className="mk-feat__name">{name}</p>
            {desc && <p className="mk-feat__desc">{desc}</p>}
          </div>
        </div>
        <div className="mk-feat__right">
          <p className={`mk-feat__chg ${chgClass(coin.change24h)}`}>
            {coin.change24h > 0 ? "+" : ""}
            {coin.change24h.toFixed(2)}% <span>24h</span>
          </p>
          <Sparkline mint={coin.mint} />
        </div>
      </div>
      <div className="mk-feat__foot">
        <div>
          <p className="mk-feat__label">Price</p>
          <p className="mk-feat__price">{fmtUsd(coin.price)}</p>
        </div>
        <div>
          <p className="mk-feat__label">Market Cap</p>
          <p className="mk-feat__mcap">{fmtUsd(coin.mcap)}</p>
        </div>
        <button type="button" className="mk-feat__view" onClick={() => onOpen(coin.mint)}>
          View Token <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
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
      if (!rows.length) setLoadErr("No coins returned — feed may be unavailable");
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
  const list = searchingMode ? results : coins;
  const subTabs = TABS[cat];
  const featured = !searchingMode && !loading && coins.length > 0 ? coins[0] : null;

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
    <div className="mk">
      {featured && <FeaturedCard coin={featured} onOpen={openCoin} />}

      <div className="mk-cats" role="tablist" aria-label="Market categories">
        {CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            className={`mk-cat ${cat === c.id ? "mk-cat--on" : ""}`}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mk-chips" role="tablist" aria-label="Feed filters">
        {subTabs.map((t) => {
          const Icon = CHIP_ICONS[t.id];
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`mk-chip ${tab === t.id ? "mk-chip--on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />}
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mk-search">
        <Search className="mk-search__icon" strokeWidth={2} />
        <input
          className="mk-search__input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tokens, pairs or addresses..."
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {q ? (
          <button type="button" className="mk-search__clear" onClick={() => setQ("")} aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <SlidersHorizontal className="mk-search__filter" strokeWidth={2} />
        )}
      </div>

      <div className="mk-list">
        {loading && !list.length ? (
          <div className="mk-loading">
            <Loader2 className="mk-spin" />
            <p>Loading markets…</p>
          </div>
        ) : !list.length ? (
          <div className="mk-empty">
            <p className="mk-empty__title">{searchingMode ? "No matches" : "Feed empty"}</p>
            <p className="mk-empty__copy">
              {searchingMode ? "Try another ticker or paste a mint address" : loadErr || "No coins in this feed right now"}
            </p>
            {!searchingMode && (
              <button type="button" className="mk-retry" onClick={() => setReloadTick((n) => n + 1)}>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry feed
              </button>
            )}
          </div>
        ) : (
          list.map((c, i) => (
            <button key={c.mint} type="button" className="mk-row" onClick={() => openCoin(c.mint)}>
              <span className="mk-rank">{i + 1}</span>
              <TokenAvatar image={c.image} symbol={displaySym(c)} mint={c.mint} size={48} className="mk-row__img" />
              <span className="mk-row__main">
                <span className="mk-row__sym">{displaySym(c)}</span>
                <span className="mk-row__name">{displayName(c)}</span>
                <span className="mk-row__chain">
                  <i className="mk-dot" /> Solana
                </span>
              </span>
              <span className="mk-row__side">
                <span className="mk-row__price">{fmtUsd(c.price)}</span>
                <span className={`mk-row__chg ${chgClass(c.change24h)}`}>{fmtPct(c.change24h)}</span>
                <span className="mk-row__meta">
                  Vol: {fmtUsd(c.volume24h)} <b>|</b> Liq: {fmtUsd(c.liquidity)}{" "}
                  {c.holders != null && c.holders > 0 && (
                    <>
                      <b>|</b> Holders: {fmtNum(c.holders)}
                    </>
                  )}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
