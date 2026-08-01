/**
 * Claude-compatible MCP entrypoint at /api/mcp (path ends with /mcp).
 * Delegates to orbitx-hub (lazy import so this function always boots).
 *
 * Image wait/poll can take 30-90s. Must exceed the vercel.json wildcard
 * api JS maxDuration of 30s, or quality-mode wait=true returns opaque
 * 504 FUNCTION_INVOCATION_TIMEOUT.
 */
export const config = { maxDuration: 120 };

const BASE = "https://orbitx.world";

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

function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id");
      res.statusCode = 204;
      return res.end();
    }

    // Legacy OG DEX: POST { tool, params } (no jsonrpc)
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
      } else if (typeof peek === "string") {
        try {
          peek = JSON.parse(peek);
          req.body = peek;
        } catch {
          peek = {};
        }
      }

      if (peek && typeof peek === "object" && !peek.jsonrpc && peek.tool) {
        const builder = LEGACY_ROUTES[peek.tool];
        if (!builder) {
          return sendJson(res, { ok: false, error: `Unknown legacy tool: ${peek.tool}` }, 400);
        }
        try {
          const r = await fetch(builder(peek.params || {}), { headers: { "User-Agent": "OrbitX-MCP/1.0" } });
          const data = await r.json();
          return sendJson(res, { ok: true, tool: peek.tool, result: data });
        } catch (e) {
          return sendJson(res, { ok: false, tool: peek.tool, error: String(e?.message || e) }, 502);
        }
      }
    }

    forceMcpPath(req);
    const { default: hub } = await import("./orbitx-hub.js");
    return await hub(req, res);
  } catch (e) {
    console.error("[api/mcp]", e);
    return sendJson(
      res,
      {
        ok: false,
        error: "mcp_handler_failed",
        message: String(e?.message || e),
      },
      500,
    );
  }
}
