import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getToken, getForensics, Forensics as ForensicsData, getXray, XrayReport, getAth, AthData, track, TokenDetailData, fmtUsd, compact, fmtNum, fmtPct, short } from "../lib/api";
import { timeAgo } from "../lib/format";
import TokenLogo from "../components/TokenLogo";
import Change from "../components/Change";
import ScoreRing from "../components/ScoreRing";
import Verified from "../components/Verified";
import Copyable from "../components/Copyable";
import WalletLink from "../components/WalletLink";
import KolBadge from "../components/KolBadge";
import KolWhaleActivity from "../components/KolWhaleActivity";
import { getKolDirectory, KolDirEntry } from "../lib/kol";
import { buildHolderIntel } from "../lib/holderIntel";
import { getWalletLabel, labelKindClass } from "../lib/labels";
import PriceChart from "../components/PriceChart";
import TradePanel from "../components/TradePanel";
import TrustPanel from "../components/TrustPanel";
import PredictiveIntel from "../components/PredictiveIntel";
import ShareButton from "../components/ShareButton";
import CoinChat from "../components/CoinChat";
import DevOrigin from "../components/DevOrigin";
import RiskXray from "../components/RiskXray";
import Collapsible from "../components/Collapsible";
import ErrorBoundary from "../components/ErrorBoundary";
import CapitalFlow from "../components/CapitalFlow";
import {
  ArrowLeft, Copy, Check, ShieldCheck, ShieldAlert, ExternalLink, Loader2, Lock, Flame,
  TrendingUp, FileDown, Users, Activity, Crown, Wallet, AlertTriangle, Droplets, Clock, RefreshCw, Radio, BadgeCheck,
} from "lucide-react";

export default function TokenDetail() {
  const { mint = "" } = useParams();
  const [d, setD] = useState<TokenDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"overview" | "chat" | "predictive" | "smartmoney" | "kolwhale" | "holders" | "trades" | "xray" | "forensics">("overview");
  const [forensics, setForensics] = useState<ForensicsData | null>(null);
  const [forLoading, setForLoading] = useState(true);
  const [xray, setXray] = useState<XrayReport | null>(null);
  const [xrayLoading, setXrayLoading] = useState(false);
  const [xrayError, setXrayError] = useState<string | null>(null);
  const [ath, setAth] = useState<AthData | null>(null);
  const [dir, setDir] = useState<Record<string, KolDirEntry>>({});

  useEffect(() => { getKolDirectory().then(setDir).catch(() => {}); }, []);

  // Lazy-load X-ray only when tab is opened
  useEffect(() => {
    if (tab !== "xray" || xray || xrayLoading) return;
    
    let on = true;
    let retries = 0;
    const maxRetries = 2;
    
    const fetchXray = async () => {
      try {
        setXrayLoading(true);
        setXrayError(null);
        const result = await getXray(mint);
        if (on) {
          if (!result?.ok && retries < maxRetries) {
            retries++;
            await new Promise(r => setTimeout(r, 500 * retries));
            return fetchXray();
          }
          setXray(result);
          setXrayLoading(false);
        }
      } catch (err) {
        if (on) {
          if (retries < maxRetries) {
            retries++;
            await new Promise(r => setTimeout(r, 500 * retries));
            return fetchXray();
          }
          setXrayError((err as Error)?.message || "Failed to fetch risk analysis");
          setXrayLoading(false);
        }
      }
    };
    
    fetchXray();
    return () => { on = false; };
  }, [tab, mint, xray, xrayLoading]);
  
  useEffect(() => { setXray(null); setXrayError(null); }, [mint]);
  
  // Lazy-load Forensics only when forensics tab is opened
  useEffect(() => {
    if (tab !== "forensics") return;
    if (forLoading || forensics) return;
    let on = true;
    setForLoading(true);
    getForensics(mint).then((x) => { if (on) { setForensics(x); setForLoading(false); } }).catch(() => { if (on) setForLoading(false); });
    return () => { on = false; };
  }, [tab, mint, forLoading, forensics]);

  // Lazy-load ATH data only when overview is active
  useEffect(() => {
    if (tab !== "overview") return;
    if (ath) return;
    let on = true;
    getAth(mint).then((x) => { if (on && x?.ok) setAth(x); }).catch(() => {});
    return () => { on = false; };
  }, [tab, mint, ath]);

  useEffect(() => {
    let on = true; setLoading(true);
    getToken(mint).then((x) => { if (on) { setD(x); setLoading(false); try { track("token_view", { token_ref: x?.token?.symbol || mint, meta: { mint } }); } catch {} } }).catch(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [mint]);

  useEffect(() => {
    if (tab !== "trades" && tab !== "overview") return;
    const id = setInterval(() => { getToken(mint).then((x) => x && setD(x)); }, 12000);
    return () => clearInterval(id);
  }, [tab, mint]);

  if (loading) return <div className="grid place-items-center py-24 text-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!d || (!d.token && !d.meta)) return (
    <div className="text-center py-24">
      <p className="text-muted">No token found for this address.</p>
      <div className="flex items-center justify-center gap-3 mt-3">
        <Link to={`/wallet/${mint}`} className="btn bg-accent/15 text-accent inline-flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> View as wallet</Link>
        <Link to="/" className="text-accent text-sm">← Back to screener</Link>
      </div>
    </div>
  );

  const t: any = d.token || {};
  const meta: any = d.meta || {};
  const intel: any = d.intel || {};
  const safety: any = d.safety || intel.safety || null;
  const name = t.name || meta.name || "Unknown";
  const symbol = t.symbol || meta.symbol || short(mint);
  const icon = t.icon || meta.icon || meta.image;
  const banner = meta.banner || meta.openGraph;
  const price = t.priceUsd ?? meta.priceUsd;
  const athMcap = ath?.athMcap ?? null;
  const athPrice = ath?.athPrice ?? null;
  const fromAthPct = ath?.fromAthPct ?? null;
  const verified = t.isVerified || meta.isVerifiedJup || d.flags?.isVerified;
  const holders: any[] = intel.holders || [];
  const trades: any[] = intel.trades || [];
  const whales = holders.filter((h) => h.label === "whale").length;
  const copy = () => { navigator.clipboard.writeText(mint); setCopied(true); setTimeout(() => setCopied(false), 1200); };

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Screener</Link>

      {/* Hero with banner */}
      <div className="card overflow-hidden mb-4">
        {banner && <div className="h-28 sm:h-36 w-full bg-cover bg-center relative" style={{ backgroundImage: `url(${banner})` }}><div className="absolute inset-0 bg-gradient-to-t from-panel to-transparent" /></div>}
        <div className="p-5 relative">
          <div className="flex flex-wrap items-start gap-4">
            <div className={banner ? "-mt-12" : ""}><TokenLogo src={icon} sym={symbol} size={64} /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{symbol}</h1>
                {verified && <Verified size={18} />}
                {d.verdict && <span className="pill bg-accent/15 text-accent">{d.verdict}</span>}
                {meta.isPumpFun && <span className="pill bg-panel2 text-muted">pump.fun</span>}
                {(t.tags || []).slice(0, 4).map((tg: string) => <span key={tg} className="pill bg-panel2 text-muted text-[10px] capitalize">{tg}</span>)}
              </div>
              <div className="text-muted text-sm">{name}</div>
              <div className="mt-1"><Copyable text={mint} display={short(mint)} className="text-xs text-muted" /></div>
            </div>
            <div className="sm:ml-auto text-right">
              <div className="text-2xl font-bold">{fmtUsd(price)}</div>
              <div className="flex gap-2 justify-end text-xs mt-1">
                <span>5m <Change v={t.change5m} /></span><span>1h <Change v={t.change1h} /></span>
                <span>6h <Change v={t.change6h} /></span><span>24h <Change v={t.change24h ?? meta.priceChange24h} /></span>
              </div>

            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
            <a href={`/api/ogdex/report?mint=${mint}`} target="_blank" rel="noreferrer" className="btn bg-accent text-black font-semibold inline-flex items-center gap-1.5"><FileDown className="w-3.5 h-3.5" /> Download Report</a>
            <a href="#trade" className="btn bg-accent/15 text-accent inline-flex items-center gap-1.5">Buy / Sell</a>
            <Link to={`/alerts?mint=${mint}`} className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5">Set Alert</Link>
            <ShareButton mint={mint} symbol={symbol} score={d.score?.total ?? meta.organicScore} mcap={t.mcap ?? meta.mcap} verdict={d.verdict} />
            <a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer" className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5">Solscan <ExternalLink className="w-3 h-3" /></a>
            <a href={`https://dexscreener.com/solana/${mint}`} target="_blank" rel="noreferrer" className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1.5">DexScreener <ExternalLink className="w-3 h-3" /></a>
            {meta.socials?.twitter && <a href={meta.socials.twitter} target="_blank" rel="noreferrer" className="btn bg-panel2 text-muted hover:text-white">X</a>}
            {meta.socials?.website && <a href={meta.socials.website} target="_blank" rel="noreferrer" className="btn bg-panel2 text-muted hover:text-white">Website</a>}
          </div>
        </div>
      </div>

      {/* Trust verdict + OG Read */}
      <TrustPanel d={d} />

      {/* Price chart + non-custodial trade panel */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className={(meta.chain || "solana") === "solana" ? "lg:col-span-2" : "lg:col-span-3"}>
          <PriceChart mint={mint} symbol={symbol} chain={(meta.chain || "solana")} />
        </div>
        {(meta.chain || "solana") === "solana" && (
          <div id="trade" className="lg:col-span-1 scroll-mt-20"><TradePanel mint={mint} symbol={symbol} price={t.priceUsd ?? meta.priceUsd} icon={icon} /></div>
        )}
      </div>

      {/* Key metrics — compact strip + collapsible deep-dive sections */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
        <Stat label="Market Cap" value={fmtUsd(t.mcap ?? meta.mcap, { compact: true })} />
        <Stat label="Liquidity" value={t.liquidity != null ? "$" + compact(t.liquidity) : "—"} />
        <Stat label="24h Volume" value={t.volume != null ? "$" + compact(t.volume) : "—"} />
        <Stat label="Holders" value={fmtNum(meta.holderCount ?? t.holderCount ?? safety?.totalHolders)} />
        <Stat label="FDV" value={fmtUsd(t.fdv ?? meta.fdv, { compact: true })} />
        {athMcap != null ? <Stat label="ATH MCap" value={fmtUsd(athMcap, { compact: true })} sub={fromAthPct != null ? (fromAthPct >= 0 ? "+" : "") + fromAthPct.toFixed(0) + "% from ATH" : undefined} /> : <Stat label="ATH" soon />}
      </div>

      <div className="space-y-3 mb-4">
        <Collapsible title="Market & Valuation" icon={<TrendingUp className="w-4 h-4 text-accent" />} defaultOpen>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Stat label="Price" value={fmtUsd(price)} />
            <Stat label="FDV" value={fmtUsd(t.fdv ?? meta.fdv, { compact: true })} />
            {athPrice != null ? <Stat label="ATH Price" value={fmtUsd(athPrice)} sub={ath?.source || undefined} /> : <Stat label="All-Time High" soon />}
            <Stat label="Organic Score" value={t.organicScore != null ? Math.round(t.organicScore) + "/100" : "—"} sub={meta.organicScoreLabel} />
            <Stat label="Token Age" value={meta.ageDays != null ? meta.ageDays + "d" : "—"} />
          </div>
        </Collapsible>

        <Collapsible title="Activity & Momentum" icon={<Activity className="w-4 h-4 text-accent" />} defaultOpen={false}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Stat label="Volume 24h Δ" value={t.volumeChange24h != null ? fmtPct(t.volumeChange24h) : "—"} good={(t.volumeChange24h ?? 0) >= 0} />
            <Stat label="Liquidity 24h Δ" value={t.liquidityChange24h != null ? fmtPct(t.liquidityChange24h) : "—"} good={(t.liquidityChange24h ?? 0) >= 0} />
            <Stat label="Holders 24h Δ" value={t.holderChange24h != null ? fmtPct(t.holderChange24h) : "—"} good={(t.holderChange24h ?? 0) > 0} />
            <Stat label="Traders 24h" value={fmtNum(t.numTraders ?? meta.numTraders24h)} />
            <Stat label="Whales" value={String(whales)} sub={whales === 0 ? "healthy" : "concentration"} />
          </div>
        </Collapsible>

        <Collapsible title="Distribution & Security" icon={<ShieldCheck className="w-4 h-4 text-accent" />} defaultOpen={false}
          right={<span className={`pill text-[10px] ${(safety?.riskScore ?? 99) <= 20 ? "bg-up/10 text-up" : (safety?.riskScore ?? 99) <= 50 ? "bg-yellow-400/10 text-yellow-300" : "bg-down/10 text-down"}`}>Risk {safety?.riskScore != null ? safety.riskScore : "—"}</span>}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Stat label="Top 10 Holders" value={t.audit?.topHoldersPercentage != null ? t.audit.topHoldersPercentage.toFixed(1) + "%" : "—"} good={(t.audit?.topHoldersPercentage ?? 100) < 25} />
            <Stat label="Dev Mints" value={t.audit?.devMints != null ? String(t.audit.devMints) : "—"} good={(t.audit?.devMints ?? 0) <= 1} />
            <Stat label="Mint Auth" value={d.flags?.mintAuthorityDisabled ? "Renounced" : "Active"} good={d.flags?.mintAuthorityDisabled} />
            <Stat label="Freeze Auth" value={d.flags?.freezeAuthorityDisabled ? "Renounced" : "Active"} good={d.flags?.freezeAuthorityDisabled} />
            <Stat label="Risk Score" value={safety?.riskScore != null ? String(safety.riskScore) : "—"} good={(safety?.riskScore ?? 99) <= 20} />
          </div>
        </Collapsible>
      </div>

      {/* OG score + verdict + scores */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-5 text-center glow grid place-items-center">
          <div className="text-xs uppercase tracking-wide text-muted mb-3">OG Score</div>
          <ScoreRing value={d.score?.total ?? meta.organicScore} label="/ 100" size={130} />
          {(d.momentumLabel || meta.momentumLabel) && <div className="mt-3 inline-flex pill bg-panel2 text-muted capitalize">Momentum: {(d.momentumLabel || meta.momentumLabel)?.replace(/[^\w\s]/g, "")}</div>}
        </div>
        <div className="card p-5 lg:col-span-2">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /> Forensic Scores</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {d.score?.signals && Object.entries(d.score.signals).map(([k, v]: any) => <MiniScore key={k} label={k} value={v} />)}
            <MiniScore label="organic" value={Math.round(t.organicScore ?? 0)} />
            <MiniScore label="momentum" value={d.momentum ?? meta.momentum} />
            <MiniScore label="risk" value={safety?.riskScore} invert />
          </div>
          {/* detection signals */}
          <div className="mt-4 pt-4 border-t border-line space-y-1.5 text-xs">
            <Signal ok={d.flags?.mintAuthorityDisabled} text="Mint authority renounced — fixed supply integrity" />
            <Signal ok={d.flags?.freezeAuthorityDisabled} text="Freeze authority renounced — no blacklist/freeze risk" />
            <Signal ok={!d.flags?.lpPulled} text="Liquidity intact — no LP pull detected" />
            <Signal ok={d.flags?.minLiquidity} text="Sufficient liquidity depth" />
            <Signal ok={!d.score?.isPumpFunClone} text="Original deployment — not a detected clone" />
            <Signal ok={whales === 0} text={whales === 0 ? "Broad distribution — no >5% whale concentration" : `${whales} whale wallet(s) hold >5%`} />
          </div>
        </div>
      </div>

      {/* Tabs — centered slider that scrolls instead of breaking the frame */}
      <div className="mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-1 bg-panel border border-line rounded-xl p-1 w-max max-w-full mx-auto">
          {[["overview", "Overview"], ["chat", "✨ Ask AI"], ["predictive", "Predictive"], ["smartmoney", "Smart Money"], ["kolwhale", "KOL & Whale"], ["holders", `Holders ${holders.length ? `(${holders.length})` : ""}`], ["trades", `Live Trades ${trades.length ? `(${trades.length})` : ""}`], ["xray", "🩻 Risk X-ray"], ["forensics", "Forensics"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as any)} className={`btn shrink-0 whitespace-nowrap ${tab === id ? "bg-accent/15 text-accent" : "text-muted hover:text-white"}`}>{label}</button>
          ))}
        </div>
      </div>

      <ErrorBoundary key={tab} label="this tab">
      {tab === "overview" && <Overview d={d} t={t} meta={meta} safety={safety} trades={trades} ath={ath} />}
      {tab === "chat" && <CoinChat d={d} forensics={forensics} ath={ath} />}
      {tab === "predictive" && <PredictiveIntel d={d} />}
      {tab === "smartmoney" && <CapitalFlow d={d} />}
      {tab === "kolwhale" && <KolWhaleActivity d={d} dir={dir} />}
      {tab === "holders" && <><HolderIntel holders={holders} safety={safety} dir={dir} /><HoldersTable holders={holders} price={price} dir={dir} /></>}
      {tab === "trades" && <TradesTable trades={trades} mint={mint} dir={dir} onRefresh={() => getToken(mint).then(setD)} />}
      {tab === "xray" && <RiskXray x={xray} loading={xrayLoading} error={xrayError} />}
      {tab === "forensics" && <><DevOrigin f={forensics} loading={forLoading} /><Forensics d={d} meta={meta} safety={safety} /></>}
      </ErrorBoundary>
    </div>
  );
}

/* ---------- Overview ---------- */
function Overview({ d, t, meta, safety, trades, ath }: any) {
  const buyVol = meta.buyVolume24h ?? t.buyVolume ?? 0;
  const sellVol = meta.sellVolume24h ?? t.sellVolume ?? 0;
  const total = buyVol + sellVol || 1; const bp = (buyVol / total) * 100;
  const buys = trades.filter((x: any) => x.side === "buy").length;
  const sells = trades.filter((x: any) => x.side === "sell").length;
  const tf = t.stats || {};
  const windows: [string, string][] = [["5m", "5m"], ["1h", "1H"], ["6h", "6H"], ["24h", "24H"]];
  return (
    <div className="space-y-4">
    <div className="card p-5">
      <div className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent" /> Performance by Timeframe</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-muted text-xs border-b border-line"><th className="text-left py-2">Window</th><th className="text-right py-2">Price</th><th className="text-right py-2">Volume</th><th className="text-right py-2">Buys</th><th className="text-right py-2">Sells</th><th className="text-right py-2">Traders</th><th className="text-right py-2">Net buyers</th></tr></thead>
          <tbody>
            {windows.map(([k, label]) => { const w = tf[k] || {}; return (
              <tr key={k} className="border-b border-line/40 last:border-0">
                <td className="py-2 font-semibold">{label}</td>
                <td className="py-2 text-right"><Change v={w.priceChange} /></td>
                <td className="py-2 text-right tabular-nums">{w.volume != null ? "$" + compact(w.volume) : "—"}</td>
                <td className="py-2 text-right tabular-nums text-up">{fmtNum(w.numBuys)}</td>
                <td className="py-2 text-right tabular-nums text-down">{fmtNum(w.numSells)}</td>
                <td className="py-2 text-right tabular-nums">{fmtNum(w.numTraders)}</td>
                <td className={`py-2 text-right tabular-nums ${(w.numNetBuyers ?? 0) >= 0 ? "text-up" : "text-down"}`}>{fmtNum(w.numNetBuyers)}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
    </div>
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Flame className="w-4 h-4 text-accent" /> Market Microstructure</div>
        <div className="text-xs text-muted mb-1 flex justify-between"><span>Buy pressure (24h)</span><span>{bp.toFixed(0)}% buys</span></div>
        <div className="h-2.5 rounded-full overflow-hidden flex bg-panel2 mb-3"><div className="bg-up h-full" style={{ width: `${bp}%` }} /><div className="bg-down h-full" style={{ width: `${100 - bp}%` }} /></div>
        <Row label="Buy volume 24h" value={"$" + compact(buyVol)} />
        <Row label="Sell volume 24h" value={"$" + compact(sellVol)} />
        <Row label="Buys / Sells (24h)" value={`${fmtNum(meta.numBuys24h)} / ${fmtNum(meta.numSells24h)}`} />
        <Row label="Total txns 24h" value={fmtNum(meta.txns24h)} />
        <Row label="Active traders 24h" value={fmtNum(meta.numTraders24h)} />
        <Row label="Net buyers 24h" value={fmtNum(meta.netBuyers24h)} />
        <Row label="Organic buy vol 24h" value={meta.organicBuyVol24h ? "$" + compact(meta.organicBuyVol24h) : "—"} />
        <Row label="Recent feed" value={`${buys} buys / ${sells} sells`} />
      </div>
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent" /> Market Intelligence</div>
        <Row label="Price" value={fmtUsd(t.priceUsd ?? meta.priceUsd)} />
        <Row label="Market cap" value={fmtUsd(t.mcap ?? meta.mcap, { compact: true })} />
        <Row label="FDV" value={fmtUsd(t.fdv ?? meta.fdv, { compact: true })} />
        <Row label="Liquidity" value={t.liquidity ? "$" + compact(t.liquidity) : "—"} />
        <Row label="All-time high" value={ath?.athMcap != null ? fmtUsd(ath.athMcap, { compact: true }) + (ath.fromAthPct != null ? ` (${ath.fromAthPct >= 0 ? "+" : ""}${ath.fromAthPct.toFixed(0)}%)` : "") : <span className="pill bg-panel2 text-muted text-[10px]">Coming soon</span>} />
        <Row label="ATH price" value={ath?.athPrice != null ? fmtUsd(ath.athPrice) : <span className="pill bg-panel2 text-muted text-[10px]">Coming soon</span>} />
        <Row label="Total supply" value={compact(t.totalSupply ?? meta.totalSupply)} />
        <Row label="Circulating" value={compact(t.circSupply ?? meta.circSupply)} />
        <Row label="Created" value={meta.createdAt ? new Date(meta.createdAt).toLocaleDateString() + (meta.ageDays != null ? ` (${meta.ageDays}d)` : "") : "—"} />
        <Row label="Pool age" value={meta.poolAgeDays != null ? meta.poolAgeDays + "d" : "—"} />
        <Row label="DEX / pair" value={meta.pairDexId || "—"} />
      </div>
    </div>
    </div>
  );
}

/* ---------- Holders ---------- */
function HolderIntel({ holders, safety, dir }: { holders: any[]; safety: any; dir: Record<string, KolDirEntry> }) {
  if (!holders?.length) return null;
  const r = buildHolderIntel(holders, safety, dir);
  const toneCls = r.tone === "good" ? "text-up border-up/30 bg-up/10" : r.tone === "bad" ? "text-down border-down/30 bg-down/10" : "text-yellow-300 border-yellow-400/30 bg-yellow-400/10";
  const dot = (t: string) => t === "good" ? "bg-up" : t === "bad" ? "bg-down" : "bg-yellow-400";
  return (
    <div className={`card mb-3 border ${toneCls.split(" ").slice(1).join(" ")}`}>
      <div className="flex items-center gap-2 px-4 py-3">
        <ShieldCheck className={`w-4 h-4 ${toneCls.split(" ")[0]}`} />
        <span className="text-sm font-bold text-white">Holder Intel</span>
        <span className={`pill text-[10px] ${toneCls}`}>{r.verdict}</span>
        <div className="ml-auto flex gap-3 text-[11px] text-muted">
          {r.top10Pct != null && <span>Top10 <b className="text-white">{r.top10Pct.toFixed(0)}%</b></span>}
          <span>Whales <b className="text-white">{r.whaleCount}</b></span>
          {r.bundleWallets >= 4 && <span>Bundle <b className="text-white">{r.bundleWallets}</b></span>}
        </div>
      </div>
      <div className="grid gap-1.5 border-t border-line p-3 sm:grid-cols-2">
        {r.flags.map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-[12.5px] text-white/80">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot(f.tone)}`} />
            <span>{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoldersTable({ holders, price, dir = {} }: { holders: any[]; price?: number; dir?: Record<string, KolDirEntry> }) {
  if (!holders.length) return <Empty text="Holder data unavailable for this token." />;
  const maxPct = Math.max(...holders.map((h) => h.pct || 0), 1);
  const kolHolders = holders.filter((h) => dir[h.owner]);
  const kolPct = kolHolders.reduce((s, h) => s + (h.pct || 0), 0);
  return (
    <div className="space-y-3">
    {kolHolders.length > 0 && (
      <div className="card p-3 px-4 flex items-center gap-2 flex-wrap text-sm">
        <BadgeCheck className="w-4 h-4 text-accent" />
        <span className="font-semibold">{kolHolders.length} KOL{kolHolders.length > 1 ? "s" : ""} holding {kolPct.toFixed(2)}% of supply</span>
        <span className="text-muted text-xs">·</span>
        <div className="flex gap-1.5 flex-wrap">{kolHolders.slice(0, 8).map((h) => <span key={h.owner} className="pill bg-accent/10 text-accent text-[10px]">{dir[h.owner].name}</span>)}</div>
      </div>
    )}
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line text-sm font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-accent" /> Top {holders.length} Holders <span className="text-muted font-normal text-xs ml-1">KOLs, exchanges & pools labeled · click any wallet to view holdings</span></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-muted text-xs border-b border-line">
            <th className="text-left px-4 py-2 w-8">#</th><th className="text-left px-2 py-2">Wallet</th><th className="text-left px-2 py-2">Type</th>
            <th className="text-right px-2 py-2">Amount</th><th className="text-left px-2 py-2 w-40">Supply %</th><th className="text-right px-4 py-2">USD Value</th>
          </tr></thead>
          <tbody>
            {holders.map((h) => (
              <tr key={h.rank} className="border-b border-line/50 hover:bg-panel2/40">
                <td className="px-4 py-2 text-muted">{h.rank}</td>
                <td className="px-2 py-2">{(() => { const lbl = getWalletLabel(h.owner); return dir[h.owner] ? <KolBadge kol={dir[h.owner]} /> : lbl ? <span className="inline-flex items-center gap-1.5"><span className={`pill text-[10px] ${labelKindClass(lbl.kind)}`}>{lbl.name}</span><WalletLink address={h.owner} icon={false} className="text-[11px] text-muted" /></span> : <WalletLink address={h.owner} />; })()}</td>
                <td className="px-2 py-2"><span className={`pill text-[10px] ${labelCls(h.label)}`}>{getWalletLabel(h.owner)?.kind || h.label}</span></td>
                <td className="px-2 py-2 text-right">{compact(h.uiAmount)}</td>
                <td className="px-2 py-2"><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-panel2 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: `${((h.pct || 0) / maxPct) * 100}%` }} /></div><span className="text-xs w-12 text-right">{h.pct != null ? h.pct.toFixed(2) + "%" : "—"}</span></div></td>
                <td className="px-4 py-2 text-right">{price && h.uiAmount ? fmtUsd(h.uiAmount * price, { compact: true }) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

/* ---------- Trades ---------- */
function TradesTable({ trades, mint, dir = {}, onRefresh }: { trades: any[]; mint: string; dir?: Record<string, KolDirEntry>; onRefresh: () => void }) {
  const [auto, setAuto] = useState(true);
  useEffect(() => { if (!auto) return; const id = setInterval(onRefresh, 15000); return () => clearInterval(id); }, [auto, onRefresh]);
  if (!trades.length) return <Empty text="No recent trades available." />;
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line text-sm font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /> Live Trades <span className="pill bg-up/10 text-up text-[10px] inline-flex items-center gap-1"><Radio className="w-3 h-3 animate-pulse" /> LIVE</span>
        <button onClick={() => setAuto((a) => !a)} className={`ml-auto btn inline-flex items-center gap-1 text-xs ${auto ? "bg-up/15 text-up" : "bg-panel2 text-muted hover:text-white"}`}><Radio className={`w-3 h-3 ${auto ? "animate-pulse" : ""}`} /> {auto ? "Auto" : "Paused"}</button>
        <button onClick={onRefresh} className="btn bg-panel2 text-muted hover:text-white inline-flex items-center gap-1 text-xs"><RefreshCw className="w-3 h-3" /> Refresh</button>
      </div>
      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="sticky top-0 bg-panel"><tr className="text-muted text-xs border-b border-line">
            <th className="text-left px-4 py-2">Time</th><th className="text-left px-2 py-2">Side</th><th className="text-right px-2 py-2">Price</th>
            <th className="text-right px-2 py-2">Amount</th><th className="text-right px-2 py-2">USD</th><th className="text-left px-2 py-2">Trader</th><th className="text-left px-2 py-2">Tag</th><th className="text-left px-4 py-2">DEX</th>
          </tr></thead>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i} className="border-b border-line/50 hover:bg-panel2/40">
                <td className="px-4 py-2 text-muted">{timeAgo(t.time)} ago</td>
                <td className={`px-2 py-2 font-semibold ${t.side === "buy" ? "text-up" : "text-down"}`}>{t.side?.toUpperCase()}</td>
                <td className="px-2 py-2 text-right">{fmtUsd(t.priceUsd)}</td>
                <td className="px-2 py-2 text-right">{compact(t.tokenAmount)}</td>
                <td className="px-2 py-2 text-right">{fmtUsd(t.volumeUsd, { compact: true })}</td>
                <td className="px-2 py-2">{t.owner ? <WalletLink address={t.owner} icon={false} /> : "—"}</td>
                <td className="px-2 py-2">{dir[t.owner] ? <span className="pill bg-accent/15 text-accent text-[9px]">{dir[t.owner].name}</span> : getWalletLabel(t.owner) ? <span className={`pill text-[9px] ${labelKindClass(getWalletLabel(t.owner)!.kind)}`}>{getWalletLabel(t.owner)!.name}</span> : (t.volumeUsd >= 1000 ? <span className="pill bg-yellow-400/15 text-yellow-300 text-[9px]">whale</span> : <span className="text-muted/40 text-xs">—</span>)}</td>
                <td className="px-4 py-2 text-muted">{t.dex || "—"}{t.txHash && <a href={`https://solscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer" className="ml-1.5 text-accent/70 hover:text-accent"><ExternalLink className="w-3 h-3 inline" /></a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Forensics ---------- */
function Forensics({ d, meta, safety }: any) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-accent" /> Developer / Creator Intelligence</div>
        <Row label="Creator wallet" value={safety?.creator ? <WalletLink address={safety.creator} /> : "—"} />
        <Row label="Tokens created" value={safety?.creatorTokensCount != null ? String(safety.creatorTokensCount) : "—"} />
        <Row label="Mint authority" value={d.flags?.mintAuthorityDisabled ? "Renounced" : "Active"} good={d.flags?.mintAuthorityDisabled} />
        <Row label="Freeze authority" value={d.flags?.freezeAuthorityDisabled ? "Renounced" : "Active"} good={d.flags?.freezeAuthorityDisabled} />
        <Row label="Unsafe authority" value={d.flags?.unsafeAuthority ? "Yes" : "No"} good={!d.flags?.unsafeAuthority} />
        <Row label="Launchpad" value={(safety?.launchpad && typeof safety.launchpad === "object" ? safety.launchpad.name : safety?.launchpad) || (meta.isPumpFun ? "pump.fun" : "—")} />
        <Row label="Migrated from pump.fun" value={d.flags?.migratedFromPumpFun ? "Yes" : "No"} />
        <Row label="Deployer exit risk" value={d.flags?.mintAuthorityDisabled && d.flags?.freezeAuthorityDisabled ? "Very Low" : "Elevated"} good={d.flags?.mintAuthorityDisabled && d.flags?.freezeAuthorityDisabled} />
      </div>
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2">{safety?.rugged ? <ShieldAlert className="w-4 h-4 text-down" /> : <ShieldCheck className="w-4 h-4 text-up" />} Liquidity & Safety</div>
        <Row label="Risk score" value={safety?.riskScore != null ? String(safety.riskScore) : "—"} good={(safety?.riskScore ?? 99) <= 20} />
        <Row label="Rugged" value={safety?.rugged ? "Yes" : "No"} good={!safety?.rugged} />
        <Row label="LP locked" value={safety?.lpLockedPct != null ? safety.lpLockedPct.toFixed(0) + "%" : "—"} good={(safety?.lpLockedPct ?? 0) > 50} />
        <Row label="Min liquidity met" value={d.flags?.minLiquidity ? "Yes" : "No"} good={d.flags?.minLiquidity} />
        <Row label="LP pulled" value={d.flags?.lpPulled ? "Yes" : "No"} good={!d.flags?.lpPulled} />
        {Array.isArray(safety?.risks) && safety.risks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line space-y-1.5">
            <div className="text-xs text-muted mb-1">Risk flags</div>
            {safety.risks.slice(0, 6).map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs"><AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${r.level === "danger" ? "text-down" : "text-yellow-400"}`} /><span className="text-muted">{r.name}{r.desc ? ` — ${r.desc}` : ""}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- shared ---------- */
function Stat({ label, value, sub, good, soon }: { label: string; value?: string; sub?: string; good?: boolean; soon?: boolean }) {
  return <div className="card p-3"><div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>{soon ? <div className="mt-1 inline-flex items-center gap-1 pill bg-accent/10 text-accent text-[10px]">Coming soon</div> : <div className={`text-base font-semibold mt-0.5 ${good === true ? "text-up" : good === false ? "text-down" : ""}`}>{value}</div>}{sub && !soon && <div className="text-[10px] text-muted capitalize">{sub}</div>}</div>;
}
function MiniScore({ label, value, invert }: { label: string; value?: number | null; invert?: boolean }) {
  const v = value ?? null;
  const good = v == null ? false : invert ? v <= 30 : v >= 60;
  const mid = v == null ? false : invert ? v <= 60 : v >= 40;
  const color = v == null ? "text-muted" : good ? "text-up" : mid ? "text-accent" : "text-down";
  return <div className="bg-panel2 rounded-lg p-2.5 text-center"><div className={`text-lg font-bold ${color}`}>{v == null ? "—" : Math.round(v)}</div><div className="text-[10px] uppercase tracking-wide text-muted capitalize">{label.replace(/([A-Z])/g, " $1")}</div></div>;
}
function Signal({ ok, text }: { ok?: boolean; text: string }) {
  return <div className="flex items-start gap-2"><span className={`mt-0.5 ${ok ? "text-up" : "text-down"}`}>{ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}</span><span className="text-muted">{text}</span></div>;
}
function Row({ label, value, good }: { label: string; value: any; good?: boolean }) {
  return <div className="flex items-center justify-between py-1.5 border-b border-line/40 last:border-0 text-sm"><span className="text-muted">{label}</span><span className={`font-medium ${good === true ? "text-up" : good === false ? "text-down" : ""}`}>{value}</span></div>;
}
function Empty({ text }: { text: string }) { return <div className="card p-10 text-center text-muted text-sm">{text}</div>; }
function labelCls(l: string) {
  if (l === "whale") return "bg-down/15 text-down";
  if (l === "large holder") return "bg-yellow-500/15 text-yellow-400";
  if (l === "liquidity pool") return "bg-accent2/15 text-accent2";
  if (l === "burn") return "bg-panel2 text-muted";
  return "bg-up/10 text-up";
}
