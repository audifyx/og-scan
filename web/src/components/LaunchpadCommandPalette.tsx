/**
 * LaunchpadCommandPalette — Cmd+K / Ctrl+K command palette for the OrbitX Launchpad.
 * Pre-filled natural language commands users copy into their AI chat (Claude/ChatGPT/Grok)
 * to interact with the Launchpad MCP. Editable, searchable, keyboard navigable.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Command, Copy, Check, X, Sparkles } from "lucide-react";

const MCP_URL = "https://www.orbitx.world/api/mcp-launchpad";

interface PaletteCommand {
  id: string;
  category: string;
  icon: string;
  title: string;
  prompt: string;
}

const COMMANDS: PaletteCommand[] = [
  {
    id: "launch",
    category: "Launch",
    icon: "🚀",
    title: "Launch a new coin",
    prompt: "Launch a meme coin called [NAME] with symbol [SYMBOL] and this description: [DESCRIPTION]",
  },
  {
    id: "trending",
    category: "Discover",
    icon: "🔥",
    title: "Show trending tokens",
    prompt: "Show me the trending tokens on the OrbitX launchpad",
  },
  {
    id: "new",
    category: "Discover",
    icon: "✨",
    title: "Show newest launches",
    prompt: "Show me the newest token launches on the OrbitX launchpad",
  },
  {
    id: "token-info",
    category: "Discover",
    icon: "🔍",
    title: "Get token details",
    prompt: "Tell me about the token [SYMBOL] on the OrbitX launchpad — price, market cap, and status",
  },
  {
    id: "buy",
    category: "Trade",
    icon: "💰",
    title: "Buy a token",
    prompt: "Buy 0.5 SOL of $[SYMBOL] on the OrbitX launchpad",
  },
  {
    id: "sell-half",
    category: "Trade",
    icon: "📉",
    title: "Sell half my position",
    prompt: "Sell half of my $[SYMBOL] position on the OrbitX launchpad",
  },
  {
    id: "sell-all",
    category: "Trade",
    icon: "💸",
    title: "Sell all",
    prompt: "Sell all of my $[SYMBOL] on the OrbitX launchpad",
  },
  {
    id: "balance",
    category: "Wallet",
    icon: "👛",
    title: "Check wallet balance",
    prompt: "What's my launchpad wallet balance?",
  },
  {
    id: "positions",
    category: "Wallet",
    icon: "📊",
    title: "Show my positions",
    prompt: "Show me all my token positions on the OrbitX launchpad",
  },
];

export default function LaunchpadCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input on open, reset on close
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open ]);

  const filtered = query.trim()
    ? COMMANDS.filter((c) =>
        `${c.title} ${c.prompt} ${c.category}`.toLowerCase().includes(query.trim().toLowerCase())
      )
    : COMMANDS;

  const copyPrompt = useCallback((cmd: PaletteCommand) => {
    navigator.clipboard.writeText(cmd.prompt).catch(() => {});
    setCopiedId(cmd.id);
    setTimeout(() => setCopiedId((v) => (v === cmd.id ? null : v)), 1500);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      copyPrompt(filtered[activeIndex]);
    }
  };

  // Keep active index in range when filtering
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f] shadow-2xl shadow-blue-900/20"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Command className="h-4 w-4 shrink-0 text-blue-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search… (paste into your AI chat)"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Commands */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-white/40">No commands match</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => copyPrompt(cmd)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  i === activeIndex ? "bg-blue-600/20" : "hover:bg-white/5"
                }`}
              >
                <span className="text-xl">{cmd.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-white">{cmd.title}</span>
                  <span className="block truncate font-mono text-xs text-white/40">{cmd.prompt}</span>
                </span>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                  {cmd.category}
                </span>
                {copiedId === cmd.id ? (
                  <Check className="h-4 w-4 shrink-0 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 text-white/30" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-3">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-400" />
          <p className="text-xs text-white/40">
            Copy a prompt, paste it into Claude, ChatGPT, or Grok with the Launchpad MCP connected —{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-blue-300">
              {MCP_URL}
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
