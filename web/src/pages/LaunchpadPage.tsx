/**
 * LaunchpadPage — OrbitX Launchpad home.
 * MCP-only token launchpad. Instructions for connecting,
 * live feed of launched tokens.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface LaunchToken {
  mint: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  status: string;
  price_usd: number | null;
  market_cap_usd: number | null;
  creator_username: string | null;
  created_at: string;
}

const MCP_URL = "https://www.orbitx.world/api/mcp-launchpad";

export default function LaunchpadPage() {
  const [tokens, setTokens] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      let query = supabase
        .from("launchpad_tokens")
        .select("mint,name,symbol,description,image_url,status,price_usd,market_cap_usd,creator_username,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (filter !== "all") query = query.eq("status", filter);
      const { data } = await query;
      setTokens((data || []) as LaunchToken[]);
      setLoading(false);
    })();
  }, [filter]);

  const copyMcpUrl = () => {
    navigator.clipboard.writeText(MCP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtUsd = (n: number | null) => {
    if (n == null) return "—";
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-purple-900/20 to-black" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[600px] rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-bold text-blue-300 mb-6">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            MCP-POWERED LAUNCHPAD
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight">
            Launch tokens
            <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              from your AI chat
            </span>
          </h1>
          <p className="mt-4 text-lg text-white/60 max-w-xl mx-auto">
            No forms. No signing popups. Tell your AI to launch a coin and it happens —
            powered by your OrbitX desk wallet in the background.
          </p>

          {/* MCP URL */}
          <div className="mt-8 mx-auto max-w-lg">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 pl-4">
              <code className="flex-1 truncate text-sm text-blue-300">{MCP_URL}</code>
              <button
                onClick={copyMcpUrl}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-16">
        {/* How to connect */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-xl font-bold">Connect in 30 seconds</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/5 p-5">
              <div className="text-2xl mb-2">1️⃣</div>
              <h3 className="font-bold">Get your code</h3>
              <p className="mt-1 text-sm text-white/50">
                Visit <Link to="/agent" className="text-blue-400 hover:underline">orbitx.world/agent</Link> and
                grab your MCP auth code.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-5">
              <div className="text-2xl mb-2">2️⃣</div>
              <h3 className="font-bold">Add the MCP</h3>
              <p className="mt-1 text-sm text-white/50">
                In Grok, Claude, or ChatGPT, add this MCP server URL and paste your code when asked.
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-5">
              <div className="text-2xl mb-2">3️⃣</div>
              <h3 className="font-bold">Launch</h3>
              <p className="mt-1 text-sm text-white/50">
                Say "launch a coin called Moon Dog with symbol MOON" — your desk wallet handles the rest.
              </p>
            </div>
          </div>

          {/* Example prompts */}
          <div className="mt-6">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest">Try saying</h3>
            <div className="mt-3 space-y-2">
              {[
                '"Launch a meme coin called Diamond Hands with symbol DIAMOND"',
                '"Show me trending tokens on the launchpad"',
                '"Buy 0.5 SOL of $MOON"',
                '"What\'s my launchpad wallet balance?"',
              ].map((prompt, i) => (
                <div key={i} className="rounded-xl bg-black/40 border border-white/5 px-4 py-3 text-sm text-white/70 font-mono">
                  {prompt}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live feed */}
        <div className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Live launches</h2>
            <div className="flex gap-2">
              {["all", "live", "trending", "graduated"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setFilter(s); setLoading(true); }}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    filter === s
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="mt-6 text-center text-white/40 py-12">Loading tokens…</div>
          ) : tokens.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/10 p-12 text-center">
              <p className="text-xl font-bold text-white/60">No tokens yet</p>
              <p className="mt-2 text-sm text-white/40">Be the first to launch via the MCP</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {tokens.map((t) => (
                <a
                  key={t.mint}
                  href={`https://dexscreener.com/solana/${t.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-blue-500/30 hover:bg-white/[0.05] transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-blue-800 to-purple-800">
                      {t.image_url ? (
                        <img src={t.image_url} alt={t.symbol} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-black text-white/60">
                          {t.symbol.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold truncate">{t.name}</h3>
                        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                          ${t.symbol}
                        </span>
                      </div>
                      {t.description && (
                        <p className="mt-1 text-xs text-white/40 line-clamp-2">{t.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                        <span>MCap <span className="font-bold text-white/70">{fmtUsd(t.market_cap_usd)}</span></span>
                        {t.creator_username && <span>by {t.creator_username}</span>}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
