import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight, Droplets, Flame, ShieldCheck, ShieldAlert,
  Activity, Clock, Sparkles, ChevronRight, ExternalLink,
} from "lucide-react";
import TokenLogo from "./TokenLogo";
import Change from "./Change";
import Verified from "./Verified";
import { Row, SocialItem, Listing, fmtUsd, compact, short } from "../lib/api";

export type FeedLayout = "grid" | "list";

export function tokenAge(r: Row): string {
  if (r.createdAt) {
    const ms = new Date(r.createdAt).getTime();
    if (Number.isFinite(ms)) {
      const d = Math.floor((Date.now() - ms) / 86400000);
      if (d < 1) return "<1d";
      if (d < 30) return `${d}d`;
      return `${Math.floor(d / 30)}mo`;
    }
  }
  if (r.ageDays != null) {
    if (r.ageDays < 1) return "<1d";
    if (r.ageDays < 30) return `${Math.round(r.ageDays)}d`;
    return `${Math.floor(r.ageDays / 30)}mo`;
  }
  return "—";
}

export function organicCls(s: number) {
  if (s >= 70) return "bg-up/15 text-up border-up/30";
  if (s >= 40) return "bg-accent/15 text-accent border-accent/30";
  if (s >= 20) return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  return "bg-down/15 text-down border-down/30";
}

export function computeFeedStats(rows: Row[]) {
  const vol = rows.reduce((s, r) => s + (r.volume || 0), 0);
  const liq = rows.reduce((s, r) => s + (r.liquidity || 0), 0);
  const gainers = rows.filter((r) => (r.change24h || 0) > 0).length;
  const avgCh = rows.length ? rows.reduce((s, r) => s + (r.change24h || 0), 0) / rows.length : 0;
  const holders = rows.reduce((s, r) => s + (r.holderCount || 0), 0);
  return { vol, liq, gainers, avgCh, holders, count: rows.length };
}

function BuySellBar({ buy, sell }: { buy?: number | null; sell?: number | null }) {
  const b = buy || 0, s = sell || 0, t = b + s;
  if (!t) return <span className="text-[10px] text-muted">—</span>;
  const bp = (b / t) * 100;
  return (
    <div className="space-y-1">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-panel2">
        <div className="h-full bg-up transition-all" style={{ width: `${bp}%` }} />
        <div className="h-full bg-down transition-all" style={{ width: `${100 - bp}%` }} />
      </div>
      <div className="flex justify-between text-[9px] tabular-nums">
        <span className="text-up">{Math.round(bp)}% buy</span>
        <span className="text-down">{Math.round(100 - bp)}% sell</span>
      </div>
    </div>
  );
}

function BondingBar({ pct }: { pct?: number | null }) {
  const p = Math.min(100, Math.max(0, pct ?? 0));
  const cls = p >= 80 ? "bg-up" : p >= 50 ? "bg-accent" : p >= 25 ? "bg-yellow-500" : "bg-panel2";
  return (
    <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded-full bg-panel2">
        <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${p}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted tabular-nums">
        <span>Bonding curve</span>
        <span className="font-bold text-white">{p}%</span>
      </div>
    </div>
  );
}

function AuditStrip({ audit }: { audit?: Row["audit"] }) {
  if (!audit) return null;
  const chips: { ok: boolean; label: string }[] = [];
  if (audit.mintAuthorityDisabled != null) chips.push({ ok: audit.mintAuthorityDisabled, label: audit.mintAuthorityDisabled ? "Mint off" : "Mint on" });
  if (audit.freezeAuthorityDisabled != null) chips.push({ ok: audit.freezeAuthorityDisabled, label: audit.freezeAuthorityDisabled ? "Freeze off" : "Freeze on" });
  if (audit.topHoldersPercentage != null) {
    const pct = audit.topHoldersPercentage;
    chips.push({ ok: pct < 35, label: `Top10 ${pct.toFixed(0)}%` });
  }
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span key={c.label} className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${c.ok ? "border-up/30 bg-up/10 text-up" : "border-down/30 bg-down/10 text-down"}`}>
          {c.ok ? <ShieldCheck className="h-2.5 w-2.5" /> : <ShieldAlert className="h-2.5 w-2.5" />}
          {c.label}
        </span>
      ))}
    </div>
  );
}

function ChangeStrip({ r }: { r: Row }) {
  const items = [
    { l: "5m", v: r.change5m },
    { l: "1h", v: r.change1h },
    { l: "24h", v: r.change24h },
  ].filter((x) => x.v != null);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(({ l, v }) => (
        <span key={l} className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tabular-nums border ${(v || 0) >= 0 ? "border-up/25 bg-up/10 text-up" : "border-down/25 bg-down/10 text-down"}`}>
          {l} {(v || 0) >= 0 ? "+" : ""}{(v || 0).toFixed(1)}%
        </span>
      ))}
    </div>
  );
}

function MiniStat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "up" | "down" | "gold" }) {
  const cls = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "gold" ? "text-[var(--ox-gold-hi)]" : "text-white";
  return (
    <div className="rounded-lg border border-line/80 bg-bg/40 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted truncate">{label}</div>
      <div className={`text-sm font-black tabular-nums ${cls}`}>{value}</div>
      {sub != null && <div className="text-[9px] text-muted mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function TokenIdentity({ r, rank, chainLabel }: { r: Row; rank: number; chainLabel?: string }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="relative shrink-0">
        <TokenLogo src={r.icon} sym={r.symbol || ""} size={44} />
        <span className="absolute -top-1 -left-1 grid h-5 w-5 place-items-center rounded-full bg-panel2 border border-line text-[9px] font-bold text-muted">{rank}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-black text-[15px] text-white truncate">{r.symbol || short(r.mint)}</span>
          {r.isVerified && <Verified />}
          {chainLabel && <span className="rounded-md border border-line bg-panel2 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted">{chainLabel}</span>}
          {(r as any).bondingPct != null && <span className="rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent">CURVE</span>}
        </div>
        <div className="text-[11px] text-muted truncate mt-0.5">{r.name && r.name !== r.symbol ? r.name : short(r.mint)}</div>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{tokenAge(r)} old</span>
          {r.organicScoreLabel && <span className="text-accent">· {r.organicScoreLabel}</span>}
        </div>
      </div>
    </div>
  );
}

export function TokenFeedCard({
  r, rank, onClick, isUnbonded, changeVal, chainLabel,
}: {
  r: Row; rank: number; onClick?: () => void; isUnbonded?: boolean; changeVal?: number | null; chainLabel?: string;
}) {
  const buys = r.numBuys ?? 0, sells = r.numSells ?? 0;
  return (
    <article
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-panel/90 via-[#0a0a0a] to-[#060606] p-4 transition-all hover:border-[var(--ox-blue)]/40 hover:shadow-[0_0_24px_rgba(59,130,246,0.08)] ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--ox-blue)]/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      <TokenIdentity r={r} rank={rank} chainLabel={chainLabel} />

      {isUnbonded && (r as any).bondingPct != null && (
        <div className="mt-3"><BondingBar pct={(r as any).bondingPct} /></div>
      )}

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase text-muted">Price</div>
          <div className="text-lg font-black text-white tabular-nums">{r.priceUsd != null ? fmtUsd(r.priceUsd) : "—"}</div>
          {changeVal != null && <Change v={changeVal} className="text-xs mt-0.5" />}
        </div>
        {r.organicScore != null && (
          <span className={`rounded-lg border px-2 py-1 text-[11px] font-black tabular-nums ${organicCls(r.organicScore)}`}>
            {Math.round(r.organicScore)} org
          </span>
        )}
      </div>

      <ChangeStrip r={r} />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MiniStat label="MCap" value={r.mcap != null ? fmtUsd(r.mcap, { compact: true }) : "—"} />
        <MiniStat label="Liquidity" value={r.liquidity != null ? "$" + compact(r.liquidity) : "—"} sub={<span className="inline-flex items-center gap-0.5"><Droplets className="h-2.5 w-2.5" /> depth</span>} />
        <MiniStat label="24h Vol" value={r.volume != null ? "$" + compact(r.volume) : "—"} tone="gold" />
        <MiniStat
          label="Holders"
          value={r.holderCount != null ? compact(r.holderCount) : "—"}
          sub={r.holderChange24h != null ? `${r.holderChange24h >= 0 ? "+" : ""}${compact(r.holderChange24h)} 24h` : undefined}
          tone={r.holderChange24h != null ? (r.holderChange24h >= 0 ? "up" : "down") : undefined}
        />
        <MiniStat label="Traders" value={r.numTraders != null ? compact(r.numTraders) : "—"} sub={r.numOrganicBuyers != null ? `${compact(r.numOrganicBuyers)} organic` : undefined} />
        <MiniStat label="Txns" value={buys + sells > 0 ? compact(buys + sells) : "—"} sub={buys || sells ? `${compact(buys)}B / ${compact(sells)}S` : undefined} />
      </div>

      {(r.buyVolume || r.sellVolume) && (
        <div className="mt-3">
          <div className="mb-1 flex items-center gap-1 text-[9px] uppercase text-muted"><Activity className="h-3 w-3" /> Buy / sell flow</div>
          <BuySellBar buy={r.buyVolume} sell={r.sellVolume} />
        </div>
      )}

      <div className="mt-3"><AuditStrip audit={r.audit} /></div>

      {r.tags && r.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {r.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded-full bg-panel2 px-2 py-0.5 text-[9px] text-muted">{t}</span>
          ))}
        </div>
      )}

      {onClick && (
        <div className="mt-3 flex items-center justify-end text-[11px] font-bold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          Open terminal <ChevronRight className="h-3.5 w-3.5" />
        </div>
      )}
    </article>
  );
}

export function TokenFeedList({
  rows, onRowClick, isUnbonded, changeKey, isMultichain,
}: {
  rows: Row[];
  onRowClick: (r: Row) => void;
  isUnbonded?: boolean;
  changeKey: (r: Row) => number | null | undefined;
  isMultichain?: boolean;
}) {
  return (
    <div className="dex-panel !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="dex-token-table" style={{ minWidth: isUnbonded ? 920 : 1100 }}>
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Token</th>
              {isUnbonded ? (
                <>
                  <th>MCap</th>
                  <th className="min-w-[140px]">Bonding</th>
                  <th>Holders</th>
                  <th>Vol</th>
                  <th>Txns</th>
                </>
              ) : (
                <>
                  <th>Price</th>
                  <th>5m</th>
                  <th>1h</th>
                  <th>24h</th>
                  <th>MCap</th>
                  <th>Liq</th>
                  <th>Vol</th>
                  <th>Flow</th>
                  <th>Holders</th>
                  {!isMultichain && <th>Organic</th>}
                  <th>Age</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isExternal = r.chain && r.chain !== "solana";
              const chainLabel = isMultichain && r.chain ? r.chain.replace("_pos", "").replace("-network", "") : undefined;
              return (
                <tr
                  key={(r.mint || (r as any).poolAddress || i) + i}
                  onClick={() => !isExternal && onRowClick(r)}
                  className={`dex-token-row ${isExternal ? "cursor-default opacity-80" : ""}`}
                >
                  <td className="text-muted text-xs">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2.5 min-w-[180px]">
                      <TokenLogo src={r.icon} sym={r.symbol || ""} size={32} />
                      <div className="min-w-0">
                        <div className="font-bold truncate flex items-center gap-1">
                          {r.symbol || short(r.mint)}
                          {r.isVerified && <Verified />}
                          {chainLabel && <span className="pill bg-panel2 text-muted text-[8px] uppercase">{chainLabel}</span>}
                        </div>
                        <div className="text-[10px] text-muted truncate">{r.name || short(r.mint)}</div>
                      </div>
                    </div>
                  </td>
                  {isUnbonded ? (
                    <>
                      <td className="tabular-nums">{r.mcap != null ? fmtUsd(r.mcap, { compact: true }) : "—"}</td>
                      <td><BondingBar pct={(r as any).bondingPct} /></td>
                      <td className="tabular-nums">{r.holderCount != null ? compact(r.holderCount) : "—"}</td>
                      <td className="tabular-nums">{r.volume != null ? "$" + compact(r.volume) : "—"}</td>
                      <td className="tabular-nums text-[11px] text-muted">
                        {(r.numBuys || r.numSells) ? `${compact(r.numBuys || 0)}B/${compact(r.numSells || 0)}S` : "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <div className="font-semibold tabular-nums">{r.priceUsd != null ? fmtUsd(r.priceUsd) : "—"}</div>
                        <Change v={changeKey(r)} className="text-[10px]" />
                      </td>
                      <td><Change v={r.change5m} className="text-[10px]" /></td>
                      <td><Change v={r.change1h} className="text-[10px]" /></td>
                      <td><Change v={r.change24h} className="text-[10px]" /></td>
                      <td className="tabular-nums">{r.mcap != null ? fmtUsd(r.mcap, { compact: true }) : "—"}</td>
                      <td className="tabular-nums text-muted">{r.liquidity != null ? "$" + compact(r.liquidity) : "—"}</td>
                      <td className="tabular-nums">{r.volume != null ? "$" + compact(r.volume) : "—"}</td>
                      <td className="min-w-[100px]"><BuySellBar buy={r.buyVolume} sell={r.sellVolume} /></td>
                      <td className="tabular-nums">
                        <div>{r.holderCount != null ? compact(r.holderCount) : "—"}</div>
                        {r.holderChange24h != null && (
                          <span className={`text-[10px] ${r.holderChange24h >= 0 ? "text-up" : "text-down"}`}>
                            {r.holderChange24h >= 0 ? "+" : ""}{compact(r.holderChange24h)}
                          </span>
                        )}
                      </td>
                      {!isMultichain && (
                        <td>
                          {r.organicScore != null
                            ? <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${organicCls(r.organicScore)}`}>{Math.round(r.organicScore)}</span>
                            : "—"}
                        </td>
                      )}
                      <td className="text-[11px] text-muted whitespace-nowrap">{tokenAge(r)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TokenFeedGrid({
  rows, layout, isUnbonded, changeKey, isMultichain, onRowClick,
}: {
  rows: Row[];
  layout: FeedLayout;
  isUnbonded?: boolean;
  changeKey: (r: Row) => number | null | undefined;
  isMultichain?: boolean;
  onRowClick: (r: Row) => void;
}) {
  if (layout === "list") {
    return <TokenFeedList rows={rows} onRowClick={onRowClick} isUnbonded={isUnbonded} changeKey={changeKey} isMultichain={isMultichain} />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((r, i) => {
        const isExternal = r.chain && r.chain !== "solana";
        const chainLabel = isMultichain && r.chain ? r.chain.replace("_pos", "").replace("-network", "") : undefined;
        return (
          <TokenFeedCard
            key={(r.mint || (r as any).poolAddress || i) + i}
            r={r}
            rank={i + 1}
            isUnbonded={isUnbonded}
            changeVal={changeKey(r)}
            chainLabel={chainLabel}
            onClick={!isExternal ? () => onRowClick(r) : undefined}
          />
        );
      })}
    </div>
  );
}

export function SocialFeedPro({ items, loading }: { items: SocialItem[]; loading: boolean }) {
  const nav = useNavigate();
  if (loading && !items.length) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-panel/50 p-4 animate-pulse h-40" />
        ))}
      </div>
    );
  }
  if (!items.length) return <div className="dex-panel p-12 text-center text-muted">No trending data available right now.</div>;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item, i) => {
        const canNav = item.chain === "solana" && item.mint;
        return (
          <article
            key={(item.mint || item.symbol || i) + i}
            onClick={() => canNav && item.mint && nav(`/token/${item.mint}`)}
            className={`rounded-2xl border border-line bg-gradient-to-br from-panel/80 to-[#080808] p-4 transition hover:border-accent/35 ${canNav ? "cursor-pointer" : ""}`}
          >
            <div className="flex gap-3">
              <TokenLogo src={item.icon} sym={item.symbol || "?"} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-base">{item.symbol || short(item.mint || "?")}</span>
                  {item.name && item.name !== item.symbol && <span className="text-muted text-xs truncate">{item.name}</span>}
                  <span className={`ml-auto rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${item.source === "coingecko" ? "bg-green-500/15 text-green-400" : item.source === "jupiter" ? "bg-up/15 text-up" : "bg-accent/15 text-accent"}`}>
                    {item.source}
                  </span>
                </div>
                {item.aiSummary && (
                  <div className="mt-2 flex gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2">
                    <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <p className="text-[12px] leading-snug text-white/90">{item.aiSummary}</p>
                  </div>
                )}
                {item.reasons?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.reasons.slice(0, 4).map((r, j) => (
                      <span key={j} className="rounded-full bg-panel2 px-2 py-0.5 text-[10px] text-muted">{r}</span>
                    ))}
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {item.priceUsd != null && <MiniStat label="Price" value={fmtUsd(item.priceUsd)} />}
                  {item.mcap != null && <MiniStat label="MCap" value={"$" + compact(item.mcap)} />}
                  {item.volume != null && <MiniStat label="Vol" value={"$" + compact(item.volume)} tone="gold" />}
                  {item.liquidity != null && <MiniStat label="Liq" value={"$" + compact(item.liquidity)} />}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  {item.change1h != null && <span className="text-[10px] text-muted">1h <Change v={item.change1h} className="inline text-[10px]" /></span>}
                  {item.change24h != null && <span className="text-[10px] text-muted">24h <Change v={item.change24h} className="inline text-[10px]" /></span>}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ml-auto text-muted hover:text-white">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ListedFeedPro({ listings, loading }: { listings: Listing[]; loading: boolean }) {
  if (loading) return <div className="dex-panel grid place-items-center py-20"><Flame className="w-6 h-6 animate-spin text-accent" /></div>;
  if (!listings.length) {
    return (
      <div className="dex-panel p-10 text-center">
        <p className="text-muted mb-3">No community listings yet.</p>
        <Link to="/submit" className="dex-btn dex-btn--blue inline-flex">List your token →</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((a) => {
        const inner = (
          <article className="group h-full rounded-2xl border border-line bg-panel/60 p-4 transition hover:border-[var(--ox-gold)]/40">
            <div className="flex gap-3">
              {a.logo_url
                ? <img src={a.logo_url} alt="" className="h-12 w-12 rounded-xl object-cover border border-line shrink-0" />
                : <div className="grid h-12 w-12 place-items-center rounded-xl bg-panel2 text-xs font-bold text-muted shrink-0">{(a.symbol || "?").slice(0, 3)}</div>}
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate flex items-center gap-1.5">
                  {a.project_name || a.symbol}
                  <Verified />
                  <span className="rounded-md bg-panel2 px-1.5 py-0.5 text-[9px] uppercase text-muted">{a.chain}</span>
                  {a.featured && <span className="rounded-md bg-accent2/20 px-1.5 py-0.5 text-[9px] text-accent2">FEATURED</span>}
                </div>
                <p className="text-[11px] text-muted line-clamp-2 mt-1">{a.description || short(a.contract_address)}</p>
                {a.metadata?.mcap && <div className="mt-2 text-sm font-black text-[var(--ox-gold-hi)]">MC {fmtUsd(a.metadata.mcap, { compact: true })}</div>}
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-accent opacity-0 group-hover:opacity-100 transition">
                  View listing <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          </article>
        );
        return a.chain === "solana"
          ? <Link key={a.id} to={`/token/${a.contract_address}`}>{inner}</Link>
          : <a key={a.id} href={a.links?.website || `https://dexscreener.com/search?q=${a.contract_address}`} target="_blank" rel="noreferrer">{inner}</a>;
      })}
    </div>
  );
}

export function FeedSkeleton({ layout, count = 9 }: { layout: FeedLayout; count?: number }) {
  if (layout === "list") {
    return (
      <div className="dex-panel !p-0 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-14 border-b border-line/50 animate-pulse bg-panel2/30" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-panel/40 p-4 animate-pulse h-52" />
      ))}
    </div>
  );
}
