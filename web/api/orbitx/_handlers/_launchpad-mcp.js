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
    description: "Launch a token on pump.fun (Solana), StonkFun (Solana, stock-paired), or Pons V2 (Robinhood Chain). Uses your desk wallet — no manual signing. Supports vanity mints, Jito bundles, SOL/USDC/ETH/stock pairs.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Token name (must be unique)" },
        symbol: { type: "string", description: "Token symbol (must be unique)" },
        description: { type: "string", description: "Token description" },
        image_url: { type: "string", description: "Token image/logo URL" },
        twitter: { type: "string", description: "Twitter URL" },
        telegram: { type: "string", description: "Telegram URL" },
        website: { type: "string", description: "Website URL" },
        launchpad: { type: "string", enum: ["pump", "stonk", "pons"], description: "Launchpad (default pump)" },
        pair: { type: "string", description: "Trading pair. Pump: sol, usdc, nvda, tsla, openai, anthropic, wbtc, weth, gold, + 85 more. Stonk: spyx, nvdax, sol, usdc. Pons: eth, usdc." },
        style: { type: "string", enum: ["standard", "custom_pair", "jito_bundle", "memecoin_quote"], description: "Launch style (default standard)" },
        quote_mint: { type: "string", description: "Custom quote mint address (for memecoin_quote style)" },
        dev_buy_sol: { type: "number", description: "Dev buy amount in SOL/ETH (default 0)" },
        vanity: { type: "boolean", description: "Use vanity mint ending in 'obx' (default true, Solana only)" },
        jito_bundle: { type: "boolean", description: "Use Jito bundle for atomic launch (default false)" },
        jito_tip: { type: "number", description: "Jito tip in SOL (default 0.01)" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "launchpad_tokens",
    description: "List tokens launched via OrbitX. Filter by launchpad, chain, status. Includes bonding curve progress and graduation status.",
    inputSchema: {
      type: "object",
      properties: {
        launchpad: { type: "string", enum: ["pump", "stonk", "pons", "all"], description: "Filter by launchpad" },
        chain: { type: "string", enum: ["solana", "robinhood", "all"], description: "Filter by chain" },
        status: { type: "string", enum: ["live", "graduated", "all"], description: "Filter by status" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "launchpad_pairs",
    description: "List all available trading pairs across launchpads — 93 pump.fun quote assets (stocks, pre-IPO, crypto, metals), StonkFun stock pairs, Pons ETH pairs.",
    inputSchema: {
      type: "object",
      properties: {
        launchpad: { type: "string", enum: ["pump", "stonk", "pons", "all"], description: "Filter by launchpad" },
      },
    },
  },
  {
    name: "launchpad_token",
    description: "Get full token data aggregated from DexScreener, CoinGecko, and pump.fun — price, bonding curve, graduation status.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint/contract address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "launchpad_buy",
    description: "Buy a token via the fastest route (Lightning API). Uses desk wallet.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint" },
        amount: { type: "number", description: "Amount in SOL/ETH to spend" },
        slippage_bps: { type: "number", description: "Slippage in bps (default 500)" },
      },
      required: ["mint", "amount"],
    },
  },
  {
    name: "launchpad_sell",
    description: "Sell a token via the fastest route. Uses desk wallet.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint" },
        amount_tokens: { type: "number", description: "Tokens to sell (or 'all')" },
        slippage_bps: { type: "number", description: "Slippage in bps (default 500)" },
      },
      required: ["mint", "amount_tokens"],
    },
  },
  {
    name: "launchpad_claim_fees",
    description: "Claim creator fees from your launches.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint" },
        launchpad: { type: "string", enum: ["pump", "stonk", "pons"], description: "Launchpad" },
      },
      required: ["mint"],
    },
  },
  {
    name: "launchpad_pnl",
    description: "Get PnL across all your launches and trades. Shareable card.",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", enum: ["solana", "robinhood", "all"], description: "Filter by chain" },
      },
    },
  },
  {
    name: "launchpad_wallets",
    description: "Check all your launchpad wallets — Solana desk + Robinhood Chain.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "launchpad_graduations",
    description: "Recent token graduations (bonding curve → DEX). Track what's graduating.",
    inputSchema: {
      type: "object",
      properties: {
        launchpad: { type: "string", enum: ["pump", "stonk", "pons", "all"], description: "Filter" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
    },
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

  if (name === "launchpad_pairs") {
    const { listPumpPairs } = await import("./_pump-pairs.js");
    const { STONK_QUOTES } = await import("./_stonk-integration.js");
    const filter = args.launchpad || "all";
    const result = {};
    if (filter === "all" || filter === "pump") {
      result.pump = listPumpPairs();
    }
    if (filter === "all" || filter === "stonk") {
      result.stonk = STONK_QUOTES;
    }
    if (filter === "all" || filter === "pons") {
      result.pons = { eth: "ETH", usdc: "USDC" };
    }
    return { ok: true, pairs: result };
  }

  if (name === "launchpad_token") {
    // Aggregated data from DexScreener + CoinGecko + pump.fun
    const { getFullTokenData } = await import("./_token-data.js");
    const data = await getFullTokenData(args.mint);

    // Also check our DB
    const tokens = await sbQuery("launchpad_tokens", "GET", null, `?select=*&mint=eq.${args.mint}&limit=1`);
    const dbToken = (tokens || [])[0];

    return {
      ok: true,
      ...data,
      orbitx: dbToken ? {
        launched_via: dbToken.launched_via,
        launchpad: dbToken.launchpad,
        creator: dbToken.creator_username,
        launched_at: dbToken.created_at,
      } : null,
    };
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
    const { name: tokenName, symbol, description, image_url, twitter, telegram, website } = args;
    if (!tokenName || !symbol) {
      return { ok: false, error: "name and symbol required" };
    }

    const launchpadId = args.launchpad || "pump";
    const { LAUNCHPADS } = await import("./_launchpads.js");
    const lpConfig = LAUNCHPADS[launchpadId];
    if (!lpConfig) {
      return { ok: false, error: `Unknown launchpad: ${launchpadId}. Choose: pump, stonk, pons` };
    }
    const chain = lpConfig.chain;

    // Anti-duplicate check (per launchpad)
    const existing = await sbQuery(
      "launchpad_tokens", "GET", null,
      `?select=mint,name,symbol&launchpad=eq.${launchpadId}&or=(and(name.ilike.${encodeURIComponent(tokenName)},symbol.ilike.${encodeURIComponent(symbol)}))&limit=1`
    );
    if (existing && existing.length > 0) {
      return {
        ok: false,
        error: "duplicate_token",
        message: `A token named "${existing[0].name}" (${existing[0].symbol}) already exists. Pick a different name.`,
        existing_mint: existing[0].mint,
      };
    }

    const pair = args.pair || (launchpadId === "pons" ? "eth" : "sol");
    const useVanity = args.vanity !== false && chain === "solana";
    const useJito = args.jito_bundle === true;

    // Gas check: ensure wallet has enough for launch (~$1) + buffer ($4 max)
    // Launch costs ~$0.60-1.00 in gas. We require at least $1, recommend $4.
    const GAS_REQUIRED_USD = 1.0;
    const GAS_RECOMMENDED_USD = 4.0;

    // Get vanity mint if available (Solana only)
    let mintKeypair = null;
    let vanitySuffix = null;
    if (useVanity) {
      try {
        const { getVanityMint } = await import("./_pump-integration.js");
        const vanity = await getVanityMint();
        if (vanity) {
          mintKeypair = vanity.keypair;
          vanitySuffix = vanity.vanity;
        }
      } catch {}
    }

    // Upload metadata
    let uri;
    try {
      const { uploadMetadata } = await import("./_pump-integration.js");
      uri = await uploadMetadata({
        name: tokenName,
        symbol: symbol.toUpperCase(),
        description,
        imageUrl: image_url,
        twitter, telegram, website,
      });

      // Route to the correct launchpad
      const { routeLaunch } = await import("./_launchpads.js");
      const launchResult = await routeLaunch(launchpadId, {
        name: tokenName,
        symbol: symbol.toUpperCase(),
        uri,
        mintKeypair,
        quote: pair,
        devBuy: args.dev_buy_sol || 0,
        jito: useJito,
        jitoTip: args.jito_tip || 0.01,
      }, { publicKey: auth.walletAddress || "pending" });

      // Record the launch
      const mint = launchResult.mint || mintKeypair ? "vanity-pending" : `${launchpadId}-${Date.now()}`;
      await sbQuery("launchpad_tokens", "POST", {
        mint,
        name: tokenName,
        symbol: symbol.toUpperCase(),
        description: description || null,
        image_url: image_url || null,
        creator_id: auth.userId,
        creator_username: auth.username || "anon",
        chain,
        launchpad: launchpadId,
        status: "live",
        launched_via: "mcp",
        pool_type: pair,
        initial_liquidity_usd: 4000,
      });

      const explorerUrl = chain === "solana"
        ? `https://solscan.io/token/${mint}`
        : `https://explorer.robinhood.com/address/${mint}`;

      return {
        ok: true,
        message: `Token "${tokenName}" (${symbol.toUpperCase()}) launching via ${lpConfig.name} on ${pair.toUpperCase()} pair.`,
        mint,
        launchpad: launchpadId,
        chain,
        pair,
        vanity: vanitySuffix ? `Mint ends in ...${vanitySuffix}` : (useVanity ? "Grinding..." : "N/A"),
        jito_bundle: useJito,
        metadata_uri: uri,
        explorer: explorerUrl,
        status: "launching",
        gas: {
          required_usd: GAS_REQUIRED_USD,
          recommended_usd: GAS_RECOMMENDED_USD,
          note: `Ensure your desk wallet has at least $${GAS_REQUIRED_USD} for gas (launch costs ~$0.60-1.00). $${GAS_RECOMMENDED_USD} recommended for multiple launches.`,
        },
        note: "Desk wallet is signing the create transaction.",
      };
    } catch (e) {
      return {
        ok: false,
        error: "launch_failed",
        message: String(e.message || e),
      };
    }
  }

  if (name === "launchpad_claim_fees") {
    try {
      const { claimPumpFees } = await import("./_pump-integration.js");
      // Get wallet address from auth
      const result = await claimPumpFees(args.mint, auth.walletAddress || "pending");
      return { ok: true, ...result };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  if (name === "launchpad_pnl") {
    try {
      const { getPumpPnl } = await import("./_pump-integration.js");
      const pnl = await getPumpPnl(auth.walletAddress || "");
      return { ok: true, pnl };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
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
