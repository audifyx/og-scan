import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getKolProfile, getKolActivity, Kol, KolActivity } from "../lib/kol";
import { tagClass } from "../components/KolBadge";
import { getWallet, WalletPortfolio, fmtUsd, compact, short, isWatched, toggleWatch } from "../lib/api";
import { timeAgo } from "../lib/format";
import TokenLogo from "../components/TokenLogo";
import Copyable from "../components/Copyable";
import { ArrowLeft, Loader2, ExternalLink, Star, BadgeCheck, ArrowUpRight, ArrowDownRight, Wallet as WalletIcon, Activity, Coins, Info } from "lucide-react";

export default function KolProfile() {
  const { address = "" } = useParams();
  const [kol, setKol] = useState<Kol | null>(null);
  const [wallets, setWallets] = useState<any[]>([]);
  const [tab, setTab] = useState<"activity" | "holdings" | "wallets" | "about">("activity");
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(false);

  const [act, setAct] = useState<KolActivity[] | null>(null);

  useEffect(() => {
    setLoading(true); setAct(null);
    getKolProfile(address).then((d) => { setKol(d.kol || null); setWallets(d.wallets || []); setLoading(false); });
    getKolActivity(address, 40).then((d) => setAct(d.activity || []));
    setWatched(isWatched(address));
  }, [address]);

  // Trading stats computed from recent on-chain activity
  const stats = (() => {
    if (!act || !act.length) return null;
    let buyN = 0, sellN = 0, buyUsd = 0, sellUsd = 0;
    const tokens = new Set<string>();
    for (const a of act) {
      const usd = a.usdValue || 0;
      if (a.side === "buy") { buyN++; buyUsd += usd; } else { sellN++; sellUsd += usd; }
      if (a.mint) tokens.add(a.mint);
    }
    const totUsd = buyUsd + sellUsd;
    return { buyN, sellN, buyUsd, sellUsd, net: buyUsd - sellUsd, tokens: tokens.size, avg: totUsd / act.length, last: act[0]?.time || null, n: act.length };
  })();

  if (loading) return <div className="grid place-items-center py-24 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!kol) return <div className="text-center py-24"><p className="text-muted">KOL not found.</p><Link to="/kol" className="text-accent text-sm mt-2 inline-block">← KOL Scanner</Link></div>;

  const disputed = kol.status === "disputed";
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link to="/kol" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white"><ArrowLeft className="w-4 h-4" /> <span className="term text-xs">cd ../kol</span></Link>
        <span className="term text-[11px] text-faint hidden sm:inline"><span className="text-accent">orbitx@dex</span>:~$ kol --profile {short(address)}</span>
      </div>

      <div className="card p-5 mb-4">
        <div className="flex flex-wrap items-start gap-4">
          <TokenLogo src={kol.avatar} sym={kol.name} size={64} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold flex items-center gap-1.5">{!disputed && <BadgeCheck className="w-5 h-5 text-accent" />}{kol.name}</h1>
              {disputed && <span className="pill bg-down/15 text-down text-[10px]">disputed</span>}
              {(kol.tags || []).map((t) => <span key={t} className={`pill text-[10px] ${tagClass(t)}`}>{t}</span>)}
            </div>
            {kol.twitter && <a href={kol.twitterUrl || "#"} target="_blank" rel="noreferrer" className="text-accent/80 hover:text-accent text-sm">{kol.twitter}</a>}
            <div className="mt-1"><Copyable text={kol.address} display={short(kol.address)} className="text-xs text-muted" /></div>
            <div className="flex gap-4 mt-2 text-sm term">
              <div><span className="text-faint text-[10px] uppercase tracking-wider">PnL </span><span className={`font-bold ${kol.pnl == null ? "text-muted" : kol.pnl >= 0 ? "text-up" : "text-down"}`}>{kol.pnl == null ? "—" : (kol.pnl >= 0 ? "+" : "−") + fmtUsd(Math.abs(kol.pnl), { compact: true })}</span></div>
              <div><span className="text-faint text-[10px] uppercase tracking-wider">Win </span><span className={`font-bold ${kol.winRate == null ? "" : kol.winRate >= 50 ? "text-up" : "text-down"}`}>{kol.winRate == null ? "—" : kol.winRate + "%"}</span></div>
              {kol.followers != null && <div><span className="text-faint text-[10px] uppercase tracking-wider">Reach </span><span className="font-bold">{compact(kol.followers)}</span></div>}
            </div>
          </div>
          <div className="sm:ml-auto flex flex-wrap gap-2">
            <button onClick={() => setWatched(toggleWatch(address))} className={`btn inline-flex items-center gap-1.5 ${watched ? "bg-accent text-black font-semibold" : "bg-panel2 text-muted hover:text-white"}`}><Star className={`w-3.5 h-3.5 ${watched ? "fill-black" : ""}`} /> {watched ? "Watching" : "Watch"}</button>
            <Link to={`/wallet/${kol.address}`} className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5"><WalletIcon className="w-3.5 h-3.5" /> Portfolio</Link>
            <a href={`https://solscan.io/account/${kol.address}`} target="_blank" rel="noreferrer" className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5">Solscan <ExternalLink className="w-3 h-3" /></a>
          </div>
        </div>
      </div>

      {/* ── Trading stats deck (from recent on-chain swaps) ── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
          <div className="card px-3.5 py-3"><div className="term-label mb-1">BUYS</div><div className="term text-lg font-bold text-up tabular">{stats.buyN}</div><div className="term text-[10px] text-faint mt-1">{fmtUsd(stats.buyUsd, { compact: true })}</div></div>
          <div className="card px-3.5 py-3"><div className="term-label mb-1">SELLS</div><div className="term text-lg font-bold text-down tabular">{stats.sellN}</div><div className="term text-[10px] text-faint mt-1">{fmtUsd(stats.sellUsd, { compact: true })}</div></div>
          <div className="card px-3.5 py-3"><div className="term-label mb-1">NET_FLOW</div><div className={`term text-lg font-bold tabular ${stats.net >= 0 ? "text-up" : "text-down"}`}>{(stats.net >= 0 ? "+" : "−") + fmtUsd(Math.abs(stats.net), { compact: true })}</div><div className="term text-[10px] text-faint mt-1">{stats.net >= 0 ? "accumulating" : "distributing"}</div></div>
          <div className="card px-3.5 py-3"><div className="term-label mb-1">TOKENS</div><div className="term text-lg font-bold tabular">{stats.tokens}</div><div className="term text-[10px] text-faint mt-1">traded recently</div></div>
          <div className="card px-3.5 py-3"><div className="term-label mb-1">AVG_TRADE</div><div className="term text-lg font-bold tabular">{fmtUsd(stats.avg, { compact: true })}</div><div className="term text-[10px] text-faint mt-1">per swap · {stats.n} swaps</div></div>
          <div className="card px-3.5 py-3"><div className="term-label mb-1">LAST_ACTIVE</div><div className="term text-lg font-bold tabular">{stats.last ? timeAgo(stats.last) : "—"}</div><div className="term text-[10px] text-faint mt-1">on-chain swap</div></div>
        </div>
      )}

      <div className="flex gap-1 bg-panel border border-line rounded-lg p-1 mb-4 w-fit">
        {[["activity", "Activity"], ["holdings", "Holdings"], ["wallets", `Wallets (${wallets.length})`], ["about", "About"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} className={`btn term text-[11px] uppercase tracking-wider ${tab === id ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>{label}</button>
        ))}
      </div>

      {tab === "activity" && <ActivityFeed act={act} />}
      {tab === "holdings" && <Holdings address={kol.address} />}
      {tab === "wallets" && (
        <div className="card divide-y divide-line/60">
          {wallets.length ? wallets.map((w) => (
            <div key={w.address} className="flex items-center justify-between px-4 py-3">
              <Copyable text={w.address} display={short(w.address)} className="text-sm" />
              <div className="flex items-center gap-2"><span className="pill bg-panel2 text-muted text-[10px]">{w.label || "wallet"}</span>{w.primary && <span className="pill bg-accent/15 text-accent text-[10px]">primary</span>}<Link to={`/wallet/${w.address}`} className="text-accent text-xs">portfolio →</Link></div>
            </div>
          )) : <div className="p-8 text-center text-muted text-sm">No linked wallets.</div>}
        </div>
      )}
      {tab === "about" && (
        <div className="card p-5 text-sm">
          <div className="flex items-start gap-2 text-muted"><Info className="w-4 h-4 mt-0.5 text-accent shrink-0" /><div>{kol.notes || "No notes recorded for this KOL yet."}</div></div>
          {kol.followers != null && <div className="mt-3 text-xs text-muted">Followers: {compact(kol.followers)}</div>}
        </div>
      )}
    </div>
  );
}

function ActivityFeed({ act }: { act: KolActivity[] | null }) {
  if (!act) return <div className="grid place-items-center py-16 text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!act.length) return <div className="card p-10 text-center text-muted text-sm term">No recent swaps detected on-chain.</div>;
  return (
    <div className="card divide-y divide-line/60">
      <div className="px-4 py-2.5 flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /><span className="term-label">SWAP_TAPE</span><span className="term text-[10px] text-faint ml-auto">{act.length} events</span></div>
      {act.map((a, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-panel2/30" style={{ borderLeft: `2px solid ${a.side === "buy" ? "#00FFA3" : "#FF5C5C"}` }}>
          <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${a.side === "buy" ? "bg-up/15" : "bg-down/15"}`}>{a.side === "buy" ? <ArrowUpRight className="w-4 h-4 text-up" /> : <ArrowDownRight className="w-4 h-4 text-down" />}</div>
          <TokenLogo src={a.image} sym={a.symbol || ""} size={26} />
          <div className="min-w-0 flex-1 text-sm">
            <span className={a.side === "buy" ? "text-up" : "text-down"}>{a.side === "buy" ? "Bought" : "Sold"}</span>{" "}
            <Link to={`/token/${a.mint}`} className="font-semibold hover:text-accent">{a.symbol || short(a.mint)}</Link>
            <div className="text-xs text-muted">{compact(a.tokenAmount)} tokens{a.solAmount ? ` · ${a.solAmount.toFixed(2)} SOL` : ""}{a.usdValue ? ` · ${fmtUsd(a.usdValue, { compact: true })}` : ""}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted">{a.time ? timeAgo(a.time) + " ago" : "—"}</div>
            {a.txHash && <a href={`https://solscan.io/tx/${a.txHash}`} target="_blank" rel="noreferrer" className="text-[11px] text-accent/70 hover:text-accent">tx ↗</a>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Holdings({ address }: { address: string }) {
  const [d, setD] = useState<WalletPortfolio | null>(null);
  useEffect(() => { let on = true; getWallet(address).then((x) => { if (on) setD(x); }); return () => { on = false; }; }, [address]);
  if (!d) return <div className="grid place-items-center py-16 text-muted"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!d.ok) return <div className="card p-10 text-center text-muted text-sm">Could not load holdings.</div>;
  const rows = (d.holdings || []).filter((h) => (h.usdValue || 0) >= 0.5);
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center gap-2"><Coins className="w-4 h-4 text-accent" /><span className="text-sm font-semibold">Holdings</span><span className="ml-auto text-sm font-semibold">{fmtUsd(d.totalUsd)}</span></div>
      <div className="divide-y divide-line/60">
        {rows.map((h) => (
          <Link key={h.mint} to={`/token/${h.mint}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel2/40">
            <TokenLogo src={h.image} sym={h.symbol || ""} size={28} />
            <div className="min-w-0 flex-1"><div className="font-semibold text-sm truncate">{h.symbol || short(h.mint)}</div><div className="text-[11px] text-muted truncate">{h.name || "Unknown"}</div></div>
            <div className="text-right text-sm"><div className="font-semibold">{fmtUsd(h.usdValue)}</div><div className="text-[11px] text-muted">{compact(h.uiAmount)}</div></div>
          </Link>
        ))}
        {!rows.length && <div className="p-8 text-center text-muted text-sm">No significant holdings.</div>}
      </div>
    </div>
  );
}
