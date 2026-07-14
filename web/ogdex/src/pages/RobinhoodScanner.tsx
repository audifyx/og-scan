import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Search, Loader2, Feather, ShieldAlert, ShieldCheck, AlertTriangle, Droplets, Users, Flame, Activity, ArrowUpRight, Info, BadgeCheck, XCircle } from "lucide-react";
import { getScreener, getToken, type Row, fmtUsd, short } from "../lib/api";

function analyze(t: Row) {
  const liq = t.liquidity || 0, hold = t.holderCount || 0, vol = t.volume || 0;
  const liqScore = Math.min(100, Math.round((liq / 50_000) * 100));
  const holderScore = Math.min(100, Math.round((hold / 1_000) * 100));
  const volScore = Math.min(100, Math.round((vol / 50_000) * 100));
  const buys = t.numBuys || 0, sells = t.numSells || 0, tot = buys + sells;
  const balance = tot > 0 ? Math.round((Math.min(buys, sells) / Math.max(buys, sells || 1)) * 100) : 50;
  const health = Math.round(liqScore * 0.35 + holderScore * 0.30 + volScore * 0.20 + balance * 0.15);
  const risk = health >= 70 ? "Low" : health >= 45 ? "Medium" : "High";
  return { liqScore, holderScore, volScore, balance, health, risk };
}

function Bar({ label, value, Icon }: { label: string; value: number; Icon: any }) {
  const c = value >= 70 ? "#00FFA3" : value >= 45 ? "#FFC53D" : "#FF5C5C";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-muted mb-1"><span className="inline-flex items-center gap-1"><Icon className="w-3 h-3" />{label}</span><span className="font-bold" style={{ color: c }}>{value}</span></div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${value}%`, background: c }} /></div>
    </div>
  );
}

function SecRow({ ok, label, good, bad }: { ok: boolean; label: string; good: string; bad: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2/50 p-2.5">
      <div className="text-[9px] uppercase text-muted/60">{label}</div>
      <div className={`mt-0.5 inline-flex items-center gap-1 text-xs font-bold ${ok ? "text-up" : "text-down"}`}>
        {ok ? <BadgeCheck className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}{ok ? good : bad}
      </div>
    </div>
  );
}

export default function RobinhoodScanner() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Row | null>(null);
  const [sec, setSec] = useState<any>(null);
  const [secLoading, setSecLoading] = useState(false);

  useEffect(() => {
    if (!sel) { setSec(null); return; }
    let on = true; setSecLoading(true); setSec(null);
    getToken(sel.mint, "robinhood")
      .then((r: any) => { if (on) setSec(r?.safety || null); })
      .catch(() => { if (on) setSec(null); })
      .finally(() => { if (on) setSecLoading(false); });
    return () => { on = false; };
  }, [sel]);

  useEffect(() => {
    let on = true;
    getScreener("trending", "24h", 150, "robinhood").then((d) => { if (on) { setRows(d.rows || []); setLoading(false); } }).catch(() => on && setLoading(false));
    return () => { on = false; };
  }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [] as Row[];
    return rows.filter((r) => (r.name || "").toLowerCase().includes(s) || (r.symbol || "").toLowerCase().includes(s) || (r.mint || "").toLowerCase().includes(s)).slice(0, 8);
  }, [rows, q]);

  const a = sel ? analyze(sel) : null;
  const riskMeta = a?.risk === "Low" ? { cls: "text-up border-up/40 bg-up/10", Icon: ShieldCheck } : a?.risk === "Medium" ? { cls: "text-gold border-gold/40 bg-gold/10", Icon: AlertTriangle } : { cls: "text-down border-down/40 bg-down/10", Icon: ShieldAlert };

  return (
    <div className="mx-auto max-w-[900px] space-y-4 px-4 py-6">
      <div className="term-panel bg-term-grid px-4 sm:px-5 py-4">
        <div className="term text-[11px]" style={{ color: "#66707E" }}><span style={{ color: "#00FFA3" }}>orbitx@robinhood</span>:~$ scan --heuristic --liquidity --holders --activity</div>
        <div className="flex flex-wrap items-end gap-3 mt-1.5">
          <h1 className="font-display text-2xl font-black text-white flex items-center gap-2"><Crosshair className="h-5 w-5 text-accent" /> ROBINHOOD_SCANNER</h1>
          <span className="rounded-md border border-accent/40 bg-accent/15 px-2 py-0.5 text-[9px] term font-black uppercase tracking-widest text-accent mb-1">HEURISTIC</span>
        </div>
        <p className="term text-[11px] leading-relaxed text-muted mt-1 max-w-lg">Health & risk heuristics from live liquidity, holder, volume and trade-balance data for Robinhood-chain tokens.</p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-line bg-panel p-2 focus-within:border-accent/60">
        <span className="term text-xs pl-2 shrink-0 text-accent">$ scan</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a Robinhood token by name, ticker, or CA…" className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm text-white outline-none placeholder:text-muted/50" />
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-accent mr-2" /> : <Search className="h-4 w-4 text-faint mr-2" />}
      </div>

      {q && matches.length > 0 && !sel && (
        <div className="card divide-y divide-line">
          {matches.map((t) => (
            <button key={t.mint} onClick={() => { setSel(t); setQ(""); }} className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/[0.03]">
              {t.icon ? <img src={t.icon} className="h-8 w-8 rounded-full object-cover" /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-panel2 text-accent text-[11px] font-bold">{(t.symbol || "?").slice(0, 2)}</div>}
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-white">{t.name || short(t.mint)}</div><div className="text-[11px] text-muted font-mono">${t.symbol}</div></div>
              <span className="text-[11px] text-muted">{t.mcap ? fmtUsd(t.mcap, { compact: true }) : "—"}</span>
            </button>
          ))}
        </div>
      )}

      {sel && a && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {sel.icon ? <img src={sel.icon} className="h-12 w-12 rounded-full object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-full bg-panel2 text-accent font-bold">{(sel.symbol || "?").slice(0, 2)}</div>}
            <div className="min-w-0 flex-1"><div className="text-lg font-black text-white truncate">{sel.name || short(sel.mint)}</div><div className="text-xs font-mono text-muted">${sel.symbol} · {short(sel.mint)}</div></div>
            <button onClick={() => setSel(null)} className="btn bg-panel2 text-muted text-[11px] px-3 py-1.5">Clear</button>
          </div>

          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="card p-5 grid place-items-center text-center">
              <div className="grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(${a.health >= 70 ? "#00FFA3" : a.health >= 45 ? "#FFC53D" : "#FF5C5C"} ${a.health * 3.6}deg, rgba(255,255,255,0.08) 0)` }}>
                <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-bg"><span className="text-2xl font-black" style={{ color: a.health >= 70 ? "#00FFA3" : a.health >= 45 ? "#FFC53D" : "#FF5C5C" }}>{a.health}</span></div>
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-muted">Health score</div>
              <span className={`mt-2 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${riskMeta.cls}`}><riskMeta.Icon className="h-3.5 w-3.5" />{a.risk} risk</span>
            </div>
            <div className="card p-4 space-y-3">
              <Bar label="Liquidity depth" value={a.liqScore} Icon={Droplets} />
              <Bar label="Holder base" value={a.holderScore} Icon={Users} />
              <Bar label="Volume activity" value={a.volScore} Icon={Flame} />
              <Bar label="Buy/sell balance" value={a.balance} Icon={Activity} />
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div><div className="text-[9px] uppercase text-muted/60">Liquidity</div><div className="text-xs font-semibold">{sel.liquidity ? fmtUsd(sel.liquidity, { compact: true }) : "—"}</div></div>
                <div><div className="text-[9px] uppercase text-muted/60">Holders</div><div className="text-xs font-semibold">{sel.holderCount ?? "—"}</div></div>
                <div><div className="text-[9px] uppercase text-muted/60">24h Vol</div><div className="text-xs font-semibold">{sel.volume ? fmtUsd(sel.volume, { compact: true }) : "—"}</div></div>
              </div>
            </div>
          </div>

          <Link to={`/token/${sel.mint}?chain=robinhood`} className="btn bg-accent/15 text-accent text-sm inline-flex items-center gap-1.5 px-4 py-2 font-bold">View full token data <ArrowUpRight className="w-4 h-4" /></Link>

          {/* Real contract security via Blockscout */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-black text-white">Contract Security</h3>
              <span className="text-[10px] text-muted">live via Blockscout</span>
              {secLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted ml-auto" />}
            </div>
            {sec ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <SecRow ok={sec.verified === true} label="Verified" good="Source verified" bad="Unverified" />
                  <SecRow ok={sec.ownerRenounced === true || sec.ownerRenounced === null} label="Ownership" good={sec.ownerRenounced === null ? "No owner fn" : "Renounced"} bad="Owner active" />
                  <div className="rounded-lg border border-line bg-panel2/50 p-2.5"><div className="text-[9px] uppercase text-muted/60">Top 10 holders</div><div className={`text-sm font-bold ${(sec.topHoldersPct ?? 0) >= 60 ? "text-down" : (sec.topHoldersPct ?? 0) >= 35 ? "text-gold" : "text-up"}`}>{sec.topHoldersPct != null ? sec.topHoldersPct.toFixed(1) + "%" : "\u2014"}</div></div>
                  <div className="rounded-lg border border-line bg-panel2/50 p-2.5"><div className="text-[9px] uppercase text-muted/60">Risk score</div><div className={`text-sm font-bold ${(sec.riskScore ?? 0) >= 40 ? "text-down" : "text-up"}`}>{sec.riskScore ?? "\u2014"}</div></div>
                </div>
                {Array.isArray(sec.risks) && sec.risks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sec.risks.map((r: any, i: number) => (
                      <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${r.level === "danger" ? "bg-down/12 text-down" : "bg-gold/12 text-gold"}`}>
                        <AlertTriangle className="w-3 h-3" />{r.name}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : secLoading ? (
              <div className="text-[11px] text-muted">Fetching on-chain contract data...</div>
            ) : (
              <div className="text-[11px] text-muted">Contract data not available for this token.</div>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-line bg-panel2/50 px-3 py-2.5 text-[11px] text-muted">
            <Info className="w-4 h-4 shrink-0 text-gold mt-0.5" />
            <span>This is a <span className="text-white">heuristic</span> read from live market data (liquidity, holders, volume, trade balance). Contract verification, ownership and holder-distribution data are <span className="text-white">live on-chain</span> via Blockscout. Trade-simulation checks (honeypot / buy-sell tax) are not available for this chain yet. Always DYOR.</span>
          </div>
        </div>
      )}

      {!q && !sel && (
        <div className="term-panel p-8 text-center text-sm text-muted term" style={{ minHeight: 200 }}>
          <Feather className="w-8 h-8 text-muted mx-auto mb-3" />
          Search a Robinhood-chain token to run a heuristic health & risk scan.
        </div>
      )}
    </div>
  );
}
