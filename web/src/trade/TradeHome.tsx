import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, X } from "lucide-react";
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

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="shrink-0 border-b border-white/10 bg-[#050505]">
        <div className="flex overflow-x-auto px-1">
          {CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={`shrink-0 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide ${
                cat === c.id ? "border-b-2 border-white text-white" : "text-white/35"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 pb-2">
          {TABS[cat].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium ${
                tab === t.id ? "bg-white text-black" : "bg-white/5 text-white/45"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative px-3 pb-3">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search coins or paste mint…"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-9 text-sm outline-none placeholder:text-white/25 focus:border-white/25"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="px-3 pb-2 font-mono text-[10px] text-white/25">
          {loading || searching ? "Syncing…" : `${list.length} coins`}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !list.length ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : !list.length ? (
          <p className="px-4 py-16 text-center text-sm text-white/35">No coins in this tab</p>
        ) : (
          list.map((c) => (
            <button
              key={c.mint}
              type="button"
              onClick={() => navigate(`/trade/token/${c.mint}`)}
              className="flex w-full items-center gap-3 border-b border-white/[0.06] px-3 py-3 text-left transition-colors active:bg-white/10 hover:bg-white/[0.04]"
            >
              {c.image ? (
                <img src={c.image} alt="" className="h-10 w-10 rounded-full bg-white/10 object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                  {c.symbol.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{c.symbol}</span>
                  <span className="truncate text-[11px] text-white/30">{c.name}</span>
                </div>
                <div className="mt-0.5 flex gap-3 font-mono text-[10px] text-white/30">
                  <span>Vol {fmtUsd(c.volume24h)}</span>
                  <span>Liq {fmtUsd(c.liquidity)}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-sm text-white/90">{fmtUsd(c.mcap)}</p>
                <p
                  className={`font-mono text-[11px] ${
                    c.change24h > 0 ? "text-green-400" : c.change24h < 0 ? "text-red-400" : "text-white/30"
                  }`}
                >
                  {fmtPct(c.change24h)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
