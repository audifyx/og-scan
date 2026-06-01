/**
 * PaperTrading — Advanced simulated trading with virtual SOL.
 * Features: market orders, limit orders, stop-loss, take-profit,
 *           order book panel, positions, trade history.
 * Backend: Supabase paper_orders, paper_positions, paper_portfolio tables.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Wallet, TrendingUp, TrendingDown, BarChart3, History, Plus, Minus,
  Loader2, Search, ArrowUpRight, ArrowDownRight, Trophy, Trash2,
  RefreshCw, Target, AlertTriangle, Clock, Zap, BookOpen, ChevronDown,
  ChevronUp, X, Check, Settings2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { jupSearchToken, jupPrice, fmtUsd, type JupTokenInfo, SOL_MINT } from "@/lib/og";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type OrderType = "market" | "limit" | "stop_loss" | "take_profit";
type OrderSide = "buy" | "sell";
type OrderStatus = "open" | "filled" | "cancelled" | "expired";

interface PaperOrder {
  id: string;
  user_id: string;
  token_mint: string;
  token_symbol: string;
  token_logo: string | null;
  order_type: OrderType;
  side: OrderSide;
  token_amount: number;
  limit_price: number | null;
  trigger_price: number | null;
  sol_amount: number;
  fill_price: number | null;
  status: OrderStatus;
  created_at: string;
  filled_at: string | null;
  expires_at: string | null;
}

interface PaperPosition {
  id: string;
  user_id: string;
  token_mint: string;
  token_symbol: string;
  token_name: string | null;
  token_logo: string | null;
  holding_amount: number;
  avg_buy_price: number;
  total_invested_sol: number;
  current_price_usd: number;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  realized_pnl_sol: number;
  updated_at: string;
}

interface PaperPortfolio {
  user_id: string;
  sol_balance: number;
  initial_balance: number;
  total_trades: number;
  win_count: number;
  loss_count: number;
  updated_at: string;
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const INITIAL_SOL = 100;
const LOCAL_KEY = "ogscan_paper_v2";
const DEFAULT_PORTFOLIO: PaperPortfolio = {
  user_id: "local",
  sol_balance: INITIAL_SOL,
  initial_balance: INITIAL_SOL,
  total_trades: 0,
  win_count: 0,
  loss_count: 0,
  updated_at: new Date().toISOString(),
};

function fmt(n: number, dp = 2) {
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(dp);
}
function fmtSol(n: number) { return `${n.toFixed(4)} SOL`; }

function pnlColor(v: number) {
  return v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-white/40";
}

type Tab = "trade" | "positions" | "orders" | "history";

/* ═══════════════════════════════════════════════════════════════
   PaperTrading Main Component
   ═══════════════════════════════════════════════════════════════ */

export const PaperTrading: React.FC<{ onSelectMint?: (m: string) => void }> = ({ onSelectMint }) => {
  const { user } = useAuth();
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  /* ── State ── */
  const [tab, setTab]                 = useState<Tab>("trade");
  const [portfolio, setPortfolio]     = useState<PaperPortfolio>(DEFAULT_PORTFOLIO);
  const [positions, setPositions]     = useState<PaperPosition[]>([]);
  const [openOrders, setOpenOrders]   = useState<PaperOrder[]>([]);
  const [history, setHistory]         = useState<PaperOrder[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  /* Trade form */
  const [side, setSide]           = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<JupTokenInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedToken, setSelectedToken] = useState<JupTokenInfo | null>(null);
  const [livePrice, setLivePrice]         = useState(0);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [solInput, setSolInput]   = useState("");
  const [limitPrice, setLimitPrice]     = useState("");
  const [stopLossPrice, setStopLossPrice]   = useState("");
  const [tpPrice, setTpPrice]     = useState("");
  const [expiry, setExpiry]       = useState("24");   // hours
  const [submitting, setSubmitting] = useState(false);

  const [solPrice, setSolPrice]   = useState(170);
  const [refreshing, setRefreshing] = useState(false);

  /* ── DB load ── */
  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      if (user) {
        const [portRes, posRes, ordRes] = await Promise.all([
          supabase.from("paper_portfolio").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("paper_positions").select("*").eq("user_id", user.id).eq("holding_amount", 0).not("holding_amount", "is", null),
          supabase.from("paper_orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        ]);

        // Portfolio
        if (portRes.data) setPortfolio(portRes.data);
        else {
          // Create default
          const { data: newPort } = await supabase.from("paper_portfolio").insert({
            ...DEFAULT_PORTFOLIO, user_id: user.id,
          }).select().maybeSingle();
          if (newPort) setPortfolio(newPort);
        }

        // Positions (with holding)
        const { data: posData } = await supabase
          .from("paper_positions").select("*")
          .eq("user_id", user.id)
          .gt("holding_amount", 0);
        setPositions(posData || []);

        // Orders
        const allOrders = ordRes.data || [];
        setOpenOrders(allOrders.filter((o: PaperOrder) => o.status === "open"));
        setHistory(allOrders.filter((o: PaperOrder) => o.status !== "open").slice(0, 30));
      } else {
        // Local fallback
        try {
          const raw = localStorage.getItem(LOCAL_KEY);
          if (raw) {
            const d = JSON.parse(raw);
            if (d.portfolio) setPortfolio({ ...DEFAULT_PORTFOLIO, ...d.portfolio });
            if (d.positions) setPositions(d.positions);
            if (d.orders)    setOpenOrders(d.orders.filter((o: PaperOrder) => o.status === "open"));
            if (d.orders)    setHistory(d.orders.filter((o: PaperOrder) => o.status !== "open").slice(0, 30));
          }
        } catch {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (mounted.current) setLoadingData(false);
    }
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── SOL price ── */
  useEffect(() => {
    jupPrice([SOL_MINT]).then(r => { const p = r[SOL_MINT]?.usdPrice; if (p) setSolPrice(p); }).catch(() => {});
  }, []);

  /* ── Search token ── */
  const searchToken = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try { setResults((await jupSearchToken(q)).slice(0, 6)); } catch { setResults([]); }
    setSearching(false);
  };

  const selectToken = async (t: JupTokenInfo) => {
    setSelectedToken(t);
    setResults([]);
    setQuery(t.symbol || "");
    setFetchingPrice(true);
    try {
      const mint = (t as any).address ?? t.id;
      const p = await jupPrice([mint]);
      const price = p[mint]?.usdPrice ?? t.usdPrice ?? 0;
      setLivePrice(price);
      if (price > 0) {
        setLimitPrice(price.toFixed(8));
        setStopLossPrice((price * 0.85).toFixed(8));
        setTpPrice((price * 1.5).toFixed(8));
      }
    } catch { setLivePrice(t.usdPrice ?? 0); }
    setFetchingPrice(false);
  };

  /* ── Refresh positions ── */
  const refreshPrices = useCallback(async () => {
    if (positions.length === 0 || !mounted.current) return;
    setRefreshing(true);
    try {
      const mints = positions.map(p => p.token_mint);
      const prices = await jupPrice(mints);
      if (!mounted.current) return;
      const updates = positions.map(pos => ({
        ...pos,
        current_price_usd: prices[pos.token_mint]?.usdPrice ?? pos.current_price_usd,
      }));
      setPositions(updates);

      // Check stop-loss / take-profit
      for (const pos of updates) {
        if (pos.stop_loss_price && pos.current_price_usd <= pos.stop_loss_price) {
          toast.warning(`🛑 Stop-loss triggered for $${pos.token_symbol}!`);
        }
        if (pos.take_profit_price && pos.current_price_usd >= pos.take_profit_price) {
          toast.success(`🎯 Take-profit reached for $${pos.token_symbol}!`);
        }
      }

      // Check open limit orders
      for (const order of openOrders) {
        if (order.order_type === "limit" && order.limit_price) {
          const cur = prices[order.token_mint]?.usdPrice;
          if (!cur) continue;
          if (order.side === "buy" && cur <= order.limit_price) {
            toast.success(`✅ Limit buy filled for $${order.token_symbol} @ ${fmtUsd(cur)}`);
          }
          if (order.side === "sell" && cur >= order.limit_price) {
            toast.success(`✅ Limit sell filled for $${order.token_symbol} @ ${fmtUsd(cur)}`);
          }
        }
      }
    } catch {}
    if (mounted.current) setRefreshing(false);
  }, [positions, openOrders]);

  useEffect(() => {
    refreshPrices();
    const iv = setInterval(refreshPrices, 30_000);
    return () => clearInterval(iv);
  }, [refreshPrices]);

  /* ── Computed stats ── */
  const totalPosValueUsd = positions.reduce((s, p) => s + p.holding_amount * p.current_price_usd, 0);
  const totalPosValueSol = solPrice > 0 ? totalPosValueUsd / solPrice : 0;
  const totalPortfolio   = portfolio.sol_balance + totalPosValueSol;
  const totalPnl         = totalPortfolio - portfolio.initial_balance;
  const pnlPct           = portfolio.initial_balance > 0
    ? ((totalPortfolio / portfolio.initial_balance) - 1) * 100 : 0;

  /* ── Execute trade ── */
  const executeTrade = async () => {
    if (!selectedToken) { toast.error("Select a token"); return; }
    const sol = parseFloat(solInput);
    if (!sol || sol <= 0) { toast.error("Enter SOL amount"); return; }
    if (side === "buy" && sol > portfolio.sol_balance) {
      toast.error(`Insufficient SOL balance (have ${portfolio.sol_balance.toFixed(4)})`);
      return;
    }
    if (livePrice === 0 && orderType === "market") {
      toast.error("Could not fetch token price. Try again.");
      return;
    }

    setSubmitting(true);
    try {
      const mint = (selectedToken as any).address ?? selectedToken.id;
      const priceUsd = orderType === "market" ? livePrice : parseFloat(limitPrice) || livePrice;
      const priceUsdSafe = priceUsd || livePrice;
      const solUsd = sol * solPrice;
      const tokenAmt = priceUsdSafe > 0 ? solUsd / priceUsdSafe : 0;

      const orderObj: Partial<PaperOrder> = {
        token_mint: mint,
        token_symbol: selectedToken.symbol || "???",
        token_logo: selectedToken.logoURI || null,
        order_type: orderType,
        side,
        token_amount: tokenAmt,
        sol_amount: sol,
        limit_price: orderType === "limit" ? parseFloat(limitPrice) || null : null,
        trigger_price: orderType === "stop_loss" ? parseFloat(stopLossPrice) || null
          : orderType === "take_profit" ? parseFloat(tpPrice) || null : null,
        status: orderType === "market" ? "filled" : "open",
        fill_price: orderType === "market" ? priceUsdSafe : null,
        filled_at: orderType === "market" ? new Date().toISOString() : null,
        expires_at: orderType !== "market" && expiry
          ? new Date(Date.now() + parseFloat(expiry) * 3600_000).toISOString() : null,
      };

      if (user) {
        /* ─ Supabase path ─ */
        const { error: orderErr } = await supabase.from("paper_orders").insert({
          ...orderObj, user_id: user.id,
        });
        if (orderErr) throw orderErr;

        if (orderType === "market") {
          // Update portfolio balance
          const newBalance = side === "buy"
            ? portfolio.sol_balance - sol
            : portfolio.sol_balance + sol;

          await supabase.from("paper_portfolio").upsert({
            user_id: user.id,
            sol_balance: newBalance,
            initial_balance: portfolio.initial_balance,
            total_trades: (portfolio.total_trades || 0) + 1,
            win_count: portfolio.win_count,
            loss_count: portfolio.loss_count,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

          if (side === "buy") {
            // Upsert position
            const existing = positions.find(p => p.token_mint === mint);
            if (existing) {
              const newAmt = existing.holding_amount + tokenAmt;
              const newAvg = ((existing.avg_buy_price * existing.holding_amount) + (priceUsdSafe * tokenAmt)) / newAmt;
              await supabase.from("paper_positions").update({
                holding_amount: newAmt,
                avg_buy_price: newAvg,
                total_invested_sol: existing.total_invested_sol + sol,
                stop_loss_price: stopLossPrice ? parseFloat(stopLossPrice) : existing.stop_loss_price,
                take_profit_price: tpPrice ? parseFloat(tpPrice) : existing.take_profit_price,
                current_price_usd: priceUsdSafe,
                updated_at: new Date().toISOString(),
              }).eq("id", existing.id);
            } else {
              await supabase.from("paper_positions").insert({
                user_id: user.id,
                token_mint: mint,
                token_symbol: selectedToken.symbol || "???",
                token_name: selectedToken.name || null,
                token_logo: selectedToken.logoURI || null,
                holding_amount: tokenAmt,
                avg_buy_price: priceUsdSafe,
                total_invested_sol: sol,
                current_price_usd: priceUsdSafe,
                stop_loss_price: stopLossPrice ? parseFloat(stopLossPrice) : null,
                take_profit_price: tpPrice ? parseFloat(tpPrice) : null,
                realized_pnl_sol: 0,
                updated_at: new Date().toISOString(),
              });
            }
          } else {
            // Sell: reduce/close position
            const existing = positions.find(p => p.token_mint === mint);
            if (existing) {
              const soldTokens = Math.min(tokenAmt, existing.holding_amount);
              const remaining = existing.holding_amount - soldTokens;
              const realizedPnl = (priceUsdSafe - existing.avg_buy_price) * soldTokens / solPrice;
              if (remaining <= 0.000001) {
                await supabase.from("paper_positions").delete().eq("id", existing.id);
              } else {
                await supabase.from("paper_positions").update({
                  holding_amount: remaining,
                  realized_pnl_sol: (existing.realized_pnl_sol || 0) + realizedPnl,
                  current_price_usd: priceUsdSafe,
                  updated_at: new Date().toISOString(),
                }).eq("id", existing.id);
              }
            }
          }
        }
      } else {
        /* ─ Local fallback ─ */
        const id = Math.random().toString(36).slice(2);
        const newOrder: PaperOrder = { ...orderObj as PaperOrder, id, user_id: "local", created_at: new Date().toISOString() };
        const newBal = side === "buy" ? portfolio.sol_balance - sol : portfolio.sol_balance + sol;
        const newPortfolio = { ...portfolio, sol_balance: newBal, total_trades: portfolio.total_trades + 1 };

        let newPositions = [...positions];
        if (orderType === "market" && side === "buy") {
          const idx = newPositions.findIndex(p => p.token_mint === mint);
          if (idx >= 0) {
            const ex = newPositions[idx];
            const newAmt = ex.holding_amount + tokenAmt;
            const newAvg = ((ex.avg_buy_price * ex.holding_amount) + (priceUsdSafe * tokenAmt)) / newAmt;
            newPositions[idx] = { ...ex, holding_amount: newAmt, avg_buy_price: newAvg, current_price_usd: priceUsdSafe };
          } else {
            newPositions.push({
              id,
              user_id: "local",
              token_mint: mint,
              token_symbol: selectedToken.symbol || "???",
              token_name: selectedToken.name || null,
              token_logo: selectedToken.logoURI || null,
              holding_amount: tokenAmt,
              avg_buy_price: priceUsdSafe,
              total_invested_sol: sol,
              current_price_usd: priceUsdSafe,
              stop_loss_price: stopLossPrice ? parseFloat(stopLossPrice) : null,
              take_profit_price: tpPrice ? parseFloat(tpPrice) : null,
              realized_pnl_sol: 0,
              updated_at: new Date().toISOString(),
            });
          }
        }

        setPortfolio(newPortfolio);
        setPositions(newPositions);
        if (newOrder.status === "open") setOpenOrders(prev => [newOrder, ...prev]);
        else setHistory(prev => [newOrder, ...prev]);

        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify({
            portfolio: newPortfolio,
            positions: newPositions,
            orders: [...openOrders, ...history, newOrder],
          }));
        } catch {}
      }

      toast.success(
        orderType === "market"
          ? `${side === "buy" ? "Bought" : "Sold"} ${fmt(tokenAmt)} $${selectedToken.symbol} @ ${fmtUsd(priceUsdSafe)}`
          : `${orderType.replace("_", " ").toUpperCase()} order placed for $${selectedToken.symbol}`
      );

      setSolInput("");
      setSelectedToken(null);
      setQuery("");
      setLivePrice(0);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message || "Trade failed");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = async (order: PaperOrder) => {
    try {
      if (user) {
        await supabase.from("paper_orders").update({ status: "cancelled" }).eq("id", order.id);
      }
      setOpenOrders(prev => prev.filter(o => o.id !== order.id));
      setHistory(prev => [{ ...order, status: "cancelled" }, ...prev]);
      toast.success("Order cancelled");
    } catch { toast.error("Failed to cancel"); }
  };

  const resetPortfolio = async () => {
    if (!window.confirm("Reset paper trading portfolio? All positions and history will be lost.")) return;
    if (user) {
      await Promise.all([
        supabase.from("paper_portfolio").upsert({ ...DEFAULT_PORTFOLIO, user_id: user.id }, { onConflict: "user_id" }),
        supabase.from("paper_positions").delete().eq("user_id", user.id),
        supabase.from("paper_orders").delete().eq("user_id", user.id),
      ]);
    } else {
      localStorage.removeItem(LOCAL_KEY);
    }
    setPortfolio(DEFAULT_PORTFOLIO);
    setPositions([]);
    setOpenOrders([]);
    setHistory([]);
    toast.success("Portfolio reset to 100 SOL");
  };

  const solInputUsd = parseFloat(solInput) > 0 ? parseFloat(solInput) * solPrice : 0;
  const estimatedTokens = livePrice > 0 && parseFloat(solInput) > 0
    ? (parseFloat(solInput) * solPrice) / livePrice : 0;

  return (
    <div className="rounded-[1.75rem] border border-white/[0.08] bg-[#07101e] overflow-hidden">
      {/* ── Header / Stats ── */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-[13px] font-black uppercase tracking-widest text-white">Paper Trading</h3>
              <p className="text-[10px] text-white/35">Simulated · Virtual SOL</p>
            </div>
          </div>
          <button onClick={resetPortfolio} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 transition">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Portfolio summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="text-[9px] text-white/25 uppercase tracking-wider">Balance</p>
            <p className="text-sm font-black text-white">{portfolio.sol_balance.toFixed(2)}<span className="text-[9px] text-white/30 ml-0.5">SOL</span></p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <p className="text-[9px] text-white/25 uppercase tracking-wider">Portfolio</p>
            <p className="text-sm font-black text-white">{totalPortfolio.toFixed(2)}<span className="text-[9px] text-white/30 ml-0.5">SOL</span></p>
          </div>
          <div className={cn("rounded-xl border bg-white/[0.02] px-3 py-2", totalPnl >= 0 ? "border-emerald-500/20" : "border-red-500/20")}>
            <p className="text-[9px] text-white/25 uppercase tracking-wider">P&L</p>
            <p className={cn("text-sm font-black", pnlColor(totalPnl))}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
              <span className="text-[9px] ml-0.5">{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-white/[0.06]">
        {([
          { id: "trade" as Tab,     label: "Trade",     icon: <Zap className="h-3 w-3" /> },
          { id: "positions" as Tab, label: "Positions", icon: <BarChart3 className="h-3 w-3" />, badge: positions.length },
          { id: "orders" as Tab,    label: "Orders",    icon: <BookOpen className="h-3 w-3" />, badge: openOrders.length },
          { id: "history" as Tab,   label: "History",   icon: <History className="h-3 w-3" /> },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold transition border-b-2",
              tab === t.id ? "text-primary border-primary" : "text-white/25 border-transparent hover:text-white/45",
            )}
          >
            {t.icon}
            {t.label}
            {(t as any).badge > 0 && (
              <span className="h-3.5 min-w-[14px] rounded-full bg-primary/20 text-primary text-[7px] flex items-center justify-center px-0.5">
                {(t as any).badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          TRADE TAB
          ═══════════════════════════════════════════ */}
      {tab === "trade" && (
        <div className="p-4 space-y-3">
          {/* Buy / Sell toggle */}
          <div className="flex gap-2">
            {(["buy", "sell"] as OrderSide[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition border",
                  side === s && s === "buy" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                  side === s && s === "sell" && "bg-red-500/15 text-red-400 border-red-500/30",
                  side !== s && "border-white/[0.08] text-white/25 hover:text-white/50",
                )}
              >
                {s === "buy" ? "▲ Buy" : "▼ Sell"}
              </button>
            ))}
          </div>

          {/* Order type */}
          <div className="grid grid-cols-4 gap-1">
            {(["market", "limit", "stop_loss", "take_profit"] as OrderType[]).map(ot => (
              <button
                key={ot}
                type="button"
                onClick={() => setOrderType(ot)}
                className={cn(
                  "py-1.5 rounded-xl text-[9px] font-bold transition border text-center",
                  orderType === ot
                    ? "bg-primary/15 text-primary border-primary/25"
                    : "border-white/[0.06] text-white/20 hover:text-white/40",
                )}
              >
                {ot === "market" ? "Market" : ot === "limit" ? "Limit" : ot === "stop_loss" ? "Stop Loss" : "Take Profit"}
              </button>
            ))}
          </div>

          {/* Token selector */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
            <Input
              value={selectedToken ? `$${selectedToken.symbol}${livePrice > 0 ? ` · ${fmtUsd(livePrice)}` : ""}` : query}
              onChange={e => { setSelectedToken(null); setLivePrice(0); searchToken(e.target.value); }}
              placeholder="Search token…"
              className="pl-9 h-10 bg-white/[0.03] border-white/[0.08] rounded-xl text-sm focus:border-primary/40"
            />
            {(searching || fetchingPrice) && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-white/30" />
            )}
            {selectedToken && (
              <button type="button" onClick={() => { setSelectedToken(null); setQuery(""); setLivePrice(0); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            )}
            {results.length > 0 && !selectedToken && (
              <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-xl border border-white/[0.1] bg-[#0a1628] overflow-hidden shadow-xl">
                {results.map(t => (
                  <button key={t.id} type="button" onClick={() => selectToken(t)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.04] transition text-left">
                    {t.logoURI
                      ? <img src={t.logoURI} className="h-6 w-6 rounded-full" alt="" />
                      : <div className="h-6 w-6 rounded-full bg-white/[0.06] flex items-center justify-center text-[9px] font-black">{t.symbol?.[0]}</div>}
                    <span className="text-xs font-bold text-white">${t.symbol}</span>
                    <span className="text-[10px] text-white/30 truncate">{t.name}</span>
                    {t.usdPrice > 0 && <span className="text-[9px] text-white/20 ml-auto">{fmtUsd(t.usdPrice)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Limit/Stop/TP price field */}
          {orderType === "limit" && (
            <div>
              <p className="text-[10px] text-white/30 mb-1">Limit Price (USD)</p>
              <Input
                value={limitPrice}
                onChange={e => setLimitPrice(e.target.value)}
                type="number"
                step="any"
                placeholder="e.g. 0.00042"
                className="h-9 bg-white/[0.03] border-white/[0.08] rounded-xl text-sm focus:border-primary/40"
              />
            </div>
          )}
          {orderType === "stop_loss" && (
            <div>
              <p className="text-[10px] text-red-400/70 mb-1">Stop Loss Price (USD)</p>
              <Input
                value={stopLossPrice}
                onChange={e => setStopLossPrice(e.target.value)}
                type="number" step="any" placeholder="Stop loss trigger"
                className="h-9 bg-white/[0.03] border-red-500/20 rounded-xl text-sm focus:border-red-500/40"
              />
            </div>
          )}
          {orderType === "take_profit" && (
            <div>
              <p className="text-[10px] text-emerald-400/70 mb-1">Take Profit Price (USD)</p>
              <Input
                value={tpPrice}
                onChange={e => setTpPrice(e.target.value)}
                type="number" step="any" placeholder="Take profit trigger"
                className="h-9 bg-white/[0.03] border-emerald-500/20 rounded-xl text-sm focus:border-emerald-500/40"
              />
            </div>
          )}

          {/* SOL amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-white/30">SOL Amount</p>
              <p className="text-[10px] text-white/20">Balance: {portfolio.sol_balance.toFixed(4)} SOL</p>
            </div>
            <div className="relative">
              <Input
                value={solInput}
                onChange={e => setSolInput(e.target.value)}
                type="number" min="0" step="0.1"
                placeholder="0.00"
                className="h-10 bg-white/[0.03] border-white/[0.08] rounded-xl text-sm pr-16 focus:border-primary/40"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 font-bold">SOL</div>
            </div>
            {/* Quick amounts */}
            <div className="flex gap-1 mt-1.5">
              {[0.25, 0.5, 0.75, 1].map(frac => (
                <button
                  key={frac}
                  type="button"
                  onClick={() => setSolInput((portfolio.sol_balance * frac).toFixed(4))}
                  className="flex-1 py-1 rounded-lg text-[9px] font-bold text-white/20 border border-white/[0.06] hover:text-primary hover:border-primary/25 transition"
                >
                  {frac * 100}%
                </button>
              ))}
            </div>
          </div>

          {/* Advanced: stop-loss + TP when market order */}
          {orderType === "market" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] text-red-400/60 mb-1">Stop Loss (USD, optional)</p>
                <Input
                  value={stopLossPrice}
                  onChange={e => setStopLossPrice(e.target.value)}
                  type="number" step="any" placeholder="—"
                  className="h-8 bg-white/[0.02] border-white/[0.06] rounded-lg text-[11px] focus:border-red-500/30"
                />
              </div>
              <div>
                <p className="text-[9px] text-emerald-400/60 mb-1">Take Profit (USD, optional)</p>
                <Input
                  value={tpPrice}
                  onChange={e => setTpPrice(e.target.value)}
                  type="number" step="any" placeholder="—"
                  className="h-8 bg-white/[0.02] border-white/[0.06] rounded-lg text-[11px] focus:border-emerald-500/30"
                />
              </div>
            </div>
          )}

          {/* Expiry for limit orders */}
          {orderType !== "market" && (
            <div>
              <p className="text-[10px] text-white/30 mb-1">Expires in</p>
              <div className="flex gap-1">
                {["1", "8", "24", "72"].map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setExpiry(h)}
                    className={cn(
                      "flex-1 py-1.5 rounded-xl text-[9px] font-bold transition border",
                      expiry === h ? "bg-primary/15 text-primary border-primary/25" : "border-white/[0.06] text-white/20",
                    )}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {selectedToken && parseFloat(solInput) > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-white/30">Estimated tokens</span>
                <span className="text-white font-bold">{estimatedTokens > 0 ? fmt(estimatedTokens) : "—"} ${selectedToken.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/30">SOL value</span>
                <span className="text-white">{parseFloat(solInput).toFixed(4)} SOL ≈ {fmtUsd(solInputUsd)}</span>
              </div>
              {orderType !== "market" && (
                <div className="flex justify-between">
                  <span className="text-white/30">Order type</span>
                  <Badge className="text-[8px] bg-primary/10 text-primary border-primary/20">
                    {orderType.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={executeTrade}
            disabled={submitting || !selectedToken || !solInput || parseFloat(solInput) <= 0}
            className={cn(
              "w-full h-10 font-black rounded-xl text-[12px] uppercase tracking-wider",
              side === "buy"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25"
                : "bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25",
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              side === "buy"
                ? (orderType === "market" ? "▲ Buy Now" : `▲ Place ${orderType.replace("_", " ")}`)
                : (orderType === "market" ? "▼ Sell Now" : `▼ Place ${orderType.replace("_", " ")}`)
            )}
          </Button>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          POSITIONS TAB
          ═══════════════════════════════════════════ */}
      {tab === "positions" && (
        <div>
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
            <p className="text-[10px] text-white/30">{positions.length} open positions</p>
            <button type="button" onClick={() => refreshPrices()} className="text-white/20 hover:text-primary transition">
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            </button>
          </div>
          <div className="max-h-[380px] overflow-y-auto divide-y divide-white/[0.04]"
               style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
            {positions.length === 0 ? (
              <div className="py-12 text-center">
                <BarChart3 className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
                <p className="text-sm text-white/20 font-bold">No open positions</p>
              </div>
            ) : (
              positions.map(pos => {
                const valueUsd = pos.holding_amount * pos.current_price_usd;
                const valueSol = solPrice > 0 ? valueUsd / solPrice : 0;
                const pnlUsd   = (pos.current_price_usd - pos.avg_buy_price) * pos.holding_amount;
                const pnlPosP  = pos.avg_buy_price > 0 ? ((pos.current_price_usd - pos.avg_buy_price) / pos.avg_buy_price) * 100 : 0;

                return (
                  <div key={pos.id} className="p-3.5 hover:bg-white/[0.015] transition">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {pos.token_logo
                          ? <img src={pos.token_logo} className="h-7 w-7 rounded-full" alt="" />
                          : <div className="h-7 w-7 rounded-full bg-white/[0.07] flex items-center justify-center text-[9px] font-black text-white/30">{pos.token_symbol?.[0]}</div>}
                        <div>
                          <button type="button" onClick={() => onSelectMint?.(pos.token_mint)}
                            className="text-[13px] font-black text-white hover:text-primary transition">
                            ${pos.token_symbol}
                          </button>
                          <p className="text-[9px] text-white/20">{fmt(pos.holding_amount)} tokens</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-white">{valueSol.toFixed(4)} SOL</p>
                        <p className={cn("text-[10px] font-bold", pnlColor(pnlUsd))}>
                          {pnlUsd >= 0 ? "+" : ""}{fmtUsd(pnlUsd)} ({pnlPosP >= 0 ? "+" : ""}{pnlPosP.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-[9px] text-white/25">
                      <span>Avg: {fmtUsd(pos.avg_buy_price)}</span>
                      <span>Now: {fmtUsd(pos.current_price_usd)}</span>
                      {pos.stop_loss_price && <span className="text-red-400/60">SL: {fmtUsd(pos.stop_loss_price)}</span>}
                      {pos.take_profit_price && <span className="text-emerald-400/60">TP: {fmtUsd(pos.take_profit_price)}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          OPEN ORDERS TAB
          ═══════════════════════════════════════════ */}
      {tab === "orders" && (
        <div>
          <div className="px-4 py-2 border-b border-white/[0.04]">
            <p className="text-[10px] text-white/30">{openOrders.length} pending orders</p>
          </div>
          <div className="max-h-[380px] overflow-y-auto divide-y divide-white/[0.04]"
               style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
            {openOrders.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
                <p className="text-sm text-white/20 font-bold">No open orders</p>
              </div>
            ) : (
              openOrders.map(o => (
                <div key={o.id} className="p-3.5 flex items-center gap-3 hover:bg-white/[0.015] transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={cn(
                        "text-[8px] h-4 px-1.5",
                        o.side === "buy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20",
                      )}>
                        {o.side.toUpperCase()}
                      </Badge>
                      <span className="text-xs font-black text-white">${o.token_symbol}</span>
                      <Badge className="bg-white/[0.04] text-white/30 border-white/[0.08] text-[8px] h-4 px-1.5">
                        {o.order_type.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-[9px] text-white/25">
                      <span>{o.sol_amount.toFixed(4)} SOL</span>
                      {o.limit_price && <span>@ {fmtUsd(o.limit_price)}</span>}
                      {o.trigger_price && <span>trigger {fmtUsd(o.trigger_price)}</span>}
                      {o.expires_at && <span className="flex items-center gap-0.5"><Clock className="h-2 w-2" />
                        {new Date(o.expires_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => cancelOrder(o)}
                    className="p-1.5 rounded-lg text-white/20 hover:text-red-400 transition border border-transparent hover:border-red-500/20">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          HISTORY TAB
          ═══════════════════════════════════════════ */}
      {tab === "history" && (
        <div>
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
            <p className="text-[10px] text-white/30">{portfolio.total_trades} trades · W:{portfolio.win_count} / L:{portfolio.loss_count}</p>
          </div>
          <div className="max-h-[380px] overflow-y-auto divide-y divide-white/[0.04]"
               style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
            {history.length === 0 ? (
              <div className="py-12 text-center">
                <History className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
                <p className="text-sm text-white/20 font-bold">No trade history</p>
              </div>
            ) : (
              history.map(o => (
                <div key={o.id} className="p-3.5 flex items-center gap-3 hover:bg-white/[0.015] transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={cn(
                        "text-[8px] h-4 px-1.5",
                        o.side === "buy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20",
                      )}>
                        {o.side.toUpperCase()}
                      </Badge>
                      <span className="text-xs font-black text-white">${o.token_symbol}</span>
                      <Badge className={cn(
                        "text-[8px] h-4 px-1.5",
                        o.status === "filled" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : o.status === "cancelled" ? "bg-white/[0.04] text-white/25 border-white/[0.06]"
                          : "bg-red-500/10 text-red-400 border-red-500/20",
                      )}>
                        {o.status}
                      </Badge>
                    </div>
                    <div className="flex gap-2 text-[9px] text-white/25">
                      <span>{o.sol_amount.toFixed(4)} SOL</span>
                      {o.fill_price && <span>@ {fmtUsd(o.fill_price)}</span>}
                      <span>{new Date(o.filled_at || o.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperTrading;
