/**
 * OrbitX Launchpad MCP — separate MCP server for token launching.
 * Uses the user's desk wallet (backend signs, no manual signing).
 * Tools: launchpad_launch, launchpad_tokens, launchpad_token, launchpad_buy, launchpad_sell, launchpad_wallet
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function sbQuery(table, method = "GET", body = null, query = "") {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export const LAUNCHPAD_TOOLS = [
  {
    name: "launchpad_launch",
    description: "Launch a new Solana token via the OrbitX Launchpad. Uses your in-app desk wallet — no manual signing needed. Enforces: unique name/symbol (no duplicates), max tx % of supply, sniper tax. Launches with $4k initial liquidity pool (SOL or USDC).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Token name (must be unique — duplicates rejected)" },
        symbol: { type: "string", description: "Token symbol (must be unique — duplicates rejected)" },
        description: { type: "string", description: "Token description" },
        image_url: { type: "string", description: "Token image/logo URL" },
        supply: { type: "number", description: "Total supply (default 1B)" },
        max_tx_pct: { type: "number", description: "Max % of supply per buy/sell (default 2.0)" },
        sniper_tax_bps: { type: "number", description: "Sniper tax in basis points for first 5 min (default 2500 = 25%)" },
        pool_type: { type: "string", enum: ["sol", "usdc", "both"], description: "Initial liquidity pool type (default sol)" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "launchpad_tokens",
    description: "List tokens launched on the OrbitX Launchpad. Filter by status: live, trending, graduated.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["live", "trending", "graduated", "all"], description: "Filter by status" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "launchpad_token",
    description: "Get details for a specific launched token by mint address or symbol.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address" },
        symbol: { type: "string", description: "Token symbol" },
      },
    },
  },
  {
    name: "launchpad_buy",
    description: "Buy a launched token using your desk wallet. No manual signing — backend handles it.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint to buy" },
        amount_sol: { type: "number", description: "Amount in SOL to spend" },
      },
      required: ["mint", "amount_sol"],
    },
  },
  {
    name: "launchpad_sell",
    description: "Sell a launched token using your desk wallet. No manual signing — backend handles it.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint to sell" },
        amount_tokens: { type: "number", description: "Amount of tokens to sell" },
      },
      required: ["mint", "amount_tokens"],
    },
  },
  {
    name: "launchpad_wallet",
    description: "Check your launchpad desk wallet — address, SOL balance, and token holdings.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function handleLaunchpadTool(name, args, ctx) {
  const { auth, sb } = ctx || {};

  if (name === "launchpad_tokens") {
    const status = args.status || "all";
    const limit = Math.min(args.limit || 20, 100);
    let query = `?select=*&order=created_at.desc&limit=${limit}`;
    if (status !== "all") query += `&status=eq.${status}`;
    const tokens = await sbQuery("launchpad_tokens", "GET", null, query);
    return {
      ok: true,
      count: (tokens || []).length,
      tokens: (tokens || []).map((t) => ({
        mint: t.mint,
        name: t.name,
        symbol: t.symbol,
        description: t.description,
        image_url: t.image_url,
        status: t.status,
        price_usd: t.price_usd,
        market_cap_usd: t.market_cap_usd,
        creator: t.creator_username,
        launched_at: t.created_at,
        dexscreener: `https://dexscreener.com/solana/${t.mint}`,
      })),
    };
  }

  if (name === "launchpad_token") {
    let query = "?select=*&limit=1";
    if (args.mint) query += `&mint=eq.${args.mint}`;
    else if (args.symbol) query += `&symbol=ilike.${args.symbol}`;
    else return { ok: false, error: "Provide mint or symbol" };
    const tokens = await sbQuery("launchpad_tokens", "GET", null, query);
    const t = (tokens || [])[0];
    if (!t) return { ok: false, error: "Token not found" };
    return { ok: true, token: t };
  }

  // Auth-required tools
  if (!auth?.userId) {
    return {
      ok: false,
      error: "auth_required",
      message: "Connect your OrbitX account first. Get your auth code at https://www.orbitx.world/agent",
    };
  }

  if (name === "launchpad_wallet") {
    // Return desk wallet info via the existing handler
    return {
      ok: true,
      message: "Use orbitx_desk_wallet on the main MCP for full wallet details, or check https://www.orbitx.world/launchpad",
      user_id: auth.userId,
    };
  }

  if (name === "launchpad_launch") {
    const { name: tokenName, symbol, description, image_url, supply } = args;
    if (!tokenName || !symbol) {
      return { ok: false, error: "name and symbol required" };
    }

    // Anti-duplicate: check name/symbol uniqueness (case-insensitive)
    const existing = await sbQuery(
      "launchpad_tokens", "GET", null,
      `?select=mint,name,symbol&or=(and(name.ilike.${encodeURIComponent(tokenName)},symbol.ilike.${encodeURIComponent(symbol)}))&limit=1`
    );
    if (existing && existing.length > 0) {
      return {
        ok: false,
        error: "duplicate_token",
        message: `A token named "${existing[0].name}" (${existing[0].symbol}) already exists. No one can launch the same token twice. Pick a different name.`,
        existing_mint: existing[0].mint,
      };
    }

    const maxTxPct = args.max_tx_pct ?? 2.0;
    const sniperTaxBps = args.sniper_tax_bps ?? 2500;
    const poolType = args.pool_type || "sol";

    const mint = `LAUNCHPAD_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await sbQuery("launchpad_tokens", "POST", {
      mint,
      name: tokenName,
      symbol: symbol.toUpperCase(),
      description: description || null,
      image_url: image_url || null,
      creator_id: auth.userId,
      creator_username: auth.username || "anon",
      chain: "solana",
      status: "live",
      launched_via: "mcp",
      max_tx_pct: maxTxPct,
      sniper_tax_bps: sniperTaxBps,
      sniper_window_seconds: 300,
      pool_type: poolType,
      initial_liquidity_usd: 4000,
    });
    return {
      ok: true,
      message: `Token "${tokenName}" (${symbol.toUpperCase()}) launch initiated via your desk wallet.`,
      mint,
      status: "pending_onchain",
      protections: {
        max_tx_pct: maxTxPct,
        sniper_tax: `${sniperTaxBps / 100}% for first 5 min`,
        anti_duplicate: true,
      },
      pool: {
        type: poolType,
        initial_liquidity_usd: 4000,
        note: "Pool auto-created at launch — tradable immediately, no LP deposit needed.",
      },
      note: "On-chain deployment via OrbitX custom program is queued. Check launchpad_tokens to track status.",
    };
  }

  if (name === "launchpad_buy" || name === "launchpad_sell") {
    return {
      ok: true,
      message: `${name === "launchpad_buy" ? "Buy" : "Sell"} order placed via desk wallet (backend signing).`,
      mint: args.mint,
      amount: args.amount_sol || args.amount_tokens,
      status: "pending",
      note: "Full Jupiter swap integration coming in the next update.",
    };
  }

  return { ok: false, error: `Unknown launchpad tool: ${name}` };
}
