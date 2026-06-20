import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User as UserIcon, Loader2, Sparkles, Zap, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "What's the safest way to analyze a new Solana token?",
  "How do I spot whale wallets accumulating?",
  "What are the biggest rug pull red flags?",
  "Give me a quick memecoin risk checklist.",
];

const GREETING: Message = {
  role: "assistant",
  content:
    "Hey, I'm OG Scan AI — your Solana trading copilot. Ask me about tokens, wallets, DeFi strategies, risk, or how to use OGScan. What are we digging into?",
};

const AlphaChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: Message = { role: "user", content: trimmed };
      const history = [...messages, userMessage];
      setMessages(history);
      setInput("");
      setIsLoading(true);

      try {
        const { data, error } = await supabase.functions.invoke("ai-analyzer", {
          body: {
            action: "chat",
            messages: history
              .filter((m) => m.content?.trim())
              .map((m) => ({ role: m.role, content: m.content })),
          },
        });

        if (error) {
          // Surface the real edge-function error body when available
          let detail = error.message || "Request failed";
          try {
            const ctx = (error as { context?: Response }).context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.error) detail = body.error;
            }
          } catch {
            /* noop */
          }
          throw new Error(detail);
        }

        const reply = (data?.analysis as string) || "Sorry, I couldn't generate a response. Try again.";
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ ${msg}\n\n${
              user ? "Try again in a moment." : "You may need to sign in first."
            }`,
          },
        ]);
      } finally {
        setIsLoading(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [isLoading, messages, user],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-68px)] flex-col lg:h-screen">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3 lg:px-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-og-cyan/20 blur-lg" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-og-cyan/40 bg-og-cyan/10">
              <Sparkles className="h-5 w-5 text-og-cyan" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-black uppercase tracking-wide text-white">OG Scan AI</h1>
            <p className="flex items-center gap-1.5 text-[11px] text-white/40">
              <Zap className="h-3 w-3 text-og-lime" /> NVIDIA Llama 3.3 70B · Solana trading copilot
            </p>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    msg.role === "assistant"
                      ? "border-og-cyan/30 bg-og-cyan/10 text-og-cyan"
                      : "border-og-lime/30 bg-og-lime/10 text-og-lime",
                  )}
                >
                  {msg.role === "assistant" ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                </div>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "assistant"
                      ? "border border-white/[0.06] bg-white/[0.03] text-white/85"
                      : "bg-og-lime/15 text-white",
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-og-cyan/30 bg-og-cyan/10 text-og-cyan">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-sm text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                </div>
              </div>
            )}

            {messages.length <= 1 && !isLoading && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => sendMessage(p)}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left text-[13px] text-white/60 transition hover:border-og-cyan/30 hover:bg-white/[0.05] hover:text-white"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {!user && (
              <div className="flex items-center gap-2 rounded-xl border border-og-gold/20 bg-og-gold/5 px-4 py-2.5 text-[12px] text-og-gold/90">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Sign in to chat with OG Scan AI.
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-white/[0.07] px-4 py-3 lg:px-6">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask about a token, wallet, or strategy..."
              className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-og-cyan/40"
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-og-cyan text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-center text-[10px] text-white/20">
            OG Scan AI can make mistakes. Verify on-chain before trading.
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default AlphaChat;
