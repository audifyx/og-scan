/**
 * OrbitX API router — keeps Hobby plan ≤12 serverless functions.
 *
 * Mounted via vercel rewrite:
 *   /api/orbitx/(.*) → /api/orbitx?path=$1
 *
 * Routes:
 *   GET  /api/orbitx/crypto-scan?mint=...
 *   POST /api/orbitx/anti-vamp-check
 *   *    /api/orbitx/agent/*     — agent bootstrap, keys, wallet, oauth approve
 *   *    /api/orbitx/mcp/*       — MCP JSON-RPC + OAuth for Claude/ChatGPT
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import antiVamp from "./orbitx/_anti-vamp-check";
import cryptoScan from "./orbitx/_crypto-scan";
import agentHandler from "./orbitx/_agent";
import mcpHandler from "./orbitx/_mcp";

function pathParts(req: VercelRequest): string[] {
  const q = req.query.path;
  if (typeof q === "string" && q.length) return q.split("/").filter(Boolean);
  if (Array.isArray(q)) return q.join("/").split("/").filter(Boolean);
  const url = req.url || "";
  const after = url.split("/api/orbitx")[1] || url.split("/orbitx")[1] || "";
  return after.replace(/^\//, "").split("?")[0]!.split("/").filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parts = pathParts(req);
  const head = parts[0] || "";

  // Agent + MCP sub-routers (path rewritten to remaining segments)
  if (head === "agent") {
    req.query.path = parts.slice(1).join("/");
    return agentHandler(req, res);
  }
  if (head === "mcp") {
    req.query.path = parts.slice(1).join("/");
    return mcpHandler(req, res);
  }

  if (head === "crypto-scan") return cryptoScan(req, res);
  if (head === "anti-vamp-check") return antiVamp(req, res);

  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET" && !head) {
    return res.status(200).json({
      ok: true,
      service: "orbitx",
      routes: ["crypto-scan", "anti-vamp-check", "agent/*", "mcp/*"],
    });
  }

  return res.status(404).json({
    ok: false,
    error: "unknown_orbitx_route",
    routes: ["crypto-scan", "anti-vamp-check", "agent/*", "mcp/*"],
  });
}
