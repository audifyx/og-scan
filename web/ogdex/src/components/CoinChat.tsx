import { useEffect, useRef, useState } from "react";
import { askCoin, ChatMsg, ChatSource, Forensics, TokenDetailData } from "../lib/api";
import { Sparkles, Send, Loader2, ExternalLink, Bot } from "lucide-react";
import TokenLogo from "./TokenLogo";

// Build the compact on-chain context the coin AI reasons over.
function buildContext(d: TokenDetailData, forensics: Forensics | null) {
  const t: any = d.token || {};
  const meta: any = d.meta || {};
  const intel: any = (d as any).intel || {};
  const safety: any = (d as any).safety || intel.safety || {};
  return {
    symbol: t.symbol || meta.symbol, name: t.name || meta.name, mint: d.mint,
    price: t.priceUsd ?? meta.priceUsd, marketCap: t.mcap ?? meta.mcap, fdv: t.fdv ?? meta.fdv,
    liquidity: t.liquidity, volume24h: t.volume,
    holders: meta.holderCount ?? t.holderCount ?? safety.totalHolders,
    change: { "5m": t.change5m, "1h": t.change1h, "6h": t.change6h, "24h": t.change24h },
    athMcap: (d as any).athMcap, athPrice: (d as any).athPrice,
    ageDays: meta.ageDays ?? t.ageDays, createdAt: meta.createdAt ?? t.createdAt,
    organicScore: t.organicScore, verified: t.isVerified, tags: t.tags || [],
    audit: t.audit || {}, socials: meta.socials || {}, verdict: (d as any).verdict,
    safety: {
      mintRenounced: safety.mintAuthorityRenounced, freezeRenounced: safety.freezeAuthorityRenounced,
      lpLockedPct: safety.lpLockedPct, rugged: safety.rugged, riskScore: safety.riskScore,
      creator: safety.creator, creatorTokens: safety.creatorTokensCount,
    },
    topHolders: (intel.holders || []).slice(0, 12).map((h: any) => ({ rank: h.rank, owner: h.owner, pct: h.pct, label: h.label })),
    forensics: forensics || null,
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

export default function CoinChat({ d, forensics }: { d: TokenDetailData; forensics: Forensics | null }) {
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
    try {
      const r = await askCoin(d.mint, next, buildContext(d, forensics));
      if (r.ok && r.answer) {
        setMsgs([...next, { role: "assistant", content: r.answer }]);
        setSources(r.sources || []); setProvider(r.provider || null);
      } else {
        setMsgs([...next, { role: "assistant", content: r.error || "I couldn't reach my brain just now — try again in a moment." }]);
      }
    } catch {
      setMsgs([...next, { role: "assistant", content: "Network hiccup — try again." }]);
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
