/**
 * OrbitX MCP server (plain JS — matches working mcp.js runtime).
 * GET  /api/orbitx-mcp — info
 * POST /api/orbitx-mcp — JSON-RPC
 * GET  /api/orbitx-mcp/oauth/authorize
 * POST /api/orbitx-mcp/oauth/token
 */
import { createHash, randomBytes } from "node:crypto";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PUBLIC_BASE = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://ogscan.fun";
const MCP_URL = `${PUBLIC_BASE}/api/orbitx-mcp`;
const AUTH_PAGE = `${PUBLIC_BASE}/agent/mcp-auth`;

const headersBase = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Cache-Control": "no-store",
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headersBase, ...extra },
  });
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function opaque(prefix) {
  return `${prefix}_${randomBytes(32).toString("hex")}`;
}

function pathOf(req) {
  try {
    const u = new URL(req.url);
    const p = u.searchParams.get("path");
    if (p) return p.split("/").filter(Boolean);
  } catch {
    /* ignore */
  }
  const raw = String(req.url || "");
  const after = raw.split("orbitx-mcp")[1] || "";
  return after.replace(/^\//, "").split("?")[0].split("/").filter(Boolean);
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
    const err = new Error(data?.message || data?.error || text || r.statusText);
    err.status = r.status;
    throw err;
  }
  return data;
}

async function resolveAuth(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
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

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersBase });

  const parts = pathOf(req);
  const route = parts.join("/");

  try {
    if (
      (route === ".well-known/oauth-protected-resource" || route === "oauth-protected-resource") &&
      req.method === "GET"
    ) {
      return json({
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
      return json({
        issuer: PUBLIC_BASE,
        authorization_endpoint: `${MCP_URL}/oauth/authorize`,
        token_endpoint: `${MCP_URL}/oauth/token`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256", "plain"],
        token_endpoint_auth_methods_supported: ["none"],
      });
    }

    if (route === "oauth/authorize" && req.method === "GET") {
      const u = new URL(req.url);
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
      return new Response(null, {
        status: 302,
        headers: { ...headersBase, Location: `${AUTH_PAGE}?${params.toString()}` },
      });
    }

    if (route === "oauth/token" && req.method === "POST") {
      let body = {};
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) body = await req.json().catch(() => ({}));
      else {
        const text = await req.text();
        body = Object.fromEntries(new URLSearchParams(text));
      }
      const code = body.code;
      if (!code) return json({ error: "invalid_request", error_description: "code required" }, 400);

      if (String(code).startsWith("oxo_") || String(code).startsWith("oxk_")) {
        return json({ access_token: code, token_type: "bearer", expires_in: 86400 * 30 });
      }

      const hash = sha256(String(code));
      let row = null;
      try {
        const rows = await sb(
          `agent_mcp_oauth_codes?code_hash=eq.${encodeURIComponent(hash)}&select=*`,
        );
        row = Array.isArray(rows) ? rows[0] : null;
      } catch {
        return json({ error: "invalid_grant" }, 400);
      }
      if (!row || row.used_at) return json({ error: "invalid_grant" }, 400);
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return json({ error: "invalid_grant", error_description: "code expired" }, 400);
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

      return json({ access_token: access, token_type: "bearer", expires_in: 86400 * 30 });
    }

    if ((!route || route === "") && req.method === "GET") {
      return json({
        ok: true,
        name: "OrbitX Agent MCP",
        mcp_url: MCP_URL,
        auth: {
          type: "oauth2",
          authorization_endpoint: `${MCP_URL}/oauth/authorize`,
          token_endpoint: `${MCP_URL}/oauth/token`,
        },
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
      });
    }

    if ((!route || route === "") && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { id, method, params } = body;

      if (method === "initialize") {
        return json({
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
        return json({ jsonrpc: "2.0", id: id ?? null, result: {} });
      }

      if (method === "tools/list" || method === "tools/call") {
        const auth = await resolveAuth(req);
        if (!auth) {
          return json(
            { jsonrpc: "2.0", id: id ?? null, error: { code: -32001, message: "Authentication required" } },
            401,
            {
              "WWW-Authenticate": `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${PUBLIC_BASE}/.well-known/oauth-protected-resource"`,
            },
          );
        }
        if (method === "tools/list") {
          return json({
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
          return json({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
              structuredContent: result,
            },
          });
        } catch (e) {
          return json({
            jsonrpc: "2.0",
            id,
            error: { code: -32000, message: e?.message || "tool error" },
          });
        }
      }

      return json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
    }

    return json({ error: "not_found", route }, 404);
  } catch (e) {
    return json({ error: e?.message || "Internal error" }, 500);
  }
}
