import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getKolFeed, getKols, addKol, Kol, KolFeedItem } from "../lib/kol";
import { tagClass } from "../components/KolBadge";
import { fmtUsd, compact, short } from "../lib/api";
import { timeAgo } from "../lib/format";
import TokenLogo from "../components/TokenLogo";
import Copyable from "../components/Copyable";
import { Radio, ExternalLink, Search, ArrowUpRight, ArrowDownRight, BadgeCheck, Plus, Loader2, X, Activity, Flame, Wallet2, TrendingUp } from "lucide-react";

const RANGES: [string, number][] = [["1h", 3600e3], ["6h", 6 * 3600e3], ["24h", 864e5], ["7d", 7 * 864e5]];

export default function KolScanner() {
  const [view, setView] = useState<"feed" | "leaderboard">("feed");
  return (
    <div>
      {/* ── Terminal header ── */}
      <div className="term-panel bg-term-grid px-4 sm:px-5 py-4 mb-4">
        <div className="term text-[11px]" style={{ color: "#66707E" }}>
          <span style={{ color: "#00FFA3" }}>orbitx@dex</span><span>:~$</span> kol --track --wallets all --live
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-1.5">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Radio className="w-5 h-5 text-accent" /> KOL_TRACKER</h1>
          <p className="term text-[11px] text-muted pb-1">smart-money wallets · real-time swaps · PnL intel</p>
          <div className="sm:ml-auto flex gap-1 bg-panel border border-line rounded-md p-1">
            <button onClick={() => setView("feed")} className={`btn text-xs uppercase tracking-wider ${view === "feed" ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>Live_Feed</button>
            <button onClick={() => setView("leaderboard")} className={`btn text-xs uppercase tracking-wider ${view === "leaderboard" ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>Leaderboard</button>
          </div>
        </div>
      </div>
      {view === "feed" ? <LiveFeed /> : <Leaderboard />}
    </div>
  );
}

/* ── Stat cell ── */
function Stat({ label, value, tone, sub }: { label: string; value: React.ReactNode; tone?: "up" | "down" | "gold" | "plain"; sub?: React.ReactNode }) {
  const color = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "gold" ? "text-gold" : "text-white";
  return (
    <div className="card px-3.5 py-3">
      <div className="term-label mb-1">{label}</div>
      <div className={`term text-lg font-bold leading-none tabular ${color}`}>{value}</div>
      {sub != null && <div className="term text-[10px] text-faint mt-1.5">{sub}</div>}
    </div>
  );
}

/* ---------------- Live Feed ---------------- */
function LiveFeed() {
  const [feed, setFeed] = useState<KolFeedItem[]>([]);
  const [side, setSide] = useState<"" | "buy" | "sell">("");
  const [range, setRange] = useState(864e5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    const load = () => getKolFeed({ side: side || undefined, limit: 100 }).then((d) => { if (on) { setFeed(d.feed || []); setLoading(false); } });
    load();
    const id = setInterval(load, 15000); // poll + triggers server-side ingestion
    return () => { on = false; clearInterval(id); };
  }, [side]);

  const rows = useMemo(() => feed.filter((f) => !f.time || Date.now() - f.time <= range), [feed, range]);

  // ── Aggregate flow intel from the visible tape ──
  const stats = useMemo(() => {
    let buyN = 0, sellN = 0, buyUsd = 0, sellUsd = 0;
    const kolSet = new Set<string>();
    const tokenAgg: Record<string, { symbol: string; mint: string; usd: number; buys: number; sells: number }> = {};
    for (const f of rows) {
      const usd = f.usdValue || 0;
      if (f.side === "buy") { buyN++; buyUsd += usd; } else { sellN++; sellUsd += usd; }
      if (f.kolId) kolSet.add(f.kolId);
      if (f.mint) {
        const t = tokenAgg[f.mint] ||= { symbol: f.symbol || short(f.mint), mint: f.mint, usd: 0, buys: 0, sells: 0 };
        t.usd += usd; if (f.side === "buy") t.buys++; else t.sells++;
      }
    }
    const hot = Object.values(tokenAgg).sort((a, b) => b.usd - a.usd).slice(0, 3);
    const total = buyUsd + sellUsd;
    return { buyN, sellN, buyUsd, sellUsd, net: buyUsd - sellUsd, pressure: total ? buyUsd / total : 0.5, kols: kolSet.size, hot };
  }, [rows]);

  return (
    <div>
      {/* ── Flow stats deck ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-3">
        <Stat label="BUYS" tone="up" value={<>{stats.buyN}<span className="text-[11px] text-faint ml-1.5">tx</span></>} sub={fmtUsd(stats.buyUsd, { compact: true })} />
        <Stat label="SELLS" tone="down" value={<>{stats.sellN}<span className="text-[11px] text-faint ml-1.5">tx</span></>} sub={fmtUsd(stats.sellUsd, { compact: true })} />
        <Stat label="NET_FLOW" tone={stats.net >= 0 ? "up" : "down"} value={(stats.net >= 0 ? "+" : "−") + fmtUsd(Math.abs(stats.net), { compact: true })} sub={stats.net >= 0 ? "accumulation" : "distribution"} />
        <Stat label="ACTIVE_KOLS" value={stats.kols} sub="in current window" />
        <div className="card px-3.5 py-3 col-span-2 sm:col-span-1">
          <div className="term-label mb-1.5">BUY_PRESSURE</div>
          <div className="h-2 rounded-full overflow-hidden flex" style={{ background: "#111513" }}>
            <div className="h-full" style={{ width: `${stats.pressure * 100}%`, background: "linear-gradient(90deg,#00C776,#00FFA3)" }} />
            <div className="h-full flex-1" style={{ background: "linear-gradient(90deg,#C24444,#FF5C5C)" }} />
          </div>
          <div className="term text-[10px] mt-1.5 flex justify-between"><span className="text-up">{Math.round(stats.pressure * 100)}% buy</span><span className="text-down">{Math.round((1 - stats.pressure) * 100)}% sell</span></div>
        </div>
      </div>

      {/* ── Hottest tokens ── */}
      {stats.hot.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {stats.hot.map((t, i) => (
            <Link key={t.mint} to={`/token/${t.mint}`} className="card px-3 py-1.5 flex items-center gap-2 hover:border-accent/50">
              <Flame className={`w-3.5 h-3.5 ${i === 0 ? "text-gold" : "text-accent"}`} />
              <span className="term text-xs font-bold">{t.symbol}</span>
              <span className="term text-[10px] text-faint">{fmtUsd(t.usd, { compact: true })}</span>
              <span className="term text-[10px]"><span className="text-up">{t.buys}B</span><span className="text-faint">/</span><span className="text-down">{t.sells}S</span></span>
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex gap-1 bg-panel border border-line rounded-md p-1">
          {[["", "ALL"], ["buy", "BUYS"], ["sell", "SELLS"]].map(([id, label]) => (
            <button key={id} onClick={() => setSide(id as any)} className={`btn text-[11px] term ${side === id ? (id === "sell" ? "bg-down/15 text-down" : "bg-accent/15 text-accent") : "text-muted hover:text-white"}`}>{label}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-panel border border-line rounded-md p-1">
          {RANGES.map(([label, ms]) => (
            <button key={label} onClick={() => setRange(ms)} className={`btn text-[11px] term ${range === ms ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>{label}</button>
          ))}
        </div>
        <span className="ml-auto pill bg-up/10 text-up text-[10px] term inline-flex items-center gap-1"><Radio className="w-3 h-3 animate-pulse" /> LIVE · 15s</span>
      </div>

      {/* ── Trade tape ── */}
      {loading ? (
        <div className="term-panel grid place-items-center py-20 text-muted" style={{ minHeight: 280 }}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
            <span className="term text-[11px] text-faint">$ tail -f kol_swaps.log<span className="term-cursor" /></span>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-line flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-accent" />
            <span className="term-label">TRADE_TAPE</span>
            <span className="term text-[10px] text-faint ml-auto">{rows.length} events</span>
          </div>
          <div className="divide-y divide-line/60">
            {rows.length ? rows.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel2/40" style={{ borderLeft: `2px solid ${f.side === "buy" ? "#00FFA3" : "#FF5C5C"}` }}>
                <div className="relative shrink-0">
                  {f.avatar
                    ? <img src={f.avatar} alt="" className="w-8 h-8 rounded-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                    : <div className="w-8 h-8 rounded-full bg-panel2 grid place-items-center text-[10px] font-bold text-muted">{(f.name || "?").slice(0, 2)}</div>}
                  <span className={`absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full ${f.side === "buy" ? "bg-up" : "bg-down"}`}>
                    {f.side === "buy" ? <ArrowUpRight className="w-2.5 h-2.5 text-black" /> : <ArrowDownRight className="w-2.5 h-2.5 text-black" />}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap text-[13px]">
                    <Link to={`/kol/${addrOf(f)}`} className="font-semibold hover:text-accent inline-flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-accent" />{f.name}</Link>
                    {f.twitter && <span className="term text-[10px] text-faint">{f.twitter}</span>}
                    {(f.tags || []).slice(0, 1).map((t) => <span key={t} className={`pill text-[9px] !px-1.5 !py-0 ${tagClass(t)}`}>{t}</span>)}
                  </div>
                  <div className="term text-xs mt-0.5">
                    <span className={f.side === "buy" ? "text-up font-bold" : "text-down font-bold"}>{f.side === "buy" ? "BUY " : "SELL"}</span>{" "}
                    {f.mint ? <Link to={`/token/${f.mint}`} className="font-bold hover:text-accent">{f.symbol || short(f.mint)}</Link> : <span className="text-muted">token</span>}
                    {f.usdValue ? <span className="text-white/85"> {fmtUsd(f.usdValue, { compact: true })}</span> : null}
                    {f.solAmount ? <span className="text-faint"> · {f.solAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL</span> : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="term text-[10px] text-faint">{f.time ? timeAgo(f.time) : "—"}</div>
                  {f.txHash && <a href={`https://solscan.io/tx/${f.txHash}`} target="_blank" rel="noreferrer" className="term text-[10px] text-accent/70 hover:text-accent inline-flex items-center gap-0.5">tx <ExternalLink className="w-3 h-3" /></a>}
                </div>
              </div>
            )) : <div className="p-12 text-center text-muted text-sm term">No KOL activity in this window. Tape fills as tracked wallets trade.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
function addrOf(f: KolFeedItem) { return f.kolAddress || f.kolId || ""; }

/* ---------------- Leaderboard ---------------- */
function Leaderboard() {
  const [kols, setKols] = useState<Kol[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"pnl" | "winRate" | "followers">("pnl");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => getKols().then((d) => { setKols(d.kols || []); setLoading(false); });
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = kols.filter((k) => !s || k.name.toLowerCase().includes(s) || (k.twitter || "").toLowerCase().includes(s) || k.address.toLowerCase().includes(s));
    return [...f].sort((a, b) => ((b as any)[sort] ?? -Infinity) - ((a as any)[sort] ?? -Infinity));
  }, [kols, q, sort]);

  const agg = useMemo(() => {
    const withPnl = kols.filter((k) => k.pnl != null);
    const totalPnl = withPnl.reduce((a, k) => a + (k.pnl || 0), 0);
    const winners = withPnl.filter((k) => (k.pnl || 0) > 0).length;
    const rates = kols.filter((k) => k.winRate != null).map((k) => k.winRate as number);
    const avgWin = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    return { tracked: kols.length, active: kols.filter((k) => k.isActive).length, totalPnl, winners, withPnl: withPnl.length, avgWin };
  }, [kols]);

  const maxAbsPnl = useMemo(() => Math.max(1, ...rows.map((k) => Math.abs(k.pnl || 0))), [rows]);

  return (
    <div>
      {/* ── Aggregate deck ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
        <Stat label="TRACKED_WALLETS" value={agg.tracked} sub={`${agg.active} active`} />
        <Stat label="COMBINED_PNL" tone={agg.totalPnl >= 0 ? "up" : "down"} value={(agg.totalPnl >= 0 ? "+" : "−") + fmtUsd(Math.abs(agg.totalPnl), { compact: true })} sub="recent realized" />
        <Stat label="PROFITABLE" tone="gold" value={agg.withPnl ? `${agg.winners}/${agg.withPnl}` : "—"} sub="wallets in profit" />
        <Stat label="AVG_WIN_RATE" value={agg.avgWin != null ? `${Math.round(agg.avgWin)}%` : "—"} sub="across scored KOLs" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="grep name / handle / wallet…" className="inp !pl-9" />
        </div>
        <div className="flex gap-1 bg-panel border border-line rounded-md p-1">
          {[["pnl", "PNL"], ["winRate", "WIN%"], ["followers", "REACH"]].map(([id, label]) => (
            <button key={id} onClick={() => setSort(id as any)} className={`btn text-[11px] term ${sort === id ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>{label}</button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="ml-auto btn bg-accent text-black font-bold inline-flex items-center gap-1.5 text-sm"><Plus className="w-3.5 h-3.5" /> Add wallet</button>
      </div>

      {loading ? <div className="grid place-items-center py-20 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-line flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-accent" />
            <span className="term-label">SMART_MONEY_INDEX</span>
            <span className="term text-[10px] text-faint ml-auto">{rows.length} wallets · sorted by {sort}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead><tr className="text-muted term text-[10px] uppercase tracking-wider border-b border-line">
                <th className="text-left px-4 py-2.5 w-10">#</th><th className="text-left px-2 py-2.5">KOL</th><th className="text-left px-2 py-2.5">Wallet</th>
                <th className="text-left px-2 py-2.5">Tags</th><th className="text-right px-2 py-2.5">Reach</th><th className="text-right px-2 py-2.5">PnL</th><th className="text-left px-2 py-2.5 w-32">PnL_BAR</th><th className="text-right px-2 py-2.5">Win%</th><th className="text-left px-4 py-2.5">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((k, i) => (
                  <tr key={k.address} className="border-b border-line/50 hover:bg-panel2/40">
                    <td className={`px-4 py-2.5 term text-xs ${i < 3 ? "text-gold font-bold" : "text-faint"}`}>{String(i + 1).padStart(2, "0")}</td>
                    <td className="px-2 py-2.5"><Link to={`/kol/${k.address}`} className="flex items-center gap-2 font-semibold hover:text-accent"><TokenLogo src={k.avatar} sym={k.name} size={26} />{k.name}
                      {k.twitter && <a href={k.twitterUrl || "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="term text-[10px] text-faint hover:text-accent">{k.twitter}</a>}
                    </Link></td>
                    <td className="px-2 py-2.5"><Copyable text={k.address} display={short(k.address)} className="text-xs term" /></td>
                    <td className="px-2 py-2.5"><div className="flex gap-1 flex-wrap">{(k.tags || []).slice(0, 2).map((t) => <span key={t} className={`pill text-[9px] !px-1.5 !py-0 ${tagClass(t)}`}>{t}</span>)}</div></td>
                    <td className="px-2 py-2.5 text-right tabular term text-xs">{k.followers != null ? compact(k.followers) : "—"}</td>
                    <td className={`px-2 py-2.5 text-right tabular term text-xs font-bold ${k.pnl == null ? "text-muted" : k.pnl >= 0 ? "text-up" : "text-down"}`}>{k.pnl == null ? "—" : (k.pnl >= 0 ? "+" : "−") + fmtUsd(Math.abs(k.pnl), { compact: true })}</td>
                    <td className="px-2 py-2.5">
                      {k.pnl != null && (
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#111513" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (Math.abs(k.pnl) / maxAbsPnl) * 100)}%`, background: k.pnl >= 0 ? "linear-gradient(90deg,#00C776,#00FFA3)" : "linear-gradient(90deg,#B33,#FF5C5C)" }} />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular term text-xs">{k.winRate == null ? "—" : <span className={k.winRate >= 50 ? "text-up" : "text-down"}>{k.winRate}%</span>}</td>
                    <td className="px-4 py-2.5">{k.status === "disputed" ? <span className="pill bg-down/15 text-down text-[10px] term">DISPUTED</span> : <span className="pill bg-up/10 text-up text-[10px] term">ACTIVE</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showAdd && <AddKolModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddKolModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [f, setF] = useState<any>({ name: "", twitter: "", address: "", tags: "KOL", notes: "", pass: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await addKol({ ...f, tags: f.tags.split(",").map((s: string) => s.trim()).filter(Boolean) });
      if (r.ok) onAdded(); else setErr(r.error || "Failed");
    } catch (e: any) { setErr(String(e?.message || e)); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="term-panel p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold term">&gt; add_kol_wallet</h3><button onClick={onClose} className="text-muted hover:text-white"><X className="w-4 h-4" /></button></div>
        <div className="space-y-2.5">
          <input className="inp" placeholder="Name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="inp" placeholder="Twitter (@handle)" value={f.twitter} onChange={(e) => setF({ ...f, twitter: e.target.value })} />
          <input className="inp" placeholder="Wallet address *" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          <input className="inp" placeholder="Tags (comma separated)" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />
          <input className="inp" placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <input className="inp" placeholder="Admin password *" type="password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} />
          {err && <div className="text-down text-xs term">{err}</div>}
          <button disabled={busy} onClick={submit} className="btn bg-accent text-black font-bold w-full disabled:opacity-60">{busy ? "Adding…" : "ADD_TO_DATABASE"}</button>
        </div>
      </div>
    </div>
  );
}
