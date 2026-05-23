import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useCredits } from "@/hooks/useCredits";
import { CreditBalance } from "@/components/credits/CreditBalance";
import { CREDIT_PRICING, formatCreditCost } from "@/lib/credit-pricing";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "What's the safest way to analyze a new token?",
  "How do I identify whale wallets?",
  "What are red flags in a rug pull?",
  "Best strategies for Solana DeFi?",
];

export const AIChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hey! I'm SolanaGPT, your AI trading assistant. Ask me anything about Solana tokens, wallets, DeFi strategies, or market analysis. How can I help you today?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { spendCredits, canAfford } = useCredits();

  const chatCost = CREDIT_PRICING['ai-chat'].cost;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Check if user can afford
    if (!canAfford('ai-chat')) {
      toast({
        title: "Insufficient Credits",
        description: `AI Chat costs ${formatCreditCost(chatCost)} per message`,
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Spend credits first
      const spent = await spendCredits('ai-chat', `Chat: ${text.slice(0, 50)}...`);
      if (!spent) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("ai-analyzer", {
        body: {
          action: "chat",
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.analysis || "Sorry, I couldn't process that request."
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Chat error",
        description: error instanceof Error ? error.message : "Failed to get response",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-[500px] max-h-[65vh]">
      {/* Header */}
      <div className="p-3 border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">SolanaGPT</h3>
            <p className="text-[10px] text-muted-foreground">AI Trading Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0.5">
            <DollarSign className="h-2.5 w-2.5 mr-0.5" />
            {chatCost.toFixed(0)}/msg
          </Badge>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="p-2 rounded-lg bg-primary/10 h-fit">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="p-2 rounded-lg bg-muted h-fit">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <div className="p-2 rounded-lg bg-primary/10 h-fit">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick prompts */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-white/[0.07]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about tokens, wallets..."
            disabled={isLoading}
            className="flex-1 h-10"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="sm" className="h-10 px-3">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
};
