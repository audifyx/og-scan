/**
 * Official OrbitX FAQ corpus for Telegram / AI agents.
 *
 * Faithful synthesis of the OrbitX Comprehensive FAQ Training Report
 * (audifyx/og-scan docs, platform map, delivery summaries, architecture notes,
 * token-utility announcements, @orbitx_wrld, orbitx.world, Aug 2026).
 *
 * Injection for Llama 3.1 8B: CORE + top 3 chunks — never the full essay every turn.
 * Do not invent live MC / holders / shop USD or unreleased feats beyond this file.
 */

import { ORBITX_PREDICTIONS_URL } from "../../shared/orbitx-predictions.js";

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
export const ORBITX_HOST = "https://www.orbitx.world";
/** Retired public domain — keep the export so old interpolations resolve to the live DEX. */
export const OGSCAN_HOST = `${ORBITX_HOST}/ORBITX_DEX`;
export const ORBITX_GITHUB = "https://github.com/audifyx/og-scan";
export const ORBITX_GC = "https://t.me/orbitxwrld";
export const ORBITX_X = "https://x.com/orbitx_wrld";

/** Report sections → chunk ids (training coverage map). */
export const ORBITX_FAQ_SECTIONS = {
  "1. What is OrbitX": ["what"],
  "2. Official Token — $ORBITX": ["token"],
  "3. Token Utility — Holding + Burning": ["hold", "burn", "shop"],
  "4. How OrbitX Connects to MCP": ["mcp", "agents"],
  "5. How Burning Works in Detail": ["burn", "shop"],
  "6. Core Product Surfaces": ["surfaces"],
  "7. Key Features in Depth": ["dex", "wallet", "coinai", "pulse", "launch", "social", "nft"],
  "8. Technical Architecture & Stack": ["stack"],
  "9. Prediction Markets & Betting Program": ["predict"],
  "10. Roadmap / Non-Overlap Rules": ["roadmap"],
  "11. Quick Agent Decision Tree": ["answers"],
  "12. Caveats for the Training Agent": ["caveats", "custody"],
};

/** Exact FAQ phrasings from the report — boost retrieval. */
export const ORBITX_FAQ_ALIASES = [
  { id: "what", phrases: ["what is orbitx", "who is orbitx", "what is og scan", "ogscan"] },
  { id: "hold", phrases: ["what is the utility", "token utility", "how does holding", "utility of $orbitx", "utility of orbitx"] },
  { id: "mcp", phrases: ["how do i connect mcp", "how to connect mcp", "connect mcp", "mcp access"] },
  { id: "burn", phrases: ["how does burning work", "how does burn work", "how to burn"] },
  { id: "custody", phrases: ["is it custodial", "non-custodial", "do you hold keys"] },
  { id: "stack", phrases: ["where is the code", "github", "source code"] },
  { id: "launch", phrases: ["can i launch", "free launch", "vanity mint"] },
  { id: "predict", phrases: ["prediction markets", "solana-betting", "betting program"] },
  { id: "shop", phrases: ["orbitx shop", "buy and burn", "shop burn"] },
  { id: "wallet", phrases: ["copy-tracking", "copy trading", "smart money"] },
  { id: "coinai", phrases: ["coin ai", "per-token ai", "token analyst"] },
  { id: "pulse", phrases: ["snipe feed", "new pairs", "og finder"] },
];

/** Always injected — compact facts every reply can use. */
export const ORBITX_FAQ_CORE = `ORBITX FACTS (do not invent beyond this)

WHAT: OrbitX is an on-chain operating system for crypto — primarily Solana, with 16-chain data aggregation. One destination / unified desk that collapses scanners, DEX terminals, launchpads, Telegram, X, voice rooms, portfolio tools, and prediction sites into one wallet-identity-connected environment. OG Scan was the old name. The live product and website are OrbitX at ${ORBITX_HOST}. Do not name retired domains.

README CORE: OrbitX DEX (live at ${ORBITX_HOST}/ORBITX_DEX) aggregates public blockchain and market data across 16 chains and surfaces what most tools hide: dev-wallet and dev-sold status, the first on-chain buyer, paid-listing status, whale/KOL holders, real all-time-high history, bundle/sniper detection, and wallet copy-tracking.

TAGLINE: Forensic token intelligence · Social feed · Live voice & video · Prediction markets & games · Free token launchpad · Per-token AI analyst · Public MCP agent API · Non-custodial by design.

LIVE: ${ORBITX_HOST} (prefer www) · DEX ${ORBITX_HOST}/ORBITX_DEX · GitHub ${ORBITX_GITHUB} (repo name only — not the website) · X @orbitx_wrld · GC ${ORBITX_GC}

TOKEN $ORBITX: mint ${ORBITX_MINT} · Solana Token-2022 (extensions noted on explorers) · mint authority described as renounced / Pump.fun origin in early data · single utility + access + fuel token · not a yield token · not a passive claim token. Never invent live MC/holders/price — tell them /token ${ORBITX_MINT} or paste a CA.

HOLD: ≥ $5 USD of $ORBITX → OrbitX AI + basic MCP. 10,000 $ORBITX → Pro/KOL DEX layer (higher-tier signals, KOL surfaces). Holding also gates higher-access City rooms, private events, exclusive surfaces. Checks are non-custodial (balance or cumulative buy history). Some internal agent caches use $10 + 24h; public messaging is ≥ $5 and 10k.

BURN: 100 $ORBITX = 1 hour MCP. 1,000 $ORBITX = 1 day. 10,000 = 1 week. 1,000,000 (1000k) = 1 month. Stackable (new duration extends from later of now or current expiry). Shop / Telegram: one Jupiter signature → buys required $ORBITX with SOL → exact purchased supply burned in the same tx → Solscan link → /verify the link. Team does not take those funds as revenue. Items bind permanently to the purchasing wallet. Holding = persistent baseline; burning = time-limited or one-shot entitlements. Flywheel: more usage → more burns → less circulating supply. No extraction layer between platform activity and the burn address.

MCP: Agent hub ${ORBITX_HOST}/agent · Agent MCP ${ORBITX_HOST}/api/mcp · also GET/POST /api/ogdex/mcp and /api/orbitx/... · X MCP ${ORBITX_HOST}/x and ${ORBITX_HOST}/api/x/mcp. Claude / ChatGPT / Grok / Cursor / custom agents. User still signs trades with their own wallet.

CUSTODY: Non-custodial. OrbitX never holds keys or funds. User signs in Jupiter Wallet.

PREDICTIONS: Native markets/games. “Solana-betting” in this training maps to the Anchor program at programs/betting/ inside audifyx/og-scan — not a separate standalone Solana-betting repo under the same ownership. Peer-to-peer style, no house edge in the announced model. UI ${ORBITX_PREDICTIONS_URL}

LAUNCH: Free launch to pump.fun inside OrbitX (/orbitxlaunch). Optional vanity mints ending orbit / obx.

CODE: Vite+React SPA under web/ (not Next.js for the main app). Vercel functions, Supabase, R3F City. Betting program programs/betting/. EVM curve contracts exist for multi-chain launch path.

QUICK ANSWERS
- What is OrbitX? On-chain OS unifying DEX/forensics, launchpad, social, voice, predictions, gaming, AI agents, and City under one wallet identity. Live site ${ORBITX_HOST}. DEX ${ORBITX_HOST}/ORBITX_DEX.
- Utility? Hold ≥ $5 for AI + basic MCP; hold 10k for Pro/KOL DEX; burn 100 = 1 hour MCP / 1,000 = 1 day / 10,000 = 1 week / 1,000,000 = 1 month (stackable); burn for shop seats, listings, intel, API keys; usage drives further burns.
- Connect MCP? Hold required $ORBITX or burn a seat, then point any MCP client at /api/ogdex/mcp or /api/mcp via ${ORBITX_HOST}/agent.
- Burning? On-chain burn of $ORBITX (direct time seats or Jupiter buy-and-burn for shop). Stackable for MCP. Solscan verification. Permanent supply cut.
- Custodial? No. User always signs with their own wallet.
- Where is the code? ${ORBITX_GITHUB} (betting under programs/betting/).
- Free vanity launch? Yes — pump.fun with optional orbit/obx vanity mint.
- Predictions? Native P2P-style markets + games powered by programs/betting/.

CAVEATS: Feature flags and shop prices change. Early-stage user metrics. Some City/mobile/curve-graduation surfaces have been in active development or beta. If unsure or live-ops, send them to ${ORBITX_GC} and a team member. No seed phrases. No fake quotes. Proprietary (© OrbitX) but the repo is public for transparency.`;

export const ORBITX_FAQ_CHUNKS = [
  {
    id: "what",
    title: "What is OrbitX",
    keys: [
      "what is",
      "who is",
      "orbitx",
      "og scan",
      "operating system",
      "os for crypto",
      "ogscan",
      "unified desk",
      "rebrand",
      "definition",
    ],
    text: `OrbitX is an on-chain OS for crypto, focused primarily on Solana but with multi-chain (16 chains) data aggregation. It is a single destination / unified desk that collapses the fragmented Solana trading stack (scanners, DEX terminals, launchpads, Telegram, X, voice rooms, portfolio tools, prediction sites) into one wallet-identity-connected environment. Official site: ${ORBITX_HOST}. OrbitX DEX (${ORBITX_HOST}/ORBITX_DEX) aggregates public blockchain and market data across 16 chains and surfaces what most tools hide: dev-wallet and dev-sold status, the first on-chain buyer, paid-listing status, whale/KOL holders, real ATH history, bundle/sniper detection, and wallet copy-tracking. Tagline set: forensic intel, social feed, live voice & video, predictions & games, free launchpad, per-token AI analyst, public MCP, non-custodial. OG Scan was the old name — the live site is ${ORBITX_HOST}. GitHub repo is still audifyx/og-scan (source code only). Explicitly not “another scanner / launchpad / terminal” — it is the OS layer where trading, launching, social, intelligence, AI agents, prediction markets, and a persistent 3D City coexist.`,
  },
  {
    id: "token",
    title: "$ORBITX token",
    keys: [
      "token",
      "orbitx mint",
      "ca",
      "contract",
      "ticker",
      "$orbitx",
      "token-2022",
      "utility",
      "mint authority",
      "renounced",
    ],
    text: `$ORBITX mint ${ORBITX_MINT} on Solana (Token-2022, with extensions noted in explorers). Single utility, access, and fuel token across the entire ecosystem — not a yield token and not a passive claim token. Mint authority described as renounced / Pump.fun origin in early data. Live market data fluctuates — always verify current MC/holders/price on-chain or via /token, Solscan, Jupiter, Dexscreener, Solana Compass. Never quote stale snapshots.`,
  },
  {
    id: "hold",
    title: "Holding $ORBITX",
    keys: [
      "hold",
      "holding",
      "gate",
      "gating",
      "$5",
      "5 usd",
      "10000",
      "10,000",
      "10k",
      "pro",
      "kol layer",
      "unlock",
      "token gate",
    ],
    text: `Hold ≥ $5 USD value of $ORBITX → unlocks OrbitX AI + basic MCP access. Hold 10,000 $ORBITX → unlocks Pro / KOL layer in the DEX (higher-tier signals, community/KOL surfaces). Holding also gates higher-access rooms, private events, and exclusive surfaces inside OrbitX City. Token gating is checked non-custodially (balance or cumulative buy history). Some internal agent systems reference a $10 threshold with 24-hour caching for performance; public utility messaging centers on the ≥ $5 and 10k token tiers. Holding provides the baseline persistent access layer.`,
  },
  {
    id: "burn",
    title: "Burning $ORBITX",
    keys: [
      "burn",
      "burning",
      "seat",
      "100 ",
      "1000",
      "1,000",
      "stack",
      "stackable",
      "solscan",
      "flywheel",
      "mcp access",
      "time burn",
    ],
    text: `MCP time burns: 100 $ORBITX = 1 hour; 1,000 = 1 day; 10,000 = 1 week; 1,000,000 = 1 month. Burns are stackable — if you burn again before expiry, the new duration extends from the later of “now” or the current expiry (time is additive). Implemented via dedicated endpoints (mcp-burn-access flows, Supabase tables for grants/expiry). Burning does not grant permanent ownership of seats the way holding does; it grants time-limited or one-time entitlements that further burns can extend. Automatic / activity burns: platform usage is structured so certain actions contribute to burn pressure (exact automatic mechanisms vary by surface) as part of the stated flywheel. Verification: Solscan links. Gating/grants checked against on-chain state or indexed history + DB entitlements (with RLS). Summary: “Hold for access. Burn for temporary premium access. The more the ecosystem is used, the more $ORBITX is burned.”`,
  },
  {
    id: "shop",
    title: "OrbitX Shop / buy-and-burn",
    keys: [
      "shop",
      "jupiter",
      "buy-and-burn",
      "buy and burn",
      "listing credit",
      "spotlight",
      "intel pack",
      "api key",
      "creator tools",
      "bundle",
    ],
    text: `Shop burn flow (critical): user selects an item → one Phantom signature → Jupiter swap buys the required $ORBITX with SOL → the exact purchased supply is burned in the same transaction → Solscan link for verification. The team does not take the funds as revenue; the design creates buy pressure + permanent supply reduction. Items stay permanently bound to the purchasing wallet. Shop covers MCP seats (3d / 7d / 30d packs), API keys, intel packs / desk notes, listing credits, spotlight/featured placements, creator tools (relist CA, refresh name/ticker/logo, market bumps, holder notes, vanity rail), size presets, bag filters, price alerts, and other tool unlocks. Observed shop prices have ranged from a few dollars equivalent up to ~$200 for high-end bundles — never invent the current USD price; send them /shop or ${ORBITX_HOST}/shop. Flywheel: more usage (trades, launches, shop purchases, MCP calls, listings) → more automatic or intentional burns → reduced circulating supply. There is no extraction layer between platform activity and the burn address.`,
  },
  {
    id: "mcp",
    title: "MCP connection",
    keys: [
      "mcp",
      "claude",
      "chatgpt",
      "gpt",
      "grok",
      "cursor",
      "api/mcp",
      "model context",
      "connector",
      "ogdex/mcp",
      "public api",
    ],
    text: `MCP is a first-class public agent API so any MCP-compatible assistant (Claude, GPT/ChatGPT, Grok, Cursor, custom agents) can call OrbitX tools without tab-switching. Primary: GET/POST /api/ogdex/mcp and related /api/orbitx/... plus Agent MCP ${ORBITX_HOST}/api/mcp. Setup hub: ${ORBITX_HOST}/agent. X MCP: ${ORBITX_HOST}/x and ${ORBITX_HOST}/api/x/mcp (post/reply/DM/schedule via connected X). Capabilities: token lookup, screener, forensics (dev wallet, first buyer, bundle/sniper, paid listing), ATH history, wallet PnL, chart data, board/intel, holders tools (premium), execution (trade via Jupiter, NFT mint via Metaplex, token launch, social posting). Access: (1) hold ≥ $5 $ORBITX or equivalent cumulative buy history → OrbitX AI + basic MCP; (2) burn 100 / 1,000 $ORBITX (or shop 3/7/30d packs) for extended seats, stackable; (3) token gating may cache verification 24h to avoid chain spam. Earlier messaging mentioned usage-based credits (starting free, then pay-per-use); the dominant live model is hold + burn seats. Flow: agent command → API (auth + ownership) → verify Phantom where needed → MCP Executor (trade / mint / launch / social / query) → log activity → return result. Full audit trail of MCP executions, key usage, and agent activity. User signs; OrbitX does not custody. Official Telegram bot is @theorbitxmcpbot — groups public intel; DMs /login for writes.`,
  },
  {
    id: "agents",
    title: "Agent hub",
    keys: [
      "agent hub",
      "api keys",
      "sha-256",
      "fal",
      "oauth",
      "create agent",
      "agent management",
      "activity log",
    ],
    text: `Agent management (production-ready per delivery docs): create/read/update/delete agents, per-agent API keys (SHA-256 hashed), wallet connection (Phantom), activity logging, settings, X/Twitter OAuth for posting, Claude content generation, Fal image generation. RLS isolation. Point Claude/ChatGPT/Grok/Cursor at ${ORBITX_HOST}/agent. MCP turns the AI into an interface to the whole desk: “Analyze this wallet,” “Generate the report,” “Post the thread,” “Launch the token,” “Mint,” “Burn,” while staying non-custodial.`,
  },
  {
    id: "dex",
    title: "DEX / forensics",
    keys: [
      "dex",
      "scanner",
      "forensic",
      "xray",
      "ath",
      "bundle",
      "sniper",
      "whale",
      "screener",
      "ogscan",
      "16 chain",
      "16 chains",
      "orbitx score",
      "bubble map",
      "anti-vamp",
      "paid listing",
      "dev-sold",
      "first buyer",
    ],
    text: `OrbitX DEX / screener: curated multi-chain (16) discovery with garbage filtering. Every token page includes trust verdict, dev-wallet / dev-sold status, first on-chain buyer, paid-listing flag, bundle/sniper detection, whale/KOL holders, real ATH history, proprietary Bubble Maps, OrbitX Score (on-chain metrics + holder quality + momentum + AI signals). Anti-vamp checks are first-class. In Telegram: drop a CA or /token /scan /xray /research /forensics for a branded card. Live: ${ORBITX_HOST}/ORBITX_DEX.`,
  },
  {
    id: "wallet",
    title: "Wallet intel / copy-tracking",
    keys: [
      "wallet",
      "copy-tracking",
      "copy tracking",
      "pnl",
      "smart-money",
      "smart money",
      "follow wallet",
      "kol",
      "ansem",
      "whale alert",
    ],
    text: `Wallet intelligence & copy-tracking: full portfolio (realized/unrealized PnL), smart-money directory with live buy/sell feed, ability to follow up to 10 wallets, KOL labels (Ansem and many others mapped), whale alerts, one-click actions. Gating for Pro/KOL DEX surfaces is non-custodial against $ORBITX balance or history.`,
  },
  {
    id: "coinai",
    title: "Coin AI / per-token analyst",
    keys: ["coin ai", "per-token", "analyst", "citation", "web search", "the coin ai"],
    text: `The Coin AI / per-token AI analyst: every token receives its own AI agent grounded in live on-chain data + live web search, with citations and Solscan links. OrbitX AI super-app lives at ${ORBITX_HOST}/ai (wallet-gated) plus this Telegram bot.`,
  },
  {
    id: "pulse",
    title: "Pulse / sniper feeds",
    keys: [
      "pulse",
      "snipe",
      "sniper",
      "new pairs",
      "og finder",
      "migrations",
      "momentum",
      "swap feed",
    ],
    text: `Pulse & multi-source sniper: real-time momentum, Snipe Feed, Scanner, New Pairs, OG Finder, Migrations, Swap feeds with safety chips. Complements the DEX forensics card (bundle/sniper detection on each token).`,
  },
  {
    id: "launch",
    title: "Launchpad",
    keys: [
      "launch",
      "launchpad",
      "pump",
      "vanity",
      "orbit mint",
      "obx",
      "free launch",
      "create token",
      "bonding curve",
      "orbitxcurve",
    ],
    text: `Free launchpad: launch directly to pump.fun from inside OrbitX (${ORBITX_HOST}/orbitxlaunch). Free (launch fee previously removed). Optional automatic vanity mint addresses ending in “orbit” / “obx” (server-side generation with configurable max iterations). Anti-rug safeguards, auto-listing, post-launch monitoring, creator fee claims. Additional EVM bonding-curve launch path (OrbitXCurve.sol + migrator, CREATE2 factory, graduation to DEX with LP burn) exists for multi-chain. Telegram DMs: /launch after /login.`,
  },
  {
    id: "surfaces",
    title: "Product surfaces",
    keys: [
      "city",
      "play",
      "intel",
      "hq",
      "os",
      "terminal",
      "nft",
      "predictions",
      "route",
      "where is",
      "pages",
      "/app",
      "home hub",
    ],
    text: `Platform-map surfaces on ${ORBITX_HOST}: City /Orbitxcity (persistent 3D world / desk, web/src/pages/orbitxcity) · OrbitX OS /os (frontend UX shell, web/src/os) · Play Studio /play (gaming, web/src/gaming) · Crypto Intel /intel (web/src/crypto) · Social HQ /hq (web/src/social) · DEX /ORBITX_DEX (web/ogdex, production DEX/scanner) · OrbitX AI /ai · Telegram /telegram · Launchpad /orbitxlaunch · Terminal /terminal · Shop · NFT /nft · Predictions · Agent Hub /agent. Additional home hub /app provides public navigation to City, OS, Play, Intel, HQ, Shop, Predictions, Terminal, DEX, Trade, Agent, X MCP, Social, NFT, Bagwork, etc.`,
  },
  {
    id: "social",
    title: "Social / voice / streaming",
    keys: [
      "social",
      "spaces",
      "voice",
      "stream",
      "timeline",
      "hq",
      "live chat",
      "cashtag",
      "communities",
    ],
    text: `Social layer: X-style timeline, profiles, communities, per-token chat, KOL social feed, cashtag/mint linking. Live voice Spaces (lobbies, recordings) + full live streaming (camera/screen, multi-broadcaster, live chat). HQ: ${ORBITX_HOST}/hq. X posting from Telegram needs a linked DM + connected X at ${ORBITX_HOST}/x.`,
  },
  {
    id: "nft",
    title: "NFT marketplace",
    keys: ["nft", "magic eden", "collection", "drops", "metaplex", "marketplace"],
    text: `NFT marketplace at ${ORBITX_HOST}/nft: Magic-Eden-style home, explore, creator profiles, collections, drops, fee claims, analytics. Telegram /mint after /login can hit Metaplex mint paths via MCP; user still signs.`,
  },
  {
    id: "predict",
    title: "Predictions & betting",
    keys: [
      "predict",
      "betting",
      "bet",
      "market",
      "anchor",
      "p2p",
      "house edge",
      "coinflip",
      "dice",
      "crash",
      "plinko",
      "solana-betting",
      "programs/betting",
      "parimutuel",
      "prop bet",
    ],
    text: `Native prediction markets + provably-fair 1v1 games, leaderboards, achievements, wired into OrbitX insights. Backed by the on-chain Anchor program at programs/betting/ (Cargo.toml + src/) inside audifyx/og-scan. In this training corpus, “Solana-betting” maps to that program — there is no separate standalone Solana-betting repository under the same ownership. Public product description: pure peer-to-peer betting with no house edge in the announced model; real-time bets against friends or others; winner-takes-all for 2-party; proportional splits for multi-party; full refund if all parties choose the same outcome; minimal platform fees ($1–$10 range, refundable in some mutual-win cases). Users define market terms (real-world events, wild predictions, custom prop bets). Settlement/claims designed around on-chain vault / pro-rata logic. Additional gaming (Coinflip, Dice, Crash, Plinko style) is referenced in product messaging. UI ${ORBITX_PREDICTIONS_URL}.`,
  },
  {
    id: "stack",
    title: "Architecture",
    keys: [
      "stack",
      "architecture",
      "vercel",
      "supabase",
      "vite",
      "next.js",
      "anchor",
      "github",
      "repo",
      "code",
      "r3f",
      "vitest",
    ],
    text: `Frontend: Vite + React Router SPA under web/ (explicitly not Next.js for the main app). R3F for the 3D City. Supabase Realtime. Solana / Jupiter. Backend: Supabase (migrations, RLS, RPCs, edge functions oxw-*, world schema). Vercel serverless (web/api/, api/). On-chain: Anchor Rust at programs/betting/; EVM contracts for OrbitX Curve bonding curve + migrator (CREATE2 factory, graduation to DEX with LP burn); $ORBITX on Solana. AI/MCP: token-gated agents with Claude, Fal image gen, X OAuth 2.0 + PKCE, activity logging, SHA-256 API keys, RLS. Tests: Vitest. Docs under docs/ (platform map, backend, frontend OS, gaming, crypto intel, social, agents/QA swarm, NFT coin trading, launchpad fees, KOL tracker). Repo highlights: web/, supabase/, api/, programs/betting/, contracts/, docs/, SQL migrations, scripts, assets. Local (README): clone → cd og-scan/web → install → copy .env.example → npm run dev. Public GitHub ${ORBITX_GITHUB} for transparency.`,
  },
  {
    id: "roadmap",
    title: "Roadmap / team rules",
    keys: [
      "roadmap",
      "non-overlap",
      "team",
      "backend",
      "frontend",
      "gaming studio",
      "early-stage",
      "todo",
      "beta",
    ],
    text: `The project ships frequently. Focus areas visible in todos/recent activity: anti-vamp hardening, vanity mints, token page redesigns with buy/sell, NFT marketplace maturity, EVM curve graduation/audit, full Solana OS stack, mobile experiences, cinematic 3D command decks, MCP burn reliability (Jupiter signAndSend), Agent hub stability, home hub as public entry point. Team non-overlap rules (platform map): Backend = schema/API only — no UI. Frontend OS = visuals/shell — no backend ownership. Gaming = play systems only — no trading backend. Crypto = scanner/terminal/intel — no social/games. Social = HQ/communities/growth — no trading engines. Everything is source-available on the public GitHub. The platform remains early-stage in absolute user metrics while the product surface is already broad — do not invent user/follower counts.`,
  },
  {
    id: "tgtrade",
    title: "Telegram login / trade",
    keys: [
      "telegram",
      "autobuy",
      "auto buy",
      "buy with",
      "usdc",
      "trade",
      "login",
      "linked",
      "theorbitxmcpbot",
    ],
    text: `Official bot @theorbitxmcpbot. Groups: public intel. DMs: /start introduces the bot, then asks for an early access code or a burn. /login links THIS Telegram user to YOUR OrbitX wallet — nobody else can spend it. /burn hour|day|week|month = Jupiter buy then burn; /verify plus the Solscan link grants timed access. Trade alts with SOL or USD/USDC quotes (“buy <CA> with 10$ usdc”, “buy 0.1 sol of $ORBITX”). /autobuy on = Jupiter Wallet auto-prompt (you still sign). /shop burns 100 $ORBITX (1 hour), 1,000 (1 day), 10,000 (1 week), or 1,000,000 (1 month), or buys credits. /launch /mint /nft after login. /call name runs any live OrbitX tool. Never invent live prices — /token for quotes.`,
  },
  {
    id: "custody",
    title: "Non-custodial",
    keys: ["custodial", "custody", "keys", "seed", "non-custodial", "phantom", "sign", "private key"],
    text: `OrbitX never takes custody of funds or private keys. Every trade is signed by the user’s own wallet (Jupiter Wallet). Pro/tier gates are checked non-custodially against token balance or history. Never ask for a seed phrase. Telegram /buy /sell prepares a tx the user signs in Jupiter.`,
  },
  {
    id: "answers",
    title: "Common FAQ answers",
    keys: ["faq", "quick answer", "decision tree", "common question", "how do i"],
    text: `Common answers: (1) OrbitX = on-chain OS for Solana crypto unifying DEX/forensics, launchpad, social, voice, predictions, gaming, AI agents, and City under one wallet identity — live ${ORBITX_HOST} (DEX ${ORBITX_HOST}/ORBITX_DEX). (2) Utility = hold ≥ $5 for AI + basic MCP; hold 10k for Pro/KOL DEX; burn 100 = 1 hour MCP / 1,000 = 1 day / 10,000 = 1 week / 1,000,000 = 1 month (stackable); burn for shop seats/listings/intel/API keys; activity drives further burns. (3) MCP = hold required $ORBITX or burn a seat, then point any MCP client at /api/ogdex/mcp (or /api/mcp) / agent hub. (4) Burning = on-chain burn (direct time seats or Jupiter buy-and-burn for shop); stackable; Solscan; permanent supply cut. (5) Custodial? No. (6) Code: github.com/audifyx/og-scan including programs/betting/ — that is GitHub, not the website. (7) Free vanity launch to pump.fun with optional orbit/obx mint. (8) Predictions = native P2P-style markets + games via the betting program.`,
  },
  {
    id: "caveats",
    title: "Caveats",
    keys: ["caveat", "disclaimer", "stale", "don't invent", "beta", "early", "$10"],
    text: `Always prefer live on-chain data and current GitHub main over outdated snapshots. Market caps, holder counts, exact shop prices, and feature flags change — never invent them. Token gating thresholds have appeared as both ≥ $5 and $10 in different docs/surfaces; public messaging prioritizes the $5 + 10k token tiers. Some advanced features (full City, certain audits, mobile apps, full multi-chain curve graduation) have been in active development or beta. The project is proprietary (© OrbitX) but the repo is public for transparency. Do not invent roadmap items or economics beyond this corpus. Unsure / live-ops → ${ORBITX_GC} and a team member.`,
  },
];

function normalizeFaqQuery(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\$orbitx/g, "orbitx")
    .replace(/[^a-z0-9./$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function selectOrbitXFaqChunks(text, { limit = 3 } = {}) {
  const q = normalizeFaqQuery(text);
  if (!q) return ORBITX_FAQ_CHUNKS.filter((c) => c.id === "what" || c.id === "answers").slice(0, 2);

  const scored = ORBITX_FAQ_CHUNKS.map((chunk) => {
    let score = 0;
    if (q === chunk.id || q.includes(` ${chunk.id} `) || q.startsWith(chunk.id)) score += 6;
    for (const key of chunk.keys) {
      if (q.includes(key)) score += key.length > 8 ? 2 : 1;
    }
    for (const alias of ORBITX_FAQ_ALIASES) {
      if (alias.id !== chunk.id) continue;
      for (const phrase of alias.phrases) {
        const needle = normalizeFaqQuery(phrase);
        if (needle && q.includes(needle)) score += 8;
      }
    }
    return { chunk, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  const fallback = ORBITX_FAQ_CHUNKS.filter((c) => c.id === "what" || c.id === "answers").map((chunk) => ({
    chunk,
    score: 0,
  }));
  const picked = (scored.length ? scored : fallback).slice(0, limit).map((row) => row.chunk);
  const seen = new Set();
  return picked.filter((chunk) => {
    if (seen.has(chunk.id)) return false;
    seen.add(chunk.id);
    return true;
  });
}

export function orbitXFaqSystemAddon(userText) {
  const chunks = selectOrbitXFaqChunks(userText, { limit: 3 });
  const body = chunks.map((c) => `[${c.title}]\n${c.text}`).join("\n\n");
  return `${ORBITX_FAQ_CORE}\n\nDEEP DIVES FOR THIS QUESTION:\n${body}`;
}

export function formatOrbitXFaqHtml(query) {
  const q = String(query || "")
    .replace(/^(?:\/)?faq(?:@\w+)?\s*/i, "")
    .trim();
  if (!q) {
    return [
      "<b>OrbitX FAQ</b>",
      "On-chain OS for Solana crypto — DEX/forensics, launchpad, social, City, predictions, AI/MCP.",
      "Hold ≥ $5 $ORBITX → AI + basic MCP. Hold 10,000 → Pro/KOL DEX. Burn 100 = 1 hour, 1,000 = 1 day, 10,000 = 1 week, 1,000,000 = 1 month (stackable).",
      "Non-custodial. Live: https://www.orbitx.world · DEX: https://www.orbitx.world/ORBITX_DEX · GC: https://t.me/orbitxwrld",
      "",
      "Ask /faq utility · /faq mcp · /faq burn · /faq shop · /faq hold · /faq launch · /faq city",
      "Or chat: “what is OrbitX?”, “how does burning work?”, “how do I connect MCP?”",
      "",
      ...ORBITX_FAQ_CHUNKS.map((c) => `• /faq ${c.id} — ${c.title}`),
    ].join("\n");
  }
  const chunks = selectOrbitXFaqChunks(q, { limit: 2 });
  return [
    "<b>OrbitX FAQ</b>",
    ...chunks.flatMap((c) => ["", `<b>${c.title}</b>`, c.text]),
    "",
    `Live site: ${ORBITX_HOST} · DEX: ${ORBITX_HOST}/ORBITX_DEX · /token for live numbers`,
  ].join("\n");
}
