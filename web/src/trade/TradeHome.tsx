import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, X, Zap } from "lucide-react";
import { fetchScreener, searchCoins, type MarketCoin } from "./tradeApi";
import { fmtPct, fmtUsd } from "./tradeFmt";

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
    { id: "unbonded", label: "Unbonded" },
    { id: "migrated", label: "Migrated" },
    { id: "moonshot", label: "Moonshot" },
    { id: "newpairs", label: "New pairs" },
  ],
  curated: [
    { id: "og", label: "OG" },
    { id: "kols", label: "KOLs" },
    { id: "celebrity", label: "Celeb" },
    { id: "organic", label: "Organic" },
    { id: "listed", label: "Listed" },
  ],
};

const LAST_MINT_KEY = "orbitx.trade.lastMint";

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
        setResults(rows.slice(0, 24));
        setSearching(false);
      });
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const list = q.trim().length >= 2 ? results : coins;
  const subTabs = TABS[cat];

  const openCoin = (mint: string) => {
    try {
      sessionStorage.setItem(LAST_MINT_KEY, mint);
    } catch {
      /* ignore */
    }
    navigate(`/trade/token/${mint}`);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-black">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,255,255,0.08), transparent 70%)",
        }}
      />

      <div className="relative shrink-0 border-b border-white/10">
        <div className="flex items-end justify-between px-4 pb-3 pt-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">Markets</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Live coins</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
            <span className="font-mono text-[10px] text-white/55">
              {loading || searching ? "SYNC" : `${list.length}`}
            </span>
          </div>
        </div>

        {/* Centered category control */}
        <div className="px-4 pb-3">
          <div className="mx-auto flex max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`flex-1 rounded-xl py-2.5 text-center text-[13px] font-semibold transition-all ${
                  cat === c.id
                    ? "bg-white text-black shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
                    : "text-white/45 hover:text-white/75"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Full-width sub-tabs — equal cells filling the row */}
        <div className="px-3 pb-3">
          <div
            className="grid gap-1.5 rounded-2xl border border-white/10 bg-[#0a0a0a] p-1.5"
            style={{ gridTemplateColumns: `repeat(${subTabs.length}, minmax(0, 1fr))` }}
          >
            {subTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-[44px] rounded-xl px-1 text-center text-[12px] font-bold leading-tight transition-all sm:text-[13px] ${
                  tab === t.id
                    ? "bg-white text-black"
                    : "bg-transparent text-white/45 hover:bg-white/[0.06] hover:text-white/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative px-3 pb-3">
          <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol or paste mint"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-11 pr-11 text-[15px] outline-none placeholder:text-white/25 focus:border-white/30"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-white/30"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-white/25">
          <span className="w-10" />
          <span className="flex-1">Token</span>
          <span className="w-20 text-right">Mcap</span>
          <span className="w-16 text-right">24h</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {loading && !list.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-7 w-7 animate-spin text-white/30" />
            <p className="text-xs text-white/35">Loading markets…</p>
          </div>
        ) : !list.length ? (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <Zap className="mb-3 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/40">No coins in this feed</p>
          </div>
        ) : (
          list.map((c, i) => (
            <button
              key={c.mint}
              type="button"
              onClick={() => openCoin(c.mint)}
              className="flex w-full items-center gap-3 border-b border-white/[0.05] px-4 py-3.5 text-left transition-colors active:bg-white/10 hover:bg-white/[0.04]"
            >
              <span className="w-5 shrink-0 font-mono text-[10px] text-white/20">{i + 1}</span>
              {c.image ? (
                <img
                  src={c.image}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full bg-white/10 object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white/20 to-white/5 text-xs font-bold ring-1 ring-white/10">
                  {c.symbol.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[15px] font-bold tracking-tight">{c.symbol}</span>
                  <span className="truncate text-[11px] text-white/30">{c.name}</span>
                </div>
                <div className="mt-0.5 flex gap-2.5 font-mono text-[10px] text-white/30">
                  <span>{fmtUsd(c.price)}</span>
                  <span className="text-white/15">·</span>
                  <span>V {fmtUsd(c.volume24h)}</span>
                </div>
              </div>
              <div className="w-20 shrink-0 text-right">
                <p className="font-mono text-[13px] font-semibold text-white/90">{fmtUsd(c.mcap)}</p>
              </div>
              <div
                className={`w-16 shrink-0 rounded-lg py-1 text-center font-mono text-[12px] font-bold ${
                  c.change24h > 0
                    ? "bg-green-500/15 text-green-400"
                    : c.change24h < 0
                      ? "bg-red-500/15 text-red-400"
                      : "bg-white/5 text-white/35"
                }`}
              >
                {fmtPct(c.change24h)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
