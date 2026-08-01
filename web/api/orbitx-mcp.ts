/**
 * OrbitX Agent MCP — Streamable HTTP JSON-RPC + OAuth for Claude/ChatGPT.
 *
 *  GET  /api/orbitx-mcp                     — server info / OAuth resource metadata
 *  POST /api/orbitx-mcp                     — JSON-RPC (initialize, tools/list, tools/call)
 *  GET  /api/orbitx-mcp/oauth/authorize     — redirect to /agent/mcp-auth
 *  POST /api/orbitx-mcp/oauth/token         — exchange code → access_token
 *  GET  /api/orbitx-mcp/.well-known/...     — OAuth discovery
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  PUBLIC_BASE,
  adminClient,
  errMessage,
  errStatus,
  generateOpaqueToken,
  handleOptions,
  json,
  pathParts,
  resolveMcpAuth,
  sha256,
} from "./orbitx/agent/_lib";

const MCP_URL = `${PUBLIC_BASE}/api/orbitx-mcp`;
const AUTH_PAGE = `${PUBLIC_BASE}/agent/mcp-auth`;

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
      properties: {
        mint: { type: "string", description: "Token mint / contract address" },
        chain: { type: "string", default: "solana" },
      },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_screen_tokens",
    description: "Screen tokens by category (trending, new, runners, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Category: trending|new|runners|fomo|kol|organic|graduating|migrated" },
        interval: { type: "string", default: "1h" },
        limit: { type: "integer", default: 20 },
        chain: { type: "string", default: "solana" },
      },
      required: ["type"],
    },
  },
  {
    name: "orbitx_get_forensics",
    description: "Forensic data for a token: dev wallet, bundles, LP lock, safety flags.",
    inputSchema: {
      type: "object",
      properties: { mint: { type: "string" } },
      required: ["mint"],
    },
  },
  {
    name: "orbitx_get_wallet",
    description: "Wallet portfolio: balances, PnL, win rate.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string" } },
      required: ["address"],
    },
  },
  {
    name: "orbitx_search",
    description: "Search tokens by name, symbol, or mint.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"],
    },
  },
];

function corsMcp(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, Mcp-Session-Id, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, WWW-Authenticate");
}

function unauthorized(res: VercelResponse, message = "Authentication required") {
  corsMcp(res);
  res.setHeader(
    "WWW-Authenticate",
    `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${PUBLIC_BASE}/.well-known/oauth-protected-resource", scope="orbitx"`,
  );
  return res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message },
    id: null,
  });
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  auth: { userId: string; agentId: string; walletAddress: string | null },
): Promise<unknown> {
  if (name === "orbitx_whoami") {
    return {
      userId: auth.userId,
      agentId: auth.agentId,
      walletAddress: auth.walletAddress,
      mcpUrl: MCP_URL,
      status: auth.walletAddress ? "connected" : "wallet_not_linked",
    };
  }

  const base = PUBLIC_BASE;
  const routes: Record<string, string> = {
    orbitx_get_token: `${base}/api/ogdex/token?mint=${encodeURIComponent(String(args.mint || ""))}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_screen_tokens: `${base}/api/ogdex/screener?type=${encodeURIComponent(String(args.type || "trending"))}&interval=${encodeURIComponent(String(args.interval || "1h"))}&limit=${Number(args.limit) || 20}&chain=${encodeURIComponent(String(args.chain || "solana"))}`,
    orbitx_get_forensics: `${base}/api/ogdex/forensics?mint=${encodeURIComponent(String(args.mint || ""))}`,
    orbitx_get_wallet: `${base}/api/ogdex/wallet?address=${encodeURIComponent(String(args.address || ""))}`,
    orbitx_search: `${base}/api/ogdex/search?q=${encodeURIComponent(String(args.q || ""))}`,
  };
  const url = routes[name];
  if (!url) throw new Error(`Unknown tool: ${name}`);
  const r = await fetch(url, { headers: { "User-Agent": "OrbitX-MCP/1.0" } });
  return r.json();
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  corsMcp(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const parts = pathParts(req, "orbitx-mcp");
  const route = parts.join("/");

  try {
    // ---- OAuth discovery (also mirrored under path) ----
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
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256", "plain"],
        token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
      });
    }

    // ---- authorize → OrbitX auth page ----
    if (route === "oauth/authorize" && req.method === "GET") {
      const q = req.query;
      const params = new URLSearchParams();
      for (const key of ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "response_type"]) {
        const v = q[key];
        if (typeof v === "string" && v) params.set(key, v);
      }
      params.set("mcp_url", MCP_URL);
      res.status(302).setHeader("Location", `${AUTH_PAGE}?${params.toString()}`);
      res.end();
      return;
    }

    // ---- token exchange ----
    if (route === "oauth/token" && req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      // also support form-urlencoded
      let code = body.code as string | undefined;
      let redirectUri = body.redirect_uri as string | undefined;
      if (!code && typeof req.body === "string" && req.body.includes("=")) {
        const sp = new URLSearchParams(req.body);
        code = sp.get("code") || undefined;
        redirectUri = sp.get("redirect_uri") || redirectUri;
      }
      if (!code) return json(res, { error: "invalid_request", error_description: "code required" }, 400);

      const db = adminClient();
      const hash = sha256(code);

      // Fallback: code was minted as oxk_/oxo_ api key style
      if (code.startsWith("oxo_") || code.startsWith("oxk_")) {
        return json(res, {
          access_token: code,
          token_type: "bearer",
          expires_in: 86400 * 30,
        });
      }

      const { data: row } = await db
        .from("agent_mcp_oauth_codes")
        .select("*")
        .eq("code_hash", hash)
        .maybeSingle();

      if (!row || row.used_at) {
        return json(res, { error: "invalid_grant" }, 400);
      }
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return json(res, { error: "invalid_grant", error_description: "code expired" }, 400);
      }
      if (redirectUri && row.redirect_uri && redirectUri !== row.redirect_uri) {
        return json(res, { error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
      }

      await db
        .from("agent_mcp_oauth_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);

      const access = generateOpaqueToken("oxo");
      const { error } = await db.from("agent_mcp_oauth_tokens").insert({
        token_hash: sha256(access),
        user_id: row.user_id,
        agent_id: row.agent_id,
        wallet_address: row.wallet_address,
        expires_at: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
      });

      if (error) {
        // Fallback: store as API key so Bearer still works
        await db.from("agent_api_keys").insert({
          agent_id: row.agent_id,
          name: `OAuth token ${new Date().toISOString().slice(0, 16)}`,
          key_hash: sha256(access),
        });
      }

      return json(res, {
        access_token: access,
        token_type: "bearer",
        expires_in: 86400 * 30,
      });
    }

    // ---- GET server info ----
    if ((!route || route === "") && req.method === "GET") {
      return json(res, {
        ok: true,
        name: "OrbitX Agent MCP",
        description: "OrbitX on-chain intel + authenticated agent identity for Claude and ChatGPT.",
        mcp_url: MCP_URL,
        auth: {
          type: "oauth2",
          authorization_endpoint: `${MCP_URL}/oauth/authorize`,
          token_endpoint: `${MCP_URL}/oauth/token`,
          bearer: "Pass Authorization: Bearer <api_key_or_oauth_token>",
        },
        tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
      });
    }

    // ---- POST JSON-RPC ----
    if ((!route || route === "") && req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { id, method, params } = body as {
        id?: unknown;
        method?: string;
        params?: Record<string, unknown>;
      };

      if (method === "initialize") {
        // Allow initialize without auth so clients discover OAuth; tools need auth
        return json(
          res,
          rpcResult(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "OrbitX Agent MCP", version: "1.0.0" },
          }),
        );
      }

      if (method === "notifications/initialized" || method === "ping") {
        return json(res, rpcResult(id ?? null, {}));
      }

      if (method === "tools/list") {
        const auth = await resolveMcpAuth(req);
        if (!auth) return unauthorized(res);
        return json(
          res,
          rpcResult(id, {
            tools: TOOLS.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          }),
        );
      }

      if (method === "tools/call") {
        const auth = await resolveMcpAuth(req);
        if (!auth) return unauthorized(res);
        const name = String(params?.name || "");
        const args = (params?.arguments || {}) as Record<string, unknown>;
        try {
          const result = await callTool(name, args, auth);
          return json(
            res,
            rpcResult(id, {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
              structuredContent: result,
            }),
          );
        } catch (e) {
          return json(res, rpcError(id, -32000, errMessage(e)));
        }
      }

      return json(res, rpcError(id, -32601, `Method not found: ${method}`));
    }

    return json(res, { error: "not_found", route }, 404);
  } catch (e) {
    return json(res, { error: errMessage(e) }, errStatus(e));
  }
}
