/**
 * Generated OrbitX MCP tool catalog — expands factories to 500+ tools.
 * Each tool maps to a real OG DEX / OrbitX endpoint or Phantom openUrl/signUrl.
 */

/** Primary chains used by OG DEX screener / token APIs */
const CHAINS = [
  "solana",
  "ethereum",
  "bsc",
  "base",
  "polygon",
  "arbitrum",
  "avalanche",
  "sui",
  "ton",
  "robinhood",
];

/** Extra chains for mint-intel / search expansion (still real chain ids) */
const CHAINS_EXT = [...CHAINS, "optimism", "blast", "sonic", "monad"];

const SCREENER_TYPES = [
  "trending",
  "runners",
  "new",
  "newpairs",
  "unbonded",
  "migrated",
  "moonshot",
  "fomo",
  "jupiter",
  "og",
  "celebrity",
  "organic",
  "kols",
  "social",
];

const INTERVALS = ["5m", "15m", "1h", "4h", "24h"];

const POOLS = ["auto", "pump", "raydium", "pump-amm", "launchlab", "raydium-cpmm", "bonk"];

const MINT_OPS = [
  { id: "token", path: "/api/ogdex/token", desc: "Token overview" },
  { id: "safety", path: "/api/ogdex/safety", desc: "Safety scan" },
  { id: "forensics", path: "/api/ogdex/forensics", desc: "Forensics / origin" },
  { id: "ath", path: "/api/ogdex/ath", desc: "All-time high" },
  { id: "xray", path: "/api/ogdex/xray", desc: "X-ray risk scan" },
  { id: "research", path: "/api/ogdex/research", desc: "Research brief" },
  { id: "metadata", path: "/api/ogdex/metadata", desc: "On-chain metadata" },
  { id: "crypto_scan", path: "/api/orbitx/crypto-scan", desc: "OrbitX crypto scan" },
];

const OPEN_ROUTES = [
  ["/ORBITX_DEX", "DEX home"],
  ["/ORBITX_DEX/alerts", "DEX alerts"],
  ["/ORBITX_DEX/tools", "DEX tools"],
  ["/orbitxlaunch", "Launchpad home"],
  ["/orbitxlaunch/create/pump", "Create Pump token"],
  ["/orbitxlaunch/create/custom", "Create custom token"],
  ["/nft", "NFT marketplace"],
  ["/nft/create", "NFT create studio"],
  ["/agent", "Agent MCP hub"],
  ["/agent/sign", "Phantom sign desk"],
  ["/agent/create-token", "Agent create token"],
  ["/agent/nft-mint", "Agent NFT mint"],
  ["/Orbitxcity", "OrbitX City 3D"],
  ["/os", "OrbitX OS"],
  ["/play", "Play Studio"],
  ["/intel", "Crypto Intel"],
  ["/hq", "Social HQ"],
  ["/terminal", "Trading terminal"],
  ["/predictions", "Predictions"],
  ["/wallets", "Wallets"],
  ["/launch", "Legacy launch"],
  ["/profile", "Profile"],
  ["/settings", "Settings"],
  ["/leaderboard", "Leaderboard page"],
  ["/tokens", "Tokens page"],
  ["/tools", "Tools page"],
  ["/kol-tracker", "KOL tracker"],
  ["/pnl", "PnL tracker"],
  ["/live", "Live feed"],
  ["/invite", "Invite"],
  ["/auth", "Auth"],
  ["/hub", "Hub"],
];

const LIMITS = [10, 20, 25, 30, 40, 50];

/** @type {Map<string, object>} */
export const GEN_META = new Map();

/** Tool names that need a wallet/publicKey arg */
export const GEN_WALLET_TOOLS = new Set();

function tool(name, description, inputSchema, meta) {
  GEN_META.set(name, meta);
  if (meta.wallet) GEN_WALLET_TOOLS.add(name);
  return { name, description, inputSchema };
}

function mintSchema(extra = {}) {
  return {
    type: "object",
    properties: { mint: { type: "string" }, ...extra },
    required: ["mint"],
  };
}

function limitSchema(def = 20) {
  return {
    type: "object",
    properties: { limit: { type: "integer", default: def } },
  };
}

/**
 * Build generated tools. Dedupes names. Target 500+.
 */
export function buildGeneratedTools() {
  const out = [];
  const seen = new Set();

  const push = (t) => {
    if (!t?.name || seen.has(t.name)) return;
    seen.add(t.name);
    out.push(t);
  };

  // 1) Screener matrix: type × interval × chain  (14×5×10 = 700)
  for (const type of SCREENER_TYPES) {
    for (const interval of INTERVALS) {
      for (const chain of CHAINS) {
        const name = `orbitx_screen_${type}_${interval}_${chain}`.replace(/-/g, "_");
        push(
          tool(
            name,
            `Screen ${type} tokens on ${chain} (${interval} window).`,
            limitSchema(20),
            { kind: "screener", type, interval, chain },
          ),
        );
      }
    }
  }

  // 2) Chart matrix: interval × chain
  for (const interval of INTERVALS) {
    for (const chain of CHAINS_EXT) {
      const name = `orbitx_chart_${interval}_${chain}`.replace(/-/g, "_");
      push(
        tool(name, `OHLCV chart on ${chain} at ${interval}. Requires mint.`, mintSchema({ limit: { type: "integer", default: 200 } }), {
          kind: "chart",
          interval,
          chain,
        }),
      );
    }
  }

  // 3) Mint intel × chain (path already chain-aware where supported)
  for (const op of MINT_OPS) {
    for (const chain of CHAINS_EXT) {
      const name = `orbitx_${op.id}_${chain}`.replace(/-/g, "_");
      push(
        tool(name, `${op.desc} on ${chain}. Requires mint.`, mintSchema(), {
          kind: "mint_get",
          path: op.path,
          chain,
        }),
      );
    }
  }

  // 4) Search per chain
  for (const chain of CHAINS_EXT) {
    push(
      tool(
        `orbitx_search_${chain}`,
        `Search tokens on ${chain} by name, symbol, or mint.`,
        {
          type: "object",
          properties: { q: { type: "string" } },
          required: ["q"],
        },
        { kind: "search", chain },
      ),
    );
  }

  // 5) Launches / listings / signals / traders / kols / leaderboard × limits
  for (const limit of LIMITS) {
    push(
      tool(`orbitx_launches_top${limit}`, `Recent launches (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "get",
        path: `/api/ogdex/launches?limit=${limit}`,
      }),
    );
    push(
      tool(`orbitx_listings_top${limit}`, `DEX listings (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "get",
        path: `/api/ogdex/listings?limit=${limit}`,
      }),
    );
    push(
      tool(`orbitx_signals_top${limit}`, `Trading signals (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "get",
        path: `/api/ogdex/signals?limit=${limit}`,
      }),
    );
    push(
      tool(`orbitx_traders_top${limit}`, `Top traders (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "get",
        path: `/api/ogdex/traders?limit=${limit}`,
      }),
    );
    push(
      tool(`orbitx_kols_top${limit}`, `KOL list (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "get",
        path: `/api/ogdex/kols?limit=${limit}`,
      }),
    );
    push(
      tool(`orbitx_leaderboard_top${limit}`, `Leaderboard (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "get",
        path: `/api/ogdex/leaderboard?limit=${limit}`,
      }),
    );
    push(
      tool(`orbitx_nft_items_top${limit}`, `OrbitX NFTs (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "sb",
        path: `orbitx_nfts?order=created_at.desc&limit=${limit}&select=*`,
      }),
    );
    push(
      tool(`orbitx_nft_collections_top${limit}`, `NFT collections (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "sb",
        path: `orbitx_nft_collections?order=created_at.desc&limit=${limit}&select=*`,
      }),
    );
    push(
      tool(`orbitx_nft_listings_top${limit}`, `Active NFT listings (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "sb",
        path: `orbitx_nft_listings?status=eq.active&order=created_at.desc&limit=${limit}&select=*,nft:orbitx_nfts(*)`,
      }),
    );
    push(
      tool(`orbitx_communities_top${limit}`, `Public communities (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "sb",
        path: `communities?is_active=eq.true&order=member_count.desc&limit=${limit}&select=id,name,description,privacy,category,member_count,avatar_url,icon,created_at`,
      }),
    );
    push(
      tool(`orbitx_social_feed_top${limit}`, `Community feed (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "sb",
        path: `community_posts?order=created_at.desc&limit=${limit}&select=id,community_id,user_id,username,avatar_url,content,image_url,likes_count,replies_count,post_type,created_at`,
      }),
    );
  }

  // 6) Buy/sell per pool → Phantom signUrl
  for (const pool of POOLS) {
    const p = pool.replace(/-/g, "_");
    push(
      tool(
        `orbitx_buy_${p}`,
        `Prepare BUY via ${pool} pool → Phantom signUrl. Requires mint, amountSol, publicKey.`,
        {
          type: "object",
          properties: {
            mint: { type: "string" },
            amountSol: { type: "number" },
            publicKey: { type: "string" },
            slippage: { type: "number", default: 10 },
          },
          required: ["mint", "amountSol", "publicKey"],
        },
        { kind: "trade_sign", action: "buy", pool, wallet: true },
      ),
    );
    push(
      tool(
        `orbitx_sell_${p}`,
        `Prepare SELL via ${pool} pool → Phantom signUrl. Requires mint, amount, publicKey.`,
        {
          type: "object",
          properties: {
            mint: { type: "string" },
            amount: { type: ["number", "string"] },
            publicKey: { type: "string" },
            slippage: { type: "number", default: 10 },
          },
          required: ["mint", "amount", "publicKey"],
        },
        { kind: "trade_sign", action: "sell", pool, wallet: true },
      ),
    );
  }

  // 7) Report + open DEX per chain flavor
  for (const chain of CHAINS_EXT) {
    push(
      tool(`orbitx_report_${chain}`, `PDF report URL for a mint (${chain} context).`, mintSchema(), {
        kind: "report",
        chain,
      }),
    );
    push(
      tool(`orbitx_open_dex_${chain}`, `Open DEX (chain hint: ${chain}). Optional mint.`, {
        type: "object",
        properties: { mint: { type: "string" } },
      }, { kind: "open_dex", chain }),
    );
  }

  // 8) Deep-link open_* routes
  for (const [path, label] of OPEN_ROUTES) {
    const slug = path
      .replace(/^\//, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .toLowerCase() || "home";
    push(
      tool(`orbitx_open_${slug}`, `Open OrbitX: ${label} (${path}).`, { type: "object", properties: {} }, {
        kind: "open",
        path,
      }),
    );
  }

  // 9) Create-token lane shortcuts
  for (const lane of ["pump", "custom"]) {
    push(
      tool(
        `orbitx_create_token_${lane}`,
        `Launch execution on ${lane} lane → Phantom openUrl (same as orbitx_execute_launch).`,
        {
          type: "object",
          properties: {
            name: { type: "string" },
            symbol: { type: "string" },
            description: { type: "string" },
            imageUrl: { type: "string" },
            twitter: { type: "string" },
            telegram: { type: "string" },
            website: { type: "string" },
            publicKey: { type: "string" },
          },
          required: ["name", "symbol"],
        },
        { kind: "create_token", lane },
      ),
    );
  }

  // 10) Boosts / health / config / platform (named variants for discovery)
  for (const [name, path, desc] of [
    ["orbitx_get_boosts_active", "/api/ogdex/boosts", "Active boosts"],
    ["orbitx_get_boost_tiers", "/api/ogdex/boosts?tiers=1", "Boost tiers"],
    ["orbitx_get_health", "/api/ogdex/health", "API health"],
    ["orbitx_get_config", "/api/ogdex/config", "Public config"],
    ["orbitx_get_platform_stats", "/api/ogdex/platform-stats", "Platform stats"],
  ]) {
    push(tool(name, desc, { type: "object", properties: {} }, { kind: "get", path }));
  }

  // 11) NFT sales limits
  for (const limit of LIMITS) {
    push(
      tool(`orbitx_nft_sales_top${limit}`, `Recent NFT sales (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "sb",
        path: `orbitx_nft_transactions?order=created_at.desc&limit=${limit}&select=id,amount_sol,buyer_wallet,seller_wallet,created_at,tx_signature,nft:orbitx_nfts(*)`,
      }),
    );
    push(
      tool(`orbitx_nft_auctions_top${limit}`, `NFT auctions (limit ${limit}).`, { type: "object", properties: {} }, {
        kind: "sb",
        path: `orbitx_nft_auctions?status=in.(active,ended)&order=ends_at.asc&limit=${limit}&select=*,nft:orbitx_nfts(*)`,
      }),
    );
  }

  // 12) Wallet intel shortcuts
  for (const chain of ["solana"]) {
    push(
      tool(
        `orbitx_wallet_overview_${chain}`,
        `Wallet overview on ${chain}. Requires address/publicKey.`,
        {
          type: "object",
          properties: { publicKey: { type: "string" }, address: { type: "string" } },
        },
        { kind: "wallet", chain, wallet: true },
      ),
    );
    push(
      tool(
        `orbitx_wallet_swaps_${chain}`,
        `Recent swaps for a wallet on ${chain}.`,
        {
          type: "object",
          properties: {
            publicKey: { type: "string" },
            address: { type: "string" },
            limit: { type: "integer", default: 25 },
          },
        },
        { kind: "swaps", chain, wallet: true },
      ),
    );
    push(
      tool(
        `orbitx_wallet_balance_${chain}`,
        `Balances for a wallet on ${chain}. Optional mint.`,
        {
          type: "object",
          properties: {
            publicKey: { type: "string" },
            address: { type: "string" },
            mint: { type: "string" },
          },
        },
        { kind: "balance", chain, wallet: true },
      ),
    );
  }

  return out;
}

/**
 * Dispatch a generated tool. Returns result or null if not generated.
 */
export async function dispatchGenerated(name, args, ctx) {
  const meta = GEN_META.get(name);
  if (!meta) return null;

  const { base, fetchJson, sb, wallet } = ctx;
  const mint = String(args.mint || "").trim();
  const limit = Number(args.limit) || 20;
  const q = String(args.q || "").trim();
  const pk = String(wallet || args.publicKey || args.address || "").trim();

  switch (meta.kind) {
    case "screener": {
      const u = new URL(`${base}/api/ogdex/screener`);
      u.searchParams.set("type", meta.type);
      u.searchParams.set("interval", meta.interval);
      u.searchParams.set("chain", meta.chain);
      u.searchParams.set("limit", String(limit));
      return fetchJson(u.toString());
    }
    case "chart": {
      if (!mint) throw new Error("mint required");
      const u = new URL(`${base}/api/ogdex/chart`);
      u.searchParams.set("mint", mint);
      u.searchParams.set("interval", meta.interval);
      u.searchParams.set("chain", meta.chain);
      u.searchParams.set("limit", String(Number(args.limit) || 200));
      return fetchJson(u.toString());
    }
    case "mint_get": {
      if (!mint) throw new Error("mint required");
      const u = new URL(`${base}${meta.path}`);
      u.searchParams.set("mint", mint);
      if (meta.chain) u.searchParams.set("chain", meta.chain);
      return fetchJson(u.toString());
    }
    case "search": {
      if (!q) throw new Error("q required");
      return fetchJson(
        `${base}/api/ogdex/search?q=${encodeURIComponent(q)}&chain=${encodeURIComponent(meta.chain)}`,
      );
    }
    case "get":
      return fetchJson(`${base}${meta.path}`);
    case "sb":
      return sb(meta.path);
    case "report": {
      if (!mint) throw new Error("mint required");
      return {
        ok: true,
        chain: meta.chain,
        mint,
        reportUrl: `${base}/api/ogdex/report?mint=${encodeURIComponent(mint)}`,
        note: "Open reportUrl in a browser to download the PDF.",
      };
    }
    case "open_dex": {
      return {
        ok: true,
        chain: meta.chain,
        openUrl: mint
          ? `${base}/ORBITX_DEX/token/${encodeURIComponent(mint)}`
          : `${base}/ORBITX_DEX`,
      };
    }
    case "open":
      return { ok: true, openUrl: `${base}${meta.path}` };
    case "create_token": {
      const tokName = String(args.name || "").trim();
      const symbol = String(args.symbol || "").trim().toUpperCase();
      if (!tokName || !symbol) throw new Error("name and symbol required");
      const qs = new URLSearchParams({
        name: tokName,
        symbol,
        description: String(args.description || ""),
        lane: meta.lane || "pump",
      });
      if (args.imageUrl) qs.set("imageUrl", String(args.imageUrl));
      if (args.twitter) qs.set("twitter", String(args.twitter));
      if (args.telegram) qs.set("telegram", String(args.telegram));
      if (args.website) qs.set("website", String(args.website));
      if (pk) qs.set("publicKey", pk);
      return {
        ok: true,
        status: "awaiting_phantom_launch",
        requiresSignature: true,
        tool: "orbitx_execute_launch",
        openUrl: `${base}/agent/create-token?${qs.toString()}`,
        lane: meta.lane,
        instructions: [
          "Open openUrl — this completes launch execution via Phantom.",
          "Connect Phantom on launchpad",
          "Sign create",
        ],
        note: "Prefer orbitx_execute_launch for the final pump.fun create transaction.",
      };
    }
    case "trade_sign": {
      if (!pk) throw new Error("publicKey required");
      if (!mint) throw new Error("mint required");
      const action = meta.action === "sell" ? "sell" : "buy";
      const amount = action === "buy" ? Number(args.amountSol) : args.amount;
      if (amount == null || amount === "") throw new Error(action === "buy" ? "amountSol required" : "amount required");
      // Validate route exists
      const body = {
        publicKey: pk,
        action,
        mint,
        amount,
        denominatedInSol: action === "buy",
        slippage: Number(args.slippage) || 10,
        pool: meta.pool || "auto",
      };
      const data = await fetchJson(`${base}/api/ogdex/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!data?.ok || !data?.tx) {
        return { ok: false, status: "prepare_failed", error: data?.error || "Could not build trade", action, pool: meta.pool };
      }
      const signQs = new URLSearchParams({
        kind: "trade",
        action,
        mint,
        amount: String(amount),
        publicKey: pk,
        slippage: String(Number(args.slippage) || 10),
        pool: String(meta.pool || "auto"),
      });
      return {
        ok: true,
        status: "awaiting_phantom_signature",
        requiresSignature: true,
        signUrl: `${base}/agent/sign?${signQs.toString()}`,
        action,
        pool: meta.pool,
        wallet: pk,
        mint,
        amount,
        via: data.via || null,
        instructions: [
          "Open signUrl in the browser.",
          "Approve in Phantom.",
          "Do not broadcast unsigned transactions.",
        ],
      };
    }
    case "wallet": {
      if (!pk) throw new Error("address/publicKey required");
      return fetchJson(`${base}/api/ogdex/wallet?address=${encodeURIComponent(pk)}`);
    }
    case "swaps": {
      if (!pk) throw new Error("address/publicKey required");
      return fetchJson(
        `${base}/api/ogdex/swaps?address=${encodeURIComponent(pk)}&limit=${Number(args.limit) || 25}`,
      );
    }
    case "balance": {
      if (!pk) throw new Error("address/publicKey required");
      const mintQ = args.mint ? `&mint=${encodeURIComponent(String(args.mint))}` : "";
      return fetchJson(`${base}/api/ogdex/balance?owner=${encodeURIComponent(pk)}${mintQ}`);
    }
    default:
      return null;
  }
}

export function generatedStats() {
  return {
    totalMeta: GEN_META.size,
    walletTools: GEN_WALLET_TOOLS.size,
    chains: CHAINS_EXT.length,
    screenerTypes: SCREENER_TYPES.length,
    intervals: INTERVALS.length,
  };
}
