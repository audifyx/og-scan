import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Brain, Zap, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MODEL_TEAMS, Team, ModelInfo } from "@/lib/modelTeams";
import { SmartSignals } from "./components/SmartSignals";
import { TokenMaturityScore } from "./components/TokenMaturityScore";
import { DevHistoryDashboard } from "./components/DevHistoryDashboard";
import { ContractAnalyzer } from "./components/ContractAnalyzer";
import { HolderConcentrationTimeline } from "./components/HolderConcentrationTimeline";
import { TokenTimelineFeed } from "./components/TokenTimelineFeed";
import { ResearchNotes } from "./components/ResearchNotes";
import { EcosystemMapper } from "./components/EcosystemMapper";

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load token when mounted with query param
  useEffect(() => {
    if (initialMint) {
      handleSearchToken(initialMint);
    }
  }, [initialMint]);

  const handleSearchToken = async (searchValue: string) => {
    if (!searchValue.trim()) {
      toast.error("Enter a mint address or token name");
      return;
    }

    setTokenSearching(true);
    try {
      const { data, error } = await supabase
        .from("tokens")
        .select("*")
        .or(`mint.eq.${searchValue},name.ilike.%${searchValue}%,symbol.ilike.%${searchValue}%`)
        .limit(1)
        .single();

      if (error || !data) {
        toast.error("Token not found");
        setToken(null);
        return;
      }

      setToken(data);
      setMint(data.mint);
      setTokenInput(data.name || data.mint);
      toast.success(`Loaded: ${data.name || data.symbol}`);
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

      // Call enhanced intelligence edge function
      const { data: responseData, error } = await supabase.functions.invoke(
        "enhanced-intelligence",
        {
          body: {
            messages: messages.map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
            team: selectedTeam.id,
            models: selectedTeam.models.map((m) => m.id),
            useEnsemble,
            context: `${context}\n${tokenContext}`,
            userMessage,
            token: token || undefined,
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

      toast.success(`Analysis complete (${(consensus * 100).toFixed(0)}% consensus)`);
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
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      {token.image_url && (
                        <img src={token.image_url} alt={token.symbol} className="h-16 w-16 rounded-lg" />
                      )}
                      <div>
                        <h2 className="text-2xl font-bold text-white">{token.name}</h2>
                        <p className="text-white/40 font-mono text-sm">{token.mint}</p>
                      </div>
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
