/**
 * OrbitX paper desk for Agent MCP.
 * 10,000 mock SOL per agent. Tokens / 1h / 24h / volume are real tape.
 * Fills never broadcast.
 */
import { simulatePaperDesk, PAPER_AGENTS, PAPER_STAKE_SOL } from "../../shared/orbitx-paper-desk.js";
import { scanRunningMemes } from "./mcp-life-scan.js";

export const PAPER_WORLD_URL = "https://www.orbitx.world/on-chain";

const EMPTY = { type: "object", properties: {}, additionalProperties: false };

export const PAPER_TOOL_NAMES = new Set([
  "orbitx_paper_desk",
  "orbitx_paper_agent",
  "orbitx_paper_buying",
]);

export const PAPER_CORE_TOOLS = [
  {
    name: "orbitx_paper_desk",
    description:
      "10k mock-SOL paper desk on /on-chain. Ten agents trade real coin tape every hour (virtual SOL only). When the user says paper desk / mock SOL agents / who is buying — call this.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max agents to return (default 10)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_paper_agent",
    description:
      "One paper agent’s book: equity, win rate, currently buying, thesis, recent hourly fills. Pass id (neon-pulse) or name (NEON PULSE).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Agent id, e.g. neon-pulse" },
        name: { type: "string", description: "Agent name, e.g. NEON PULSE" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "orbitx_paper_buying",
    description:
      "What the 10k mock-SOL agents are buying right now — mint, size, 1h/24h, thesis. Virtual SOL only.",
    inputSchema: EMPTY,
  },
];

export function isPaperTool(name) {
  return PAPER_TOOL_NAMES.has(String(name || ""));
}

export function resolvePaperNaturalTool(rawName, args = {}) {
  const raw = String(rawName || "").trim();
  if (!raw) return null;
  if (/paper desk|paper agent|mock sol|10k (mock )?sol|paper agents/i.test(raw)) {
    if (/buying|currently buy/i.test(raw)) return { name: "orbitx_paper_buying", args };
    const who = raw.match(
      /\b(neon[-\s]?pulse|warden[-\s]?fade|oracle[-\s]?core|atlas[-\s]?liq|raid[-\s]?fresh|pulse[-\s]?kol|forge[-\s]?break|circuit[-\s]?dip|scribe[-\s]?flow|aegis[-\s]?majors)\b/i,
    );
    if (who || /^paper agent\b/i.test(raw)) {
      return { name: "orbitx_paper_agent", args: { ...args, name: args.name || who?.[1] } };
    }
    return { name: "orbitx_paper_desk", args };
  }
  if (/who(?:'s| is) (currently )?buying/i.test(raw)) return { name: "orbitx_paper_buying", args };
  return null;
}

function asPaperToken(c) {
  if (!c?.mint) return null;
  return {
    mint: c.mint,
    symbol: c.symbol,
    name: c.name,
    image: c.image || null,
    change_1h: c.change_1h ?? c.change1h ?? null,
    change_24h: c.change_24h ?? c.change24h ?? null,
    volume_24h: c.volume_24h ?? c.volume24h ?? null,
    liquidity_usd: c.liquidity_usd ?? c.liquidityUsd ?? null,
    market_cap: c.market_cap ?? c.mcap ?? null,
    price_usd: c.price_usd ?? c.priceUsd ?? null,
  };
}

async function loadCatalog(ctx = {}) {
  const { base, fetchJson } = ctx;
  if (typeof fetchJson === "function" && base) {
    try {
      const trending = await fetchJson(`${base}/api/on-chain/trending`);
      const tokens = [trending?.orbitx, ...(trending?.tokens || [])].map(asPaperToken).filter(Boolean);
      if (tokens.length >= 3) return tokens;
    } catch {
      /* fall through to DexScreener tape */
    }
  }
  const scan = await scanRunningMemes({ sources: ["dexscreener", "geckoterminal"] });
  return (scan.tape || scan.picks || []).map(asPaperToken).filter(Boolean);
}

function slimFill(f) {
  if (!f) return null;
  return {
    hour: f.hour,
    at: f.at,
    mint: f.mint,
    symbol: f.symbol,
    side: f.side,
    sol: Number(Number(f.sol).toFixed(2)),
    pnl_sol: Number(Number(f.pnl_sol).toFixed(3)),
    move_pct: Number(Number(f.move_pct).toFixed(2)),
    thesis: f.thesis,
    current: Boolean(f.current),
    change_1h: f.change_1h ?? null,
    change_24h: f.change_24h ?? null,
    volume_24h: f.volume_24h ?? null,
    image: f.image || null,
  };
}

function slimAgent(a, { fills = false } = {}) {
  return {
    id: a.id,
    name: a.name,
    style: a.style,
    color: a.color,
    blurb: a.blurb,
    mock: true,
    stake_sol: a.stake_sol,
    equity_sol: Number(Number(a.equity_sol).toFixed(2)),
    pnl_sol: Number(Number(a.pnl_sol).toFixed(2)),
    pnl_pct: Number(Number(a.pnl_pct).toFixed(2)),
    wins: a.wins,
    losses: a.losses,
    trades: a.trades,
    win_pct: Number(Number(a.win_pct).toFixed(1)),
    live: slimFill(a.live),
    ...(fills ? { fills: (a.fills || []).slice(0, 8).map(slimFill) } : {}),
  };
}

export async function runPaperDesk(ctx = {}) {
  const tokens = Array.isArray(ctx.tokens) && ctx.tokens.length ? ctx.tokens.map(asPaperToken).filter(Boolean) : await loadCatalog(ctx);
  const desk = simulatePaperDesk(tokens, { kols: ctx.kols || [], now: ctx.now });
  return {
    ok: true,
    mock: true,
    unit: "mock SOL",
    stake_sol: PAPER_STAKE_SOL,
    agent_count: desk.agent_count,
    desk_equity_sol: Number(Number(desk.desk_equity_sol).toFixed(2)),
    desk_pnl_sol: Number(Number(desk.desk_pnl_sol).toFixed(2)),
    hour_bucket: desk.hour_bucket,
    next_hour_at: desk.next_hour_at,
    generated_at: desk.generated_at,
    worldUrl: PAPER_WORLD_URL,
    catalog: tokens.length,
    agents: desk.agents,
  };
}

function findAgent(desk, args = {}) {
  const id = String(args.id || args.agent || "").trim().toLowerCase();
  const name = String(args.name || "").trim().toLowerCase();
  return (
    desk.agents.find((a) => a.id === id) ||
    desk.agents.find((a) => a.name.toLowerCase() === name) ||
    desk.agents.find((a) => a.id.includes(id) && id) ||
    desk.agents.find((a) => a.name.toLowerCase().includes(name) && name) ||
    null
  );
}

export async function dispatchPaperTool(name, args = {}, ctx = {}) {
  if (!isPaperTool(name)) return null;
  const desk = await runPaperDesk(ctx);
  const limit = Math.min(10, Math.max(1, Number(args.limit) || 10));

  if (name === "orbitx_paper_agent") {
    const agent = findAgent(desk, args);
    if (!agent) {
      return {
        ok: false,
        error: "agent_not_found",
        message: "Pass id like neon-pulse or name like NEON PULSE.",
        ids: PAPER_AGENTS.map((a) => a.id),
        worldUrl: PAPER_WORLD_URL,
      };
    }
    return {
      ok: true,
      mock: true,
      unit: "mock SOL",
      worldUrl: PAPER_WORLD_URL,
      agent: slimAgent(agent, { fills: true }),
    };
  }

  if (name === "orbitx_paper_buying") {
    const buying = desk.agents
      .filter((a) => a.live?.mint)
      .map((a) => ({
        agent_id: a.id,
        agent: a.name,
        style: a.style,
        ...slimFill(a.live),
      }));
    return {
      ok: true,
      mock: true,
      unit: "mock SOL",
      worldUrl: PAPER_WORLD_URL,
      next_hour_at: desk.next_hour_at,
      count: buying.length,
      buying,
    };
  }

  return {
    ok: true,
    mock: true,
    unit: "mock SOL",
    stake_sol: desk.stake_sol,
    desk_equity_sol: desk.desk_equity_sol,
    desk_pnl_sol: desk.desk_pnl_sol,
    agent_count: desk.agent_count,
    next_hour_at: desk.next_hour_at,
    generated_at: desk.generated_at,
    worldUrl: PAPER_WORLD_URL,
    catalog: desk.catalog,
    agents: desk.agents.slice(0, limit).map((a) => slimAgent(a)),
  };
}
