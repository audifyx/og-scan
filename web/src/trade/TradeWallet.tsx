/**
 * /trade/wallet/:address — portfolio view (holdings, PnL, recent swaps).
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Check, ExternalLink, Loader2, Wallet, RefreshCw } from "lucide-react";
import {
  fetchSwaps,
  fetchWallet,
  mergeHoldingPnl,
  normalizePnlToken,
  type WalletPnlToken,
  type WalletTrade,
} from "./tradeApi";
import { fmtPct, fmtPnl, fmtTok, fmtUsd, shortAddr, timeAgo } from "./tradeFmt";
import { pushRecentWallet } from "./tradeRecent";

type Tab = "holdings" | "pnl" | "trades";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const display = { fontFamily: '"Bricolage Grotesque", system-ui' } as const;

function wrLabel(wr: number | null | undefined): string | null {
  if (wr == null || !Number.isFinite(Number(wr))) return null;
  const n = Number(wr);
  return `${n > 1 ? n.toFixed(0) : (n * 100).toFixed(0)}%`;
}

function TokenAvatar({ image, symbol, mint }: { image?: string | null; symbol?: string | null; mint?: string }) {
  if (image) {
    return <img src={image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />;
  }
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[10px] font-bold">
      {(symbol || shortAddr(mint || "", 2) || "?").slice(0, 2)}
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "up" | "down" | "plain";
}) {
  const color =
    tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-white";
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider text-white/30">{label}</p>
      <p className={`mt-0.5 font-mono text-xs font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export default function TradeWallet() {
  const { address = "" } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState<any>(null);
  const [trades, setTrades] = useState<WalletTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("holdings");
  /** Only hide priced dust under $0.01 — never hide unpriced balances. */
  const [hideDust, setHideDust] = useState(false);

  const load = () => {
    if (!address) return;
    pushRecentWallet(address);
    setLoading(true);
    fetchWallet(address)
      .then(async (w) => {
        setD(w);
        const embedded = Array.isArray(w?.trades) ? (w.trades as WalletTrade[]) : [];
        if (embedded.length) {
          setTrades(embedded);
          return;
        }
        // Fallback when wallet response has no tape (older deploy / pnl failed).
        const s = await fetchSwaps(address, 80);
        setTrades(Array.isArray(s?.trades) ? s.trades : []);
      })
      .catch(() => {
        setD({ ok: false, error: "Could not load wallet" });
        setTrades([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const pnlByMint = useMemo(() => {
    const map = new Map<string, WalletPnlToken>();
    for (const raw of d?.pnl?.perToken || []) {
      const row = normalizePnlToken(raw);
      if (row) map.set(row.mint, row);
    }
    return map;
  }, [d]);

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
      pctSupply: null as number | null,
      costUsd: null as number | null,
      potUsd: d.solUsd as number | null,
      unrealizedUsd: null as number | null,
      unrealizedPct: null as number | null,
    };
    const tokens = (d.holdings || []).map((h: any) => mergeHoldingPnl(h, pnlByMint));
    const list = [sol, ...tokens];
    if (!hideDust) return list;
    return list.filter((h: any) => {
      if (h.isSol) return true;
      if (h.unpriced || !(h.priceUsd > 0) || !(h.usdValue > 0)) return true;
      return h.usdValue >= 0.01;
    });
  }, [d, hideDust, pnlByMint]);

  const pnl = d?.pnl;
  const wins =
    pnl?.wins != null
      ? Number(pnl.wins)
      : pnl?.winRate != null && pnl?.closedTrades
        ? Math.round(
            (Number(pnl.winRate) > 1 ? Number(pnl.winRate) / 100 : Number(pnl.winRate)) *
              pnl.closedTrades,
          )
        : null;
  const losses =
    pnl?.losses != null
      ? Number(pnl.losses)
      : wins != null
        ? Math.max(0, (pnl?.closedTrades || 0) - wins)
        : null;

  const pnlRows: WalletPnlToken[] = useMemo(() => {
    const rows = Array.isArray(pnl?.perToken) ? pnl.perToken : [];
    return rows
      .map((r: any) => normalizePnlToken(r))
      .filter((p): p is WalletPnlToken => !!p)
      .filter(
        (p) =>
          (p.closedTrades || 0) > 0 ||
          p.open ||
          p.holding ||
          (p.holdingAmount || 0) > 0 ||
          p.noTradeHistory,
      );
  }, [pnl]);

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
          className="text-sm text-white/60 underline"
        >
          Back to portfolio
        </button>
      </div>
    );
  }

  const realized = pnl?.realizedPnlUsd;
  const unrealized = pnl?.unrealizedPnlUsd;
  const wr = wrLabel(pnl?.winRate);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#050505]">
      <div className="relative shrink-0 border-b border-white/[0.06] px-3 pb-3 pt-2">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 50% -40%, rgba(255,255,255,0.07), transparent 60%)",
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Wallet
            </p>
            <p className="font-mono text-sm font-semibold">{shortAddr(address, 6)}</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-white/10 p-2 text-white/45"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-full border border-white/10 p-2 text-white/45"
          >
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

        <p
          className="relative mt-4 px-1 text-[36px] font-black leading-none tracking-tight"
          style={display}
        >
          {fmtUsd(d.totalUsd)}
        </p>
        <div className="relative mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-white/40">
          <span>{(d.sol || 0).toFixed(3)} SOL</span>
          <span>·</span>
          <span>{d.tokenCount ?? Math.max(0, holdings.length - 1)} tokens</span>
          {wr && (
            <>
              <span>·</span>
              <span>WR {wr}</span>
            </>
          )}
          {pnl?.closedTrades != null && (
            <>
              <span>·</span>
              <span>{pnl.closedTrades} closed</span>
            </>
          )}
        </div>

        <div className="relative mt-3 grid grid-cols-3 gap-2">
          <StatCell
            label="Realized"
            value={fmtPnl(realized)}
            tone={realized == null ? "plain" : realized >= 0 ? "up" : "down"}
          />
          <StatCell
            label="Unrealized"
            value={fmtPnl(unrealized)}
            tone={unrealized == null ? "plain" : unrealized >= 0 ? "up" : "down"}
          />
          <StatCell
            label="W / L"
            value={
              <>
                <span className="text-emerald-400">{wins ?? "—"}</span>
                <span className="text-white/20"> / </span>
                <span className="text-red-400">{losses ?? "—"}</span>
              </>
            }
          />
        </div>
      </div>

      <div className="flex shrink-0 gap-1 px-3 py-2">
        {(
          [
            ["holdings", "Holdings"],
            ["pnl", "PnL"],
            ["trades", `Trades${trades.length ? ` · ${trades.length}` : ""}`],
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
                  <TokenAvatar image={h.image} symbol={h.symbol} mint={h.mint} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold">
                      {h.symbol || shortAddr(h.mint, 4)}
                    </p>
                    <p className="truncate text-[10px] text-white/35">
                      {h.name || shortAddr(h.mint, 6)}
                      {h.unpriced ? " · no quote" : ""}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-white/45">
                      {fmtTok(h.uiAmount, 6)}
                      {h.pctSupply != null ? ` · ${Number(h.pctSupply).toFixed(3)}% supply` : ""}
                    </p>
                    {!h.isSol && (
                      <p className="mt-0.5 font-mono text-[10px] text-white/30">
                        Cost {h.costUsd != null ? fmtUsd(h.costUsd) : "—"}
                        {" · "}Pot{" "}
                        {h.potUsd != null && h.potUsd > 0
                          ? fmtUsd(h.potUsd)
                          : h.usdValue > 0
                            ? fmtUsd(h.usdValue)
                            : "—"}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[13px] font-semibold">
                      {h.unpriced || (!(h.usdValue > 0) && !h.isSol) ? "—" : fmtUsd(h.usdValue)}
                    </p>
                    {!h.isSol && h.unrealizedUsd != null ? (
                      <p
                        className={`font-mono text-[10px] ${
                          h.unrealizedUsd >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {fmtPnl(h.unrealizedUsd)}
                        {h.unrealizedPct != null ? ` ${fmtPct(h.unrealizedPct)}` : ""}
                      </p>
                    ) : h.change24h != null ? (
                      <p
                        className={`font-mono text-[10px] ${
                          h.change24h >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {fmtPct(h.change24h)}
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "pnl" && (
          <div className="space-y-2">
            <p className="px-0.5 text-[10px] text-white/30">
              Per-token PnL from recent SOL-leg swaps · cost basis when computable
            </p>
            {!pnlRows.length ? (
              <p className="py-12 text-center text-xs text-white/35">
                No PnL rows yet — need more swap history on this wallet
              </p>
            ) : (
              pnlRows.map((p) => {
                const pWins =
                  p.wins != null
                    ? p.wins
                    : p.winRate != null && p.closedTrades
                      ? Math.round(
                          (Number(p.winRate) > 1
                            ? Number(p.winRate) / 100
                            : Number(p.winRate)) * p.closedTrades,
                        )
                      : null;
                const pLosses =
                  p.losses != null
                    ? p.losses
                    : pWins != null
                      ? Math.max(0, (p.closedTrades || 0) - pWins)
                      : null;
                const holdAmt = p.holdingAmount ?? p.tokens ?? 0;
                const isHolding = !!p.holding || holdAmt > 1e-9;
                const pot =
                  p.potUsd ??
                  (isHolding
                    ? p.holdingUsd ?? p.curValueUsd ?? null
                    : p.curValueUsd ?? null);
                const cost =
                  p.costUsd ??
                  (p.avgCostUsd != null && holdAmt > 0 ? p.avgCostUsd * holdAmt : null);
                const uPnl =
                  p.unrealizedUsd ??
                  (pot != null && cost != null ? pot - cost : null);
                const uPct =
                  p.unrealizedPct ??
                  (uPnl != null && cost != null && cost > 0 ? (uPnl / cost) * 100 : null);
                const uTone =
                  uPnl == null
                    ? "text-white/50"
                    : uPnl >= 0
                      ? "text-emerald-400"
                      : "text-red-400";
                const rTone =
                  (p.closedTrades || 0) > 0
                    ? (p.realizedUsd || 0) >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                    : "text-white/40";

                return (
                  <button
                    key={p.mint}
                    type="button"
                    onClick={() => navigate(`/trade/token/${p.mint}`)}
                    className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start gap-3">
                      <TokenAvatar image={p.image} symbol={p.symbol} mint={p.mint} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {p.symbol || shortAddr(p.mint, 4)}
                            </p>
                            <p className="truncate text-[10px] text-white/35">
                              {p.name || shortAddr(p.mint, 6)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-mono text-sm font-semibold ${rTone}`}>
                              {(p.closedTrades || 0) > 0 || uPnl != null
                                ? fmtPnl(
                                    p.totalUsd ??
                                      (p.realizedUsd != null || uPnl != null
                                        ? (p.realizedUsd || 0) + (uPnl || 0)
                                        : null),
                                  )
                                : "—"}
                            </p>
                            <p className="text-[9px] uppercase tracking-wider text-white/30">
                              {isHolding ? "Holding" : "Closed"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
                          <div>
                            <span className="text-white/30">W / L </span>
                            <span className="font-mono text-emerald-400">{pWins ?? "—"}</span>
                            <span className="text-white/20"> / </span>
                            <span className="font-mono text-red-400">{pLosses ?? "—"}</span>
                            {wrLabel(p.winRate) && (
                              <span className="text-white/30"> · {wrLabel(p.winRate)}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-white/30">Bought </span>
                            <span className="font-mono">
                              {p.boughtUsd != null ? fmtUsd(p.boughtUsd) : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/30">Hold </span>
                            <span className="font-mono">
                              {isHolding
                                ? `${fmtTok(holdAmt, 4)} · ${
                                    p.holdingUsd != null && p.holdingUsd > 0
                                      ? fmtUsd(p.holdingUsd)
                                      : pot != null && pot > 0
                                        ? fmtUsd(pot)
                                        : "—"
                                  }`
                                : "No"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-white/30">Pot </span>
                            <span className="font-mono">
                              {pot != null && pot > 0 ? fmtUsd(pot) : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/30">Cost </span>
                            <span className="font-mono">
                              {cost != null ? fmtUsd(cost) : "—"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-white/30">uPnL </span>
                            <span className={`font-mono ${uTone}`}>
                              {fmtPnl(uPnl)}
                              {uPct != null ? ` (${fmtPct(uPct)})` : ""}
                            </span>
                          </div>
                          <div>
                            <span className="text-white/30">Realized </span>
                            <span className={`font-mono ${rTone}`}>
                              {(p.closedTrades || 0) > 0 ? fmtPnl(p.realizedUsd) : "—"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-white/30">Supply </span>
                            <span className="font-mono">
                              {p.pctSupply != null ? `${Number(p.pctSupply).toFixed(3)}%` : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {tab === "trades" && (
          <div className="space-y-1.5">
            <p className="px-0.5 text-[10px] text-white/30">
              All recent buy/sell swaps detected on-chain (SOL-leg)
            </p>
            {!trades.length ? (
              <p className="py-12 text-center text-xs text-white/35">
                No recent swaps found for this wallet
              </p>
            ) : (
              trades.map((tr, i) => (
                <button
                  key={tr.txHash || `${tr.mint}-${tr.time}-${i}`}
                  type="button"
                  onClick={() => tr.mint && navigate(`/trade/token/${tr.mint}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left hover:bg-white/[0.05]"
                >
                  <TokenAvatar image={tr.image} symbol={tr.symbol} mint={tr.mint} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          tr.side === "buy"
                            ? "bg-emerald-400/15 text-emerald-400"
                            : tr.side === "sell"
                              ? "bg-red-400/15 text-red-400"
                              : "bg-white/10 text-white/50"
                        }`}
                      >
                        {tr.side || "swap"}
                      </span>
                      <p className="truncate text-sm font-bold">
                        {tr.symbol || shortAddr(tr.mint || "", 4)}
                      </p>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-white/35">
                      {tr.tokenAmount != null ? `${fmtTok(tr.tokenAmount, 4)} tok` : ""}
                      {tr.solAmount != null ? ` · ${Number(tr.solAmount).toFixed(3)} SOL` : ""}
                      {tr.txHash ? ` · ${shortAddr(tr.txHash, 4)}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-semibold">
                      {tr.usd != null ? fmtUsd(tr.usd) : "—"}
                    </p>
                    <p className="font-mono text-[10px] text-white/30">{timeAgo(tr.time)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        <Link
          to="/trade/portfolio"
          className="mt-4 block text-center text-[11px] text-white/30 hover:text-white/50"
        >
          ← Portfolio hub
        </Link>
      </div>
    </div>
  );
}
