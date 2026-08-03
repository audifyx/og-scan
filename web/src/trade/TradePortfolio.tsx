/**
 * /trade/portfolio — My portfolio + wallet tracking + holders.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Search,
  Users,
  Wallet,
  Loader2,
  ChevronRight,
  Trash2,
  Trophy,
  RefreshCw,
  Star,
  Plus,
} from "lucide-react";
import { fetchTopHolders, fetchWallet, searchCoins, type MarketCoin } from "./tradeApi";
import { fmtPct, fmtPnl, fmtUsd, shortAddr } from "./tradeFmt";
import {
  addWatchWallet,
  getWatchlist,
  isSolAddr,
  removeWatchWallet,
  type WatchedWallet,
} from "./tradeWatchlist";
import { getRecentWallets, pushRecentWallet, clearRecentWallets } from "./tradeRecent";

type HubTab = "mine" | "track" | "holders";

export default function TradePortfolio() {
  const navigate = useNavigate();
  const { publicKey, connected, wallets, select, connect } = useWallet();
  const myAddr = publicKey?.toBase58();

  const [tab, setTab] = useState<HubTab>("mine");
  const [mine, setMine] = useState<any>(null);
  const [mineLoading, setMineLoading] = useState(false);
  const [watch, setWatch] = useState<WatchedWallet[]>(() => getWatchlist());
  const [watchSnap, setWatchSnap] = useState<Record<string, any>>({});
  const [trackInput, setTrackInput] = useState("");
  const [trackLabel, setTrackLabel] = useState("");
  const [recent, setRecent] = useState(() => getRecentWallets());

  const [holderMint, setHolderMint] = useState("");
  const [holderQ, setHolderQ] = useState("");
  const [mintHits, setMintHits] = useState<MarketCoin[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [holderMeta, setHolderMeta] = useState<{ symbol?: string }>({});
  const [holdersLoading, setHoldersLoading] = useState(false);

  const connectPhantom = () => {
    const phantom = wallets.find((w) => w.adapter.name === "Phantom");
    if (phantom) select(phantom.adapter.name as any);
    setTimeout(() => connect().catch(() => {}), 120);
  };

  const loadMine = useCallback(async () => {
    if (!myAddr) {
      setMine(null);
      return;
    }
    setMineLoading(true);
    try {
      const w = await fetchWallet(myAddr);
      setMine(w?.ok ? w : { ok: false, error: w?.error || "Load failed", holdings: [] });
      pushRecentWallet(myAddr);
      setRecent(getRecentWallets());
    } catch {
      setMine({ ok: false, error: "Load failed", holdings: [] });
    } finally {
      setMineLoading(false);
    }
  }, [myAddr]);

  const refreshWatch = useCallback(async () => {
    const list = getWatchlist();
    setWatch(list);
    const snaps: Record<string, any> = {};
    await Promise.all(
      list.slice(0, 12).map(async (w) => {
        try {
          const d = await fetchWallet(w.address);
          if (d?.ok) snaps[w.address] = d;
        } catch {
          /* ignore */
        }
      }),
    );
    setWatchSnap(snaps);
  }, []);

  useEffect(() => {
    if (tab === "mine" && myAddr) void loadMine();
  }, [tab, myAddr, loadMine]);

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
    try {
      const d = await fetchTopHolders(mint);
      setHolders(Array.isArray(d?.holders) ? d.holders : []);
      setHolderMeta({ symbol: d?.symbol || mintHits.find((c) => c.mint === mint)?.symbol });
    } finally {
      setHoldersLoading(false);
    }
  };

  const holdings: any[] = Array.isArray(mine?.holdings) ? mine.holdings : [];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#060606]">
      <div className="relative shrink-0 px-4 pt-3 pb-2">
        <h1
          className="text-[26px] font-black tracking-tight"
          style={{ fontFamily: '"Bricolage Grotesque", system-ui' }}
        >
          Portfolio
        </h1>
        <p className="mt-0.5 text-[12px] text-white/40">My bag · tracked wallets · holders</p>

        <div className="mt-3 flex gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
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
              onClick={() => setTab(id)}
              className={`flex-1 rounded-xl py-2.5 text-[12px] font-bold ${
                tab === id ? "bg-white text-black" : "text-white/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {tab === "mine" && (
          <div className="space-y-3">
            {!connected || !myAddr ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <Wallet className="mx-auto h-10 w-10 text-white/30" />
                <p className="mt-3 text-sm text-white/55">Connect Phantom for your portfolio</p>
                <button
                  type="button"
                  onClick={connectPhantom}
                  className="mt-5 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black"
                >
                  Connect Phantom
                </button>
              </div>
            ) : mineLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            ) : (
              <>
                {!mine?.ok && (
                  <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                    {mine?.error || "Could not load portfolio"} — API may be unavailable locally.
                  </p>
                )}
                <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Net worth</p>
                      <p className="mt-1 font-mono text-[34px] font-black leading-none">{fmtUsd(mine?.totalUsd)}</p>
                      <p className="mt-2 font-mono text-xs text-white/40">{shortAddr(myAddr, 6)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadMine()}
                      className="rounded-full border border-white/10 p-2 text-white/45"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl bg-black/40 px-3 py-2.5">
                      <p className="text-[9px] text-white/30">SOL</p>
                      <p className="font-mono text-sm font-bold">
                        {mine?.sol != null ? Number(mine.sol).toFixed(3) : "—"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/40 px-3 py-2.5">
                      <p className="text-[9px] text-white/30">Tokens</p>
                      <p className="font-mono text-sm font-bold">{mine?.tokenCount ?? holdings.length}</p>
                    </div>
                    <div className="rounded-2xl bg-black/40 px-3 py-2.5">
                      <p className="text-[9px] text-white/30">Realized</p>
                      <p
                        className={`font-mono text-sm font-bold ${
                          mine?.pnl?.realizedPnlUsd == null
                            ? "text-white/50"
                            : mine.pnl.realizedPnlUsd >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                        }`}
                      >
                        {fmtPnl(mine?.pnl?.realizedPnlUsd)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/40 px-3 py-2.5">
                      <p className="text-[9px] text-white/30">Unrealized</p>
                      <p
                        className={`font-mono text-sm font-bold ${
                          mine?.pnl?.unrealizedPnlUsd == null
                            ? "text-white/50"
                            : mine.pnl.unrealizedPnlUsd >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                        }`}
                      >
                        {fmtPnl(mine?.pnl?.unrealizedPnlUsd)}
                      </p>
                    </div>
                  </div>
                  {(mine?.pnl?.winRate != null || mine?.pnl?.closedTrades != null) && (
                    <p className="mt-2 text-[11px] text-white/40">
                      {mine?.pnl?.winRate != null
                        ? `WR ${Number(mine.pnl.winRate) > 1 ? Number(mine.pnl.winRate).toFixed(0) : (Number(mine.pnl.winRate) * 100).toFixed(0)}%`
                        : "WR —"}
                      {" · "}
                      {mine?.pnl?.closedTrades ?? 0} closed
                      {mine?.pnl?.wins != null || mine?.pnl?.losses != null
                        ? ` · ${mine?.pnl?.wins ?? "—"}W / ${mine?.pnl?.losses ?? "—"}L`
                        : ""}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => openWallet(myAddr)}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-1 rounded-2xl bg-white text-sm font-bold text-black"
                  >
                    Full wallet view <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  Holdings · {holdings.length}
                </p>
                <div className="space-y-1.5">
                  {holdings.map((h: any) => (
                    <Link
                      key={h.mint}
                      to={`/trade/token/${h.mint}`}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-3"
                    >
                      {h.image ? (
                        <img src={h.image} alt="" className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[10px] font-bold">
                          {(h.symbol || "?").slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{h.symbol || shortAddr(h.mint, 4)}</p>
                        <p className="font-mono text-[10px] text-white/35">
                          {Number(h.uiAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          {h.unpriced ? " · unpriced" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[13px] font-semibold">
                          {h.unpriced || !(h.usdValue > 0) ? "—" : fmtUsd(h.usdValue)}
                        </p>
                        {h.change24h != null && (
                          <p className={`font-mono text-[10px] ${h.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {fmtPct(h.change24h)}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
            <Link
              to="/trade/leaderboard"
              className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 text-sm font-semibold"
            >
              <Trophy className="h-4 w-4" /> Trader board
            </Link>
          </div>
        )}

        {tab === "track" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                Track a wallet
              </p>
              <input
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                placeholder="Paste Solana address"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-sm outline-none focus:border-white/25"
              />
              <input
                value={trackLabel}
                onChange={(e) => setTrackLabel(e.target.value)}
                placeholder="Optional label (e.g. Whale)"
                className="h-10 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm outline-none focus:border-white/25"
              />
              <button
                type="button"
                disabled={!isSolAddr(trackInput.trim())}
                onClick={addTrack}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-black disabled:opacity-40"
              >
                <Plus className="h-4 w-4" /> Add to watchlist
              </button>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                Watching · {watch.length}
              </p>
              <button type="button" onClick={() => void refreshWatch()} className="text-[10px] text-white/40 underline">
                Refresh
              </button>
            </div>

            {!watch.length ? (
              <p className="py-10 text-center text-xs text-white/30">
                No tracked wallets yet — paste an address above
              </p>
            ) : (
              <div className="space-y-1.5">
                {watch.map((w) => {
                  const snap = watchSnap[w.address];
                  return (
                    <div
                      key={w.address}
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => openWallet(w.address)} className="min-w-0 text-left">
                          <p className="flex items-center gap-1.5 text-sm font-bold">
                            <Star className="h-3.5 w-3.5 text-white/40" />
                            {w.label || shortAddr(w.address, 6)}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-white/35">{shortAddr(w.address, 8)}</p>
                          <p className="mt-1 font-mono text-sm font-semibold">{fmtUsd(snap?.totalUsd)}</p>
                          {snap?.pnl && (
                            <p className="mt-1 font-mono text-[10px] text-white/40">
                              R {fmtPnl(snap.pnl.realizedPnlUsd)}
                              {" · "}
                              U {fmtPnl(snap.pnl.unrealizedPnlUsd)}
                              {snap.pnl.winRate != null
                                ? ` · WR ${Number(snap.pnl.winRate) > 1 ? Number(snap.pnl.winRate).toFixed(0) : (Number(snap.pnl.winRate) * 100).toFixed(0)}%`
                                : ""}
                            </p>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeWatchWallet(w.address);
                            setWatch(getWatchlist());
                          }}
                          className="rounded-full border border-white/10 p-2 text-white/35"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {recent.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-white/35">Recent lookups</p>
                  <button
                    type="button"
                    onClick={() => {
                      clearRecentWallets();
                      setRecent([]);
                    }}
                    className="text-[10px] text-white/35"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {recent.slice(0, 8).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => openWallet(a)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2.5 text-left"
                    >
                      <span className="font-mono text-xs">{shortAddr(a, 6)}</span>
                      <ChevronRight className="h-4 w-4 text-white/25" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "holders" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={holderQ}
                onChange={(e) => setHolderQ(e.target.value)}
                placeholder="Search coin or paste mint…"
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-10 pr-3 text-sm outline-none focus:border-white/25"
              />
            </div>
            {isSolAddr(holderQ.trim()) && (
              <button
                type="button"
                onClick={() => void loadHolders(holderQ.trim())}
                className="h-10 w-full rounded-xl border border-white/15 text-xs font-bold"
              >
                Load holders
              </button>
            )}
            {mintHits.map((c) => (
              <button
                key={c.mint}
                type="button"
                onClick={() => {
                  setHolderQ(c.symbol);
                  void loadHolders(c.mint);
                }}
                className="flex w-full items-center gap-2 rounded-xl border border-white/[0.07] px-3 py-2 text-left"
              >
                {c.image ? (
                  <img src={c.image} alt="" className="h-7 w-7 rounded-lg" />
                ) : (
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-[9px] font-bold">
                    {c.symbol.slice(0, 2)}
                  </div>
                )}
                <span className="text-xs font-bold">{c.symbol}</span>
              </button>
            ))}
            {holderMint && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/55">
                  <Users className="h-3.5 w-3.5" /> Top holders
                  {holderMeta.symbol ? ` · $${holderMeta.symbol}` : ""}
                </p>
                {holdersLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-white/30" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {holders.slice(0, 40).map((h: any, i: number) => {
                      const addr = h.owner || h.address;
                      return (
                        <button
                          key={addr || i}
                          type="button"
                          onClick={() => addr && openWallet(addr)}
                          className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2.5 text-left"
                        >
                          <span className="font-mono text-xs">
                            #{h.rank || i + 1} {shortAddr(addr || "", 5)}
                          </span>
                          <span className="font-mono text-xs">{h.pct != null ? `${Number(h.pct).toFixed(2)}%` : "—"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
