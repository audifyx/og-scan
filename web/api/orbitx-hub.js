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

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PUBLIC_BASE = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://orbitx.world";
const MCP_URL = `${PUBLIC_BASE}/api/orbitx-mcp`;
const AUTH_PAGE = `${PUBLIC_BASE}/agent/mcp-auth`;

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

function header(req, name) {
  const key = name.toLowerCase();
  const h = req.headers || {};
  return h[key] || h[name] || "";
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
  if (req.body != null) {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return Object.fromEntries(new URLSearchParams(req.body));
      }
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  const ct = String(header(req, "content-type"));
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
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
      mcpUrl: MCP_URL,
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

    const code = opaque("oxc");
    try {
      await sb("agent_mcp_oauth_codes", {
        method: "POST",
        body: JSON.stringify({
          code_hash: sha256(code),
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
      const access = opaque("oxo");
      await sb("agent_api_keys", {
        method: "POST",
        body: JSON.stringify({
          agent_id: agent.id,
          name: `OAuth ${new Date().toISOString().slice(0, 16)}`,
          key_hash: sha256(access),
        }),
        headers: { Prefer: "return=minimal" },
      });
      const sep = redirectUri.includes("?") ? "&" : "?";
      return json(res, {
        redirect: `${redirectUri}${sep}code=${encodeURIComponent(access)}&state=${encodeURIComponent(state)}`,
        fallback: true,
      });
    }

    const sep = redirectUri.includes("?") ? "&" : "?";
    return json(res, {
      redirect: `${redirectUri}${sep}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
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

  if (token.startsWith("oxk_") || token.startsWith("oxo_")) {
    const keys = await sb(
      `agent_api_keys?key_hash=eq.${encodeURIComponent(hash)}&revoked_at=is.null&select=id,agent_id`,
    );
    const key = Array.isArray(keys) ? keys[0] : null;
    if (!key) return null;
    const agents = await sb(
      `agents?id=eq.${encodeURIComponent(key.agent_id)}&select=id,user_id,wallet_address`,
    );
    const agent = Array.isArray(agents) ? agents[0] : null;
    if (!agent) return null;
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

const TOOLS = [
  {
    name: "orbitx_whoami",
    description: "Return the linked OrbitX agent identity and wallet for the authenticated MCP session.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orbitx_get_token",
    description: "Get token data: price, market cap, holders, OG score, trust verdict.",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" }, chain: { type: "string", default: "solana" } },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_screen_tokens",
    description: "Screen tokens by category (trending, new, runners, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string" },
        interval: { type: "string", default: "1h" },
        limit: { type: "integer", default: 20 },
        chain: { type: "string", default: "solana" },
      },
      required: ["type"],
    },
  },
  {
    name: "orbitx_get_forensics",
    description: "Forensic data for a token.",
    inputSchema: { type: "object", properties: { mint: { type: "string" } }, required: ["mint"] },
  },
  {
    name: "orbitx_get_wallet",
    description: "Wallet portfolio: balances, PnL.",
    inputSchema: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
  },
  {
    name: "orbitx_search",
    description: "Search tokens by name, symbol, or mint.",
    inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
  },
];

async function callTool(name, args, auth) {
  if (name === "orbitx_whoami") {
    return {
      userId: auth.userId,
      agentId: auth.agentId,
      walletAddress: auth.walletAddress,
      mcpUrl: MCP_URL,
      status: auth.walletAddress ? "connected" : "wallet_not_linked",
    };
  }
  const routes = {
    orbitx_get_token: `${PUBLIC_BASE}/api/ogdex/token?mint=${encodeURIComponent(String(args.mint || ""))}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_screen_tokens: `${PUBLIC_BASE}/api/ogdex/screener?type=${encodeURIComponent(String(args.type || "trending"))}&interval=${encodeURIComponent(String(args.interval || "1h"))}&limit=${Number(args.limit) || 20}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_get_forensics: `${PUBLIC_BASE}/api/ogdex/forensics?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_get_wallet: `${PUBLIC_BASE}/api/ogdex/wallet?address=${encodeURIComponent(String(args.address || ""))}`,
    orbitx_search: `${PUBLIC_BASE}/api/ogdex/search?q=${encodeURIComponent(String(args.q || ""))}`,
  };
  const url = routes[name];
  if (!url) throw new Error(`Unknown tool: ${name}`);
  const r = await fetch(url, { headers: { "User-Agent": "OrbitX-MCP/1.0" } });
  return r.json();
}

async function handleMcp(req, res, parts) {
  const route = parts.join("/");

  if (
    (route === ".well-known/oauth-protected-resource" || route === "oauth-protected-resource") &&
    req.method === "GET"
  ) {
    return json(res, {
      resource: MCP_URL,
      authorization_servers: [PUBLIC_BASE],
      scopes_supported: ["orbitx"],
      bearer_methods_supported: ["header"],
    });
  }

  if (
    (route === ".well-known/oauth-authorization-server" || route === "oauth-authorization-server") &&
    req.method === "GET"
  ) {
    return json(res, {
      issuer: PUBLIC_BASE,
      authorization_endpoint: `${MCP_URL}/oauth/authorize`,
      token_endpoint: `${MCP_URL}/oauth/token`,
      registration_endpoint: `${MCP_URL}/oauth/register`,
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
    params.set("mcp_url", MCP_URL);
    cors(res);
    res.writeHead(302, { Location: `${AUTH_PAGE}?${params.toString()}` });
    return res.end();
  }

  if (route === "oauth/token" && req.method === "POST") {
    const body = await readBody(req);
    const code = body.code;
    if (!code) return json(res, { error: "invalid_request", error_description: "code required" }, 400);

    if (String(code).startsWith("oxo_") || String(code).startsWith("oxk_")) {
      return json(res, { access_token: code, token_type: "bearer", expires_in: 86400 * 30 });
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

    return json(res, { access_token: access, token_type: "bearer", expires_in: 86400 * 30 });
  }

  if ((!route || route === "") && req.method === "GET") {
    return json(res, {
      ok: true,
      name: "OrbitX Agent MCP",
      mcp_url: MCP_URL,
      auth: {
        type: "oauth2",
        client_id: "orbitx-mcp",
        client_secret: null,
        client_secret_note: "Leave blank — public PKCE client",
        authorization_endpoint: `${MCP_URL}/oauth/authorize`,
        token_endpoint: `${MCP_URL}/oauth/token`,
        registration_endpoint: `${MCP_URL}/oauth/register`,
        scope: "orbitx",
        token_endpoint_auth_method: "none",
      },
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    });
  }

  if ((!route || route === "") && req.method === "POST") {
    const body = await readBody(req);
    const { id, method, params } = body;

    if (method === "initialize") {
      return json(res, {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "OrbitX Agent MCP", version: "1.0.0" },
        },
      });
    }
    if (method === "notifications/initialized" || method === "ping") {
      return json(res, { jsonrpc: "2.0", id: id ?? null, result: {} });
    }

    if (method === "tools/list" || method === "tools/call") {
      const auth = await resolveAuth(req);
      if (!auth) {
        return json(
          res,
          { jsonrpc: "2.0", id: id ?? null, error: { code: -32001, message: "Authentication required" } },
          401,
          {
            "WWW-Authenticate": `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${PUBLIC_BASE}/.well-known/oauth-protected-resource"`,
          },
        );
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
      const name = String(params?.name || "");
      const args = params?.arguments || {};
      try {
        const result = await callTool(name, args, auth);
        return json(res, {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            structuredContent: result,
          },
        });
      } catch (e) {
        return json(res, {
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: e?.message || "tool error" },
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
