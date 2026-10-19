/**
 * OrbitX Launchpad — full UI cloned from orbitxtrade.world style.
 * Dark theme, lime-green accents, orange CTA.
 * Tabs: Board, Launch, Trade, Wallet — all wired to the same desk wallet as the MCP.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type PadTab = "board" | "launch" | "trade" | "wallet";

interface LaunchToken {
  mint: string;
  name: string;
  symbol: string;
  description: string | null;
  image_url: string | null;
  status: string;
  launchpad: string;
  chain: string;
  pool_type: string;
  price_usd: number | null;
  market_cap_usd: number | null;
  graduation_pct: number | null;
  creator_username: string | null;
  created_at: string;
}

const MCP_URL = "https://www.orbitx.world/api/mcp-launchpad";

export default function LaunchpadPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<PadTab>("board");
  const [tokens, setTokens] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Launch form
  const [launchName, setLaunchName] = useState("");
  const [launchSymbol, setLaunchSymbol] = useState("");
  const [launchDesc, setLaunchDesc] = useState("");
  const [launchImage, setLaunchImage] = useState("");
  const [launchpad, setLaunchpad] = useState("pump");
  const [pair, setPair] = useState("sol");
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<string | null>(null);

  // Trade form
  const [tradeMint, setTradeMint] = useState("");
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");

  useEffect(() => {
    (async () => {
      let query = supabase
        .from("launchpad_tokens")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (filter !== "all") query = query.eq("status", filter);
      const { data } = await query;
      setTokens((data || []) as LaunchToken[]);
      setLoading(false);
    })();
  }, [filter]);

  const handleLaunch = async () => {
    if (!launchName || !launchSymbol || launching) return;
    setLaunching(true);
    setLaunchResult(null);
    try {
      // Call via the MCP backend (same as MCP launches)
      const res = await fetch("/api/orbitx-hub/mcp-launchpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "launchpad_launch",
            arguments: {
              name: launchName,
              symbol: launchSymbol,
              description: launchDesc,
              image_url: launchImage,
              launchpad,
              pair,
            },
          },
        }),
      });
      const data = await res.json();
      const result = data.result?.structuredContent || {};
      if (result.ok) {
        setLaunchResult(`Launched! Mint: ${result.mint}`);
        setLaunchName(""); setLaunchSymbol(""); setLaunchDesc(""); setLaunchImage("");
      } else {
        setLaunchResult(`Failed: ${result.message || result.error}`);
      }
    } catch (e) {
      setLaunchResult(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setLaunching(false);
    }
  };

  const fmtUsd = (n: number | null) => {
    if (n == null) return "—";
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 max-w-[1400px] mx-auto w-full">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-lime-400 to-green-600 flex items-center justify-center font-black text-black text-lg">O</div>
              <span className="font-black tracking-tight text-white">ORBITX</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {([
                ["board", "Board"],
                ["launch", "Launch"],
                ["trade", "Trade"],
                ["wallet", "Wallet"],
              ] as [PadTab, string][]).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    tab === id ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}>
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-green-400 font-bold"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> SOLANA</span>
              <span className="flex items-center gap-1 text-green-400 font-bold"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> RH CHAIN</span>
            </div>
            {!user ? (
              <Link to="/auth" className="rounded-full bg-lime-400 px-5 py-2 text-sm font-black text-black hover:bg-lime-300 transition-colors">
                Sign in with X
              </Link>
            ) : (
              <span className="text-sm font-bold text-white/80">Connected</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
      {/* Main */}
      <div className="flex-1 min-w-0">
        <main className="p-4 sm:p-6 max-w-6xl mx-auto pb-24 md:pb-6">
          {/* BOARD */}
          {tab === "board" && (
            <>
              <div className="rounded-2xl bg-gradient-to-br from-lime-400/10 via-transparent to-transparent border border-lime-400/20 p-6 sm:p-8 mb-6">
                <p className="text-[10px] font-black tracking-[0.2em] text-lime-300 mb-2">LAUNCH CONTROL</p>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight">Launch where the tape is already moving.</h2>
                <p className="mt-2 text-white/70">Every launch signs from your in-app desk wallet. No Phantom, no MetaMask.</p>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => setTab("launch")} className="rounded-xl bg-orange-500 px-6 py-3 font-black hover:bg-orange-400">
                    Launch a token
                  </button>
                  <button onClick={() => setTab("trade")} className="rounded-xl border border-white/20 px-6 py-3 font-bold hover:bg-white/5">
                    Trade
                  </button>
                </div>
                <div className="mt-4 flex gap-6 text-sm">
                  <span><span className="font-black">{tokens.length}</span> <span className="text-white/60">Live now</span></span>
                  <span><span className="font-black">{tokens.filter(t => t.status === "graduated").length}</span> <span className="text-white/60">Graduated</span></span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Live tokens</h3>
                <div className="flex gap-2">
                  {["all", "live", "graduated"].map((s) => (
                    <button key={s} onClick={() => { setFilter(s); setLoading(true); }}
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${filter === s ? "bg-lime-400 text-black" : "bg-white/5 text-white/70"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? <p className="text-white/60 py-8 text-center">Loading…</p> :
                tokens.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
                    <p className="font-bold text-white/60">No tokens yet</p>
                    <button onClick={() => setTab("launch")} className="mt-4 rounded-xl bg-orange-500 px-6 py-2 font-bold">Launch the first</button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {tokens.map((t) => (
                      <div key={t.mint} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex items-center gap-4 hover:border-lime-400/20 transition-colors">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-lime-600 to-green-800 flex items-center justify-center font-black shrink-0">
                          {t.image_url ? <img src={t.image_url} alt="" className="h-full w-full object-cover rounded-xl" /> : t.symbol.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold truncate">{t.name}</span>
                            <span className="text-xs font-bold text-lime-300">${t.symbol}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 uppercase">{t.launchpad}</span>
                          </div>
                          <div className="flex gap-4 mt-1 text-xs text-white/60">
                            <span>MCap <span className="text-white/70 font-bold">{fmtUsd(t.market_cap_usd)}</span></span>
                            {t.graduation_pct != null && <span>Grad <span className="text-white/70 font-bold">{t.graduation_pct.toFixed(0)}%</span></span>}
                            {t.creator_username && <span>by {t.creator_username}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <a href={`https://dexscreener.com/solana/${t.mint}`} target="_blank" rel="noreferrer"
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/5">Chart</a>
                          <button onClick={() => { setTradeMint(t.mint); setTab("trade"); }}
                            className="rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-black text-black hover:bg-lime-300">Buy</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </>
          )}

          {/* LAUNCH */}
          {tab === "launch" && (
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black mb-1">Launch a token</h2>
              <p className="text-white/70 text-sm mb-6">Same wallet as MCP launches. Pick a launchpad and pair.</p>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {(["pump", "stonk", "pons"] as const).map((lp) => (
                    <button key={lp} onClick={() => setLaunchpad(lp)}
                      className={`rounded-xl border p-3 text-left ${launchpad === lp ? "border-lime-400 bg-lime-400/10" : "border-white/10 hover:border-white/20"}`}>
                      <p className="font-black uppercase text-sm">{lp}</p>
                      <p className="text-[10px] text-white/60 mt-1">{lp === "pump" ? "Solana" : lp === "stonk" ? "Solana stocks" : "Robinhood"}</p>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(launchpad === "pons" ? ["eth", "usdc"] : ["sol", "usdc"]).map((p) => (
                    <button key={p} onClick={() => setPair(p)}
                      className={`rounded-xl border p-3 font-bold uppercase text-sm ${pair === p ? "border-orange-500 bg-orange-500/10 text-orange-300" : "border-white/10 text-white/60"}`}>
                      {p}
                    </button>
                  ))}
                </div>

                <input value={launchName} onChange={(e) => setLaunchName(e.target.value)} placeholder="Token name"
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/50" />
                <input value={launchSymbol} onChange={(e) => setLaunchSymbol(e.target.value)} placeholder="Symbol (e.g. MOON)"
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/50" />
                <textarea value={launchDesc} onChange={(e) => setLaunchDesc(e.target.value)} placeholder="Description" rows={2}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/50" />
                <input value={launchImage} onChange={(e) => setLaunchImage(e.target.value)} placeholder="Image URL"
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/50" />

                <button onClick={handleLaunch} disabled={launching || !launchName || !launchSymbol}
                  className="w-full rounded-xl bg-orange-500 py-4 font-black text-lg hover:bg-orange-400 disabled:opacity-40">
                  {launching ? "Launching…" : `Launch on ${launchpad} (${pair.toUpperCase()})`}
                </button>

                <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white/70">
                  <p className="font-bold text-white/70">⛽ Gas fees</p>
                  <p className="mt-1">Each launch costs ~$0.60-1.00 in gas. Make sure your desk wallet has at least <span className="font-bold text-white">$1</span> ($4 recommended for multiple launches).</p>
                </div>

                {launchResult && (
                  <p className={`text-sm rounded-xl p-3 ${launchResult.startsWith("Launched") ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                    {launchResult}
                  </p>
                )}

                <p className="text-xs text-white/70 text-center">
                  Or launch via AI: <code className="text-lime-300">"{`launch ${launchName || "a coin"} on ${launchpad}`}"</code> in Grok/Claude/ChatGPT
                </p>
              </div>
            </div>
          )}

          {/* TRADE */}
          {tab === "trade" && (
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-black mb-1">Trade</h2>
              <p className="text-white/70 text-sm mb-6">Swap from the desk. Same wallet as MCP.</p>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {(["buy", "sell"] as const).map((s) => (
                    <button key={s} onClick={() => setTradeSide(s)}
                      className={`rounded-xl py-3 font-black uppercase ${tradeSide === s ? (s === "buy" ? "bg-lime-400 text-black" : "bg-red-500 text-white") : "bg-white/5 text-white/70"}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <input value={tradeMint} onChange={(e) => setTradeMint(e.target.value)} placeholder="Token mint address"
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 font-mono text-sm outline-none focus:border-lime-400/50" />
                <input value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} placeholder={tradeSide === "buy" ? "Amount in SOL" : "Amount of tokens"}
                  type="number" className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 outline-none focus:border-lime-400/50" />
                <button className={`w-full rounded-xl py-4 font-black text-lg ${tradeSide === "buy" ? "bg-lime-400 text-black hover:bg-lime-300" : "bg-red-500 hover:bg-red-400"}`}>
                  {tradeSide === "buy" ? "Buy" : "Sell"}
                </button>
                <p className="text-xs text-white/70 text-center">Jupiter routing · desk wallet signs</p>
              </div>
            </div>
          )}

          {/* WALLET */}
          {tab === "wallet" && (
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black mb-1">Wallet</h2>
              <p className="text-white/70 text-sm mb-6">Your desk — same wallet the MCP uses.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Solana</p>
                  <p className="mt-2 font-mono text-sm text-white/60">Desk wallet</p>
                  <p className="mt-1 text-white/70 text-xs">Used for pump.fun + StonkFun launches</p>
                  <Link to="/supercomputer?tab=wallet" className="mt-4 inline-block rounded-xl bg-lime-400 px-4 py-2 text-sm font-black text-black">Manage</Link>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Robinhood Chain</p>
                  <p className="mt-2 font-mono text-sm text-white/60">EVM wallet</p>
                  <p className="mt-1 text-white/70 text-xs">Used for Pons V2 launches</p>
                  <Link to="/supercomputer?tab=wallet" className="mt-4 inline-block rounded-xl bg-lime-400 px-4 py-2 text-sm font-black text-black">Manage</Link>
                </div>
              </div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <h3 className="font-bold mb-2">MCP Connection</h3>
                <p className="text-sm text-white/70">Launch via AI with the same wallet:</p>
                <code className="mt-2 block rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-xs text-lime-300 break-all">{MCP_URL}</code>
                <a href="/supercomputer?tab=launchpad" className="mt-3 inline-block text-sm text-lime-300 hover:underline">Connection settings →</a>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── iOS-style glass tab bar (mobile) ── */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-50">
        <div className="mx-auto max-w-sm rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl px-2 py-2 flex justify-around">
          {([
            ["board", "Board", "▦"],
            ["launch", "Launch", "🚀"],
            ["trade", "Trade", "⇄"],
            ["wallet", "Wallet", "◈"],
          ] as [PadTab, string, string][]).map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-full transition-all ${
                tab === id ? "bg-lime-400/20 text-lime-300" : "text-white/70"
              }`}>
              <span className="text-lg">{icon}</span>
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── iOS-style glass tab bar (desktop, centered) ── */}
      <div className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl px-3 py-2 flex gap-1">
          {([
            ["board", "Board", "▦"],
            ["launch", "Launch", "🚀"],
            ["trade", "Trade", "⇄"],
            ["wallet", "Wallet", "◈"],
          ] as [PadTab, string, string][]).map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                tab === id ? "bg-lime-400 text-black shadow-lg" : "text-white/60 hover:text-white hover:bg-white/10"
              }`}>
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      </div>{/* close flex */}

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 bg-black/60 mt-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-lime-400 to-green-600 flex items-center justify-center font-black text-black">O</div>
                <span className="font-black text-white">ORBITX PAD</span>
              </div>
              <p className="text-sm text-white/70">Launch tokens on Solana and Robinhood Chain. Via web or AI.</p>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white/60 mb-3">Pad</p>
              <div className="space-y-2 text-sm">
                <button onClick={() => setTab("board")} className="block text-white/60 hover:text-white">Board</button>
                <button onClick={() => setTab("launch")} className="block text-white/60 hover:text-white">Launch</button>
                <button onClick={() => setTab("trade")} className="block text-white/60 hover:text-white">Trade</button>
                <button onClick={() => setTab("wallet")} className="block text-white/60 hover:text-white">Wallet</button>
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white/60 mb-3">Launchpads</p>
              <div className="space-y-2 text-sm text-white/60">
                <p>pump.fun <span className="text-white/70">— Solana</span></p>
                <p>StonkFun <span className="text-white/70">— Solana stocks</span></p>
                <p>Pons V2 <span className="text-white/70">— Robinhood Chain</span></p>
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white/60 mb-3">MCP</p>
              <p className="text-sm text-white/60 mb-2">Launch via AI:</p>
              <code className="block rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-[10px] text-lime-300 break-all">{MCP_URL}</code>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between text-xs text-white/70">
            <span>© 2026 OrbitX</span>
            <span>Solana + Robinhood Chain</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
