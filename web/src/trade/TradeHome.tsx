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
    { id: "jupiter", label: "Jup" },
  ],
  pump: [
    { id: "unbonded", label: "Bonding" },
    { id: "migrated", label: "Grad" },
    { id: "moonshot", label: "Moon" },
    { id: "newpairs", label: "Pairs" },
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
        setResults(rows.slice(0, 40));
        setSearching(false);
      });
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  const list = q.trim().length >= 2 ? results : coins;
  const subTabs = TABS[cat];
  const topMover = !q && coins[0];

  const openCoin = (mint: string) => {
    try {
      sessionStorage.setItem(LAST_MINT_KEY, mint);
    } catch {
      /* ignore */
    }
    navigate(`/trade/token/${mint}`);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#050505]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 20% -20%, rgba(255,255,255,0.09), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 0%, rgba(120,120,120,0.08), transparent 50%)",
        }}
      />

      <div className="relative shrink-0">
        <div className="flex items-end justify-between px-4 pb-2 pt-3">
          <div>
            <h1 className="text-[26px] font-black tracking-tight">Markets</h1>
            <p className="mt-0.5 text-[12px] text-white/40">
              {loading || searching ? "Syncing…" : `${list.length} coins`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">Live</span>
          </div>
        </div>

        {topMover && (
          <button
            type="button"
            onClick={() => openCoin(topMover.mint)}
            className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.08] to-white/[0.02] p-3 text-left active:scale-[0.99]"
          >
            {topMover.image ? (
              <img src={topMover.image} alt="" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/15" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-sm font-bold">
                {topMover.symbol.slice(0, 2)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Top in feed</p>
              <p className="truncate text-[15px] font-bold">{topMover.symbol}</p>
              <p className="font-mono text-[11px] text-white/40">{fmtUsd(topMover.price)}</p>
            </div>
            <div
              className={`rounded-xl px-2.5 py-1.5 font-mono text-[13px] font-bold ${
                topMover.change24h >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}
            >
              {fmtPct(topMover.change24h)}
            </div>
          </button>
        )}

        <div className="px-4 pb-2">
          <div className="flex gap-1.5">
            {CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-all ${
                  cat === c.id
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.03] text-white/45 hover:text-white/70"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 scrollbar-none">
          {subTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                tab === t.id
                  ? "bg-white/15 text-white ring-1 ring-white/25"
                  : "text-white/35 hover:text-white/60"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative px-4 pb-3">
          <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search or paste mint"
            className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-10 text-[14px] outline-none placeholder:text-white/25 focus:border-white/25 focus:bg-white/[0.06]"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-7 top-1/2 -translate-y-1/2 text-white/30"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {loading && !list.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="h-7 w-7 animate-spin text-white/30" />
            <p className="text-xs text-white/35">Loading markets…</p>
          </div>
        ) : !list.length ? (
          <p className="py-20 text-center text-sm text-white/35">No coins in this feed</p>
        ) : (
          <div className="space-y-1.5">
            {list.map((c, i) => (
              <button
                key={c.mint}
                type="button"
                onClick={() => openCoin(c.mint)}
                className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left transition-colors hover:bg-white/[0.05] active:bg-white/[0.08]"
              >
                <span className="w-4 shrink-0 font-mono text-[10px] text-white/20">{i + 1}</span>
                {c.image ? (
                  <img
                    src={c.image}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-xl bg-white/10 object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[11px] font-bold ring-1 ring-white/10">
                    {c.symbol.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="truncate text-[14px] font-bold">{c.symbol}</span>
                    <span className="truncate text-[11px] text-white/30">{c.name}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-white/30">
                    {fmtUsd(c.price)} · vol {fmtUsd(c.volume24h)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[12px] font-semibold text-white/85">{fmtUsd(c.mcap)}</p>
                  <p
                    className={`mt-0.5 font-mono text-[11px] font-bold ${
                      c.change24h > 0 ? "text-emerald-400" : c.change24h < 0 ? "text-red-400" : "text-white/35"
                    }`}
                  >
                    {fmtPct(c.change24h)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
