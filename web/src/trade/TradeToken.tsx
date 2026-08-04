/**
 * /trade/token/:mint — full DEX coin data (same APIs as ORBITX_DEX TokenDetail).
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useConnection } from "@solana/wallet-adapter-react";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { useTradeWalletPicker } from "./TradeWalletPicker";
import { PublicKey } from "@solana/web3.js";
import {
  ArrowLeft, Copy, Check, ExternalLink, Loader2, Shield, Users, Activity,
  Globe, Send, MessageCircle, FileDown, Flame, AlertTriangle, BarChart2, Wallet,
} from "lucide-react";
import {
  askCoinChat,
  fetchTokenBundle,
  fetchTokenOnly,
  fetchWallet,
  findWalletPnlToken,
} from "./tradeApi";
import { dexChartUrl, fmtNum, fmtPct, fmtPnl, fmtTok, fmtUsd, shortAddr, timeAgo } from "./tradeFmt";

type TabId =
  | "overview"
  | "holders"
  | "traders"
  | "trades"
  | "safety"
  | "xray"
  | "forensics"
  | "ath"
  | "ai";

function cell(v: any): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="min-w-[96px] shrink-0 rounded-xl border border-white/10 bg-[#050505] px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider text-white/30">{label}</p>
      <p
        className={`font-mono text-sm font-semibold ${
          tone === "up" ? "text-green-400" : tone === "down" ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ChangePill({ label, v }: { label: string; v?: number | null }) {
  if (v == null || !Number.isFinite(v)) return null;
  const pos = v >= 0;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
        pos ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
      }`}
    >
      {label} {fmtPct(v)}
    </span>
  );
}

function DexChart({ refId }: { refId: string }) {
  const [ready, setReady] = useState(false);
  const [mount, setMount] = useState(false);
  useEffect(() => {
    setReady(false);
    setMount(true);
  }, [refId]);
  return (
    <div className="relative mx-4 mt-3 overflow-hidden rounded-xl border border-white/10 bg-black" style={{ height: 360 }}>
      {(!mount || !ready) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          <p className="text-[11px] text-white/30">Loading chart…</p>
        </div>
      )}
      {mount && (
        <iframe
          title="DexScreener"
          src={dexChartUrl(refId)}
          className="h-full w-full border-0"
          style={{ colorScheme: "dark" }}
          allow="clipboard-write"
          onLoad={() => setReady(true)}
        />
      )}
    </div>
  );
}

function KvGrid({ rows }: { rows: [string, any][] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {rows.map(([label, val]) => (
        <div key={label} className="rounded-lg bg-black/50 px-2.5 py-2">
          <p className="text-[9px] text-white/30">{label}</p>
          <p className="break-all font-mono text-xs text-white/90">{cell(val)}</p>
        </div>
      ))}
    </div>
  );
}

export default function TradeToken() {
  const { mint = "" } = useParams();
  const navigate = useNavigate();
  const {
    publicKey,
    ready: tradeReady,
    localActive,
    label: activeLabel,
    shortAddress,
  } = useActiveTradingWallet();
  const { openPicker, picker } = useTradeWalletPicker();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [d, setD] = useState<any>(null);
  const [safetyApi, setSafetyApi] = useState<any>(null);
  const [traders, setTraders] = useState<any[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [holderCountTotal, setHolderCountTotal] = useState<number | null>(null);
  const [pool, setPool] = useState<string | null>(null);
  const [forensics, setForensics] = useState<any>(null);
  const [ath, setAth] = useState<any>(null);
  const [xray, setXray] = useState<any>(null);
  const [research, setResearch] = useState<any>(null);
  const [tradeTape, setTradeTape] = useState<any[]>([]);
  const [aiQ, setAiQ] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsgs, setAiMsgs] = useState<{ role: string; content: string }[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [posAmount, setPosAmount] = useState(0);
  const [posWorth, setPosWorth] = useState<number | null>(null);
  const [posUnreal, setPosUnreal] = useState<number | null>(null);
  const [posUnrealPct, setPosUnrealPct] = useState<number | null>(null);
  const [posCost, setPosCost] = useState<number | null>(null);

  const loadBundle = (m: string) => {
    setLoading(true);
    return fetchTokenBundle(m).then((b) => {
      setD(b.token);
      setSafetyApi(b.safety);
      setTraders(Array.isArray(b.traders?.traders) ? b.traders.traders : []);
      setHolders(Array.isArray(b.traders?.holders) ? b.traders.holders : []);
      {
        const hc = Number(b.holderCount ?? b.traders?.holderCount ?? b.token?.meta?.holderCount ?? b.token?.token?.holderCount);
        setHolderCountTotal(Number.isFinite(hc) && hc > 0 ? hc : null);
      }
      setPool(b.chart?.pool || null);
      setForensics(b.forensics);
      setAth(b.ath);
      setXray(b.xray);
      setResearch(b.research);
      setTradeTape(Array.isArray(b.tradeTape) ? b.tradeTape : []);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!mint) return;
    try {
      sessionStorage.setItem("orbitx.trade.lastMint", mint);
    } catch {
      /* ignore */
    }
    let on = true;
    setTab("overview");
    setAiMsgs([]);
    loadBundle(mint).then(() => {
      if (!on) return;
    });
    return () => {
      on = false;
    };
  }, [mint]);

  // Live refresh like DEX
  useEffect(() => {
    if (!mint) return;
    const id = window.setInterval(() => {
      fetchTokenOnly(mint).then((x) => x && setD(x));
    }, 12000);
    return () => window.clearInterval(id);
  }, [mint]);

  /* Compact live position for this mint (token page strip) */
  useEffect(() => {
    if (!mint || !publicKey) {
      setPosAmount(0);
      setPosWorth(null);
      setPosUnreal(null);
      setPosUnrealPct(null);
      setPosCost(null);
      return;
    }
    let on = true;
    let costUsd: number | null = null;
    let avgCost: number | null = null;
    let cachePx: number | null = null;
    let cacheHoldAmt: number | null = null;
    let cacheHoldUsd: number | null = null;
    let cacheUnreal: number | null = null;
    let cacheUnrealPct: number | null = null;

    const refreshCost = async () => {
      try {
        const w = await fetchWallet(publicKey.toBase58());
        if (!on || !w?.ok) return;
        const row = findWalletPnlToken(w, mint);
        const hold = Array.isArray(w?.holdings)
          ? w.holdings.find((h: any) => h?.mint === mint)
          : null;
        costUsd = row?.costUsd ?? null;
        avgCost = row?.avgCostUsd ?? null;
        cachePx = row?.curPriceUsd ?? (hold?.priceUsd != null ? Number(hold.priceUsd) : null);
        cacheHoldAmt =
          row?.holdingAmount ??
          (hold?.uiAmount != null ? Number(hold.uiAmount) : null);
        cacheHoldUsd =
          row?.holdingUsd ??
          row?.potUsd ??
          (hold?.usdValue != null ? Number(hold.usdValue) : null);
        cacheUnreal = row?.unrealizedUsd ?? null;
        cacheUnrealPct = row?.unrealizedPct ?? null;
        if (costUsd != null) setPosCost(costUsd);
      } catch {
        /* keep */
      }
    };

    const tick = async () => {
      try {
        let amount = 0;
        try {
          const accs = await connection.getParsedTokenAccountsByOwner(publicKey, {
            mint: new PublicKey(mint),
          });
          for (const a of accs.value) {
            const ui = Number(a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0);
            if (Number.isFinite(ui)) amount += ui;
          }
        } catch {
          /* RPC blip */
        }
        if (!(amount > 0) && cacheHoldAmt != null && cacheHoldAmt > 0) {
          amount = cacheHoldAmt;
        }
        if (!on) return;
        const pagePx =
          Number(
            (d?.token || {}).priceUsd ??
              (d?.meta || {}).priceUsd ??
              d?.raw?.priceUsd,
          ) || 0;
        const px = pagePx > 0 ? pagePx : cachePx && cachePx > 0 ? cachePx : 0;
        const worth =
          px > 0 && amount > 0
            ? amount * px
            : amount > 0
              ? cacheHoldUsd != null && cacheHoldUsd > 0
                ? cacheHoldUsd
                : null
              : 0;
        let c = costUsd;
        if (c == null && avgCost != null && amount > 0) c = avgCost * amount;
        // Skip identical ticks so 1s polling doesn't re-render while typing.
        setPosAmount((prev) => (prev === amount ? prev : amount));
        setPosWorth((prev) => (prev === worth ? prev : worth));
        if (worth != null && c != null && c > 0) {
          const u = worth - c;
          const pct = (u / c) * 100;
          setPosUnreal((prev) => (prev === u ? prev : u));
          setPosUnrealPct((prev) => (prev === pct ? prev : pct));
          setPosCost((prev) => (prev === c ? prev : c));
        } else if (cacheUnreal != null && Number.isFinite(cacheUnreal)) {
          setPosUnreal((prev) => (prev === cacheUnreal ? prev : cacheUnreal));
          setPosUnrealPct((prev) =>
            prev === cacheUnrealPct ? prev : cacheUnrealPct,
          );
          if (c != null) setPosCost((prev) => (prev === c ? prev : c));
        } else {
          setPosUnreal((prev) => (prev == null ? prev : null));
          setPosUnrealPct((prev) => (prev == null ? prev : null));
          if (c != null) setPosCost((prev) => (prev === c ? prev : c));
        }
      } catch {
        /* keep last good amount */
      }
    };

    void refreshCost().then(() => tick());
    const balIv = window.setInterval(() => void tick(), 1000);
    const costIv = window.setInterval(() => void refreshCost(), 12_000);
    return () => {
      on = false;
      window.clearInterval(balIv);
      window.clearInterval(costIv);
    };
  }, [mint, publicKey, connection, d]);

  const connectWallet = () => openPicker();

  const t: any = d?.token || {};
  const meta: any = d?.meta || {};
  const intel: any = d?.intel || {};
  const safety = d?.safety || intel.safety || safetyApi || null;
  const symbol = t.symbol || meta.symbol || shortAddr(mint, 4);
  const name = t.name || meta.name || "";
  const icon = t.icon || meta.icon || meta.image || d?.raw?.info?.imageUrl;
  const price = Number(t.priceUsd ?? meta.priceUsd ?? d?.raw?.priceUsd) || 0;
  const mcap = Number(t.mcap ?? meta.mcap ?? d?.raw?.marketCap) || 0;
  const fdv = Number(t.fdv ?? meta.fdv) || 0;
  const vol = Number(t.volume ?? t.volume24h) || 0;
  const liq = Number(t.liquidity) || 0;
  const ch24 = Number(t.change24h ?? meta.priceChange24h) || 0;
  const ch1h = t.change1h != null ? Number(t.change1h) : null;
  const ch5m = t.change5m != null ? Number(t.change5m) : null;
  const ch6h = t.change6h != null ? Number(t.change6h) : null;
  const score = d?.score?.total ?? meta.organicScore;
  const verdict = d?.verdict;
  const verified = t.isVerified || meta.isVerifiedJup || d?.flags?.isVerified;
  const chartRef = pool || t.pairAddress || mint;
  const trades: any[] = tradeTape.length
    ? tradeTape
    : intel.trades || t.recentTrades || [];
  const holderList = (holders.length ? holders : intel.holders || []) as any[];
  const whales = holderList.filter((h) => h.label === "whale").length;
  // Total holders — never the truncated top-holders list length.
  const totalHolders =
    holderCountTotal ??
    (meta.holderCount != null ? Number(meta.holderCount) : null) ??
    (t.holderCount != null ? Number(t.holderCount) : null) ??
    (safety?.totalHolders != null ? Number(safety.totalHolders) : null) ??
    (intel?.holderCount != null &&
    !(holderList.length > 0 && Number(intel.holderCount) === holderList.length && Number(intel.holderCount) <= 100)
      ? Number(intel.holderCount)
      : null);
  const socials = meta.socials || {};
  const website = socials.website || meta.website || d?.raw?.info?.websites?.[0]?.url;
  const twitter = socials.twitter || meta.twitter;
  const telegram = socials.telegram || meta.telegram;
  const discord = socials.discord;
  const buyVol = Number(t.buyVolume) || 0;
  const sellVol = Number(t.sellVolume) || 0;
  const buyPct = buyVol + sellVol > 0 ? Math.round((buyVol / (buyVol + sellVol)) * 100) : null;

  const tabs = useMemo(
    () =>
      [
        ["overview", "Overview"],
        ["holders", totalHolders != null ? `Holders (${fmtNum(totalHolders)})` : "Holders"],
        ["traders", `Traders${traders.length ? ` (${traders.length})` : ""}`],
        ["trades", `Trades${trades.length ? ` (${trades.length})` : ""}`],
        ["safety", "Safety"],
        ["xray", "X-ray"],
        ["forensics", "Forensics"],
        ["ath", "ATH"],
        ["ai", "Ask AI"],
      ] as [TabId, string][],
    [totalHolders, traders.length, trades.length],
  );

  const copy = () => {
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const askAi = async () => {
    const q = aiQ.trim();
    if (!q || aiBusy) return;
    setAiBusy(true);
    const next = [...aiMsgs, { role: "user", content: q }];
    setAiMsgs(next);
    setAiQ("");
    const res = await askCoinChat(mint, next, { token: t, meta, safety, ath, forensics, xray });
    setAiMsgs([...next, { role: "assistant", content: res?.answer || res?.error || "No answer" }]);
    setAiBusy(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#05080c]">
        <Loader2 className="h-7 w-7 animate-spin text-[#3de7ff]/60" />
      </div>
    );
  }

  if (!d || (!d.token && !d.meta)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#05080c] px-6 text-center">
        <p className="text-sm text-white/40">No token found for this address</p>
        <button type="button" onClick={() => navigate("/trade")} className="text-sm text-[#3de7ff] underline">
          Back to markets
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-y-auto overscroll-contain pb-44"
      style={{
        background:
          "radial-gradient(ellipse 80% 40% at 50% -8%, rgba(61,231,255,0.1), transparent 55%), #05080c",
      }}
    >
      {picker}
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[rgba(61,231,255,0.14)] bg-[#05080c]/92 px-3 py-3 backdrop-blur">
        <button type="button" onClick={() => navigate(-1)} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold">{symbol}</p>
            {verified && <span className="rounded bg-[#3de7ff]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#3de7ff]">✓</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-[#17ff4d]/12 px-1.5 py-0.5 text-[9px] font-semibold text-[#17ff4d]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#17ff4d]" />
              Live
            </span>
          </div>
          <p className="truncate text-[11px] text-white/35">{name}</p>
        </div>
        <Link
          to={`/trade/desk/${mint}`}
          className="rounded-full bg-gradient-to-br from-[#3de7ff] to-[#2ee6c5] px-4 py-2 text-xs font-bold text-[#041016] shadow-[0_0_18px_rgba(61,231,255,0.28)]"
        >
          Trade
        </Link>
      </div>

      {/* Hero */}
      <div className="flex items-start gap-3 px-4 py-4">
        {icon ? (
          <img src={icon} alt="" className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold">
            {symbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-2xl font-bold">{fmtUsd(price)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <ChangePill label="5m" v={ch5m} />
            <ChangePill label="1h" v={ch1h} />
            <ChangePill label="6h" v={ch6h} />
            <ChangePill label="24h" v={ch24} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {verdict && <span className="rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold">{verdict}</span>}
            {meta.isPumpFun && <span className="rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 text-[10px]">pump.fun</span>}
            {score != null && (
              <span className="rounded-lg border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold">
                OG {Math.round(Number(score))}/100
              </span>
            )}
            {(t.tags || []).slice(0, 3).map((tg: string) => (
              <span key={tg} className="rounded-lg border border-white/10 px-2 py-0.5 text-[10px] text-white/40 capitalize">
                {tg}
              </span>
            ))}
          </div>
        </div>
      </div>

      {(meta.description || meta.bio) && (
        <p className="px-4 pb-2 text-[12px] leading-relaxed text-white/45">{meta.description || meta.bio}</p>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[10px] text-white/50">
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          {shortAddr(mint, 6)}
        </button>
        {website && (
          <a href={website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-white/50 hover:text-white">
            <Globe className="h-3 w-3" /> Web
          </a>
        )}
        {twitter && (
          <a href={twitter} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-white/50 hover:text-white">
            X
          </a>
        )}
        {telegram && (
          <a href={telegram} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-white/50 hover:text-white">
            <Send className="h-3 w-3" /> TG
          </a>
        )}
        {discord && (
          <a href={discord} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-white/50 hover:text-white">
            <MessageCircle className="h-3 w-3" /> Discord
          </a>
        )}
        <a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-white/50 hover:text-white">
          Solscan <ExternalLink className="h-3 w-3" />
        </a>
        <a href={`https://dexscreener.com/solana/${chartRef}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-white/50 hover:text-white">
          DexScreener <ExternalLink className="h-3 w-3" />
        </a>
        <a href={`/api/ogdex/report?mint=${mint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] text-white/50 hover:text-white">
          <FileDown className="h-3 w-3" /> Report
        </a>
      </div>

      {/* Stats strip — same fields as DEX */}
      <div className="overflow-x-auto px-4 pb-2 no-scrollbar">
        <div className="flex w-max gap-2">
          <Stat label="Market Cap" value={fmtUsd(mcap)} />
          <Stat label="Volume 24h" value={fmtUsd(vol)} />
          <Stat label="Liquidity" value={fmtUsd(liq)} />
          <Stat label="FDV" value={fmtUsd(fdv || mcap)} />
          <Stat label="Holders" value={fmtNum(totalHolders)} />
          <Stat label="OrbitX Score" value={score != null ? `${Math.round(Number(score))}/100` : "—"} />
          <Stat label="Token Age" value={meta.ageDays != null ? `${meta.ageDays}d` : "—"} />
          <Stat label="Whales" value={String(whales)} />
          <Stat label="Risk" value={cell(safety?.riskScore ?? safetyApi?.riskScore)} />
          <Stat label="Buys 24h" value={cell(t.numBuys)} tone="up" />
          <Stat label="Sells 24h" value={cell(t.numSells)} tone="down" />
          <Stat label="Traders" value={cell(t.numTraders)} />
          <Stat
            label="Net buyers"
            value={t.netBuyers != null ? `${t.netBuyers >= 0 ? "+" : ""}${t.netBuyers}` : "—"}
            tone={(t.netBuyers ?? 0) >= 0 ? "up" : "down"}
          />
          {ath?.athMcap != null && <Stat label="ATH MCap" value={fmtUsd(ath.athMcap)} />}
          {ath?.fromAthPct != null && (
            <Stat label="From ATH" value={fmtPct(ath.fromAthPct)} tone={ath.fromAthPct >= 0 ? "up" : "down"} />
          )}
          {buyPct != null && (
            <div className="min-w-[130px] shrink-0 rounded-xl border border-white/10 bg-[#050505] px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-white/30">Buy pressure</p>
              <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-red-500/30">
                <div className="h-full bg-green-400" style={{ width: `${buyPct}%` }} />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px]">
                <span className="text-green-400">{buyPct}%</span>
                <span className="text-red-400">{100 - buyPct}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tradeability (safety API) */}
      {safetyApi && (
        <div className="mx-4 mb-2 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#050505] px-3 py-2.5 text-[11px]">
          <span className="font-semibold text-white/50">Tradeability</span>
          <span className={safetyApi.canBuy ? "text-green-400" : "text-red-400"}>Buy {safetyApi.canBuy ? "OK" : "BLOCK"}</span>
          <span className={safetyApi.canSell ? "text-green-400" : "text-red-400"}>Sell {safetyApi.canSell ? "OK" : "BLOCK"}</span>
          {safetyApi.verdict && <span className="text-white/70">{safetyApi.verdict}</span>}
          {safetyApi.roundTripLossPct != null && (
            <span className="text-white/40">Round-trip loss {Number(safetyApi.roundTripLossPct).toFixed(2)}%</span>
          )}
        </div>
      )}

      <DexChart refId={chartRef} />

      {/* Tabs */}
      <div className="sticky top-0 z-[9] mt-3 border-y border-white/10 bg-[#060606]/95 backdrop-blur">
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 no-scrollbar">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold tracking-wide transition-colors ${
                tab === id ? "bg-white text-black" : "bg-white/[0.04] text-white/40 hover:text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-3 mt-3 mb-28 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{tab}</p>
          <button
            type="button"
            disabled={tabLoading}
            onClick={() => {
              setTabLoading(true);
              void loadBundle(mint).finally(() => setTabLoading(false));
            }}
            className="text-[10px] font-semibold text-white/40 underline hover:text-white/70"
          >
            {tabLoading ? "Refreshing…" : "Refresh data"}
          </button>
        </div>
        {tab === "overview" && (
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              <BarChart2 className="h-3.5 w-3.5" /> Overview
            </h3>
            <KvGrid
              rows={[
                ["Symbol", symbol],
                ["Name", name],
                ["Price", fmtUsd(price)],
                ["MCap", fmtUsd(mcap)],
                ["FDV", fmtUsd(fdv || mcap)],
                ["Volume", fmtUsd(vol)],
                ["Liquidity", fmtUsd(liq)],
                ["Holders", totalHolders != null ? fmtNum(totalHolders) : "—"],
                ["Age (days)", meta.ageDays],
                ["Launchpad", meta.launchpad || (meta.isPumpFun ? "pump.fun" : null)],
                ["Momentum", d?.momentumLabel ?? d?.momentum],
                ["Verdict", verdict],
                ["Score", score],
                ["Chain", meta.chain || "solana"],
                ["Pair", t.pairAddress || pool],
                ["Decimals", t.decimals ?? meta.decimals],
                ["Supply", t.supply ?? meta.supply],
              ]}
            />
            {d?.flags && (
              <>
                <h4 className="text-[11px] font-semibold text-white/40">Flags</h4>
                <KvGrid rows={Object.entries(d.flags).map(([k, v]) => [k, v] as [string, any])} />
              </>
            )}
            {intel && Object.keys(intel).length > 0 && (
              <>
                <h4 className="text-[11px] font-semibold text-white/40">Intel summary</h4>
                <KvGrid
                  rows={[
                    ["Whales", whales],
                    ["Trades cached", trades.length],
                    ["Top holders shown", holderList.length],
                    ["Total holders", totalHolders != null ? fmtNum(totalHolders) : "—"],
                    ["Safety risk", intel.safety?.riskScore ?? safety?.riskScore],
                  ]}
                />
              </>
            )}
            {research && (
              <>
                <h4 className="text-[11px] font-semibold text-white/40">Research</h4>
                <pre className="max-h-64 overflow-auto rounded-lg bg-black/60 p-2 font-mono text-[10px] text-white/50">
                  {JSON.stringify(research, null, 2).slice(0, 4000)}
                </pre>
              </>
            )}
          </div>
        )}

        {tab === "holders" && (
          <div className="space-y-2">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              <Users className="h-3.5 w-3.5" />
              Top holders
              {totalHolders != null && (
                <span className="font-normal normal-case tracking-normal text-white/35">
                  · {fmtNum(totalHolders)} total
                </span>
              )}
            </h3>
            {!holderList.length ? (
              <div className="space-y-2 py-6 text-center">
                <p className="text-xs text-white/35">No holder data yet</p>
                <button
                  type="button"
                  onClick={() => {
                    setTabLoading(true);
                    void loadBundle(mint).finally(() => setTabLoading(false));
                  }}
                  className="text-[11px] font-semibold text-white underline"
                >
                  Reload holders
                </button>
              </div>
            ) : (
              holderList.slice(0, 40).map((h: any, i: number) => {
                const addr = h.owner || h.address || h.wallet;
                const amt = h.uiAmount ?? h.amount ?? h.holdingAmount ?? h.tokens;
                const val = h.usdValue ?? h.holdingUsd ?? h.usd ?? h.value;
                const bought = h.boughtUsd ?? h.bought ?? h.buyVol;
                const sold = h.soldUsd ?? h.sold ?? h.sellVol;
                const pnl = h.netPnl ?? h.pnl;
                const pct = h.pct ?? h.percentage ?? h.holdingPct;
                return (
                  <Link
                    key={addr || i}
                    to={`/trade/wallet/${addr}`}
                    className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.03] px-2.5 py-2 hover:border-[rgba(61,231,255,0.2)] hover:bg-[rgba(61,231,255,0.06)]"
                  >
                    <div>
                      <p className="font-mono text-xs">
                        #{h.rank || i + 1} {shortAddr(addr || "", 5)}
                        {h.label ? <span className="ml-1 text-[#3de7ff]/70">· {h.label}</span> : null}
                      </p>
                      <p className="text-[10px] text-white/30">
                        {amt != null ? fmtTok(Number(amt)) : "—"}
                        {bought != null ? ` · bought ${fmtUsd(bought)}` : ""}
                        {sold != null ? ` · sold ${fmtUsd(sold)}` : ""}
                        {h.buys != null || h.sells != null ? ` · ${h.buys ?? 0}B/${h.sells ?? 0}S` : ""}
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <p>{pct != null ? `${Number(pct).toFixed(2)}%` : "—"}</p>
                      <p className="text-white/40">{fmtUsd(val)}</p>
                      {pnl != null && (
                        <p className={Number(pnl) >= 0 ? "text-[#17ff4d]" : "text-[#ff4d5e]"}>{fmtPnl(Number(pnl))}</p>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {tab === "traders" && (
          <div className="space-y-2">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              <Activity className="h-3.5 w-3.5" /> Top traders
              <span className="font-normal normal-case tracking-normal text-white/35">
                · bought · sold · holding · PnL
              </span>
            </h3>
            {!traders.length ? (
              <div className="space-y-2 py-6 text-center">
                <p className="text-xs text-white/35">No trader data yet</p>
                <button
                  type="button"
                  onClick={() => {
                    setTabLoading(true);
                    void loadBundle(mint).finally(() => setTabLoading(false));
                  }}
                  className="text-[11px] font-semibold text-white underline"
                >
                  Reload traders
                </button>
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[2fr_repeat(6,1fr)] gap-1 px-2.5 text-[9px] uppercase tracking-wider text-white/25 sm:grid">
                  <span>Wallet</span>
                  <span className="text-right">Bought</span>
                  <span className="text-right">Sold</span>
                  <span className="text-right">Holding</span>
                  <span className="text-right">Value</span>
                  <span className="text-right">Realized</span>
                  <span className="text-right">Net PnL</span>
                </div>
                {traders.slice(0, 50).map((tr: any, i: number) => {
                  const addr = tr.owner || tr.address || tr.wallet;
                  const bought = tr.boughtUsd ?? tr.bought ?? tr.buyVol;
                  const sold = tr.soldUsd ?? tr.sold ?? tr.sellVol;
                  const holdAmt = tr.holdingAmount ?? tr.holding ?? tr.uiAmount;
                  const holdUsd = tr.holdingUsd ?? tr.usdValue;
                  const realized = tr.realizedPnl ?? tr.realized;
                  const unrealized = tr.unrealizedPnl ?? tr.unrealized;
                  const pnl = tr.netPnl ?? tr.pnlUsd ?? tr.pnl ?? realized;
                  return (
                    <Link
                      key={addr || i}
                      to={`/trade/wallet/${addr}`}
                      className="block rounded-lg bg-black/40 px-2.5 py-2 hover:bg-white/5"
                    >
                      <div className="flex items-start justify-between gap-2 sm:grid sm:grid-cols-[2fr_repeat(6,1fr)] sm:items-center">
                        <div className="min-w-0">
                          <p className="font-mono text-xs">
                            #{tr.rank || i + 1} {shortAddr(addr || "", 5)}
                            {tr.isHolder ? <span className="ml-1 text-white/30">· holder</span> : null}
                          </p>
                          <p className="text-[10px] text-white/30">
                            {tr.buys ?? 0}B / {tr.sells ?? 0}S
                            {tr.volume != null ? ` · vol ${fmtUsd(tr.volume)}` : ""}
                            {tr.holdingPct != null ? ` · ${Number(tr.holdingPct).toFixed(2)}%` : ""}
                          </p>
                          <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] sm:hidden">
                            <span className="text-green-400/90">Buy {fmtUsd(bought)}</span>
                            <span className="text-red-400/90">Sell {fmtUsd(sold)}</span>
                            <span className="text-white/50">Hold {fmtUsd(holdUsd)}</span>
                          </div>
                        </div>
                        <p className="hidden text-right font-mono text-[11px] text-green-400 sm:block">{fmtUsd(bought)}</p>
                        <p className="hidden text-right font-mono text-[11px] text-red-400 sm:block">{fmtUsd(sold)}</p>
                        <p className="hidden text-right font-mono text-[11px] text-white/70 sm:block">
                          {holdAmt != null ? fmtTok(Number(holdAmt)) : "—"}
                        </p>
                        <p className="hidden text-right font-mono text-[11px] text-white/70 sm:block">{fmtUsd(holdUsd)}</p>
                        <p
                          className={`hidden text-right font-mono text-[11px] sm:block ${
                            realized == null ? "text-white/30" : Number(realized) >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {realized != null ? fmtPnl(Number(realized)) : "—"}
                        </p>
                        <div className="shrink-0 text-right sm:contents">
                          <p
                            className={`font-mono text-xs ${
                              pnl == null ? "text-white/30" : Number(pnl) >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {pnl != null ? fmtPnl(Number(pnl)) : "—"}
                          </p>
                          {unrealized != null && (
                            <p className="text-[9px] text-white/30 sm:hidden">U {fmtPnl(Number(unrealized))}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === "trades" && (
          <div className="space-y-2">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              <Flame className="h-3.5 w-3.5 text-[#3de7ff]" /> Live trades
              <span className="inline-flex items-center gap-1 font-normal normal-case tracking-normal text-[#17ff4d]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#17ff4d]" />
                {trades.length ? `${trades.length}` : "—"}
              </span>
            </h3>
            {!trades.length ? (
              <div className="space-y-2 py-6 text-center">
                <p className="text-xs text-white/35">No recent trades yet</p>
                <button
                  type="button"
                  onClick={() => {
                    setTabLoading(true);
                    void loadBundle(mint).finally(() => setTabLoading(false));
                  }}
                  className="text-[11px] font-semibold text-white underline"
                >
                  Reload trades
                </button>
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[72px_52px_1fr_1fr_1.2fr_40px] gap-1 px-2.5 text-[9px] uppercase tracking-wider text-white/25 sm:grid">
                  <span>Time</span>
                  <span>Side</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">USD</span>
                  <span>Trader</span>
                  <span />
                </div>
                {trades.slice(0, 80).map((tr: any, i: number) => {
                  const side = String(tr.side || tr.kind || "trade").toLowerCase();
                  const isBuy = side === "buy";
                  const usd = tr.usd ?? tr.volumeUsd ?? tr.value ?? tr.amountUsd;
                  const amt = tr.amount ?? tr.tokenAmount;
                  const addr = tr.wallet || tr.owner || "";
                  const tx = tr.txHash || tr.tx_hash || tr.signature;
                  let ts = tr.time ?? tr.ts ?? tr.timestamp;
                  if (typeof ts === "string") ts = new Date(ts).getTime();
                  return (
                    <div
                      key={tx || `${addr}-${ts}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-black/40 px-2.5 py-2 sm:grid sm:grid-cols-[72px_52px_1fr_1fr_1.2fr_40px]"
                    >
                      <p className="text-[10px] text-white/35">{timeAgo(typeof ts === "number" ? ts : null)}</p>
                      <p className={`text-xs font-bold ${isBuy ? "text-green-400" : side === "sell" ? "text-red-400" : "text-white/50"}`}>
                        {side.toUpperCase()}
                      </p>
                      <div className="min-w-0 sm:contents">
                        <p className="text-right font-mono text-[11px] text-white/80">
                          {amt != null ? fmtTok(Number(amt)) : "—"}
                        </p>
                        <p className="text-right font-mono text-xs">{fmtUsd(usd)}</p>
                        {addr ? (
                          <Link
                            to={`/trade/wallet/${addr}`}
                            className="font-mono text-[10px] text-white/45 hover:text-white"
                          >
                            {shortAddr(addr, 5)}
                          </Link>
                        ) : (
                          <span className="font-mono text-[10px] text-white/25">—</span>
                        )}
                      </div>
                      {tx ? (
                        <a
                          href={`https://solscan.io/tx/${tx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex justify-end text-white/30 hover:text-white"
                          aria-label="View transaction"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === "safety" && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              <Shield className="h-3.5 w-3.5" /> Safety
            </h3>
            <KvGrid
              rows={[
                ["Can buy", safetyApi?.canBuy],
                ["Can sell", safetyApi?.canSell],
                ["Verdict", safetyApi?.verdict ?? safety?.verdict],
                ["Tone", safetyApi?.tone],
                ["Round-trip loss %", safetyApi?.roundTripLossPct],
                ["Buy impact %", safetyApi?.buyImpactPct],
                ["Sell impact %", safetyApi?.sellImpactPct],
                ["Mint renounced", safety?.mintRenounced ?? safety?.mintable === false],
                ["Freeze renounced", safety?.freezeRenounced ?? safety?.freezable === false],
                ["LP locked %", safety?.lpLockedPct ?? safety?.lpBurned],
                ["Rugged", safety?.rugged],
                ["Risk score", safety?.riskScore],
                ["Top 10 %", safety?.top10HoldersPercent ?? safety?.top10Pct],
                ["Total holders", totalHolders != null ? fmtNum(totalHolders) : safety?.totalHolders],
                ["Note", safetyApi?.note || safety?.note],
              ]}
            />
          </div>
        )}

        {tab === "xray" && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              <AlertTriangle className="h-3.5 w-3.5" /> Risk X-ray
            </h3>
            {!xray?.ok && !xray?.verdict ? (
              <p className="text-xs text-white/30">{xray?.error || "X-ray unavailable"}</p>
            ) : (
              <>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="text-sm font-bold">{xray.verdict}</p>
                  <p className="mt-1 text-xs text-white/50">{xray.summary}</p>
                  <p className="mt-1 font-mono text-[11px] text-white/40">Score {xray.score} · {xray.tone}</p>
                </div>
                {Array.isArray(xray.flags) && xray.flags.length > 0 && (
                  <div className="space-y-1">
                    {xray.flags.map((f: any, i: number) => (
                      <p key={i} className="text-[11px] text-white/60">
                        <span className="font-bold uppercase text-white/40">{f.level}</span> — {f.text}
                      </p>
                    ))}
                  </div>
                )}
                <KvGrid
                  rows={[
                    ["Snipers %", xray.snipers?.pct],
                    ["Sniper count", xray.snipers?.count],
                    ["Bundles %", xray.bundles?.pct],
                    ["Bundle count", xray.bundles?.count],
                    ["Insiders %", xray.insiders?.pct],
                    ["Insider count", xray.insiders?.count],
                    ["Top 10 %", xray.concentration?.top10Pct],
                    ["Whales", xray.concentration?.whales],
                    ["Dev wallet", xray.dev?.wallet],
                    ["Dev %", xray.dev?.pct],
                    ["Dev sold", xray.dev?.sold],
                    ["Mint renounced", xray.safety?.mintRenounced],
                    ["Freeze renounced", xray.safety?.freezeRenounced],
                    ["LP locked %", xray.safety?.lpLockedPct],
                    ["Risk score", xray.safety?.riskScore],
                  ]}
                />
                {Array.isArray(xray.earlyBuyers) && xray.earlyBuyers.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-white/40">Early buyers</p>
                    {xray.earlyBuyers.slice(0, 15).map((b: any) => (
                      <Link
                        key={b.wallet}
                        to={`/trade/wallet/${b.wallet}`}
                        className="flex justify-between rounded bg-black/40 px-2 py-1.5 font-mono text-[10px] hover:bg-white/5"
                      >
                        <span>
                          #{b.rank} {shortAddr(b.wallet, 4)}
                          {b.sniper ? " · sniper" : ""}
                          {b.bundled ? " · bundled" : ""}
                        </span>
                        <span>{b.solSpent?.toFixed?.(2)} SOL</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "forensics" && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Forensics</h3>
            {!forensics ? (
              <p className="text-xs text-white/30">Forensics unavailable</p>
            ) : (
              <>
                <KvGrid
                  rows={[
                    ["Launchpad", forensics.launchpad],
                    ["Pump.fun", forensics.isPumpFun],
                    ["Bonding complete", forensics.bondingComplete],
                    ["Top 10 %", forensics.concentration?.top10Pct],
                    ["Whales", forensics.concentration?.whales],
                    ["Holders", forensics.concentration?.totalHolders],
                    ["Mint renounced", forensics.safetyFlags?.mintRenounced],
                    ["Freeze renounced", forensics.safetyFlags?.freezeRenounced],
                    ["LP locked %", forensics.safetyFlags?.lpLockedPct],
                    ["Rugged", forensics.safetyFlags?.rugged],
                    ["Risk score", forensics.safetyFlags?.riskScore],
                    ["Error", forensics.error],
                  ]}
                />
                <pre className="max-h-72 overflow-auto rounded-lg bg-black/60 p-2 font-mono text-[10px] text-white/40">
                  {JSON.stringify(forensics, null, 2).slice(0, 6000)}
                </pre>
              </>
            )}
          </div>
        )}

        {tab === "ath" && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">All-time high</h3>
            {!ath?.ok && ath?.athPrice == null ? (
              <p className="text-xs text-white/30">{ath?.error || "ATH data unavailable"}</p>
            ) : (
              <KvGrid
                rows={[
                  ["ATH price", ath.athPrice != null ? fmtUsd(ath.athPrice) : null],
                  ["ATH mcap", ath.athMcap != null ? fmtUsd(ath.athMcap) : null],
                  ["From ATH %", ath.fromAthPct],
                  ["ATH date", ath.athDate],
                  ["Source", ath.source],
                ]}
              />
            )}
          </div>
        )}

        {tab === "ai" && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">Ask AI about this coin</h3>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {!aiMsgs.length && <p className="text-xs text-white/30">Ask about risk, narrative, holders, or trade setup.</p>}
              {aiMsgs.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    m.role === "user" ? "bg-white text-black" : "bg-black/50 text-white/80"
                  }`}
                >
                  {m.content}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={aiQ}
                onChange={(e) => setAiQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void askAi()}
                placeholder="Is this safe to ape?"
                className="h-10 flex-1 rounded-xl border border-white/10 bg-black/50 px-3 text-sm outline-none focus:border-white/30"
              />
              <button
                type="button"
                disabled={aiBusy || !aiQ.trim()}
                onClick={() => void askAi()}
                className="h-10 rounded-xl bg-white px-4 text-xs font-bold text-black disabled:opacity-40"
              >
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-[calc(5.35rem+env(safe-area-inset-bottom))] inset-x-0 z-40 px-3">
        <div className="mx-auto max-w-lg space-y-2">
          {/* Always-visible position strip above Trade CTA */}
          <div className="rounded-2xl border border-white/15 bg-[#0a0a0a]/95 px-3 py-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Your position
              </p>
              {tradeReady && publicKey ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400/90">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  {activeLabel || shortAddress || "Live"}
                </span>
              ) : localActive ? (
                <Link
                  to="/trade/wallets"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white/70 underline"
                >
                  <Wallet className="h-3 w-3" /> Set local
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={connectWallet}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white/70 underline"
                >
                  <Wallet className="h-3 w-3" /> Connect wallet
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[8px] uppercase tracking-wider text-white/30">Hold</p>
                <p className="font-mono text-[11px] font-bold">
                  {tradeReady ? fmtTok(posAmount) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[8px] uppercase tracking-wider text-white/30">Worth</p>
                <p className="font-mono text-[11px] font-bold">
                  {tradeReady ? (posWorth != null ? fmtUsd(posWorth) : "—") : "—"}
                </p>
              </div>
              <div>
                <p className="text-[8px] uppercase tracking-wider text-white/30">PnL</p>
                <p
                  className={`font-mono text-[11px] font-bold ${
                    posUnreal == null
                      ? "text-white/40"
                      : posUnreal >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {tradeReady && posUnreal != null ? fmtPnl(posUnreal) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[8px] uppercase tracking-wider text-white/30">Cost</p>
                <p className="font-mono text-[11px] font-bold text-white/70">
                  {tradeReady && posCost != null ? fmtUsd(posCost) : "—"}
                  {tradeReady && posUnrealPct != null ? (
                    <span className="ml-0.5 text-[9px] opacity-70">{fmtPct(posUnrealPct)}</span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
          <Link
            to={`/trade/desk/${mint}`}
            className="flex h-12 items-center justify-center rounded-2xl bg-white text-sm font-bold text-black shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
          >
            Trade {symbol}
          </Link>
        </div>
      </div>
    </div>
  );
}
