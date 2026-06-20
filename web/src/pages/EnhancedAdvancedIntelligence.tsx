import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Brain, Zap, Users, FileDown, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
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
}

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

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    if (!selectedTeam) {
      toast.error("Select a model team");
      return;
    }

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: new Date() }]);
    setLoading(true);

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

      // Call enhanced intelligence edge function (single Llama 3.1 405B)
      const { data: responseData, error } = await supabase.functions.invoke(
        "enhanced-intelligence",
        {
          body: {
            messages: messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            context: `${context}\n${tokenContext}`,
          },
        }
      );

      if (error) throw error;

      const assistantMessage = responseData.content;
      const modelsUsed = responseData.modelsUsed;
      const consensus = responseData.consensus || 0.8;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantMessage,
          timestamp: new Date(),
          metadata: {
            team: selectedTeam.name,
            models: modelsUsed,
            consensus: consensus,
            toolsUsed: responseData.toolsUsed || [],
          },
        },
      ]);

      toast.success(`✓ Analysis by Llama 3.1 405B`);
    } catch (err: any) {
      console.error("Error:", err);
      toast.error(err.message || "Failed to get response");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="ADVANCED INTELLIGENCE"
        description="Deep analysis with 40+ model teams, ensemble voting, and blockchain integration"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-2 bg-white/5 p-1 max-w-md">
          <TabsTrigger value="intelligence" className="gap-1">
            <Brain className="h-4 w-4" />
            AI Intelligence
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1">
            <Zap className="h-4 w-4" />
            Token Analysis
          </TabsTrigger>
        </TabsList>

        {/* AI Intelligence Tab */}
        <TabsContent value="intelligence" className="mt-6">
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Model Team Selector */}
            <Card className="p-4 glass-card border-white/10">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-[#22d3ee]" />
                Select Model Team ({MODEL_TEAMS.length} Teams, 40+ Models)
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                {MODEL_TEAMS.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeam(team)}
                    className={`p-3 rounded-lg border transition text-left ${
                      selectedTeam?.id === team.id
                        ? "border-[#22d3ee] bg-[#22d3ee]/10 text-white"
                        : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                    }`}
                  >
                    <p className="font-semibold text-sm">{team.name}</p>
                    <p className="text-xs text-white/40 mt-1">{team.specialty}</p>
                    <p className="text-xs text-white/30 mt-1">{team.models.length} models in team</p>
                  </button>
                ))}
              </div>

              {selectedTeam && (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded p-3 mb-4">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Team Models</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTeam.models.map((model) => (
                      <Badge
                        key={model.id}
                        variant="outline"
                        className="text-[10px] bg-white/5 border-white/10 text-white/70"
                      >
                        {model.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="ensemble"
                  checked={useEnsemble}
                  onChange={(e) => setUseEnsemble(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="ensemble" className="text-xs text-white/60">
                  Use ensemble voting (multiple models vote on answer for higher accuracy)
                </label>
              </div>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider block mb-2">
                  Analysis Context
                </label>
                <input
                  type="text"
                  placeholder="e.g., 'meme coin security audit', 'dev reputation check'"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30"
                />
              </div>
            </Card>

            {/* Chat Messages */}
            <Card className="flex-1 glass-card border-white/10 overflow-y-auto p-4 space-y-4 h-96">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Brain className="h-12 w-12 text-white/20 mb-4" />
                  <p className="text-white/40">No messages yet</p>
                  <p className="text-xs text-white/30 mt-2 max-w-sm">
                    Select a model team and ask questions about tokens, wallets, or contracts
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-2xl px-4 py-3 rounded-lg ${
                        msg.role === "user"
                          ? "bg-[#22d3ee]/20 border border-[#22d3ee]/30 text-white"
                          : "bg-white/5 border border-white/10 text-white/80"
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      {msg.metadata && (
                        <div className="text-xs text-white/40 mt-2 space-y-1">
                          {msg.metadata.team && <p>Team: {msg.metadata.team}</p>}
                          {msg.metadata.consensus && (
                            <p>Consensus: {(msg.metadata.consensus * 100).toFixed(0)}%</p>
                          )}
                          {msg.metadata.toolsUsed && msg.metadata.toolsUsed.length > 0 && (
                            <p>Tools: {msg.metadata.toolsUsed.join(", ")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-lg flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-white/30" />
                    <span className="text-xs text-white/40">Team analyzing...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </Card>

            {/* Input */}
            <Card className="p-4 glass-card border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask your question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={loading || !selectedTeam}
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 disabled:opacity-50"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={loading || !input.trim() || !selectedTeam}
                  className="btn-3d gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Token Analysis Tab */}
        <TabsContent value="analysis" className="mt-6">
          <div className="max-w-4xl mx-auto space-y-4">
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
                <Button
                  onClick={() => handleSearchToken(tokenInput)}
                  disabled={tokenSearching}
                  className="btn-3d"
                >
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
                      {token.image_url && (
                        <img src={token.image_url} alt={token.symbol} className="h-16 w-16 rounded-lg" />
                      )}
                      <div>
                        <h2 className="text-2xl font-bold text-white">{token.name}</h2>
                        <p className="text-white/40 font-mono text-sm">{token.mint}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleGenerateReport("open")}
                        disabled={reportLoading !== null}
                        className="btn-3d gap-2"
                      >
                        {reportLoading === "open" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        AI Report
                      </Button>
                      <Button
                        onClick={() => handleGenerateReport("download")}
                        disabled={reportLoading !== null}
                        variant="outline"
                        className="gap-2 border-white/10"
                      >
                        {reportLoading === "download" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4" />
                        )}
                        Download
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Analysis Tabs */}
                <Tabs defaultValue="signals" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 gap-2 bg-white/5 p-1">
                    <TabsTrigger value="signals" className="text-xs lg:text-sm">
                      Signals
                    </TabsTrigger>
                    <TabsTrigger value="maturity" className="text-xs lg:text-sm">
                      Maturity
                    </TabsTrigger>
                    <TabsTrigger value="dev" className="text-xs lg:text-sm">
                      Dev
                    </TabsTrigger>
                    <TabsTrigger value="contract" className="text-xs lg:text-sm">
                      Contract
                    </TabsTrigger>
                    <TabsTrigger value="holders" className="text-xs lg:text-sm">
                      Holders
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="text-xs lg:text-sm">
                      Timeline
                    </TabsTrigger>
                    <TabsTrigger value="ecosystem" className="text-xs lg:text-sm">
                      Map
                    </TabsTrigger>
                    <TabsTrigger value="research" className="text-xs lg:text-sm">
                      Notes
                    </TabsTrigger>
                  </TabsList>

                  <div className="mt-6">
                    <TabsContent value="signals">
                      <SmartSignals mint={mint} token={token} />
                    </TabsContent>
                    <TabsContent value="maturity">
                      <TokenMaturityScore mint={mint} token={token} />
                    </TabsContent>
                    <TabsContent value="dev">
                      <DevHistoryDashboard mint={mint} token={token} />
                    </TabsContent>
                    <TabsContent value="contract">
                      <ContractAnalyzer mint={mint} token={token} />
                    </TabsContent>
                    <TabsContent value="holders">
                      <HolderConcentrationTimeline mint={mint} token={token} />
                    </TabsContent>
                    <TabsContent value="timeline">
                      <TokenTimelineFeed mint={mint} token={token} />
                    </TabsContent>
                    <TabsContent value="ecosystem">
                      <EcosystemMapper mint={mint} token={token} />
                    </TabsContent>
                    <TabsContent value="research">
                      <ResearchNotes mint={mint} token={token} user={user} />
                    </TabsContent>
                  </div>
                </Tabs>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Connected Systems */}
      <div className="max-w-5xl mx-auto mt-8 text-xs text-white/40 flex flex-wrap items-center gap-4 px-4">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          {MODEL_TEAMS.length} Model Teams
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          40+ AI Models
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Ensemble Voting
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Supabase
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Blockchain
        </span>
      </div>
    </AppLayout>
  );
};

export default EnhancedAdvancedIntelligence;
