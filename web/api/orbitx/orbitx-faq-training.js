/**
 * Official OrbitX FAQ corpus for Telegram / AI agents.
 * Source: audifyx/og-scan docs, platform map, MCP/burn code, public product copy (Aug 2026).
 * Do not invent economics or unreleased feats beyond this file.
 */

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
export const ORBITX_HOST = "https://www.orbitx.world";
export const OGSCAN_HOST = "https://ogscan.fun";
export const ORBITX_GITHUB = "https://github.com/audifyx/og-scan";
export const ORBITX_GC = "https://t.me/orbitxwrld";

/** Always injected — compact facts every reply can use. */
export const ORBITX_FAQ_CORE = `ORBITX FACTS (do not invent beyond this)

WHAT: OrbitX is an on-chain operating system for crypto, primarily Solana, with 16-chain data aggregation. One wallet-identity desk for trading intel, DEX/scanner, launchpad, social, live voice/video, prediction markets, gaming, OrbitX AI, MCP agents, and 3D City. Evolution of OG Scan. Not “just a scanner / launchpad / terminal.”

LIVE: ${ORBITX_HOST} (prefer www) · DEX/scanner also ${OGSCAN_HOST} · GitHub ${ORBITX_GITHUB} · X @orbitx_wrld · GC ${ORBITX_GC}

TOKEN $ORBITX: mint ${ORBITX_MINT} · Solana Token-2022 · utility + access + fuel · not a yield/passive-claim token. Never invent live MC/holders/price — tell them /token ${ORBITX_MINT} or paste a CA.

HOLD: ≥ $5 USD of $ORBITX → OrbitX AI + basic MCP. 10,000 $ORBITX → Pro/KOL DEX layer. Holding also gates some City rooms/events. Checks are non-custodial (balance or buy history). Some internal caches use 24h; public messaging is $5 + 10k. A $10 hold appears in some older docs — prefer $5 publicly.

BURN: 100 $ORBITX = 1 day MCP. 1,000 $ORBITX = 7 days MCP. Stackable (new time adds from later of now or current expiry). Shop burns: one Phantom sig → Jupiter buys $ORBITX with SOL → exact amount burned in the same tx → Solscan link. Team does not take that as revenue. Items bind to the buying wallet.

MCP: Agent hub ${ORBITX_HOST}/agent · Agent MCP ${ORBITX_HOST}/api/mcp · also /api/ogdex/mcp · X MCP ${ORBITX_HOST}/x and ${ORBITX_HOST}/api/x/mcp. Claude / ChatGPT / Grok / Cursor can use tools. User still signs trades with their own wallet.

CUSTODY: Non-custodial. OrbitX never holds keys or funds. Phantom / Jupiter. User signs.

PREDICTIONS: Native markets/games wired in this repo at programs/betting/ (Anchor). Peer-to-peer style, no house edge in announced model. UI ${ORBITX_HOST}/predictions

LAUNCH: Free launch to pump.fun inside OrbitX (/orbitxlaunch). Optional vanity mints ending orbit / obx.

CODE: Vite+React SPA under web/ (not Next.js for the main app). Vercel functions, Supabase, R3F City. Betting program programs/betting/. EVM curve contracts exist for multi-chain launch path.

CAVEATS: Feature flags and shop prices change. Early-stage user metrics. If unsure or live-ops, send them to ${ORBITX_GC} and a team member. No seed phrases. No fake quotes.`;

export const ORBITX_FAQ_CHUNKS = [
  {
    id: "what",
    title: "What is OrbitX",
    keys: ["what is", "who is", "orbitx", "og scan", "operating system", "os for crypto", "ogscan"],
    text: `OrbitX is an on-chain OS for crypto. It collapses scanners, DEX terminals, launchpads, Telegram, X, voice rooms, portfolio tools, and prediction sites into one wallet-connected desk. Core: OrbitX DEX (ogscan.fun) aggregates public chain/market data across 16 chains and surfaces what most tools hide: dev wallet / dev-sold, first on-chain buyer, paid listing, whale/KOL holders, real ATH, bundle/sniper detection, wallet copy-tracking. Tagline set: forensic intel, social feed, live voice & video, predictions & games, free launchpad, per-token AI analyst, public MCP, non-custodial. Repo audifyx/og-scan. Sites: orbitx.world and ogscan.fun.`,
  },
  {
    id: "token",
    title: "$ORBITX token",
    keys: ["token", "orbitx mint", "ca", "contract", "ticker", "$orbitx", "token-2022", "utility"],
    text: `$ORBITX mint ${ORBITX_MINT} on Solana (Token-2022). Single utility/access/fuel token for the ecosystem — not yield, not a passive claim token. Mint authority described as renounced / Pump.fun origin in early data. Always verify live MC/holders/price with /token — do not quote stale snapshots.`,
  },
  {
    id: "hold",
    title: "Holding $ORBITX",
    keys: ["hold", "holding", "gate", "gating", "$5", "5 usd", "10000", "10,000", "10k", "pro", "kol layer", "unlock"],
    text: `Hold ≥ $5 of $ORBITX to unlock OrbitX AI + basic MCP. Hold 10,000 $ORBITX for Pro/KOL DEX layer (higher-tier signals, KOL surfaces). Holding also gates higher-access City rooms/private events. Gating is non-custodial (balance or cumulative buy history). Some agent caches last 24h. Public messaging: $5 and 10k tiers (not the older $10 note).`,
  },
  {
    id: "burn",
    title: "Burning $ORBITX",
    keys: ["burn", "burning", "shop", "seat", "100 ", "1000", "1,000", "stack", "jupiter", "solscan", "flywheel"],
    text: `MCP time: burn 100 $ORBITX = 1 day, 1,000 = 7 days, stackable from the later of now or current expiry. Shop: select item → one Phantom signature → Jupiter swap buys required $ORBITX with SOL → that supply is burned in the same transaction → Solscan link. Team does not pocket that as revenue; buy pressure + permanent supply cut. Items stay bound to the purchasing wallet. Shop also covers MCP seats (3d/7d/30d packs), API keys, intel packs, listing credits, spotlights, creator tools, vanity rail, alerts. Flywheel: more usage → more burns → less circulating supply. Holding = persistent baseline; burning = time-limited or one-shot entitlements.`,
  },
  {
    id: "mcp",
    title: "MCP connection",
    keys: ["mcp", "claude", "chatgpt", "gpt", "grok", "cursor", "agent", "api/mcp", "model context", "connector"],
    text: `MCP lets Claude, ChatGPT, Grok, Cursor, and custom agents call OrbitX tools. Setup: ${ORBITX_HOST}/agent. Agent MCP URL: ${ORBITX_HOST}/api/mcp (also /api/ogdex/mcp). X MCP: ${ORBITX_HOST}/x and ${ORBITX_HOST}/api/x/mcp. Access: hold ≥ $5 for basic; burn 100/1,000 $ORBITX for timed seats. Agents have API keys (hashed), wallet link (Phantom), activity logs, optional X OAuth. Flow: command → auth/ownership → Phantom when needed → executor (query/trade/mint/launch/social) → log → result. User signs; OrbitX does not custody. Telegram bot is @theorbitxmcpbot — groups public intel; DMs /login for writes.`,
  },
  {
    id: "dex",
    title: "DEX / forensics",
    keys: ["dex", "scanner", "forensic", "xray", "ath", "bundle", "sniper", "whale", "screener", "ogscan", "16 chain"],
    text: `OrbitX DEX / screener: curated multi-chain (16) discovery. Token pages: trust verdict, dev-wallet / dev-sold, first buyer, paid listing, bundle/sniper, whale/KOL holders, real ATH, bubble maps, OrbitX Score, anti-vamp. Wallet intel: PnL, smart-money directory, follow wallets, KOL labels, whale alerts. In Telegram: drop a CA or /token /scan /xray for a branded card. Live: ${ORBITX_HOST}/ORBITX_DEX and ${OGSCAN_HOST}.`,
  },
  {
    id: "launch",
    title: "Launchpad",
    keys: ["launch", "launchpad", "pump", "vanity", "orbit mint", "obx", "free launch", "create token"],
    text: `Free launchpad to pump.fun from inside OrbitX (${ORBITX_HOST}/orbitxlaunch). Optional vanity mints ending in orbit / obx (server-side, configurable iterations). Anti-rug checks, auto-listing, post-launch monitoring, creator fee claims. Extra EVM bonding-curve path (OrbitXCurve + migrator) exists for multi-chain. Telegram DMs: /launch after /login.`,
  },
  {
    id: "surfaces",
    title: "Product surfaces",
    keys: ["city", "play", "intel", "hq", "os", "terminal", "shop", "nft", "predictions", "route", "where is", "pages"],
    text: `Routes on ${ORBITX_HOST}: City /Orbitxcity · OS /os · Play /play · Intel /intel · Social HQ /hq · DEX /ORBITX_DEX · AI /ai · Telegram /telegram · Launchpad /orbitxlaunch · Terminal /terminal · Shop /shop · NFT /nft · Predictions /predictions · Agent /agent · X MCP /x · Trade /trade. Home hub navigates these. City is the persistent 3D world. OS is the desktop shell. Play is gaming studio. Intel is crypto intelligence. HQ is social/growth.`,
  },
  {
    id: "social",
    title: "Social / voice / AI analyst",
    keys: ["social", "spaces", "voice", "stream", "timeline", "coin ai", "analyst", "hq"],
    text: `Social: X-style timeline, profiles, communities, per-token chat, KOL feed, cashtag/mint linking. Live voice Spaces + live streaming (camera/screen, chat). Every token can have a Coin AI analyst grounded in live on-chain data + web search with citations/Solscan. HQ: ${ORBITX_HOST}/hq. X posting from Telegram needs a linked DM + connected X at ${ORBITX_HOST}/x.`,
  },
  {
    id: "predict",
    title: "Predictions & betting",
    keys: ["predict", "betting", "bet", "market", "anchor", "p2p", "house edge", "coinflip", "dice", "crash", "plinko"],
    text: `Native prediction markets and games. On-chain Anchor program lives in this repo at programs/betting/ (not a separate public “solana-betting” product repo in this training). Announced model: peer-to-peer, no house edge, winner-takes-all or pro-rata, refund if everyone picks the same side, small platform fees. UI ${ORBITX_HOST}/predictions. Extra arcade-style games appear in product copy (coinflip/dice/crash/plinko).`,
  },
  {
    id: "stack",
    title: "Architecture",
    keys: ["stack", "architecture", "vercel", "supabase", "vite", "next.js", "anchor", "github", "repo", "code"],
    text: `Main app: Vite + React Router SPA in web/ — not Next.js. R3F City. Supabase (RLS, RPCs, edge oxw-*). Vercel serverless web/api. Solana/Jupiter. Anchor betting at programs/betting/. EVM curve contracts for multi-chain launch. Vitest. Docs under docs/. Clone → cd web → pnpm/npm install → npm run dev. Transparency: public GitHub ${ORBITX_GITHUB}.`,
  },
  {
    id: "custody",
    title: "Non-custodial",
    keys: ["custodial", "custody", "keys", "seed", "non-custodial", "phantom", "sign"],
    text: `OrbitX never takes custody of funds or private keys. Every trade is signed by the user’s wallet (Phantom / Jupiter). Pro/tier gates check token balance or history on-chain. Never ask for a seed phrase. Telegram /buy /sell prepares a tx the user signs.`,
  },
];

export function selectOrbitXFaqChunks(text, { limit = 3 } = {}) {
  const q = String(text || "").toLowerCase();
  if (!q.trim()) return ORBITX_FAQ_CHUNKS.slice(0, 2);
  const scored = ORBITX_FAQ_CHUNKS.map((chunk) => {
    let score = 0;
    for (const key of chunk.keys) {
      if (q.includes(key)) score += key.length > 8 ? 2 : 1;
    }
    return { chunk, score };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  const picked = (scored.length ? scored : ORBITX_FAQ_CHUNKS.map((chunk) => ({ chunk, score: 0 })))
    .slice(0, limit)
    .map((row) => row.chunk);
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
      "Hold ≥ $5 $ORBITX → AI + basic MCP. Hold 10,000 → Pro/KOL DEX. Burn 100 = 1 day MCP, 1,000 = 7 days (stackable).",
      "Non-custodial. Live: https://www.orbitx.world · DEX: https://ogscan.fun · GC: https://t.me/orbitxwrld",
      "",
      "Ask /faq utility · /faq mcp · /faq burn · /faq hold · /faq city · /faq launch",
      "Or just chat: “what is OrbitX?”, “how does burning work?”, “how do I connect MCP?”",
      "",
      ...ORBITX_FAQ_CHUNKS.map((c) => `• ${c.title}`),
    ].join("\n");
  }
  const chunks = selectOrbitXFaqChunks(q, { limit: 2 });
  return [
    "<b>OrbitX FAQ</b>",
    ...chunks.flatMap((c) => ["", `<b>${c.title}</b>`, c.text]),
    "",
    `Live site: ${ORBITX_HOST} · DEX: ${OGSCAN_HOST} · /token for live numbers`,
  ].join("\n");
}
