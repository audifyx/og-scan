import { useEffect, useRef, useState } from "react";
import { askCoin, ChatMsg, ChatSource, Forensics, AthData, TokenDetailData } from "../lib/api";
import { Sparkles, Send, Loader2, ExternalLink, Bot } from "lucide-react";
import TokenLogo from "./TokenLogo";

// Build the FULL on-chain context the coin AI reasons over — everything we pull
// from every API (Jupiter, Birdeye, GeckoTerminal, DexScreener, Rugcheck, Helius)
// so the AI can answer almost anything without saying "I don't have that".
function buildContext(d: TokenDetailData, forensics: Forensics | null, ath?: AthData | null) {
  const t: any = d.token || {};
  const meta: any = d.meta || {};
  const intel: any = (d as any).intel || {};
  const safety: any = (d as any).safety || intel.safety || {};
  const flags: any = (d as any).flags || {};
  const score: any = (d as any).score || {};
  const holders: any[] = intel.holders || [];
  const trades: any[] = intel.trades || [];
  const stats: any = t.stats || {};
  return {
    identity: { symbol: t.symbol || meta.symbol, name: t.name || meta.name, mint: d.mint, chain: meta.chain || "solana", verified: t.isVerified, tags: t.tags || [], decimals: t.decimals },
    market: {
      priceUsd: t.priceUsd ?? meta.priceUsd, marketCap: t.mcap ?? meta.mcap, fdv: t.fdv ?? meta.fdv,
      liquidity: t.liquidity, volume24h: t.volume, totalSupply: t.totalSupply ?? intel.totalSupply, circSupply: t.circSupply,
      ath: ath?.athMcap != null ? { athMcap: ath.athMcap, athPrice: ath.athPrice, athDate: ath.athDate, fromAthPct: ath.fromAthPct, source: ath.source } : "coming soon (all-time-high data not available yet)",
      change: { "5m": t.change5m, "1h": t.change1h, "6h": t.change6h, "24h": t.change24h },
      organicScore: t.organicScore, organicLabel: t.organicScoreLabel, verdict: (d as any).verdict, momentum: (d as any).momentumLabel,
    },
    microstructure: {
      buyVolume24h: t.buyVolume ?? meta.buyVolume24h, sellVolume24h: t.sellVolume ?? meta.sellVolume24h,
      numBuys24h: t.numBuys ?? meta.numBuys24h, numSells24h: t.numSells ?? meta.numSells24h,
      numTraders24h: t.numTraders ?? meta.numTraders24h, netBuyers24h: t.netBuyers ?? meta.netBuyers24h,
      holderChange24h: t.holderChange24h, liquidityChange24h: t.liquidityChange24h, volumeChange24h: t.volumeChange24h,
      windows: stats,
    },
    holdersInfo: {
      totalHolders: meta.holderCount ?? t.holderCount ?? safety.totalHolders,
      shownTop: holders.length,
      top10PctApprox: holders.length ? holders.slice(0, 10).reduce((a, h) => a + (h.pct || 0), 0) : null,
      topHoldersPct: t.audit?.topHoldersPercentage,
      whaleCount: intel.whaleCount ?? holders.filter((h) => h.label === "whale").length,
      kolHolderCount: intel.kolHolderCount ?? 0,
      kolHolders: intel.kolHolders || [],
      top25: holders.slice(0, 25).map((h: any) => ({ rank: h.rank, owner: h.owner, pct: h.pct, label: h.label, kol: h.kol?.name || null, publicLabel: h.publicLabel?.name || null })),
    },
    recentTrades: trades.slice(0, 20).map((x: any) => ({ side: x.side, usd: x.volumeUsd, tokenAmount: x.tokenAmount, owner: x.owner, kol: x.kol?.name || null, dex: x.dex, time: x.time, txHash: x.txHash })),
    pairs: ((d as any).pairs || []).map((p: any) => ({ dex: p.dex, liquidity: p.liquidity, volume24h: p.volume24h, change24h: p.change24h, buys: p.txnsBuys, sells: p.txnsSells })),
    audit: t.audit || {},
    security: {
      mintRenounced: safety.mintAuthorityRenounced ?? flags.mintAuthorityDisabled,
      freezeRenounced: safety.freezeAuthorityRenounced ?? flags.freezeAuthorityDisabled,
      lpLockedPct: safety.lpLockedPct, lpPulled: flags.lpPulled, rugged: safety.rugged, riskScore: safety.riskScore,
      risks: (safety.risks || []).slice(0, 8), forensicScores: score.signals || null,
    },
    origin: {
      createdAt: meta.createdAt ?? t.createdAt, ageDays: meta.ageDays ?? t.ageDays,
      launchpad: (() => { const lp = forensics?.launchpad ?? safety.launchpad; return lp && typeof lp === "object" ? (lp as any).name : lp; })(), isPumpFun: forensics?.isPumpFun ?? meta.isPumpFun,
      bondingComplete: forensics?.bondingComplete ?? null,
    },
    forensics: forensics ? {
      dev: forensics.dev, firstBuyer: forensics.firstBuyer, dexPaid: forensics.dexPaid,
      concentration: forensics.concentration, safetyFlags: forensics.safetyFlags,
    } : null,
    socials: meta.socials || {},
  };
}

const SUGGESTIONS = [
  "Why are you trending right now?",
  "Who was the first buyer? Show the transaction.",
  "Did the dev buy and did they sell?",
  "Was DexScreener paid for?",
  "What are people saying about you?",
  "Is this a safe buy? Walk me through the risks.",
];

export default function CoinChat({ d, forensics, ath }: { d: TokenDetailData; forensics: Forensics | null; ath?: AthData | null }) {
  const sym = (d.token as any)?.symbol || (d.meta as any)?.symbol || "this coin";
  const icon = (d.token as any)?.icon || (d.meta as any)?.icon;
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, loading]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next); setInput(""); setLoading(true); setSources([]);
    const attempt = () => askCoin(d.mint, next, buildContext(d, forensics, ath));
    try {
      let r = await attempt().catch(() => null);
      // One silent retry — transient network/edge blips shouldn't surface as errors.
      if (!r || !(r.ok && r.answer)) {
        await new Promise((ok) => setTimeout(ok, 1200));
        r = await attempt().catch(() => null);
      }
      if (r && r.ok && r.answer) {
        setMsgs([...next, { role: "assistant", content: r.answer }]);
        setSources(r.sources || []); setProvider(r.provider || null);
      } else {
        setMsgs([...next, { role: "assistant", content: (r && r.error) || "I'm having trouble reaching my AI backend right now. Give it a few seconds and ask again — your question isn't lost." }]);
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="card overflow-hidden flex flex-col" style={{ minHeight: 460 }}>
      <div className="px-4 py-3 border-b border-line flex items-center gap-2">
        <div className="relative"><TokenLogo src={icon} sym={sym} size={28} /><span className="absolute -bottom-0.5 -right-0.5 grid place-items-center w-3.5 h-3.5 rounded-full bg-accent"><Sparkles className="w-2 h-2 text-black" /></span></div>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">Ask {sym}</div>
          <div className="text-[10px] text-muted">Live AI · on-chain data + web search</div>
        </div>
        <span className="ml-auto pill bg-accent/10 text-accent text-[9px] inline-flex items-center gap-1"><Bot className="w-3 h-3" /> AI</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 520 }}>
        {msgs.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted mb-4">I'm the AI for <span className="text-white font-semibold">{sym}</span>. Ask me anything — I read my own on-chain data and search the web live.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="pill bg-panel2 text-muted hover:text-white hover:bg-panel2/70 text-[11px] text-left">{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-accent text-black font-medium" : "bg-panel2 text-white/90"}`}>{m.content}</div>
          </div>
        ))}
        {loading && <div className="flex justify-start"><div className="bg-panel2 rounded-2xl px-3.5 py-2.5 inline-flex items-center gap-2 text-muted text-sm"><Loader2 className="w-3.5 h-3.5 animate-spin" /> thinking & searching…</div></div>}
        {sources.length > 0 && !loading && (
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1.5">Sources</div>
            <div className="flex flex-col gap-1">
              {sources.map((s, i) => s.url && (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" className="text-[11px] text-accent/80 hover:text-accent inline-flex items-center gap-1 truncate"><ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{s.title || s.url}</span></a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3 flex items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder={`Ask ${sym} anything…`} className="flex-1 bg-panel2 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/50" />
        <button onClick={() => send(input)} disabled={loading || !input.trim()} className="btn bg-accent text-black font-semibold disabled:opacity-40 inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
