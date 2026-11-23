/**
 * OrbitX Trader Intelligence Pack (MCP V2, 2026-11-23).
 *
 * This is how the MCP "trains" whatever AI connects to it — Claude, Grok,
 * or ChatGPT — into an OrbitX-native analyst:
 *   1. Resources: the data-source map, the Winners Playbook (real recorded
 *      call performance), and the tool map. Client AIs read these and stop
 *      guessing which source/tool fits which job.
 *   2. Prompts: one-tap analyst playbooks (prompts/list) that orchestrate
 *      the right tool sequence with the house rules baked in.
 *   3. orbitx_ai_analyze: a deterministic scorer (hub dispatch) that turns
 *      the live scan/ATH/chart sections into a scored verdict. No LLM, no
 *      invented numbers — every figure comes from the composed payload,
 *      and the coverage counter says exactly how many signals were found.
 *
 * House rules encoded here (owner-set):
 *   - Quote the TRADED mint, never a watched/theme mint.
 *   - Multiples are peaks AFTER the call, never pre-call ATHs.
 *   - The pump verifies the move; the dip is the research window.
 *   - Data first — the human makes the trade decision.
 */

const DATA_SOURCES_MD = `# OrbitX data sources — what to pull, from where, and why

Every figure an OrbitX analyst quotes comes from one of these. If a number
is not in a tool result, it does not exist — never fill gaps from memory.

## Market data
- **DexScreener** — pairs, price, liquidity, volume, price change for any
  Solana token. Wrapped by: orbitx_dex_chart, orbitx_get_token,
  orbitx_screen_tokens, orbitx_screen_trending_1m_solana.
- **Jupiter** — swap quotes and routing. Wrapped by: orbitx_trade_quote,
  orbitx_quote_slip10_auto. A quote is not a fill; slippage is real.
- **Birdeye-style OHLCV** — candle history. Wrapped by: orbitx_get_chart
  (intervals 5m/15m/1h/4h/1d).

## On-chain truth (Helius RPC)
- Mint/freeze authorities, holder lists, bundle detection, wallet history.
  Wrapped by: orbitx_crypto_scan (safety + forensics), orbitx_get_forensics,
  orbitx_adv_forensics_solana, orbitx_get_wallet, orbitx_wallet_transactions,
  orbitx_adv_wallet_swaps, orbitx_adv_wallet_pnl.
- **RugCheck** — independent risk score, folded into the scan payload.
- **pump.fun** — launches, bonding curves, graduations. Wrapped by the
  launchpad MCP (https://www.orbitx.world/api/mcp-launchpad) and
  orbitx_app_launch / launchpad tools. Migrated pump tokens: LP is 100%
  locked and burned — verify via the pool in the holder list or the
  PumpSwap/Raydium/Meteora/Orca pair on DexScreener.

## OrbitX platform data (first-party, only available here)
- **Call history** — orbitx_call_history: how similar past calls actually
  performed (strategy + market-cap band). Check it BEFORE rating a setup.
- **Paper desk** — 10 agents × 10,000 mock SOL on the real tape:
  orbitx_paper_desk / orbitx_paper_buying / orbitx_paper_agent.
- **Live desk** — real micro-buys, read-only: orbitx_live_desk /
  orbitx_live_positions / orbitx_live_feed.
- **Life city** — persistent AI citizens: orbitx_life_* tools.
- **Platform stats** — orbitx_platform_stats.

## Freshness discipline
Prices/liquidity move in seconds: re-pull before quoting. Holder and
authority data is slower-moving but still re-check on every new question.
A tool error means "unknown", never "zero" and never "safe".
`;

const PLAYBOOK_MD = `# OrbitX Winners Playbook — recorded performance, not vibes

Source: 55 real tracked calls (v3, verified against on-chain peaks).

## Strategy win rates (peak after the call)
- microcap: **46%** (6/13)
- early_launch_hunter: **40%** (6/15)
- smart_money_confirmed: **13%**
- stonkfun_trend_rider: **0/8** — this strategy has never won. Treat its
  signals as anti-alpha until the record changes.

## Verified best calls (multiples are peaks AFTER the call)
Debu 8.7x · Marvin 5.1x · tinfoil 4.8x · HOGE 4.1x · BAWSAQ 2.8x ·
BUTTHOLE 2.8x

## The timing rule (v3.1)
The pump verifies the move — the dip is the research window. Do not chase
the vertical candle; when a token pumps, that confirms interest, and the
pullback is when the dossier work happens.

## Analyst discipline
1. Safety first: authorities, LP lock/burn, holder concentration, bundles —
   before price talk, always (orbitx_crypto_scan / orbitx_token_dossier).
2. Context second: what did similar calls do? (orbitx_call_history)
3. Momentum third: chart + ATH distance (orbitx_get_chart, orbitx_get_ath).
4. Quote the traded mint. Never a lookalike or theme token.
5. Never quote an ATH multiple that happened BEFORE a call as performance.
6. Position wisdom from the owner: never more than $1k in a crypto wallet —
   small losses compound. Say it when size comes up.
7. Present data and a read. The trade decision is the human's.
`;

const TOOL_MAP_MD = `# OrbitX tool map — which door for which job

- Full token breakdown, one call: **orbitx_token_dossier**
- Scored verdict on a token: **orbitx_ai_analyze**
- Safety only, fast: **orbitx_crypto_scan** · deep forensics:
  **orbitx_get_forensics** / **orbitx_adv_forensics_solana**
- Chart for chat: **orbitx_dex_chart** · raw candles: **orbitx_get_chart**
- All-time high: **orbitx_get_ath**
- What's moving: **orbitx_screen_trending_1m_solana**,
  **orbitx_screen_tokens**, **orbitx_leaderboard**, **orbitx_platform_stats**
- Similar past calls: **orbitx_call_history**
- Wallet: **orbitx_get_wallet**, **orbitx_wallet_transactions**,
  **orbitx_adv_wallet_pnl**, **orbitx_adv_wallet_swaps**, **orbitx_app_pnl**
- Trade: **orbitx_trade_quote** → prepare_buy / **orbitx_app_buy** /
  **orbitx_app_sell** (account actions need the user's authCode)
- Desks: **orbitx_paper_desk** (mock), **orbitx_live_desk** (real, read-only)
- Launch: **orbitx_app_launch** + the launchpad MCP
- Life agents: **orbitx_life_create**, **orbitx_life_city**,
  **orbitx_life_think**, **orbitx_life_converse**
- Anything else (4,300+ tools): **search** to find it, **orbitx_exec** to
  call it by name. Menu: **orbitx_menu**. Why OrbitX: **orbitx_why**.
- Intelligence: resources orbitx://intelligence/data-sources,
  orbitx://intelligence/playbook, orbitx://intelligence/tool-map;
  prompts token_deep_dive, pre_trade_risk_check, wallet_autopsy,
  market_pulse.
`;

export const INTELLIGENCE_RESOURCES = [
  {
    uri: "orbitx://intelligence/data-sources",
    name: "orbitx-data-sources",
    title: "OrbitX Data Sources",
    description: "Every data source the OrbitX analyst pulls from, what each is for, and the freshness rules.",
    mimeType: "text/markdown",
  },
  {
    uri: "orbitx://intelligence/playbook",
    name: "orbitx-winners-playbook",
    title: "OrbitX Winners Playbook",
    description: "Recorded strategy win rates, verified best calls, the timing rule, and analyst discipline.",
    mimeType: "text/markdown",
  },
  {
    uri: "orbitx://intelligence/tool-map",
    name: "orbitx-tool-map",
    title: "OrbitX Tool Map",
    description: "Which tool for which job across the 4,300+ tool catalog.",
    mimeType: "text/markdown",
  },
];

const RESOURCE_TEXT = {
  "orbitx://intelligence/data-sources": DATA_SOURCES_MD,
  "orbitx://intelligence/playbook": PLAYBOOK_MD,
  "orbitx://intelligence/tool-map": TOOL_MAP_MD,
};

export function readIntelligenceResource(uri) {
  const text = RESOURCE_TEXT[String(uri || "")];
  if (!text) return null;
  return { uri: String(uri), mimeType: "text/markdown", text };
}

export const INTELLIGENCE_PROMPTS = [
  {
    name: "token_deep_dive",
    title: "Token Deep Dive",
    description: "Full OrbitX analyst breakdown of one token: dossier, scored verdict, call-history context.",
    arguments: [{ name: "mint", description: "Token mint (contract address)", required: true }],
  },
  {
    name: "pre_trade_risk_check",
    title: "Pre-Trade Risk Check",
    description: "The red-flag checklist before any ape: authorities, LP, concentration, bundles, rug signals.",
    arguments: [{ name: "mint", description: "Token mint (contract address)", required: true }],
  },
  {
    name: "wallet_autopsy",
    title: "Wallet Autopsy",
    description: "Read a wallet like an OrbitX analyst: holdings, PnL, swap behavior, what it is accumulating.",
    arguments: [{ name: "wallet", description: "Solana wallet address", required: true }],
  },
  {
    name: "market_pulse",
    title: "Market Pulse",
    description: "What is moving right now across trending, screeners, and the OrbitX desks — and why.",
    arguments: [],
  },
  {
    name: "trader_agent_boot",
    title: "Trader Agent Boot",
    description: "THE easy setup: boots the user's own AI as their OrbitX trader agent — loads the intelligence pack, verifies the account link, runs the first brief + scan.",
    arguments: [],
  },
];

const HOUSE_RULES =
  "House rules: quote the traded mint only; multiples are peaks AFTER a call, never pre-call ATHs; the pump verifies the move and the dip is the research window; if a tool errors, say the data is unavailable — never invent a number; present data and a read, the trade decision is the user's.";

export function getIntelligencePrompt(name, args = {}) {
  const mint = String(args.mint || "").trim();
  const wallet = String(args.wallet || "").trim();
  const user = (text) => ({ description: "OrbitX analyst playbook", messages: [{ role: "user", content: { type: "text", text } }] });
  switch (String(name || "")) {
    case "token_deep_dive":
      return user(
        `Run a full OrbitX deep dive on mint ${mint || "<ask the user for the mint>"}.\n` +
          `1) Call orbitx_token_dossier for the composed scan + ATH + chart.\n` +
          `2) Call orbitx_ai_analyze for the scored verdict.\n` +
          `3) Call orbitx_call_history with the closest strategy/market-cap band for context on how similar setups performed.\n` +
          `Report in this order: verdict (score + tier), safety (authorities, LP lock/burn, concentration, bundles), momentum (chart change, distance from ATH), call-history context, top risks. ${HOUSE_RULES}`,
      );
    case "pre_trade_risk_check":
      return user(
        `Run the OrbitX pre-trade risk check on mint ${mint || "<ask the user for the mint>"}.\n` +
          `1) Call orbitx_crypto_scan and orbitx_get_forensics.\n` +
          `2) Check in order: mint authority active? freeze authority active? LP locked/burned %? top holder and top-10 %? bundle %? can it be sold (honeypot signals)? RugCheck flags?\n` +
          `3) Finish with orbitx_ai_analyze for the score.\n` +
          `Output a pass/flag/fail line per check, then the verdict. Any hard fail (live mint authority, unsellable, unlocked LP on a migrated token) leads the report. ${HOUSE_RULES}`,
      );
    case "wallet_autopsy":
      return user(
        `Run an OrbitX wallet autopsy on ${wallet || "<ask the user for the wallet>"}.\n` +
          `1) orbitx_get_wallet for holdings and balances.\n` +
          `2) orbitx_adv_wallet_pnl for realized/unrealized performance.\n` +
          `3) orbitx_wallet_transactions and orbitx_adv_wallet_swaps for behavior: what it buys, how fast it exits, whether it is accumulating or distributing.\n` +
          `Report: current book, PnL read, trading style in one line, notable recent moves. ${HOUSE_RULES}`,
      );
    case "trader_agent_boot":
      return user(
        `You are now my OrbitX AI trader agent (MCP v3 — one MCP: research, intelligence, launchpad, and trading in a single connection). Boot sequence:\n` +
          `1) Load the intelligence pack first: read resources orbitx://intelligence/playbook, orbitx://intelligence/data-sources, and orbitx://intelligence/tool-map. Work by them, not by generic crypto habits.\n` +
          `2) Call orbitx_trader_boot. If it says I am not connected, ask me to go to https://www.orbitx.world/agent, link my wallet, tap "Generate chat auth", and paste the message for this client — then call orbitx_auth_status with my authCode and pass that authCode on every account tool from then on.\n` +
          `3) Once connected, run orbitx_trader_brief and summarize my book + the market in five lines or less.\n` +
          `4) Run orbitx_trader_scan and show me the ranked candidates: score, verdict, and risk flags for each. No hype — flags first.\n` +
          `5) Trading path: orbitx_trade_quote first, show me the exact quote, and NEVER execute a buy, sell, or launch without my explicit "confirm" in this chat. Launchpad tools (launchpad_*) run through this same MCP.\n` +
          `6) When I pick a token to watch, offer orbitx_alert_create so I hear about moves without staring at charts.\n` +
          `${HOUSE_RULES}`,
      );
    case "market_pulse":
      return user(
        `Give the OrbitX market pulse.\n` +
          `1) orbitx_screen_trending_1m_solana and orbitx_screen_tokens for what is moving.\n` +
          `2) orbitx_platform_stats for platform flow.\n` +
          `3) orbitx_paper_desk and orbitx_live_positions for what the desks are doing.\n` +
          `Report: top movers with real numbers, desk positioning, and the one-line read on market mood. ${HOUSE_RULES}`,
      );
    default:
      return null;
  }
}

/** Pull up to `cap` unique mint addresses out of any tool payload. */
export function extractMints(payload, cap = 3) {
  const out = [];
  const seen = new Set();
  const re = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  walk(payload, (k, v) => {
    if (out.length >= cap) return;
    if (typeof v === "string" && /^(mint|address|ca|token_?address|contract)$/.test(k) && re.test(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Deterministic scorer — shape-agnostic signal extraction.            */
/* Walks the composed dossier sections recursively; scores only what   */
/* is actually present and reports coverage. Nothing is invented.      */
/* ------------------------------------------------------------------ */

function walk(node, visit, depth = 0) {
  if (depth > 6 || node == null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node.slice(0, 60)) walk(item, visit, depth + 1);
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    visit(k.toLowerCase(), v);
    if (v && typeof v === "object") walk(v, visit, depth + 1);
  }
}

function num(v) {
  if (v == null || v === "") return null; // Number(null) is 0 — nulls are "unknown", never zero.
  const n = typeof v === "string" ? Number(v.replace(/[$,%]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
function authorityState(v) {
  if (v == null || v === "" || v === false) return "renounced";
  if (typeof v === "string") return v === SYSTEM_PROGRAM ? "renounced" : "active";
  return undefined; // objects/blobs are evidence, not an authority value
}

export function analyzeTokenSections({ scan, ath, chart } = {}) {
  const signals = {};
  const tok = scan?.token?.token || scan?.token || {};
  const audit = tok?.audit || {};
  const sflags = scan?.forensics?.safetyFlags || {};
  const conc = scan?.forensics?.concentration || {};

  // Targeted extraction from the scan payload's real fields (verified live).
  if (audit.mintAuthorityDisabled === true) signals.mintAuthority = "renounced";
  else if (audit.mintAuthorityDisabled === false) signals.mintAuthority = "active";
  if (audit.freezeAuthorityDisabled === true) signals.freezeAuthority = "renounced";
  else if (audit.freezeAuthorityDisabled === false) signals.freezeAuthority = "active";
  if (num(audit.topHoldersPercentage) != null) signals.top10Pct = num(audit.topHoldersPercentage);
  if (num(sflags.lpLockedPct) != null) signals.lpLockedPct = num(sflags.lpLockedPct);
  if (num(sflags.lpBurnedPct) != null) signals.lpBurnedPct = num(sflags.lpBurnedPct);
  if (sflags.rugged === true) signals.rugged = true;
  if (num(conc.topHolderPct) != null) signals.topHolderPct = num(conc.topHolderPct);
  if (num(conc.totalHolders) != null) signals.holders = num(conc.totalHolders);
  if (num(tok.holderCount) != null) signals.holders = num(tok.holderCount);
  if (num(tok.liquidity) != null) signals.liquidityUsd = num(tok.liquidity);
  if (scan?.safety?.canBuy === true || scan?.safety?.canBuy === false) signals.canBuy = scan.safety.canBuy;
  if (scan?.safety?.canSell === true || scan?.safety?.canSell === false) signals.canSell = scan.safety.canSell;

  // Generic fallback for fields the targeted pass did not find. Strict:
  // authority objects are skipped, LP percentages of exactly 0 are ignored
  // (a stray 0 field once produced a bogus "0% locked" flag), nulls skipped.
  const grab = (root) => {
    if (!root || typeof root !== "object") return;
    walk(root, (k, v) => {
      if (signals.mintAuthority === undefined && /^mint_?authority$/.test(k)) { const s = authorityState(v); if (s) signals.mintAuthority = s; }
      if (signals.freezeAuthority === undefined && /^freeze_?authority$/.test(k)) { const s = authorityState(v); if (s) signals.freezeAuthority = s; }
      if (signals.lpLockedPct === undefined && k === "lplockedpct" && num(v) != null && num(v) > 0) signals.lpLockedPct = num(v);
      if (signals.lpBurnedPct === undefined && k === "lpburnedpct" && num(v) != null && num(v) > 0) signals.lpBurnedPct = num(v);
      if (signals.bundlePct === undefined && /bundle/.test(k) && /pct|percent|share/.test(k) && num(v) != null) signals.bundlePct = num(v);
      if (signals.rugScore === undefined && /rug_?(score|risk)/.test(k) && num(v) != null) signals.rugScore = num(v);
      if (signals.priceUsd === undefined && /^(price_?(usd)?|priceusd)$/.test(k) && num(v) != null) signals.priceUsd = num(v);
    });
  };
  grab(scan);
  grab(ath);
  walk(ath || {}, (k, v) => {
    if (signals.athPriceUsd === undefined && /ath/.test(k) && /price/.test(k) && num(v) != null && num(v) > 0) signals.athPriceUsd = num(v);
  });

  // Chart momentum from candle closes, wherever they live.
  let candles = null;
  walk(chart || {}, (k, v) => {
    if (!candles && Array.isArray(v) && v.length >= 3 && v[0] && typeof v[0] === "object" && ("close" in v[0] || "c" in v[0])) candles = v;
  });
  let chartChangePct = null;
  let volatilityPct = null;
  if (candles) {
    const closes = candles.map((c) => num(c.close ?? c.c)).filter((n) => n != null && n > 0);
    if (closes.length >= 3) {
      chartChangePct = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
      const ranges = candles
        .map((c) => {
          const h = num(c.high ?? c.h), l = num(c.low ?? c.l), cl = num(c.close ?? c.c);
          return h != null && l != null && cl ? ((h - l) / cl) * 100 : null;
        })
        .filter((n) => n != null);
      if (ranges.length) volatilityPct = ranges.reduce((a, b) => a + b, 0) / ranges.length;
    }
  }

  const riskFlags = [];
  const reasons = [];
  const dims = {};

  // Safety dimension
  {
    let score = null;
    const parts = [];
    if (signals.mintAuthority) { parts.push(signals.mintAuthority === "renounced" ? 100 : 0); if (signals.mintAuthority === "active") riskFlags.push("Mint authority is ACTIVE — supply can be inflated."); else reasons.push("Mint authority renounced."); }
    if (signals.freezeAuthority) { parts.push(signals.freezeAuthority === "renounced" ? 100 : 10); if (signals.freezeAuthority === "active") riskFlags.push("Freeze authority is ACTIVE — wallets can be frozen."); else reasons.push("Freeze authority renounced."); }
    const lp = Math.max(signals.lpLockedPct ?? 0, signals.lpBurnedPct ?? 0);
    if (signals.lpLockedPct !== undefined || signals.lpBurnedPct !== undefined) { parts.push(lp); if (lp >= 95) reasons.push(`Liquidity ${lp}% locked/burned.`); else if (lp < 50) riskFlags.push(`Only ${lp}% of liquidity locked/burned.`); }
    if (signals.canSell === false) riskFlags.push("Scan reports the token may NOT be sellable (honeypot signal).");
    if (signals.rugged === true) riskFlags.push("Forensics flag this token as rugged.");
    if (signals.rugScore != null) { parts.push(Math.max(0, 100 - signals.rugScore)); if (signals.rugScore > 60) riskFlags.push(`RugCheck-style risk score is high (${signals.rugScore}).`); }
    if (parts.length) score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
    dims.safety = score;
  }
  // Concentration dimension
  {
    const parts = [];
    if (signals.topHolderPct != null) { parts.push(Math.max(0, 100 - signals.topHolderPct * 3)); if (signals.topHolderPct > 25) riskFlags.push(`Top holder controls ${signals.topHolderPct}% — one wallet can move the market.`); else reasons.push(`Top holder at ${signals.topHolderPct}%.`); }
    if (signals.top10Pct != null) { parts.push(Math.max(0, Math.min(100, 100 - Math.max(0, signals.top10Pct - 15) * 1.5))); if (signals.top10Pct > 60) riskFlags.push(`Top 10 holders control ${signals.top10Pct}%.`); else reasons.push(`Top 10 holders at ${Number(signals.top10Pct).toFixed(1)}%.`); }
    if (signals.bundlePct != null) { parts.push(Math.max(0, 100 - signals.bundlePct * 2.5)); if (signals.bundlePct > 20) riskFlags.push(`Bundled supply is ${signals.bundlePct}% — launch was heavily bundled.`); }
    dims.concentration = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  }
  // Momentum dimension
  {
    const parts = [];
    if (chartChangePct != null) { const s = Math.max(0, Math.min(100, 50 + chartChangePct)); parts.push(s); reasons.push(`Chart window move: ${chartChangePct.toFixed(1)}%.`); }
    if (signals.athPriceUsd && signals.priceUsd) { const dist = (signals.priceUsd / signals.athPriceUsd) * 100; parts.push(Math.min(100, dist)); reasons.push(`Price is at ${dist.toFixed(1)}% of ATH.`); }
    if (volatilityPct != null && volatilityPct > 25) reasons.push(`High candle volatility (${volatilityPct.toFixed(1)}% avg range) — size accordingly.`);
    dims.momentum = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  }

  for (const k of Object.keys(dims)) if (dims[k] != null) dims[k] = Math.max(0, Math.min(100, dims[k]));
  const present = Object.entries(dims).filter(([, v]) => v != null);
  const coverage = Object.keys(signals).length + (candles ? 1 : 0);
  if (!present.length) {
    return { ok: false, error: "insufficient_data", message: "The scan returned no scoreable signals — treat this token as unknown, not safe.", signals, coverage };
  }
  const overall = Math.round(present.reduce((a, [, v]) => a + v, 0) / present.length);
  const hardFail = riskFlags.some((f) => /ACTIVE|NOT be sellable/.test(f));
  const verdict = hardFail ? "Avoid — hard risk flag" : overall >= 75 ? "Strong" : overall >= 55 ? "Workable" : overall >= 35 ? "Speculative" : "High risk";
  return {
    ok: true,
    score: overall,
    verdict,
    dimensions: dims,
    riskFlags,
    reasons,
    signals,
    coverage,
    note: "Deterministic score computed from the live scan/ATH/chart payload — only signals actually present are scored. Data and a read, not financial advice; the trade decision is the user's.",
  };
}
