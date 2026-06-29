import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getKolFeed, getKols, addKol, Kol, KolFeedItem } from "../lib/kol";
import { tagClass } from "../components/KolBadge";
import { fmtUsd, compact, short } from "../lib/api";
import { timeAgo } from "../lib/format";
import TokenLogo from "../components/TokenLogo";
import Copyable from "../components/Copyable";
import WalletLink from "../components/WalletLink";
import { Radio, Users, ExternalLink, Search, ArrowUpRight, ArrowDownRight, BadgeCheck, Plus, Loader2, X } from "lucide-react";

const RANGES: [string, number][] = [["1h", 3600e3], ["6h", 6 * 3600e3], ["24h", 864e5], ["7d", 7 * 864e5]];

export default function KolScanner() {
  const [view, setView] = useState<"feed" | "leaderboard">("feed");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Radio className="w-5 h-5 text-accent" /> KOL Scanner</h1>
          <p className="text-muted text-sm mt-0.5">Track Key Opinion Leaders & smart money on Solana in real time.</p>
        </div>
        <div className="sm:ml-auto flex gap-1 bg-panel border border-line rounded-lg p-1">
          <button onClick={() => setView("feed")} className={`btn ${view === "feed" ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>Live Feed</button>
          <button onClick={() => setView("leaderboard")} className={`btn ${view === "leaderboard" ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>All KOLs</button>
        </div>
      </div>
      {view === "feed" ? <LiveFeed /> : <Leaderboard />}
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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1 bg-panel border border-line rounded-lg p-1">
          {[["", "All"], ["buy", "Buys"], ["sell", "Sells"]].map(([id, label]) => (
            <button key={id} onClick={() => setSide(id as any)} className={`btn text-xs ${side === id ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>{label}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-panel border border-line rounded-lg p-1">
          {RANGES.map(([label, ms]) => (
            <button key={label} onClick={() => setRange(ms)} className={`btn text-xs ${range === ms ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>{label}</button>
          ))}
        </div>
        <span className="ml-auto pill bg-up/10 text-up text-[10px] inline-flex items-center gap-1"><Radio className="w-3 h-3 animate-pulse" /> LIVE · auto-refresh 15s</span>
      </div>

      {loading ? <div className="grid place-items-center py-20 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="card divide-y divide-line/60">
          {rows.length ? rows.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-panel2/30">
              <div className="relative shrink-0">
                {f.avatar
                  ? <img src={f.avatar} alt="" className="w-9 h-9 rounded-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                  : <div className="w-9 h-9 rounded-full bg-panel2 grid place-items-center text-[11px] font-bold text-muted">{(f.name || "?").slice(0, 2)}</div>}
                <span className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full ${f.side === "buy" ? "bg-up" : "bg-down"}`}>
                  {f.side === "buy" ? <ArrowUpRight className="w-2.5 h-2.5 text-black" /> : <ArrowDownRight className="w-2.5 h-2.5 text-black" />}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap text-sm">
                  <Link to={`/kol/${addrOf(f)}`} className="font-semibold hover:text-accent inline-flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-accent" />{f.name}</Link>
                  {f.twitter && <span className="text-[11px] text-muted">{f.twitter}</span>}
                  {(f.tags || []).slice(0, 1).map((t) => <span key={t} className={`pill text-[9px] !px-1.5 !py-0 ${tagClass(t)}`}>{t}</span>)}
                </div>
                <div className="text-sm mt-0.5">
                  <span className={f.side === "buy" ? "text-up" : "text-down"}>{f.side === "buy" ? "bought" : "sold"}</span>{" "}
                  {f.mint ? <Link to={`/token/${f.mint}`} className="font-semibold hover:text-accent">{f.symbol || short(f.mint)}</Link> : <span className="text-muted">token</span>}
                  {f.solAmount ? <span className="text-muted"> · {f.solAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL</span> : null}
                  {f.usdValue ? <span className="text-muted"> · {fmtUsd(f.usdValue, { compact: true })}</span> : null}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-muted">{f.time ? timeAgo(f.time) + " ago" : "—"}</div>
                {f.txHash && <a href={`https://solscan.io/tx/${f.txHash}`} target="_blank" rel="noreferrer" className="text-[11px] text-accent/70 hover:text-accent inline-flex items-center gap-0.5">tx <ExternalLink className="w-3 h-3" /></a>}
              </div>
            </div>
          )) : <div className="p-12 text-center text-muted text-sm">No KOL activity in this range yet. The feed populates as tracked wallets trade — check back shortly.</div>}
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
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => getKols().then((d) => { setKols(d.kols || []); setLoading(false); });
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return kols.filter((k) => !s || k.name.toLowerCase().includes(s) || (k.twitter || "").toLowerCase().includes(s) || k.address.toLowerCase().includes(s));
  }, [kols, q]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search KOL name, handle, wallet…" className="w-full bg-panel border border-line rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-accent/60" />
        </div>
        <span className="text-xs text-muted">{rows.length} KOLs</span>
        <button onClick={() => setShowAdd(true)} className="ml-auto btn bg-accent/15 text-accent inline-flex items-center gap-1.5 text-sm"><Plus className="w-3.5 h-3.5" /> Add wallet</button>
      </div>

      {loading ? <div className="grid place-items-center py-20 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead><tr className="text-muted text-xs border-b border-line">
                <th className="text-left px-4 py-2.5">KOL</th><th className="text-left px-2 py-2.5">Twitter</th><th className="text-left px-2 py-2.5">Wallet</th>
                <th className="text-left px-2 py-2.5">Tags</th><th className="text-right px-2 py-2.5">Followers</th><th className="text-right px-2 py-2.5">PnL (recent)</th><th className="text-right px-2 py-2.5">Win%</th><th className="text-left px-4 py-2.5">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.address} className="border-b border-line/50 hover:bg-panel2/40">
                    <td className="px-4 py-2.5"><Link to={`/kol/${k.address}`} className="flex items-center gap-2 font-semibold hover:text-accent"><TokenLogo src={k.avatar} sym={k.name} size={26} />{k.name}</Link></td>
                    <td className="px-2 py-2.5">{k.twitter ? <a href={k.twitterUrl || "#"} target="_blank" rel="noreferrer" className="text-accent/80 hover:text-accent">{k.twitter}</a> : <span className="text-muted">—</span>}</td>
                    <td className="px-2 py-2.5"><Copyable text={k.address} display={short(k.address)} className="text-xs" /></td>
                    <td className="px-2 py-2.5"><div className="flex gap-1 flex-wrap">{(k.tags || []).slice(0, 3).map((t) => <span key={t} className={`pill text-[9px] !px-1.5 !py-0 ${tagClass(t)}`}>{t}</span>)}</div></td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{k.followers != null ? compact(k.followers) : "—"}</td>
                    <td className={`px-2 py-2.5 text-right tabular-nums font-medium ${k.pnl == null ? "text-muted" : k.pnl >= 0 ? "text-up" : "text-down"}`}>{k.pnl == null ? "—" : (k.pnl >= 0 ? "+" : "") + fmtUsd(k.pnl)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{k.winRate == null ? "—" : k.winRate + "%"}</td>
                    <td className="px-4 py-2.5">{k.status === "disputed" ? <span className="pill bg-down/15 text-down text-[10px]">disputed</span> : <span className="pill bg-up/10 text-up text-[10px]">active</span>}</td>
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
  const inp = "w-full bg-panel2 border border-line rounded-lg px-2.5 py-2 text-sm outline-none focus:border-accent/60";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Add KOL wallet</h3><button onClick={onClose} className="text-muted hover:text-white"><X className="w-4 h-4" /></button></div>
        <div className="space-y-2.5">
          <input className={inp} placeholder="Name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={inp} placeholder="Twitter (@handle)" value={f.twitter} onChange={(e) => setF({ ...f, twitter: e.target.value })} />
          <input className={inp} placeholder="Wallet address *" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          <input className={inp} placeholder="Tags (comma separated)" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />
          <input className={inp} placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <input className={inp} placeholder="Admin password *" type="password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} />
          {err && <div className="text-down text-xs">{err}</div>}
          <button disabled={busy} onClick={submit} className="btn bg-accent text-black font-semibold w-full disabled:opacity-60">{busy ? "Adding…" : "Add to KOL database"}</button>
        </div>
      </div>
    </div>
  );
}
