/**
 * Public agent-calls board.
 * GET /api/agent-calls  — live desk tape + call ledger, no admin, no secrets.
 */
import { snapshotLiveDesk } from "./orbitx/live-agent-engine.js";
import { snapshotCallsDesk } from "./orbitx/calls-engine.js";
import { publicAgentCallsBoard } from "../shared/orbitx-calls-desk.js";

export const config = { maxDuration: 30 };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    return res.end();
  }
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "GET" });
  try {
    const [live, calls] = await Promise.all([
      snapshotLiveDesk({ skipChain: true }).catch(() => ({})),
      snapshotCallsDesk({ readonly: true }).catch(() => ({})),
    ]);
    return json(res, 200, publicAgentCallsBoard(live, calls));
  } catch (e) {
    return json(res, 500, { ok: false, error: e.message || String(e) });
  }
}
