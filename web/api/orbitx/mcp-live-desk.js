/**
 * Read-only MCP tools for the real-SOL live desk.
 * Never execute a swap from MCP — ticks are cron/admin only.
 */
import { LIVE_AGENTS, LIVE_TRADE_USD, LIVE_WALLET_PUBKEY, emptyLiveDesk } from "../../shared/orbitx-live-desk.js";

export const LIVE_WORLD_URL = "https://www.orbitx.world/on-chain";
const EMPTY = { type: "object", properties: {}, additionalProperties: false };

export const LIVE_TOOL_NAMES = new Set(["orbitx_live_desk", "orbitx_live_positions", "orbitx_live_agent"]);

export const LIVE_CORE_TOOLS = [
  {
    name: "orbitx_live_desk",
    description:
      "Real-SOL live agent desk on /on-chain. Three books share one hot wallet, $2 buys, full take-profit at 10–30%. READ ONLY — does not trade. When the user says live desk / real agents / funded wallet — call this.",
    inputSchema: EMPTY,
  },
  {
    name: "orbitx_live_positions",
    description:
      "Open real-SOL live-agent positions: mint, $2 size, mark, P&L %, thesis, take-profit target. Read only.",
    inputSchema: EMPTY,
  },
  {
    name: "orbitx_live_agent",
    description:
      "One live agent book (neon-live, warden-live, raid-live): style, TP%, open position, last fill. Read only.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "neon-live | warden-live | raid-live" },
        name: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

export function isLiveTool(name) {
  return LIVE_TOOL_NAMES.has(String(name || ""));
}

export function resolveLiveNaturalTool(rawName, args = {}) {
  const raw = String(rawName || "").trim();
  if (!raw) return null;
  if (/live desk|live agent|real sol agent|funded wallet|\$2 trade/i.test(raw)) {
    if (/position|open book/i.test(raw)) return { name: "orbitx_live_positions", args };
    const who = raw.match(/\b(neon[-\s]?live|warden[-\s]?live|raid[-\s]?live)\b/i);
    if (who) return { name: "orbitx_live_agent", args: { ...args, name: args.name || who[1] } };
    return { name: "orbitx_live_desk", args };
  }
  return null;
}

async function loadSnap(ctx = {}) {
  const { base, fetchJson } = ctx;
  if (typeof fetchJson === "function" && base) {
    try {
      const snap = await fetchJson(`${base}/api/live-agents`);
      if (snap?.ok || snap?.wallet) return snap;
    } catch {
      /* fall through */
    }
  }
  return emptyLiveDesk({ wallet: LIVE_WALLET_PUBKEY, enabled: false, armed: false, configured: false });
}

export async function dispatchLiveTool(name, args = {}, ctx = {}) {
  if (!isLiveTool(name)) return null;
  const desk = await loadSnap(ctx);
  desk.worldUrl = LIVE_WORLD_URL;
  desk.trade_usd = desk.trade_usd || LIVE_TRADE_USD;
  desk.agents = desk.agents?.length ? desk.agents : LIVE_AGENTS;
  if (name === "orbitx_live_positions") {
    return {
      ok: true,
      wallet: desk.wallet,
      open: desk.open || [],
      worldUrl: LIVE_WORLD_URL,
      disclaimer: desk.disclaimer,
    };
  }
  if (name === "orbitx_live_agent") {
    const needle = String(args.id || args.name || "").trim().toLowerCase().replace(/\s+/g, "-");
    const agent =
      (desk.agents || []).find((a) => a.id === needle || String(a.name || "").toLowerCase() === String(args.name || "").toLowerCase()) ||
      LIVE_AGENTS.find((a) => a.id === needle);
    if (!agent) return { ok: false, error: "unknown_live_agent" };
    return {
      ok: true,
      agent,
      open: (desk.open || []).find((p) => p.agent_id === agent.id) || null,
      wallet: desk.wallet,
      worldUrl: LIVE_WORLD_URL,
      disclaimer: desk.disclaimer,
    };
  }
  return desk;
}
