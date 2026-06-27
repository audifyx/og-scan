import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getToken, getForensics, Forensics as ForensicsData, getXray, XrayReport, getAth, AthData, track, TokenDetailData, fmtUsd, compact, fmtNum, fmtPct, short } from "../lib/api";
import { timeAgo } from "../lib/format";
import TokenLogo from "../components/TokenLogo";
import Change from "../components/Change";
import ScoreRing from "../components/ScoreRing";
import Verified from "../components/Verified";
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
import ErrorBoundary from "../components/ErrorBoundary";
import CapitalFlow from "../components/CapitalFlow";
import {
  ArrowLeft, Copy, Check, ShieldCheck, ShieldAlert, ExternalLink, Loader2, Flame,
  TrendingUp, FileDown, Users, Activity, Wallet, AlertTriangle, RefreshCw, Radio, BadgeCheck,
  Globe, MessageCircle, Send, Bell, Zap,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Shared micro-components
───────────────────────────────────────────── */

function symbolToRgb(sym: string, offset: number): string {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) >>> 0;
  const palettes: number[][][] = [
    [[47, 128, 255], [153, 69, 255]],
    [[0, 200, 180],  [47, 128, 255]],
    [[255, 197, 61], [153, 69, 255]],
    [[255, 77, 109], [47, 128, 255]],
    [[0, 200, 130],  [47, 128, 255]],
    [[255, 128, 0],  [200, 50, 200]],
  ];
  const pair = palettes[h % palettes.length];
  const [r, g, b] = pair[offset % 2];
  return `${r},${g},${b}`;
}

function SocialPill({ href, icon, label, accent }: { href: string; icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
        accent
          ? "bg-accent/15 text-accent border-accent/30 hover:bg-accent/25"
          : "bg-panel2 text-muted border-line hover:text-white hover:border-accent/30"
      }`}>
      {icon}{label}
    </a>
  );
}

function StatPill({ label, value, sub, accent }: { label: string; value?: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`flex-shrink-0 flex flex-col justify-center px-3.5 py-2 rounded-xl border min-w-[80px] ${accent ? "bg-accent/10 border-accent/30" : "bg-panel border-line"}`}>
      <div className="text-[9px] uppercase tracking-widest text-muted mb-0.5">{label}</div>
      <div className={`text-sm font-bold ${accent ? "text-accent" : "text-white"}`}>{value ?? "—"}</div>
      {sub && <div className="text-[9px] text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function ChangePill({ label, v }: { label: string; v?: number | null }) {
  if (v == null) return null;
  const pos = v >= 0;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold ${pos ? "bg-up/15 text-up" : "bg-down/15 text-down"}`}>
      {label} {pos ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */

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
  const [ath, setAth] = useState<AthData | null>(null);
  const [dir, setDir] = useState<Record<string, KolDirEntry>>({});

  useEffect(() => { getKolDirectory().then(setDir).catch(() => {}); }, []);
  useEffect(() => { let on = true; setForLoading(true); getForensics(mint).then((x) => { if (on) { setForensics(x); setForLoading(false); } }).catch(() => { if (on) setForLoading(false); }); return () => { on = false; }; }, [mint]);
  useEffect(() => { let on = true; getAth(mint).then((x) => { if (on && x?.ok) setAth(x); }).catch(() => {}); return () => { on = false; }; }, [mint]);
  useEffect(() => { let on = true; setXrayLoading(true); getXray(mint).then((x) => { if (on) { setXray(x); setXrayLoading(false); } }).catch(() => { if (on) setXrayLoading(false); }); return () => { on = false; }; }, [mint]);
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

  if (loading) return (
    <div className="grid place-items-center py-24 text-muted">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
  if (!d || (!d.token && !d.meta)) return (
    <div className="text-center py-24 max-w-sm mx-auto">
      <p className="text-muted mb-4">No token found for this address.</p>
      <div className="flex items-center justify-center gap-3">
        <Link to={`/wallet/${mint}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-all">
          <Wallet className="w-3.5 h-3.5" /> View as wallet
        </Link>
        <Link to="/" className="text-accent text-sm hover:underline">← Screener</Link>
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
  const score = d.score?.total ?? meta.organicScore;
  const scoreColor = score == null ? "text-muted" : score >= 70 ? "text-up" : score >= 45 ? "text-accent" : "text-down";
  const copy = () => { navigator.clipboard.writeText(mint); setCopied(true); setTimeout(() => setCopied(false), 1200); };

  const TABS: [string, string][] = [
    ["overview",   "Overview"],
    ["chat",       "✨ Ask AI"],
    ["predictive", "Predictive"],
    ["smartmoney", "Smart Money"],
    ["kolwhale",   "KOL & Whale"],
    ["holders",    `Holders${holders.length ? ` (${holders.length})` : ""}`],
    ["trades",     `Live Trades${trades.length ? ` (${trades.length})` : ""}`],
    ["xray",       "🩻 Risk X-ray"],
    ["forensics",  "Forensics"],
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-3">

      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Screener
      </Link>

      {/* ══════════════════════════════════════
          HEADER CARD
          ══════════════════════════════════════ */}
      <div className="card overflow-hidden">

        {/* Banner */}
        <div className="relative h-36 sm:h-44 overflow-hidden bg-black">
          {banner ? (
            <img src={banner} alt={`${name} banner`} className="w-full h-full object-cover object-center" />
          ) : icon ? (
            <>
              <img src={icon} alt="" aria-hidden
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: "blur(32px) saturate(2) brightness(0.55)", transform: "scale(1.18)", transformOrigin: "center" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <div className="absolute inset-0 opacity-[0.07]"
                style={{ backgroundImage: `url(${icon})`, backgroundSize: "80px 80px", backgroundRepeat: "repeat" }} />
            </>
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, rgba(${symbolToRgb(symbol,0)},0.6) 0%, rgba(${symbolToRgb(symbol,1)},0.5) 50%, rgba(0,0,0,0.95) 100%)` }} />
          )}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.35) 100%)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.55) 0%, transparent 50%)" }} />
          {/* Top-right: share + alert */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <ShareButton mint={mint} symbol={symbol} score={score} mcap={t.mcap ?? meta.mcap} verdict={d.verdict} />
            <Link to={`/alerts?mint=${mint}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/50 backdrop-blur-sm border border-white/15 text-white hover:bg-black/70 transition-all">
              <Bell className="w-3 h-3" /> Alert
            </Link>
          </div>
        </div>

        {/* Profile row */}
        <div className="px-4 sm:px-6 pb-5">

          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-9 mb-3">
            <div className="relative z-10">
              <div className="w-[64px] h-[64px] rounded-2xl ring-4 ring-black overflow-hidden bg-panel2 shadow-2xl">
                <TokenLogo src={icon} sym={symbol} size={64} />
              </div>
              {verified && (
                <div className="absolute -bottom-1 -right-1 bg-accent rounded-full p-0.5 shadow-glow-blue">
                  <BadgeCheck className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            {/* Price */}
            <div className="text-right pb-1">
              <div className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {fmtUsd(price)}
              </div>
              <div className="flex flex-wrap justify-end gap-1 mt-1">
                <ChangePill label="5m"  v={t.change5m} />
                <ChangePill label="1h"  v={t.change1h} />
                <ChangePill label="24h" v={t.change24h ?? meta.priceChange24h} />
              </div>
            </div>
          </div>

          {/* Name + badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <h1 className="font-display text-lg font-extrabold text-white">{symbol}</h1>
            <span className="text-muted text-sm">{name}</span>
            {verified && <Verified size={14} />}
            {d.verdict && <span className="pill bg-accent/15 text-accent text-[10px] font-bold">{d.verdict}</span>}
            {meta.isPumpFun && <span className="pill text-[10px]" style={{ background: "rgba(153,69,255,0.15)", color: "#c084fc" }}>pump.fun</span>}
            {(t.tags || []).slice(0, 3).map((tg: string) => (
              <span key={tg} className="pill bg-panel2 text-muted text-[10px] capitalize">{tg}</span>
            ))}
            {score != null && (
              <span className={`pill text-[10px] font-bold ${scoreColor} ${score >= 70 ? "bg-up/10" : score >= 45 ? "bg-accent/10" : "bg-down/10"}`}>
                OG {Math.round(score)}/100
              </span>
            )}
          </div>

          {/* Bio */}
          {(meta.description || meta.bio) && (
            <p className="text-[12px] text-muted/85 leading-relaxed mt-1 mb-2.5 max-w-2xl">
              {meta.description || meta.bio}
            </p>
          )}

          {/* Social links + CA */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-3">
            {meta.socials?.website  && <SocialPill href={meta.socials.website}  icon={<Globe       className="w-3 h-3" />} label="Website" />}
            {meta.socials?.twitter  && <SocialPill href={meta.socials.twitter}  icon={<svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>} label="X" accent />}
            {meta.socials?.telegram && <SocialPill href={meta.socials.telegram} icon={<Send        className="w-3 h-3" />} label="Telegram" />}
            {meta.socials?.discord  && <SocialPill href={meta.socials.discord}  icon={<MessageCircle className="w-3 h-3" />} label="Discord" />}
            <SocialPill href={`https://solscan.io/token/${mint}`}       icon={<ExternalLink className="w-3 h-3" />} label="Solscan" />
            <SocialPill href={`https://dexscreener.com/solana/${mint}`} icon={<ExternalLink className="w-3 h-3" />} label="DexScreener" />
            {/* CA copy */}
            <button onClick={copy}
              className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono bg-panel2 border border-line text-muted hover:text-white hover:border-accent/40 transition-all group">
              <span>{short(mint)}</span>
              {copied ? <Check className="w-3 h-3 text-up shrink-0" /> : <Copy className="w-3 h-3 shrink-0 group-hover:text-accent" />}
            </button>
          </div>

          {/* CTA buttons — slim */}
          <div className="flex flex-wrap gap-2">
            <a href="#trade"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity shadow-glow-blue"
              style={{ background: "linear-gradient(135deg, #2F80FF, #9945FF)" }}>
              <Zap className="w-3.5 h-3.5" /> Buy / Sell
            </a>
            <a href={`/api/ogdex/report?mint=${mint}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-panel2 border border-line text-muted hover:text-white hover:border-accent/40 transition-all">
              <FileDown className="w-3.5 h-3.5" /> Report
            </a>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          STATS STRIP (single source of truth)
          ══════════════════════════════════════ */}
      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div className="flex gap-2 w-max">
          <StatPill label="Market Cap"  value={fmtUsd(t.mcap ?? meta.mcap, { compact: true })} />
          <StatPill label="Volume 24h"  value={t.volume != null ? "$" + compact(t.volume) : "—"} />
          <StatPill label="Liquidity"   value={t.liquidity != null ? "$" + compact(t.liquidity) : "—"} />
          <StatPill label="Holders"     value={fmtNum(meta.holderCount ?? t.holderCount ?? safety?.totalHolders)} />
          <StatPill label="FDV"         value={fmtUsd(t.fdv ?? meta.fdv, { compact: true })} />
          {athMcap != null && <StatPill label="ATH MCap" value={fmtUsd(athMcap, { compact: true })} sub={fromAthPct != null ? (fromAthPct >= 0 ? "+" : "") + fromAthPct.toFixed(0) + "% ATH" : undefined} />}
          <StatPill label="OG Score"    value={score != null ? Math.round(score) + "/100" : "—"} accent={score != null && score >= 60} />
          <StatPill label="Token Age"   value={meta.ageDays != null ? meta.ageDays + "d" : "—"} />
          <StatPill label="Whales"      value={String(whales)} sub={whales === 0 ? "healthy" : "concentrated"} />
          <StatPill label="Risk"        value={safety?.riskScore != null ? String(safety.riskScore) : "—"} />
        </div>
      </div>

      {/* Trust verdict */}
      <TrustPanel d={d} />

      {/* Chart + Trade */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className={(meta.chain || "solana") === "solana" ? "lg:col-span-2" : "lg:col-span-3"}>
          <PriceChart mint={mint} symbol={symbol} chain={(meta.chain || "solana")} />
        </div>
        {(meta.chain || "solana") === "solana" && (
          <div id="trade" className="lg:col-span-1 scroll-mt-20">
            <TradePanel mint={mint} symbol={symbol} price={t.priceUsd ?? meta.priceUsd} icon={icon} />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          PREMIUM TAB WHEEL
          ══════════════════════════════════════ */}
      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div className="flex gap-1 w-max">
          {TABS.map(([id, label]) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id as any)}
                className={`relative flex-shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  active ? "text-accent" : "text-muted hover:text-white hover:bg-panel2/60"
                }`}
                style={active ? {
                  background: "linear-gradient(135deg, rgba(47,128,255,0.18), rgba(153,69,255,0.12))",
                  border: "1px solid rgba(47,128,255,0.35)",
                  boxShadow: "0 0 14px rgba(47,128,255,0.14)",
                } : { border: "1px solid transparent" }}>
                {label}
                {active && <span className="absolute -bottom-px left-1/4 right-1/4 h-0.5 rounded-full bg-accent opacity-80" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <ErrorBoundary key={tab} label="this tab">
        {tab === "overview"   && <Overview d={d} t={t} meta={meta} safety={safety} trades={trades} ath={ath} score={score} whales={whales} />}
        {tab === "chat"       && <CoinChat d={d} forensics={forensics} ath={ath} />}
        {tab === "predictive" && <PredictiveIntel d={d} />}
        {tab === "smartmoney" && <CapitalFlow d={d} />}
        {tab === "kolwhale"   && <KolWhaleActivity d={d} dir={dir} />}
        {tab === "holders"    && <><HolderIntel holders={holders} safety={safety} dir={dir} /><HoldersTable holders={holders} price={price} dir={dir} /></>}
        {tab === "trades"     && <TradesTable trades={trades} mint={mint} dir={dir} onRefresh={() => getToken(mint).then(setD)} />}
        {tab === "xray"       && <RiskXray x={xray} loading={xrayLoading} />}
        {tab === "forensics"  && <><DevOrigin f={forensics} loading={forLoading} /><Forensics d={d} meta={meta} safety={safety} /></>}
      </ErrorBoundary>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Overview tab  (includes OG Score + Forensic Scores, no duplicates)
───────────────────────────────────────────── */
function Overview({ d, t, meta, safety, trades, ath, score, whales }: any) {
  const buyVol  = meta.buyVolume24h ?? t.buyVolume ?? 0;
  const sellVol = meta.sellVolume24h ?? t.sellVolume ?? 0;
  const total   = buyVol + sellVol || 1;
  const bp      = (buyVol / total) * 100;
  const buys    = trades.filter((x: any) => x.side === "buy").length;
  const sells   = trades.filter((x: any) => x.side === "sell").length;
  const tf      = t.stats || {};
  const windows: [string, string][] = [["5m","5m"],["1h","1H"],["6h","6H"],["24h","24H"]];

  return (
    <div className="space-y-3">

      {/* OG Score + Forensic Scores */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="card p-5 flex flex-col items-center justify-center text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-3">OG Score</div>
          <ScoreRing value={score} label="/ 100" size={120} />
          {(d.momentumLabel || meta.momentumLabel) && (
            <div className="mt-3 inline-flex pill bg-panel2 text-muted capitalize">
              Momentum: {(d.momentumLabel || meta.momentumLabel)?.replace(/[^\w\s]/g, "")}
            </div>
          )}
        </div>
        <div className="card p-5 lg:col-span-2">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /> Forensic Scores</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {d.score?.signals && Object.entries(d.score.signals).map(([k, v]: any) => <MiniScore key={k} label={k} value={v} />)}
            <MiniScore label="organic"  value={Math.round(t.organicScore ?? 0)} />
            <MiniScore label="momentum" value={d.momentum ?? meta.momentum} />
            <MiniScore label="risk"     value={safety?.riskScore} invert />
          </div>
          <div className="mt-4 pt-3 border-t border-line space-y-1.5 text-xs">
            <Signal ok={d.flags?.mintAuthorityDisabled}   text="Mint authority renounced" />
            <Signal ok={d.flags?.freezeAuthorityDisabled} text="Freeze authority renounced" />
            <Signal ok={!d.flags?.lpPulled}               text="Liquidity intact — no LP pull detected" />
            <Signal ok={d.flags?.minLiquidity}            text="Sufficient liquidity depth" />
            <Signal ok={!d.score?.isPumpFunClone}         text="Original deployment — not a detected clone" />
            <Signal ok={whales === 0}                     text={whales === 0 ? "No >5% whale concentration" : `${whales} whale wallet(s) hold >5%`} />
          </div>
        </div>
      </div>

      {/* Performance by Timeframe */}
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent" /> Performance by Timeframe</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead><tr className="text-muted text-xs border-b border-line">
              <th className="text-left py-2">Window</th>
              <th className="text-right py-2">Price Δ</th>
              <th className="text-right py-2">Volume</th>
              <th className="text-right py-2">Vol Δ</th>
              <th className="text-right py-2">Liq Δ</th>
              <th className="text-right py-2">Holders Δ</th>
              <th className="text-right py-2">Buys</th>
              <th className="text-right py-2">Sells</th>
              <th className="text-right py-2">Traders</th>
              <th className="text-right py-2">Net buyers</th>
            </tr></thead>
            <tbody>
              {windows.map(([k, label]) => { const w = tf[k] || {}; return (
                <tr key={k} className="border-b border-line/30 last:border-0 hover:bg-panel2/30 transition-colors">
                  <td className="py-2 font-bold">{label}</td>
                  <td className="py-2 text-right"><Change v={w.priceChange} /></td>
                  <td className="py-2 text-right tabular-nums">{w.volume != null ? "$" + compact(w.volume) : "—"}</td>
                  <td className="py-2 text-right"><Change v={w.volumeChange ?? w.volumeChange24h} /></td>
                  <td className="py-2 text-right"><Change v={w.liquidityChange} /></td>
                  <td className="py-2 text-right"><Change v={w.holdersChange} /></td>
                  <td className="py-2 text-right tabular-nums text-up font-medium">{fmtNum(w.numBuys)}</td>
                  <td className="py-2 text-right tabular-nums text-down font-medium">{fmtNum(w.numSells)}</td>
                  <td className="py-2 text-right tabular-nums">{fmtNum(w.numTraders)}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${(w.numNetBuyers ?? 0) >= 0 ? "text-up" : "text-down"}`}>{fmtNum(w.numNetBuyers)}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Market data + Microstructure */}
      <div className="grid lg:grid-cols-2 gap-3">
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Flame className="w-4 h-4 text-accent" /> Market Microstructure</div>
          <div className="text-[11px] text-muted mb-1 flex justify-between">
            <span>Buy pressure 24h</span><span className="font-semibold text-white">{bp.toFixed(0)}% buys</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-panel2 mb-4">
            <div className="bg-up h-full rounded-l-full" style={{ width: `${bp}%` }} />
            <div className="bg-down h-full rounded-r-full" style={{ width: `${100 - bp}%` }} />
          </div>
          <Row label="Buy volume 24h"      value={"$" + compact(buyVol)} />
          <Row label="Sell volume 24h"     value={"$" + compact(sellVol)} />
          <Row label="Buys / Sells 24h"    value={`${fmtNum(meta.numBuys24h)} / ${fmtNum(meta.numSells24h)}`} />
          <Row label="Total txns 24h"      value={fmtNum(meta.txns24h)} />
          <Row label="Active traders 24h"  value={fmtNum(meta.numTraders24h)} />
          <Row label="Net buyers 24h"      value={fmtNum(meta.netBuyers24h)} />
          <Row label="Organic buy vol 24h" value={meta.organicBuyVol24h ? "$" + compact(meta.organicBuyVol24h) : "—"} />
          <Row label="Recent feed"         value={`${buys} buys / ${sells} sells`} />
        </div>
        <div className="card p-5">
          <div className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent" /> Market Intelligence</div>
          <Row label="Price"         value={fmtUsd(t.priceUsd ?? meta.priceUsd)} />
          <Row label="Market cap"    value={fmtUsd(t.mcap ?? meta.mcap, { compact: true })} />
          <Row label="FDV"           value={fmtUsd(t.fdv ?? meta.fdv, { compact: true })} />
          <Row label="Liquidity"     value={t.liquidity ? "$" + compact(t.liquidity) : "—"} />
          <Row label="All-time high" value={ath?.athMcap != null ? fmtUsd(ath.athMcap, { compact: true }) + (ath.fromAthPct != null ? ` (${ath.fromAthPct >= 0 ? "+" : ""}${ath.fromAthPct.toFixed(0)}%)` : "") : "—"} />
          <Row label="ATH price"     value={ath?.athPrice != null ? fmtUsd(ath.athPrice) : "—"} />
          {ath?.source && <Row label="ATH source" value={<span className="text-muted/70 text-xs capitalize">{ath.source.replace("_", " ")}</span>} />}
          <Row label="Total supply"  value={compact(t.totalSupply ?? meta.totalSupply)} />
          <Row label="Circulating"   value={compact(t.circSupply ?? meta.circSupply)} />
          <Row label="Created"       value={meta.createdAt ? new Date(meta.createdAt).toLocaleDateString() + (meta.ageDays != null ? ` (${meta.ageDays}d)` : "") : "—"} />
          <Row label="DEX / pair"    value={meta.pairDexId || "—"} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Holder Intel
───────────────────────────────────────────── */
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
          <div key={i} className="flex items-start gap-2 text-[12px] text-white/80">
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
          <div className="flex gap-1.5 flex-wrap">{kolHolders.slice(0, 8).map((h) => <span key={h.owner} className="pill bg-accent/10 text-accent text-[10px]">{dir[h.owner].name}</span>)}</div>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" /> Top {holders.length} Holders
          <span className="text-muted font-normal text-xs ml-1">KOLs & exchanges labeled · click wallet to view</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="text-muted text-xs border-b border-line bg-panel2/30">
              <th className="text-left px-4 py-2.5 w-8">#</th>
              <th className="text-left px-2 py-2.5">Wallet</th>
              <th className="text-left px-2 py-2.5">Type</th>
              <th className="text-right px-2 py-2.5">Amount</th>
              <th className="text-left px-2 py-2.5 w-36">Supply %</th>
              <th className="text-right px-4 py-2.5">USD Value</th>
            </tr></thead>
            <tbody>
              {holders.map((h) => (
                <tr key={h.rank} className="border-b border-line/40 last:border-0 hover:bg-panel2/40 transition-colors">
                  <td className="px-4 py-2 text-muted text-xs">{h.rank}</td>
                  <td className="px-2 py-2">{(() => {
                    const lbl = getWalletLabel(h.owner);
                    return dir[h.owner]
                      ? <KolBadge kol={dir[h.owner]} />
                      : lbl
                        ? <span className="inline-flex items-center gap-1.5"><span className={`pill text-[10px] ${labelKindClass(lbl.kind)}`}>{lbl.name}</span><WalletLink address={h.owner} icon={false} className="text-[11px] text-muted" /></span>
                        : <WalletLink address={h.owner} />;
                  })()}</td>
                  <td className="px-2 py-2"><span className={`pill text-[10px] ${labelCls(h.label)}`}>{getWalletLabel(h.owner)?.kind || h.label}</span></td>
                  <td className="px-2 py-2 text-right tabular-nums text-xs">{compact(h.uiAmount)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-panel2 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${((h.pct || 0) / maxPct) * 100}%` }} />
                      </div>
                      <span className="text-xs w-12 text-right tabular-nums">{h.pct != null ? h.pct.toFixed(2) + "%" : "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs">{price && h.uiAmount ? fmtUsd(h.uiAmount * price, { compact: true }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Live Trades
───────────────────────────────────────────── */
function TradesTable({ trades, mint, dir = {}, onRefresh }: { trades: any[]; mint: string; dir?: Record<string, KolDirEntry>; onRefresh: () => void }) {
  const [auto, setAuto] = useState(true);
  useEffect(() => { if (!auto) return; const id = setInterval(onRefresh, 15000); return () => clearInterval(id); }, [auto, onRefresh]);
  if (!trades.length) return <Empty text="No recent trades available." />;
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-line text-sm font-semibold flex items-center gap-2">
        <Activity className="w-4 h-4 text-accent" /> Live Trades
        <span className="pill bg-up/10 text-up text-[10px] inline-flex items-center gap-1"><Radio className="w-3 h-3 animate-pulse" /> LIVE</span>
        <div className="ml-auto flex gap-1.5">
          <button onClick={() => setAuto((a) => !a)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${auto ? "bg-up/15 text-up border-up/30" : "bg-panel2 text-muted border-line hover:text-white"}`}>
            <Radio className={`w-3 h-3 ${auto ? "animate-pulse" : ""}`} /> {auto ? "Auto" : "Paused"}
          </button>
          <button onClick={onRefresh}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-panel2 border border-line text-muted hover:text-white transition-all">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="sticky top-0 bg-panel"><tr className="text-muted text-xs border-b border-line">
            <th className="text-left px-4 py-2">Time</th>
            <th className="text-left px-2 py-2">Side</th>
            <th className="text-right px-2 py-2">Price</th>
            <th className="text-right px-2 py-2">Amount</th>
            <th className="text-right px-2 py-2">USD</th>
            <th className="text-left px-2 py-2">Trader</th>
            <th className="text-left px-2 py-2">Tag</th>
            <th className="text-left px-4 py-2">DEX</th>
          </tr></thead>
          <tbody>
            {trades.map((tr, i) => (
              <tr key={i} className="border-b border-line/40 last:border-0 hover:bg-panel2/40 transition-colors">
                <td className="px-4 py-2 text-muted text-xs">{timeAgo(tr.time)} ago</td>
                <td className={`px-2 py-2 font-bold text-xs ${tr.side === "buy" ? "text-up" : "text-down"}`}>{tr.side?.toUpperCase()}</td>
                <td className="px-2 py-2 text-right tabular-nums text-xs">{fmtUsd(tr.priceUsd)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-xs">{compact(tr.tokenAmount)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-xs">{fmtUsd(tr.volumeUsd, { compact: true })}</td>
                <td className="px-2 py-2 text-xs">{tr.owner ? <WalletLink address={tr.owner} icon={false} /> : "—"}</td>
                <td className="px-2 py-2 text-xs">
                  {dir[tr.owner] ? <span className="pill bg-accent/15 text-accent text-[9px]">{dir[tr.owner].name}</span>
                    : getWalletLabel(tr.owner) ? <span className={`pill text-[9px] ${labelKindClass(getWalletLabel(tr.owner)!.kind)}`}>{getWalletLabel(tr.owner)!.name}</span>
                    : (tr.volumeUsd >= 1000 ? <span className="pill bg-yellow-400/15 text-yellow-300 text-[9px]">whale</span> : <span className="text-muted/40 text-xs">—</span>)}
                </td>
                <td className="px-4 py-2 text-muted text-xs">
                  {tr.dex || "—"}
                  {tr.txHash && <a href={`https://solscan.io/tx/${tr.txHash}`} target="_blank" rel="noreferrer" className="ml-1.5 text-accent/70 hover:text-accent"><ExternalLink className="w-3 h-3 inline" /></a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Forensics tab
───────────────────────────────────────────── */
function Forensics({ d, meta, safety }: any) {
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-accent" /> Developer Intelligence</div>
        <Row label="Creator wallet"      value={safety?.creator ? <WalletLink address={safety.creator} /> : "—"} />
        <Row label="Tokens created"      value={safety?.creatorTokensCount != null ? String(safety.creatorTokensCount) : "—"} />
        <Row label="Mint authority"      value={d.flags?.mintAuthorityDisabled ? "Renounced" : "Active"} good={d.flags?.mintAuthorityDisabled} />
        <Row label="Freeze authority"    value={d.flags?.freezeAuthorityDisabled ? "Renounced" : "Active"} good={d.flags?.freezeAuthorityDisabled} />
        <Row label="Unsafe authority"    value={d.flags?.unsafeAuthority ? "Yes" : "No"} good={!d.flags?.unsafeAuthority} />
        <Row label="Launchpad"           value={(safety?.launchpad && typeof safety.launchpad === "object" ? safety.launchpad.name : safety?.launchpad) || (meta.isPumpFun ? "pump.fun" : "—")} />
        <Row label="Migrated pump.fun"   value={d.flags?.migratedFromPumpFun ? "Yes" : "No"} />
        <Row label="Deployer exit risk"  value={d.flags?.mintAuthorityDisabled && d.flags?.freezeAuthorityDisabled ? "Very Low" : "Elevated"} good={d.flags?.mintAuthorityDisabled && d.flags?.freezeAuthorityDisabled} />
      </div>
      <div className="card p-5">
        <div className="text-sm font-semibold mb-3 flex items-center gap-2">
          {safety?.rugged ? <ShieldAlert className="w-4 h-4 text-down" /> : <ShieldCheck className="w-4 h-4 text-up" />} Liquidity & Safety
        </div>
        <Row label="Risk score"   value={safety?.riskScore != null ? String(safety.riskScore) : "—"} good={(safety?.riskScore ?? 99) <= 20} />
        <Row label="Rugged"       value={safety?.rugged ? "Yes" : "No"} good={!safety?.rugged} />
        <Row label="LP locked"    value={safety?.lpLockedPct != null ? safety.lpLockedPct.toFixed(0) + "%" : "—"} good={(safety?.lpLockedPct ?? 0) > 50} />
        <Row label="Min liquidity" value={d.flags?.minLiquidity ? "Yes" : "No"} good={d.flags?.minLiquidity} />
        <Row label="LP pulled"    value={d.flags?.lpPulled ? "Yes" : "No"} good={!d.flags?.lpPulled} />
        {Array.isArray(safety?.risks) && safety.risks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line space-y-1.5">
            <div className="text-xs text-muted mb-1">Risk flags</div>
            {safety.risks.slice(0, 6).map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${r.level === "danger" ? "text-down" : "text-yellow-400"}`} />
                <span className="text-muted">{r.name}{r.desc ? ` — ${r.desc}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Shared primitives
───────────────────────────────────────────── */
function MiniScore({ label, value, invert }: { label: string; value?: number | null; invert?: boolean }) {
  const v = value ?? null;
  const good  = v == null ? false : invert ? v <= 30 : v >= 60;
  const mid   = v == null ? false : invert ? v <= 60 : v >= 40;
  const color = v == null ? "text-muted" : good ? "text-up" : mid ? "text-accent" : "text-down";
  return (
    <div className="bg-panel2 rounded-xl p-2.5 text-center">
      <div className={`text-lg font-bold ${color}`}>{v == null ? "—" : Math.round(v)}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted capitalize">{label.replace(/([A-Z])/g, " $1")}</div>
    </div>
  );
}

function Signal({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 ${ok ? "text-up" : "text-down"}`}>
        {ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
      </span>
      <span className="text-muted">{text}</span>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: any; good?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-line/40 last:border-0 text-sm">
      <span className="text-muted shrink-0">{label}</span>
      <span className={`font-medium text-right ${good === true ? "text-up" : good === false ? "text-down" : ""}`}>{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card p-10 text-center text-muted text-sm">{text}</div>;
}

function labelCls(l: string) {
  if (l === "whale")          return "bg-down/15 text-down";
  if (l === "large holder")   return "bg-yellow-500/15 text-yellow-400";
  if (l === "liquidity pool") return "bg-accent2/15 text-accent2";
  if (l === "burn")           return "bg-panel2 text-muted";
  return "bg-up/10 text-up";
}
