/**
 * OrbitX Launchpad — dark luxury design.
 * Near-black, gold accent, compact iOS-style. Matches approved mockup.
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

const GOLD = "#e8b84a";

const TABS: { id: PadTab; label: string; icon: JSX.Element }[] = [
  {
    id: "board",
    label: "Board",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "launch",
    label: "Launch",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    ),
  },
  {
    id: "trade",
    label: "Trade",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m17 3 4 4-4 4" /><path d="M21 7H9" /><path d="m7 21-4-4 4-4" /><path d="M3 17h12" />
      </svg>
    ),
  },
  {
    id: "wallet",
    label: "Wallet",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    ),
  },
];

export default function LaunchpadPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<PadTab>("board");
  const [tokens, setTokens] = useState<LaunchToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const [launchName, setLaunchName] = useState("");
  const [launchSymbol, setLaunchSymbol] = useState("");
  const [launchDesc, setLaunchDesc] = useState("");
  const [launchImage, setLaunchImage] = useState("");
  const [launchpad, setLaunchpad] = useState("pump");
  const [pair, setPair] = useState("sol");
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<string | null>(null);

  const [tradeMint, setTradeMint] = useState("");
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [selectedToken, setSelectedToken] = useState<LaunchToken | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [slippage, setSlippage] = useState(500);
  const [showJito, setShowJito] = useState(false);

  useEffect(() => {
    (async () => {
      let query = supabase.from("launchpad_tokens").select("*").order("created_at", { ascending: false }).limit(50);
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
      const res = await fetch("/api/orbitx-hub/mcp-launchpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "tools/call",
          params: { name: "launchpad_launch", arguments: { name: launchName, symbol: launchSymbol, description: launchDesc, image_url: launchImage, launchpad, pair } },
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

  const openTokenDetail = async (t: LaunchToken) => {
    setSelectedToken(t);
    setDetailData(null);
    try {
      const res = await fetch("/api/orbitx-hub/mcp-launchpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "tools/call",
          params: { name: "launchpad_token", arguments: { mint: t.mint } },
        }),
      });
      const data = await res.json();
      setDetailData(data.result?.structuredContent || null);
    } catch {}
  };

  const fmtUsd = (n: number | null) => {
    if (n == null) return "—";
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  const inputCls =
    "w-full rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 text-[15px] text-white placeholder-white/40 outline-none focus:border-[#e8b84a]/50 transition-colors";

  return (
    <div className="min-h-screen bg-[#050508] text-white flex flex-col" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}>
      {/* ── Compact header ── */}
      <header className="sticky top-0 z-40 bg-[#050508]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-5 py-3 max-w-lg mx-auto w-full">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full flex items-center justify-center font-black text-black text-sm"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #b8860b)` }}>O</div>
            <span className="font-bold text-[17px] tracking-tight">OrbitX</span>
          </Link>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-full text-white/70 hover:bg-white/10" aria-label="Search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </button>
            <button className="p-2 rounded-full text-white/70 hover:bg-white/10" aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            </button>
            {!user ? (
              <Link to="/auth" className="ml-1 rounded-full px-4 py-1.5 text-[13px] font-bold text-black"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #d4a017)` }}>Sign in</Link>
            ) : (
              <div className="ml-1 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-[13px] font-bold" style={{ color: GOLD }}>
                {(user.email || "O")[0].toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto px-5 pb-32">
        {/* BOARD */}
        {tab === "board" && (
          <>
            {/* Hero */}
            <div className="mt-4 rounded-[28px] p-5 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #101018 0%, #0a0a12 100%)", border: "1px solid rgba(232,184,74,0.15)" }}>
              <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${GOLD}22 0%, transparent 70%)` }} />
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: GOLD }}>Launchpad</p>
              <h1 className="mt-1 text-[24px] font-bold tracking-tight leading-tight">Launch where the tape moves.</h1>
              <p className="mt-1 text-[13px] text-white/60">Tokens on Solana + Robinhood Chain. Desk wallet signs.</p>
              <button onClick={() => setTab("launch")}
                className="mt-4 rounded-full px-5 py-2.5 text-[14px] font-bold text-black"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #d4a017)` }}>
                Create Token
              </button>
              <div className="mt-4 flex gap-5 text-[13px]">
                <span><span className="font-bold text-white">{tokens.length}</span> <span className="text-white/50">Live</span></span>
                <span><span className="font-bold text-white">{tokens.filter(t => t.status === "graduated").length}</span> <span className="text-white/50">Graduated</span></span>
              </div>
            </div>

            {/* Filter pills */}
            <div className="mt-5 flex gap-2">
              {["all", "live", "graduated"].map((s) => (
                <button key={s} onClick={() => { setFilter(s); setLoading(true); }}
                  className="rounded-full px-4 py-1.5 text-[13px] font-semibold capitalize transition-all"
                  style={filter === s
                    ? { background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }
                    : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid transparent" }}>
                  {s}
                </button>
              ))}
            </div>

            {/* Token list */}
            <div className="mt-3 space-y-2.5">
              {loading ? (
                <p className="text-white/50 text-[14px] py-10 text-center">Loading…</p>
              ) : tokens.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/10 p-10 text-center">
                  <p className="text-[14px] font-semibold text-white/70">No tokens yet</p>
                  <button onClick={() => setTab("launch")}
                    className="mt-3 rounded-full px-5 py-2 text-[13px] font-bold text-black"
                    style={{ background: `linear-gradient(135deg, ${GOLD}, #d4a017)` }}>
                    Launch the first
                  </button>
                </div>
              ) : tokens.map((t) => (
                <button key={t.mint} onClick={() => openTokenDetail(t)}
                  className="w-full rounded-[20px] bg-[#0f0f14] border border-white/[0.06] p-3.5 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1a1a24] to-[#0a0a10] border border-white/10 flex items-center justify-center font-bold text-[15px] shrink-0 overflow-hidden" style={{ color: GOLD }}>
                    {t.image_url ? <img src={t.image_url} alt="" className="h-full w-full object-cover" /> : t.symbol.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[15px] font-semibold truncate">{t.name}</span>
                      <span className="text-[12px] text-white/45 font-medium">${t.symbol}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-white/45">
                      <span>MCap <span className="text-white/75 font-semibold">{fmtUsd(t.market_cap_usd)}</span></span>
                      <span className="px-1.5 py-px rounded-md bg-white/[0.07] uppercase text-[10px] font-semibold">{t.launchpad}</span>
                    </div>
                    {t.graduation_pct != null && t.graduation_pct > 0 && (
                      <div className="mt-1.5 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, t.graduation_pct)}%`, background: GOLD }} />
                      </div>
                    )}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setTradeMint(t.mint); setTab("trade"); }}
                    className="rounded-full px-4 py-1.5 text-[13px] font-bold shrink-0"
                    style={{ background: `${GOLD}1e`, color: GOLD, border: `1px solid ${GOLD}33` }}>
                    Buy
                  </button>
                </button>
              ))}
            </div>

            {/* Token detail sheet */}
            {selectedToken && (
              <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setSelectedToken(null)}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                <div className="relative w-full max-w-lg rounded-t-[28px] bg-[#0c0c12] border-t border-white/10 p-5 pb-10 max-h-[85vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}>
                  <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-white/5 flex items-center justify-center font-bold" style={{ color: GOLD }}>
                      {selectedToken.image_url ? <img src={selectedToken.image_url} className="h-full w-full object-cover" /> : selectedToken.symbol.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-[17px] font-bold">{selectedToken.name}</p>
                      <p className="text-[13px] text-white/50">${selectedToken.symbol} · {selectedToken.launchpad}</p>
                    </div>
                    <button onClick={() => setSelectedToken(null)} className="p-2 rounded-full bg-white/10 text-white/70">✕</button>
                  </div>
                  {detailData ? (
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="text-[11px] text-white/50 uppercase">Price</p>
                          <p className="text-[16px] font-bold">${detailData.price_usd?.toFixed(6) || "—"}</p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="text-[11px] text-white/50 uppercase">MCap</p>
                          <p className="text-[16px] font-bold">{fmtUsd(detailData.market_cap)}</p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="text-[11px] text-white/50 uppercase">24h</p>
                          <p className="text-[16px] font-bold" style={{ color: (detailData.change_24h || 0) >= 0 ? "#4ade80" : "#f87171" }}>
                            {(detailData.change_24h || 0).toFixed(1)}%
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="text-[11px] text-white/50 uppercase">Liquidity</p>
                          <p className="text-[16px] font-bold">{fmtUsd(detailData.liquidity_usd)}</p>
                        </div>
                      </div>
                      {detailData.bonding_curve && (
                        <div className="rounded-2xl bg-white/[0.04] p-4">
                          <p className="text-[12px] text-white/60 mb-2">Bonding curve {detailData.bonding_curve.graduation_pct?.toFixed(0)}%</p>
                          <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, detailData.bonding_curve.graduation_pct || 0)}%`, background: GOLD }} />
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <a href={detailData.dex_screener_url} target="_blank" rel="noreferrer"
                          className="flex-1 text-center rounded-full py-3 text-[14px] font-bold text-black"
                          style={{ background: `linear-gradient(135deg, ${GOLD}, #d4a017)` }}>Chart</a>
                        <button onClick={() => { setTradeMint(selectedToken.mint); setSelectedToken(null); setTab("trade"); }}
                          className="flex-1 rounded-full py-3 text-[14px] font-bold"
                          style={{ background: `${GOLD}1e`, color: GOLD, border: `1px solid ${GOLD}33` }}>Trade</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-white/50 py-8 text-[14px]">Loading…</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* LAUNCH */}
        {tab === "launch" && (
          <div className="mt-4">
            <h1 className="text-[24px] font-bold tracking-tight">Launch a token</h1>
            <p className="mt-1 text-[13px] text-white/60">Same wallet as MCP launches.</p>

            <div className="mt-4 rounded-[28px] bg-[#0c0c12] border border-white/[0.07] p-5 space-y-3.5">
              <div className="grid grid-cols-3 gap-2">
                {(["pump", "stonk", "pons"] as const).map((lp) => (
                  <button key={lp} onClick={() => setLaunchpad(lp)}
                    className="rounded-2xl p-3 text-left transition-all"
                    style={launchpad === lp
                      ? { border: `1.5px solid ${GOLD}`, background: `${GOLD}0f` }
                      : { border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                    <p className="font-bold uppercase text-[13px]">{lp}</p>
                    <p className="text-[11px] text-white/50 mt-0.5">{lp === "pump" ? "Solana" : lp === "stonk" ? "Stocks" : "Robinhood"}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(launchpad === "pons" ? ["eth", "usdc"] : ["sol", "usdc"]).map((p) => (
                  <button key={p} onClick={() => setPair(p)}
                    className="rounded-2xl py-2.5 font-bold uppercase text-[13px] transition-all"
                    style={pair === p
                      ? { background: `${GOLD}`, color: "#000" }
                      : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}>
                    {p}
                  </button>
                ))}
              </div>

              <input value={launchName} onChange={(e) => setLaunchName(e.target.value)} placeholder="Token name" className={inputCls} />
              <input value={launchSymbol} onChange={(e) => setLaunchSymbol(e.target.value)} placeholder="Symbol" className={inputCls} />
              <textarea value={launchDesc} onChange={(e) => setLaunchDesc(e.target.value)} placeholder="Description" rows={2} className={inputCls} />
              <input value={launchImage} onChange={(e) => setLaunchImage(e.target.value)} placeholder="Image URL" className={inputCls} />

              <button onClick={() => setShowJito(!showJito)}
                className="w-full rounded-2xl p-3.5 flex items-center justify-between transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                <div className="text-left">
                  <p className="text-[14px] font-bold">⚡ Jito Bundle</p>
                  <p className="text-[12px] text-white/50">Atomic launch — anti-sniper</p>
                </div>
                <div className="w-11 h-6 rounded-full p-0.5 transition-colors" style={{ background: showJito ? GOLD : "rgba(255,255,255,0.15)" }}>
                  <div className="h-5 w-5 rounded-full bg-white transition-transform" style={{ transform: showJito ? "translateX(20px)" : "translateX(0)" }} />
                </div>
              </button>

              <button onClick={handleLaunch} disabled={launching || !launchName || !launchSymbol}
                className="w-full rounded-full py-3.5 font-bold text-[15px] text-black disabled:opacity-40 transition-opacity"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #d4a017)` }}>
                {launching ? "Launching…" : `Launch on ${launchpad}`}
              </button>

              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-3 text-[12px] text-white/60">
                <span className="font-semibold text-white/80">⛽ Gas</span> — ~$1 per launch. Keep $4 in your desk for multiple.
              </div>

              {launchResult && (
                <p className="text-[13px] rounded-2xl p-3"
                  style={launchResult.startsWith("Launched")
                    ? { background: "rgba(74,222,128,0.1)", color: "#4ade80" }
                    : { background: "rgba(248,113,113,0.1)", color: "#f87171" }}>
                  {launchResult}
                </p>
              )}
            </div>
          </div>
        )}

        {/* TRADE */}
        {tab === "trade" && (
          <div className="mt-4">
            <h1 className="text-[24px] font-bold tracking-tight">Trade</h1>
            <p className="mt-1 text-[13px] text-white/60">Desk wallet signs. Same as MCP.</p>
            <div className="mt-4 rounded-[28px] bg-[#0c0c12] border border-white/[0.07] p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-white/[0.04]">
                {(["buy", "sell"] as const).map((s) => (
                  <button key={s} onClick={() => setTradeSide(s)}
                    className="rounded-full py-2.5 font-bold uppercase text-[13px] transition-all"
                    style={tradeSide === s
                      ? s === "buy" ? { background: GOLD, color: "#000" } : { background: "#f87171", color: "#fff" }
                      : { color: "rgba(255,255,255,0.5)" }}>
                    {s}
                  </button>
                ))}
              </div>
              <input value={tradeMint} onChange={(e) => setTradeMint(e.target.value)} placeholder="Token mint" className={`${inputCls} font-mono !text-[13px]`} />
              <div className="flex gap-2">
                {[0.1, 0.5, 1, 5].map((amt) => (
                  <button key={amt} onClick={() => setTradeAmount(String(amt))}
                    className="flex-1 rounded-full py-2 text-[13px] font-bold transition-all"
                    style={tradeAmount === String(amt)
                      ? { background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }
                      : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}>
                    {amt} SOL
                  </button>
                ))}
              </div>
              <input value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} placeholder="Custom amount" type="number" className={inputCls} />
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-white/60">Slippage</span>
                <div className="flex gap-1.5">
                  {[100, 500, 1000].map((s) => (
                    <button key={s} onClick={() => setSlippage(s)}
                      className="rounded-full px-3 py-1 text-[12px] font-bold"
                      style={slippage === s ? { background: GOLD, color: "#000" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}>
                      {s / 100}%
                    </button>
                  ))}
                </div>
              </div>
              <button className="w-full rounded-full py-3.5 font-bold text-[15px] text-black"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #d4a017)` }}>
                {tradeSide === "buy" ? "Buy" : "Sell"}
              </button>
              <p className="text-[12px] text-white/45 text-center">Jupiter routing · instant</p>
            </div>
          </div>
        )}

        {/* WALLET */}
        {tab === "wallet" && (
          <div className="mt-4">
            <h1 className="text-[24px] font-bold tracking-tight">Wallet</h1>
            <p className="mt-1 text-[13px] text-white/60">Your desk — same wallet the MCP uses.</p>
            <div className="mt-4 space-y-2.5">
              {[
                { chain: "Solana", desc: "pump.fun + StonkFun", icon: "◎" },
                { chain: "Robinhood Chain", desc: "Pons V2", icon: "⬡" },
              ].map((w) => (
                <div key={w.chain} className="rounded-[20px] bg-[#0f0f14] border border-white/[0.06] p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-[18px] shrink-0"
                    style={{ background: `${GOLD}14`, color: GOLD }}>{w.icon}</div>
                  <div className="flex-1">
                    <p className="text-[15px] font-semibold">{w.chain}</p>
                    <p className="text-[12px] text-white/50">{w.desc}</p>
                  </div>
                  <Link to="/supercomputer?tab=wallet" className="rounded-full px-4 py-1.5 text-[13px] font-bold"
                    style={{ background: `${GOLD}1e`, color: GOLD }}>Manage</Link>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-[20px] bg-[#0f0f14] border border-white/[0.06] p-4">
              <p className="text-[14px] font-semibold">Launch via AI</p>
              <code className="mt-2 block rounded-xl bg-black/50 border border-white/[0.07] px-3 py-2.5 text-[11px] break-all" style={{ color: GOLD }}>
                https://www.orbitx.world/api/mcp-launchpad
              </code>
            </div>
          </div>
        )}
      </main>

      {/* ── Centered glass tab bar ── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[340px] px-5">
        <div className="rounded-full px-3 py-2 flex justify-around"
          style={{
            background: "rgba(15,15,22,0.72)",
            backdropFilter: "blur(24px) saturate(1.4)",
            WebkitBackdropFilter: "blur(24px) saturate(1.4)",
            border: `1px solid ${GOLD}30`,
            boxShadow: "0 12px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-full transition-all min-w-[64px]">
                <span style={{ color: active ? GOLD : "rgba(255,255,255,0.45)" }}>{t.icon}</span>
                <span className="text-[10px] font-semibold" style={{ color: active ? GOLD : "rgba(255,255,255,0.45)" }}>
                  {t.label}
                </span>
                <span className="h-1 w-1 rounded-full transition-all"
                  style={{ background: GOLD, opacity: active ? 1 : 0, boxShadow: active ? `0 0 8px ${GOLD}` : "none" }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
