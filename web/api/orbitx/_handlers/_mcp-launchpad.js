/**
 * Launchpad tools — live token feed, launch flow, launch status.
 * Zero SQL: feed data via screen_tokens API, safety via forensics tools,
 * launch delegates to orbitx_app_launch. Widget state in localStorage.
 */

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function baseUrl() {
  return process.env.ORBITX_BASE_URL || "https://www.orbitx.world";
}

async function mcpCall(tool, args, timeoutMs = 15_000) {
  const r = await fetch(`${baseUrl()}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "OrbitX-MCP/1.0" },
    body: JSON.stringify({ jsonrpc: "2.0", id: `lp${Date.now()}`, method: "tools/call", params: { name: tool, arguments: args || {} } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = await r.json().catch(() => ({}));
  if (j.error) throw new Error(j.error.message || "mcp_error");
  return j.result || {};
}

/* ==================== Feed ==================== */

function safetyGrade(t) {
  // Score 0-100 from available signals; grade green/yellow/red
  let score = 50;
  const reasons = [];
  if (t.liquidity && t.liquidity > 10000) { score += 15; reasons.push("liquidity>$10k"); }
  else if (t.liquidity && t.liquidity < 2000) { score -= 20; reasons.push("low liquidity"); }
  if (t.isVerified) { score += 15; reasons.push("verified"); }
  if (t.organicScoreLabel === "high") { score += 10; reasons.push("organic"); }
  else if (t.organicScoreLabel === "low") { score -= 10; reasons.push("low organic"); }
  if (t.numTraders && t.numTraders > 50) { score += 10; reasons.push("50+ traders"); }
  if (t.holderCount && t.holderCount > 100) { score += 10; }
  if (t.netBuyers != null && t.netBuyers < 0) { score -= 15; reasons.push("net sellers"); }
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 70 ? "green" : score >= 40 ? "yellow" : "red";
  return { score, grade, reasons };
}

async function launchpadFeed(args) {
  const limit = Math.min(50, Math.max(5, Number(args.limit || 20)));
  let rows = [];
  try {
    const res = await mcpCall("orbitx_screen_tokens", { type: "new", limit, chain: "solana" });
    const sc = res.structuredContent || {};
    rows = sc.rows || [];
  } catch (e) {
    return { ok: false, error: "feed_unavailable", message: `Launch feed unavailable: ${e.message}` };
  }
  const launches = rows.map((t) => {
    const safety = safetyGrade(t);
    return {
      mint: t.mint,
      name: t.name,
      symbol: t.symbol,
      icon: t.icon || null,
      priceUsd: t.priceUsd ?? null,
      mcap: t.mcap ?? null,
      liquidity: t.liquidity ?? null,
      volume24h: t.volume ?? null,
      numBuys: t.numBuys ?? null,
      numSells: t.numSells ?? null,
      numTraders: t.numTraders ?? null,
      holderCount: t.holderCount ?? null,
      dev: t.dev || null,
      isVerified: !!t.isVerified,
      organicScore: t.organicScoreLabel || null,
      safety,
      dexUrl: `https://dexscreener.com/solana/${t.mint}`,
    };
  });
  // Default sort: by mcap desc (most traction first)
  launches.sort((a, b) => (b.mcap || 0) - (a.mcap || 0));
  return { ok: true, count: launches.length, launches };
}

/* ==================== Launch ==================== */

async function launchpadLaunch(args, ctx = {}) {
  // Validate params, return the launch plan. Actual execution goes through
  // orbitx_app_launch (backend-signed). This tool stages + validates.
  const name = String(args.name || "").trim();
  const symbol = String(args.symbol || args.ticker || "").trim().toUpperCase();
  if (!name) return { ok: false, error: "name_required", message: "Token name is required." };
  if (!symbol) return { ok: false, error: "symbol_required", message: "Token ticker/symbol is required." };
  if (symbol.length > 10) return { ok: false, error: "symbol_too_long", message: "Ticker max 10 characters." };
  const devBuySol = Number(args.devBuySol || args.devBuy || 0);
  if (devBuySol < 0 || devBuySol > 100) {
    return { ok: false, error: "bad_devbuy", message: "Dev buy must be 0–100 SOL." };
  }
  const steps = [
    { n: 1, label: "Validate metadata", done: true },
    { n: 2, label: "Upload image to IPFS", done: !!args.imageUrl },
    { n: 3, label: "Create pump.fun launch (backend-signed)", done: false },
    ...(devBuySol > 0 ? [{ n: 4, label: `Dev buy ${devBuySol} SOL`, done: false }] : []),
    { n: 5, label: "Confirm on-chain", done: false },
  ];
  return {
    ok: true,
    action: "launch_plan",
    plan: { name, symbol, description: String(args.description || ""), imageUrl: String(args.imageUrl || ""), twitter: String(args.twitter || ""), telegram: String(args.telegram || ""), website: String(args.website || ""), pair: args.pair === "usdc" ? "usdc" : "sol", devBuySol },
    steps,
    nextTool: "orbitx_app_launch",
    message: `Launch plan ready for ${name} (${symbol}). Call orbitx_app_launch with these params to execute (backend-signed, you only pay gas + rent). Or use the Launchpad widget's Launch tab.`,
    widgetAction: { tab: "lz", importPlan: { name, symbol, description: String(args.description || ""), imageUrl: String(args.imageUrl || ""), devBuySol } },
  };
}

/* ==================== Status ==================== */

async function launchpadStatus(args) {
  const mint = String(args.mint || args.ca || "").trim();
  if (!MINT_RE.test(mint)) {
    return { ok: false, error: "bad_mint", message: "Pass a valid token mint address." };
  }
  // Enrich via forensics + safety
  let forensics = null, safety = null;
  try {
    const fr = await mcpCall("orbitx_get_forensics", { mint });
    forensics = fr.structuredContent || null;
  } catch {}
  try {
    const sr = await mcpCall("orbitx_get_safety", { mint });
    safety = sr.structuredContent || null;
  } catch {}
  return {
    ok: true,
    mint,
    forensics,
    safety,
    dexUrl: `https://dexscreener.com/solana/${mint}`,
    message: forensics || safety ? "Launch status retrieved." : "No forensics data available for this mint yet.",
  };
}

/* ==================== Tool definition + dispatch ==================== */

export const LAUNCHPAD_TOOLS = [
  {
    name: "orbitx_launchpad",
    description:
      "OrbitX Launchpad: live feed of new token launches with safety scores ('show me new launches'), stage a token launch ('launch a coin called X'), or check a launch's status. Say 'open launchpad' or 'show new coins'.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["feed", "launch", "status"], description: "feed=new launches, launch=stage a launch, status=check a mint" },
        limit: { type: "integer", description: "Feed size, default 20, max 50" },
        mint: { type: "string", description: "Token mint (for status)" },
        ca: { type: "string", description: "Alias for mint" },
        name: { type: "string", description: "Token name (for launch)" },
        symbol: { type: "string", description: "Ticker (for launch)" },
        ticker: { type: "string", description: "Alias for symbol" },
        description: { type: "string" },
        imageUrl: { type: "string" },
        twitter: { type: "string" },
        telegram: { type: "string" },
        website: { type: "string" },
        pair: { type: "string", enum: ["sol", "usdc"] },
        devBuySol: { type: "number", description: "Dev buy in SOL" },
        devBuy: { type: "number", description: "Alias for devBuySol" },
      },
      required: ["action"],
    },
  },
];

const TOOL_NAMES = new Set(LAUNCHPAD_TOOLS.map((t) => t.name));

export function isLaunchpadTool(name) {
  return TOOL_NAMES.has(String(name || ""));
}

export async function dispatchLaunchpadTool(name, args, ctx = {}) {
  const a = args || {};
  const action = String(a.action || "feed").toLowerCase();
  try {
    if (action === "feed") return await launchpadFeed(a);
    if (action === "launch") return await launchpadLaunch(a, ctx);
    if (action === "status") return await launchpadStatus(a);
    return { ok: false, error: "bad_action", message: "action must be feed, launch, or status." };
  } catch (e) {
    return { ok: false, error: "launchpad_error", message: String(e.message || e) };
  }
}
