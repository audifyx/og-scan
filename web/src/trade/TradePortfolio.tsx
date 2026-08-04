/**
 * /trade/portfolio — Mine · Track · Holders
 * Premium layout aligned with Trade Home (Bricolage, #060606).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Users,
  Wallet,
  Loader2,
  ChevronRight,
  Trash2,
  Trophy,
  RefreshCw,
  Plus,
  KeyRound,
} from "lucide-react";
import { useActiveTradingWallet } from "@/hooks/useActiveTradingWallet";
import { useTradeWalletPicker } from "./TradeWalletPicker";
import {
  extractWalletPnlTokens,
  fetchTopHolders,
  fetchWallet,
  mergeHoldingPnl,
  normalizePnlToken,
  searchCoins,
  type MarketCoin,
  type WalletPnlToken,
} from "./tradeApi";
import { fmtPct, fmtPnl, fmtTok, fmtUsd, shortAddr } from "./tradeFmt";
import {
  addWatchWallet,
  getWatchlist,
  isSolAddr,
  removeWatchWallet,
  type WatchedWallet,
} from "./tradeWatchlist";
import { getRecentWallets, pushRecentWallet, clearRecentWallets } from "./tradeRecent";
import TokenAvatar from "./TokenAvatar";
import ActiveTradingWalletChip from "./ActiveTradingWalletChip";
import "./trade-portfolio.css";

type HubTab = "mine" | "track" | "holders";

const SOL_MINT = "So11111111111111111111111111111111111111112";

function wrLabel(wr: number | null | undefined): string {
  if (wr == null || !Number.isFinite(Number(wr))) return "—";
  const n = Number(wr);
  return `${n > 1 ? n.toFixed(0) : (n * 100).toFixed(0)}%`;
}

function pnlTone(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "tp__muted";
  return n >= 0 ? "tp__up" : "tp__down";
}

export default function TradePortfolio() {
  const navigate = useNavigate();
  const {
    address: myAddr,
    ready,
    localActive,
    label: activeLabel,
    localWallets,
    defaultWallet,
    mode: tradeMode,
  } = useActiveTradingWallet();
  const { openPicker, picker } = useTradeWalletPicker();

  const [tab, setTab] = useState<HubTab>("mine");
  const [mine, setMine] = useState<any>(null);
  const [mineLoading, setMineLoading] = useState(false);
  const [mineErr, setMineErr] = useState("");
  const [watch, setWatch] = useState<WatchedWallet[]>(() => getWatchlist());
  const [watchSnap, setWatchSnap] = useState<Record<string, any>>({});
  const [watchErr, setWatchErr] = useState("");
  const [watchLoading, setWatchLoading] = useState(false);
  const [trackInput, setTrackInput] = useState("");
  const [trackLabel, setTrackLabel] = useState("");
  const [recent, setRecent] = useState(() => getRecentWallets());

  const [holderMint, setHolderMint] = useState("");
  const [holderQ, setHolderQ] = useState("");
  const [mintHits, setMintHits] = useState<MarketCoin[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [holderMeta, setHolderMeta] = useState<{ symbol?: string; holderCount?: number | null }>({});
  const [holdersLoading, setHoldersLoading] = useState(false);
  const [holdersErr, setHoldersErr] = useState("");

  const loadMine = useCallback(async () => {
    if (!myAddr) {
      setMine(null);
      setMineErr("");
      return;
    }
    setMineLoading(true);
    setMineErr("");
    try {
      const w = await fetchWallet(myAddr);
      if (!w?.ok) {
        setMine({ ok: false, holdings: [] });
        setMineErr(w?.error || "Could not load portfolio");
      } else {
        setMine(w);
      }
      pushRecentWallet(myAddr);
      setRecent(getRecentWallets());
    } catch {
      setMine({ ok: false, holdings: [] });
      setMineErr("Portfolio API failed — try again");
    } finally {
      setMineLoading(false);
    }
  }, [myAddr]);

  const refreshWatch = useCallback(async () => {
    const list = getWatchlist();
    setWatch(list);
    if (!list.length) {
      setWatchSnap({});
      setWatchErr("");
      return;
    }
    setWatchLoading(true);
    setWatchErr("");
    const snaps: Record<string, any> = {};
    let fails = 0;
    await Promise.all(
      list.slice(0, 12).map(async (w) => {
        try {
          const d = await fetchWallet(w.address);
          if (d?.ok) snaps[w.address] = d;
          else fails += 1;
        } catch {
          fails += 1;
        }
      }),
    );
    setWatchSnap(snaps);
    if (fails > 0 && Object.keys(snaps).length === 0) {
      setWatchErr("Could not load watchlist wallets — API may be unavailable");
    } else if (fails > 0) {
      setWatchErr(`${fails} wallet${fails === 1 ? "" : "s"} failed to refresh`);
    }
    setWatchLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "mine" && ready && myAddr) void loadMine();
  }, [tab, ready, myAddr, loadMine]);

  useEffect(() => {
    if (tab === "track") void refreshWatch();
  }, [tab, refreshWatch]);

  useEffect(() => {
    const q = holderQ.trim();
    if (q.length < 2) {
      setMintHits([]);
      return;
    }
    let on = true;
    const t = setTimeout(() => {
      searchCoins(q).then((rows) => {
        if (on) setMintHits(rows.slice(0, 8));
      });
    }, 280);
    return () => {
      on = false;
      clearTimeout(t);
    };
  }, [holderQ]);

  const openWallet = (addr: string) => {
    if (!isSolAddr(addr)) return;
    pushRecentWallet(addr);
    setRecent(getRecentWallets());
    navigate(`/trade/wallet/${addr}`);
  };

  const addTrack = () => {
    const a = trackInput.trim();
    if (!isSolAddr(a)) return;
    addWatchWallet(a, trackLabel);
    setTrackInput("");
    setTrackLabel("");
    setWatch(getWatchlist());
    void refreshWatch();
  };

  const loadHolders = async (mint: string) => {
    if (!isSolAddr(mint)) return;
    setHolderMint(mint);
    setHoldersLoading(true);
    setHoldersErr("");
    try {
      const d = await fetchTopHolders(mint);
      if (d?.ok === false) {
        setHolders([]);
        setHoldersErr(d?.error || "Could not load holders");
        setHolderMeta({});
        return;
      }
      setHolders(Array.isArray(d?.holders) ? d.holders : []);
      const hc = Number(d?.holderCount ?? d?.numHolders);
      setHolderMeta({
        symbol: d?.symbol || mintHits.find((c) => c.mint === mint)?.symbol,
        holderCount: Number.isFinite(hc) && hc > 0 ? hc : null,
      });
      if (!Array.isArray(d?.holders) || !d.holders.length) {
        setHoldersErr("No holder data returned for this mint");
      }
    } catch {
      setHolders([]);
      setHoldersErr("Holders API failed — try again");
    } finally {
      setHoldersLoading(false);
    }
  };

  const pnlByMint = useMemo(() => {
    const map = new Map<string, WalletPnlToken>();
    for (const raw of extractWalletPnlTokens(mine)) {
      const row = normalizePnlToken(raw);
      if (row) map.set(row.mint, row);
    }
    return map;
  }, [mine]);

  const holdings = useMemo(() => {
    if (!mine?.ok) return [];
    const sol = {
      mint: SOL_MINT,
      symbol: "SOL",
      name: "Solana",
      uiAmount: mine.sol,
      usdValue: mine.solUsd,
      image: null as string | null,
      isSol: true,
      unpriced: false,
      costUsd: null as number | null,
      potUsd: (mine.solUsd as number) ?? null,
      unrealizedUsd: null as number | null,
      unrealizedPct: null as number | null,
      change24h: null as number | null,
    };
    const tokens = (Array.isArray(mine?.holdings) ? mine.holdings : []).map((h: any) =>
      mergeHoldingPnl(h, pnlByMint),
    );
    return [sol, ...tokens];
  }, [mine, pnlByMint]);

  const tokenLabel = (h: any) =>
    (h.symbol && String(h.symbol).trim()) || shortAddr(h.mint || "", 4);
  const tokenName = (h: any) =>
    (h.name && String(h.name).trim()) || (h.isSol ? "Solana" : "Token");

  return (
    <div className="tp">
      <div className="tp__glow" />
      <div className="tp__top">
        <p className="tp__kicker">OrbitX Trade</p>
        <h1 className="tp__title">Portfolio</h1>
        <p className="tp__sub">Holdings, tracked wallets, and top holders</p>

        <Link
          to="/trade/wallets"
          className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
            <KeyRound className="h-4 w-4 text-white/55" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">Trading wallets</p>
            <p className="truncate text-[11px] text-white/40">
              {localWallets.length
                ? `${localWallets.length} local · default ${defaultWallet ? shortAddr(defaultWallet.publicKey, 4) : "—"} · ${tradeMode === "local" ? "local mode" : "connected mode"}`
                : "Import / export keys · set default for Trade"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
        </Link>

        <div className="tp__tabs" role="tablist">
          {(
            [
              ["mine", "Mine"],
              ["track", "Track"],
              ["holders", "Holders"],
            ] as [HubTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`tp__tab${tab === id ? " tp__tab--on" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="tp__body">
        {tab === "mine" && (
          <div>
            {!ready || !myAddr ? (
              <div className="tp__empty">
                <Wallet className="mx-auto mb-3 h-9 w-9 opacity-40" />
                <p>
                  {localActive
                    ? "Set a default local trading wallet to see holdings"
                    : "Connect a wallet to see your bag and PnL"}
                </p>
                {picker}
                {localActive ? (
                  <Link to="/trade/wallets" className="tp__btn mt-5 inline-flex items-center justify-center">
                    Manage wallets
                  </Link>
                ) : (
                  <button type="button" onClick={openPicker} className="tp__btn mt-5">
                    Connect wallet
                  </button>
                )}
              </div>
            ) : mineLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            ) : (
              <>
                {mineErr && <div className="tp__err">{mineErr}</div>}

                <div className="tp__panel">
                  <div className="mb-3">
                    <ActiveTradingWalletChip />
                  </div>
                  <p className="tp__label">Net worth</p>
                  <p className="tp__hero-val mt-2">{fmtUsd(mine?.totalUsd)}</p>
                  <p className="mt-2 font-mono text-[11px] text-white/35">
                    {activeLabel || shortAddr(myAddr, 6)}
                  </p>

                  <div className="tp__metrics">
                    <div>
                      <p className="tp__label">SOL</p>
                      <p className="tp__metric-val">
                        {mine?.sol != null ? Number(mine.sol).toFixed(3) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="tp__label">Tokens</p>
                      <p className="tp__metric-val">
                        {mine?.tokenCount ?? Math.max(0, holdings.length - 1)}
                      </p>
                    </div>
                    <div>
                      <p className="tp__label">Realized</p>
                      <p className={`tp__metric-val ${pnlTone(mine?.pnl?.realizedPnlUsd)}`}>
                        {fmtPnl(mine?.pnl?.realizedPnlUsd)}
                      </p>
                    </div>
                    <div>
                      <p className="tp__label">Unrealized</p>
                      <p className={`tp__metric-val ${pnlTone(mine?.pnl?.unrealizedPnlUsd)}`}>
                        {fmtPnl(mine?.pnl?.unrealizedPnlUsd)}
                      </p>
                    </div>
                  </div>

                  {(mine?.pnl?.winRate != null || mine?.pnl?.closedTrades != null) && (
                    <p className="mt-3 text-[12px] text-white/40">
                      WR {wrLabel(mine?.pnl?.winRate)}
                      {" · "}
                      {mine?.pnl?.closedTrades ?? 0} closed
                      {mine?.pnl?.wins != null || mine?.pnl?.losses != null
                        ? ` · ${mine?.pnl?.wins ?? "—"}W / ${mine?.pnl?.losses ?? "—"}L`
                        : ""}
                    </p>
                  )}

                  <div className="mt-5 flex gap-2 pb-2">
                    <button type="button" onClick={() => openWallet(myAddr)} className="tp__btn">
                      Full wallet <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadMine()}
                      className="tp__icon-btn shrink-0"
                      aria-label="Refresh"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <section className="tp__section">
                  <div className="tp__section-head">
                    <h2 className="tp__section-title">Holdings</h2>
                    <span className="text-[11px] text-white/35">{holdings.length}</span>
                  </div>
                  {!holdings.length ? (
                    <p className="tp__empty py-8">No token holdings found</p>
                  ) : (
                    <div className="tp__panel tp__holdings">
                      {holdings.map((h: any) => (
                        <Link
                          key={h.mint}
                          to={h.isSol ? `/trade/wallet/${myAddr}` : `/trade/token/${h.mint}`}
                          className="tp__row"
                        >
                          <TokenAvatar
                            image={h.image}
                            symbol={tokenLabel(h)}
                            mint={h.mint}
                            size={40}
                            className="tp__avatar"
                            fallbackClassName="tp__avatar-fb"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-bold">{tokenLabel(h)}</p>
                            <p className="tp__row-name">{tokenName(h)}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-white/35">
                              {fmtTok(h.uiAmount, 4)}
                              {h.unpriced ? " · unpriced" : ""}
                            </p>
                            {!h.isSol && (
                              <p className="mt-0.5 font-mono text-[10px] text-white/30">
                                Cost {h.costUsd != null ? fmtUsd(h.costUsd) : "—"}
                                {" · "}Pot{" "}
                                {h.potUsd != null && h.potUsd > 0 ? fmtUsd(h.potUsd) : "—"}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-[13px] font-semibold">
                              {h.unpriced || !(h.usdValue > 0) ? "—" : fmtUsd(h.usdValue)}
                            </p>
                            <p className={`font-mono text-[11px] ${pnlTone(h.unrealizedUsd)}`}>
                              {h.isSol
                                ? "Native"
                                : h.unrealizedUsd != null
                                  ? `${fmtPnl(h.unrealizedUsd)}${
                                      h.unrealizedPct != null ? ` ${fmtPct(h.unrealizedPct)}` : ""
                                    }`
                                  : h.change24h != null
                                    ? fmtPct(h.change24h)
                                    : "uPnL —"}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                <Link to="/trade/leaderboard" className="tp__btn tp__btn--ghost mt-6">
                  <Trophy className="h-4 w-4" /> Trader board
                </Link>
              </>
            )}
          </div>
        )}

        {tab === "track" && (
          <div>
            <section>
              <p className="tp__label">Add wallet</p>
              <div className="mt-3 space-y-2">
                <input
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                  placeholder="Paste Solana address"
                  className="tp__input tp__input--mono"
                />
                <input
                  value={trackLabel}
                  onChange={(e) => setTrackLabel(e.target.value)}
                  placeholder="Optional label (e.g. Whale)"
                  className="tp__input"
                />
                <button
                  type="button"
                  disabled={!isSolAddr(trackInput.trim())}
                  onClick={addTrack}
                  className="tp__btn"
                >
                  <Plus className="h-4 w-4" /> Track wallet
                </button>
              </div>
            </section>

            <section className="tp__section">
              <div className="tp__section-head">
                <h2 className="tp__section-title">Watchlist</h2>
                <button
                  type="button"
                  onClick={() => void refreshWatch()}
                  className="text-[11px] text-white/40 underline"
                >
                  {watchLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {watchErr && <div className="tp__err">{watchErr}</div>}
              {!watch.length ? (
                <p className="tp__empty py-8">No tracked wallets — paste an address above</p>
              ) : (
                <div>
                  {watch.map((w) => {
                    const snap = watchSnap[w.address];
                    const topHoldings = Array.isArray(snap?.holdings)
                      ? snap.holdings.slice(0, 3)
                      : [];
                    return (
                      <div key={w.address} className="tp__row">
                        <button
                          type="button"
                          onClick={() => openWallet(w.address)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="text-[14px] font-bold">{w.label || shortAddr(w.address, 6)}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-white/35">
                            {shortAddr(w.address, 8)}
                          </p>
                          <p className="mt-1.5 font-mono text-[15px] font-bold">
                            {snap ? fmtUsd(snap.totalUsd) : watchLoading ? "…" : "—"}
                          </p>
                          {snap && (
                            <p className="mt-1 font-mono text-[11px] text-white/40">
                              {snap.tokenCount ?? snap.holdings?.length ?? 0} tok
                              {" · "}
                              R{" "}
                              <span className={pnlTone(snap.pnl?.realizedPnlUsd)}>
                                {fmtPnl(snap.pnl?.realizedPnlUsd)}
                              </span>
                              {" · "}U{" "}
                              <span className={pnlTone(snap.pnl?.unrealizedPnlUsd)}>
                                {fmtPnl(snap.pnl?.unrealizedPnlUsd)}
                              </span>
                              {snap.pnl?.winRate != null
                                ? ` · WR ${wrLabel(snap.pnl.winRate)}`
                                : ""}
                              {snap.tradeCount != null ? ` · ${snap.tradeCount} swaps` : ""}
                            </p>
                          )}
                          {topHoldings.length > 0 && (
                            <div className="tp__watch-preview">
                              {topHoldings.map((h: any) => (
                                <span key={h.mint} className="tp__watch-chip">
                                  <TokenAvatar
                                    image={h.image}
                                    symbol={h.symbol}
                                    mint={h.mint}
                                    size={16}
                                  />
                                  {(h.symbol || shortAddr(h.mint, 3)).slice(0, 8)}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeWatchWallet(w.address);
                            setWatch(getWatchlist());
                          }}
                          className="tp__icon-btn"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {recent.length > 0 && (
              <section className="tp__section">
                <div className="tp__section-head">
                  <h2 className="tp__section-title">Recent</h2>
                  <button
                    type="button"
                    onClick={() => {
                      clearRecentWallets();
                      setRecent([]);
                    }}
                    className="text-[11px] text-white/35"
                  >
                    Clear
                  </button>
                </div>
                {recent.slice(0, 8).map((a) => (
                  <button key={a} type="button" onClick={() => openWallet(a)} className="tp__row">
                    <span className="font-mono text-[13px]">{shortAddr(a, 6)}</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-white/25" />
                  </button>
                ))}
              </section>
            )}
          </div>
        )}

        {tab === "holders" && (
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={holderQ}
                onChange={(e) => setHolderQ(e.target.value)}
                placeholder="Search coin or paste mint…"
                className="tp__input pl-10"
                style={{ paddingLeft: 40 }}
              />
            </div>
            {isSolAddr(holderQ.trim()) && (
              <button
                type="button"
                onClick={() => void loadHolders(holderQ.trim())}
                className="tp__btn tp__btn--ghost mt-3"
              >
                Load holders
              </button>
            )}

            {mintHits.length > 0 && (
              <section className="tp__section">
                <h2 className="tp__section-title mb-1">Matches</h2>
                {mintHits.map((c) => (
                  <button
                    key={c.mint}
                    type="button"
                    onClick={() => {
                      setHolderQ(c.symbol || c.mint);
                      void loadHolders(c.mint);
                    }}
                    className="tp__row"
                  >
                    <TokenAvatar image={c.image} symbol={c.symbol} mint={c.mint} size={32} />
                    <div className="min-w-0 text-left">
                      <p className="truncate text-[13px] font-bold">
                        ${(c.symbol || shortAddr(c.mint, 4)).trim()}
                      </p>
                      <p className="truncate text-[11px] text-white/35">
                        {(c.name || "Token").trim()}
                      </p>
                    </div>
                    <span className="ml-auto font-mono text-[11px] text-white/30">
                      {shortAddr(c.mint, 4)}
                    </span>
                  </button>
                ))}
              </section>
            )}

            {holderMint && (
              <section className="tp__section">
                <div className="tp__section-head">
                  <h2 className="tp__section-title flex items-center gap-1.5">
                    <Users className="h-4 w-4 opacity-50" />
                    Top holders
                    {holderMeta.symbol ? ` · $${holderMeta.symbol}` : ""}
                  </h2>
                  {holderMeta.holderCount != null && (
                    <span className="font-mono text-[11px] text-white/35">
                      {holderMeta.holderCount.toLocaleString()} total
                    </span>
                  )}
                </div>
                {holdersErr && <div className="tp__err">{holdersErr}</div>}
                {holdersLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                  </div>
                ) : (
                  <div>
                    {holders.slice(0, 40).map((h: any, i: number) => {
                      const addr = h.owner || h.address;
                      return (
                        <button
                          key={addr || i}
                          type="button"
                          onClick={() => addr && openWallet(addr)}
                          className="tp__row"
                        >
                          <span className="font-mono text-[12px] text-white/40">
                            #{h.rank || i + 1}
                          </span>
                          <span className="font-mono text-[13px]">{shortAddr(addr || "", 5)}</span>
                          <span className="ml-auto font-mono text-[12px]">
                            {h.pct != null ? `${Number(h.pct).toFixed(2)}%` : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
