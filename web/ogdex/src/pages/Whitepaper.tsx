import { Link } from "react-router-dom";
import PageBanner from "../components/PageBanner";
import { ArrowLeft, FileText, ShieldAlert, ExternalLink, Map, Activity, Code } from "lucide-react";

function H({ id, children }: { id?: string; children: any }) { return <h2 id={id} className="text-lg font-bold text-white mt-7 mb-2 scroll-mt-20">{children}</h2>; }
function P({ children }: { children: any }) { return <p className="text-[13.5px] leading-relaxed text-muted mb-3">{children}</p>; }
function LI({ children }: { children: any }) { return <li className="text-[13.5px] leading-relaxed text-muted mb-1.5">{children}</li>; }

export default function Whitepaper() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-1">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <PageBanner />
      <div className="flex items-center gap-2 mb-1"><FileText className="w-5 h-5 text-accent" /><h1 className="text-2xl font-black tracking-tight">OrbitX Whitepaper</h1></div>
      <p className="text-xs text-muted mb-5">Version 3.0 · {new Date().getFullYear()} · The on-chain operating system. The data tools most platforms hide.</p>

      <H>Abstract</H>
      <P>OrbitX is an on-chain operating system for crypto: one destination that unifies trading intelligence, a social layer, live streaming, prediction markets and gaming, connected by a single identity and powered by real on-chain data and AI. Its core, OrbitX DEX, aggregates already-public blockchain and market data across 16 chains, enriches and cross-references it, and surfaces what most tools hide — the developer wallet and whether they sold, the first on-chain buyer with the exact transaction, paid-listing status, whale and KOL holders, real all-time-high, live momentum signals, bundle and sniper detection, and wallet copy-tracking. Around that intelligence, OrbitX adds the things traders actually do all day: post and discuss, host voice Spaces, go live, follow smart money, and play — without leaving the platform. OrbitX is non-custodial, free to use, and ships weekly.</P>

      <H>1. The Problem</H>
      <P>On-chain trading is an information game, but the information — and the community around it — is fragmented across block explorers, chart sites, holder tools, lock checkers, prediction sites, Twitter, Telegram and a dozen disconnected tabs. The data that protects a trader (who controls supply, whether the dev dumped, whether hype was paid for, whether liquidity is real, who bundled the launch) is usually buried or omitted. Meanwhile your identity, reputation and community don't travel with you between these tools. Nothing talks to each other.</P>

      <H>2. The Solution</H>
      <P>OrbitX collapses the entire workflow into one product. Paste a contract address and get a complete forensic dossier in seconds. Browse curated, garbage-filtered discovery. Watch real-time signals. Copy-track smart wallets. Then jump straight into the social side — post about a token, host a Space, go live, or check what KOLs are buying — all under one account whose reputation follows you everywhere. The guiding principle is convergence with clarity: only public data, presented better, with nothing hidden and no noise.</P>

      <H>3. Architecture & Data Layer</H>
      <P>OrbitX is an intelligence layer on top of public data. It blends multiple best-in-class feeds (market and token data, holder and trade data, safety and liquidity analysis, all-time-high history, OHLCV chart data, on-chain transaction tracing, and live web search) into a single normalized, scored picture. The system is resilient by design: when one source is slow or rate-limited it falls back to another, with heavy edge caching to stay fast. A single serverless API gateway dispatches every endpoint with per-IP rate limiting. Accounts, profiles and social content run on Supabase with row-level security; live audio/video runs on LiveKit. Uptime is tracked at the public <Link to="/status" className="text-accent">status page</Link>.</P>

      <H>4. Product Suite</H>
      <P><b className="text-white">OrbitX DEX — trading intelligence.</b></P>
      <ul className="list-disc pl-5 mb-3">
        <LI><b className="text-white">Discovery</b> — a screener with curated categories (Trending, Runners, New, FOMO, Jupiter-verified, the full Pump.fun set, OG, KOL Picks, Celebrity, Organic, Listed, Multi-chain, Social) that filters out dead, illiquid and LP-pulled tokens.</LI>
        <LI><b className="text-white">Token Page</b> — trust verdict, AI read, native candlestick chart, market metrics, labeled holders, live trades and forensics, with one-click Solscan links on every wallet and transaction.</LI>
        <LI><b className="text-white">Forensics</b> — developer wallet and dev-sold status, first buyer with the exact transaction, paid-listing status, concentration and safety flags, plus bundle &amp; sniper detection.</LI>
        <LI><b className="text-white">Token Sniper &amp; Tools</b> — a multi-source live feed (newest, bonding, trending, gainers, migrated) with safety chips, plus the full tool suite: Snipe Feed, Scanner, New Pairs, OG Finder, Migrations, Trending and Swap.</LI>
        <LI><b className="text-white">Pulse, KOL/Whale intel, Portfolio &amp; Copy-tracking</b> — real-time signals, smart-money directory and live buy/sell feed, holdings with realized/unrealized PnL, and following up to 10 wallets.</LI>
      </ul>
      <P><b className="text-white">OrbitX Social — community layer.</b> An X-style home timeline (composer, realtime feed, likes, replies, cashtag and mint linking), profiles with avatars/banners/bios and verified official accounts, communities and per-token chat, and a KOL social feed.</P>
      <P><b className="text-white">OrbitX Live — Spaces &amp; streaming.</b> Live voice Spaces with lobbies and recordings, and full live streaming: go live with your camera or share your screen to a shared community room, watch every broadcaster in a tile grid, and chat alongside the stream in real time.</P>
      <P><b className="text-white">Predictions &amp; Gaming.</b> Native prediction markets plus provably-fair 1v1 games, wired into your OrbitX insights with leaderboards and achievements.</P>

      <H>5. The Coin AI</H>
      <P>Each token has its own AI agent, grounded in two live sources simultaneously: the complete current on-chain dataset for that token (price, holders, whales, KOLs, developer and first-buyer forensics, safety, liquidity) and a live web search for narrative and sentiment. It answers with real numbers, wallets and transactions, cites its web sources, and links wallets and transactions to Solscan — an on-demand analyst attached to every ticker.</P>

      <H>6. AI Agent &amp; MCP Integration</H>
      <div className="card p-4 border border-accent/20 bg-accent/5 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-white">Machine-readable API for AI assistants</span>
        </div>
        <P>OrbitX exposes a public <b className="text-white">MCP (Model Context Protocol)</b> manifest at <code className="text-accent text-[11px] bg-panel px-1.5 py-0.5 rounded">GET /api/ogdex/mcp</code>. Any AI assistant that supports MCP — including Claude, GPT-4 and custom agents — can discover and call OrbitX tools: token lookup, screener, forensics, ATH, wallet PnL, OHLCV chart data and search. Programmatic calls go to <code className="text-accent text-[11px] bg-panel px-1.5 py-0.5 rounded">POST /api/ogdex/mcp</code> with <code className="text-accent text-[11px] bg-panel px-1.5 py-0.5 rounded">{"{ tool, params }"}</code>.</P>
      </div>

      <H>7. Token &amp; Utility</H>
      <P>OrbitX has a community token on Solana that aligns the community with the platform and gates premium access and perks: higher API limits, advanced analytics and priority features via the Pro tier, with creator and community perks expanding over the Convergence phase. The Pro tier checks the connected wallet's token balance non-custodially — tokens stay in your wallet. Utility expands over time and is announced through the official Updates channel. Nothing here is a promise of value, an offer, or financial advice; always verify the official contract address before interacting.</P>
      <P><span className="text-muted">Official contract:</span> <span className="font-mono text-[11px] text-white break-all">HEivoBHhWT939vcaevGgZBtoArS4CAywCMjdVBTSpump</span></P>

      <H>8. Security &amp; Non-custodial Design</H>
      <P>OrbitX never takes custody of funds or private keys. Any trade is signed by the user's own wallet and routed to public programs. The platform surfaces safety data (mint and freeze authority, LP-locked percentage, rug status, concentration, risk score) to inform decisions but cannot guarantee any token is safe. Copy-tracking is informational only — no auto-execution and no permissions beyond wallet connection for balance verification. Accounts are protected by row-level security and encrypted connections; live media is peer-delivered and not recorded unless explicitly enabled.</P>

      <H>9. System Reliability</H>
      <div className="card p-4 border border-line mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-white">Uptime &amp; Status</span>
        </div>
        <P>OrbitX runs on edge infrastructure with automatic fallbacks between data sources. The health endpoint is publicly accessible for uptime monitoring. Live status is at <Link to="/status" className="text-accent">/status</Link> — each upstream (token data, charting, forensics, AI chat, screener, alerts) is probed independently with per-source latency and availability scores.</P>
      </div>

      <H>10. Roadmap</H>
      <P>OrbitX ships weekly. Phases 1–5 (DEX intelligence, depth &amp; reliability, Pro &amp; automation, open ecosystem, and the social layer including live streaming) are live; Phase 6 (Convergence — unified identity, creator monetization, predictions/gaming integration, copy-trading automation and native mobile) is in progress.</P>
      <Link to="/roadmap" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-all mb-2">
        <Map className="w-3.5 h-3.5" /> View the Roadmap
      </Link>

      <H>11. Disclaimer</H>
      <div className="card border border-down/30 bg-down/5 p-4 my-2 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-down shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-white/85 leading-relaxed">OrbitX is a data and analytics platform. Nothing here is financial, investment, legal or tax advice, and we are not responsible for what you buy or sell. Data comes from third-party sources and may be delayed or imperfect. Crypto is high risk. Do your own research and never invest more than you can afford to lose.</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <a href="https://orbitx.world" className="text-accent inline-flex items-center gap-1">App <ExternalLink className="w-3 h-3" /></a>
        <a href="https://t.me/OrbitXupdates" target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-1">Updates <ExternalLink className="w-3 h-3" /></a>
        <a href="https://t.me/orbitxwrld" target="_blank" rel="noreferrer" className="text-accent inline-flex items-center gap-1">Support <ExternalLink className="w-3 h-3" /></a>
        <Link to="/roadmap" className="text-accent">Roadmap</Link>
        <Link to="/privacy" className="text-accent">Privacy</Link>
        <Link to="/status" className="text-accent">Status</Link>
      </div>
    </div>
  );
}
