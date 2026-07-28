export type DocSection = { title: string; content: string };

export const PLATFORM_TERMS: DocSection[] = [
  {
    title: "1. Acceptance",
    content:
      "By accessing OrbitX (ogscan.fun / orbitx.world) — including OrbitX DEX, Launchpad, NFT Marketplace, Social, Intel, Gaming, and related apps, APIs, or bots — you agree to these Terms of Service. If you do not agree, do not use the platform.",
  },
  {
    title: "2. What OrbitX is",
    content:
      "OrbitX is a non-custodial crypto platform: trading intelligence, token discovery, launch tools, social features, live audio/video, prediction markets, and games. Data is aggregated from public on-chain and third-party sources (Jupiter, GeckoTerminal, DexScreener, CoinGecko, Helius, Blockscout, pump.fun, and others) and may be delayed, incomplete, or inaccurate.",
  },
  {
    title: "3. No financial advice",
    content:
      "Nothing on OrbitX is financial, investment, legal, or tax advice, nor a recommendation or solicitation to buy, sell, or hold any asset. AI responses are automated and may be wrong. You are solely responsible for your decisions. Crypto assets are volatile and high-risk — you can lose everything.",
  },
  {
    title: "4. Non-custodial design",
    content:
      "OrbitX never takes custody of your funds or private keys. Trades and launches are signed locally by your wallet and routed to public programs. Copy-tracking and alerts are informational only — no auto-execution unless you explicitly sign each action.",
  },
  {
    title: "5. Accounts & acceptable use",
    content:
      "You are responsible for account security. Do not spam, impersonate, scrape excessively, abuse the API, attempt to disrupt the service, or use unauthorized bots. We may suspend accounts that violate these terms. Community creators may moderate their spaces; OrbitX may remove harmful content.",
  },
  {
    title: "6. Listings & third-party tokens",
    content:
      "Trending lists, boosts, launches, and community posts do not imply endorsement. Tokens may be scams or rug pulls. Verify contract addresses, liquidity, and ownership yourself before interacting.",
  },
  {
    title: "7. Intellectual property",
    content:
      "OrbitX branding, code, and platform content are owned by the OrbitX team. User-generated content remains yours, but you grant OrbitX a license to display it on the platform.",
  },
  {
    title: "8. Limitation of liability",
    content:
      "OrbitX is provided \"as is\" without warranties. To the fullest extent permitted by law, we are not liable for trading losses, data inaccuracies, service interruptions, smart-contract risk, slippage, MEV, failed transactions, or any damages arising from platform use.",
  },
  {
    title: "9. Changes & termination",
    content:
      "We may update these terms or discontinue features at any time. Continued use after changes constitutes acceptance. You may delete your account via Settings; we may terminate accounts for violations.",
  },
  {
    title: "10. Contact",
    content:
      "Questions: Telegram @orbitxwrld (t.me/orbitxwrld) or in-app support. Updates: t.me/OrbitXupdates.",
  },
];

export const PLATFORM_PRIVACY: DocSection[] = [
  {
    title: "Overview",
    content:
      "OrbitX (ogscan.fun) is a non-custodial, privacy-light platform. You can browse trading intelligence without an account. We do not sell your personal data and never receive your private keys or seed phrase.",
  },
  {
    title: "1. Information we collect",
    content:
      "We collect as little as possible: anonymous aggregated usage (page views, feature events); account data if you create one (email, username, profile fields); your public wallet address if you connect one; content you create (posts, chat, Spaces, streams); and coarse security signals (IP, device fingerprint on sign-in) to prevent abuse.",
  },
  {
    title: "2. How we use it",
    content:
      "To operate and secure OrbitX: serve features, sync profiles and watchlists, deliver opt-in alerts, prevent abuse, rate-limit the public API, and improve reliability. We do not use your data for third-party advertising.",
  },
  {
    title: "3. Wallets & on-chain data",
    content:
      "Connecting a wallet shares only your public address. Trades are signed locally — OrbitX never takes custody. On-chain data is already public; OrbitX organizes and presents it.",
  },
  {
    title: "4. Social, Spaces & live streaming",
    content:
      "Posts, profiles, communities, Spaces, and live streams are shared with other users by design. Live media is transmitted via LiveKit; we do not record camera/mic/screen unless a recording feature is explicitly enabled. You can delete your own content.",
  },
  {
    title: "5. Cookies & local storage",
    content:
      "Minimal functional storage only — watchlists, theme, session flags in browser local storage unless you opt into account sync. No third-party ad trackers.",
  },
  {
    title: "6. Third-party services",
    content:
      "Market data from Jupiter, GeckoTerminal, DexScreener, CoinGecko, Helius, RugCheck, pump.fun, and others. Auth/storage via Supabase; live media via LiveKit; AI may perform live web searches. Each provider has its own policy.",
  },
  {
    title: "7. Security & retention",
    content:
      "Encrypted connections, role-restricted access, row-level security on Supabase. We retain data only as long as needed, then delete or anonymize. No system is perfectly secure — use strong passwords and protect your wallet.",
  },
  {
    title: "8. Your rights",
    content:
      "View/edit your profile, delete content, disconnect your wallet, and request export or deletion via Settings or support. GDPR/CCPA rights honored on valid requests.",
  },
  {
    title: "9. Children",
    content:
      "OrbitX is not directed to children under 13. Crypto trading is high-risk and intended for adults.",
  },
  {
    title: "10. Changes & contact",
    content:
      "We may update this policy; material changes are announced via our Updates channel. Privacy inquiries: t.me/orbitxwrld.",
  },
];

export type RoadmapStatus = "done" | "progress" | "planned";

export type RoadmapPhase = {
  phase: string;
  title: string;
  desc?: string;
  items: { t: string; s: RoadmapStatus }[];
};

export const PLATFORM_ROADMAP: RoadmapPhase[] = [
  {
    phase: "Phase 1",
    title: "Foundation — DEX Intelligence",
    desc: "Forensic core: any contract address → complete dossier.",
    items: [
      { t: "Multi-chain screener (16+ chains), curated discovery lists", s: "done" },
      { t: "Token page: trust verdict, AI read, holders, live trades, charts", s: "done" },
      { t: "Dev & origin forensics, ATH, Pulse signals, KOL/whale intel", s: "done" },
      { t: "Portfolio PnL, public API, PWA", s: "done" },
    ],
  },
  {
    phase: "Phase 2",
    title: "Launchpad & NFT",
    desc: "Create, launch, and trade new assets across the ecosystem.",
    items: [
      { t: "OrbitX Launchpad — pump.fun, custom mint, EVM curve factory", s: "done" },
      { t: "NFT marketplace — mint, drops, creator fees", s: "done" },
      { t: "Robinhood Chain feed + on-chain security via Blockscout", s: "done" },
      { t: "Bundle/sniper detection, resilient source fallbacks", s: "done" },
    ],
  },
  {
    phase: "Phase 3",
    title: "Automation & Pro",
    desc: "Put intelligence to work automatically.",
    items: [
      { t: "Smart alerts (price, whale, dev-sell, migration)", s: "done" },
      { t: "Wallet copy-tracking, Pro tier (non-custodial token gate)", s: "done" },
      { t: "Token sniper, full tool suite, embeddable widget", s: "done" },
      { t: "Public MCP / AI agent API", s: "done" },
    ],
  },
  {
    phase: "Phase 4",
    title: "Social Layer",
    desc: "Community identity that travels with your wallet.",
    items: [
      { t: "X-style timeline, profiles, communities, DMs", s: "done" },
      { t: "Voice Spaces + live streaming (LiveKit)", s: "done" },
      { t: "KOL social feed, moderation & creator tools", s: "progress" },
    ],
  },
  {
    phase: "Phase 5",
    title: "Convergence",
    desc: "One identity across DEX, Social, Launchpad, Gaming, Predictions.",
    items: [
      { t: "Unified cross-product reputation & on-chain context", s: "progress" },
      { t: "Creator monetization (tips, paid Spaces, premium communities)", s: "planned" },
      { t: "Prediction markets + provably-fair games wired to intel", s: "planned" },
      { t: "Copy-trading automation, native iOS/Android apps", s: "planned" },
    ],
  },
];

export type WhitepaperSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export const PLATFORM_WHITEPAPER: {
  tldr: string;
  lede: string;
  sections: WhitepaperSection[];
} = {
  tldr:
    "OrbitX is one destination for on-chain trading: forensic token intelligence, launchpad, DEX, social, live streaming, NFTs, predictions, and games — non-custodial, free to use, shipping weekly.",
  lede:
    "Every trader who has pasted a contract address into six tabs before pulling the trigger knows the problem: the data that protects you is scattered, buried, or hidden. OrbitX unifies research, community, and execution under one wallet-based identity — convergence with clarity, using only public data presented better.",
  sections: [
    {
      id: "problem",
      title: "The problem",
      paragraphs: [
        "On-chain trading is an information game, but explorers, chart sites, holder tools, Telegram, and X don't talk to each other. Developer wallets, first buyers, paid listings, whale concentration, and bundle launches are the hardest signals to find — yet they matter most.",
        "Your reputation doesn't travel between tools. OrbitX connects research, social, and launch in one place.",
      ],
    },
    {
      id: "platform",
      title: "The OrbitX platform",
      paragraphs: [
        "OrbitX is an on-chain operating system spanning multiple products on ogscan.fun:",
      ],
      bullets: [
        "OrbitX DEX — multi-chain screener, token forensics, Pulse signals, KOL intel, portfolio, Robinhood Chain feed",
        "Launchpad — pump.fun, custom vanity mint, EVM bonding curves across 12+ chains",
        "Social — X-style feed, communities, Spaces, live streaming",
        "NFT Marketplace — mint, drops, creator profiles",
        "Intel, Gaming (OrbitX City), Prediction markets — same wallet identity",
      ],
    },
    {
      id: "intel",
      title: "Intelligence layer",
      paragraphs: [
        "OrbitX normalizes market data, holder labels, safety scores, OHLCV, forensics, and live web search into one token dossier. Resilient fallbacks and edge caching keep pages fast when upstream APIs rate-limit.",
        "Every token gets a Coin AI grounded in live on-chain data plus web search — with wallet and transaction links to explorers.",
      ],
    },
    {
      id: "security",
      title: "Security & non-custodial design",
      paragraphs: [
        "OrbitX never holds funds or keys. Trades and launches are wallet-signed. Safety data informs decisions but cannot guarantee any token is safe. Copy-tracking is notify-only.",
      ],
    },
    {
      id: "api",
      title: "Built for machines",
      paragraphs: [
        "Public REST API and MCP manifest at /api/ogdex/mcp let AI assistants query token intel, screener, forensics, wallet PnL, and charts programmatically.",
      ],
    },
    {
      id: "token",
      title: "Community token",
      paragraphs: [
        "A Solana community token aligns the ecosystem and gates Pro perks non-custodially via wallet balance checks. Always verify the official contract before interacting — nothing here is an offer or promise of value.",
      ],
    },
    {
      id: "direction",
      title: "Direction",
      paragraphs: [
        "We ship weekly. Phases 1–4 delivered the forensic core, launchpad, automation, and social layer. Phase 5 Convergence unifies identity, creator monetization, predictions, and mobile apps. See the roadmap for live status.",
      ],
    },
  ],
};
