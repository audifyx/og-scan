import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Copy, Check, ExternalLink, Loader2, Shield, Users, Activity,
} from "lucide-react";
import { fetchTokenDetail } from "./tradeApi";
import { dexChartUrl, fmtPct, fmtUsd, shortAddr } from "./tradeFmt";

function DexChart({ refId }: { refId: string }) {
  const [ready, setReady] = useState(false);
  const [mount, setMount] = useState(false);
  useEffect(() => {
    setReady(false);
    setMount(false);
    const t = window.setTimeout(() => setMount(true), 100);
    return () => window.clearTimeout(t);
  }, [refId]);
  return (
    <div className="relative mx-4 mt-4 overflow-hidden rounded-xl border border-white/10 bg-black" style={{ height: 360 }}>
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

export default function TradeToken() {
  const { mint = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<any>(null);
  const [safety, setSafety] = useState<any>(null);
  const [traders, setTraders] = useState<any[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [pool, setPool] = useState<string | null>(null);

  useEffect(() => {
    if (!mint) return;
    try {
      sessionStorage.setItem("orbitx.trade.lastMint", mint);
    } catch {
      /* ignore */
    }
    let on = true;
    setLoading(true);
    fetchTokenDetail(mint).then(({ tokenRes, safetyRes, tradersRes, chartRes }) => {
      if (!on) return;
      setData(tokenRes);
      setSafety(safetyRes?.ok ? safetyRes : safetyRes?.safety || safetyRes);
      setTraders(Array.isArray(tradersRes?.traders) ? tradersRes.traders : []);
      setHolders(Array.isArray(tradersRes?.holders) ? tradersRes.holders : []);
      setPool(chartRes?.pool || null);
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, [mint]);

  const tok = data?.token || data?.meta || {};
  const symbol = tok.symbol || data?.raw?.baseToken?.symbol || "???";
  const name = tok.name || data?.raw?.baseToken?.name || "";
  const icon = tok.icon || tok.image || data?.raw?.info?.imageUrl;
  const price = Number(tok.priceUsd ?? tok.price ?? data?.raw?.priceUsd) || 0;
  const mcap = Number(tok.mcap ?? tok.fdv ?? data?.raw?.marketCap) || 0;
  const fdv = Number(tok.fdv ?? data?.raw?.fdv) || 0;
  const vol = Number(tok.volume ?? tok.volume24h ?? data?.raw?.volume?.h24) || 0;
  const liq = Number(tok.liquidity ?? data?.raw?.liquidity?.usd) || 0;
  const ch24 = Number(tok.change24h ?? data?.raw?.priceChange?.h24) || 0;
  const ch1h = Number(tok.change1h ?? data?.raw?.priceChange?.h1) || 0;
  const ch5m = Number(tok.change5m ?? data?.raw?.priceChange?.m5) || 0;
  const verdict = data?.verdict || data?.score?.verdict;
  const momentum = data?.momentumLabel || data?.momentum;
  const chartRef = pool || tok.pairAddress || mint;
  const links = tok.links || data?.raw?.info?.socials || [];
  const website = tok.website || data?.raw?.info?.websites?.[0]?.url;
  const twitter =
    tok.twitter ||
    (Array.isArray(links) ? links.find((s: any) => /twitter|x\.com/i.test(s?.url || s?.type || ""))?.url : null);

  const copy = () => {
    navigator.clipboard.writeText(mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <Loader2 className="h-7 w-7 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-black">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-black/95 px-3 py-3 backdrop-blur">
        <button type="button" onClick={() => navigate(-1)} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{symbol}</p>
          <p className="truncate text-[11px] text-white/35">{name}</p>
        </div>
        <Link
          to={`/trade/desk/${mint}`}
          className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black"
        >
          Trade
        </Link>
      </div>

      <div className="flex items-start gap-3 px-4 py-4">
        {icon ? (
          <img src={icon} alt="" className="h-14 w-14 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-lg font-bold">
            {symbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-2xl font-bold">{fmtUsd(price)}</p>
          <p className={`font-mono text-sm ${ch24 >= 0 ? "text-green-400" : "text-red-400"}`}>
            24h {fmtPct(ch24)} · 1h {fmtPct(ch1h)} · 5m {fmtPct(ch5m)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] text-white/50">
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              {shortAddr(mint, 6)}
            </button>
            <a href={`https://solscan.io/token/${mint}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white">
              Solscan <ExternalLink className="h-3 w-3" />
            </a>
            <a href={`https://dexscreener.com/solana/${chartRef}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white">
              DexScreener <ExternalLink className="h-3 w-3" />
            </a>
            {website && (
              <a href={website} target="_blank" rel="noreferrer" className="text-[10px] text-white/40 hover:text-white">Web</a>
            )}
            {twitter && (
              <a href={twitter} target="_blank" rel="noreferrer" className="text-[10px] text-white/40 hover:text-white">X</a>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 sm:grid-cols-4">
        {[
          ["MCap", fmtUsd(mcap)],
          ["FDV", fmtUsd(fdv || mcap)],
          ["Volume", fmtUsd(vol)],
          ["Liquidity", fmtUsd(liq)],
        ].map(([label, val]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-[#050505] px-3 py-2.5">
            <p className="text-[9px] uppercase tracking-wider text-white/30">{label}</p>
            <p className="font-mono text-sm font-semibold">{val}</p>
          </div>
        ))}
      </div>

      {(verdict || momentum) && (
        <div className="mx-4 mt-3 flex gap-2">
          {verdict && (
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold">
              Verdict: {String(verdict)}
            </span>
          )}
          {momentum != null && (
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold">
              Momentum: {String(momentum)}
            </span>
          )}
        </div>
      )}

      <DexChart refId={chartRef} />

      {/* Safety */}
      <section className="mx-4 mt-4 rounded-xl border border-white/10 bg-[#050505] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
          <Shield className="h-3.5 w-3.5" /> Safety
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {[
            ["Mintable", safety?.mintable ?? safety?.safety?.mintable],
            ["Freezable", safety?.freezable ?? safety?.safety?.freezable],
            ["LP burned", safety?.lpBurned ?? safety?.safety?.lpBurned],
            ["Top 10", safety?.top10HoldersPercent ?? safety?.safety?.top10],
            ["Score", safety?.score ?? data?.score?.total ?? data?.score],
            ["Risk", safety?.risk ?? data?.flags?.risk],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-lg bg-black/50 px-2.5 py-2">
              <p className="text-[9px] text-white/30">{label}</p>
              <p className="font-mono text-xs">
                {val == null || val === ""
                  ? "—"
                  : typeof val === "boolean"
                    ? val
                      ? "Yes"
                      : "No"
                    : typeof val === "number"
                      ? Number.isInteger(val)
                        ? String(val)
                        : `${val.toFixed?.(1) ?? val}%`
                      : String(val)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Top traders */}
      <section className="mx-4 mt-4 rounded-xl border border-white/10 bg-[#050505] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
          <Activity className="h-3.5 w-3.5" /> Top traders
        </h3>
        {!traders.length ? (
          <p className="text-xs text-white/30">No trader data yet</p>
        ) : (
          <div className="space-y-2">
            {traders.slice(0, 12).map((t: any, i: number) => {
              const addr = t.owner || t.address || t.wallet;
              const pnl = t.pnlUsd ?? t.pnl ?? t.realizedPnlUsd;
              const wins = t.buys ?? t.wins;
              const loses = t.sells ?? t.losses;
              return (
                <a
                  key={addr || i}
                  href={`https://solscan.io/account/${addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg bg-black/40 px-2.5 py-2 hover:bg-white/5"
                >
                  <div>
                    <p className="font-mono text-xs">#{i + 1} {shortAddr(addr || "", 5)}</p>
                    <p className="text-[10px] text-white/30">
                      {wins != null || loses != null ? `${wins ?? "—"}B / ${loses ?? "—"}S` : "—"}
                    </p>
                  </div>
                  <p className={`font-mono text-xs ${(Number(pnl) || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {pnl != null ? fmtUsd(Number(pnl)) : "—"}
                  </p>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* Holders */}
      <section className="mx-4 mt-4 mb-6 rounded-xl border border-white/10 bg-[#050505] p-4">
        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
          <Users className="h-3.5 w-3.5" /> Top holders
        </h3>
        {!holders.length ? (
          <p className="text-xs text-white/30">No holder data yet</p>
        ) : (
          <div className="space-y-2">
            {holders.slice(0, 10).map((h: any, i: number) => {
              const addr = h.owner || h.address;
              const pct = h.pct ?? h.percent ?? h.share;
              return (
                <div key={addr || i} className="flex items-center justify-between rounded-lg bg-black/40 px-2.5 py-2">
                  <p className="font-mono text-xs">#{i + 1} {shortAddr(addr || "", 5)}</p>
                  <p className="font-mono text-xs text-white/70">
                    {pct != null ? `${Number(pct).toFixed(2)}%` : fmtUsd(h.holdingUsd ?? h.usd)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] border-t border-white/10 bg-black/95 p-3 backdrop-blur">
        <Link
          to={`/trade/desk/${mint}`}
          className="flex h-12 items-center justify-center rounded-2xl bg-white text-sm font-bold text-black"
        >
          Trade {symbol}
        </Link>
      </div>
    </div>
  );
}
