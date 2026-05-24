import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Wallet, ArrowLeftRight, Copy, Users, Zap, Sparkles, Settings,
  TrendingUp, TrendingDown, Shield, Rocket, Clock, Eye, CheckCircle,
  ArrowUpRight, ArrowDownRight, RefreshCw, DollarSign, BarChart3,
  Activity, AlertTriangle, Percent, Target, ChevronRight, Flame,
  Search, Star, LineChart, PieChart, Layers, Lock
} from "lucide-react";

/* ─── Types ─── */
interface Position {
  id: string; token: string; symbol: string; image?: string; side: "long" | "short";
  entry: number; current: number; amount: number; pnl: number; pnlPct: number;
  timestamp: Date;
}

interface Order {
  id: string; token: string; symbol: string; type: "limit" | "stop" | "market";
  side: "buy" | "sell"; price: number; amount: number; status: "open" | "filled" | "cancelled";
  timestamp: Date;
}

interface TradeHistoryItem {
  id: string; symbol: string; side: "buy" | "sell"; price: number; amount: number;
  total: number; pnl?: number; timestamp: Date;
}





/* ─── Helpers ─── */
const fmt = (n: number, d = 2) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (Math.abs(n) < 0.01) return `$${n.toExponential(1)}`;
  return `$${n.toFixed(d)}`;
};
const fmtPrice = (n: number) => (n < 0.01 ? n.toExponential(2) : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }));
const timeAgo = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/* ─── Component ─── */
const LiveTrading = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("portfolio");
  const [swapFrom, setSwapFrom] = useState("SOL");
  const [swapTo, setSwapTo] = useState("BONK");
  const [swapAmount, setSwapAmount] = useState("");
  const [slippage, setSlippage] = useState("1.0");
  const [searchToken, setSearchToken] = useState("");
  const [copyTrading, setCopyTrading] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<TradeHistoryItem[]>([]);

  const totalPnl = useMemo(() => positions.reduce((s, p) => s + p.pnl, 0), [positions]);
  const totalValue = useMemo(() => positions.reduce((s, p) => s + p.current * p.amount, 0), [positions]);
  const totalInvested = useMemo(() => positions.reduce((s, p) => s + p.entry * p.amount, 0), [positions]);

  return (
    <AppLayout>
      <PageHeader title="Live Trading" description="Trade, track, and copy — all from one command center">
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/12 text-emerald-400 border-emerald-500/20 gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </Badge>
          <Badge className="bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20 gap-1.5 text-xs font-bold">
            <Zap className="h-3 w-3" /> Beta
          </Badge>
        </div>
      </PageHeader>

      <div className="p-4 lg:p-6 space-y-5">

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: DollarSign, label: "Portfolio Value", value: fmt(totalValue), color: "text-[#22d3ee]", bg: "from-[#22d3ee]/12" },
            { icon: TrendingUp, label: "Total P&L", value: `${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}`, color: totalPnl >= 0 ? "text-emerald-400" : "text-red-400", bg: totalPnl >= 0 ? "from-emerald-500/12" : "from-red-500/12" },
            { icon: Percent, label: "Win Rate", value: "—", color: "text-[#eab308]", bg: "from-[#eab308]/12" },
            { icon: Activity, label: "Active Positions", value: String(positions.length), color: "text-purple-400", bg: "from-purple-500/12" },
          ].map((s, i) => (
            <div key={i} className="og-glass-card rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${s.bg} to-transparent border border-white/[0.06]`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-[10px] text-white/35 uppercase tracking-wider font-bold">{s.label}</p>
                  <p className={`text-lg font-black font-mono ${s.color}`}>{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main Content ── */}
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_340px] gap-5">

          {/* Left: Tabs */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-white/[0.04] w-full grid grid-cols-4">
                <TabsTrigger value="portfolio" className="text-xs gap-1.5"><PieChart className="h-3 w-3" /> Portfolio</TabsTrigger>
                <TabsTrigger value="orders" className="text-xs gap-1.5"><Layers className="h-3 w-3" /> Orders</TabsTrigger>
                <TabsTrigger value="history" className="text-xs gap-1.5"><Clock className="h-3 w-3" /> History</TabsTrigger>
                <TabsTrigger value="copy" className="text-xs gap-1.5"><Copy className="h-3 w-3" /> Copy Trade</TabsTrigger>
              </TabsList>

              {/* ── Portfolio Tab ── */}
              <TabsContent value="portfolio" className="mt-4">
                <Card className="og-glass-card overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Open Positions</CardTitle>
                      <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">
                        {positions.length} active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[500px]">
                      {positions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                            <PieChart className="h-7 w-7 text-white/20" />
                          </div>
                          <p className="text-sm font-bold text-white/50 mb-1">No open positions</p>
                          <p className="text-xs text-white/25 text-center">Your active trades will appear here when you start trading</p>
                        </div>
                      ) : (
                      <div className="divide-y divide-white/[0.05]">
                        {positions.map((p) => (
                          <div key={p.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-xs font-bold text-[#22d3ee]">
                                {p.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm">{p.symbol}</p>
                                  <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{p.side.toUpperCase()}</Badge>
                                </div>
                                <p className="text-[11px] text-white/35 font-mono">
                                  Entry: ${fmtPrice(p.entry)} → ${fmtPrice(p.current)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-bold font-mono text-sm ${p.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {p.pnl >= 0 ? "+" : ""}{fmt(p.pnl)}
                              </p>
                              <p className={`text-[10px] font-mono ${p.pnlPct >= 0 ? "text-emerald-400/60" : "text-red-400/60"}`}>
                                {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Orders Tab ── */}
              <TabsContent value="orders" className="mt-4">
                <Card className="og-glass-card overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Open Orders</CardTitle>
                      <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">
                        {orders.filter(o => o.status === "open").length} active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[500px]">
                      {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                            <Layers className="h-7 w-7 text-white/20" />
                          </div>
                          <p className="text-sm font-bold text-white/50 mb-1">No open orders</p>
                          <p className="text-xs text-white/25 text-center">Place limit or stop orders to see them here</p>
                        </div>
                      ) : (
                      <div className="divide-y divide-white/[0.05]">
                        {orders.map((o) => (
                          <div key={o.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
                                o.side === "buy" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                              }`}>
                                {o.side === "buy" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm">{o.symbol}</p>
                                  <Badge className={`text-[9px] ${o.type === "limit" ? "bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/20" : o.type === "stop" ? "bg-[#eab308]/10 text-[#eab308] border-[#eab308]/20" : "bg-white/10 text-white/60 border-white/20"}`}>
                                    {o.type.toUpperCase()}
                                  </Badge>
                                  <Badge className={`text-[9px] ${o.side === "buy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                    {o.side.toUpperCase()}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-white/35 font-mono">
                                  @ ${fmtPrice(o.price)} · {o.amount.toLocaleString()} {o.symbol}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/25">{timeAgo(o.timestamp)}</span>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/50 hover:text-red-400 hover:bg-red-500/10">
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── History Tab ── */}
              <TabsContent value="history" className="mt-4">
                <Card className="og-glass-card overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Trade History</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[500px]">
                      {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                            <Clock className="h-7 w-7 text-white/20" />
                          </div>
                          <p className="text-sm font-bold text-white/50 mb-1">No trade history</p>
                          <p className="text-xs text-white/25 text-center">Your completed trades will appear here</p>
                        </div>
                      ) : (
                      <div className="divide-y divide-white/[0.05]">
                        {history.map((t) => (
                          <div key={t.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${
                                t.side === "buy" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                              }`}>
                                {t.side === "buy" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm">{t.symbol}</p>
                                  <Badge className={`text-[9px] ${t.side === "buy" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                    {t.side.toUpperCase()}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-white/35 font-mono">
                                  {t.amount.toLocaleString()} @ ${fmtPrice(t.price)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold font-mono text-sm text-white/80">{fmt(t.total)}</p>
                              {t.pnl !== undefined && (
                                <p className={`text-[10px] font-mono ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {t.pnl >= 0 ? "+" : ""}{fmt(t.pnl)}
                                </p>
                              )}
                              <p className="text-[10px] text-white/20">{timeAgo(t.timestamp)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Copy Trading Tab ── */}
              <TabsContent value="copy" className="mt-4 space-y-4">
                <Card className="og-glass-card overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Top Traders to Copy</CardTitle>
                      <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px]">
                        <Copy className="h-3 w-3 mr-1" /> Auto-Mirror
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[500px]">
                      <div className="flex flex-col items-center justify-center py-16 px-6">
                          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                            <Copy className="h-7 w-7 text-white/20" />
                          </div>
                          <p className="text-sm font-bold text-white/50 mb-1">Copy trading coming soon</p>
                          <p className="text-xs text-white/25 text-center">Follow top traders and auto-mirror their moves</p>
                        </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Copy Trading Info */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Shield, title: "Risk Management", desc: "Set max position size and stop-loss", accent: "#22d3ee" },
                    { icon: Target, title: "Smart Allocation", desc: "Auto-size positions based on confidence", accent: "#eab308" },
                    { icon: Activity, title: "Real-time Sync", desc: "Trades execute within milliseconds", accent: "#a855f7" },
                    { icon: Eye, title: "Full Transparency", desc: "See every trade before it mirrors", accent: "#22d3ee" },
                  ].map((f, i) => (
                    <div key={i} className="p-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] space-y-2">
                      <div className="p-2.5 rounded-xl inline-block border border-white/10" style={{ background: `${f.accent}18` }}>
                        <f.icon className="h-4 w-4" style={{ color: f.accent }} />
                      </div>
                      <p className="font-bold text-xs text-white">{f.title}</p>
                      <p className="text-[10px] text-white/35">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Swap Panel */}
          <div className="space-y-4">
            {/* Quick Swap */}
            <Card className="og-glass-frame overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#22d3ee]/40 to-transparent" />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-[#22d3ee]" /> Quick Swap
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/30 hover:text-white/60">
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* From */}
                <div className="space-y-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">You Pay</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value)}
                      className="border-0 bg-transparent p-0 h-auto text-lg font-bold focus-visible:ring-0"
                    />
                    <Button variant="outline" size="sm" className="rounded-xl shrink-0 gap-1.5 font-bold text-xs">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                        <span className="text-[8px] font-black text-white">S</span>
                      </div>
                      {swapFrom}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-white/25">Balance: — SOL</span>
                    <div className="flex gap-1">
                      {["25%", "50%", "MAX"].map(pct => (
                        <button key={pct} className="text-[9px] text-[#22d3ee]/60 hover:text-[#22d3ee] font-bold px-1.5 py-0.5 rounded bg-[#22d3ee]/5 hover:bg-[#22d3ee]/10 transition-colors">
                          {pct}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Swap Arrow */}
                <div className="flex justify-center -my-1">
                  <button className="p-2 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] transition-colors">
                    <ArrowLeftRight className="h-4 w-4 text-[#22d3ee]" />
                  </button>
                </div>

                {/* To */}
                <div className="space-y-2">
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold">You Receive</label>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <div className="text-lg font-bold text-white/40 flex-1">
                      {swapAmount ? (parseFloat(swapAmount) * 174.89 / 0.0000289).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "0.00"}
                    </div>
                    <Button variant="outline" size="sm" className="rounded-xl shrink-0 gap-1.5 font-bold text-xs">
                      <div className="w-5 h-5 rounded-full bg-[#eab308]/20 flex items-center justify-center">
                        <span className="text-[8px] font-black text-[#eab308]">B</span>
                      </div>
                      {swapTo}
                    </Button>
                  </div>
                </div>

                {/* Slippage */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-[11px] text-white/40">Slippage Tolerance</span>
                  <div className="flex items-center gap-1">
                    {["0.5", "1.0", "2.0"].map(s => (
                      <button
                        key={s}
                        onClick={() => setSlippage(s)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                          slippage === s ? "bg-[#22d3ee]/15 text-[#22d3ee]" : "text-white/30 hover:text-white/50"
                        }`}
                      >
                        {s}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Route Info */}
                <div className="space-y-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/35">Rate</span>
                    <span className="text-white/60 font-mono">1 SOL = 6,050,519 BONK</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/35">Route</span>
                    <span className="text-[#22d3ee]/70 font-mono">Jupiter v6</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/35">Price Impact</span>
                    <span className="text-emerald-400/70 font-mono">&lt;0.01%</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/35">Network Fee</span>
                    <span className="text-white/60 font-mono">~0.000005 SOL</span>
                  </div>
                </div>

                {/* Swap Button */}
                <Button className="w-full h-12 rounded-xl font-bold text-sm ios-primary-button gap-2">
                  <Zap className="h-4 w-4" />
                  Swap {swapFrom} → {swapTo}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card className="og-glass-card">
              <CardContent className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">24h Performance</h4>
                <div className="space-y-2.5">
                  {[
                    { label: "Trades Today", value: "0", icon: BarChart3, color: "text-[#22d3ee]" },
                    { label: "Volume", value: "$0", icon: DollarSign, color: "text-[#eab308]" },
                    { label: "Best Trade", value: "—", icon: Flame, color: "text-emerald-400" },
                    { label: "Avg Hold Time", value: "—", icon: Clock, color: "text-purple-400" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                        <span className="text-[11px] text-white/40">{s.label}</span>
                      </div>
                      <span className="text-sm font-bold font-mono text-white/80">{s.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LiveTrading;
