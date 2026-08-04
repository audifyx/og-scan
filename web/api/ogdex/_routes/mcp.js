import { send, readBody } from "../_lib.js";
import {
  TOOLS,
  mcpManifest,
  mcpAuthRequired,
  mcpAuthorized,
  isMcpEnabled,
  executeMcpTool,
  mcpBaseUrl,
} from "../_mcp.js";

// MCP (Model Context Protocol) tool manifest + execution.
// GET  /api/ogdex/mcp  → discover tools
// POST /api/ogdex/mcp  → { tool, params } execute (auth when ORBITX_DEX_API_KEYS set)

export default async function mcpRoute(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-ogdex-key");
    res.end();
    return;
  }

  const enabled = await isMcpEnabled();
  if (!enabled) return send(res, 503, { ok: false, error: "MCP API is disabled by admin" });

  const base = mcpBaseUrl(req);

  if (req.method === "GET") {
    return send(
      res,
      200,
      mcpManifest(req, {
        manifest: `${base}/api/ogdex/mcp`,
        execute: `${base}/api/ogdex/mcp`,
        alt: `${base}/api/mcp`,
      })
    );
  }

  if (req.method === "POST") {
    if (mcpAuthRequired() && !mcpAuthorized(req)) {
      return send(res, 401, {
        ok: false,
        error: "Unauthorized — send Authorization: Bearer <key> or x-ogdex-key header",
        auth_required: true,
      });
    }

    const body = await readBody(req);
    const { tool, params = {} } = body || {};
    if (!tool) return send(res, 400, { ok: false, error: "Missing 'tool' field" });

    const out = await executeMcpTool(req, tool, params);
    return send(res, out.status, out.body);
  }

  return send(res, 405, { ok: false, error: "Method not allowed", tools: TOOLS.map((t) => t.name) });
}
