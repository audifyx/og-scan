import { useState, useEffect, useRef } from "react";
import { Send, Zap, Wallet, Coins, TrendingUp, Copy, ExternalLink, RefreshCw, Sparkles, Shield, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { isValidSolanaAddress } from "@/lib/solana-api";
import { safeAvatarUrl } from "@/lib/utils";
import { heliusTxs } from "@/lib/og";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface Callout {
  id: string;
  type: "token" | "wallet";
  address: string;
  symbol?: string;
  name?: string;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
  fdv?: number;
  pairUrl?: string;
  solBalance?: number;
  tokenCount?: number;
  recentTxCount?: number;
  note?: string;
  username: string;
  avatar?: string;
  userId?: string;
  timestamp: Date;
}

/* ═══════════════════════════════════════════════════════════════
   DexScreener direct fetch (no edge function)
   ═══════════════════════════════════════════════════════════════ */

async function fetchTokenData(address: string): Promise<{
  found: boolean;
  symbol?: string;
  name?: string;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
  fdv?: number;
  pairUrl?: string;
}> {
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
    if (!res.ok) return { found: false };
    const pairs = await res.json();
    if (!Array.isArray(pairs) || pairs.length === 0) return { found: false };

    // Pick the pair with highest liquidity
    const pair = pairs.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    return {
      found: true,
      symbol: pair.baseToken?.symbol,
      name: pair.baseToken?.name,
      price: parseFloat(pair.priceUsd || "0"),
      priceChange24h: pair.priceChange?.h24 ?? 0,
      marketCap: pair.marketCap ?? pair.fdv ?? 0,
      liquidity: pair.liquidity?.usd ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      fdv: pair.fdv ?? 0,
      pairUrl: pair.url,
    };
  } catch {
    return { found: false };
  }
}

async function fetchWalletData(address: string): Promise<{
  recentTxCount: number;
  solTransferred: number;
}> {
  try {
    const txs = await heliusTxs(address, 20);
    const solMoved = txs.reduce((sum, tx) => {
      const native = tx.nativeTransfers ?? [];
      return sum + native.reduce((s, nt) => s + Math.abs(nt.amount ?? 0), 0);
    }, 0);
    return { recentTxCount: txs.length, solTransferred: solMoved / 1e9 };
  } catch {
    return { recentTxCount: 0, solTransferred: 0 };
  }
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

const fmtNum = (n?: number) => {
  if (!n) return "N/A";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
};

const shortAddr = (a: string) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "";

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

const Callouts = ({ inline = false }: { inline?: boolean }) => {
  const Wrap = inline ? ({ children }: { children: React.ReactNode }) => <>{children}</> : AppLayout;
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [note, setNote] = useState("");
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [filter, setFilter] = useState<"all" | "token" | "wallet">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Load callouts from DB ── */
  useEffect(() => {
    loadCallouts();
    const channel = supabase
      .channel("callouts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "callouts" }, () => loadCallouts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadCallouts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("callouts")
        .select("*, profiles!callouts_user_id_fkey(username, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        // Fallback: query without join if FK doesn't exist
        const { data: raw } = await supabase
          .from("callouts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);

        if (raw) {
          // Batch fetch usernames
          const uids = [...new Set(raw.map((r: any) => r.user_id).filter(Boolean))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, username, avatar_url")
            .in("user_id", uids);
          const pMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

          setCallouts(raw.map((r: any) => parseCallout(r, pMap.get(r.user_id))));
        }
      } else {
        setCallouts((data || []).map((r: any) => parseCallout(r, r.profiles)));
      }
    } catch (e) {
      console.error("[Callouts] load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const parseCallout = (row: any, profile?: any): Callout => {
    const meta = row.metadata || {};
    return {
      id: row.id,
      type: row.type === "wallet" ? "wallet" : "token",
      address: row.target || meta.address || "",
      symbol: meta.symbol,
      name: meta.name,
      price: meta.price,
      priceChange24h: meta.priceChange24h,
      marketCap: meta.marketCap,
      liquidity: meta.liquidity,
      volume24h: meta.volume24h,
      fdv: meta.fdv,
      pairUrl: meta.pairUrl,
      solBalance: meta.solBalance,
      tokenCount: meta.tokenCount,
      recentTxCount: meta.recentTxCount,
      note: row.note || meta.note,
      username: profile?.username || "Anonymous",
      avatar: profile?.avatar_url,
      userId: row.user_id,
      timestamp: new Date(row.created_at),
    };
  };

  /* ── Analyze address and post callout ── */
  const analyzeAndPost = async () => {
    if (!input.trim() || !user) return;
    const address = input.trim();

    if (!isValidSolanaAddress(address)) {
      toast.error("Invalid Solana address");
      return;
    }

    setAnalyzing(true);
    try {
      // Try as token first via DexScreener
      const tokenInfo = await fetchTokenData(address);

      let calloutType: "token" | "wallet" = "token";
      let metadata: Record<string, any> = {};

      if (tokenInfo.found && tokenInfo.price && tokenInfo.price > 0) {
        calloutType = "token";
        metadata = {
          address,
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          price: tokenInfo.price,
          priceChange24h: tokenInfo.priceChange24h,
          marketCap: tokenInfo.marketCap,
          liquidity: tokenInfo.liquidity,
          volume24h: tokenInfo.volume24h,
          fdv: tokenInfo.fdv,
          pairUrl: tokenInfo.pairUrl,
        };
      } else {
        // Treat as wallet — fetch activity via Helius
        calloutType = "wallet";
        const walletInfo = await fetchWalletData(address);
        metadata = {
          address,
          recentTxCount: walletInfo.recentTxCount,
          solTransferred: walletInfo.solTransferred,
        };
      }

      // Save to callouts table
      const { error: saveError } = await supabase.from("callouts").insert({
        user_id: user.id,
        type: calloutType,
        target: address,
        note: note.trim() || null,
        metadata,
      });

      if (saveError) throw saveError;

      toast.success(`${calloutType === "token" ? "Token" : "Wallet"} callout posted!`);
      setInput("");
      setNote("");
      loadCallouts();
    } catch (e: any) {
      console.error("[Callouts] analyze error:", e);
      toast.error(e.message || "Failed to create callout");
    } finally {
      setAnalyzing(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Copied");
  };

  const filtered = callouts.filter(c => filter === "all" || c.type === filter);

  /* ═══════════════════════════════════════════════════════════
     JSX
     ═══════════════════════════════════════════════════════════ */
  return (
    <Wrap>
      <PageHeader title="Alpha Callouts" description="Post token & wallet callouts to the community">
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </Badge>
          <Button variant="outline" size="sm" onClick={loadCallouts} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-col h-[calc(100vh-180px)]">
        {/* Stats + Filter */}
        <div className="p-4 lg:px-6 border-b border-white/[0.07]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-[#22d3ee]" />
              <span className="text-sm font-medium">{callouts.filter(c => c.type === "token").length} Tokens</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#eab308]" />
              <span className="text-sm font-medium">{callouts.filter(c => c.type === "wallet").length} Wallets</span>
            </div>
            <div className="flex-1" />
            <Tabs value={filter} onValueChange={v => setFilter(v as any)} className="w-auto">
              <TabsList className="h-9 bg-muted/30">
                <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
                <TabsTrigger value="token" className="text-xs px-3">Tokens</TabsTrigger>
                <TabsTrigger value="wallet" className="text-xs px-3">Wallets</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 p-4 lg:p-6 overflow-hidden">
          <Card className="og-glass-card h-full">
            <CardContent className="p-0 h-full">
              <ScrollArea className="h-full" ref={scrollRef}>
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4">
                      <Sparkles className="h-7 w-7 text-white/20" />
                    </div>
                    <p className="text-sm font-bold text-white/50 mb-1">No callouts yet</p>
                    <p className="text-xs text-white/25 text-center max-w-xs">Paste a token CA or wallet address below to post the first callout</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {filtered.map(c => (
                      <div key={c.id} className="p-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            {safeAvatarUrl(c.avatar) ? (
                              <img src={safeAvatarUrl(c.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-primary-foreground">
                                {c.username[0]?.toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="font-semibold">{c.username}</span>
                              <span className="text-xs text-muted-foreground">{formatDistanceToNow(c.timestamp, { addSuffix: true })}</span>
                              <Badge variant="outline" className={`text-[9px] ${c.type === "token" ? "border-[#22d3ee]/30 text-[#22d3ee]" : "border-[#eab308]/30 text-[#eab308]"}`}>
                                {c.type === "token" ? "TOKEN" : "WALLET"}
                              </Badge>
                            </div>

                            {c.note && <p className="text-sm text-white/60 mb-2 italic">"{c.note}"</p>}

                            <Card className={`og-glass-card overflow-hidden ${c.type === "token" ? "border-primary/20" : "border-secondary/20"}`}>
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4 mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-xl ${c.type === "token" ? "bg-primary/20" : "bg-secondary/20"}`}>
                                      {c.type === "token" ? <Coins className="h-5 w-5 text-[#22d3ee]" /> : <Wallet className="h-5 w-5 text-[#eab308]" />}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <p className="font-bold text-lg">{c.symbol || shortAddr(c.address)}</p>
                                        {c.priceChange24h != null && (
                                          <Badge className={c.priceChange24h >= 0 ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                                            {c.priceChange24h >= 0 ? "+" : ""}{c.priceChange24h.toFixed(1)}%
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground">{c.name || shortAddr(c.address)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyAddress(c.address)}>
                                      <Copy className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                      <a href={c.pairUrl || `https://dexscreener.com/solana/${c.address}`} target="_blank" rel="noreferrer">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </Button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  {c.type === "token" ? (
                                    <>
                                      <Stat label="Price" value={c.price ? `$${c.price < 0.01 ? c.price.toFixed(8) : c.price.toFixed(4)}` : "N/A"} />
                                      <Stat label="Market Cap" value={`$${fmtNum(c.marketCap)}`} />
                                      <Stat label="Liquidity" value={`$${fmtNum(c.liquidity)}`} />
                                      <Stat label="24h Volume" value={`$${fmtNum(c.volume24h)}`} />
                                    </>
                                  ) : (
                                    <>
                                      <Stat label="Recent Txns" value={String(c.recentTxCount ?? "N/A")} />
                                      <Stat label="Address" value={shortAddr(c.address)} />
                                    </>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Input Area */}
        <div className="p-4 lg:px-6 border-t border-white/[0.07] bg-background/80 backdrop-blur-xl">
          <div className="flex flex-col gap-2 max-w-4xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input placeholder="Token CA or wallet address..." value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && analyzeAndPost()}
                  className="pl-12 h-12 text-base rounded-xl bg-muted/30 border-white/[0.07] focus:border-primary"
                  disabled={analyzing} />
              </div>
              <Button onClick={analyzeAndPost} disabled={!input.trim() || analyzing}
                className="h-12 px-6 gap-2 btn-premium rounded-xl">
                {analyzing ? <><RefreshCw className="h-5 w-5 animate-spin" /> Analyzing...</> : <><Send className="h-5 w-5" /> Post</>}
              </Button>
            </div>
            <Input placeholder="Add a note (optional)..." value={note}
              onChange={e => setNote(e.target.value)}
              className="h-9 text-sm rounded-lg bg-muted/20 border-white/[0.05]"
              disabled={analyzing} />
          </div>
        </div>
      </div>
    </Wrap>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{value}</p>
    </div>
  );
}

export default Callouts;
