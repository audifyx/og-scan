/**
 * /trade/portfolio — hub: my portfolio, lookup any wallet, top holders by mint.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Briefcase,
  Search,
  Users,
  Wallet,
  Loader2,
  ChevronRight,
  Trash2,
  Trophy,
} from "lucide-react";
import { fetchTopHolders, fetchWallet, searchCoins, type MarketCoin } from "./tradeApi";
import { fmtPct, fmtUsd, shortAddr } from "./tradeFmt";
import { clearRecentWallets, getRecentWallets, isSolAddr, pushRecentWallet } from "./tradeRecent";

type HubTab = "mine" | "lookup" | "holders";

export default function TradePortfolio() {
  const navigate = useNavigate();
  const { publicKey, connected, wallets, select, connect } = useWallet();
  const myAddr = publicKey?.toBase58();

  const [tab, setTab] = useState<HubTab>("mine");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(() => getRecentWallets());
  const [mine, setMine] = useState<any>(null);
  const [mineLoading, setMineLoading] = useState(false);

  const [holderMint, setHolderMint] = useState("");
  const [holderQ, setHolderQ] = useState("");
  const [mintHits, setMintHits] = useState<MarketCoin[]>([]);
  const [holders, setHolders] = useState<any[]>([]);
  const [holderMeta, setHolderMeta] = useState<{ symbol?: string; stale?: boolean }>({});
  const [holdersLoading, setHoldersLoading] = useState(false);

  const connectPhantom = () => {
    const phantom = wallets.find((w) => w.adapter.name === "Phantom");
    if (phantom) select(phantom.adapter.name as any);
    setTimeout(() => {
      connect().catch(() => {});
    }, 120);
  };

  const loadMine = useCallback(async () => {
    if (!myAddr) {
      setMine(null);
      return;
    }
    setMineLoading(true);
    try {
      const w = await fetchWallet(myAddr);
      setMine(w?.ok ? w : { ok: false, error: w?.error || "Could not load wallet", totalUsd: 0, holdings: [] });
      pushRecentWallet(myAddr);
      setRecent(getRecentWallets());
    } catch {
      setMine({ ok: false, error: "Could not load wallet", totalUsd: 0, holdings: [] });
    } finally {
      setMineLoading(false);
    }
  }, [myAddr]);

  useEffect(() => {
    if (tab === "mine" && myAddr) void loadMine();
  }, [tab, myAddr, loadMine]);

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
    const a = addr.trim();
    if (!isSolAddr(a)) return;
    pushRecentWallet(a);
    setRecent(getRecentWallets());
    navigate(`/trade/wallet/${a}`);
  };

  const submitLookup = (e: React.FormEvent) => {
    e.preventDefault();
    openWallet(query);
  };

  const loadHolders = async (mint: string) => {
    if (!isSolAddr(mint)) return;
    setHolderMint(mint);
    setHoldersLoading(true);
    setHolders([]);
    try {
      const d = await fetchTopHolders(mint);
      setHolders(Array.isArray(d?.holders) ? d.holders : []);
      setHolderMeta({
        symbol: d?.symbol || mintHits.find((c) => c.mint === mint)?.symbol,
        stale: !!d?.holdersStale,
      });
    } finally {
      setHoldersLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black">
      <div className="shrink-0 border-b border-white/10 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">Portfolio</h1>
            <p className="mt-0.5 text-xs text-white/40">Your bag · any wallet · top holders</p>
          </div>
          <Briefcase className="h-5 w-5 text-white/25" />
        </div>
        <div className="mt-3 flex gap-1">
          {(
            [
              ["mine", "Mine", Wallet],
              ["lookup", "Wallets", Search],
              ["holders", "Holders", Users],
            ] as [HubTab, string, typeof Wallet][]
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold ${
                tab === id ? "bg-white text-black" : "text-white/40"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "mine" && (
          <div className="space-y-3">
            {!connected || !myAddr ? (
              <div className="rounded-2xl border border-white/10 bg-[#050505] p-6 text-center">
                <Wallet className="mx-auto h-9 w-9 text-white/25" />
                <p className="mt-3 text-sm text-white/55">Connect Phantom to view your portfolio</p>
                <button
                  type="button"
                  onClick={connectPhantom}
                  className="mt-4 h-12 w-full rounded-2xl bg-white text-sm font-bold text-black"
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
                <button
                  type="button"
                  onClick={() => openWallet(myAddr)}
                  className="w-full rounded-2xl border border-white/10 bg-[#050505] p-4 text-left transition hover:border-white/25"
                >
                  <p className="text-[10px] uppercase tracking-wider text-white/35">My wallet</p>
                  <p className="mt-1 font-mono text-sm font-semibold">{shortAddr(myAddr, 6)}</p>
                  <p className="mt-3 font-mono text-3xl font-bold">{fmtUsd(mine?.totalUsd)}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/40">
                    <span>{mine?.sol != null ? `${Number(mine.sol).toFixed(3)} SOL` : "—"}</span>
                    <span>{mine?.tokenCount ?? mine?.holdings?.length ?? 0} tokens</span>
                    {mine?.pnl?.winRate != null && (
                      <span>
                        WR{" "}
                        {Number(mine.pnl.winRate) > 1
                          ? Number(mine.pnl.winRate).toFixed(0)
                          : (Number(mine.pnl.winRate) * 100).toFixed(0)}
                        %
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-black/50 px-3 py-2">
                      <p className="text-[9px] text-white/30">Realized</p>
                      <p
                        className={`font-mono text-xs font-semibold ${
                          (mine?.pnl?.realizedPnlUsd || 0) >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {fmtUsd(mine?.pnl?.realizedPnlUsd)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-black/50 px-3 py-2">
                      <p className="text-[9px] text-white/30">Unrealized</p>
                      <p
                        className={`font-mono text-xs font-semibold ${
                          (mine?.pnl?.unrealizedPnlUsd || 0) >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {fmtUsd(mine?.pnl?.unrealizedPnlUsd)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1 text-xs text-white/50">
                    Open full portfolio <ChevronRight className="h-3.5 w-3.5" />
                  </p>
                </button>

                {(mine?.holdings || []).slice(0, 8).map((h: any) => (
                  <Link
                    key={h.mint}
                    to={`/trade/token/${h.mint}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#050505] px-3 py-2.5 hover:bg-white/[0.04]"
                  >
                    {h.image ? (
                      <img src={h.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
                        {(h.symbol || "?").slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{h.symbol || "???"}</p>
                      <p className="font-mono text-[10px] text-white/35">
                        {Number(h.uiAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold">{fmtUsd(h.usdValue)}</p>
                      {h.change24h != null && (
                        <p className={`font-mono text-[10px] ${h.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {fmtPct(h.change24h)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </>
            )}

            <Link
              to="/trade/leaderboard"
              className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 text-sm font-semibold"
            >
              <Trophy className="h-4 w-4" /> Trader board
            </Link>
          </div>
        )}

        {tab === "lookup" && (
          <div className="space-y-4">
            <form onSubmit={submitLookup} className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-white/35">Wallet address</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Paste any Solana wallet…"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#050505] pl-10 pr-3 font-mono text-sm outline-none focus:border-white/30"
                />
              </div>
              <button
                type="submit"
                disabled={!isSolAddr(query.trim())}
                className="h-12 w-full rounded-2xl bg-white text-sm font-bold text-black disabled:opacity-40"
              >
                View portfolio
              </button>
            </form>

            {myAddr && (
              <button
                type="button"
                onClick={() => openWallet(myAddr)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-left"
              >
                <div>
                  <p className="text-[10px] text-white/35">Connected</p>
                  <p className="font-mono text-xs font-semibold">{shortAddr(myAddr, 6)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30" />
              </button>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-white/35">Recent wallets</p>
                {recent.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearRecentWallets();
                      setRecent([]);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60"
                  >
                    <Trash2 className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
              {!recent.length ? (
                <p className="py-8 text-center text-xs text-white/30">Looked-up wallets show up here</p>
              ) : (
                <div className="space-y-1.5">
                  {recent.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => openWallet(a)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#050505] px-3 py-3 text-left hover:bg-white/[0.04]"
                    >
                      <span className="font-mono text-xs">{shortAddr(a, 6)}</span>
                      <ChevronRight className="h-4 w-4 text-white/30" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "holders" && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/35">Token mint or ticker</label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={holderQ}
                  onChange={(e) => setHolderQ(e.target.value)}
                  placeholder="Search coin or paste mint…"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-[#050505] pl-10 pr-3 text-sm outline-none focus:border-white/30"
                />
              </div>
              {isSolAddr(holderQ.trim()) && (
                <button
                  type="button"
                  onClick={() => void loadHolders(holderQ.trim())}
                  className="mt-2 h-10 w-full rounded-xl border border-white/15 text-xs font-bold"
                >
                  Load holders for mint
                </button>
              )}
              {mintHits.length > 0 && (
                <div className="mt-2 space-y-1">
                  {mintHits.map((c) => (
                    <button
                      key={c.mint}
                      type="button"
                      onClick={() => {
                        setHolderQ(c.symbol);
                        void loadHolders(c.mint);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#050505] px-3 py-2 text-left hover:bg-white/[0.04]"
                    >
                      {c.image ? (
                        <img src={c.image} alt="" className="h-7 w-7 rounded-full" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold">
                          {c.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold">{c.symbol}</p>
                        <p className="truncate font-mono text-[10px] text-white/35">{shortAddr(c.mint, 4)}</p>
                      </div>
                      <p className="font-mono text-[10px] text-white/40">{fmtUsd(c.mcap)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {holderMint && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-white/60">
                    Top holders{holderMeta.symbol ? ` · $${holderMeta.symbol}` : ""}
                    {holderMeta.stale ? " · cached" : ""}
                  </p>
                  <Link to={`/trade/token/${holderMint}`} className="text-[10px] text-white/40 underline">
                    Token page
                  </Link>
                </div>
                {holdersLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                  </div>
                ) : !holders.length ? (
                  <p className="py-10 text-center text-xs text-white/30">No holder data</p>
                ) : (
                  <div className="space-y-1.5">
                    {holders.slice(0, 50).map((h: any, i: number) => {
                      const addr = h.owner || h.address;
                      return (
                        <button
                          key={addr || i}
                          type="button"
                          onClick={() => addr && openWallet(addr)}
                          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#050505] px-3 py-2.5 text-left hover:bg-white/[0.04]"
                        >
                          <div>
                            <p className="font-mono text-xs">
                              #{h.rank || i + 1} {shortAddr(addr || "", 5)}
                              {h.label ? <span className="ml-1 text-white/30">· {h.label}</span> : null}
                            </p>
                            <p className="text-[10px] text-white/35">
                              {h.uiAmount != null
                                ? Number(h.uiAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                : "—"}{" "}
                              tokens
                            </p>
                          </div>
                          <div className="text-right font-mono text-xs">
                            <p>{h.pct != null ? `${Number(h.pct).toFixed(2)}%` : "—"}</p>
                            <p className="text-white/40">{fmtUsd(h.usdValue ?? h.holdingUsd)}</p>
                          </div>
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
