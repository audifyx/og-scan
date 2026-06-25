import { useState } from "react";
import { Code2, Copy, Check, Terminal, Link2, ExternalLink, ChevronDown, Sparkles, Bot } from "lucide-react";

const BASE = "https://ogscan.fun/api/ogdex";
const OPENAPI = "https://ogscan.fun/api/ogdex/openapi.json";
const LLMS = "https://ogscan.fun/api/ogdex/llms.txt";

const ENDPOINTS = [
  { m: "GET", path: "/screener?type=trending&chain=solana&limit=100", desc: "Token screener. type: trending|runners|new|fomo|jupiter|unbonded|migrated|moonshot|newpairs|og|kols|celebrity|organic|listed|multichain|social." },
  { m: "GET", path: "/signals", desc: "Live Pulse signals — volume/velocity/buyer surges, momentum, fresh runners, pump.fun graduating + just-migrated." },
  { m: "GET", path: "/token?mint=<MINT>", desc: "Full token intel: price, mcap, liquidity, OG Score, verdict, flags, safety, holders, trades, KOL/whale labels." },
  { m: "GET", path: "/forensics?mint=<MINT>", desc: "Dev & origin: creator wallet, dev sold?, first buyer (wallet + tx), DexScreener-paid status, concentration." },
  { m: "GET", path: "/xray?mint=<MINT>", desc: "Risk X-ray: snipers, same-block bundlers, early buyers, concentration, dev + safety merged into a green/yellow/red verdict." },
  { m: "GET", path: "/safety?mint=<MINT>", desc: "Honeypot / tradeability — Jupiter round-trip: canBuy, canSell, round-trip loss %, verdict." },
  { m: "GET", path: "/swaps?address=<ADDR>&limit=25", desc: "A wallet's recent buy/sell swaps with token metadata + USD." },
  { m: "GET", path: "/balance?owner=<ADDR>&mint=<MINT>", desc: "SOL + a single token balance for a wallet." },
  { m: "POST", path: "/alerts", desc: "Create a price alert (notify-only). Body: { wallet, alert:{ mint, type, value, channel, target } }. GET ?wallet=<ADDR> to list." },
  { m: "GET", path: "/ath?mint=<MINT>", desc: "True all-time high — ATH price, ATH market cap, date, % from ATH." },
  { m: "GET", path: "/chart?mint=<MINT>", desc: "OHLC candles for charting." },
  { m: "GET", path: "/wallet?address=<ADDR>", desc: "Wallet portfolio: SOL + SPL holdings, USD values, realized + unrealized PnL, win rate." },
  { m: "GET", path: "/kols", desc: "Tracked KOL / smart-money directory. Add ?feed=1 for activity, ?token=<MINT> to filter." },
  { m: "GET", path: "/search?q=<QUERY>", desc: "Search tokens by name, ticker, or mint." },
  { m: "GET", path: "/listings?featured=1", desc: "Featured / boosted listings from the Store." },
  { m: "GET", path: "/launches?limit=50", desc: "Tokens launched through the OG DEX launcher." },
  { m: "GET", path: "/metadata?mint=<MINT>", desc: "On-chain metadata + update authority + mutability." },
  { m: "POST", path: "/chat", desc: "Chat with the AI for a coin — answers from live on-chain data + web search. Body: { mint, messages:[{role,content}] }." },
];

export default function ApiDocs() {
  const [copied, setCopied] = useState("");
  const [showAll, setShowAll] = useState(false);
  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(""), 1200); };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-accent/20 bg-accent/10"><Code2 className="h-7 w-7 text-accent" /></div>
        <h1 className="text-2xl font-black tracking-tight">OG DEX Public API</h1>
        <p className="mt-2 text-sm text-muted">All of OG DEX, free over HTTPS. No key required. One link plugs the whole tool into ChatGPT, Claude, Postman, or your app — no copy-pasting endpoints.</p>
      </div>

      {/* ONE LINK */}
      <div className="card mb-4 p-5 ring-brand border border-accent/30">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Link2 className="h-4 w-4 text-accent" /> One link — connect the entire tool</div>
        <p className="text-[12.5px] text-muted mb-3">Paste this single OpenAPI link and every endpoint is imported at once — no manual setup.</p>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-panel2/60 px-3 py-2.5 font-mono text-xs">
          <span className="truncate">{OPENAPI}</span>
          <div className="flex items-center gap-2 shrink-0">
            <a href={OPENAPI} target="_blank" rel="noreferrer" className="text-muted hover:text-white" title="Open spec"><ExternalLink className="h-3.5 w-3.5" /></a>
            <button onClick={() => copy(OPENAPI)} className="text-muted hover:text-white" title="Copy">{copied === OPENAPI ? <Check className="h-3.5 w-3.5 text-up" /> : <Copy className="h-3.5 w-3.5" />}</button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 text-[11.5px]">
          <div className="rounded-lg bg-panel2/40 p-2.5"><div className="flex items-center gap-1.5 font-semibold text-white"><Bot className="h-3.5 w-3.5 text-accent" /> ChatGPT / Claude</div><div className="text-muted mt-0.5">New custom GPT or Action → Import from URL → paste the link. Done.</div></div>
          <div className="rounded-lg bg-panel2/40 p-2.5"><div className="font-semibold text-white">Postman / Insomnia</div><div className="text-muted mt-0.5">Import → Link → paste. Every request is generated for you.</div></div>
          <div className="rounded-lg bg-panel2/40 p-2.5"><div className="font-semibold text-white">Codegen / SDK</div><div className="text-muted mt-0.5">Feed the link to openapi-generator for a typed client in any language.</div></div>
        </div>
      </div>

      {/* Agents & MCP */}
      <div className="card mb-4 p-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Bot className="h-4 w-4 text-accent" /> AI agents &amp; MCP</div>
        <p className="text-[12.5px] text-muted mb-3">Building an LLM agent or an MCP server? Give your model the <code className="font-mono text-white">llms.txt</code> guide, then wire tools from the OpenAPI spec — most MCP/codegen frameworks turn it into callable tools automatically.</p>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-panel2/60 px-3 py-2.5 font-mono text-xs">
          <span className="truncate">{LLMS}</span>
          <div className="flex items-center gap-2 shrink-0">
            <a href={LLMS} target="_blank" rel="noreferrer" className="text-muted hover:text-white" title="Open llms.txt"><ExternalLink className="h-3.5 w-3.5" /></a>
            <button onClick={() => copy(LLMS)} className="text-muted hover:text-white" title="Copy">{copied === LLMS ? <Check className="h-3.5 w-3.5 text-up" /> : <Copy className="h-3.5 w-3.5" />}</button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-[11.5px]">
          <div className="rounded-lg bg-panel2/40 p-2.5"><div className="font-semibold text-white">Custom GPT / Claude</div><div className="text-muted mt-0.5">Add the <span className="font-mono">llms.txt</span> to the system prompt or knowledge, and import <span className="font-mono">openapi.json</span> as an Action.</div></div>
          <div className="rounded-lg bg-panel2/40 p-2.5"><div className="font-semibold text-white">MCP server</div><div className="text-muted mt-0.5">Point an OpenAPI→MCP bridge (e.g. openapi-mcp) at the spec to expose every endpoint as a tool. No key needed.</div></div>
        </div>
        <p className="mt-2 text-[11px] text-muted/70">Suggested tools: <span className="font-mono">/token</span> overview, <span className="font-mono">/xray</span> risk, <span className="font-mono">/forensics</span> dev origin, <span className="font-mono">/wallet</span>+<span className="font-mono">/swaps</span> traders, <span className="font-mono">/screener</span>+<span className="font-mono">/signals</span> discovery, <span className="font-mono">/chat</span> Q&amp;A.</p>
      </div>

      {/* Base URL */}
      <div className="card mb-4 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Terminal className="h-4 w-4 text-accent" /> Base URL</div>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-panel2/60 px-3 py-2 font-mono text-xs">
          <span>{BASE}</span>
          <button onClick={() => copy(BASE)} className="text-muted hover:text-white">{copied === BASE ? <Check className="h-3.5 w-3.5 text-up" /> : <Copy className="h-3.5 w-3.5" />}</button>
        </div>
      </div>

      {/* Quick example */}
      <div className="card mb-4 p-4">
        <div className="mb-2 text-sm font-bold flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Try it</div>
        <pre className="overflow-x-auto rounded-lg bg-panel2/60 p-3 font-mono text-[11px] text-white/80">{`curl "${BASE}/token?mint=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"`}</pre>
        <p className="mt-2 text-[11px] text-muted/70">JSON responses, edge-cached. Need streaming or higher limits? Reach us on Telegram @ogscanner.</p>
      </div>

      {/* Full reference (collapsed) */}
      <button onClick={() => setShowAll((v) => !v)} className="w-full card p-3 flex items-center gap-2 text-sm font-semibold hover:bg-panel2/40">
        <Code2 className="h-4 w-4 text-accent" /> Browse all {ENDPOINTS.length} endpoints
        <ChevronDown className={`ml-auto h-4 w-4 text-muted transition-transform ${showAll ? "rotate-180" : ""}`} />
      </button>
      {showAll && (
        <div className="space-y-2 mt-2">
          {ENDPOINTS.map((e) => {
            const full = BASE + e.path;
            return (
              <div key={e.path} className="card p-3">
                <div className="flex items-center gap-2">
                  <span className={`pill text-[10px] font-bold ${e.m === "POST" ? "bg-accent/15 text-accent" : "bg-up/15 text-up"}`}>{e.m}</span>
                  <code className="flex-1 truncate font-mono text-xs text-white">{e.path}</code>
                  <button onClick={() => copy(full)} className="text-muted hover:text-white">{copied === full ? <Check className="h-3.5 w-3.5 text-up" /> : <Copy className="h-3.5 w-3.5" />}</button>
                </div>
                <p className="mt-1 text-[12px] text-muted">{e.desc}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
