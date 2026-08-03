/**
 * /trade/wallet/:address — portfolio view (holdings, PnL, recent swaps).
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Check, ExternalLink, Loader2, Wallet, RefreshCw } from "lucide-react";
import { fetchSwaps, fetchWallet } from "./tradeApi";
import { fmtPct, fmtUsd, shortAddr } from "./tradeFmt";
import { pushRecentWallet } from "./tradeRecent";

type Tab = "holdings" | "pnl" | "trades";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export default function TradeWallet() {
  const { address = "" } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("holdings");
  /** Only hide priced dust under $0.01 — never hide unpriced balances. */
  const [hideDust, setHideDust] = useState(false);

  const load = () => {
    if (!address) return;
    pushRecentWallet(address);
    setLoading(true);
    Promise.all([fetchWallet(address), fetchSwaps(address, 40)]).then(([w, s]) => {
      setD(w);
      setTrades(Array.isArray(s?.trades) ? s.trades : []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const holdings = useMemo(() => {
    if (!d?.ok) return [];
    const sol = {
      mint: SOL_MINT,
      symbol: "SOL",
      name: "Solana",
      uiAmount: d.sol,
      usdValue: d.solUsd,
      priceUsd: d.solPrice,
      image: null as string | null,
      isSol: true,
      change24h: null as number | null,
      unpriced: false,
    };
    const list = [sol, ...(d.holdings || [])];
    if (!hideDust) return list;
    // Keep SOL + unpriced balances; only drop priced dust under $0.01
    return list.filter((h: any) => {
      if (h.isSol) return true;
      if (h.unpriced || !(h.priceUsd > 0) || !(h.usdValue > 0)) return true;
      return h.usdValue >= 0.01;
    });
  }, [d, hideDust]);

  const pnl = d?.pnl;
  const wins =
    pnl?.winRate != null && pnl?.closedTrades
      ? Math.round((Number(pnl.winRate) > 1 ? Number(pnl.winRate) / 100 : Number(pnl.winRate)) * pnl.closedTrades)
      : null;
  const losses = wins != null ? Math.max(0, (pnl?.closedTrades || 0) - wins) : null;

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#050505]">
        <Loader2 className="h-7 w-7 animate-spin text-white/30" />
      </div>
    );
  }

  if (!d?.ok) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#050505] px-6 text-center">
        <Wallet className="h-8 w-8 text-white/20" />
        <p className="text-sm text-white/40">{d?.error || "Could not load wallet"}</p>
        <p className="max-w-xs break-all font-mono text-[10px] text-white/25">{address}</p>
        <button
          type="button"
          onClick={() => navigate("/trade/portfolio")}
          className="text-sm underline text-white/60"
        >
          Back to portfolio
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#050505]">
      <div className="relative shrink-0 border-b border-white/[0.06] px-3 pb-3 pt-2">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 70% 80% at 50% -40%, rgba(255,255,255,0.07), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/trade/portfolio")}
            className="rounded-full bg-white/[0.06] p-2 text-white/55 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Wallet</p>
            <p className="font-mono text-sm font-semibold">{shortAddr(address, 6)}</p>
          </div>
          <button type="button" onClick={load} className="rounded-full border border-white/10 p-2 text-white/45">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" onClick={copy} className="rounded-full border border-white/10 p-2 text-white/45">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <a
            href={`https://solscan.io/account/${address}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/10 p-2 text-white/45"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <p className="relative mt-4 px-1 font-mono text-[36px] font-black leading-none tracking-tight">
          {fmtUsd(d.totalUsd)}
        </p>
        <div className="relative mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-white/40">
          <span>{(d.sol || 0).toFixed(3)} SOL</span>
          <span>·</span>
          <span>{d.tokenCount ?? Math.max(0, holdings.length - 1)} tokens</span>
          {pnl?.winRate != null && (
            <>
              <span>·</span>
              <span>
                WR {Number(pnl.winRate) > 1 ? Number(pnl.winRate).toFixed(0) : (Number(pnl.winRate) * 100).toFixed(0)}%
              </span>
            </>
          )}
        </div>

        <div className="relative mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <p className="text-[9px] text-white/30">Realized</p>
            <p
              className={`font-mono text-xs font-semibold ${
                (pnl?.realizedPnlUsd || 0) >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {fmtUsd(pnl?.realizedPnlUsd)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <p className="text-[9px] text-white/30">Unrealized</p>
            <p
              className={`font-mono text-xs font-semibold ${
                (pnl?.unrealizedPnlUsd || 0) >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {fmtUsd(pnl?.unrealizedPnlUsd)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <p className="text-[9px] text-white/30">W / L</p>
            <p className="font-mono text-xs font-semibold">
              <span className="text-emerald-400">{wins ?? "—"}</span>
              <span className="text-white/20"> / </span>
              <span className="text-red-400">{losses ?? "—"}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-1 px-3 py-2">
        {(
          [
            ["holdings", "Holdings"],
            ["pnl", "PnL"],
            ["trades", "Trades"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold ${
              tab === id ? "bg-white text-black" : "bg-white/[0.03] text-white/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {tab === "holdings" && (
          <>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {holdings.length} assets
                {d.tokenCount != null && d.tokenCount + 1 !== holdings.length
                  ? ` · ${d.tokenCount} tokens on-chain`
                  : ""}
              </p>
              <button
                type="button"
                onClick={() => setHideDust((v) => !v)}
                className="text-[10px] font-medium text-white/40 underline"
              >
                {hideDust ? "Show dust" : "Hide dust <$0.01"}
              </button>
            </div>
            <div className="space-y-1.5">
              {holdings.map((h: any) => (
                <button
                  key={h.mint}
                  type="button"
                  onClick={() => {
                    if (h.isSol || h.mint === SOL_MINT) return;
                    navigate(`/trade/token/${h.mint}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left hover:bg-white/[0.05]"
                >
                  {h.image ? (
                    <img src={h.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[10px] font-bold">
                      {(h.symbol || "?").slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold">{h.symbol || shortAddr(h.mint, 4)}</p>
                    <p className="font-mono text-[10px] text-white/35">
                      {Number(h.uiAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      {h.unpriced ? " · no quote" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[13px] font-semibold">
                      {h.unpriced || (!(h.usdValue > 0) && !h.isSol) ? "—" : fmtUsd(h.usdValue)}
                    </p>
                    {h.change24h != null && (
                      <p className={`font-mono text-[10px] ${h.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmtPct(h.change24h)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "pnl" && (
          <div className="space-y-1.5">
            {!pnl?.perToken?.length ? (
              <p className="py-12 text-center text-xs text-white/35">No closed PnL rows</p>
            ) : (
              pnl.perToken.map((p: any) => (
                <button
                  key={p.mint}
                  type="button"
                  onClick={() => navigate(`/trade/token/${p.mint}`)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-bold">{p.symbol || shortAddr(p.mint, 4)}</p>
                    <p className="text-[10px] text-white/35">
                      {p.closedTrades ?? 0} closed
                      {p.winRate != null
                        ? ` · WR ${Number(p.winRate) > 1 ? Number(p.winRate).toFixed(0) : (Number(p.winRate) * 100).toFixed(0)}%`
                        : ""}
                    </p>
                  </div>
                  <p
                    className={`font-mono text-sm font-semibold ${
                      (p.totalUsd || p.realizedUsd || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {fmtUsd(p.totalUsd ?? p.realizedUsd)}
                  </p>
                </button>
              ))
            )}
          </div>
        )}

        {tab === "trades" && (
          <div className="space-y-1.5">
            {!trades.length ? (
              <p className="py-12 text-center text-xs text-white/35">No recent swaps</p>
            ) : (
              trades.map((tr: any, i: number) => (
                <button
                  key={tr.txHash || i}
                  type="button"
                  onClick={() => tr.mint && navigate(`/trade/token/${tr.mint}`)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left"
                >
                  <div>
                    <p className={`text-xs font-bold ${tr.side === "buy" ? "text-emerald-400" : "text-red-400"}`}>
                      {(tr.side || "swap").toUpperCase()} {tr.symbol || shortAddr(tr.mint || "", 4)}
                    </p>
                    <p className="font-mono text-[10px] text-white/30">
                      {tr.solAmount != null ? `${Number(tr.solAmount).toFixed(3)} SOL` : ""}
                      {tr.txHash ? ` · ${shortAddr(tr.txHash, 4)}` : ""}
                    </p>
                  </div>
                  <p className="font-mono text-xs">{fmtUsd(tr.usd)}</p>
                </button>
              ))
            )}
          </div>
        )}

        <Link to="/trade/portfolio" className="mt-4 block text-center text-[11px] text-white/30 hover:text-white/50">
          ← Portfolio hub
        </Link>
      </div>
    </div>
  );
}
