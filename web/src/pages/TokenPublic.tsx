import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Tok = Record<string, any>;
type Scan = { ok: boolean; token?: Tok; score?: any; flags?: any; verdict?: string; error?: string };

const fmtUsd = (n: any) => {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "--";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  if (v >= 1) return "$" + v.toFixed(2);
  return "$" + v.toPrecision(3);
};
const fmtNum = (n: any) => { const v = Number(n); return isFinite(v) ? v.toLocaleString() : "--"; };
const pct = (n: any) => { const v = Number(n); if (!isFinite(v)) return "--"; return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`; };
const pctColor = (n: any) => { const v = Number(n); return !isFinite(v) ? "text-white/40" : v >= 0 ? "text-emerald-400" : "text-red-400"; };
const short = (s = "", a = 4, b = 4) => (s.length > a + b ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
const scoreColor = (s: number) => s >= 80 ? "#22e38a" : s >= 60 ? "#b6f23d" : s >= 40 ? "#fbbf24" : "#f87171";

const Stat = ({ label, value, accent }: { label: string; value: any; accent?: string }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
    <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{label}</div>
    <div className={`mt-1 text-[15px] font-black ${accent || "text-white"}`}>{value}</div>
  </div>
);

const TABS = ["Overview", "Holders", "Dev / Origin", "Markets", "Score"] as const;
type Tab = typeof TABS[number];

export default function TokenPublic() {
  const { mint = "" } = useParams<{ mint: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Overview");
  const [holders, setHolders] = useState<any>(null);

  useEffect(() => {
    let on = true;
    setLoading(true); setScan(null);
    supabase.functions
      .invoke("og-scan-token", { body: { query: mint, source: "web" } })
      .then(({ data }) => { if (on) setScan((data as Scan) || { ok: false, error: "No data" }); })
      .catch(() => { if (on) setScan({ ok: false, error: "Scan failed" }); })
      .finally(() => { if (on) setLoading(false); });
    supabase.functions.invoke("og-holders", { body: { mint } })
      .then(({ data }) => { if (on && data?.ok) setHolders(data); })
      .catch(() => {});
    return () => { on = false; };
  }, [mint]);

  const t = scan?.token;
  const total = Number(scan?.score?.total ?? 0);
  const sig = scan?.score?.signals || {};
  const flags = scan?.flags || {};
  const banner = t?.banner || t?.openGraph || null;
  const ring = useMemo(() => `conic-gradient(${scoreColor(total)} ${total * 3.6}deg, rgba(255,255,255,0.08) 0deg)`, [total]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!scan?.ok || !t) {
    return (
      <div className="min-h-screen bg-[#05070d] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-white/80 text-lg font-bold">Couldn't load that token</div>
        <div className="text-white/40 text-sm font-mono">{short(mint, 6, 6)}</div>
        <div className="text-white/30 text-xs">{scan?.error || "Try again later."}</div>
        <a href="https://ogscan.fun" className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Go to OG Scan</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="mx-auto max-w-3xl px-3 pb-20 sm:px-5">

        {/* Top bar */}
        <div className="flex items-center justify-between py-4">
          <a href="https://ogscan.fun" className="flex items-center gap-2">
            <span className="text-[15px] font-black tracking-tight">OG<span className="text-primary">SCAN</span></span>
          </a>
          <a href="https://ogscan.fun" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold text-white/60 hover:text-white">Open app →</a>
        </div>

        {/* Hero card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.09] bg-[#080e1a]">
          <div className="h-28 w-full overflow-hidden sm:h-36">
            {banner ? (
              <img src={banner} alt="" className="h-full w-full object-cover opacity-80" />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(ellipse_at_30%_0%,hsl(var(--primary)/0.25),transparent_60%),radial-gradient(ellipse_at_100%_100%,hsl(var(--secondary)/0.18),transparent_60%)]" />
            )}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent to-[#080e1a] sm:h-36" />
          </div>

          <div className="relative -mt-10 px-4 pb-4 sm:px-5">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-end gap-3 min-w-0">
                {t.image ? (
                  <img src={t.image} alt="" className="h-16 w-16 rounded-2xl border-2 border-[#080e1a] object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#080e1a] bg-primary/15 text-2xl font-black text-primary">
                    {(t.symbol || t.name || "?")[0]}
                  </div>
                )}
                <div className="min-w-0 pb-1">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-xl font-black">{t.name || t.symbol || "Unknown"}</h1>
                    {t.isVerifiedJup && <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold text-sky-400">VERIFIED</span>}
                  </div>
                  <div className="text-[13px] font-bold text-white/50">${t.symbol || "—"}</div>
                </div>
              </div>
              {/* score ring */}
              <div className="shrink-0 text-center">
                <div className="relative h-16 w-16 rounded-full" style={{ background: ring }}>
                  <div className="absolute inset-[3px] flex flex-col items-center justify-center rounded-full bg-[#080e1a]">
                    <span className="text-lg font-black leading-none" style={{ color: scoreColor(total) }}>{total}</span>
                    <span className="text-[8px] font-bold text-white/40">OG SCORE</span>
                  </div>
                </div>
              </div>
            </div>

            {/* verdict */}
            <div className="mt-3 rounded-2xl border px-3.5 py-2.5"
              style={{ borderColor: `${scoreColor(total)}40`, background: `${scoreColor(total)}12` }}>
              <span className="text-[13px] font-black" style={{ color: scoreColor(total) }}>{scan.verdict}</span>
            </div>

            {/* socials */}
            {(t.socials?.x || t.socials?.telegram || t.socials?.website) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {t.socials?.x && <a href={t.socials.x} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-white/70 hover:text-white">𝕏 Twitter</a>}
                {t.socials?.telegram && <a href={t.socials.telegram} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-white/70 hover:text-white">Telegram</a>}
                {t.socials?.website && <a href={t.socials.website} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-bold text-white/70 hover:text-white">Website</a>}
              </div>
            )}

            {/* price row */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
              <div><span className="text-2xl font-black">{fmtUsd(t.priceUsd)}</span></div>
              <div className={`text-sm font-bold ${pctColor(t.priceChange24h)}`}>{pct(t.priceChange24h)} <span className="text-white/30 font-medium">24h</span></div>
            </div>

            {/* CA */}
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2">
              <span className="font-mono text-[11px] text-white/50 truncate flex-1">{mint}</span>
              <button onClick={() => navigator.clipboard?.writeText(mint)} className="rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/60 hover:text-white">Copy</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {TABS.map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${tab === tb ? "bg-primary text-primary-foreground" : "border border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"}`}>
              {tb}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tab === "Overview" && (<>
            <Stat label="Market Cap" value={fmtUsd(t.mcap)} />
            <Stat label="Liquidity" value={fmtUsd(t.liquidity)} />
            <Stat label="FDV" value={fmtUsd(t.fdv)} />
            <Stat label="Holders" value={fmtNum(t.holderCount)} />
            <Stat label="ATH MCap" value={fmtUsd(t.athMcap)} />
            <Stat label="24h Volume" value={fmtUsd((t.buyVolume24h || 0) + (t.sellVolume24h || 0))} />
            <Stat label="Age" value={t.ageDays != null ? `${t.ageDays}d` : "--"} />
            <Stat label="Momentum" value={t.momentumLabel || (t.momentum != null ? `${t.momentum}` : "--")} accent="text-primary" />
            <Stat label="Organic" value={t.organicScoreLabel || (t.organicScore != null ? `${Math.round(t.organicScore)}` : "--")} />
          </>)}

          {tab === "Holders" && (<>
            <Stat label="Holders" value={fmtNum(t.holderCount)} />
            <Stat label="Top 10 %" value={t.topHoldersPct != null ? `${Number(t.topHoldersPct).toFixed(1)}%` : "--"} accent={Number(t.topHoldersPct) > 40 ? "text-red-400" : "text-emerald-400"} />
            <Stat label="Holder Δ 1h" value={pct(t.holderChange1h)} accent={pctColor(t.holderChange1h)} />
            <Stat label="Holder Δ 24h" value={pct(t.holderChange24h)} accent={pctColor(t.holderChange24h)} />
            <Stat label="Net Buyers 1h" value={fmtNum(t.netBuyers1h)} />
            <Stat label="Net Buyers 24h" value={fmtNum(t.netBuyers24h)} />
            {holders?.concentrationRisk && <Stat label="Concentration" value={holders.concentrationRisk} accent={/high/i.test(holders.concentrationRisk) ? "text-red-400" : "text-emerald-400"} />}
            {Array.isArray(holders?.holders) && holders.holders.length > 0 && (
              <div className="col-span-2 sm:col-span-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-2">Top Holders</div>
                <div className="space-y-1.5">
                  {holders.holders.slice(0, 10).map((h: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[12px]">
                      <span className="w-5 text-white/30 font-mono">{i + 1}</span>
                      <span className="font-mono text-white/55 truncate flex-1">{short(h.owner || h.tokenAccount || "", 4, 4)}</span>
                      {h.label && <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white/50 bg-white/[0.06]">{h.label}</span>}
                      <span className="font-black text-white w-14 text-right">{h.pct != null ? `${Number(h.pct).toFixed(2)}%` : "--"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>)}

          {tab === "Dev / Origin" && (<>
            <Stat label="Created" value={t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "--"} />
            <Stat label="Token Age" value={t.ageDays != null ? `${t.ageDays}d` : "--"} />
            <Stat label="Pool Age" value={t.poolAgeDays != null ? `${t.poolAgeDays}d` : "--"} />
            <Stat label="Jupiter Verified" value={t.isVerifiedJup ? "Yes" : "No"} accent={t.isVerifiedJup ? "text-emerald-400" : "text-white/60"} />
            <Stat label="LP Status" value={flags.lpPulled ? "PULLED / DEAD" : "OK"} accent={flags.lpPulled ? "text-red-400" : "text-emerald-400"} />
            <Stat label="Authorities" value={flags.unsafeAuthority ? "ACTIVE ⚠" : "Renounced"} accent={flags.unsafeAuthority ? "text-red-400" : "text-emerald-400"} />
            <div className="col-span-2 sm:col-span-3 flex flex-wrap gap-2 pt-1">
              <a href={t.dexUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-white/70 hover:text-white">DexScreener →</a>
              <a href={t.pumpFunUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[12px] font-bold text-white/70 hover:text-white">pump.fun →</a>
            </div>
          </>)}

          {tab === "Markets" && (<>
            <Stat label="Liquidity" value={fmtUsd(t.liquidity)} />
            <Stat label="Buy Vol 24h" value={fmtUsd(t.buyVolume24h)} accent="text-emerald-400" />
            <Stat label="Sell Vol 24h" value={fmtUsd(t.sellVolume24h)} accent="text-red-400" />
            <Stat label="Txns 24h" value={fmtNum(t.txns24h)} />
            <Stat label="Buys 24h" value={fmtNum(t.numBuys24h)} accent="text-emerald-400" />
            <Stat label="Sells 24h" value={fmtNum(t.numSells24h)} accent="text-red-400" />
            <Stat label="Traders 24h" value={fmtNum(t.numTraders24h)} />
            <Stat label="Price Δ 5m" value={pct(t.priceChange5m)} accent={pctColor(t.priceChange5m)} />
            <Stat label="Price Δ 1h" value={pct(t.priceChange1h)} accent={pctColor(t.priceChange1h)} />
          </>)}

          {tab === "Score" && (<>
            <Stat label="OG Score" value={`${total}/100`} accent="text-primary" />
            <Stat label="Token Age" value={`${sig.age ?? "--"}`} />
            <Stat label="ATH MCap" value={`${sig.athMcap ?? "--"}`} />
            <Stat label="Holder Profile" value={`${sig.holderProfile ?? "--"}`} />
            <Stat label="Deploy Pattern" value={`${sig.deployPattern ?? "--"}`} />
            <Stat label="Pool Age" value={`${sig.poolAge ?? "--"}`} />
          </>)}
        </div>

        {/* CTA */}
        <div className="mt-6 rounded-3xl border border-white/[0.09] bg-gradient-to-br from-primary/10 to-transparent p-5 text-center">
          <div className="text-[15px] font-black">Scan any token in seconds</div>
          <p className="mx-auto mt-1 max-w-sm text-[12px] text-white/45">Rug scores, dev wallet DNA, holder risk, and live market data — free on OG Scan.</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Link to="/scanner" className="rounded-xl bg-primary px-4 py-2 text-[13px] font-black text-primary-foreground">Open OG Scan</Link>
            <a href="https://t.me" target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-[13px] font-bold text-white/70 hover:text-white">Telegram Bot</a>
          </div>
        </div>

        <div className="mt-5 text-center text-[10px] text-white/25">
          Live data via OG Scan · Not financial advice · ogscan.fun
        </div>
      </div>
    </div>
  );
}
