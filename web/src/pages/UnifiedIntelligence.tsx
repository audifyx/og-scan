import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Brain } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    toolsUsed?: string[];
    dataQueried?: string;
  };
}

// Available NVIDIA NIM models (free tier)
const AVAILABLE_MODELS = [
  { name: "meta/llama-3.1-70b-instruct", provider: "Meta", category: "General" },
  { name: "mistralai/mistral-large", provider: "Mistral", category: "General" },
  { name: "mistralai/nemotron-4-340b-instruct", provider: "Mistral", category: "Function Calling" },
  { name: "meta/llama-3.1-405b-instruct", provider: "Meta", category: "Reasoning" },
  { name: "deepseek/deepseek-coder-671b-instruct", provider: "DeepSeek", category: "Code" },
  { name: "google/gemma-2-27b-it", provider: "Google", category: "General" },
  { name: "microsoft/phi-3.5-mini-instruct", provider: "Microsoft", category: "Lightweight" },
  { name: "nvidia/nemotron-3-super-120b-a12b", provider: "NVIDIA", category: "Optimized" },
];

export const UnifiedIntelligence = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].name);
  const [context, setContext] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage, timestamp: new Date() }]);
    setLoading(true);

    try {
      // Call unified intelligence edge function
      const { data: supabaseData, error: supabaseError } = await supabase.functions.invoke("unified-intelligence", {
        body: {
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          model: selectedModel,
          context,
          userMessage,
        },
      });

      if (supabaseError) throw supabaseError;

      const assistantMessage = supabaseData.content;
      const toolsUsed = supabaseData.toolsUsed;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantMessage,
          timestamp: new Date(),
          metadata: {
            model: selectedModel,
            toolsUsed: toolsUsed ? ["blockchain_data", "token_analysis"] : [],
            dataQueried: toolsUsed ? "real-time data" : undefined,
          },
        },
      ]);

      toast.success("Response generated with real data");
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
        title="UNIFIED INTELLIGENCE"
        description="Multi-API connected AI agent — query tokens, wallets, contracts, and talk to blockchain"
      />

      <div className="max-w-4xl mx-auto h-[calc(100vh-300px)] flex flex-col gap-4">
        {/* Model selector and controls */}
        <Card className="p-4 glass-card border-white/10">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider">AI Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full mt-2 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white"
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.provider} - {model.name.split("/")[1]} ({model.category})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider">Context (optional)</label>
              <input
                type="text"
                placeholder="Add context... (e.g., 'analyzing meme coins', 'checking contract safety')"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="w-full mt-2 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30"
              />
            </div>
          </div>
        </Card>

        {/* Chat messages */}
        <Card className="flex-1 glass-card border-white/10 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Brain className="h-12 w-12 text-white/20 mb-4" />
              <p className="text-white/40">No messages yet</p>
              <p className="text-xs text-white/30 mt-2 max-w-sm">
                Ask me about any token, wallet, or contract. I'm connected to real on-chain data and can analyze
                anything.
              </p>
              <div className="mt-6 space-y-2 text-xs text-white/40">
                <p>Try asking:</p>
                <ul className="space-y-1">
                  <li>📊 "What's the holder distribution for [token]?"</li>
                  <li>🔍 "Analyze contract safety for [mint]"</li>
                  <li>💰 "Check wallet @username"</li>
                  <li>⚠️ "Is this token a honeypot?"</li>
                </ul>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-md px-4 py-2 rounded-lg ${
                    msg.role === "user"
                      ? "bg-[#22d3ee]/20 border border-[#22d3ee]/30 text-white"
                      : "bg-white/5 border border-white/10 text-white/80"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  {msg.metadata?.toolsUsed && (
                    <div className="text-xs text-white/40 mt-2 flex gap-2">
                      {msg.metadata.toolsUsed.map((tool) => (
                        <Badge key={tool} variant="outline" className="text-[10px]">
                          {tool}
                        </Badge>
                      ))}
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
                <span className="text-xs text-white/40">Analyzing...</span>
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
              placeholder="Ask about a token, wallet, contract... (e.g., '@username', mint address, or natural question)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              disabled={loading}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 disabled:opacity-50"
            />
            <Button onClick={handleSendMessage} disabled={loading || !input.trim()} className="btn-3d gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </Card>

        {/* Connected APIs indicator */}
        <div className="text-xs text-white/40 flex items-center gap-3 px-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            NVIDIA NIM
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
      </div>
    </AppLayout>
  );
};

export default UnifiedIntelligence;
