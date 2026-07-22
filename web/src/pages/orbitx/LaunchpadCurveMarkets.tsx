// OrbitX Curve — discovery grid. Browse live curves from orbitx_curve_markets,
// sort by price / graduation % / newest, click through to each trade page.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, LineChart, Rocket, Search, Sparkles } from "lucide-react";
import { chainById, type ChainDef } from "@/lib/orbitx/chains";
import {
  listCurveMarkets, graduationPct, fmtUnits, type CurveMarketRow, type MarketSort,
} from "@/lib/orbitx/curveData";

const SORTS: { id: MarketSort; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "newest", label: "Newest", Icon: Sparkles },
  { id: "graduation", label: "Graduation %", Icon: Flame },
  { id: "price", label: "Price", Icon: LineChart },
];

export default function LaunchpadCurveMarkets() {
  const [rows, setRows] = useState<CurveMarketRow[]>([]);
  const [sort, setSort] = useState<MarketSort>("newest");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setLoading(true);
    listCurveMarkets(sort, 200).then((r) => { if (on) { setRows(r); setLoading(false); } });
    return () => { on = false; };
  }, [sort]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      (r.symbol ?? "").toLowerCase().includes(s) ||
      (r.name ?? "").toLowerCase().includes(s) ||
      r.token_address.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-[hsl(var(--og-gold))]">// orbitx curve · live markets</div>
          <h1 className="mt-1 font-display text-3xl font-black tracking-tight">LIVE CURVES</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every OrbitX bonding curve, tradeable straight from your wallet.</p>
        </div>
        <Link to="/orbitxlaunch/create/curve" className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--og-gold))] px-4 py-2 text-sm font-bold text-black">
          <Rocket className="h-4 w-4" /> Launch a curve
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          {SORTS.map((s) => (
            <button key={s.id} onClick={() => setSort(s.id)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${sort === s.id ? "border-[hsl(var(--og-gold))] bg-[hsl(var(--og-gold))]/10 text-[hsl(var(--og-gold))]" : "border-white/10 text-muted-foreground hover:border-white/25"}`}>
              <s.Icon className="h-3.5 w-3.5" /> {s.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ticker, address"
            className="w-full rounded-md border border-white/10 bg-transparent py-2 pl-8 pr-3 text-sm outline-none focus:border-[hsl(var(--og-gold))] md:w-72" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading curves…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No curves yet. <Link to="/orbitxlaunch/create/curve" className="text-[hsl(var(--og-gold))]">Launch the first one.</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => {
            const chain: ChainDef | undefined = chainById(m.chain);
            const pct = graduationPct(m);
            const price = m.price_x1e18 ? fmtUnits(BigInt(m.price_x1e18), 18, 10) : "—";
            return (
              <Link key={m.token_address} to={`/orbitxlaunch/curve/${m.token_address}`}
                className="lpx-panel group p-4 transition hover:border-[hsl(var(--og-gold))]/50">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-lg font-black">${m.symbol ?? "?"}</span>
                  <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{chain?.name ?? m.chain}</span>
                </div>
                <div className="mb-3 truncate text-xs text-muted-foreground">{m.name ?? m.token_address}</div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-mono">{price} {chain?.symbol ?? ""}</span>
                </div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-[hsl(var(--og-gold))]" /> {m.graduated ? "Graduated" : "Graduation"}</span>
                  <span>{pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full ${m.graduated ? "bg-[hsl(var(--og-lime))]" : "bg-[hsl(var(--og-gold))]"}`} style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
