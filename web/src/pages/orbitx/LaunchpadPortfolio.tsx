// OrbitX Launchpad — Portfolio. Wallet-native, all real data:
//   Assets      — SPL/Token-2022 holdings + native SOL via Helius DAS + Jupiter
//   NFTs        — owned NFTs via Helius DAS (getAssetsByOwner)
//   Performance — real realized/unrealized P&L computed from actual on-chain
//                 buy/sell transaction history (no simulated numbers)
//   Your Launches — tokens this wallet has launched through OrbitX
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from "recharts";
import { getWalletOverview, getAssets, computeWalletPnL } from "@/lib/solana-api";
import { listByCreator, type OrbitxToken } from "@/lib/orbitx/registry";
import { fmtCompactUsd } from "./lpx";
import { shortAddr, TokenLogo, GRADUATION_MC_USD } from "./_shared";
import { useWalletNfts } from "./nfts";
import {
  Wallet, Loader2, Rocket, Briefcase, Image as ImageIcon, LineChart as LineChartIcon,
  Download, TrendingUp, TrendingDown, Trophy, ExternalLink, Coins,
} from "lucide-react";

type Tab = "assets" | "nfts" | "performance" | "launches";
const PIE_COLORS = ["hsl(var(--pf-green))", "hsl(var(--pf-gold))", "hsl(var(--pf-blue))", "hsl(var(--pf-red))", "hsl(152 60% 65%)", "hsl(42 70% 70%)", "hsl(190 70% 65%)", "hsl(356 60% 70%)"];

function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function LaunchpadPortfolio() {
  const { connected, publicKey } = useWallet();
  const addr = publicKey?.toBase58();
  const [tab, setTab] = useState<Tab>("assets");

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["orbitx-wallet-overview", addr],
    enabled: !!addr,
    refetchInterval: 60_000,
    queryFn: () => getWalletOverview(addr!),
  });

  const { data: assetsData, isLoading: loadingAssets } = useQuery({
    queryKey: ["orbitx-wallet-assets", addr],
    enabled: !!addr,
    refetchInterval: 60_000,
    queryFn: () => getAssets(addr!, 1, 100),
  });

  const { data: nfts, isLoading: loadingNfts } = useWalletNfts(addr);

  const holdings = useMemo(() => (assetsData?.items ?? []).map((t) => ({
    mint: t.id,
    name: t.content.metadata.name,
    symbol: t.content.metadata.symbol,
    image: t.content.links?.image ?? undefined,
    price: t.token_info?.price_info?.price_per_token ?? 0,
    value: t.token_info?.price_info?.total_price ?? 0,
    balance: t.token_info?.balance ?? 0,
  })), [assetsData]);

  const { data: pnl, isLoading: loadingPnl } = useQuery({
    queryKey: ["orbitx-wallet-pnl", addr, holdings.length],
    enabled: !!addr && tab === "performance",
    staleTime: 60_000,
    queryFn: () => computeWalletPnL(addr!, holdings),
  });

  const { data: myLaunches, isLoading: loadingLaunches } = useQuery({
    queryKey: ["orbitx-portfolio-launches", addr],
    enabled: !!addr && tab === "launches",
    queryFn: () => listByCreator(addr!, 200),
  });

  const pieData = useMemo(() => {
    const sorted = [...holdings].filter((h) => h.value > 0).sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 7);
    const rest = sorted.slice(7).reduce((a, h) => a + h.value, 0);
    const solSlice = overview?.usdValue ? [{ name: "SOL", value: overview.usdValue }] : [];
    const out = [...solSlice, ...top.map((h) => ({ name: h.symbol || shortAddr(h.mint, 3), value: h.value }))];
    if (rest > 0) out.push({ name: "Other", value: rest });
    return out;
  }, [holdings, overview]);

  if (!connected || !addr) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="pf-card flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-green))]/15"><Wallet className="h-7 w-7 text-[hsl(var(--pf-green))]" /></div>
          <div>
            <div className="text-lg font-black text-[hsl(var(--pf-ink))]">Connect your wallet</div>
            <div className="mx-auto mt-1 max-w-sm text-sm text-[hsl(var(--pf-muted))]">Your portfolio reads holdings, NFTs, and trade history straight from your connected wallet. Connect up top to see your positions and live value.</div>
          </div>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "assets", label: "Assets", icon: Briefcase },
    { id: "nfts", label: "NFTs", icon: ImageIcon },
    { id: "performance", label: "Performance", icon: LineChartIcon },
    { id: "launches", label: "Your Launches", icon: Rocket },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-[hsl(var(--pf-green))]" />
        <h1 className="text-xl font-black tracking-tight text-[hsl(var(--pf-ink))]">Portfolio</h1>
      </div>

      <div className="pf-card mb-4 p-5">
        <div className="pf-mono text-[10px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Total portfolio value</div>
        <div className="mt-1 text-3xl font-black text-[hsl(var(--pf-green))]">{loadingOverview ? "…" : fmtCompactUsd(overview?.totalUsdValue ?? 0)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pf-mono text-[10px] text-[hsl(var(--pf-muted))]">
          <span>{shortAddr(addr, 6)}</span>
          <span>·</span>
          <span>{loadingOverview ? "…" : `${(overview?.balance ?? 0).toFixed(3)} SOL (${fmtCompactUsd(overview?.usdValue ?? 0)})`}</span>
          <span>·</span>
          <span>{overview?.tokenCount ?? 0} tokens</span>
          <span>·</span>
          <span>{overview?.nftCount ?? 0} NFTs</span>
        </div>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              tab === t.id ? "bg-[hsl(var(--pf-green))] text-black" : "border border-[hsl(var(--pf-border))] text-[hsl(var(--pf-muted))] hover:border-[hsl(var(--pf-ink))]"
            }`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "assets" && (
        <>
          {pieData.length > 0 && (
            <div className="pf-card mb-4 p-4">
              <div className="mb-2 pf-mono text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Allocation</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <ChartTooltip formatter={(v: number) => fmtCompactUsd(v)} contentStyle={{ background: "hsl(var(--pf-bg-2))", border: "1px solid hsl(var(--pf-border))", color: "hsl(var(--pf-ink))", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Holdings</span>
            <button onClick={() => downloadCsv(`orbitx-portfolio-${Date.now()}.csv`, ["symbol", "name", "mint", "balance", "price_usd", "value_usd"], holdings.map((h) => [h.symbol, h.name, h.mint, h.balance, h.price, h.value]))}
              disabled={!holdings.length} className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pf-border))] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))] disabled:opacity-40">
              <Download className="h-3 w-3" /> Export CSV
            </button>
          </div>

          {loadingAssets ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> reading wallet…</div>
          ) : holdings.length === 0 ? (
            <div className="pf-card flex flex-col items-center gap-3 py-16 text-center">
              <div className="text-sm font-bold text-[hsl(var(--pf-muted))]">No token holdings found</div>
              <Link to="/orbitxlaunch" className="pf-btn"><Rocket className="h-4 w-4" /> Discover tokens</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {holdings.map((h) => (
                <Link key={h.mint} to={`/orbitxlaunch/token/${h.mint}`} className="pf-card flex items-center gap-3 p-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[hsl(var(--pf-ink))] bg-[hsl(var(--pf-bg))]">
                    <TokenLogo src={h.image} symbol={h.symbol || h.mint} className="h-full w-full text-xs" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-[hsl(var(--pf-ink))]">{h.name || shortAddr(h.mint, 5)}</div>
                    <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">{h.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {h.symbol ? `$${h.symbol}` : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="pf-mono text-sm font-bold text-[hsl(var(--pf-ink))]">{h.value > 0 ? fmtCompactUsd(h.value) : "—"}</div>
                    <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">{h.price > 0 ? `$${h.price < 0.01 ? h.price.toPrecision(2) : h.price.toFixed(4)}` : ""}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "nfts" && (
        loadingNfts ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> reading NFTs…</div>
        ) : !nfts?.length ? (
          <div className="pf-card flex flex-col items-center gap-3 py-16 text-center">
            <ImageIcon className="h-8 w-8 text-[hsl(var(--pf-muted))]" />
            <div className="text-sm font-bold text-[hsl(var(--pf-muted))]">No NFTs found in this wallet</div>
            <Link to="/orbitxlaunch/nft" className="pf-btn-ghost text-xs">Explore NFT Hub</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {nfts.map((n) => (
              <a key={n.id} href={`https://solscan.io/token/${n.id}`} target="_blank" rel="noreferrer" className="pf-card overflow-hidden">
                <div className="aspect-square w-full bg-[hsl(var(--pf-bg))]">
                  {n.image ? <img src={n.image} alt={n.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-[hsl(var(--pf-muted))]" /></div>}
                </div>
                <div className="p-2">
                  <div className="truncate text-xs font-bold text-[hsl(var(--pf-ink))]">{n.name}</div>
                  {n.collection && <div className="truncate pf-mono text-[9px] text-[hsl(var(--pf-muted))]">{shortAddr(n.collection, 4)}</div>}
                </div>
              </a>
            ))}
          </div>
        )
      )}

      {tab === "performance" && (
        loadingPnl ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> analyzing trade history…</div>
        ) : !pnl || pnl.tokens.length === 0 ? (
          <div className="pf-card py-16 text-center text-sm text-[hsl(var(--pf-muted))]">No trade history found for this wallet yet.</div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="pf-card p-4">
                <div className="pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Total P&amp;L</div>
                <div className={`mt-1 text-lg font-black ${pnl.totalPnl >= 0 ? "text-[hsl(var(--pf-green))]" : "text-[hsl(var(--pf-red))]"}`}>{pnl.totalPnl >= 0 ? "+" : ""}{fmtCompactUsd(pnl.totalPnl)}</div>
              </div>
              <div className="pf-card p-4">
                <div className="pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Realized</div>
                <div className={`mt-1 text-lg font-black ${pnl.totalRealized >= 0 ? "text-[hsl(var(--pf-green))]" : "text-[hsl(var(--pf-red))]"}`}>{pnl.totalRealized >= 0 ? "+" : ""}{fmtCompactUsd(pnl.totalRealized)}</div>
              </div>
              <div className="pf-card p-4">
                <div className="pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Unrealized</div>
                <div className={`mt-1 text-lg font-black ${pnl.totalUnrealized >= 0 ? "text-[hsl(var(--pf-green))]" : "text-[hsl(var(--pf-red))]"}`}>{pnl.totalUnrealized >= 0 ? "+" : ""}{fmtCompactUsd(pnl.totalUnrealized)}</div>
              </div>
              <div className="pf-card p-4">
                <div className="pf-mono text-[9px] uppercase tracking-widest text-[hsl(var(--pf-muted))]">Win / Loss</div>
                <div className="mt-1 text-lg font-black text-[hsl(var(--pf-ink))]">{pnl.winCount} / {pnl.lossCount}</div>
              </div>
            </div>

            {(pnl.biggestWin || pnl.biggestLoss) && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {pnl.biggestWin && (
                  <div className="pf-card flex items-center gap-2 p-3">
                    <TrendingUp className="h-4 w-4 text-[hsl(var(--pf-green))]" />
                    <div><div className="text-[10px] uppercase tracking-wide text-[hsl(var(--pf-muted))]">Biggest win</div><div className="text-sm font-bold text-[hsl(var(--pf-ink))]">${pnl.biggestWin.symbol} +{fmtCompactUsd(pnl.biggestWin.pnl)}</div></div>
                  </div>
                )}
                {pnl.biggestLoss && (
                  <div className="pf-card flex items-center gap-2 p-3">
                    <TrendingDown className="h-4 w-4 text-[hsl(var(--pf-red))]" />
                    <div><div className="text-[10px] uppercase tracking-wide text-[hsl(var(--pf-muted))]">Biggest loss</div><div className="text-sm font-bold text-[hsl(var(--pf-ink))]">${pnl.biggestLoss.symbol} {fmtCompactUsd(pnl.biggestLoss.pnl)}</div></div>
                  </div>
                )}
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--pf-muted))]">Per-token performance</span>
              <button onClick={() => downloadCsv(`orbitx-pnl-${Date.now()}.csv`, ["symbol", "realized_pnl", "unrealized_pnl", "total_pnl", "roi_pct", "buy_count", "sell_count"], pnl.tokens.map((t) => [t.symbol, t.realizedPnl, t.unrealizedPnl, t.totalPnl, t.roi, t.buyCount, t.sellCount]))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--pf-border))] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--pf-muted))] hover:text-[hsl(var(--pf-ink))]">
                <Download className="h-3 w-3" /> Export CSV
              </button>
            </div>
            <div className="space-y-2">
              {pnl.tokens.map((t) => (
                <div key={t.mint} className="pf-card flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-[hsl(var(--pf-ink))]">${t.symbol}</div>
                    <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">{t.buyCount} buys · {t.sellCount} sells · ROI {t.roi.toFixed(1)}%</div>
                  </div>
                  <div className={`pf-mono text-sm font-bold ${t.totalPnl >= 0 ? "text-[hsl(var(--pf-green))]" : "text-[hsl(var(--pf-red))]"}`}>{t.totalPnl >= 0 ? "+" : ""}{fmtCompactUsd(t.totalPnl)}</div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {tab === "launches" && (
        loadingLaunches ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--pf-muted))]"><Loader2 className="h-4 w-4 animate-spin" /> loading your launches…</div>
        ) : !myLaunches?.length ? (
          <div className="pf-card flex flex-col items-center gap-3 py-16 text-center">
            <Rocket className="h-8 w-8 text-[hsl(var(--pf-muted))]" />
            <div className="text-sm font-bold text-[hsl(var(--pf-muted))]">You haven't launched a token through OrbitX yet</div>
            <Link to="/orbitxlaunch/create" className="pf-btn"><Rocket className="h-4 w-4" /> Launch a token</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {myLaunches.map((t: OrbitxToken) => (
              <Link key={t.id} to={`/orbitxlaunch/token/${t.mint_address}`} className="pf-card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-[hsl(var(--pf-ink))]">{t.name} <span className="text-[hsl(var(--pf-muted))]">${t.ticker}</span></div>
                  <div className="pf-mono text-[10px] text-[hsl(var(--pf-muted))]">{t.launch_type === "pump" ? "Pump lane" : "Custom lane"} · {(t.lp_pool_address || t.graduated_at) ? "Graduated" : "Live"}</div>
                </div>
                <ExternalLink className="h-4 w-4 text-[hsl(var(--pf-muted))]" />
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
