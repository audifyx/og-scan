import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { KolDirEntry } from "../lib/kol";
import KolBadge from "./KolBadge";
import WalletLink from "./WalletLink";
import { fmtUsd, compact, short, TokenDetailData } from "../lib/api";
import { getWalletLabel, labelKindClass } from "../lib/labels";
import { timeAgo } from "../lib/format";
import { ArrowUpRight, ArrowDownRight, ExternalLink, Crown, Radio, BadgeCheck, Loader2, RefreshCw } from "lucide-react";

export default function KolWhaleActivity({ d, dir }: { d: TokenDetailData; dir: Record<string, KolDirEntry> }) {
  const mint = d.mint;
  const intel: any = (d as any).intel || {};
  const holders: any[] = intel.holders || [];
  const intelTrades: any[] = intel.trades || [];
  const price: number | null = (d as any).token?.priceUsd ?? (d as any).meta?.priceUsd ?? null;
  const whaleHolders: any[] = (holders.filter((h) => h.label === "whale")
    .sort((a, b) => (b.pct || 0) - (a.pct || 0)));

  const [feedRows, setFeedRows] = useState<any[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  const fetchFeed = () => {
    if (!mint) { setLoadingFeed(false); return; }
    setLoadingFeed(true);
    fetch(`/api/ogdex/kols?feed=1&token=${mint}&limit=50`)
      .then((r) => r.json())
      .then((data) => setFeedRows(data.feed || []))
      .catch(() => {})
      .finally(() => setLoadingFeed(false));
  };

  useEffect(() => { fetchFeed(); }, [mint]);

  const whaleSet = useMemo(() => new Set(holders.filter((h) => h.label === "whale").map((h) => h.owner)), [holders]);

  // Rows from intel.trades (cross-ref KOL dir + whale set)
  const intelRows = useMemo(() => intelTrades.map((t) => {
    const kol = t.owner ? dir[t.owner] : null;
    const whale = t.owner ? whaleSet.has(t.owner) : false;
    return kol || whale ? { ...t, kol, whale, _source: "intel" } : null;
  }).filter(Boolean) as any[], [intelTrades, dir, whaleSet]);

  // Rows from the live feed (already filtered by token server-side)
  const liveRows = useMemo(() => feedRows.map((r) => {
    const kol = r.kolAddress ? dir[r.kolAddress] : (r.name ? { name: r.name, twitter: r.twitter, address: r.kolAddress, tags: r.tags || [], status: r.kolStatus || "active" } : null);
    return kol ? { ...r, kol, side: r.side, owner: r.kolAddress, tokenAmount: r.tokenAmount, volumeUsd: r.usdValue, time: r.time, txHash: r.txHash, _source: "feed" } : null;
  }).filter(Boolean) as any[], [feedRows, dir]);

  // Merge: dedupe by txHash, live feed takes precedence
  const allRows = useMemo(() => {
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const r of [...liveRows, ...intelRows]) {
      const key = r.txHash || `${r.owner}-${r.time}-${r.side}`;
      if (!seen.has(key)) { seen.add(key); merged.push(r); }
    }
    return merged.sort((a, b) => (b.time || 0) - (a.time || 0));
  }, [liveRows, intelRows]);

  const kolHolders = useMemo(() => holders.filter((h) => dir[h.owner]), [holders, dir]);
  const kolCount = new Set(allRows.filter((r) => r.kol).map((r) => r.kol?.address)).size;
  const kolBuys = allRows.filter((r) => r.kol && r.side === "buy").length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Summary label="KOLs active" value={String(kolCount)} sub={`${kolBuys} buys`} />
        <Summary label="KOLs holding" value={String(kolHolders.length)} sub={kolHolders.length ? "see holders tab" : "none detected"} />
        <Summary label="Whale holders" value={String(whaleHolders.length)} sub="≥1% of supply" />
      </div>

      {/* Whale holders — who is actually holding */}
      {whaleHolders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-sm font-semibold flex items-center gap-2">
            <Crown className="w-4 h-4 text-accent" /> Top Holders ({whaleHolders.length} whales ≥1%)
            <span className="text-muted font-normal text-xs ml-1">named wallets labeled · click to view</span>
          </div>
          <div className="divide-y divide-line/60">
            {whaleHolders.slice(0, 20).map((h) => {
              const lbl = h.publicLabel || getWalletLabel(h.owner);
              const k = h.kol || dir[h.owner];
              return (
                <div key={h.owner} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel2/30">
                  <span className="text-muted text-xs w-6 shrink-0">#{h.rank}</span>
                  <div className="min-w-0 flex-1">
                    {k ? <Link to={`/kol/${h.owner}`} className="inline-flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-accent" /><span className="text-white text-sm font-medium">{k.name}</span></Link>
                       : lbl ? <span className="inline-flex items-center gap-1.5"><span className={`pill text-[10px] ${labelKindClass(lbl.kind)}`}>{lbl.name}</span><WalletLink address={h.owner} icon={false} className="text-xs text-muted" /></span>
                       : <WalletLink address={h.owner} icon={false} className="text-sm" />}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{h.pct != null ? h.pct.toFixed(2) + "%" : "—"}</div>
                    {price && h.uiAmount ? <div className="text-[11px] text-muted">{fmtUsd(h.uiAmount * price, { compact: true })}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KOLs holding this token */}
      {kolHolders.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-accent" /> KOLs holding this token
          </div>
          <div className="flex flex-wrap gap-2">
            {kolHolders.map((h) => (
              <Link key={h.owner} to={`/kol/${h.owner}`} className="pill bg-panel2 hover:bg-panel2/60 inline-flex items-center gap-1.5">
                <BadgeCheck className="w-3 h-3 text-accent" />
                <span className="text-white">{dir[h.owner].name}</span>
                {h.pct != null && <span className="text-muted text-[10px]">{h.pct.toFixed(2)}%</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Trade feed */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line text-sm font-semibold flex items-center gap-2">
          <Radio className="w-4 h-4 text-accent" />
          KOL & Whale Trades
          <span className="pill bg-up/10 text-up text-[10px] inline-flex items-center gap-1">
            <Radio className="w-3 h-3 animate-pulse" /> LIVE
          </span>
          <button onClick={fetchFeed} className="ml-auto text-muted hover:text-white">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingFeed ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loadingFeed ? (
          <div className="py-10 flex items-center justify-center gap-2 text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading feed…
          </div>
        ) : allRows.length ? (
          <div className="divide-y divide-line/60">
            {allRows.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-panel2/30">
                <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${t.side === "buy" ? "bg-up/15" : "bg-down/15"}`}>
                  {t.side === "buy"
                    ? <ArrowUpRight className="w-4 h-4 text-up" />
                    : <ArrowDownRight className="w-4 h-4 text-down" />}
                </div>
                <div className="min-w-0 flex-1">
                  {t.kol
                    ? <KolBadge kol={t.kol} />
                    : <span className="inline-flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-purple-300" />
                        <WalletLink address={t.owner} icon={false} className="text-xs" />
                        <span className="pill bg-purple-500/15 text-purple-300 text-[9px] !px-1.5 !py-0">Whale</span>
                      </span>}
                  <div className="text-xs text-muted mt-0.5">
                    {t.side === "buy" ? "bought" : "sold"} · {compact(t.tokenAmount)} · {fmtUsd(t.volumeUsd ?? t.usdValue, { compact: true })}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted">{t.time ? timeAgo(t.time) + " ago" : "—"}</div>
                  {t.txHash && (
                    <a href={`https://solscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer"
                      className="text-[11px] text-accent/70 hover:text-accent inline-flex items-center gap-0.5">
                      tx <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center text-muted text-sm">No tracked KOL or whale trades found for this token yet.</div>
        )}
      </div>
    </div>
  );
}

function Summary({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
