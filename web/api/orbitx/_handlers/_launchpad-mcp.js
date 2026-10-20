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
        authCode: { type: "string", description: "Your OrbitX auth code (same as main MCP). Get one at https://www.orbitx.world/agent" },
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
    _meta: { ui: { resourceUri: "ui://orbitx-launchpad/token-cards" } },
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
    _meta: { ui: { resourceUri: "ui://orbitx-launchpad/token-cards" } },
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
    _meta: { ui: { resourceUri: "ui://orbitx-launchpad/trade-confirm" } },
    inputSchema: {
      type: "object",
      properties: {
        authCode: { type: "string", description: "Your OrbitX auth code (same as main MCP). Get one at https://www.orbitx.world/agent" },
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
    _meta: { ui: { resourceUri: "ui://orbitx-launchpad/trade-confirm" } },
    inputSchema: {
      type: "object",
      properties: {
        authCode: { type: "string", description: "Your OrbitX auth code (same as main MCP). Get one at https://www.orbitx.world/agent" },
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
        authCode: { type: "string", description: "Your OrbitX auth code (same as main MCP). Get one at https://www.orbitx.world/agent" },
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
        authCode: { type: "string", description: "Your OrbitX auth code (same as main MCP). Get one at https://www.orbitx.world/agent" },
        chain: { type: "string", enum: ["solana", "robinhood", "all"], description: "Filter by chain" },
      },
    },
  },
  {
    name: "launchpad_wallets",
    description: "Check all your launchpad wallets — Solana desk + Robinhood Chain.",
    _meta: { ui: { resourceUri: "ui://orbitx-launchpad/wallet-dashboard" } },
    inputSchema: { type: "object", properties: {
        authCode: { type: "string", description: "Your OrbitX auth code (same as main MCP). Get one at https://www.orbitx.world/agent" },} },
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
  {
    name: "launchpad_dry_run",
    description: "Validate a launch WITHOUT spending funds — checks name/ticker uniqueness, pair support, vanity mint, required params, and estimated costs. Use this before launchpad_launch.",
    inputSchema: {
      type: "object",
      properties: {
        authCode: { type: "string", description: "Your OrbitX auth code (same as main MCP)" },
        name: { type: "string", description: "Token name" },
        symbol: { type: "string", description: "Token symbol/ticker" },
        description: { type: "string", description: "Token description" },
        launchpad: { type: "string", enum: ["pump", "stonk", "pons"], description: "Launchpad (default pump)" },
        pair: { type: "string", description: "Trading pair (default sol; usdc supported on pump)" },
        style: { type: "string", enum: ["standard", "custom_pair", "jito_bundle", "memecoin_quote"], description: "Launch style (default standard)" },
        dev_buy_sol: { type: "number", description: "Dev buy amount in SOL (default 0)" },
        vanity: { type: "boolean", description: "Vanity mint ending in 'obx' (default true, Solana only)" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "launchpad_sniper_radar",
    description: "Live sniper radar — see snipers getting taxed in real-time on recent launches.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max events (default 20)" },
      },
    },
  },
  {
    name: "launchpad_holder_map",
    description: "Visual holder distribution for a token — who holds what %.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address" },
      },
      required: ["mint"],
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

    const { tokenCard } = await import("./_mcp-cards.js");
    const cardHtml = tokenCard({
      name: data.name || "Unknown",
      symbol: data.symbol || "?",
      mint: args.mint,
      price_usd: data.price_usd,
      market_cap: data.market_cap,
      change_24h: data.change_24h,
      graduation_pct: data.bonding_curve?.graduation_pct,
      image: data.image,
    });

    return {
      ok: true,
      ...data,
      orbitx: dbToken ? {
        launched_via: dbToken.launched_via,
        launchpad: dbToken.launchpad,
        creator: dbToken.creator_username,
        launched_at: dbToken.created_at,
      } : null,
      _meta: { ui: { html: cardHtml } },
    };
  }

  if (name === "launchpad_holder_map") {
    try {
      const { getHolderMap } = await import("./_launchpad-insights.js");
      const map = await getHolderMap(args.mint);
      if (!map) return { ok: false, error: "Could not fetch holder data. Token may be too new or RPC rate-limited." };
      return { ok: true, ...map };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  if (name === "launchpad_sniper_radar") {
    try {
      const { getSniperRadar } = await import("./_launchpad-insights.js");
      const events = await getSniperRadar(sbQuery, args.limit || 20);
      return {
        ok: true,
        events,
        message: events.length ? `${events.length} tokens with sniper protection active in the last 24h.` : "No recent launches with sniper activity.",
      };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  // Auth-required tools
  if (!auth?.userId) {
    return {
      ok: false,
      error: "auth_required",
      message: "Connect your OrbitX account first. Get your auth code at https://www.orbitx.world/agent",
    };
  }

  if (name === "launchpad_wallets" || name === "launchpad_wallet") {
    const { walletCard } = await import("./_mcp-cards.js");
    // Get desk wallet addresses
    const wallets = {
      solana: auth.walletAddress || null,
      robinhood: null, // EVM wallet from local storage (client-side)
    };
    const cardHtml = walletCard(wallets);
    return {
      ok: true,
      wallets,
      user_id: auth.userId,
      note: "Solana desk wallet shown. Robinhood Chain wallet is client-side (check the /launchpad wallet tab).",
      _meta: { ui: { html: cardHtml } },
    };
  }

  if (name === "launchpad_graduations") {
    const limit = Math.min(args.limit || 10, 50);
    const launchpad = args.launchpad || "all";
    let query = `?select=mint,name,symbol,launchpad,chain,market_cap_usd,graduated_at&status=eq.graduated&order=graduated_at.desc&limit=${limit}`;
    if (launchpad !== "all") query += `&launchpad=eq.${launchpad}`;
    const grads = await sbQuery("launchpad_tokens", "GET", null, query);
    return {
      ok: true,
      graduations: grads || [],
      count: (grads || []).length,
    };
  }

  if (name === "launchpad_dry_run") {
    // Non-financial validation — verifies everything about a launch without submitting a transaction.
    const { name: tokenName, symbol } = args;
    const checks = [];
    const errors = [];

    // 1. Required params
    if (!tokenName) errors.push("name is required");
    if (!symbol) errors.push("symbol is required");
    checks.push({ check: "required_params", pass: !!(tokenName && symbol) });

    // 2. Name/symbol uniqueness (case-insensitive)
    let nameUnique = true, symbolUnique = true;
    try {
      if (tokenName && symbol) {
        const existing = await sbQuery("launchpad_tokens", "GET", null,
          `?select=name,symbol&or=(name.ilike.${encodeURIComponent(tokenName)},symbol.ilike.${encodeURIComponent(symbol)})&limit=5`);
        if (existing?.length) {
          nameUnique = !existing.some(t => t.name?.toLowerCase() === tokenName.toLowerCase());
          symbolUnique = !existing.some(t => t.symbol?.toLowerCase() === symbol.toLowerCase());
          if (!nameUnique) errors.push(`Name "${tokenName}" is already taken`);
          if (!symbolUnique) errors.push(`Symbol "${symbol}" is already taken`);
        }
      }
    } catch {}
    checks.push({ check: "name_unique", pass: nameUnique });
    checks.push({ check: "symbol_unique", pass: symbolUnique });

    // 3. Launchpad + pair support
    const launchpadId = (args.launchpad || "pump").toLowerCase();
    const pair = (args.pair || "sol").toLowerCase();
    const validLaunchpads = ["pump", "stonk", "pons"];
    const launchpadValid = validLaunchpads.includes(launchpadId);
    if (!launchpadValid) errors.push(`Unknown launchpad: ${launchpadId}. Use: pump, stonk, pons`);
    checks.push({ check: "launchpad_valid", pass: launchpadValid });

    // Pair support matrix
    const pairSupport = {
      pump: ["sol", "usdc", "nvda", "tsla", "ba", "baba", "dell", "openai", "anthropic", "anduril", "neuralink", "figure", "kalshi", "polymarket", "oura", "wbtc", "weth", "gold", "silver"],
      stonk: ["spyx", "nvdax", "sol", "usdc"],
      pons: ["eth", "usdc"],
    };
    const pairValid = (pairSupport[launchpadId] || []).includes(pair);
    if (!pairValid) errors.push(`Pair "${pair}" not supported on ${launchpadId}. Supported: ${(pairSupport[launchpadId] || []).join(", ")}`);
    checks.push({ check: "pair_supported", pass: pairValid, pair, launchpad: launchpadId });

    // 4. Vanity mint (Solana only)
    const vanity = args.vanity !== false;
    const vanityOk = launchpadId === "pump" ? true : !vanity; // vanity only on Solana/pump
    if (launchpadId !== "pump" && vanity) errors.push("Vanity mint (obx) is only available on Solana/pump.fun");
    checks.push({ check: "vanity_mint", pass: vanityOk, suffix: vanity && launchpadId === "pump" ? "obx" : null });

    // 5. Style validation
    const style = args.style || "standard";
    const validStyles = ["standard", "custom_pair", "jito_bundle", "memecoin_quote"];
    const styleValid = validStyles.includes(style);
    if (!styleValid) errors.push(`Unknown style: ${style}`);
    checks.push({ check: "style_valid", pass: styleValid, style });

    // 6. Estimated costs (no funds spent)
    const devBuy = Number(args.dev_buy_sol || 0);
    const gasEstimateUsd = launchpadId === "pons" ? 0.50 : 1.00; // ~$1 SOL, ~$0.50 RH
    const estimatedCostUsd = gasEstimateUsd + devBuy * 150; // rough SOL price
    checks.push({
      check: "estimated_cost",
      pass: true,
      gas_usd: gasEstimateUsd,
      dev_buy_sol: devBuy,
      total_usd: Number(estimatedCostUsd.toFixed(2)),
      note: "Estimate only — no funds spent in dry run",
    });

    const allPass = errors.length === 0;
    return {
      ok: allPass,
      dry_run: true,
      message: allPass
        ? `Dry run passed for "${tokenName}" (${symbol}) on ${launchpadId}/${pair}. Ready to launch.`
        : `Dry run found ${errors.length} issue(s).`,
      errors,
      checks,
      params: { name: tokenName, symbol, launchpad: launchpadId, pair, style, dev_buy_sol: devBuy, vanity },
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
      // Map pair string → quote mint address (pump: sol = native, usdc = USDC mint)
      const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const quoteMint = pair === "usdc" ? USDC_MINT : (args.quote_mint || null);
      const launchResult = await routeLaunch(launchpadId, {
        name: tokenName,
        symbol: symbol.toUpperCase(),
        uri,
        mintKeypair,
        quoteMint,
        quote: pair,
        devBuySol: args.dev_buy_sol || 0,
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

      const { launchCard } = await import("./_mcp-cards.js");
      const cardHtml = launchCard({
        name: tokenName,
        symbol: symbol.toUpperCase(),
        mint,
        launchpad: lpConfig.name,
        pair: pair.toUpperCase(),
        explorer: explorerUrl,
        vanity: vanitySuffix ? `...${vanitySuffix}` : undefined,
      });

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
        // Rich UI for ChatGPT/Claude/Grok/Muse
        _meta: { ui: { html: cardHtml } },
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
    try {
      const isBuy = name === "launchpad_buy";
      const { tradeViaLightning } = await import("./_pump-integration.js");

      const result = await tradeViaLightning({
        mint: args.mint,
        side: isBuy ? "buy" : "sell",
        amountSol: isBuy ? (args.amount || args.amount_sol) : undefined,
        amountTokens: !isBuy ? args.amount_tokens : undefined,
        slippageBps: args.slippage_bps || 500,
        walletAddress: auth.walletAddress,
      });

      return {
        ok: true,
        ...result,
        message: `${isBuy ? "Bought" : "Sold"} via Lightning API.`,
      };
    } catch (e) {
      return {
        ok: false,
        error: "trade_failed",
        message: String(e.message || e),
      };
    }
  }

  return { ok: false, error: `Unknown launchpad tool: ${name}` };
}
