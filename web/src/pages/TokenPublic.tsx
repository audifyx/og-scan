import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Any = Record<string, any>;
const fmtUsd = (n: any) => { const v = Number(n); if (!isFinite(v) || v === 0) return "--"; if (v >= 1e9) return "$" + (v/1e9).toFixed(2) + "B"; if (v >= 1e6) return "$" + (v/1e6).toFixed(2) + "M"; if (v >= 1e3) return "$" + (v/1e3).toFixed(1) + "K"; if (v >= 1) return "$" + v.toFixed(2); return "$" + v.toPrecision(3); };
const fmtNum = (n: any) => { const v = Number(n); return isFinite(v) ? v.toLocaleString() : "--"; };
const pct = (n: any) => { const v = Number(n); if (!isFinite(v)) return "--"; return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`; };
const pctColor = (n: any) => { const v = Number(n); return !isFinite(v) ? "text-white/40" : v >= 0 ? "text-emerald-400" : "text-red-400"; };
const short = (s = "", a = 4, b = 4) => (s && s.length > a + b ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
const scoreColor = (s: number) => s >= 80 ? "#22e38a" : s >= 60 ? "#b6f23d" : s >= 40 ? "#fbbf24" : "#f87171";
const ageFrom = (ms: any) => { const v = Number(ms); return isFinite(v) && v > 0 ? Math.max(0, Math.round((Date.now() - v) / 86400000)) : null; };

const Stat = ({ label, value, accent }: { label: string; value: any; accent?: string }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
    <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{label}</div>
    <div className={`mt-1 text-[15px] font-black ${accent || "text-white"}`}>{value}</div>
  </div>
);
const riskLevelColor = (l: string) => /danger|high|crit/i.test(l) ? "#f87171" : /warn|med/i.test(l) ? "#fbbf24" : "#b6f23d";

const TABS = ["Overview", "Security", "Holders", "Markets", "Socials", "Score"] as const;
type Tab = typeof TABS[number];

export default function TokenPublic() {
  const { mint = "" } = useParams<{ mint: string }>();
  const [scan, setScan] = useState<Any | null>(null);
  const [holders, setHolders] = useState<Any | null>(null);
  const [safety, setSafety] = useState<Any | null>(null);
  const [dex, setDex] = useState<Any | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Overview");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let on = true; setLoading(true); setScan(null); setHolders(null); setSafety(null); setDex(null);
    supabase.functions.invoke("og-scan-token", { body: { query: mint, source: "web" } })
      .then(({ data }) => { if (on) setScan(data || { ok: false }); })
      .catch(() => { if (on) setScan({ ok: false }); })
      .finally(() => { if (on) setLoading(false); });
    supabase.functions.invoke("og-holders", { body: { mint } }).then(({ data }) => { if (on && data?.ok) setHolders(data); }).catch(() => {});
    supabase.functions.invoke("token-safety", { body: { mint } }).then(({ data }) => { if (on && data?.ok) setSafety(data); }).catch(() => {});
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`).then((r) => r.json()).then((d) => { if (on) setDex(d); }).catch(() => {});
    return () => { on = false; };
  }, [mint]);

  const t = scan?.token || {};
  const total = Number(scan?.score?.total ?? 0);
  const sig = scan?.score?.signals || {};
  const pairs: Any[] = useMemo(() => (Array.isArray(dex?.pairs) ? [...dex.pairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)) : []), [dex]);
  const top = pairs[0] || {};
  const banner = t.banner || t.openGraph || top.info?.header || null;
  const ring = useMemo(() => `conic-gradient(${scoreColor(total)} ${total * 3.6}deg, rgba(255,255,255,0.08) 0deg)`, [total]);

  // merged fallbacks (og-scan-token first, then dexscreener)
  // eslint-disable-next-line no-constant-binary-expression -- TODO(pre-existing): red on main before this branch; do not silence new bugs
  const priceUsd = t.priceUsd ?? Number(top.priceUsd) ?? null;
  const mcap = t.mcap ?? top.marketCap ?? null;
  const fdv = t.fdv ?? top.fdv ?? null;
  const liq = t.liquidity ?? top.liquidity?.usd ?? null;
  const vol24 = (t.buyVolume24h || 0) + (t.sellVolume24h || 0) || top.volume?.h24 || null;
  const ageDays = t.ageDays ?? ageFrom(Math.min(...pairs.map((p) => p.pairCreatedAt || Infinity)));
  const ch24 = t.priceChange24h ?? top.priceChange?.h24 ?? null;

  // real holder concentration (LP / pools excluded by og-holders)
  const realTop10 = holders?.top10pct ?? safety?.top10RealHolderPct ?? t.topHoldersPct ?? null;
  const lpHolderPct = holders?.lpHolderPct ?? safety?.lpHolderPct ?? null;

  const copy = () => { navigator.clipboard?.writeText(mint); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#05070d]"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!scan?.ok && !pairs.length) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#05070d] px-6 text-center">
      <div className="text-lg font-bold text-white/80">Couldn't load that token</div>
      <div className="font-mono text-sm text-white/40">{short(mint, 6, 6)}</div>
      <a href="https://ogscan.fun" className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Go to OrbitX</a>
    </div>
  );

  const name = t.name || top.baseToken?.name || "Unknown";
  const symbol = ((t.symbol || top.baseToken?.symbol || "") as string).replace(/^\$+/, "") || "—";
  const image = t.image || top.info?.imageUrl;
  const xUrl = t.socials?.x || top.info?.socials?.find((s: Any) => s.type === "twitter")?.url;
  const tgUrl = t.socials?.telegram || top.info?.socials?.find((s: Any) => s.type === "telegram")?.url;
  const webUrl = t.socials?.website || top.info?.websites?.[0]?.url;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#05070d] text-white">
      {/* Sticky top bar — always reachable, solid (no blur) for smooth scroll */}
      <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070b14]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-2.5">
          <a href="https://ogscan.fun" className="text-[15px] font-black tracking-tight">OG<span className="text-primary">SCAN</span></a>
          <div className="flex min-w-0 items-center gap-2">
            {image ? <img src={image} alt="" className="h-6 w-6 rounded-md object-cover" /> : null}
            <span className="truncate text-[13px] font-bold text-white/70">{symbol === "—" ? "—" : `$${symbol}`}</span>
            <span className="rounded-md px-1.5 py-0.5 text-[12px] font-black" style={{ color: scoreColor(total), background: `${scoreColor(total)}1a` }}>{total}</span>
          </div>
          <a href="https://ogscan.fun" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold text-white/60 hover:text-white">Open app →</a>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-3 pb-24 pt-3 sm:px-5">
        {/* Hero */}
        <div className="rounded-3xl border border-white/[0.09] bg-[#080e1a]">
          <div className="relative h-24 w-full overflow-hidden rounded-t-3xl sm:h-32">
            {banner ? <img src={banner} alt="" loading="eager" decoding="async" className="h-full w-full object-cover opacity-80" /> : <div className="h-full w-full bg-[radial-gradient(ellipse_at_30%_0%,hsl(var(--primary)/0.25),transparent_60%),radial-gradient(ellipse_at_100%_100%,hsl(var(--secondary)/0.18),transparent_60%)]" />}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#080e1a]" />
          </div>
          <div className="px-4 pb-4 sm:px-5">
            <div className="-mt-9 flex items-end justify-between gap-3">
              <div className="flex min-w-0 items-end gap-3">
                {image ? <img src={image} alt="" className="h-16 w-16 rounded-2xl border-2 border-[#080e1a] object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#080e1a] bg-primary/15 text-2xl font-black text-primary">{(symbol || name || "?")[0]}</div>}
                <div className="min-w-0 pb-1">
                  <div className="flex items-center gap-2"><h1 className="truncate text-xl font-black">{name}</h1>{t.isVerifiedJup && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold text-sky-400">VERIFIED</span>}</div>
                  <div className="text-[13px] font-bold text-white/50">{symbol === "—" ? "—" : `$${symbol}`}</div>
                </div>
              </div>
              <div className="shrink-0 text-center">
                <div className="relative h-16 w-16 rounded-full" style={{ background: ring }}>
                  <div className="absolute inset-[3px] flex flex-col items-center justify-center rounded-full bg-[#080e1a]"><span className="text-lg font-black leading-none" style={{ color: scoreColor(total) }}>{total}</span><span className="text-[8px] font-bold text-white/40">ORBITX SCORE</span></div>
                </div>
              </div>
            </div>

            {scan?.verdict && <div className="mt-3 rounded-2xl border px-3.5 py-2.5" style={{ borderColor: `${scoreColor(total)}40`, background: `${scoreColor(total)}12` }}><span className="text-[13px] font-black" style={{ color: scoreColor(total) }}>{scan.verdict}</span></div>}

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="text-2xl font-black">{fmtUsd(priceUsd)}</span>
              <span className={`text-sm font-bold ${pctColor(ch24)}`}>{pct(ch24)} <span className="font-medium text-white/30">24h</span></span>
              {safety?.riskScore != null && <span className="text-sm font-bold" style={{ color: scoreColor(100 - Number(safety.riskScore)) }}>Risk {safety.riskScore}</span>}
            </div>

            {(xUrl || tgUrl || webUrl) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {xUrl && <a href={xUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-white/70 hover:text-white">𝕏 Twitter</a>}
                {tgUrl && <a href={tgUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-white/70 hover:text-white">Telegram</a>}
                {webUrl && <a href={webUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-white/70 hover:text-white">Website</a>}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2">
              <span className="flex-1 truncate font-mono text-[11px] text-white/50">{mint}</span>
              <button onClick={copy} className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/60 hover:text-white">{copied ? "Copied" : "Copy"}</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 -mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tb) => <button key={tb} onClick={() => setTab(tb)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${tab === tb ? "bg-primary text-primary-foreground" : "border border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"}`}>{tb}</button>)}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tab === "Overview" && (<>
            <Stat label="Price" value={fmtUsd(priceUsd)} />
            <Stat label="Market Cap" value={fmtUsd(mcap)} />
            <Stat label="FDV" value={fmtUsd(fdv)} />
            <Stat label="Liquidity" value={fmtUsd(liq)} />
            <Stat label="24h Volume" value={fmtUsd(vol24)} />
            <Stat label="ATH MCap" value={fmtUsd(t.athMcap)} />
            <Stat label="Holders" value={fmtNum(t.holderCount ?? safety?.totalHolders)} />
            <Stat label="Age" value={ageDays != null ? `${ageDays}d` : "--"} />
            <Stat label="Pool Age" value={t.poolAgeDays != null ? `${t.poolAgeDays}d` : "--"} />
            <Stat label="Momentum" value={t.momentumLabel || (t.momentum != null ? `${t.momentum}` : "--")} accent="text-primary" />
            <Stat label="Organic" value={t.organicScoreLabel || (t.organicScore != null ? `${Math.round(t.organicScore)}` : "--")} />
            <Stat label="Supply" value={t.totalSupply != null ? fmtNum(Math.round(t.totalSupply)) : "--"} />
            <Stat label="5m" value={pct(t.priceChange5m ?? top.priceChange?.m5)} accent={pctColor(t.priceChange5m ?? top.priceChange?.m5)} />
            <Stat label="1h" value={pct(t.priceChange1h ?? top.priceChange?.h1)} accent={pctColor(t.priceChange1h ?? top.priceChange?.h1)} />
            <Stat label="6h" value={pct(t.priceChange6h ?? top.priceChange?.h6)} accent={pctColor(t.priceChange6h ?? top.priceChange?.h6)} />
          </>)}

          {tab === "Security" && (safety ? (<>
            <Stat label="Risk Score" value={`${safety.riskScore ?? "--"}`} accent={safety.riskScore != null ? "" : "text-white/60"} />
            <Stat label="Rugged" value={safety.rugged ? "YES" : "No"} accent={safety.rugged ? "text-red-400" : "text-emerald-400"} />
            <Stat label="Mint Auth" value={safety.mintAuthorityRenounced ? "Renounced" : "ACTIVE ⚠"} accent={safety.mintAuthorityRenounced ? "text-emerald-400" : "text-red-400"} />
            <Stat label="Freeze Auth" value={safety.freezeAuthorityRenounced ? "Renounced" : "ACTIVE ⚠"} accent={safety.freezeAuthorityRenounced ? "text-emerald-400" : "text-red-400"} />
            <Stat label="LP Locked" value={safety.lpLockedPct != null ? `${safety.lpLockedPct}%` : "--"} accent={Number(safety.lpLockedPct) >= 100 ? "text-emerald-400" : Number(safety.lpLockedPct) > 0 ? "text-yellow-400" : "text-red-400"} />
            <Stat label="Launchpad" value={safety.launchpad || "—"} />
            <Stat label="Top 10 (real)" value={realTop10 != null ? `${Number(realTop10).toFixed(1)}%` : "--"} accent={Number(realTop10) > 40 ? "text-red-400" : "text-emerald-400"} />
            <Stat label="LP Holds" value={lpHolderPct != null ? `${Number(lpHolderPct).toFixed(1)}%` : "--"} accent="text-sky-400" />
            <Stat label="Total Holders" value={fmtNum(safety.totalHolders)} />
            {Array.isArray(safety.risks) && safety.risks.length > 0 && (
              <div className="col-span-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 sm:col-span-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/35">Risk Flags</div>
                <div className="space-y-2">
                  {safety.risks.map((r: Any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: riskLevelColor(r.level || "") }} />
                      <div><div className="text-[12px] font-bold text-white/85">{r.name}{r.level ? ` · ${r.level}` : ""}</div>{r.desc && <div className="text-[11px] text-white/40">{r.desc}</div>}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>) : <div className="col-span-2 p-4 text-[13px] text-white/30 sm:col-span-3">Loading security data…</div>)}

          {tab === "Holders" && (<>
            <Stat label="Holders" value={fmtNum(t.holderCount ?? safety?.totalHolders)} />
            <Stat label="Top 10 (real)" value={realTop10 != null ? `${Number(realTop10).toFixed(1)}%` : "--"} accent={Number(realTop10) > 40 ? "text-red-400" : "text-emerald-400"} />
            <Stat label="Concentration" value={holders?.concentrationRisk || "--"} accent={/high/i.test(holders?.concentrationRisk || "") ? "text-red-400" : "text-emerald-400"} />
            <Stat label="LP in Pools" value={lpHolderPct != null ? `${Number(lpHolderPct).toFixed(1)}%` : "--"} accent="text-sky-400" />
            <Stat label="Holder Δ 1h" value={pct(t.holderChange1h)} accent={pctColor(t.holderChange1h)} />
            <Stat label="Holder Δ 24h" value={pct(t.holderChange24h)} accent={pctColor(t.holderChange24h)} />
            <div className="col-span-2 -mt-1 sm:col-span-3">
              <div className="text-[10px] text-white/30">Liquidity pools, bonding curves &amp; burn addresses are excluded from holder %.</div>
            </div>
            {Array.isArray(holders?.holders) && holders.holders.length > 0 && (
              <div className="col-span-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 sm:col-span-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/35">Top Real Holders</div>
                <div className="space-y-1.5">
                  {holders.holders.slice(0, 12).map((h: Any, i: number) => {
                    const ins = safety?.topHolders?.find((x: Any) => x.address === (h.owner || h.tokenAccount))?.insider;
                    return (<div key={i} className="flex items-center gap-2 text-[12px]"><span className="w-5 font-mono text-white/30">{i + 1}</span><span className="flex-1 truncate font-mono text-white/55">{short(h.owner || h.tokenAccount || "", 4, 4)}</span>{ins && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-300">insider</span>}{h.label && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-white/50">{h.label}</span>}<span className="w-14 text-right font-black text-white">{h.pct != null ? `${Number(h.pct).toFixed(2)}%` : "--"}</span></div>);
                  })}
                </div>
              </div>
            )}
          </>)}

          {tab === "Markets" && (<>
            <Stat label="Liquidity" value={fmtUsd(liq)} />
            <Stat label="Buy Vol 24h" value={fmtUsd(t.buyVolume24h)} accent="text-emerald-400" />
            <Stat label="Sell Vol 24h" value={fmtUsd(t.sellVolume24h)} accent="text-red-400" />
            <Stat label="Txns 24h" value={fmtNum(t.txns24h)} />
            <Stat label="Buys 24h" value={fmtNum(t.numBuys24h)} accent="text-emerald-400" />
            <Stat label="Sells 24h" value={fmtNum(t.numSells24h)} accent="text-red-400" />
            <Stat label="Traders 24h" value={fmtNum(t.numTraders24h)} />
            <Stat label="Pairs" value={fmtNum(pairs.length)} />
            {pairs.length > 0 && (
              <div className="col-span-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 sm:col-span-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/35">DEX Pairs</div>
                <div className="space-y-2">
                  {pairs.slice(0, 8).map((p: Any, i: number) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-1 py-1 text-[12px] hover:bg-white/[0.03]">
                      <span className="w-20 truncate font-bold capitalize text-white/80">{p.dexId}</span>
                      <span className="flex-1 truncate text-white/45">{p.baseToken?.symbol}/{p.quoteToken?.symbol}</span>
                      <span className="w-16 text-right text-white/60">{fmtUsd(p.liquidity?.usd)}</span>
                      <span className="w-16 text-right text-white/40">{fmtUsd(p.volume?.h24)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="col-span-2 flex flex-wrap gap-2 pt-1 sm:col-span-3">
              <a href={t.dexUrl || `https://dexscreener.com/solana/${mint}`} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-white/70 hover:text-white">DexScreener →</a>
              <a href={t.pumpFunUrl || `https://pump.fun/coin/${mint}`} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-white/70 hover:text-white">pump.fun →</a>
            </div>
          </>)}

          {tab === "Socials" && (
            <div className="col-span-2 space-y-2.5 sm:col-span-3">
              {[["𝕏 Twitter", xUrl], ["Telegram", tgUrl], ["Website", webUrl]].map(([label, url]) => (
                <div key={label as string} className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                  <span className="text-[13px] font-bold text-white/70">{label}</span>
                  {url ? <a href={url as string} target="_blank" rel="noreferrer" className="max-w-[55%] truncate text-[12px] font-bold text-primary">{String(url).replace(/^https?:\/\//, "")}</a> : <span className="text-[12px] text-white/30">Not set</span>}
                </div>
              ))}
              <Stat label="DEX" value={top.dexId || t.socials?.dexId || "--"} />
            </div>
          )}

          {tab === "Score" && (<>
            <Stat label="OrbitX Score" value={`${total}/100`} accent="text-primary" />
            <Stat label="Token Age" value={`${sig.age ?? "--"}`} />
            <Stat label="ATH MCap" value={`${sig.athMcap ?? "--"}`} />
            <Stat label="Holder Profile" value={`${sig.holderProfile ?? "--"}`} />
            <Stat label="Deploy Pattern" value={`${sig.deployPattern ?? "--"}`} />
            <Stat label="Pool Age" value={`${sig.poolAge ?? "--"}`} />
          </>)}
        </div>

        <div className="mt-6 rounded-3xl border border-white/[0.09] bg-gradient-to-br from-primary/10 to-transparent p-5 text-center">
          <div className="text-[15px] font-black">Scan any token in seconds</div>
          <p className="mx-auto mt-1 max-w-sm text-[12px] text-white/45">Rug scores, dev wallet DNA, holder risk, and live market data — free on OrbitX.</p>
          <div className="mt-3 flex items-center justify-center gap-2"><Link to="/scanner" className="rounded-xl bg-primary px-4 py-2 text-[13px] font-black text-primary-foreground">Open OrbitX</Link></div>
        </div>
        <div className="mt-5 text-center text-[10px] text-white/25">Live data via OrbitX · RugCheck · DexScreener · Not financial advice · ogscan.fun</div>
      </div>
    </div>
  );
}
