/**
 * 140 named OrbitX agent skills — market, trading, data, PDF, create, idea,
 * NFT, launch, and desk. Each maps to a live OG DEX / launchpad / sign route.
 * Combinatorial screeners stay in mcp-tools-catalog.js; these are the
 * discoverable "skill" names the agent should call by intent.
 */

export const CUSTOM_SKILL_COUNT = 140;

const empty = { type: "object", properties: {} };
const limitS = {
  type: "object",
  properties: { limit: { type: "integer", default: 20 } },
};
const mintReq = {
  type: "object",
  properties: { mint: { type: "string", description: "Token mint / CA" } },
  required: ["mint"],
};
const mintOpt = {
  type: "object",
  properties: {
    mint: { type: "string" },
    q: { type: "string", description: "Optional search / topic" },
  },
};
const ideaS = {
  type: "object",
  properties: {
    mint: { type: "string" },
    q: { type: "string" },
    topic: { type: "string" },
    name: { type: "string" },
    symbol: { type: "string" },
  },
};
const compareS = {
  type: "object",
  properties: {
    mint: { type: "string" },
    mintB: { type: "string", description: "Second mint to compare" },
    vs: { type: "string" },
  },
  required: ["mint"],
};
const walletS = {
  type: "object",
  properties: {
    publicKey: { type: "string" },
    address: { type: "string" },
    mint: { type: "string" },
    limit: { type: "integer", default: 25 },
  },
};
const buyS = {
  type: "object",
  properties: {
    mint: { type: "string" },
    amountSol: { type: "number" },
    publicKey: { type: "string" },
    slippage: { type: "number", default: 10 },
    autoConfirm: { type: "boolean" },
  },
  required: ["mint", "amountSol", "publicKey"],
};
const sellS = {
  type: "object",
  properties: {
    mint: { type: "string" },
    amount: { type: ["number", "string"] },
    publicKey: { type: "string" },
    slippage: { type: "number", default: 10 },
    autoConfirm: { type: "boolean" },
  },
  required: ["mint", "amount", "publicKey"],
};
const launchS = {
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
};
const checkS = {
  type: "object",
  properties: { name: { type: "string" }, symbol: { type: "string" } },
  required: ["name", "symbol"],
};
const signS = {
  type: "object",
  properties: {
    publicKey: { type: "string" },
    mint: { type: "string" },
    percent: { type: "number" },
    amount: { type: ["number", "string"] },
  },
};

function sk(category, slug, description, inputSchema, meta) {
  return {
    name: `orbitx_skill_${category}_${slug}`,
    category,
    description,
    inputSchema,
    meta: { ...meta, category, skill: true },
  };
}

function screen(type, label) {
  return sk(
    "mkt",
    type.replace(/-/g, "_"),
    `${label} — live Solana screener (1h).`,
    limitS,
    { kind: "screener", type, interval: "1h", chain: "solana" },
  );
}

function intel(op, path, label) {
  return sk("data", op, `${label}. Requires mint.`, mintReq, { kind: "mint_get", path, chain: "solana" });
}

function chart(interval, label) {
  return sk("data", `chart_${interval}`, `${label} OHLCV. Requires mint.`, mintReq, {
    kind: "chart",
    interval,
    chain: "solana",
  });
}

function pdf(slug, label) {
  return sk("pdf", slug, `${label} PDF. Requires mint — returns reportUrl.`, mintReq, {
    kind: "report",
    chain: "solana",
    reportHint: slug,
  });
}

function openSkill(category, slug, path, label) {
  return sk(category, slug, `Open ${label} (${path}).`, empty, { kind: "open", path });
}

function idea(slug, template, label) {
  return sk("idea", slug, `${label} Ground in live mint data when a CA is passed — never invent prices.`, ideaS, {
    kind: "idea",
    template,
  });
}

/** Exactly 140 named skills. */
export const CUSTOM_SKILLS = [
  // —— Market (20)
  screen("trending", "Trending tokens"),
  screen("runners", "Runners / momentum"),
  screen("newpairs", "New pairs"),
  screen("volume", "Volume leaders"),
  screen("ath", "ATH movers"),
  screen("graduated", "Graduated coins"),
  screen("pumpfun", "Pump.fun pulse"),
  screen("migrations", "Migrations"),
  screen("moonshot", "Moonshot board"),
  screen("fomo", "FOMO tape"),
  screen("organic", "Organic flow"),
  screen("celebrity", "Celebrity coins"),
  screen("kols", "KOL flow"),
  screen("social", "Social heat"),
  screen("bundled", "Bundled launches"),
  screen("snipers", "Sniper activity"),
  screen("insiders", "Insider prints"),
  screen("dexpaid", "DEX-paid"),
  screen("jupiter", "Jupiter trending"),
  screen("og", "OG / OrbitX picks"),

  // —— Trading (20)
  sk("td", "quote_buy", "Prepare a BUY to SOL route → Phantom signUrl.", buyS, {
    kind: "trade_sign",
    action: "buy",
    pool: "auto",
    wallet: true,
  }),
  sk("td", "quote_sell", "Prepare a SELL to SOL → Phantom signUrl.", sellS, {
    kind: "trade_sign",
    action: "sell",
    pool: "auto",
    wallet: true,
  }),
  sk("td", "buy_auto", "Auto-prompt BUY (wallet still signs).", buyS, {
    kind: "trade_sign",
    action: "buy",
    pool: "auto",
    wallet: true,
    preferAuto: true,
  }),
  sk("td", "sell_full", "Sell 100% of one mint to SOL.", sellS, {
    kind: "trade_sign",
    action: "sell",
    pool: "auto",
    wallet: true,
    fullSell: true,
  }),
  sk("td", "sell_pump", "Sell on the pump pool to SOL.", sellS, {
    kind: "trade_sign",
    action: "sell",
    pool: "pump",
    wallet: true,
  }),
  sk("td", "sell_raydium", "Sell on Raydium to SOL.", sellS, {
    kind: "trade_sign",
    action: "sell",
    pool: "raydium",
    wallet: true,
  }),
  sk("td", "snipe", "Snipe / market-buy a CA with SOL.", buyS, {
    kind: "trade_sign",
    action: "buy",
    pool: "auto",
    wallet: true,
  }),
  sk("td", "ape", "Ape a mint with SOL (same as prepare buy).", buyS, {
    kind: "trade_sign",
    action: "buy",
    pool: "auto",
    wallet: true,
  }),
  sk("td", "route_auto", "Buy via auto pool routing.", buyS, {
    kind: "trade_sign",
    action: "buy",
    pool: "auto",
    wallet: true,
  }),
  sk("td", "route_pump", "Buy on the pump bonding curve.", buyS, {
    kind: "trade_sign",
    action: "buy",
    pool: "pump",
    wallet: true,
  }),
  sk("td", "slippage_tight", "Buy with 3% slippage.", buyS, {
    kind: "trade_sign",
    action: "buy",
    pool: "auto",
    wallet: true,
    slippage: 3,
  }),
  sk("td", "slippage_wide", "Buy with 20% slippage (thin books).", buyS, {
    kind: "trade_sign",
    action: "buy",
    pool: "auto",
    wallet: true,
    slippage: 20,
  }),
  sk("td", "claim_fees", "Claim pump.fun creator / create fees.", signS, {
    kind: "sign_op",
    signKind: "claim",
    wallet: true,
  }),
  sk("td", "claim_rent", "Find empty ATAs and reclaim rent SOL.", signS, {
    kind: "sign_op",
    signKind: "rent",
    wallet: true,
  }),
  sk("td", "sell_all", "Sell every SPL holding to SOL (wallet signs each).", signS, {
    kind: "sign_op",
    signKind: "sell-all",
    wallet: true,
  }),
  sk("td", "burn_pct", "Burn a percent of a mint via Phantom.", signS, {
    kind: "sign_op",
    signKind: "burn",
    wallet: true,
  }),
  sk("td", "size_from_usd", "Convert a USD size to a SOL buy quote.", {
    type: "object",
    properties: {
      mint: { type: "string" },
      amountUsd: { type: "number" },
      publicKey: { type: "string" },
    },
    required: ["mint", "amountUsd", "publicKey"],
  }, { kind: "usd_buy", wallet: true }),
  sk("td", "dca_plan", "Build a 3-slice SOL DCA plan from live price (no custody).", ideaS, {
    kind: "idea",
    template: "dca",
  }),
  sk("td", "copy_wallet", "Show a wallet's recent swaps to copy (you still sign).", walletS, {
    kind: "swaps",
    chain: "solana",
    wallet: true,
  }),
  sk("td", "fee_desk", "Open the OrbitX shop / desk fee page.", empty, { kind: "open", path: "/shop" }),

  // —— Data (20)
  intel("token", "/api/ogdex/token", "Token overview"),
  intel("safety", "/api/ogdex/safety", "Safety scan"),
  intel("forensics", "/api/ogdex/forensics", "Forensics / origin"),
  intel("ath", "/api/ogdex/ath", "All-time high"),
  intel("xray", "/api/ogdex/xray", "X-ray risk"),
  intel("research", "/api/ogdex/research", "Research brief"),
  intel("metadata", "/api/ogdex/metadata", "On-chain metadata"),
  intel("crypto_scan", "/api/orbitx/crypto-scan", "OrbitX crypto scan"),
  chart("1m", "1 minute"),
  chart("5m", "5 minute"),
  chart("1h", "1 hour"),
  chart("4h", "4 hour"),
  chart("24h", "24 hour"),
  sk("data", "search", "Search tokens by name, ticker, or CA.", {
    type: "object",
    properties: { q: { type: "string" } },
    required: ["q"],
  }, { kind: "search", chain: "solana" }),
  sk("data", "wallet", "Wallet portfolio: SOL + SPL + PnL.", walletS, { kind: "wallet", chain: "solana", wallet: true }),
  sk("data", "swaps", "Recent wallet swaps.", walletS, { kind: "swaps", chain: "solana", wallet: true }),
  sk("data", "balance", "SOL or mint balance.", walletS, { kind: "balance", chain: "solana", wallet: true }),
  sk("data", "kols", "KOL directory.", limitS, { kind: "get", path: "/api/ogdex/kols?limit=20" }),
  sk("data", "traders", "Top traders.", limitS, { kind: "get", path: "/api/ogdex/traders?limit=20" }),
  sk("data", "signals", "Live trading signals.", limitS, { kind: "get", path: "/api/ogdex/signals?limit=20" }),

  // —— PDF (12)
  pdf("token", "Token report"),
  pdf("safety", "Safety report"),
  pdf("forensics", "Forensics report"),
  pdf("xray", "X-ray report"),
  pdf("research", "Research report"),
  pdf("ath", "ATH report"),
  pdf("wallet", "Wallet report"),
  pdf("market", "Market snapshot"),
  pdf("launch", "Launch memo"),
  pdf("nft", "NFT brief"),
  pdf("weekly", "Weekly tape"),
  sk("pdf", "pack", "Bundle token + safety + xray + research links for one CA.", mintReq, {
    kind: "pack",
    paths: ["token", "safety", "xray", "research"],
  }),

  // —— Create (15)
  sk("create", "pump", "Launch a pump.fun coin via Phantom launchpad.", launchS, {
    kind: "create_token",
    lane: "pump",
  }),
  sk("create", "custom", "Launch a custom SPL mint via Phantom launchpad.", launchS, {
    kind: "create_token",
    lane: "custom",
  }),
  sk("create", "check_name", "Anti-vamp name/ticker check before launch.", checkS, { kind: "launch_check" }),
  sk("create", "vanity", "Open vanity mint grind (obx suffix).", empty, {
    kind: "open",
    path: "/orbitxlaunch/create/pump",
  }),
  sk("create", "ipfs", "Open launchpad so the user can upload a logo (Supabase → Pinata).", empty, {
    kind: "open",
    path: "/orbitxlaunch/create/pump",
  }),
  sk("create", "image_box", "Open the token image upload box on the pump lane.", empty, {
    kind: "open",
    path: "/orbitxlaunch/create/pump",
  }),
  sk("create", "launch_config", "Launchpad fee / pay-wallet config.", empty, {
    kind: "get",
    path: "/api/ogdex/launch?config=1&chain=solana",
  }),
  sk("create", "nft_mint", "Open NFT mint studio.", empty, { kind: "open", path: "/nft/create" }),
  sk("create", "nft_collection", "Open NFT collection create.", empty, { kind: "open", path: "/nft/create" }),
  sk("create", "listing", "Open token listing request.", empty, { kind: "open", path: "/ORBITX_DEX" }),
  sk("create", "boost", "Open boost request desk.", empty, { kind: "open", path: "/ORBITX_DEX" }),
  sk("create", "metadata_json", "Open custom-lane metadata upload.", empty, {
    kind: "open",
    path: "/orbitxlaunch/create/custom",
  }),
  sk("create", "curve_evm", "Open EVM bonding-curve launcher.", empty, {
    kind: "open",
    path: "/orbitxlaunch/create/curve",
  }),
  sk("create", "anti_vamp", "Open anti-vamp explainer.", empty, { kind: "open", path: "/vamp" }),
  sk("create", "launchpad_home", "Open OrbitX launchpad home.", empty, { kind: "open", path: "/orbitxlaunch" }),

  // —— Idea (15)
  idea("ticker", "ticker", "Suggest ticker frames from a name or mint."),
  idea("name", "name", "Suggest token name frames."),
  idea("thesis", "thesis", "One-paragraph trade thesis from live data."),
  idea("one_pager", "one_pager", "One-pager outline grounded in live token fields."),
  idea("tweet", "tweet", "X/Twitter draft from live stats only."),
  idea("telegram_pitch", "telegram", "Telegram pitch from live stats only."),
  idea("risk_memo", "risk", "Risk memo — safety/xray first."),
  sk("idea", "compare", "Compare two mints with live overviews.", compareS, { kind: "compare" }),
  idea("narrative", "narrative", "Narrative / positioning brief."),
  idea("catalyst", "catalyst", "Catalyst checklist (no invented dates)."),
  idea("similar", "similar", "Find similar tickers via search."),
  idea("vibe", "vibe", "Vibe / aesthetic brief for creative."),
  idea("faq", "faq", "FAQ skeleton for a token."),
  idea("slogan", "slogan", "Slogan lines (no fake claims)."),
  idea("whitepaper", "whitepaper", "Whitepaper section outline."),

  // —— NFT (15)
  sk("nft", "items", "Latest OrbitX NFTs.", limitS, {
    kind: "sb",
    path: "orbitx_nfts?order=created_at.desc&limit=20&select=*",
  }),
  sk("nft", "collections", "NFT collections.", limitS, {
    kind: "sb",
    path: "orbitx_nft_collections?order=created_at.desc&limit=20&select=*",
  }),
  sk("nft", "listings", "Active NFT listings.", limitS, {
    kind: "sb",
    path: "orbitx_nft_listings?status=eq.active&order=created_at.desc&limit=20&select=*,nft:orbitx_nfts(*)",
  }),
  sk("nft", "auctions", "NFT auctions.", limitS, {
    kind: "sb",
    path: "orbitx_nft_auctions?status=in.(active,ended)&order=ends_at.asc&limit=20&select=*,nft:orbitx_nfts(*)",
  }),
  sk("nft", "sales", "Recent NFT sales.", limitS, {
    kind: "sb",
    path: "orbitx_nft_transactions?order=created_at.desc&limit=20&select=id,amount_sol,buyer_wallet,seller_wallet,created_at,tx_signature,nft:orbitx_nfts(*)",
  }),
  openSkill("nft", "mint", "/agent/nft-mint", "agent NFT mint"),
  openSkill("nft", "list_sale", "/nft", "list NFT for sale"),
  openSkill("nft", "offer", "/nft", "make an NFT offer"),
  openSkill("nft", "bid", "/nft", "bid on an NFT auction"),
  openSkill("nft", "like", "/nft", "NFT like / favorite"),
  openSkill("nft", "comment", "/nft", "NFT comments"),
  openSkill("nft", "follow", "/nft", "follow a creator"),
  openSkill("nft", "favorites", "/nft", "NFT favorites"),
  openSkill("nft", "activity", "/nft", "NFT activity"),
  openSkill("nft", "studio", "/nft/create", "NFT create studio"),

  // —— Launch (10)
  openSkill("ln", "pump_desk", "/orbitxlaunch/create/pump", "pump launch desk"),
  openSkill("ln", "custom_desk", "/orbitxlaunch/create/custom", "custom launch desk"),
  sk("ln", "claim_fees", "Claim launchpad / pump creator fees.", signS, {
    kind: "sign_op",
    signKind: "claim",
    wallet: true,
  }),
  openSkill("ln", "rescue", "/orbitxlaunch/rescue", "rent + fee rescue"),
  openSkill("ln", "about", "/orbitxlaunch/about", "launchpad about"),
  openSkill("ln", "leaderboard", "/orbitxlaunch/leaderboard", "launch leaderboard"),
  openSkill("ln", "creator", "/orbitxlaunch/profile", "creator profile"),
  openSkill("ln", "portfolio", "/orbitxlaunch/portfolio", "launch portfolio"),
  sk("ln", "recent", "Recent OrbitX launches.", limitS, { kind: "get", path: "/api/ogdex/launches?limit=20" }),
  openSkill("ln", "record", "/orbitxlaunch", "record / registry home"),

  // —— Desk / platform (13)
  openSkill("desk", "shop", "/shop", "OrbitX shop"),
  openSkill("desk", "credits", "/shop", "credits desk"),
  openSkill("desk", "mcp_access", "/shop", "MCP access burn"),
  openSkill("desk", "whoami", "/ai", "OrbitX AI / identity"),
  sk("desk", "health", "API health.", empty, { kind: "get", path: "/api/ogdex/health" }),
  sk("desk", "config", "Public config.", empty, { kind: "get", path: "/api/ogdex/config" }),
  sk("desk", "stats", "Platform stats.", empty, { kind: "get", path: "/api/ogdex/platform-stats" }),
  openSkill("desk", "city", "/Orbitxcity", "OrbitX City"),
  openSkill("desk", "play", "/play", "Play studio"),
  openSkill("desk", "intel", "/intel", "Crypto intel"),
  openSkill("desk", "hq", "/hq", "Social HQ"),
  openSkill("desk", "terminal", "/terminal", "Trading terminal"),
  openSkill("desk", "predictions", "/predictions", "Predictions"),
];

if (CUSTOM_SKILLS.length !== CUSTOM_SKILL_COUNT) {
  throw new Error(`CUSTOM_SKILLS length ${CUSTOM_SKILLS.length} !== ${CUSTOM_SKILL_COUNT}`);
}

const SKILL_NAMES = new Set(CUSTOM_SKILLS.map((s) => s.name));
if (SKILL_NAMES.size !== CUSTOM_SKILL_COUNT) {
  throw new Error("duplicate custom skill names");
}

export function listCustomSkillCategories() {
  const by = {};
  for (const s of CUSTOM_SKILLS) {
    if (!by[s.category]) by[s.category] = [];
    by[s.category].push(s.name);
  }
  return by;
}

export function registerCustomSkills(push, toolFn) {
  for (const s of CUSTOM_SKILLS) {
    push(toolFn(s.name, s.description, s.inputSchema, s.meta));
  }
}

function liveTokenFields(token) {
  if (!token || typeof token !== "object") return null;
  const row = token.token && typeof token.token === "object" ? { ...token, ...token.token } : token;
  const price = row.priceUsd ?? row.price ?? null;
  return {
    name: row.name || null,
    symbol: row.symbol || row.ticker || null,
    mint: row.mint || row.mintAddress || null,
    priceUsd: price == null ? null : Number(price),
    liquidityUsd: row.liquidityUsd ?? row.liquidity?.usd ?? null,
    volume24h: row.volume24h ?? row.volume?.h24 ?? null,
    warning: token.error ? String(token.error) : null,
  };
}

function ideaBrief(template, args, live) {
  const topic = String(args.topic || args.q || args.name || args.symbol || "").trim();
  const sym = live?.symbol || String(args.symbol || "").trim().toUpperCase() || null;
  const nm = live?.name || String(args.name || topic || "").trim() || null;
  const price =
    live?.priceUsd != null && Number.isFinite(live.priceUsd) ? `$${live.priceUsd}` : "no live quote";
  const liq =
    live?.liquidityUsd != null && Number.isFinite(Number(live.liquidityUsd))
      ? `$${Number(live.liquidityUsd).toLocaleString()}`
      : "unknown";
  const frames = {
    ticker: [`${(nm || "TOKEN").replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase() || "OBX"}`, "Keep 2–10 chars. Do not copy a live ticker."],
    name: [nm || topic || "Untitled", "Pair with a unique ticker. Run orbitx_skill_create_check_name before launch."],
    thesis: [`${sym || nm || "This token"} — last print ${price}, liquidity ${liq}. Thesis must use only these live fields.`],
    one_pager: ["Identity", "Live market (price/liq only if present)", "Risks", "Links", "CTA"],
    tweet: [`${sym ? `$${sym}` : topic || "OrbitX"} · print ${price} · liq ${liq}. No hopium, no invented %."`],
    telegram: [`Brief: ${sym || nm || topic || "token"}. Price ${price}. Liquidity ${liq}. Link the OrbitX token page.`],
    risk: ["Check mint/freeze", "Holders / bundles (xray)", "Liquidity lock", "Name collision (anti-vamp)"],
    narrative: [`Position ${nm || sym || "the project"} from live facts only. Price ${price}.`],
    catalyst: ["Do not invent dates", "List only stated links / launches", "Flag missing data"],
    similar: [topic || sym || "pass q=ticker to search"],
    vibe: ["Palette", "Motion", "Type", "No fake social proof"],
    faq: ["What is it?", "Contract?", "Fees?", "Where to trade?", "Risks?"],
    slogan: [`${nm || "OrbitX"} · keep claims qualitative`],
    whitepaper: ["Overview", "Token", "Market", "Risks", "Links"],
    dca: live?.priceUsd
      ? [`3 slices of the SOL budget at last print ${price}. Re-quote before each sign.`]
      : ["No live price — fetch orbitx_skill_data_token before sizing."],
  };
  return frames[template] || ["Use live fields only. Do not invent numbers."];
}

export async function dispatchCustomSkill(name, args, ctx) {
  const skill = CUSTOM_SKILLS.find((s) => s.name === name);
  if (!skill) return null;
  const meta = skill.meta || {};
  const { base, fetchJson, wallet } = ctx;
  const mint = String(args.mint || "").trim();
  const pk = String(wallet || args.publicKey || args.address || "").trim();

  if (meta.kind === "idea") {
    let token = null;
    if (mint) {
      try {
        token = await fetchJson(`${base}/api/ogdex/token?mint=${encodeURIComponent(mint)}&chain=solana`);
      } catch (e) {
        token = { error: e?.message || "token_unavailable" };
      }
    }
    if (meta.template === "similar") {
      const q = String(args.q || args.symbol || args.name || "").trim();
      if (q) {
        try {
          token = await fetchJson(`${base}/api/ogdex/search?q=${encodeURIComponent(q)}&chain=solana`);
        } catch {
          /* keep token */
        }
      }
    }
    const live = liveTokenFields(token);
    return {
      ok: true,
      skill: name,
      category: "idea",
      template: meta.template,
      mint: mint || null,
      live,
      brief: ideaBrief(meta.template, args, live),
      note: "Ground the answer in `live` only. Never invent prices, holders, or dates.",
      openUrl: mint ? `${base}/ORBITX_DEX/token/${encodeURIComponent(mint)}` : `${base}/intel`,
    };
  }

  if (meta.kind === "sign_op") {
    if (!pk) throw new Error("publicKey required (or link wallet on /agent)");
    const q = new URLSearchParams({ kind: meta.signKind, publicKey: pk, auto: "1" });
    if (meta.signKind === "burn") {
      if (!mint) throw new Error("mint required");
      q.set("mint", mint);
      if (args.percent != null) q.set("percent", String(args.percent));
      else if (args.amount != null) q.set("amount", String(args.amount));
      else q.set("percent", "100");
    }
    const signUrl = `${base}/agent/sign?${q.toString()}`;
    return {
      ok: true,
      status: "awaiting_auto_phantom",
      requiresSignature: true,
      signUrl,
      autoSignUrl: signUrl,
      openUrl: signUrl,
      action: meta.signKind,
      wallet: pk,
      instructions: [
        "Open autoSignUrl — Jupiter/Phantom prompts after connect.",
        "OrbitX never holds keys. Approve only what you intend.",
      ],
    };
  }

  if (meta.kind === "pack") {
    if (!mint) throw new Error("mint required");
    const paths = meta.paths || ["token", "safety", "xray"];
    const pack = {};
    await Promise.all(
      paths.map(async (p) => {
        try {
          pack[p] = await fetchJson(`${base}/api/ogdex/${p}?mint=${encodeURIComponent(mint)}`);
        } catch (e) {
          pack[p] = { ok: false, error: e?.message || "failed" };
        }
      }),
    );
    return {
      ok: true,
      mint,
      pack,
      reportUrl: `${base}/api/ogdex/report?mint=${encodeURIComponent(mint)}`,
      note: "PDF via reportUrl. Use pack fields only — do not invent missing stats.",
    };
  }

  if (meta.kind === "compare") {
    const b = String(args.mintB || args.vs || args.other || "").trim();
    if (!mint || !b) throw new Error("mint and mintB required");
    const [aTok, bTok] = await Promise.all([
      fetchJson(`${base}/api/ogdex/token?mint=${encodeURIComponent(mint)}&chain=solana`).catch((e) => ({
        error: e?.message || "failed",
      })),
      fetchJson(`${base}/api/ogdex/token?mint=${encodeURIComponent(b)}&chain=solana`).catch((e) => ({
        error: e?.message || "failed",
      })),
    ]);
    return {
      ok: true,
      a: liveTokenFields(aTok),
      b: liveTokenFields(bTok),
      rawA: aTok,
      rawB: bTok,
      note: "Compare only returned live fields.",
    };
  }

  if (meta.kind === "launch_check") {
    return fetchJson(`${base}/api/ogdex/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "check",
        name: String(args.name || ""),
        symbol: String(args.symbol || ""),
        chain: "solana",
      }),
    });
  }

  if (meta.kind === "usd_buy") {
    if (!pk) throw new Error("publicKey required");
    if (!mint) throw new Error("mint required");
    const usd = Number(args.amountUsd);
    if (!Number.isFinite(usd) || usd <= 0) throw new Error("amountUsd required");
    const qs = new URLSearchParams({
      kind: "trade",
      action: "buy",
      mint,
      amount: String(usd),
      publicKey: pk,
      slippage: "10",
      pool: "auto",
    });
    return {
      ok: true,
      status: "awaiting_usd_quote",
      message: "Open signUrl after converting USD→SOL via orbitx_prepare_buy (amountUsd) or pass amountSol.",
      hintTool: "orbitx_prepare_buy",
      args: { mint, amountUsd: usd, publicKey: pk },
      signUrl: `${base}/agent/sign?${qs.toString()}`,
      openUrl: `${base}/trade`,
    };
  }

  return null;
}

export function customSkillStats() {
  const categories = listCustomSkillCategories();
  return {
    count: CUSTOM_SKILLS.length,
    categories: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v.length])),
  };
}
