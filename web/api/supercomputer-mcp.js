import hub from "./orbitx-hub.js";
import xMcp from "./x-mcp.js";
import { buildGeneratedTools } from "./orbitx/mcp-tools-catalog.js";
import { buildXGeneratedTools } from "./orbitx/x-mcp-tools-catalog.js";

export const config = { maxDuration: 120 };

function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return {};
}

function isXTool(name = "") {
  return name.startsWith("x_") || name.startsWith("x_act_") || name.startsWith("x_tools_") || ["x_menu", "x_post", "x_reply", "x_quote", "x_dm", "x_buy", "x_analytics"].includes(name);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, {}, 204);
  const body = bodyOf(req);
  const method = body.method || "";
  if (method === "tools/list") {
    const extras = [
      { name: "search", description: "Search OrbitX Supercomputer capabilities, markets, agents, and channels.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
      { name: "fetch", description: "Fetch a result or tool description by id.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
      { name: "orbitx_tools_help", description: "Browse the complete OrbitX Agent and OG DEX tool catalog.", inputSchema: { type: "object", properties: { q: { type: "string" }, limit: { type: "integer" } } } },
      { name: "x_tools_help", description: "Browse the complete X activity and social tool catalog.", inputSchema: { type: "object", properties: { q: { type: "string" }, limit: { type: "integer" } } } },
      { name: "supercomputer_status", description: "Unified OrbitX Supercomputer health, routing, and subsystem status.", inputSchema: { type: "object", properties: {} } },
      { name: "supercomputer_tools", description: "Browse the merged Agent MCP, OG DEX MCP, and X MCP tool catalog.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer" } } } },
      ...buildGeneratedTools().slice(0, 24),
      ...buildXGeneratedTools().slice(0, 24),
    ];
    const seen = new Set();
    return json(res, { jsonrpc: "2.0", id: body.id ?? null, result: { tools: extras.filter((tool) => !seen.has(tool.name) && seen.add(tool.name)), _meta: { unified: true, sourceMcps: ["agent", "ogdex", "x"], note: "Use supercomputer_tools for the complete merged catalog." } } });
  }
  if (method === "tools/call") {
    const name = String(body.params?.name || "");
    if (name === "supercomputer_status") return json(res, { jsonrpc: "2.0", id: body.id ?? null, result: { content: [{ type: "text", text: JSON.stringify({ ok: true, endpoint: "https://www.orbitx.world/api/supercomputer-mcp", unified: true, sources: ["agent", "ogdex", "x"], signing: "wallet approval / delegated signer" }) }] } });
    if (name === "supercomputer_tools") return json(res, { jsonrpc: "2.0", id: body.id ?? null, result: { content: [{ type: "text", text: JSON.stringify({ ok: true, agent: buildGeneratedTools().map((tool) => tool.name), x: buildXGeneratedTools().map((tool) => tool.name), note: "All generated names are callable through the unified endpoint." }) }] } });
    const target = isXTool(name) ? xMcp : hub;
    return target(req, res);
  }
  return hub(req, res);
}
