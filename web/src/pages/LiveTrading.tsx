import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wallet, ArrowLeftRight, Copy, Zap, Sparkles, Settings,
  TrendingUp, Shield, Clock, Eye,
  ArrowUpRight, ArrowDownRight, DollarSign, BarChart3,
  Activity, AlertTriangle, Percent, Target, ChevronRight,
  Search, Star, PieChart, Layers
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const LiveTrading = () => {
  const [activeTab, setActiveTab] = useState("portfolio");
  const [swapFrom] = useState("SOL");
  const [swapAmount, setSwapAmount] = useState("");
  const [positions] = useState<Position[]>([]);
  const [orders] = useState<Order[]>([]);
  const [history] = useState<TradeHistoryItem[]>([]);

  const totalPnl = useMemo(() => positions.reduce((s, p) => s + p.pnl, 0), [positions]);
  const totalValue = useMemo(() => positions.reduce((s, p) => s + p.current * p.amount, 0), [positions]);

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 lg:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-og-lime/20 bg-og-lime/5 text-og-lime">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Live Trading</h3>
              <p className="text-[10px] uppercase tracking-widest text-white/30">Forensic-grade trade execution & tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-og-lime/10 text-og-lime border border-og-lime/30 text-[9px] px-1.5 py-0 font-black tracking-widest uppercase">
              <div className="w-1.5 h-1.5 rounded-full bg-og-lime animate-pulse mr-1" /> ACTIVE
            </Badge>
            <Badge className="bg-og-gold/10 text-og-gold border border-og-gold/30 text-[9px] px-1.5 py-0 font-black tracking-widest uppercase">
              BETA
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: "Portfolio Value", value: fmt(totalValue), color: "text-og-cyan", bg: "bg-og-cyan/5", border: "border-og-cyan/20" },
          { icon: TrendingUp, label: "Total P&L", value: `${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}`, color: totalPnl >= 0 ? "text-og-lime" : "text-red-400", bg: totalPnl >= 0 ? "bg-og-lime/5" : "bg-red-400/5", border: totalPnl >= 0 ? "border-og-lime/20" : "border-red-400/20" },
          { icon: Percent, label: "Win Rate", value: "—", color: "text-og-gold", bg: "bg-og-gold/5", border: "border-og-gold/20" },
          { icon: Activity, label: "Positions", value: String(positions.length), color: "text-white/60", bg: "bg-white/5", border: "border-white/10" },
        ].map((s, i) => (
          <div key={i} className={cn("rounded-2xl border bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]", s.border)}>
            <div className="flex items-center gap-3">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl border", s.bg, s.border)}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">{s.label}</p>
                <p className={cn("text-lg font-black font-mono", s.color)}>{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_340px] gap-4">
        {/* Left: Interactive Tabs */}
        <div className="flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="border-b border-white/[0.07] bg-white/[0.01]">
            <div className="flex gap-4 px-4 overflow-x-auto no-scrollbar">
              {[
                { id: "portfolio", label: "Portfolio", icon: PieChart },
                { id: "orders", label: "Orders", icon: Layers },
                { id: "history", label: "History", icon: Clock },
                { id: "copy", label: "Copy", icon: Copy },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all",
                    activeTab === t.id
                      ? "border-og-cyan text-white"
                      : "border-transparent text-white/20 hover:text-white/40"
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-2">
            <ScrollArea className="h-[500px]">
              {activeTab === "portfolio" && (
                <div className="space-y-1">
                  {positions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 px-6 opacity-40">
                      <PieChart className="h-10 w-10 mb-3 text-white/50" strokeWidth={1} />
                      <p className="text-[11px] font-black uppercase tracking-widest">No active positions</p>
                    </div>
                  ) : (
                    positions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/[0.03] transition-all">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-og-cyan">
                            {p.symbol.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-black">{p.symbol}</span>
                              <Badge className="text-[9px] bg-og-lime/10 text-og-lime border border-og-lime/30 uppercase font-black px-1 py-0">{p.side}</Badge>
                            </div>
                            <p className="text-[10px] font-mono text-white/25 mt-0.5">
                              ${fmtPrice(p.entry)} → ${fmtPrice(p.current)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-sm font-black font-mono", p.pnl >= 0 ? "text-og-lime" : "text-red-400")}>
                            {p.pnl >= 0 ? "+" : ""}{fmt(p.pnl)}
                          </p>
                          <p className={cn("text-[9px] font-black font-mono", p.pnlPct >= 0 ? "text-og-lime/50" : "text-red-400/50")}>
                            {p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {/* Other tabs follow same pattern of clean, minimalist forensic design */}
              {activeTab === "orders" && (
                 <div className="flex flex-col items-center justify-center py-24 px-6 opacity-40">
                  <Layers className="h-10 w-10 mb-3 text-white/50" strokeWidth={1} />
                  <p className="text-[11px] font-black uppercase tracking-widest">No pending orders</p>
                </div>
              )}
              {activeTab === "history" && (
                 <div className="flex flex-col items-center justify-center py-24 px-6 opacity-40">
                  <Clock className="h-10 w-10 mb-3 text-white/50" strokeWidth={1} />
                  <p className="text-[11px] font-black uppercase tracking-widest">Trade history empty</p>
                </div>
              )}
              {activeTab === "copy" && (
                 <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-og-gold/5 border border-og-gold/20 flex items-center justify-center mb-4">
                    <Copy className="h-6 w-6 text-og-gold" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white mb-2">Social Mirroring coming soon</h4>
                  <p className="text-[11px] text-white/30 max-w-xs leading-relaxed uppercase tracking-tighter">
                    Follow top-tier forensic traders and auto-mirror their winning patterns in real-time.
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Right: Swap Panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-og-cyan/20 bg-white/[0.02] overflow-hidden">
            <div className="border-b border-white/[0.07] bg-og-cyan/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-og-cyan" />
                <span className="text-[11px] font-black uppercase tracking-widest text-white">Quick Swap</span>
              </div>
              <button className="text-white/20 hover:text-white transition-colors">
                <Settings className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30">You Pay</label>
                  <span className="text-[9px] font-bold text-white/20">BALANCE: 0.00 SOL</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    className="h-14 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-4 pr-24 text-lg font-mono font-black text-white focus:border-og-cyan/40 focus:outline-none transition-all placeholder:text-white/10"
                  />
                  <div className="absolute right-2 top-2 bottom-2">
                    <button className="h-full px-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 hover:bg-white/10 transition-all">
                      <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195]" />
                      <span className="text-[11px] font-black text-white">{swapFrom}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center -my-2 relative z-10">
                <button className="p-2.5 rounded-xl bg-[#070d14] border border-white/10 hover:border-og-cyan/40 hover:scale-110 transition-all">
                  <ChevronRight className="h-4 w-4 text-og-cyan rotate-90" />
                </button>
              </div>

              <div className="space-y-2">
                 <div className="flex items-center justify-between px-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-white/30">You Receive</label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="SELECT MINT"
                    readOnly
                    className="h-14 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-4 pr-32 text-lg font-mono font-black text-white focus:outline-none placeholder:text-white/10"
                  />
                  <div className="absolute right-2 top-2 bottom-2">
                    <button className="h-full px-3 rounded-lg bg-og-cyan text-[#070d14] flex items-center gap-2 hover:bg-white transition-all">
                      <Search className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-black uppercase tracking-widest">Pick Token</span>
                    </button>
                  </div>
                </div>
              </div>

              <button className="w-full h-12 rounded-xl bg-white text-[#070d14] font-black uppercase tracking-[0.2em] text-xs hover:bg-og-lime hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                Execute Forensic Swap
              </button>
              
              <div className="flex items-center justify-center gap-4 text-[9px] font-bold text-white/20 uppercase tracking-widest">
                <div className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> MEV PROTECT</div>
                <div className="flex items-center gap-1.5"><Zap className="h-3 w-3" /> SLIPPAGE: 1.0%</div>
              </div>
            </div>
          </div>

          {/* Additional Features List */}
          <div className="grid grid-cols-1 gap-2">
            {[
              { icon: Shield, title: "Rug Protection", desc: "Anti-honeypot execution filters", color: "text-og-lime" },
              { icon: Target, title: "Sniper Bot", desc: "Auto-buy newly detected OGs", color: "text-og-cyan" },
              { icon: Activity, title: "Tape Watcher", desc: "Live whale entry signals", color: "text-og-gold" },
            ].map((f, i) => (
              <div key={i} className="group flex items-center gap-3 p-3 rounded-xl border border-white/[0.05] bg-white/[0.01] hover:bg-white/[0.03] transition-all">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 border border-white/10 group-hover:bg-white/10 transition-all", f.color)}>
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/80">{f.title}</p>
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTrading;
