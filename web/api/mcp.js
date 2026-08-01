/**
 * Claude-compatible MCP entrypoint at /api/mcp (path ends with /mcp).
 * Delegates to orbitx-hub agent MCP (Node req/res). Also keeps legacy
 * { tool, params } OG DEX execute for older clients.
 */
import hub from "./orbitx-hub.js";

const BASE = "https://orbitx.world";

const LEGACY_TOOLS = [
  {
    name: "ogdex_get_token",
    description: "Get full token data for a Solana (or EVM) token.",
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
    name: "ogdex_screen_tokens",
    description: "Screen tokens by category.",
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
    name: "ogdex_search",
    description: "Search tokens by name, symbol, or mint.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"],
    },
  },
];

const LEGACY_ROUTES = {
  ogdex_get_token: (p) =>
    `${BASE}/api/ogdex/token?mint=${encodeURIComponent(p.mint)}&chain=${encodeURIComponent(p.chain || "solana")}`,
  ogdex_screen_tokens: (p) =>
    `${BASE}/api/ogdex/screener?type=${encodeURIComponent(p.type)}&interval=${encodeURIComponent(p.interval || "1h")}&limit=${Number(p.limit) || 20}&chain=${encodeURIComponent(p.chain || "solana")}`,
  ogdex_search: (p) => `${BASE}/api/ogdex/search?q=${encodeURIComponent(p.q)}`,
};

function forceMcpPath(req) {
  try {
    const u = new URL(req.url || "/", "http://x");
    const existing = u.searchParams.get("path");
    if (!existing) u.searchParams.set("path", "mcp");
    else if (!String(existing).startsWith("mcp")) u.searchParams.set("path", `mcp/${existing}`);
    // Preserve oauth subpaths from /api/mcp/oauth/...
    const parts = u.pathname.split("/").filter(Boolean);
    const mcpIdx = parts.lastIndexOf("mcp");
    if (mcpIdx >= 0 && parts[mcpIdx + 1] && !existing) {
      const rest = parts.slice(mcpIdx + 1).join("/");
      if (rest) u.searchParams.set("path", `mcp/${rest}`);
    }
    req.url = `${u.pathname}?${u.searchParams.toString()}`;
  } catch {
    /* ignore */
  }
}

export default async function handler(req, res) {
  // Legacy OG DEX execute: POST { tool, params } without jsonrpc
  if (req.method === "POST") {
    let peek = req.body;
    if (peek == null) {
      try {
        const chunks = [];
        for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
        const raw = Buffer.concat(chunks).toString("utf8");
        peek = raw ? JSON.parse(raw) : {};
        req.body = peek;
      } catch {
        peek = {};
        req.body = {};
      }
    }

    if (peek && typeof peek === "object" && !peek.jsonrpc && peek.tool) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/json");
      const builder = LEGACY_ROUTES[peek.tool];
      if (!builder) {
        res.statusCode = 400;
        return res.end(
          JSON.stringify({
            ok: false,
            error: `Unknown legacy tool. Use JSON-RPC MCP at this URL, or tools: ${LEGACY_TOOLS.map((t) => t.name).join(", ")}`,
          }),
        );
      }
      try {
        const r = await fetch(builder(peek.params || {}), { headers: { "User-Agent": "OrbitX-MCP/1.0" } });
        const data = await r.json();
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, tool: peek.tool, result: data }));
      } catch (e) {
        res.statusCode = 502;
        return res.end(JSON.stringify({ ok: false, tool: peek.tool, error: String(e) }));
      }
    }
  }

  forceMcpPath(req);
  return hub(req, res);
}
