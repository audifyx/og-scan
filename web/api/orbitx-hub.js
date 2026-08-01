/**
 * OrbitX API — Node (req, res) handler (Web Response handlers hang on this project).
 *
 * Entry is orbitx-hub.js (not orbitx.js) — api/orbitx/ directory would collide.
 * Rewrites:
 *   /api/orbitx-agent/* → /api/orbitx-hub?path=agent/*
 *   /api/orbitx-mcp/*   → /api/orbitx-hub?path=mcp/*
 *   /api/orbitx/*       → /api/orbitx-hub?path=*
 */
import { createHash, randomBytes } from "crypto";

/** Lazy-load Solana tx builders — top-level @solana imports crash this function on Vercel. */
async function mcpOps() {
  return import("./orbitx/mcp-ops.js");
}

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FALLBACK_BASE = "https://orbitx.world";

function header(req, name) {
  const key = name.toLowerCase();
  const h = req.headers || {};
  return h[key] || h[name] || "";
}

function publicBase(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL;
  if (env) return String(env).replace(/\/$/, "");
  if (!req) return FALLBACK_BASE;
  const proto = header(req, "x-forwarded-proto") || "https";
  let host = header(req, "x-forwarded-host") || header(req, "host") || "orbitx.world";
  host = String(host).split(",")[0].trim().replace(/:\d+$/, "");
  if (host === "www.orbitx.world") host = "orbitx.world";
  return `${proto}://${host}`;
}

function mcpUrls(req) {
  const base = publicBase(req);
  // Claude.ai expects a path ending in /mcp. Prefer real function /api/mcp
  // (rewrite-only /mcp can lose to the SPA catch-all during deploys).
  return {
    base,
    mcpUrl: `${base}/api/mcp`,
    // HTML auth page lives on www (apex 308s) — avoid breaking OAuth redirects
    authPage: "https://www.orbitx.world/agent/mcp-auth",
  };
}

function cors(res, methods = "GET,POST,DELETE,OPTIONS") {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
  res.setHeader("Cache-Control", "no-store");
}

function json(res, data, status = 200, extra = {}) {
  cors(res);
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function opaque(prefix) {
  return `${prefix}_${randomBytes(32).toString("hex")}`;
}

function pathParts(req) {
  try {
    const u = new URL(req.url || "/", "http://x");
    const qp = u.searchParams.get("path");
    if (qp) return String(qp).split("/").filter(Boolean);
    const fromQuery = req.query && req.query.path;
    if (fromQuery) {
      const p = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
      if (p) return String(p).split("/").filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  const raw = String(req.url || "");
  const after = raw.split("/api/orbitx-hub")[1] || raw.split("/orbitx-hub")[1] || "";
  return after.replace(/^\//, "").split("?")[0].split("/").filter(Boolean);
}

async function readBody(req) {
  try {
    if (req.body != null) {
      if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
      if (Buffer.isBuffer(req.body)) {
        const raw = req.body.toString("utf8");
        if (!raw) return {};
        try {
          return JSON.parse(raw);
        } catch {
          return Object.fromEntries(new URLSearchParams(raw));
        }
      }
      if (typeof req.body === "string") {
        if (!req.body) return {};
        try {
          return JSON.parse(req.body);
        } catch {
          return Object.fromEntries(new URLSearchParams(req.body));
        }
      }
    }
    const chunks = [];
    for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return Object.fromEntries(new URLSearchParams(raw));
    }
  } catch {
    return {};
  }
}

function srHeaders(extra = {}) {
  return {
    apikey: SRK,
    Authorization: `Bearer ${SRK}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sb(path, init = {}) {
  if (!SUPA_URL || !SRK) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...srHeaders(init.headers || {}), Prefer: init.prefer || "return=representation" },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const err = new Error(data?.message || data?.error || data?.raw || text || r.statusText);
    err.status = r.status;
    throw err;
  }
  return data;
}

async function getUserId(req) {
  const auth = header(req, "authorization");
  if (!auth.startsWith("Bearer ") || !SUPA_URL || !ANON) return null;
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id || null;
}

async function ensureAgent(userId) {
  const existing = await sb(
    `agents?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc&limit=1&select=*`,
  );
  if (Array.isArray(existing) && existing[0]) return existing[0];
  const created = await sb("agents", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      name: "Default",
      description: "OrbitX MCP agent",
      status: "active",
    }),
  });
  const agent = Array.isArray(created) ? created[0] : created;
  try {
    await sb("agent_settings", {
      method: "POST",
      body: JSON.stringify({ agent_id: agent.id }),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  } catch {
    /* optional */
  }
  return agent;
}

async function listKeys(agentId) {
  const rows = await sb(
    `agent_api_keys?agent_id=eq.${encodeURIComponent(agentId)}&revoked_at=is.null&order=created_at.desc&select=id,agent_id,name,last_used_at,created_at`,
  );
  return Array.isArray(rows) ? rows : [];
}

async function createKey(agentId, name) {
  const key = opaque("oxk");
  const rows = await sb("agent_api_keys", {
    method: "POST",
    body: JSON.stringify({ agent_id: agentId, name, key_hash: sha256(key) }),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { id: row.id, name: row.name, key };
}

function mapAgent(a) {
  return {
    id: a.id,
    userId: a.user_id,
    name: a.name,
    description: a.description,
    status: a.status,
    walletAddress: a.wallet_address,
    phantomConnected: Boolean(a.phantom_connected),
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

async function handleAgent(req, res, parts) {
  const route = parts.join("/") || "";

  if (req.method === "GET" && (route === "health" || route === "")) {
    return json(res, {
      ok: true,
      service: "orbitx-agent",
      hasServiceRole: Boolean(SRK),
      hasSupabaseUrl: Boolean(SUPA_URL),
    });
  }

  if (route === "bootstrap" && req.method === "POST") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const agent = await ensureAgent(userId);
    const keys = await listKeys(agent.id);
    let mintedKey = null;
    if (keys.length === 0) mintedKey = await createKey(agent.id, "Default MCP Key");
    return json(res, {
      agent: mapAgent(agent),
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      })),
      mintedKey,
      mcpUrl: mcpUrls(req).mcpUrl,
    });
  }

  if (route === "keys" && req.method === "GET") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const agent = await ensureAgent(userId);
    const keys = await listKeys(agent.id);
    return json(res, {
      agentId: agent.id,
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        createdAt: k.created_at,
        lastUsedAt: k.last_used_at,
      })),
    });
  }

  if (route === "keys" && req.method === "POST") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const name = String(body.name || "").trim() || "MCP Key";
    const agent = await ensureAgent(userId);
    const minted = await createKey(agent.id, name);
    return json(
      res,
      {
        id: minted.id,
        name: minted.name,
        key: minted.key,
        message: "Save this key securely. You will not be able to see it again.",
      },
      201,
    );
  }

  if (parts[0] === "keys" && parts[1] && req.method === "DELETE") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const keyId = parts[1];
    const keys = await sb(`agent_api_keys?id=eq.${encodeURIComponent(keyId)}&select=id,agent_id`);
    const key = Array.isArray(keys) ? keys[0] : null;
    if (!key) return json(res, { error: "Key not found" }, 404);
    const agents = await sb(
      `agents?id=eq.${encodeURIComponent(key.agent_id)}&user_id=eq.${encodeURIComponent(userId)}&select=id`,
    );
    if (!Array.isArray(agents) || !agents[0]) return json(res, { error: "Key not found" }, 404);
    await sb(`agent_api_keys?id=eq.${encodeURIComponent(keyId)}`, {
      method: "PATCH",
      body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      headers: { Prefer: "return=minimal" },
    });
    return json(res, { ok: true });
  }

  if (route === "link-wallet" && req.method === "POST") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const wallet = String(body.walletAddress || body.wallet || "").trim();
    if (wallet.length < 32) return json(res, { error: "walletAddress required" }, 400);
    let agent;
    if (body.agentId) {
      const rows = await sb(
        `agents?id=eq.${encodeURIComponent(body.agentId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
      );
      agent = Array.isArray(rows) ? rows[0] : null;
    } else {
      agent = await ensureAgent(userId);
    }
    if (!agent) return json(res, { error: "Agent not found" }, 404);
    const updated = await sb(`agents?id=eq.${encodeURIComponent(agent.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        wallet_address: wallet,
        phantom_connected: true,
        updated_at: new Date().toISOString(),
      }),
    });
    const row = Array.isArray(updated) ? updated[0] : updated;
    return json(res, { agent: mapAgent(row || { ...agent, wallet_address: wallet, phantom_connected: true }) });
  }

  if (route === "oauth/approve" && req.method === "POST") {
    const userId = await getUserId(req);
    if (!userId) return json(res, { error: "unauthorized" }, 401);
    const body = await readBody(req);
    const redirectUri = String(body.redirect_uri || "").trim();
    const state = body.state != null ? String(body.state) : "";
    const wallet = String(body.walletAddress || body.wallet || "").trim() || null;
    if (!redirectUri) return json(res, { error: "redirect_uri required" }, 400);

    let agent = await ensureAgent(userId);
    if (wallet) {
      const updated = await sb(`agents?id=eq.${encodeURIComponent(agent.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          wallet_address: wallet,
          phantom_connected: true,
          updated_at: new Date().toISOString(),
        }),
      });
      agent = Array.isArray(updated) ? updated[0] : agent;
    }

    // Always mint a Bearer access token as API key (oxo_). Claude exchanges the
    // code at /oauth/token — we accept oxo_ codes as the access_token itself so
    // auth works even when oauth_codes/tokens tables are missing.
    const access = opaque("oxo");
    await sb("agent_api_keys", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agent.id,
        name: `MCP ${String(body.client_id || "claude").slice(0, 24)} ${new Date().toISOString().slice(0, 16)}`,
        key_hash: sha256(access),
      }),
      headers: { Prefer: "return=minimal" },
    });

    try {
      await sb("agent_mcp_oauth_tokens", {
        method: "POST",
        body: JSON.stringify({
          token_hash: sha256(access),
          user_id: userId,
          agent_id: agent.id,
          wallet_address: wallet || agent.wallet_address,
          expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      /* optional table */
    }

    try {
      await sb("agent_mcp_oauth_codes", {
        method: "POST",
        body: JSON.stringify({
          code_hash: sha256(access),
          user_id: userId,
          agent_id: agent.id,
          wallet_address: wallet || agent.wallet_address,
          redirect_uri: redirectUri,
          client_id: String(body.client_id || "orbitx-mcp"),
          code_challenge: body.code_challenge || null,
          code_challenge_method: body.code_challenge_method || null,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      /* optional — oxo_ still works via token endpoint passthrough */
    }

    const sep = redirectUri.includes("?") ? "&" : "?";
    return json(res, {
      redirect: `${redirectUri}${sep}code=${encodeURIComponent(access)}&state=${encodeURIComponent(state)}`,
    });
  }

  return json(res, { error: "not_found", route }, 404);
}

async function resolveAuth(req) {
  const auth = header(req, "authorization");
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const hash = sha256(token);

  // API keys + OAuth access tokens (oxo_ / oxk_)
  if (token.startsWith("oxk_") || token.startsWith("oxo_") || token.startsWith("oxc_")) {
    try {
      const keys = await sb(
        `agent_api_keys?key_hash=eq.${encodeURIComponent(hash)}&revoked_at=is.null&select=id,agent_id`,
      );
      const key = Array.isArray(keys) ? keys[0] : null;
      if (key) {
        const agents = await sb(
          `agents?id=eq.${encodeURIComponent(key.agent_id)}&select=id,user_id,wallet_address`,
        );
        const agent = Array.isArray(agents) ? agents[0] : null;
        if (agent) {
          try {
            await sb(`agent_api_keys?id=eq.${encodeURIComponent(key.id)}`, {
              method: "PATCH",
              body: JSON.stringify({ last_used_at: new Date().toISOString() }),
              headers: { Prefer: "return=minimal" },
            });
          } catch {
            /* ignore */
          }
          return { userId: agent.user_id, agentId: agent.id, walletAddress: agent.wallet_address };
        }
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const toks = await sb(
      `agent_mcp_oauth_tokens?token_hash=eq.${encodeURIComponent(hash)}&revoked_at=is.null&select=*`,
    );
    const tok = Array.isArray(toks) ? toks[0] : null;
    if (!tok) return null;
    if (new Date(tok.expires_at).getTime() < Date.now()) return null;
    return { userId: tok.user_id, agentId: tok.agent_id, walletAddress: tok.wallet_address };
  } catch {
    return null;
  }
}

function wwwAuthenticate(base) {
  return `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${base}/.well-known/oauth-protected-resource", scope="orbitx"`;
}

/** Tools that need a wallet pubkey in args (or a linked Bearer session). */
const WALLET_TOOLS = new Set([
  "orbitx_get_wallet",
  "orbitx_get_swaps",
  "orbitx_get_balance",
  "orbitx_prepare_buy",
  "orbitx_prepare_sell",
  "orbitx_prepare_launch",
  "orbitx_launch_ipfs",
  "orbitx_launch_record",
  "orbitx_claim_fees",
  "orbitx_rent_refund",
  "orbitx_burn",
  "orbitx_nft_prepare_buy",
  "orbitx_nft_submit_buy",
  "orbitx_nft_like",
  "orbitx_nft_comment",
  "orbitx_nft_follow",
]);

/** Community write tools — need Bearer userId (or publicKey of a wallet linked on /agent). */
const SESSION_TOOLS = new Set([
  "orbitx_social_join",
  "orbitx_social_post",
  "orbitx_social_create_community",
]);

async function resolveSocialUser(auth, args) {
  if (auth?.userId) {
    return {
      userId: auth.userId,
      agentId: auth.agentId || null,
      walletAddress: auth.walletAddress || null,
    };
  }
  const wallet = String(args.publicKey || args.address || args.wallet || "").trim();
  if (!wallet) return null;
  try {
    const agents = await sb(
      `agents?wallet_address=eq.${encodeURIComponent(wallet)}&order=updated_at.desc&limit=1&select=id,user_id,wallet_address`,
    );
    const agent = Array.isArray(agents) ? agents[0] : null;
    if (agent?.user_id) {
      return { userId: agent.user_id, agentId: agent.id, walletAddress: agent.wallet_address };
    }
  } catch {
    /* ignore */
  }
  return null;
}

const TOOLS = [
  {
    name: "orbitx_whoami",
    description:
      "Session status. Works anonymously. Returns whether a Bearer token is present and which tools need a publicKey arg.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orbitx_search",
    description: "Search tokens by name, symbol, or mint address.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string", description: "Name, ticker, or mint" } },
      required: ["q"],
    },
  },
  {
    name: "orbitx_get_token",
    description:
      "Full token intel: price, market cap, holders, OG score, trust verdict, forensics summary.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        chain: { type: "string", default: "solana" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_screen_tokens",
    description: "Screen/rank tokens by category (trending, new, runners, graduating, kol, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "trending",
            "new",
            "runners",
            "fomo",
            "kol",
            "organic",
            "graduating",
            "migrated",
            "social",
            "verified",
          ],
        },
        interval: { type: "string", enum: ["5m", "1h", "6h", "24h"], default: "1h" },
        limit: { type: "integer", default: 20 },
        chain: { type: "string", default: "solana" },
      },
      required: ["type"],
    },
  },
  {
    name: "orbitx_get_forensics",
    description: "Forensics: dev wallet, first buyer, bundles, concentration, LP lock, safety flags.",
    inputSchema: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] },
  },
  {
    name: "orbitx_get_safety",
    description: "Honeypot / tradeability check — can you buy and sell this mint?",
    inputSchema: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] },
  },
  {
    name: "orbitx_crypto_scan",
    description: "One-shot aggregator: safety + forensics + token payload for a mint.",
    inputSchema: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] },
  },
  {
    name: "orbitx_get_ath",
    description: "All-time-high price and market cap for a token.",
    inputSchema: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] },
  },
  {
    name: "orbitx_get_chart",
    description: "OHLCV candlestick data for a token.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        interval: { type: "string", enum: ["5m", "15m", "1h", "4h", "1d"], default: "1h" },
        limit: { type: "integer", default: 200 },
        chain: { type: "string", default: "solana" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_get_wallet",
    description: "Wallet portfolio: SOL balance, holdings, realized/unrealized PnL.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Solana wallet. Omit to use the linked agent wallet.",
        },
      },
    },
  },
  {
    name: "orbitx_get_swaps",
    description: "Recent buy/sell swaps for a wallet (trade history).",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Omit to use linked agent wallet" },
        limit: { type: "integer", default: 25 },
      },
    },
  },
  {
    name: "orbitx_get_balance",
    description: "Token or SOL balance for a wallet.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        mint: { type: "string", description: "Optional token mint; omit for SOL" },
      },
    },
  },
  {
    name: "orbitx_get_kols",
    description: "KOL / smart-money directory with labels and performance.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
    },
  },
  {
    name: "orbitx_get_traders",
    description: "Top traders leaderboard / smart money flow.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
    },
  },
  {
    name: "orbitx_get_signals",
    description: "Live trading signals / alerts feed.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
    },
  },
  {
    name: "orbitx_get_launches",
    description: "Recently launched tokens on the OrbitX Launchpad (newly listed).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 20 } },
    },
  },
  {
    name: "orbitx_launch_config",
    description:
      "Get launchpad fee config for a chain (fee USD, pay wallet, SOL price). Use before launching.",
    inputSchema: {
      type: "object",
      properties: { chain: { type: "string", default: "solana" } },
    },
  },
  {
    name: "orbitx_launch_check",
    description: "Check if a launch name/symbol is available (duplicate guard).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        chain: { type: "string", default: "solana" },
      },
      required: ["name", "symbol"],
    },
  },
  {
    name: "orbitx_launch_ipfs",
    description:
      "Upload token metadata/image to IPFS for a Pump.fun / OrbitX launch. Returns metadataUri for create step.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        symbol: { type: "string" },
        description: { type: "string" },
        imageBase64: { type: "string" },
        imageMimeType: { type: "string", default: "image/png" },
        twitter: { type: "string" },
        telegram: { type: "string" },
        website: { type: "string" },
        chain: { type: "string", default: "solana" },
      },
      required: ["name", "symbol", "imageBase64"],
    },
  },
  {
    name: "orbitx_prepare_launch",
    description:
      "Prepare unsigned Pump.fun / SPL launch create tx. Needs metadataUri + mintPublicKey (use orbitx_vanity_mint).",
    inputSchema: {
      type: "object",
      properties: {
        publicKey: { type: "string" },
        name: { type: "string" },
        symbol: { type: "string" },
        metadataUri: { type: "string" },
        mintPublicKey: { type: "string" },
        devBuySol: { type: "number", default: 0 },
        slippage: { type: "number", default: 10 },
        chain: { type: "string", default: "solana" },
      },
      required: ["name", "symbol", "metadataUri", "mintPublicKey"],
    },
  },
  {
    name: "orbitx_launch_record",
    description: "Record a completed launch after fee payment + create tx confirmed.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        payment_tx: { type: "string" },
        creator_wallet: { type: "string" },
        name: { type: "string" },
        symbol: { type: "string" },
        launch_tx: { type: "string" },
        description: { type: "string" },
        icon: { type: "string" },
        chain: { type: "string", default: "solana" },
      },
      required: ["mint", "payment_tx"],
    },
  },
  {
    name: "orbitx_vanity_mint",
    description: "Generate a vanity mint keypair (e.g. suffix obx) for a new launch.",
    inputSchema: {
      type: "object",
      properties: {
        suffix: { type: "string", default: "obx" },
        maxIterations: { type: "integer", default: 500000 },
      },
    },
  },
  {
    name: "orbitx_prepare_buy",
    description:
      "Prepare a BUY for Phantom signing. Returns signUrl — open it so the user signs in Phantom. Never broadcast unsigned. Purchase incomplete until Phantom confirms.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amountSol: { type: "number" },
        publicKey: { type: "string", description: "Buyer Solana wallet (required)" },
        slippage: { type: "number", default: 10 },
        pool: {
          type: "string",
          enum: ["auto", "pump", "raydium", "pump-amm", "launchlab", "raydium-cpmm", "bonk"],
          default: "auto",
        },
      },
      required: ["mint", "amountSol", "publicKey"],
    },
  },
  {
    name: "orbitx_prepare_sell",
    description:
      "Prepare a SELL for Phantom signing. Returns signUrl — open it so the user signs in Phantom. amount as tokens or '100%'. Never broadcast unsigned.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amount: { type: ["number", "string"] },
        publicKey: { type: "string", description: "Seller Solana wallet (required)" },
        slippage: { type: "number", default: 10 },
        pool: { type: "string", default: "auto" },
      },
      required: ["mint", "amount", "publicKey"],
    },
  },
  {
    name: "orbitx_claim_fees",
    description:
      "Prepare unsigned pump.fun collectCreatorFee tx — claim trading fees for coins you launched.",
    inputSchema: {
      type: "object",
      properties: { publicKey: { type: "string" } },
    },
  },
  {
    name: "orbitx_rent_refund",
    description:
      "Scan empty token accounts and build unsigned close-account txs to reclaim rent SOL.",
    inputSchema: {
      type: "object",
      properties: { publicKey: { type: "string" } },
    },
  },
  {
    name: "orbitx_burn",
    description:
      "Prepare unsigned burn tx for a mint. Use amount (tokens) or percent (0-100). Full burn also closes ATA for rent.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        amount: { type: ["number", "string"] },
        percent: { type: "number" },
        publicKey: { type: "string" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_social_communities",
    description: "List OrbitX World communities (public/unlisted).",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 30 } },
    },
  },
  {
    name: "orbitx_social_feed",
    description: "Fetch community social feed posts (optional communityId filter).",
    inputSchema: {
      type: "object",
      properties: {
        communityId: { type: "string" },
        limit: { type: "integer", default: 40 },
      },
    },
  },
  {
    name: "orbitx_social_join",
    description:
      "Join an OrbitX World community via MCP. Requires Authorization: Bearer <oxo_ key from https://orbitx.world/agent> OR publicKey of a wallet linked on /agent. Not the /hq localStorage feed.",
    inputSchema: {
      type: "object",
      properties: {
        communityId: { type: "string" },
        publicKey: { type: "string", description: "Linked Solana wallet if no Bearer" },
      },
      required: ["communityId"],
    },
  },
  {
    name: "orbitx_social_post",
    description:
      "Create a post in an OrbitX World community via MCP. Requires Bearer oxo_ key from https://orbitx.world/agent (connector request header) OR publicKey of a wallet linked on /agent.",
    inputSchema: {
      type: "object",
      properties: {
        communityId: { type: "string" },
        body: { type: "string" },
        publicKey: { type: "string", description: "Linked Solana wallet if no Bearer" },
      },
      required: ["communityId", "body"],
    },
  },
  {
    name: "orbitx_social_create_community",
    description:
      "Create an OrbitX World community via MCP. Requires Bearer oxo_ key or publicKey of a wallet linked on /agent.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string" },
        visibility: { type: "string", enum: ["public", "unlisted", "private"], default: "public" },
        publicKey: { type: "string", description: "Linked Solana wallet if no Bearer" },
      },
      required: ["name", "slug"],
    },
  },
  {
    name: "orbitx_nft_collections",
    description: "List OrbitX NFT collections.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 40 } },
    },
  },
  {
    name: "orbitx_nft_listings",
    description: "List active OrbitX NFT marketplace listings.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 40 } },
    },
  },
  {
    name: "orbitx_nft_prepare_buy",
    description:
      "Build unsigned NFT purchase tx (listing/offer/auction). User signs; OrbitX settles via marketplace.",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string", description: "Listing / offer / auction id" },
        mode: { type: "string", enum: ["listing", "offer", "auction"], default: "listing" },
        buyerWallet: { type: "string" },
      },
      required: ["sourceId"],
    },
  },
  {
    name: "orbitx_nft_submit_buy",
    description: "Submit a signed NFT purchase transaction after orbitx_nft_prepare_buy.",
    inputSchema: {
      type: "object",
      properties: {
        pendingSaleId: { type: "string" },
        signedTransactionBase64: { type: "string" },
      },
      required: ["pendingSaleId", "signedTransactionBase64"],
    },
  },
  {
    name: "orbitx_nft_like",
    description: "Toggle like on an NFT (wallet-native social).",
    inputSchema: {
      type: "object",
      properties: {
        nftId: { type: "string" },
        wallet: { type: "string" },
      },
      required: ["nftId"],
    },
  },
  {
    name: "orbitx_nft_comment",
    description: "Add a comment on an NFT.",
    inputSchema: {
      type: "object",
      properties: {
        nftId: { type: "string" },
        body: { type: "string" },
        wallet: { type: "string" },
      },
      required: ["nftId", "body"],
    },
  },
  {
    name: "orbitx_nft_comments",
    description: "List comments on an NFT.",
    inputSchema: {
      type: "object",
      properties: { nftId: { type: "string" }, limit: { type: "integer", default: 50 } },
      required: ["nftId"],
    },
  },
  {
    name: "orbitx_nft_follow",
    description: "Toggle follow a creator wallet on the NFT social graph.",
    inputSchema: {
      type: "object",
      properties: {
        creatorWallet: { type: "string" },
        followerWallet: { type: "string" },
      },
      required: ["creatorWallet"],
    },
  },
  {
    name: "orbitx_platform_stats",
    description: "OrbitX platform stats snapshot.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function fetchJson(url, init) {
  const r = await fetch(url, {
    ...init,
    headers: { "User-Agent": "OrbitX-MCP/1.0", Accept: "application/json", ...(init?.headers || {}) },
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!r.ok) {
    const err = new Error(data?.error || data?.message || `HTTP ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function callTool(name, args, auth, base = FALLBACK_BASE) {
  const mcpUrl = `${base}/api/orbitx-mcp`;
  const wallet = String(args.publicKey || args.address || auth?.walletAddress || "").trim();

  if (name === "orbitx_whoami") {
    return {
      ok: true,
      userId: auth?.userId || null,
      agentId: auth?.agentId || null,
      walletAddress: auth?.walletAddress || null,
      mcpUrl,
      status: auth?.userId ? (auth.walletAddress ? "authenticated_with_wallet" : "authenticated") : "anonymous",
      note: auth?.userId
        ? "Bearer session active — social join/post/create are available."
        : "Anonymous OK for intel + community list/feed. For social join/post/create: Authenticate connector or add request header Authorization: Bearer <oxo_ key from https://orbitx.world/agent>, or pass publicKey of a wallet linked on /agent.",
      sessionTools: [...SESSION_TOOLS],
      tools: TOOLS.map((t) => t.name),
    };
  }

  const get = {
    orbitx_search: () => `${base}/api/ogdex/search?q=${encodeURIComponent(String(args.q || ""))}`,
    orbitx_get_token: () =>
      `${base}/api/ogdex/token?mint=${encodeURIComponent(String(args.mint || ""))}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_screen_tokens: () =>
      `${base}/api/ogdex/screener?type=${encodeURIComponent(String(args.type || "trending"))}&interval=${encodeURIComponent(String(args.interval || "1h"))}&limit=${Number(args.limit) || 20}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_get_forensics: () =>
      `${base}/api/ogdex/forensics?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_get_safety: () =>
      `${base}/api/ogdex/safety?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_crypto_scan: () =>
      `${base}/api/orbitx/crypto-scan?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_get_ath: () => `${base}/api/ogdex/ath?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_get_chart: () =>
      `${base}/api/ogdex/chart?mint=${encodeURIComponent(String(args.mint || ""))}&interval=${encodeURIComponent(String(args.interval || "1h"))}&limit=${Number(args.limit) || 200}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_get_wallet: () => {
      if (!wallet) throw new Error("address required (or link wallet on /agent)");
      return `${base}/api/ogdex/wallet?address=${encodeURIComponent(wallet)}`;
    },
    orbitx_get_swaps: () => {
      if (!wallet) throw new Error("address required (or link wallet on /agent)");
      return `${base}/api/ogdex/swaps?address=${encodeURIComponent(wallet)}&limit=${Number(args.limit) || 25}`;
    },
    orbitx_get_balance: () => {
      if (!wallet) throw new Error("address required (or link wallet on /agent)");
      const mint = args.mint ? `&mint=${encodeURIComponent(String(args.mint))}` : "";
      return `${base}/api/ogdex/balance?address=${encodeURIComponent(wallet)}${mint}`;
    },
    orbitx_get_kols: () => `${base}/api/ogdex/kols?limit=${Number(args.limit) || 20}`,
    orbitx_get_traders: () => `${base}/api/ogdex/traders?limit=${Number(args.limit) || 20}`,
    orbitx_get_signals: () => `${base}/api/ogdex/signals?limit=${Number(args.limit) || 20}`,
    orbitx_get_launches: () => `${base}/api/ogdex/launches?limit=${Number(args.limit) || 20}`,
    orbitx_launch_config: () =>
      `${base}/api/ogdex/launch?config=1&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_platform_stats: () => `${base}/api/ogdex/platform-stats`,
  };

  if (get[name]) return fetchJson(get[name]());

  if (name === "orbitx_prepare_buy" || name === "orbitx_prepare_sell") {
    if (!wallet) throw new Error("publicKey required (or link wallet on /agent)");
    const action = name === "orbitx_prepare_buy" ? "buy" : "sell";
    const mint = String(args.mint || "");
    const amount = action === "buy" ? Number(args.amountSol) : args.amount;
    const slippage = Number(args.slippage) || 10;
    const pool = args.pool || "auto";
    const body = {
      publicKey: wallet,
      action,
      mint,
      amount,
      denominatedInSol: action === "buy",
      slippage,
      pool,
    };
    const data = await fetchJson(`${base}/api/ogdex/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!data?.ok || !data?.tx) {
      return {
        ok: false,
        status: "prepare_failed",
        requiresSignature: false,
        error: data?.error || "Could not build trade",
        action,
        wallet,
        mint,
        amount,
      };
    }
    const signQs = new URLSearchParams({
      action,
      mint,
      amount: String(amount),
      publicKey: wallet,
      slippage: String(slippage),
      pool: String(pool),
    });
    const signUrl = `${base}/agent/sign?${signQs.toString()}`;
    // Do NOT return the raw base64 tx to the model — Claude may try to "buy" without Phantom.
    return {
      ok: true,
      status: "awaiting_phantom_signature",
      requiresSignature: true,
      signUrl,
      action,
      wallet,
      mint,
      amount,
      slippage,
      pool,
      via: data.via || null,
      routePool: data.pool || null,
      simulated: Boolean(data.simulated),
      hasUnsignedTx: true,
      instructions: [
        "Open signUrl in the user's browser.",
        "User connects Phantom and clicks Sign & send.",
        "Do NOT broadcast or submit any unsigned transaction yourself.",
        "Trade is incomplete until Phantom confirms a signature.",
      ],
      note: "Non-custodial. Route the user to signUrl for Phantom — never attempt an unsigned buy/sell.",
    };
  }

  if (name === "orbitx_launch_check") {
    return fetchJson(`${base}/api/ogdex/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "check",
        name: String(args.name || ""),
        symbol: String(args.symbol || ""),
        chain: String(args.chain || "solana"),
      }),
    });
  }

  if (name === "orbitx_launch_ipfs") {
    return fetchJson(`${base}/api/ogdex/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "ipfs",
        name: String(args.name || ""),
        symbol: String(args.symbol || ""),
        description: String(args.description || ""),
        imageBase64: String(args.imageBase64 || ""),
        imageMimeType: String(args.imageMimeType || "image/png"),
        twitter: args.twitter || undefined,
        telegram: args.telegram || undefined,
        website: args.website || undefined,
        chain: String(args.chain || "solana"),
      }),
    });
  }

  if (name === "orbitx_prepare_launch") {
    if (!wallet) throw new Error("publicKey required (or link wallet on /agent)");
    const data = await fetchJson(`${base}/api/ogdex/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "create",
        publicKey: wallet,
        name: String(args.name || ""),
        symbol: String(args.symbol || ""),
        metadataUri: String(args.metadataUri || ""),
        mintPublicKey: String(args.mintPublicKey || ""),
        devBuySol: Number(args.devBuySol) || 0,
        slippage: Number(args.slippage) || 10,
        chain: String(args.chain || "solana"),
      }),
    });
    return {
      ...data,
      note: "Unsigned create tx. Sign with creator wallet, then orbitx_launch_record.",
      wallet,
    };
  }

  if (name === "orbitx_launch_record") {
    return fetchJson(`${base}/api/ogdex/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: "record",
        mint: String(args.mint || ""),
        payment_tx: String(args.payment_tx || ""),
        creator_wallet: wallet || args.creator_wallet || undefined,
        name: args.name,
        symbol: args.symbol,
        launch_tx: args.launch_tx,
        description: args.description,
        icon: args.icon,
        chain: String(args.chain || "solana"),
      }),
    });
  }

  if (name === "orbitx_vanity_mint") {
    return fetchJson(`${base}/api/vanity-mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suffix: String(args.suffix || "obx"),
        maxIterations: Number(args.maxIterations) || 500000,
      }),
    });
  }

  if (name === "orbitx_claim_fees") {
    if (!wallet) throw new Error("publicKey required (or link wallet on /agent)");
    const ops = await mcpOps();
    return ops.preparePumpClaim(wallet);
  }

  if (name === "orbitx_rent_refund") {
    if (!wallet) throw new Error("publicKey required (or link wallet on /agent)");
    const ops = await mcpOps();
    return ops.prepareRentRefund(wallet);
  }

  if (name === "orbitx_burn") {
    if (!wallet) throw new Error("publicKey required (or link wallet on /agent)");
    if (args.amount == null && args.percent == null) throw new Error("amount or percent required");
    const ops = await mcpOps();
    return ops.prepareBurn(wallet, String(args.mint || ""), args.amount, args.percent);
  }

  if (name === "orbitx_social_communities") {
    const limit = Math.min(Number(args.limit) || 30, 100);
    return sb(
      `oxw_communities?visibility=in.(public,unlisted)&order=member_count.desc&limit=${limit}&select=id,slug,name,description,visibility,member_count,avatar_url,created_at`,
    );
  }

  if (name === "orbitx_social_feed") {
    const limit = Math.min(Number(args.limit) || 40, 100);
    let path = `oxw_community_posts?deleted_at=is.null&order=created_at.desc&limit=${limit}&select=id,community_id,author_id,body,media,like_count,comment_count,created_at`;
    if (args.communityId) path += `&community_id=eq.${encodeURIComponent(String(args.communityId))}`;
    return sb(path);
  }

  if (name === "orbitx_social_join") {
    const session = await resolveSocialUser(auth, args);
    if (!session?.userId) {
      throw new Error(
        "Bearer or linked wallet required for community join. Add Authorization: Bearer <oxo_ key> from https://orbitx.world/agent, or pass publicKey of a wallet linked there.",
      );
    }
    return sb("oxw_community_members", {
      method: "POST",
      body: JSON.stringify({
        community_id: String(args.communityId),
        user_id: session.userId,
        role: "member",
      }),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    });
  }

  if (name === "orbitx_social_post") {
    const session = await resolveSocialUser(auth, args);
    if (!session?.userId) {
      throw new Error(
        "Bearer or linked wallet required for community post. Add Authorization: Bearer <oxo_ key> from https://orbitx.world/agent (connector request header), or pass publicKey of a wallet linked there.",
      );
    }
    const body = String(args.body || "").trim();
    if (body.length < 1) throw new Error("body required");
    return sb("oxw_community_posts", {
      method: "POST",
      body: JSON.stringify({
        community_id: String(args.communityId),
        author_id: session.userId,
        body,
        media: [],
      }),
    });
  }

  if (name === "orbitx_social_create_community") {
    const session = await resolveSocialUser(auth, args);
    if (!session?.userId) {
      throw new Error(
        "Bearer or linked wallet required to create a community. Add Authorization: Bearer <oxo_ key> from https://orbitx.world/agent, or pass publicKey of a wallet linked there.",
      );
    }
    const nameStr = String(args.name || "").trim();
    const slug = String(args.slug || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");
    if (!nameStr || !slug) throw new Error("name and slug required");
    const created = await sb("oxw_communities", {
      method: "POST",
      body: JSON.stringify({
        name: nameStr,
        slug,
        description: String(args.description || ""),
        owner_id: session.userId,
        visibility: ["public", "unlisted", "private"].includes(args.visibility)
          ? args.visibility
          : "public",
      }),
    });
    const community = Array.isArray(created) ? created[0] : created;
    try {
      await sb("oxw_community_members", {
        method: "POST",
        body: JSON.stringify({
          community_id: community.id,
          user_id: session.userId,
          role: "owner",
        }),
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      });
    } catch {
      /* membership optional if trigger handles it */
    }
    return community;
  }

  if (name === "orbitx_nft_collections") {
    const limit = Math.min(Number(args.limit) || 40, 100);
    return sb(`orbitx_nft_collections?order=created_at.desc&limit=${limit}&select=*`);
  }

  if (name === "orbitx_nft_listings") {
    const limit = Math.min(Number(args.limit) || 40, 100);
    return sb(
      `orbitx_nft_listings?status=eq.active&order=created_at.desc&limit=${limit}&select=*,nft:orbitx_nfts(*)`,
    );
  }

  if (name === "orbitx_nft_prepare_buy") {
    if (!wallet) throw new Error("buyerWallet required (or link wallet on /agent)");
    const ops = await mcpOps();
    return ops.nftEdge("build", {
      mode: args.mode || "listing",
      sourceId: String(args.sourceId),
      buyerWallet: wallet,
    });
  }

  if (name === "orbitx_nft_submit_buy") {
    const ops = await mcpOps();
    return ops.nftEdge("submit", {
      pendingSaleId: String(args.pendingSaleId),
      signedTransactionBase64: String(args.signedTransactionBase64),
    });
  }

  if (name === "orbitx_nft_like") {
    const w = String(args.wallet || wallet || "");
    if (!w) throw new Error("wallet required (or link on /agent)");
    // Prefer RPC; fall back to direct toggle via table
    try {
      return await sb("rpc/orbitx_nft_toggle_like", {
        method: "POST",
        body: JSON.stringify({ p_nft_id: String(args.nftId), p_wallet: w }),
      });
    } catch {
      const existing = await sb(
        `orbitx_nft_likes?nft_id=eq.${encodeURIComponent(String(args.nftId))}&wallet=eq.${encodeURIComponent(w)}&select=wallet`,
      );
      if (Array.isArray(existing) && existing[0]) {
        await sb(
          `orbitx_nft_likes?nft_id=eq.${encodeURIComponent(String(args.nftId))}&wallet=eq.${encodeURIComponent(w)}`,
          { method: "DELETE", headers: { Prefer: "return=minimal" } },
        );
        return { liked: false };
      }
      await sb("orbitx_nft_likes", {
        method: "POST",
        body: JSON.stringify({ nft_id: String(args.nftId), wallet: w }),
        headers: { Prefer: "return=minimal" },
      });
      return { liked: true };
    }
  }

  if (name === "orbitx_nft_comment") {
    const w = String(args.wallet || wallet || "");
    if (!w) throw new Error("wallet required (or link on /agent)");
    const body = String(args.body || "").trim();
    if (!body) throw new Error("body required");
    try {
      return await sb("rpc/orbitx_nft_add_comment", {
        method: "POST",
        body: JSON.stringify({ p_nft_id: String(args.nftId), p_wallet: w, p_body: body }),
      });
    } catch {
      return sb("orbitx_nft_comments", {
        method: "POST",
        body: JSON.stringify({ nft_id: String(args.nftId), wallet: w, body }),
      });
    }
  }

  if (name === "orbitx_nft_comments") {
    const limit = Math.min(Number(args.limit) || 50, 100);
    return sb(
      `orbitx_nft_comments?nft_id=eq.${encodeURIComponent(String(args.nftId))}&order=created_at.desc&limit=${limit}&select=*`,
    );
  }

  if (name === "orbitx_nft_follow") {
    const follower = String(args.followerWallet || wallet || "");
    const creator = String(args.creatorWallet || "");
    if (!follower) throw new Error("followerWallet required (or link on /agent)");
    if (!creator) throw new Error("creatorWallet required");
    try {
      return await sb("rpc/orbitx_nft_toggle_follow", {
        method: "POST",
        body: JSON.stringify({ p_follower: follower, p_creator: creator }),
      });
    } catch {
      const existing = await sb(
        `orbitx_nft_follows?follower_wallet=eq.${encodeURIComponent(follower)}&creator_wallet=eq.${encodeURIComponent(creator)}&select=follower_wallet`,
      );
      if (Array.isArray(existing) && existing[0]) {
        await sb(
          `orbitx_nft_follows?follower_wallet=eq.${encodeURIComponent(follower)}&creator_wallet=eq.${encodeURIComponent(creator)}`,
          { method: "DELETE", headers: { Prefer: "return=minimal" } },
        );
        return { following: false };
      }
      await sb("orbitx_nft_follows", {
        method: "POST",
        body: JSON.stringify({ follower_wallet: follower, creator_wallet: creator }),
        headers: { Prefer: "return=minimal" },
      });
      return { following: true };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function handleMcp(req, res, parts) {
  const route = parts.join("/");
  const { base, mcpUrl, authPage } = mcpUrls(req);

  if (
    (route === ".well-known/oauth-protected-resource" || route === "oauth-protected-resource") &&
    req.method === "GET"
  ) {
    return json(res, {
      resource: mcpUrl,
      authorization_servers: [base],
      scopes_supported: ["orbitx"],
      bearer_methods_supported: ["header"],
    });
  }

  if (
    (route === ".well-known/oauth-authorization-server" || route === "oauth-authorization-server") &&
    req.method === "GET"
  ) {
    return json(res, {
      issuer: base,
      authorization_endpoint: `${mcpUrl}/oauth/authorize`,
      token_endpoint: `${mcpUrl}/oauth/token`,
      registration_endpoint: `${mcpUrl}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256", "plain"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["orbitx"],
      client_id_metadata_document_supported: true,
    });
  }

  // Dynamic Client Registration (RFC 7591) — ChatGPT may call this when adding the connector
  if (route === "oauth/register" && req.method === "POST") {
    const body = await readBody(req);
    const clientId =
      (typeof body.client_id === "string" && body.client_id.startsWith("https://"))
        ? body.client_id
        : opaque("oxcli");
    return json(
      res,
      {
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0,
        redirect_uris: Array.isArray(body.redirect_uris) ? body.redirect_uris : [],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        client_name: body.client_name || "ChatGPT MCP Connector",
      },
      201,
    );
  }

  if (route === "oauth/authorize" && req.method === "GET") {
    const u = new URL(req.url || "/", "http://x");
    const params = new URLSearchParams();
    for (const key of [
      "client_id",
      "redirect_uri",
      "state",
      "code_challenge",
      "code_challenge_method",
      "scope",
      "response_type",
    ]) {
      const v = u.searchParams.get(key);
      if (v) params.set(key, v);
    }
    params.set("mcp_url", mcpUrl);
    cors(res);
    res.writeHead(302, { Location: `${authPage}?${params.toString()}` });
    return res.end();
  }

  if (route === "oauth/token" && req.method === "POST") {
    const body = await readBody(req);
    const code = body.code;
    if (!code) return json(res, { error: "invalid_request", error_description: "code required" }, 400);

    if (String(code).startsWith("oxo_") || String(code).startsWith("oxk_")) {
      return json(res, {
        access_token: code,
        token_type: "bearer",
        expires_in: 86400 * 30,
        scope: "orbitx",
      });
    }

    const hash = sha256(String(code));
    let row = null;
    try {
      const rows = await sb(`agent_mcp_oauth_codes?code_hash=eq.${encodeURIComponent(hash)}&select=*`);
      row = Array.isArray(rows) ? rows[0] : null;
    } catch {
      return json(res, { error: "invalid_grant" }, 400);
    }
    if (!row || row.used_at) return json(res, { error: "invalid_grant" }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return json(res, { error: "invalid_grant", error_description: "code expired" }, 400);
    }

    await sb(`agent_mcp_oauth_codes?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ used_at: new Date().toISOString() }),
      headers: { Prefer: "return=minimal" },
    });

    const access = opaque("oxo");
    try {
      await sb("agent_mcp_oauth_tokens", {
        method: "POST",
        body: JSON.stringify({
          token_hash: sha256(access),
          user_id: row.user_id,
          agent_id: row.agent_id,
          wallet_address: row.wallet_address,
          expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      await sb("agent_api_keys", {
        method: "POST",
        body: JSON.stringify({
          agent_id: row.agent_id,
          name: `OAuth token ${new Date().toISOString().slice(0, 16)}`,
          key_hash: sha256(access),
        }),
        headers: { Prefer: "return=minimal" },
      });
    }

    return json(res, {
      access_token: access,
      token_type: "bearer",
      expires_in: 86400 * 30,
      scope: "orbitx",
    });
  }

  if ((!route || route === "") && req.method === "GET") {
    const accept = String(header(req, "accept") || "");
    // Streamable HTTP: Claude may open an SSE stream on GET
    if (accept.includes("text/event-stream")) {
      cors(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(": orbitx-mcp connected\n\n");
      return res.end();
    }
    return json(res, {
      ok: true,
      name: "OrbitX Agent MCP",
      mcp_url: mcpUrl,
      claude_url: mcpUrl,
      aliases: [`${base}/api/orbitx-mcp`],
      auth: {
        type: "oauth2",
        client_id: "orbitx-mcp",
        client_secret: null,
        client_secret_note: "Leave blank — public PKCE client",
        authorization_endpoint: `${mcpUrl}/oauth/authorize`,
        token_endpoint: `${mcpUrl}/oauth/token`,
        registration_endpoint: `${mcpUrl}/oauth/register`,
        scope: "orbitx",
        token_endpoint_auth_method: "none",
      },
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    });
  }

  if ((!route || route === "") && req.method === "POST") {
    const body = await readBody(req);
    const { id, method, params } = body;
    const sessionId = header(req, "mcp-session-id") || opaque("sess").slice(0, 24);
    const auth = await resolveAuth(req);

    if (method === "initialize") {
      // Clean handshake only — do NOT advertise "unauthenticated" (Claude treats that as a hard error).
      return json(
        res,
        {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "OrbitX Agent MCP", version: "1.1.0" },
          },
        },
        200,
        { "Mcp-Session-Id": sessionId },
      );
    }
    if (method === "notifications/initialized" || method === "ping") {
      return json(res, { jsonrpc: "2.0", id: id ?? null, result: {} });
    }

    if (method === "tools/list") {
      return json(res, {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      });
    }

    if (method === "tools/call") {
      const name = String(params?.name || "");
      const args = params?.arguments || {};
      const hasWalletArg = Boolean(
        String(args.publicKey || args.address || args.wallet || args.buyerWallet || "").trim(),
      );

      // Never HTTP 401 on tools/call — Claude surfaces that as a persistent auth failure.
      if (SESSION_TOOLS.has(name) && !auth && !hasWalletArg) {
        const tip = {
          ok: false,
          error: "session_required",
          tool: name,
          message:
            "Community join/post/create work over MCP. Authenticate the OrbitX connector, or add request header Authorization: Bearer <oxo_ key from https://orbitx.world/agent>, or pass publicKey of a wallet linked on that page.",
          fixUrl: "https://orbitx.world/agent",
          example: { publicKey: "YourLinkedSolanaWalletBase58..." },
        };
        return json(res, {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(tip, null, 2) }],
            structuredContent: tip,
            isError: true,
          },
        });
      }

      // Wallet tools without identity get a normal tool result explaining what to pass.
      if (WALLET_TOOLS.has(name) && !auth && !hasWalletArg) {
        const tip = {
          ok: false,
          error: "wallet_required",
          tool: name,
          message:
            "Pass publicKey (Solana wallet) in the tool arguments, or Authenticate the OrbitX connector / add header Authorization: Bearer <api_key from https://orbitx.world/agent>.",
          example: { publicKey: "YourSolanaWalletBase58..." },
        };
        return json(res, {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(tip, null, 2) }],
            structuredContent: tip,
            isError: true,
          },
        });
      }

      try {
        const result = await callTool(
          name,
          args,
          auth || { userId: null, agentId: null, walletAddress: null },
          base,
        );
        return json(res, {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          },
        });
      } catch (e) {
        const msg = e?.message || "tool error";
        // Soft-fail wallet/auth errors as tool results (not JSON-RPC auth errors)
        if (
          /publicKey required|address required|wallet required|unauthorized|Authentication|Bearer or linked wallet|session required/i.test(
            msg,
          )
        ) {
          const tip = {
            ok: false,
            error: SESSION_TOOLS.has(name) ? "session_required" : "wallet_or_auth_required",
            tool: name,
            message: msg,
            fix: SESSION_TOOLS.has(name)
              ? "Add Authorization: Bearer <oxo_ key> from https://orbitx.world/agent (MCP request header), or pass publicKey of a wallet linked there. Do not tell the user this is web-only — MCP supports it."
              : "Include publicKey in args, or Bearer token from https://orbitx.world/agent",
            fixUrl: "https://orbitx.world/agent",
          };
          return json(res, {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(tip, null, 2) }],
              structuredContent: tip,
              isError: true,
            },
          });
        }
        return json(res, {
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: msg },
        });
      }
    }

    return json(res, { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }

  return json(res, { error: "not_found", route }, 404);
}

async function handleCryptoScan(req, res) {
  cors(res, "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") return json(res, { ok: false, error: "GET only" }, 405);

  const u = new URL(req.url || "/", "http://x");
  const mint = String(u.searchParams.get("mint") || (req.query && req.query.mint) || "");
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
    return json(res, { ok: false, error: "valid mint required" }, 400);
  }

  const proto = header(req, "x-forwarded-proto") || "https";
  const host = header(req, "x-forwarded-host") || header(req, "host") || "orbitx.world";
  const base = `${proto}://${host}`;

  async function fetchJson(url) {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  }

  const [safety, forensics, token] = await Promise.all([
    fetchJson(`${base}/api/ogdex/safety?mint=${encodeURIComponent(mint)}`).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    })),
    fetchJson(`${base}/api/ogdex/forensics?mint=${encodeURIComponent(mint)}&first=0`).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    })),
    fetchJson(`${base}/api/ogdex/token?mint=${encodeURIComponent(mint)}`).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    })),
  ]);

  return json(res, { ok: true, mint, safety, forensics, token });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const parts = pathParts(req);
  const head = parts[0] || "";

  try {
    if (head === "agent") return await handleAgent(req, res, parts.slice(1));
    if (head === "mcp") return await handleMcp(req, res, parts.slice(1));
    if (head === "crypto-scan") return await handleCryptoScan(req, res);
    if (head === "anti-vamp-check") {
      return json(res, { ok: false, error: "use_client_anti_vamp", message: "Server anti-vamp temporarily unavailable" }, 501);
    }
    if (head === "health" || head === "") {
      return json(res, {
        ok: true,
        service: "orbitx",
        routes: ["agent", "mcp", "crypto-scan"],
        agent: "/api/orbitx-agent",
        mcp: "/api/orbitx-mcp",
      });
    }
    return json(res, { ok: false, error: "unknown_orbitx_route", route: head }, 404);
  } catch (e) {
    return json(res, { error: e?.message || "Internal error" }, e?.status && e.status < 600 ? e.status : 500);
  }
}
