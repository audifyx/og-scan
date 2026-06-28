import { Link } from "react-router-dom";
import PageBanner from "../components/PageBanner";
import { ArrowLeft, FileText, ShieldAlert, ExternalLink, Map, Activity, Zap, Eye, Code } from "lucide-react";

function H({ id, children }: { id?: string; children: any }) { return <h2 id={id} className="text-lg font-bold text-white mt-7 mb-2 scroll-mt-20">{children}</h2>; }
function P({ children }: { children: any }) { return <p className="text-[13.5px] leading-relaxed text-muted mb-3">{children}</p>; }
function LI({ children }: { children: any }) { return <li className="text-[13.5px] leading-relaxed text-muted mb-1.5">{children}</li>; }

export default function Whitepaper() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-1">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <PageBanner />
      <div className="flex items-center gap-2 mb-1"><FileText className="w-5 h-5 text-accent" /><h1 className="text-2xl font-black tracking-tight">OG DEX Whitepaper</h1></div>
      <p className="text-xs text-muted mb-5">Version 2.0 · {new Date().getFullYear()} · The data tools most platforms hide.</p>

      <H>Abstract</H>
      <P>OG DEX is a unified on-chain data and analytics platform for crypto traders. It aggregates already-public blockchain and market data across 16 chains, enriches and cross-references it, and presents it in a fast, clean interface that surfaces what most tools hide: the developer wallet and whether they sold, the first on-chain buyer with the exact transaction, paid-listing status, whale and KOL holders, real all-time-high, live momentum signals, bundle and sniper detection, and wallet copy-tracking. Every token also has its own AI agent, grounded in live on-chain data plus live web search. OG DEX is non-custodial, free to use, and updated weekly.</P>

      <H>1. The Problem</H>
      <P>On-chain trading is an information game, but the information is fragmented across block explorers, chart sites, holder tools, lock checkers, and chat groups. The data that protects a trader — who controls supply, whether the dev dumped, whether hype was paid for, whether liquidity is real, who bundled the launch — is usually buried or omitted entirely. At the same time, screeners flood users with dead, illiquid, and rug-pulled tokens, drowning signal in noise.</P>

      <H>2. The Solution</H>
      <P>OG DEX collapses the entire research workflow into one product. Paste a contract address and receive a complete forensic dossier in seconds: trust verdict, plain-English AI read, native candlestick chart, holder and whale breakdown, bundle and sniper detection, developer and first-buyer forensics, safety flags, and live trades. Browse curated, garbage-filtered discovery lists, watch real-time signals in Pulse, copy-track smart wallets, follow smart money, track your portfolio, and build on a free public API or AI agent. The guiding principle is clarity: only public data, presented better, with nothing hidden, and no noise.</P>

      <H>3. Architecture and Data Layer</H>
      <P>OG DEX is an intelligence layer on top of public data sources. It blends multiple best-in-class feeds (market and token data, holder and trade data, safety and liquidity analysis, all-time-high history, OHLCV chart data, on-chain transaction tracing, and live web search) into a single normalized, scored picture. The system is resilient by design: when one source is slow or rate-limited, it falls back to another, with heavy edge caching so the app stays fast. A single serverless API gateway dispatches every endpoint, with per-IP rate limiting and an optional key to keep the public API healthy. System uptime is tracked at the public <Link to="/status" className="text-accent">status page</Link>.</P>

      <H>4. Core Features</H>
      <ul className="list-disc pl-5 mb-3">
        <LI><b className="text-white">Discovery</b> — a screener with curated categories (Trending, Runners, New, FOMO, Jupiter-verified, the full Pump.fun set, OG, KOL Picks, Celebrity, Organic, Listed, Multi-chain, Social) that filters out dead, illiquid and LP-pulled tokens.</LI>
        <LI><b className="text-white">Token Page</b> — a full dossier: trust verdict, AI OG Read, native candlestick chart, market metrics, labeled holders, live trades, and forensics, with one-click Solscan links on every wallet and transaction.</LI>
        <LI><b className="text-white">Forensics</b> — developer wallet and dev-sold status, first buyer with the exact transaction, DexScreener-paid status, concentration and safety flags.</LI>
        <LI><b className="text-white">Bundle & Sniper Detection</b> — identifies wallets that bought in coordinated clusters (bundles) and early snipers, surfaced prominently on every token page.</LI>
        <LI><b className="text-white">Native Candlestick Chart</b> — OHLCV candle chart rendered directly in the browser with interval selector (5m, 15m, 1h, 4h, 1D) and volume bars.</LI>
        <LI><b className="text-white">Ask the Coin</b> — a per-token AI grounded in live on-chain data and live web search, with cited sources.</LI>
        <LI><b className="text-white">Pulse</b> — real-time signals: volume and buyer surges, velocity spikes, momentum, fresh runners, pump.fun graduating and just-migrated, tuned for fresh, actionable coins.</LI>
        <LI><b className="text-white">KOL and Whale Intelligence</b> — smart-money directory, who holds a token, and a live buy/sell feed.</LI>
        <LI><b className="text-white">Portfolio</b> — holdings, realized and unrealized PnL, win rate, and one-tap PnL share cards.</LI>
        <LI><b className="text-white">Copy Tracking</b> — follow up to 10 wallets and see their trades in a live feed at <Link to="/copy-trade" className="text-accent">/copy-trade</Link>.</LI>
        <LI><b className="text-white">Community KOL Lists</b> — community-nominated and OG-verified smart-money wallets at <Link to="/kol/community" className="text-accent">/kol/community</Link>. Anyone can nominate a wallet; OG team verifies and tags.</LI>
        <LI><b className="text-white">Embeddable Token Widget</b> — a single script tag embeds live price, market cap, 24h change, OG Score, and trust verdict for any token on any website. Configure at <Link to="/embed" className="text-accent">/embed</Link>.</LI>
        <LI><b className="text-white">Smart Alerts v2</b> — price, percent-move, whale-buy, dev-sell, and migration alerts delivered to Telegram or any webhook (Discord, Slack, custom).</LI>
        <LI><b className="text-white">Multi-chain</b> — 16 chains including Solana, Ethereum, Base, BNB Chain, Arbitrum, Polygon, Avalanche, SUI and TON.</LI>
        <LI><b className="text-white">Tools</b> — smart alerts, community Store and boosts, token launcher, and a one-link public OpenAPI.</LI>
      </ul>

      <H>5. The Coin AI</H>
      <P>Each token's AI agent is grounded in two live sources simultaneously: the complete current on-chain dataset for that token (price, holders, whales, KOLs, developer and first-buyer forensics, safety, liquidity) and a live web search for narrative and sentiment. It answers with the real numbers, wallets and transactions, cites its web sources, and links wallets and transactions to Solscan. The result is an on-demand analyst attached to every ticker.</P>

      <H>6. AI Agent & MCP Integration</H>
      <div className="card p-4 border border-accent/20 bg-accent/5 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-white">Machine-Readable API for AI Assistants</span>
        </div>
        <P>OG DEX exposes a public <b className="text-white">MCP (Model Context Protocol)</b> manifest at <code className="text-accent text-[11px] bg-panel px-1.5 py-0.5 rounded">GET /api/ogdex/mcp</code>. Any AI assistant that supports MCP — including Claude, GPT-4, and custom agents — can discover and call OG DEX tools: token lookup, screener, forensics, ATH, wallet PnL, OHLCV chart data, and search. Programmatic tool calls go to <code className="text-accent text-[11px] bg-panel px-1.5 py-0.5 rounded">POST /api/ogdex/mcp</code> with <code className="text-accent text-[11px] bg-panel px-1.5 py-0.5 rounded">{"{ tool, params }"}</code>.</P>
      </div>

      <H>7. Token and Utility</H>
      <P>OG DEX has a community token on Solana. The token aligns the community with the platform and gates premium access and perks as the product grows: higher API limits, advanced analytics, and priority features via the Pro tier. The Pro tier checks the connected wallet's OG token balance non-custodially — tokens stay in the user's wallet. Utility expands over time and is announced through the official Updates channel. No statement here is a promise of value, an offer, or financial advice; always verify the official contract address before interacting.</P>
      <P><span className="text-muted">Official contract:</span> <span className="font-mono text-[11px] text-white break-all">HEivoBHhWT939vcaevGgZBtoArS4CAywCMjdVBTSpump</span></P>

      <H>8. Security and Non-custodial Design</H>
      <P>OG DEX never takes custody of funds or private keys. Any trade is signed by the user's own wallet and routed to public programs. The platform surfaces safety data (mint and freeze authority, LP locked percentage, rug status, concentration, risk score) to inform decisions, but cannot guarantee any token is safe. Copy-tracking is informational only — no auto-execution, no permissions required beyond wallet connection for balance verification.</P>

      <H>9. System Reliability</H>
      <div className="card p-4 border border-line mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-white">Uptime & Status</span>
        </div>
        <P>OG DEX runs on edge infrastructure with automatic fallbacks between data sources. The health endpoint is publicly accessible for uptime monitoring services. Live service status is available at <Link to="/status" className="text-accent">/status</Link> — each upstream (token data, charting, forensics, AI chat, screener, alerts) is probed independently with per-source latency and availability scores.</P>
      </div>

      <H>10. Roadmap</H>
      <P>OG DEX ships weekly, with the roadmap driven by community requests. Phases 1 through 3 are complete. Phase 4 (native mobile apps, community KOL curation, embeddable widgets) is in progress. See the full phased roadmap here:</P>
      <Link to="/roadmap" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-all mb-2">
        <Map className="w-3.5 h-3.5" /> View the Roadmap
      </Link>

      <H>11. Disclaimer</H>
      <div className="card border border-down/30 bg-down/5 p-4 my-2 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-down shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-white/85 leading-relaxed">OG DEX is a data and analytics platform. Nothing here is financial, investment, legal, or tax advice, and we are not responsible for what you buy or sell. Data comes from third-party sources and may be delayed or imperfect. Crypto is high risk. Do your own research and never invest more than you can afford to lose.</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <a href="https://ogscan.fun" className="text-accent inline-flex items-center gap-1">App <ExternalLink className="w-3 h-3" /></a>
        <a href="https://t.me/OrbitXupdates" target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-1">Updates <ExternalLink className="w-3 h-3" /></a>
        <a href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-1">Support <ExternalLink className="w-3 h-3" /></a>
        <Link to="/roadmap" className="text-accent">Roadmap</Link>
        <Link to="/status" className="text-accent">Status</Link>
        <a href="/api/ogdex/mcp" target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-1">MCP <ExternalLink className="w-3 h-3" /></a>
      </div>
    </div>
  );
}
