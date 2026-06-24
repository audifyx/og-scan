import { useState } from "react";
import { Code2, Copy, Check, Terminal } from "lucide-react";

const BASE = "https://ogscan.fun/api/ogdex";
const ENDPOINTS = [
  { m: "GET", path: "/screener?type=trending&chain=solana&limit=100", desc: "Token screener. type: trending|runners|new|fomo|jupiter|unbonded|migrated|moonshot|newpairs|og|kols|celebrity|organic|listed|multichain|social." },
  { m: "GET", path: "/signals", desc: "Live Pulse signals — volume/velocity/buyer surges, momentum, fresh runners, pump.fun graduating/graduated." },
  { m: "GET", path: "/token?mint=<MINT>", desc: "Full token intel: price, mcap, liquidity, OG Score, verdict, flags, safety, holders, organic momentum." },
  { m: "GET", path: "/metadata?mint=<MINT>", desc: "On-chain metadata + update authority + mutability (for the metadata editor / verification)." },
  { m: "GET", path: "/wallet?address=<ADDR>", desc: "Wallet portfolio: SOL + SPL holdings, USD values, and realized PnL + win rate." },
  { m: "GET", path: "/kols", desc: "Tracked KOL / smart-money directory with PnL and win-rate." },
  { m: "GET", path: "/kols?feed=1", desc: "Recent KOL buy/sell activity feed." },
  { m: "GET", path: "/chart?mint=<MINT>", desc: "OHLC candles for charting." },
  { m: "GET", path: "/search?q=<QUERY>", desc: "Search tokens by name, ticker, or mint." },
  { m: "GET", path: "/listings?featured=1", desc: "Featured / boosted listings from the Store." },
  { m: "GET", path: "/watchlist?wallet=<ADDR>", desc: "A wallet's synced watchlist." },
  { m: "GET", path: "/alerts?wallet=<ADDR>", desc: "A wallet's smart alerts." },
];

export default function ApiDocs() {
  const [copied, setCopied] = useState("");
  const copy = (t: string) => { navigator.clipboard.writeText(t); setCopied(t); setTimeout(() => setCopied(""), 1200); };
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-accent/20 bg-accent/10"><Code2 className="h-7 w-7 text-accent" /></div>
        <h1 className="text-2xl font-black tracking-tight">OG DEX Public API</h1>
        <p className="mt-2 text-sm text-muted">Free, public REST endpoints — the same data that powers OGDEX. No key required. JSON over HTTPS. Please be reasonable with request volume.</p>
      </div>

      <div className="card mb-4 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Terminal className="h-4 w-4 text-accent" /> Base URL</div>
        <div className="flex items-center justify-between gap-2 rounded-lg bg-panel2/60 px-3 py-2 font-mono text-xs">
          <span>{BASE}</span>
          <button onClick={() => copy(BASE)} className="text-muted hover:text-white">{copied === BASE ? <Check className="h-3.5 w-3.5 text-up" /> : <Copy className="h-3.5 w-3.5" />}</button>
        </div>
      </div>

      <div className="space-y-2">
        {ENDPOINTS.map((e) => {
          const full = BASE + e.path;
          return (
            <div key={e.path} className="card p-3">
              <div className="flex items-center gap-2">
                <span className="pill bg-up/15 text-up text-[10px] font-bold">{e.m}</span>
                <code className="flex-1 truncate font-mono text-xs text-white">{e.path}</code>
                <button onClick={() => copy(full)} className="text-muted hover:text-white">{copied === full ? <Check className="h-3.5 w-3.5 text-up" /> : <Copy className="h-3.5 w-3.5" />}</button>
              </div>
              <p className="mt-1 text-[12px] text-muted">{e.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="card mt-4 p-4">
        <div className="mb-2 text-sm font-bold">Example</div>
        <pre className="overflow-x-auto rounded-lg bg-panel2/60 p-3 font-mono text-[11px] text-white/80">{`curl "${BASE}/token?mint=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"`}</pre>
        <p className="mt-2 text-[11px] text-muted/70">Responses are JSON. Most endpoints are cached at the edge (~15s). Need real-time streaming or higher limits? Reach us on Telegram @ogscanner.</p>
      </div>
    </div>
  );
}
