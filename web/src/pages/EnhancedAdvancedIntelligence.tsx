import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Brain, Zap, Users, FileDown, ExternalLink, Sparkles, SlidersHorizontal, Plus, Wallet, MessageSquare, ChevronDown, Skull } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { supabase, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MODEL_TEAMS, Team } from "@/lib/modelTeams";
import { getTokenHolders } from "@/lib/solana-tools";
import { openReportHtml, downloadReportHtml } from "@/lib/reportHtml";
import { SmartSignals } from "./advanced-intelligence/components/SmartSignals";
import { TokenMaturityScore } from "./advanced-intelligence/components/TokenMaturityScore";
import { DevHistoryDashboard } from "./advanced-intelligence/components/DevHistoryDashboard";
import { ContractAnalyzer } from "./advanced-intelligence/components/ContractAnalyzer";
import { HolderConcentrationTimeline } from "./advanced-intelligence/components/HolderConcentrationTimeline";
import { TokenTimelineFeed } from "./advanced-intelligence/components/TokenTimelineFeed";
import { ResearchNotes } from "./advanced-intelligence/components/ResearchNotes";
import { EcosystemMapper } from "./advanced-intelligence/components/EcosystemMapper";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    team?: string;
    models?: string[];
    consensus?: number;
    toolsUsed?: string[];
  };
  chart?: { embedUrl?: string; url?: string; pairAddress?: string };
  tokenCard?: any;
  wallet?: any;
}

// ── Live-agent UI helpers ───────────────────────────────────────────────
const fUsd = (n?: number | null) => {
  if (n == null || !isFinite(n as number)) return "—";
  const a = Math.abs(n as number);
  if (a >= 1e9) return "$" + ((n as number) / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return "$" + ((n as number) / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return "$" + ((n as number) / 1e3).toFixed(1) + "K";
  if (a > 0 && a < 0.01) return "$" + (n as number).toExponential(2);
  return "$" + (n as number).toFixed(2);
};
const fAmt = (n?: number | null) => {
  if (n == null || !isFinite(n as number)) return "—";
  const a = Math.abs(n as number);
  if (a >= 1e9) return ((n as number) / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return ((n as number) / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return ((n as number) / 1e3).toFixed(1) + "K";
  return (n as number).toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const TypewriterText = ({ text, animate }: { text: string; animate: boolean }) => {
  const [shown, setShown] = useState(animate ? "" : text);
  useEffect(() => {
    if (!animate) { setShown(text); return; }
    let i = 0; setShown("");
    const step = Math.max(3, Math.round(text.length / 200));
    const id = setInterval(() => {
      i += step;
      setShown(text.slice(0, i));
      if (i >= text.length) { setShown(text); clearInterval(id); }
    }, 16);
    return () => clearInterval(id);
  }, [text, animate]);
  return <p className="text-sm whitespace-pre-wrap leading-relaxed">{shown}</p>;
};

const TokenCardView = ({ t }: { t: any }) => (
  <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5">
    {t.image && (
      <img src={t.image} alt="" className="h-9 w-9 rounded-full object-cover shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
    )}
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-white text-sm truncate">{t.name || t.symbol || "Token"}</span>
        {t.symbol && <span className="text-[11px] text-white/40">${t.symbol}</span>}
        {t.riskLevel && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${t.riskLevel === "HIGH" ? "bg-red-500/20 text-red-300" : t.riskLevel === "MEDIUM" ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"}`}>{t.riskLevel} RISK</span>
        )}
      </div>
      <div className="text-[11px] text-white/50 flex gap-3 mt-0.5 flex-wrap">
        <span>Price {fUsd(t.priceUsd)}</span>
        <span>MC {fUsd(t.marketCap)}</span>
        <span>Liq {fUsd(t.liquidityUsd)}</span>
        {t.holders != null && <span>{fAmt(t.holders)} holders</span>}
        {t.ageDays != null && <span>{t.ageDays}d old</span>}
      </div>
    </div>
    {t.dexUrl && <a href={t.dexUrl} target="_blank" rel="noreferrer" className="text-[11px] text-[#22d3ee] hover:underline shrink-0">Chart ↗</a>}
  </div>
);

const ChartEmbed = ({ url }: { url: string }) => (
  <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black/40">
    <iframe src={url} title="DexScreener chart" loading="lazy" style={{ width: "100%", height: 340, border: 0, display: "block" }} />
  </div>
);

const fDate = (ts?: number | null) => {
  if (!ts) return null;
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const rel = days <= 0 ? "today" : days === 1 ? "1d ago" : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })} (${rel})`;
};

const WalletView = ({ w }: { w: any }) => (
  <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
    <div className="flex gap-4 text-[11px] text-white/60 mb-3 flex-wrap">
      <span>SOL: <b className="text-white">{w.solBalance != null ? Number(w.solBalance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}</b></span>
      <span>Tokens: <b className="text-white">{w.tokenCount ?? "—"}</b></span>
      <span>Est. token value: <b className="text-white">{fUsd(w.estTokenValueUsd)}</b></span>
    </div>
    <div className="space-y-1.5">
      {(w.holdings || []).slice(0, 8).map((h: any, i: number) => {
        const first = fDate(h.firstBoughtTs);
        const hasActivity = h.buys != null || h.sells != null;
        return (
          <div key={i} className="rounded-md bg-black/20 px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="text-white/90 font-medium truncate">{h.symbol || (h.mint ? h.mint.slice(0, 4) + "…" + h.mint.slice(-4) : "?")}</span>
              <span className="text-white/40 text-right shrink-0">{fAmt(h.amount)}</span>
              <span className="text-white/80 text-right shrink-0 w-20">{fUsd(h.valueUsd)}</span>
            </div>
            {(first || hasActivity) && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/45 mt-0.5">
                {first && <span>first bought <b className="text-white/70">{first}</b></span>}
                {h.buys != null && <span className="text-emerald-400/70">{h.buys} buys</span>}
                {h.sells != null && <span className="text-rose-400/70">{h.sells} sells</span>}
                {h.solSpent ? <span>spent <b className="text-white/70">{h.solSpent} SOL</b></span> : null}
                {h.solRecv ? <span>got back <b className="text-white/70">{h.solRecv} SOL</b></span> : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
    <div className="text-[9px] text-white/30 mt-2">Trade data from last 100 swaps. Exact cost-basis/PnL needs a paid source.</div>
  </div>
);

interface TokenData {
  mint: string;
  name: string;
  symbol: string;
  image_url?: string;
  current_price?: number;
  market_cap?: number;
  holders_count?: number;
  created_at?: string;
}

export const EnhancedAdvancedIntelligence = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Token analysis state
  const initialMint = searchParams.get("mint") || "";
  const [mint, setMint] = useState(initialMint);
  const [token, setToken] = useState<TokenData | null>(null);
  const [tokenSearching, setTokenSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("intelligence");

  // Intelligence chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(MODEL_TEAMS[0]);
  const [useEnsemble, setUseEnsemble] = useState(true);
  const [context, setContext] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [tokenInput, setTokenInput] = useState(initialMint);

  // AI report generation
  const [reportLoading, setReportLoading] = useState<"open" | "download" | null>(null);

  // Map the page's token (from `tokens` table) to the report generator's expected shape.
  const toReportInput = (t: TokenData) =>
    ({
      token: {
        id: t.mint,
        symbol: t.symbol,
        name: t.name,
        icon: t.image_url,
        price: t.current_price,
        mcap: t.market_cap,
        holderCount: t.holders_count,
      },
      team: selectedTeam?.id || "reasoning",
      models: selectedTeam?.models.map((m) => m.id),
    }) as any;

  const handleGenerateReport = async (mode: "open" | "download") => {
    if (!token) {
      toast.error("Load a token first");
      return;
    }
    setReportLoading(mode);
    toast.info("AI agent is writing the report… this can take a few seconds");
    try {
      if (mode === "open") {
        await openReportHtml(toReportInput(token));
      } else {
        await downloadReportHtml(toReportInput(token));
        toast.success("Report downloaded");
      }
    } catch (err: any) {
      console.error("Report error:", err);
      toast.error(err?.message || "Failed to generate report");
    } finally {
      setReportLoading(null);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Prefill + auto-send from a ?q= deep link (e.g. wallet card -> "analyze wallet X").
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && selectedTeam && messages.length === 0) {
      handleSendMessage(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam]);

  // Load token when mounted with query param
  useEffect(() => {
    if (initialMint) {
      handleSearchToken(initialMint);
    }
  }, [initialMint]);

  // Looks like a Solana mint (base58, 32-44 chars)
  const looksLikeMint = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());

  // Live fallback: pull token data from Dexscreener (public, no key) for any mint
  // that isn't in our `tokens` table yet. Picks the deepest-liquidity pair.
  // Fetches holders in parallel so analysis tabs have fresh data.
  const fetchLiveToken = async (mintAddr: string): Promise<TokenData | null> => {
    try {
      // Parallel: Dexscreener for price/market data + Helius for holder data
      const [dexRes, holders] = await Promise.all([
        fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddr}`),
        getTokenHolders(mintAddr, 100).catch(() => []),
      ]);
      
      if (!dexRes.ok) return null;
      const json = await dexRes.json();
      const pairs: any[] = json?.pairs || [];
      if (pairs.length === 0) return null;
      
      const best = pairs
        .filter((p) => p?.chainId === "solana" || p?.baseToken?.address)
        .sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
      if (!best) return null;
      
      return {
        mint: best.baseToken?.address || mintAddr,
        name: best.baseToken?.name || "Unknown",
        symbol: best.baseToken?.symbol || "???",
        image_url: best.info?.imageUrl,
        current_price: best.priceUsd ? parseFloat(best.priceUsd) : undefined,
        market_cap: best.marketCap ?? best.fdv ?? undefined,
        holders_count: holders.length > 0 ? holders.length : undefined, // Top holders count from Helius
        created_at: best.pairCreatedAt ? new Date(best.pairCreatedAt).toISOString() : undefined,
      };
    } catch (err) {
      console.error("Live token fetch failed:", err);
      return null;
    }
  };

  const handleSearchToken = async (searchValue: string) => {
    const q = searchValue.trim();
    if (!q) {
      toast.error("Enter a mint address or token name");
      return;
    }

    setTokenSearching(true);
    try {
      // 1) Try our own tokens table first (richest data).
      const { data } = await supabase
        .from("tokens")
        .select("*")
        .or(`mint.eq.${q},name.ilike.%${q}%,symbol.ilike.%${q}%`)
        .limit(1)
        .maybeSingle();

      if (data) {
        setToken(data);
        setMint(data.mint);
        setTokenInput(data.name || data.mint);
        toast.success(`Loaded: ${data.name || data.symbol}`);
        return;
      }

      // 2) Not in DB — if it looks like a mint, fetch live from Dexscreener.
      if (looksLikeMint(q)) {
        toast.info("Not in database — fetching live on-chain data…");
        const live = await fetchLiveToken(q);
        if (live) {
          setToken(live);
          setMint(live.mint);
          setTokenInput(live.name || live.mint);
          toast.success(`Loaded live: ${live.name || live.symbol}`);
          return;
        }
        toast.error("No live data found for that mint");
        setToken(null);
        return;
      }

      toast.error("Token not found. Try a full mint address for live lookup.");
      setToken(null);
    } catch (err) {
      console.error("Search error:", err);
      toast.error("Failed to load token");
    } finally {
      setTokenSearching(false);
    }
  };

  const handleSendMessage = async (override?: string) => {
    const userMessage = (override ?? input).trim();
    if (!userMessage) return;
    if (!selectedTeam) {
      toast.error("Select a model team");
      return;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: new Date() }]);
    setLoading(true);
    setStreaming(true);

    try {
      // Prepare context with token data if available
      const tokenContext = token
        ? `
Current Token Being Analyzed:
- Name: ${token.name} (${token.symbol})
- Mint: ${token.mint}
- Price: $${token.current_price || "N/A"}
- Market Cap: $${token.market_cap || "N/A"}
- Holders: ${token.holders_count || "N/A"}
- Created: ${token.created_at || "N/A"}
`
        : "";

      const convoMsgs = [...messages, { role: "user", content: userMessage }].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Real SSE streaming via the same-origin /ai-fn rewrite (adblocker-safe).
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/ai-fn/enhanced-intelligence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ messages: convoMsgs, context: `${context}\n${tokenContext}`, stream: true }),
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        throw new Error(errText || `Request failed (${resp.status})`);
      }

      let inserted = false;
      let acc = "";
      const ensureInserted = (meta?: any) => {
        if (inserted) return;
        inserted = true;
        setLoading(false); // gathering done; spinner off, bubble fills live
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            timestamp: new Date(),
            metadata: {
              team: selectedTeam.name,
              models: meta?.modelsUsed || [],
              consensus: meta?.consensus || 0.85,
              toolsUsed: meta?.toolsUsed || [],
            },
            chart: meta?.chart || undefined,
            tokenCard: meta?.token || undefined,
            wallet: meta?.wallet || undefined,
          },
        ]);
      };
      const patchLastContent = (c: string) =>
        setMessages((prev) => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "assistant") { copy[i] = { ...copy[i], content: c }; break; }
          }
          return copy;
        });
      const handle = (obj: any) => {
        if (obj.type === "meta") {
          ensureInserted(obj);
        } else if (obj.type === "delta") {
          ensureInserted();
          acc += obj.text || "";
          patchLastContent(acc);
        } else if (obj.type === "error") {
          ensureInserted();
          acc += `\n\n_(stream error: ${obj.error})_`;
          patchLastContent(acc);
        }
      };

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() || "";
        for (const frame of frames) {
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const data = dataLine.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try { handle(JSON.parse(data)); } catch { /* ignore partial */ }
        }
      }
      ensureInserted(); // safety: ensure a bubble exists even if nothing streamed
    } catch (err: any) {
      console.error("Error:", err);
      toast.error(err.message || "Failed to get response");
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const SUGGESTIONS = [
    { icon: Sparkles, label: "Analyze $BONK", prompt: "Analyze $BONK" },
    { icon: Sparkles, label: "Analyze $WIF", prompt: "Analyze $WIF" },
    { icon: Wallet, label: "Read a trader wallet", prompt: "Analyze wallet 6L1Pjevc9FgWKDr6MaZEntBYPpjVync7xXxoJAb749rv" },
    { icon: Skull, label: "Biggest rug red flags?", prompt: "What are the biggest rug pull red flags I should watch for?" },
  ];

  const seg = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
      active ? "bg-[#22d3ee]/20 text-white border border-[#22d3ee]/40" : "text-white/50 hover:text-white/80 border border-transparent"
    }`;

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100dvh-68px)] lg:h-[100dvh]">
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <header className="shrink-0 sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/[0.07]">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-[#22d3ee]/15 border border-[#22d3ee]/30 flex items-center justify-center shrink-0">
                <Skull className="h-5 w-5 text-[#22d3ee]" />
              </div>
              <div className="min-w-0 hidden sm:block">
                <h1 className="text-sm font-bold leading-tight truncate">Grim Intelligence</h1>
                <p className="text-[11px] text-white/40 leading-tight truncate">The chain reaper · live on-chain analysis</p>
              </div>
            </div>

            {/* Segmented tab switch */}
            <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1 border border-white/10">
              <button onClick={() => setActiveTab("intelligence")} className={seg(activeTab === "intelligence")}>
                <Brain className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI Chat</span>
              </button>
              <button onClick={() => setActiveTab("analysis")} className={seg(activeTab === "analysis")}>
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Token Analysis</span>
              </button>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 min-w-0 justify-end">
              {activeTab === "intelligence" && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 border-white/10 bg-white/5 h-8 px-2.5">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span className="hidden md:inline text-xs max-w-[120px] truncate">{selectedTeam?.name?.replace(/^[^\sA-Za-z]+\s*/, "") || "Settings"}</span>
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 max-h-[70vh] overflow-y-auto bg-[#0b0b0f] border-white/10 p-3">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold text-white/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-[#22d3ee]" /> Model Team ({MODEL_TEAMS.length})
                          </p>
                          <div className="grid grid-cols-1 gap-1.5">
                            {MODEL_TEAMS.map((team) => (
                              <button
                                key={team.id}
                                onClick={() => setSelectedTeam(team)}
                                className={`p-2 rounded-md border text-left transition ${
                                  selectedTeam?.id === team.id
                                    ? "border-[#22d3ee] bg-[#22d3ee]/10 text-white"
                                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20"
                                }`}
                              >
                                <p className="font-semibold text-xs">{team.name}</p>
                                <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">{team.specialty}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={useEnsemble} onChange={(e) => setUseEnsemble(e.target.checked)} className="w-3.5 h-3.5" />
                          <span className="text-[11px] text-white/60">Ensemble voting (higher accuracy)</span>
                        </label>

                        <div>
                          <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1.5">Analysis Context</label>
                          <input
                            type="text"
                            placeholder="e.g. 'security audit', 'dev check'"
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/30"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setMessages([]); setStreaming(false); setLoading(false); }}
                    disabled={messages.length === 0}
                    className="gap-1.5 border-white/10 bg-white/5 h-8 px-2.5"
                    title="New chat"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden md:inline text-xs">New</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="flex-1 min-h-0">
          {activeTab === "intelligence" ? (
            <div className="flex flex-col h-full">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
                <div className="max-w-3xl mx-auto space-y-4">
                  {messages.length === 0 && !loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-center pt-10 pb-6">
                      <div className="h-16 w-16 rounded-2xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center mb-4">
                        <Skull className="h-8 w-8 text-[#22d3ee]" />
                      </div>
                      <h2 className="text-lg font-bold text-white">Ask Grim anything</h2>
                      <p className="text-sm text-white/40 mt-1.5 max-w-md">
                        Drop a contract address, a wallet, or a token ticker. Grim reads the chain and rips it apart — no sugarcoating.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-lg">
                        {SUGGESTIONS.map((sg) => (
                          <button
                            key={sg.label}
                            onClick={() => handleSendMessage(sg.prompt)}
                            disabled={!selectedTeam}
                            className="flex items-center gap-2.5 p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:border-[#22d3ee]/40 hover:bg-[#22d3ee]/[0.06] transition text-left disabled:opacity-50"
                          >
                            <sg.icon className="h-4 w-4 text-[#22d3ee] shrink-0" />
                            <span className="text-xs text-white/70">{sg.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`px-4 py-3 rounded-2xl ${
                            msg.role === "user"
                              ? "max-w-2xl bg-[#22d3ee]/20 border border-[#22d3ee]/30 text-white rounded-br-md"
                              : "w-full max-w-2xl bg-white/5 border border-white/10 text-white/85 rounded-bl-md"
                          }`}
                        >
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold text-[#22d3ee]/80">
                              <Skull className="h-3.5 w-3.5" /> Grim
                            </div>
                          )}
                          {msg.role === "assistant"
                            ? <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}{streaming && idx === messages.length - 1 && msg.content !== "" ? <span className="inline-block w-1.5 h-4 ml-0.5 bg-white/50 align-middle animate-pulse" /> : null}</p>
                            : <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                          {msg.tokenCard && <TokenCardView t={msg.tokenCard} />}
                          {msg.chart?.embedUrl && <ChartEmbed url={msg.chart.embedUrl} />}
                          {msg.wallet && <WalletView w={msg.wallet} />}
                          {msg.metadata && (
                            <div className="text-[11px] text-white/30 mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                              {msg.metadata.team && <span>Team: {msg.metadata.team}</span>}
                              {msg.metadata.consensus ? <span>Consensus: {(msg.metadata.consensus * 100).toFixed(0)}%</span> : null}
                              {msg.metadata.toolsUsed && msg.metadata.toolsUsed.length > 0 && (
                                <span>Tools: {msg.metadata.toolsUsed.join(", ")}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#22d3ee]/70" />
                        <span className="text-xs text-white/40">Grim is reading the chain<span className="animate-pulse">...</span></span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input bar */}
              <div className="shrink-0 border-t border-white/[0.07] bg-background/80 backdrop-blur-xl px-4 py-3 lg:px-6">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 focus-within:border-[#22d3ee]/40 transition">
                    <Textarea
                      placeholder="Drop a CA, wallet, or ticker… ask Grim anything"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={loading || !selectedTeam}
                      rows={1}
                      className="flex-1 min-h-[24px] max-h-32 resize-none border-0 bg-transparent p-0 text-sm text-white placeholder-white/30 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50"
                    />
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={loading || !input.trim() || !selectedTeam}
                      size="icon"
                      className="btn-3d h-9 w-9 shrink-0 rounded-xl"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-white/25 mt-1.5 px-1 text-center">
                    Grim reads live chain data. Always DYOR — NFA. Enter to send, Shift+Enter for newline.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ── Token Analysis Tab ── */
            <div className="h-full overflow-y-auto px-4 py-6 lg:px-6">
              <div className="max-w-5xl mx-auto space-y-4">
                {/* Token Search */}
                <Card className="p-4 glass-card border-white/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter mint address or token name..."
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchToken(tokenInput)}
                      className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30"
                    />
                    <Button onClick={() => handleSearchToken(tokenInput)} disabled={tokenSearching} className="btn-3d">
                      {tokenSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Analyze
                    </Button>
                  </div>
                </Card>

                {tokenSearching ? (
                  <Card className="p-12 text-center glass-card">
                    <Loader2 className="h-6 w-6 animate-spin text-white/30 mx-auto" />
                  </Card>
                ) : !token ? (
                  <Card className="p-12 text-center glass-card">
                    <Zap className="h-12 w-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/40">No token selected</p>
                  </Card>
                ) : (
                  <>
                    {/* Token Header */}
                    <Card className="p-6 glass-card border-white/10">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-4">
                          {token.image_url && <img src={token.image_url} alt={token.symbol} className="h-16 w-16 rounded-lg" />}
                          <div>
                            <h2 className="text-2xl font-bold text-white">{token.name}</h2>
                            <p className="text-white/40 font-mono text-sm break-all">{token.mint}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => handleGenerateReport("open")} disabled={reportLoading !== null} className="btn-3d gap-2">
                            {reportLoading === "open" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                            AI Report
                          </Button>
                          <Button onClick={() => handleGenerateReport("download")} disabled={reportLoading !== null} variant="outline" className="gap-2 border-white/10">
                            {reportLoading === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                            Download
                          </Button>
                        </div>
                      </div>
                    </Card>

                    {/* Analysis Sub-tabs */}
                    <Tabs defaultValue="signals" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 gap-2 bg-white/5 p-1">
                        <TabsTrigger value="signals" className="text-xs lg:text-sm">Signals</TabsTrigger>
                        <TabsTrigger value="maturity" className="text-xs lg:text-sm">Maturity</TabsTrigger>
                        <TabsTrigger value="dev" className="text-xs lg:text-sm">Dev</TabsTrigger>
                        <TabsTrigger value="contract" className="text-xs lg:text-sm">Contract</TabsTrigger>
                        <TabsTrigger value="holders" className="text-xs lg:text-sm">Holders</TabsTrigger>
                        <TabsTrigger value="timeline" className="text-xs lg:text-sm">Timeline</TabsTrigger>
                        <TabsTrigger value="ecosystem" className="text-xs lg:text-sm">Map</TabsTrigger>
                        <TabsTrigger value="research" className="text-xs lg:text-sm">Notes</TabsTrigger>
                      </TabsList>
                      <div className="mt-6">
                        <TabsContent value="signals"><SmartSignals mint={mint} token={token} /></TabsContent>
                        <TabsContent value="maturity"><TokenMaturityScore mint={mint} token={token} /></TabsContent>
                        <TabsContent value="dev"><DevHistoryDashboard mint={mint} token={token} /></TabsContent>
                        <TabsContent value="contract"><ContractAnalyzer mint={mint} token={token} /></TabsContent>
                        <TabsContent value="holders"><HolderConcentrationTimeline mint={mint} token={token} /></TabsContent>
                        <TabsContent value="timeline"><TokenTimelineFeed mint={mint} token={token} /></TabsContent>
                        <TabsContent value="ecosystem"><EcosystemMapper mint={mint} token={token} /></TabsContent>
                        <TabsContent value="research"><ResearchNotes mint={mint} token={token} user={user} /></TabsContent>
                      </div>
                    </Tabs>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );

};

export default EnhancedAdvancedIntelligence;
