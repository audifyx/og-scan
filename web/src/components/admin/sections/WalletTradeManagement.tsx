/* ══════════════════════════════════════════════════════════════
   Admin · Wallet & Trade Management
   Features: tracked wallets, tracked tokens, trade history,
   leaderboard, delete, search, export
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logAudit, shortId } from "../helpers";
import {
  Wallet, Search, Trash2, Loader2, RefreshCw, Download,
  TrendingUp, Trophy, Coins, ArrowUpRight, ArrowDownRight,
  BarChart3, Target,
} from "lucide-react";

export const WalletTradeManagement = () => {
  const { user: admin } = useAuth();
  const [tab, setTab] = useState("wallets");
  const [wallets, setWallets] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetch = async () => {
    setLoading(true);
    const [wR, tR, trR, lR] = await Promise.all([
      supabase.from("tracked_wallets").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("tracked_tokens").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("trade_history").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("leaderboard").select("*").order("total_pnl", { ascending: false }).limit(100),
    ]);
    setWallets(wR.data || []);
    setTokens(tR.data || []);
    setTrades(trR.data || []);
    setLeaderboard(lR.data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const deleteWallet = async (id: string) => {
    await supabase.from("tracked_wallets").delete().eq("id", id);
    toast.success("Removed");
    fetch();
  };
  const deleteToken = async (id: string) => {
    await supabase.from("tracked_tokens").delete().eq("id", id);
    toast.success("Removed");
    fetch();
  };
  const deleteTrade = async (id: string) => {
    await supabase.from("trade_history").delete().eq("id", id);
    toast.success("Deleted");
    fetch();
  };
  const deleteLeaderboardEntry = async (id: string) => {
    await supabase.from("leaderboard").delete().eq("id", id);
    toast.success("Removed");
    fetch();
  };
  const clearTradeHistory = async () => {
    if (!admin || !window.confirm("Clear ALL trade history?")) return;
    await supabase.from("trade_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await logAudit(admin.id, "Cleared trade history", "trade_history");
    toast.success("Cleared");
    fetch();
  };
  const resetLeaderboard = async () => {
    if (!admin || !window.confirm("Reset the entire leaderboard?")) return;
    await supabase.from("leaderboard").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await logAudit(admin.id, "Reset leaderboard", "leaderboard");
    toast.success("Reset");
    fetch();
  };
  const exportTrades = () => {
    const rows = ["id,user_id,token_address,type,amount,price,pnl,created_at"];
    trades.forEach((t) => rows.push(`${t.id},${t.user_id},${t.token_address || ""},${t.type || ""},${t.amount || ""},${t.price || ""},${t.pnl || ""},${t.created_at}`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "trades_export.csv"; a.click();
    toast.success("Exported");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"><Wallet className="h-6 w-6 text-[#22d3ee]" /> Wallets & Trades</h2>
          <p className="text-sm text-muted-foreground">{wallets.length} wallets, {trades.length} trades</p>
        </div>
        <Button onClick={fetch} variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><Wallet className="h-5 w-5 text-green-400" /><div><p className="text-lg font-bold">{wallets.length}</p><p className="text-[10px] text-muted-foreground">Tracked Wallets</p></div></CardContent></Card>
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><Target className="h-5 w-5 text-blue-400" /><div><p className="text-lg font-bold">{tokens.length}</p><p className="text-[10px] text-muted-foreground">Tracked Tokens</p></div></CardContent></Card>
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-purple-400" /><div><p className="text-lg font-bold">{trades.length}</p><p className="text-[10px] text-muted-foreground">Trades</p></div></CardContent></Card>
        <Card className="og-glass-card"><CardContent className="p-3 flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-400" /><div><p className="text-lg font-bold">{leaderboard.length}</p><p className="text-[10px] text-muted-foreground">Leaderboard</p></div></CardContent></Card>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="wallets">Wallets ({wallets.length})</TabsTrigger>
          <TabsTrigger value="tokens">Tokens ({tokens.length})</TabsTrigger>
          <TabsTrigger value="trades">Trades ({trades.length})</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard ({leaderboard.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="wallets" className="mt-4">
          <ScrollArea className="h-[500px]"><div className="space-y-2">
            {wallets.filter((w) => !search || (w.wallet_address || "").toLowerCase().includes(search.toLowerCase()) || (w.label || "").toLowerCase().includes(search.toLowerCase())).map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                <div className="flex items-center gap-3"><Wallet className="h-4 w-4 text-green-400" /><div>
                  <p className="text-sm font-mono">{w.wallet_address ? `${w.wallet_address.slice(0, 16)}…` : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">{w.label || "No label"} · by {shortId(w.user_id)}</p>
                </div></div>
                <Button size="sm" variant="ghost" onClick={() => deleteWallet(w.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
              </div>
            ))}
          </div></ScrollArea>
        </TabsContent>

        <TabsContent value="tokens" className="mt-4">
          <ScrollArea className="h-[500px]"><div className="space-y-2">
            {tokens.filter((t) => !search || (t.token_symbol || "").toLowerCase().includes(search.toLowerCase())).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                <div className="flex items-center gap-3"><Coins className="h-4 w-4 text-[#22d3ee]" /><div>
                  <p className="text-sm font-medium">{t.token_symbol || "Unknown"}</p>
                  <code className="text-[10px] text-muted-foreground">{shortId(t.token_address)}</code>
                  <span className="text-[10px] text-muted-foreground"> · by {shortId(t.user_id)}</span>
                </div></div>
                <Button size="sm" variant="ghost" onClick={() => deleteToken(t.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
              </div>
            ))}
          </div></ScrollArea>
        </TabsContent>

        <TabsContent value="trades" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportTrades} className="gap-2"><Download className="h-3.5 w-3.5" /> Export CSV</Button>
            <Button variant="outline" size="sm" onClick={clearTradeHistory} className="gap-2 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /> Clear All</Button>
          </div>
          <Card className="og-glass-card"><CardContent className="p-0"><ScrollArea className="h-[440px]">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Type</TableHead><TableHead>Token</TableHead><TableHead>Amount</TableHead><TableHead>PnL</TableHead><TableHead>User</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {trades.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell><Badge className={t.type === "buy" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>{t.type || "—"}</Badge></TableCell>
                    <TableCell className="text-sm">{t.token_symbol || shortId(t.token_address || "")}</TableCell>
                    <TableCell className="text-sm">{t.amount?.toLocaleString() || "—"}</TableCell>
                    <TableCell>{t.pnl != null ? <span className={`flex items-center gap-0.5 text-sm ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>{t.pnl >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}${Math.abs(t.pnl).toLocaleString()}</span> : "—"}</TableCell>
                    <TableCell><code className="text-[10px]">{shortId(t.user_id)}</code></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => deleteTrade(t.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea></CardContent></Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4 space-y-3">
          <Button variant="outline" size="sm" onClick={resetLeaderboard} className="gap-2 text-red-400 border-red-500/30"><Trash2 className="h-3.5 w-3.5" /> Reset Leaderboard</Button>
          <Card className="og-glass-card"><CardContent className="p-0"><ScrollArea className="h-[440px]">
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>User</TableHead><TableHead>Total PnL</TableHead><TableHead>Win Rate</TableHead><TableHead>Trades</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {leaderboard.map((l, i) => (
                  <TableRow key={l.id}>
                    <TableCell><span className={`font-bold ${i < 3 ? "text-yellow-400" : "text-muted-foreground"}`}>#{i + 1}</span></TableCell>
                    <TableCell><div className="flex items-center gap-2">{i === 0 && <Trophy className="h-4 w-4 text-yellow-400" />}<code className="text-xs">{shortId(l.user_id)}</code>{l.username && <span className="text-sm">{l.username}</span>}</div></TableCell>
                    <TableCell><span className={`font-medium ${(l.total_pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>${(l.total_pnl || 0).toLocaleString()}</span></TableCell>
                    <TableCell>{l.win_rate != null ? `${(l.win_rate * 100).toFixed(1)}%` : "—"}</TableCell>
                    <TableCell>{l.total_trades || "—"}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => deleteLeaderboardEntry(l.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
