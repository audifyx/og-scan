/**
 * /trade/portfolio — hub: my portfolio, lookup any wallet, top holders by mint.
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

  const holdings: any[] = Array.isArray(mine?.holdings) ? mine.holdings : [];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#050505]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(255,255,255,0.07), transparent 60%)",
        }}
      />

      <div className="relative shrink-0 px-4 pt-3 pb-2">
        <h1 className="text-[26px] font-black tracking-tight">Portfolio</h1>
        <p className="mt-0.5 text-[12px] text-white/40">Your bag · any wallet · top holders</p>

        <div className="mt-3 flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {(
            [
              ["mine", "Mine"],
              ["lookup", "Wallets"],
              ["holders", "Holders"],
            ] as [HubTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 rounded-xl py-2.5 text-[12px] font-bold transition-all ${
                tab === id ? "bg-white text-black shadow-sm" : "text-white/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
        {tab === "mine" && (
          <div className="space-y-3">
            {!connected || !myAddr ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
                  <Wallet className="h-7 w-7 text-white/50" />
                </div>
                <p className="mt-4 text-sm text-white/55">Connect Phantom to view your full portfolio</p>
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
                <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Net worth</p>
                      <p className="mt-1 font-mono text-[34px] font-black tracking-tight leading-none">
                        {fmtUsd(mine?.totalUsd)}
                      </p>
                      <p className="mt-2 font-mono text-[12px] text-white/40">{shortAddr(myAddr, 6)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadMine()}
                      className="rounded-full border border-white/10 p-2 text-white/45 hover:bg-white/5"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
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
                          (mine?.pnl?.realizedPnlUsd || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {fmtUsd(mine?.pnl?.realizedPnlUsd)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openWallet(myAddr)}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-1 rounded-2xl bg-white text-sm font-bold text-black"
                  >
                    Open full wallet <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between px-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                    All holdings · {holdings.length}
                  </p>
                </div>

                {!holdings.length ? (
                  <p className="py-10 text-center text-xs text-white/30">No SPL balances found</p>
                ) : (
                  <div className="space-y-1.5">
                    {holdings.map((h: any) => (
                      <Link
                        key={h.mint}
                        to={`/trade/token/${h.mint}`}
                        className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 hover:bg-white/[0.05]"
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
                )}
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

        {tab === "lookup" && (
          <div className="space-y-4">
            <form onSubmit={submitLookup} className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Paste any Solana wallet…"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-3 font-mono text-sm outline-none focus:border-white/30"
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
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left"
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
                <p className="text-[10px] uppercase tracking-wider text-white/35">Recent</p>
                {recent.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearRecentWallets();
                      setRecent([]);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] text-white/35"
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
                      className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left"
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
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={holderQ}
                  onChange={(e) => setHolderQ(e.target.value)}
                  placeholder="Search coin or paste mint…"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm outline-none focus:border-white/30"
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
                      className="flex w-full items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left"
                    >
                      {c.image ? (
                        <img src={c.image} alt="" className="h-7 w-7 rounded-lg" />
                      ) : (
                        <div className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-[9px] font-bold">
                          {c.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold">{c.symbol}</p>
                        <p className="truncate font-mono text-[10px] text-white/35">{shortAddr(c.mint, 4)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {holderMint && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
                    <Users className="h-3.5 w-3.5" />
                    Top holders{holderMeta.symbol ? ` · $${holderMeta.symbol}` : ""}
                  </p>
                  <Link to={`/trade/token/${holderMint}`} className="text-[10px] text-white/40 underline">
                    Token
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
                          className="flex w-full items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left"
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
