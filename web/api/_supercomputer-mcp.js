import hub from "./orbitx-hub.js";
import xMcp from "./x-mcp.js";
import { buildGeneratedTools } from "./orbitx/mcp-tools-catalog.js";
import { buildXGeneratedTools } from "./orbitx/x-mcp-tools-catalog.js";

export const config = { maxDuration: 120 };

const MAX_TOOLS_PER_PAGE = 3000;

function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function bodyOf(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (!req || typeof req[Symbol.asyncIterator] !== "function") return {};
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function isXTool(name = "") {
  return name.startsWith("x_") || name.startsWith("x_act_") || name.startsWith("x_tools_") || [
    "x_menu",
    "x_post",
    "x_reply",
    "x_quote",
    "x_dm",
    "x_buy",
    "x_analytics",
  ].includes(name);
}

function uniqueTools(tools) {
  const seen = new Set();
  return tools.filter((tool) => tool?.name && !seen.has(tool.name) && seen.add(tool.name));
}

function unifiedTools() {
  const extras = [
    {
      name: "search",
      description: "Search OrbitX Supercomputer capabilities, markets, agents, and channels.",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
    {
      name: "fetch",
      description: "Fetch a result or tool description by id.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    },
    {
      name: "orbitx_tools_help",
      description: "Browse the complete OrbitX Agent and OG DEX tool catalog.",
      inputSchema: { type: "object", properties: { q: { type: "string" }, limit: { type: "integer" } } },
    },
    {
      name: "x_tools_help",
      description: "Browse the complete X activity and social tool catalog.",
      inputSchema: { type: "object", properties: { q: { type: "string" }, limit: { type: "integer" } } },
    },
    {
      name: "supercomputer_status",
      description: "Unified OrbitX Supercomputer health, routing, and subsystem status.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "supercomputer_tools",
      description: "Browse the merged Agent MCP, OG DEX MCP, and X MCP tool catalog.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer" } } },
    },
  ];
  return uniqueTools([...extras, ...buildGeneratedTools(), ...buildXGeneratedTools()]);
}

async function delegate(target, req, res, url) {
  const previousUrl = req.url;
  req.url = url;
  try {
    return await target(req, res);
  } finally {
    req.url = previousUrl;
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, {}, 204);

  const body = await bodyOf(req);
  if (body && typeof body === "object" && !req.body) req.body = body;
  const method = body?.method || "";

  if (method === "tools/list") {
    const all = unifiedTools();
    const cursor = Number.isFinite(Number(body.params?.cursor)) ? Math.max(0, Number(body.params.cursor)) : 0;
    const page = all.slice(cursor, cursor + MAX_TOOLS_PER_PAGE);
    const nextCursor = cursor + MAX_TOOLS_PER_PAGE < all.length ? String(cursor + MAX_TOOLS_PER_PAGE) : undefined;
    return json(res, {
      jsonrpc: "2.0",
      id: body.id ?? null,
      result: {
        tools: page,
        ...(nextCursor ? { nextCursor } : {}),
        _meta: {
          unified: true,
          totalAvailable: all.length,
          pageSize: MAX_TOOLS_PER_PAGE,
          sourceMcps: ["agent", "ogdex", "x"],
          note: "All listed generated tools are callable through this unified endpoint.",
        },
      },
    });
  }

  if (method === "tools/call") {
    const name = String(body.params?.name || "");
    if (name === "supercomputer_status") {
      return json(res, {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: {
          content: [{
            type: "text",
            text: JSON.stringify({
              ok: true,
              endpoint: "https://www.orbitx.world/api/supercomputer-mcp",
              unified: true,
              sources: ["agent", "ogdex", "x"],
              toolCount: unifiedTools().length,
              signing: "wallet approval / delegated signer",
            }),
          }],
        },
      });
    }
    if (name === "supercomputer_tools") {
      const tools = unifiedTools();
      return json(res, {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: {
          content: [{
            type: "text",
            text: JSON.stringify({
              ok: true,
              total: tools.length,
              agent: buildGeneratedTools().length,
              x: buildXGeneratedTools().length,
              tools: tools.map((tool) => tool.name),
            }),
          }],
        },
      });
    }
    return isXTool(name)
      ? delegate(xMcp, req, res, "/api/x/mcp")
      : delegate(hub, req, res, "/api/mcp");
  }

  return delegate(hub, req, res, "/api/mcp");
}
