import { Link } from "react-router-dom";
import PageBanner from "../components/PageBanner";
import {
  ArrowLeft, FileText, ShieldAlert, ExternalLink, Map, Activity, Code,
  Quote as QuoteIcon, Rocket, Eye, Users, Radio, Trophy, Bot, Lock, Layers,
} from "lucide-react";

function H({ id, children }: { id?: string; children: any }) {
  return <h2 id={id} className="text-xl sm:text-2xl font-black text-white mt-10 mb-3 scroll-mt-20 tracking-tight">{children}</h2>;
}
function Sub({ children }: { children: any }) {
  return <h3 className="text-[15px] font-bold text-white mt-5 mb-2">{children}</h3>;
}
function P({ children }: { children: any }) {
  return <p className="text-[14.5px] leading-relaxed text-muted mb-4">{children}</p>;
}
function LI({ children }: { children: any }) {
  return <li className="text-[14.5px] leading-relaxed text-muted mb-2">{children}</li>;
}
function Lede({ children }: { children: any }) {
  return <p className="text-[16.5px] sm:text-[18px] leading-relaxed text-white/90 mb-5 font-medium">{children}</p>;
}
function Quote({ children }: { children: any }) {
  return (
    <div className="my-6 pl-4 border-l-2 border-accent/60 flex gap-2">
      <QuoteIcon className="w-4 h-4 text-accent shrink-0 mt-1" />
      <p className="text-[16px] sm:text-[17px] leading-snug text-white font-semibold italic">{children}</p>
    </div>
  );
}
function Section({ icon: Icon, eyebrow }: { icon: any; eyebrow: string }) {
  return (
    <div className="flex items-center gap-2 mt-10 mb-1 text-accent">
      <Icon className="w-4 h-4" />
      <span className="text-[11px] font-bold uppercase tracking-widest">{eyebrow}</span>
    </div>
  );
}

export default function Whitepaper() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-1">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>

      <PageBanner
        title="The OrbitX Whitepaper"
        subtitle="One on-chain operating system for trading, community, and everything in between."
      />

      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-accent" />
        <h1 className="text-2xl font-black tracking-tight">Building the on-chain operating system</h1>
      </div>
      <p className="text-xs text-muted mb-6">
        By the OrbitX team · {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })} · Version 4.0 · ~12 min read
      </p>

      <div className="card p-4 border border-accent/25 bg-accent/5 mb-8">
        <div className="text-[11px] font-bold uppercase tracking-widest text-accent mb-2">TL;DR</div>
        <P>
          <b className="text-white">OrbitX is one destination for everything crypto trading actually requires</b> — forensic-grade token
          intelligence, a social feed, live voice and video, prediction markets, and games, all under a single wallet-based identity.
          It's non-custodial, free to use, ships weekly, and now lets you launch a token straight to pump.fun — for free — from the
          same place you research one. Everything below is public information about how it works, why it exists, and where it's headed.
        </P>
      </div>

      <Lede>
        Every trader who has ever pasted a contract address into six different tabs before pulling the trigger already knows the
        problem OrbitX was built to solve. The information that actually protects you — who controls the supply, whether the
        developer already sold, whether the hype was paid for, who bundled the launch — is scattered, buried, or simply not shown
        to you at all. We got tired of tab-switching between explorers, chart sites, holder tools and Telegram just to answer one
        question: <i>is this safe to touch?</i> So we built the place where that question gets answered in one screen, and then we
        kept going — because the second most common thing traders do all day, right after research, is talk to each other about
        what they found.
      </Lede>

      <img style={{ filter: "grayscale(1) sepia(1) hue-rotate(105deg) saturate(2.2) brightness(0.9)" }} src="/ORBITX_DEX/ogdex-hero.jpg" alt="OrbitX product interface" className="w-full rounded-xl border border-white/10 mb-8" loading="lazy" />

      <Section icon={Eye} eyebrow="Chapter 1" />
      <H>The problem with on-chain trading</H>
      <P>
        On-chain trading is fundamentally an information game — but the information, and the community around it, is scattered
        across block explorers, chart sites, holder tools, lock checkers, prediction sites, X, Telegram, and a dozen browser tabs
        that don't talk to each other. The data that actually keeps a trader safe is usually the hardest to find: who the developer
        wallet is and whether it already dumped, who the very first on-chain buyer was and at what transaction, whether a "featured"
        listing was paid for, who the whales and known KOLs holding the token are, what the token's real all-time high looked
        like before the chart got manipulated, and whether the launch was bundled or sniped before anyone else had a chance.
      </P>
      <P>
        Meanwhile your identity — your calls, your reputation, your community — doesn't travel with you between any of these tools.
        You rebuild your credibility from zero on every platform. Nothing is connected, and the tools that are supposed to protect
        you from getting rugged are usually the least visible part of the experience.
      </P>

      <Quote>Convergence with clarity: only public data, presented better, with nothing hidden and no noise.</Quote>

      <Section icon={Layers} eyebrow="Chapter 2" />
      <H>What OrbitX actually is</H>
      <P>
        OrbitX is an on-chain operating system for crypto — one destination that unifies trading intelligence, a social layer,
        live streaming, prediction markets, and gaming, connected by a single identity and powered by real on-chain data and AI.
        Its core, <b className="text-white">OrbitX DEX</b>, aggregates already-public blockchain and market data across 16 chains,
        enriches and cross-references it, and surfaces what most tools hide. Around that intelligence, OrbitX adds the things
        traders actually do all day: post and discuss, host voice Spaces, go live, follow smart money, launch a token, and play —
        without ever leaving the platform.
      </P>
      <P>
        The guiding principle is <b className="text-white">convergence with clarity</b>. We don't invent proprietary data or
        gate the truth behind a paywall — we take public information and make it legible, fast, and complete. Paste a contract
        address and get a full forensic dossier in seconds. That's the whole pitch.
      </P>

      <Section icon={Code} eyebrow="Chapter 3" />
      <H>Inside the machine</H>
      <P>
        OrbitX is an intelligence layer sitting on top of public data, not a black box. It blends multiple best-in-class feeds —
        market and token data, holder and trade data, safety and liquidity analysis, all-time-high history, OHLCV chart data,
        on-chain transaction tracing, and live web search — into a single normalized, scored picture of every token.
      </P>
      <Sub>Built to stay up</Sub>
      <P>
        The system is resilient by design: when one data source is slow or rate-limited, it falls back to another automatically,
        with heavy edge caching to keep every page fast. A single serverless API gateway dispatches every endpoint with per-IP
        rate limiting, so no single spike takes the platform down. Accounts, profiles and social content run on Supabase with
        row-level security; live audio and video run on LiveKit. We don't just claim uptime — every upstream (token data, charting,
        forensics, AI chat, screener, alerts) is probed independently, with live latency and availability scores published on the
        public <Link to="/status" className="text-accent">status page</Link>.
      </P>

      <Section icon={Rocket} eyebrow="Chapter 4" />
      <H>The product suite</H>
      <P>This is where OrbitX stops being an idea and becomes something you actually use every day.</P>

      <Sub>OrbitX DEX — trading intelligence</Sub>
      <P>
        The forensic core of the platform. A screener with curated, garbage-filtered categories —
        Trending, Runners, New, FOMO, Jupiter-verified, the full Pump.fun set, OG, KOL Picks, Celebrity, Organic, Listed,
        Multi-chain, and Social — so you're never wading through dead or LP-pulled tokens to find something real. Every
        Token Page carries a trust verdict, an AI read, a native candlestick chart, full market
        metrics, labeled holders, live trades, and one-click Solscan links on every wallet and transaction.
      </P>
      <ul className="list-disc pl-5 mb-4">
        <LI><b className="text-white">Forensics</b> — developer wallet and dev-sold status, the first on-chain buyer with the exact transaction, paid-listing status, concentration and safety flags, plus bundle and sniper detection.</LI>
        <LI><b className="text-white">Token Sniper & Tools</b> — a multi-source live feed (newest, bonding, trending, gainers, migrated) with safety chips, plus the full tool suite: Snipe Feed, Scanner, New Pairs, OG Finder, Migrations, Trending, and Swap.</LI>
        <LI><b className="text-white">Pulse, KOL/whale intel, Portfolio & copy-tracking</b> — real-time momentum signals, a smart-money directory with a live buy/sell feed, holdings with realized and unrealized PnL, and following up to 10 wallets to watch what they do next.</LI>
        <LI><b className="text-white">Launchpad</b> — create and launch a token straight to pump.fun from inside OrbitX DEX, free of charge, with an optional custom vanity mint address so your contract address itself carries the brand.</LI>
      </ul>

      <Sub>OrbitX Social — the community layer</Sub>
      <P>
        An X-style home timeline with a composer, a realtime feed, likes, replies, and native cashtag and mint linking. Profiles
        carry avatars, banners, bios, and verified official accounts. Communities and per-token chat give every ticker its own
        room, and a dedicated KOL social feed shows what the accounts that move markets are actually saying.
      </P>

      <Sub>OrbitX Live — Spaces & streaming</Sub>
      <P>
        Live voice Spaces with lobbies and recordings for scheduled conversations, plus full live streaming: go live with your
        camera or share your screen to a shared community room, watch every broadcaster in a tile grid, and chat alongside the
        stream in real time. No separate app, no separate login — it's the same identity you trade with.
      </P>

      <Sub>Predictions & Gaming</Sub>
      <P>
        Native prediction markets and provably-fair 1v1 games, wired directly into your OrbitX insights, with leaderboards and
        achievements that turn being early and being right into something visible.
      </P>

      <Section icon={Bot} eyebrow="Chapter 5" />
      <H>The Coin AI</H>
      <P>
        Every token on OrbitX gets its own AI agent, grounded in two live sources at once: the complete current on-chain dataset
        for that token — price, holders, whales, KOLs, developer and first-buyer forensics, safety, liquidity — and a live web
        search for narrative and sentiment. It answers with real numbers, real wallets, and real transactions, cites its web
        sources, and links every wallet and transaction straight to Solscan. Think of it as an on-demand analyst attached to
        every ticker, one that never gets tired of being asked "wait, is this actually safe?"
      </P>

      <Section icon={Code} eyebrow="Chapter 6" />
      <H>Built for machines too</H>
      <div className="card p-4 border border-accent/20 bg-accent/5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-white">A machine-readable API for AI assistants</span>
        </div>
        <P>
          OrbitX exposes a public MCP (Model Context Protocol) manifest at{" "}
          <code className="text-accent text-[11px] bg-panel px-1.5 py-0.5 rounded">GET /api/ogdex/mcp</code>. Any AI assistant
          that supports MCP — including Claude, GPT and custom agents — can discover and call OrbitX tools directly: token
          lookup, screener, forensics, all-time-high, wallet PnL, OHLCV chart data, and search. Programmatic calls go to{" "}
          <code className="text-accent text-[11px] bg-panel px-1.5 py-0.5 rounded">POST /api/ogdex/mcp</code> with{" "}
          <code className="text-accent text-[11px] bg-panel px-1.5 py-0.5 rounded">{"{ tool, params }"}</code>. Your research
          assistant shouldn't have to guess what's happening on-chain — now it can just ask.
        </P>
      </div>

      <Section icon={Trophy} eyebrow="Chapter 7" />
      <H>Token & utility</H>
      <P>
        OrbitX has a community token on Solana that aligns the community with the platform and gates premium access and perks —
        higher API limits, advanced analytics, and priority features via the Pro tier, with creator and community perks expanding
        over the Convergence phase. The Pro tier checks the connected wallet's token balance non-custodially: your tokens never
        leave your wallet. Utility expands over time and every expansion is announced through the official Updates channel.
      </P>
      <P>
        <span className="text-muted">Official contract:</span>{" "}
        <span className="font-mono text-[11px] text-white break-all">13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9</span>
      </P>
      <p className="text-[12px] leading-relaxed text-muted mb-4">
        Nothing here is a promise of value, an offer, or financial advice — always verify the official contract address before
        interacting with anything claiming to be OrbitX.
      </p>

      <Section icon={Lock} eyebrow="Chapter 8" />
      <H>Security & non-custodial design</H>
      <P>
        OrbitX never takes custody of funds or private keys. Every trade is signed by your own wallet and routed to public
        programs — we never hold your assets, not even for a second. The platform surfaces safety data (mint and freeze
        authority, LP-locked percentage, rug status, concentration, risk score) to inform your decisions, but no tool can
        guarantee any token is safe. Copy-tracking is informational only: no auto-execution, and no wallet permissions beyond
        what's needed to verify a balance. Accounts are protected by row-level security and encrypted connections; live media is
        peer-delivered and never recorded unless you explicitly enable it.
      </P>

      <div className="card p-4 border border-line mb-6 mt-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-accent" />
          <span className="text-sm font-bold text-white">Uptime & Status</span>
        </div>
        <P>
          OrbitX runs on edge infrastructure with automatic fallbacks between data sources. The health endpoint is publicly
          accessible for uptime monitoring. Live status is at <Link to="/status" className="text-accent">/status</Link> — each
          upstream is probed independently with per-source latency and availability scores.
        </P>
      </div>

      <Section icon={Radio} eyebrow="Chapter 9" />
      <H>Where we've been, where we're going</H>
      <P>
        OrbitX ships weekly, and that's not a slogan — it's how the roadmap reads. Phase 1 built the forensic core: turn any
        contract address into a full dossier. Phase 2 added independent charting, bundle/sniper detection, and provable uptime.
        Phase 3 put the intelligence to work automatically with Smart Alerts, wallet copy-tracking, and a Pro tier. Phase 4 opened
        the ecosystem up with a public AI/MCP agent, community-curated KOL lists, and an embeddable token widget. Phase 5 built
        the entire social layer — timeline, profiles, communities, voice Spaces, and full live streaming.
      </P>
      <P>
        We're now in Phase 6: Convergence — unifying identity and reputation across every product,
        building creator monetization, wiring predictions and gaming into the same insights you already trust, automating
        copy-trading, and shipping native mobile apps. The full phase-by-phase breakdown, including what's shipped, what's in
        progress, and what's planned next, lives on the roadmap.
      </P>
      <Link to="/roadmap" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-all mb-2">
        <Map className="w-3.5 h-3.5" /> View the full Roadmap
      </Link>

      <Section icon={Users} eyebrow="Chapter 10" />
      <H>Why this, why now</H>
      <P>
        Every cycle produces a wave of tools that solve one narrow slice of the on-chain trading problem — a chart here, a
        holder-checker there, a separate app for the socials. They rarely last, and they never talk to each other. We think the
        next phase of on-chain trading isn't another single-purpose tool; it's the operating system that connects all of them,
        so your research, your reputation, and your community live in the same place your trades happen.
      </P>
      <Quote>The data that protects you shouldn't be the hardest thing to find.</Quote>
      <P>
        That's the bet OrbitX is making — free to use, non-custodial by design, public about what it can and can't guarantee,
        and shipping every single week because the market doesn't wait and neither do we.
      </P>

      <H>Disclaimer</H>
      <div className="card border border-down/30 bg-down/5 p-4 my-2 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-down shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-white/85 leading-relaxed">
          OrbitX is a data and analytics platform. Nothing here is financial, investment, legal or tax advice, and we are not
          responsible for what you buy or sell. Data comes from third-party sources and may be delayed or imperfect. Crypto is
          high risk. Do your own research and never invest more than you can afford to lose.
        </p>
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
