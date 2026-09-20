/**
 * MCP-only hunter agent — isolated desk, thesis loop, dry by default.
 * Live swaps stay OFF until HUNTER_LIVE=1 and the desk is armed.
 */
import { createClient } from "@supabase/supabase-js";

export const HUNTER_ID = "alpha";
export const HUNTER_NAME = "ALPHA";
export const HUNTER_SEED_USD = 4;
export const HUNTER_CLIP_USD = 1.5;
export const HUNTER_MAX_OPEN = 1;
export const HUNTER_HALT_USD = 2;
export const HUNTER_DASHBOARD = "https://www.orbitx.world/orbitxagents/hunter";

const DEX = "https://api.dexscreener.com/latest/dex";

function trim(v) {
  return String(v || "").trim();
}
function num(v, f = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : f;
}
function truthy(v) {
  const s = trim(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function sbClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL ||
    "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function emptyDesk() {
  return {
    id: HUNTER_ID,
    name: HUNTER_NAME,
    home: "mcp",
    dashboard: HUNTER_DASHBOARD,
    wallet: trim(process.env.HUNTER_WALLET_PUBKEY || "EqynMF4Ntjfb5An47qvyYfb2zE897xbNqvPUvpUkECxd"),
    walletReady: Boolean(trim(process.env.HUNTER_SECRET_KEY)),
    seedUsd: HUNTER_SEED_USD,
    clipUsd: HUNTER_CLIP_USD,
    maxOpen: HUNTER_MAX_OPEN,
    haltUsd: HUNTER_HALT_USD,
    live: false,
    armed: false,
    paused: false,
    dryRun: true,
    equityUsd: HUNTER_SEED_USD,
    realizedPnlUsd: 0,
    wins: 0,
    losses: 0,
    open: null,
    lastThesis: null,
    lastTickAt: null,
    lastError: null,
    note: trim(process.env.HUNTER_SECRET_KEY)
      ? "Wallet bound from Vercel env. Loop is dry until HUNTER_LIVE=1 and arm."
      : "Add HUNTER_SECRET_KEY on Vercel to bind the isolated wallet.",
  };
}

let MEM = { desk: emptyDesk(), feed: [] };

function liveAllowed() {
  return truthy(process.env.HUNTER_LIVE);
}

async function loadDesk(sb) {
  if (!sb) return MEM.desk;
  const { data, error } = await sb.from("ox_live_desk").select("*").eq("id", "hunter-alpha").maybeSingle();
  if (error || !data) return MEM.desk;
  MEM.desk = {
    ...emptyDesk(),
    ...((data.meta && typeof data.meta === "object") ? data.meta : {}),
    lastTickAt: data.last_tick_at || MEM.desk.lastTickAt,
    lastError: data.last_error || null,
    armed: Boolean(data.armed),
    paused: Boolean(data.paused),
  };
  return MEM.desk;
}

async function saveDesk(sb, desk) {
  MEM.desk = desk;
  if (!sb) return;
  await sb.from("ox_live_desk").upsert({
    id: "hunter-alpha",
    armed: desk.armed,
    paused: desk.paused,
    last_tick_at: desk.lastTickAt,
    last_error: desk.lastError,
    meta: desk,
  }).catch(() => {});
}

async function loadFeed(sb, limit = 40) {
  if (!sb) return MEM.feed.slice(0, limit);
  const { data } = await sb
    .from("ox_live_events")
    .select("*")
    .eq("paper", true)
    .contains("payload", { hunter: HUNTER_ID })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (Array.isArray(data) && data.length) {
    MEM.feed = data.map((r) => r.payload || r);
    return MEM.feed;
  }
  return MEM.feed.slice(0, limit);
}

async function pushEvent(sb, payload) {
  MEM.feed.unshift(payload);
  MEM.feed = MEM.feed.slice(0, 80);
  if (!sb) return;
  await sb
    .from("ox_live_events")
    .insert({
      paper: true,
      created_at: new Date().toISOString(),
      kind: payload.kind || "thesis",
      payload: { hunter: HUNTER_ID, ...payload },
    })
    .catch(() => {});
}

async function fetchTape() {
  const r = await fetch(`${DEX}/tokens/v1/solana`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
  // DexScreener token profiles can 404 — fall back to search
  const s = await fetch(`${DEX}/search?q=solana`, { signal: AbortSignal.timeout(7000) }).catch(() => null);
  const j = s && s.ok ? await s.json().catch(() => ({})) : {};
  const pairs = Array.isArray(j.pairs) ? j.pairs : [];
  return pairs
    .filter((p) => String(p.chainId || "").toLowerCase() === "solana")
    .slice(0, 12)
    .map((p) => ({
      mint: p.baseToken?.address || "",
      symbol: p.baseToken?.symbol || "?",
      name: p.baseToken?.name || "",
      priceUsd: num(p.priceUsd),
      mcap: num(p.marketCap || p.fdv),
      volume24h: num(p.volume?.h24),
      change1h: num(p.priceChange?.h1),
      change24h: num(p.priceChange?.h24),
      liquidity: num(p.liquidity?.usd),
      url: p.url || "",
    }))
    .filter((t) => t.mint);
}

function ruleThesis(token, desk) {
  const liq = token.liquidity;
  const ch = token.change1h;
  const vol = token.volume24h;
  let action = "skip";
  let reason = "no edge";
  if (liq < 4000) {
    action = "skip";
    reason = "book too thin";
  } else if (ch <= -18) {
    action = "skip";
    reason = "1h dump — do not catch knives";
  } else if (ch >= 80 && vol > 20000 && liq > 8000) {
    action = desk.open ? "hold" : "buy";
    reason = "1h expansion with real volume";
  } else if (ch >= 12 && vol > 8000 && liq > 6000) {
    action = desk.open ? "hold" : "watch";
    reason = "tape is loud but wait for a dip";
  } else {
    action = "skip";
    reason = "not our setup";
  }
  if (desk.open && desk.open.mint === token.mint) {
    if (ch <= -12) {
      action = "sell";
      reason = "open book rolling over";
    } else if (ch >= 20) {
      action = "sell";
      reason = "take the clip";
    }
  }
  return {
    kind: "thesis",
    at: new Date().toISOString(),
    action,
    reason,
    symbol: token.symbol,
    mint: token.mint,
    mcap: token.mcap,
    volume24h: token.volume24h,
    change1h: token.change1h,
    liquidity: token.liquidity,
    clipUsd: HUNTER_CLIP_USD,
    dryRun: !liveAllowed() || !desk.armed,
    sayThis: `${token.symbol}: ${action.toUpperCase()} — ${reason}.`,
  };
}

function nvidiaKey() {
  return trim(process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || "");
}
function nvidiaModel() {
  return trim(process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct");
}

async function nvidiaThesis(token, thesis) {
  const key = nvidiaKey();
  if (!key) return null;
  const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: nvidiaModel(),
      temperature: 0.3,
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content:
            "You are ALPHA, OrbitX MCP hunter. One sentence thesis. Be blunt. Never promise profit. Prefer skip unless liquidity, volume, and 1h change all look tradable for a $1.50 clip.",
        },
        {
          role: "user",
          content: `${token.symbol} mint ${token.mint} 1h ${token.change1h}% vol ${token.volume24h} liq ${token.liquidity} mcap ${token.mcap}. Rule action ${thesis.action} because ${thesis.reason}. Reply one sentence.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(12000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `nvidia ${r.status}`);
  const line = String(j?.choices?.[0]?.message?.content || "").trim().replace(/\s+/g, " ");
  return line.slice(0, 280);
}

async function brainPolish(thesis, token) {
  try {
    const line = await nvidiaThesis(token, thesis);
    if (line) {
      thesis.sayThis = line;
      thesis.brain = "nvidia";
      thesis.model = nvidiaModel();
      return thesis;
    }
  } catch (e) {
    thesis.brainError = String(e && e.message || e).slice(0, 160);
  }
  try {
    const { thinkAsAgent } = await import("./_mcp-life-brain.js");
    const out = await thinkAsAgent(
      { name: HUNTER_NAME, role: "MCP hunter", voice: "terse", mood: "focused", handle: "@alpha.obx" },
      {
        userText: `One line thesis. Token ${token.symbol} mint ${token.mint} 1h ${token.change1h}% vol ${token.volume24h} liq ${token.liquidity} mcap ${token.mcap}. Suggested action ${thesis.action} because ${thesis.reason}. Reply ONE sentence.`,
        maxTokens: 80,
        timeoutMs: 5000,
      },
    );
    const line = String(out?.text || out?.think || "").trim();
    if (line && line.length < 280) thesis.sayThis = line;
    thesis.brain = out?.source || "fallback";
  } catch {
    thesis.brain = "rules";
  }
  return thesis;
}


async function fetchWalletState(pubkey) {
  const pk = trim(pubkey);
  const out = { pubkey: pk, sol: 0, lamports: 0, usd: 0, rpcOk: false };
  if (!pk) return out;
  const key = trim(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "");
  const rpc = key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : "https://api.mainnet-beta.solana.com";
  try {
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [pk] }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json();
    const lamports = Number(j?.result?.value || 0);
    out.lamports = lamports;
    out.sol = lamports / 1e9;
    out.rpcOk = true;
  } catch { /* keep zeros */ }
  try {
    const pr = await fetch("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112", { signal: AbortSignal.timeout(6000) });
    const pj = await pr.json();
    const px = Number(pj?.pairs?.[0]?.priceUsd || 0);
    if (px) out.usd = out.sol * px;
  } catch { /* ignore */ }
  return out;
}

export async function snapshotHunter() {
  const sb = sbClient();
  const desk = await loadDesk(sb);
  const feed = await loadFeed(sb, 80);
  const chain = await fetchWalletState(desk.wallet);
  const trades = feed.filter((e) => /buy|sell/i.test(String(e.action || e.kind || "")));
  const realized = num(desk.realizedPnlUsd);
  return {
    ok: true,
    agent: HUNTER_NAME,
    home: "mcp",
    dashboard: HUNTER_DASHBOARD,
    mcpTools: ["orbitx_agent_desk", "orbitx_agent_feed", "orbitx_agent_tick", "orbitx_agent_arm"],
    nvidiaReady: Boolean(nvidiaKey()),
    nvidiaModel: nvidiaKey() ? nvidiaModel() : null,
    liveEnabled: liveAllowed(),
    chain,
    desk: { ...desk, chainSol: chain.sol, chainUsd: chain.usd },
    feed,
    trades,
    stats: {
      equityUsd: num(desk.equityUsd, 4),
      chainUsd: chain.usd,
      chainSol: chain.sol,
      realizedPnlUsd: realized,
      wins: num(desk.wins),
      losses: num(desk.losses),
      winRate: (num(desk.wins)+num(desk.losses)) ? num(desk.wins) / (num(desk.wins)+num(desk.losses)) : 0,
      open: desk.open || null,
    },
    disclaimer:
      "Isolated ALPHA wallet. $4 seed / $1.50 clip. You can lose the seed. Not financial advice.",
  };
}

export async function tickHunter({ force = false } = {}) {
  const sb = sbClient();
  const desk = await loadDesk(sb);
  if (desk.paused && !force) {
    return { ok: true, skipped: "paused", desk };
  }
  if (num(desk.equityUsd) <= HUNTER_HALT_USD && desk.armed) {
    desk.paused = true;
    desk.lastError = "halt — equity at floor";
    await saveDesk(sb, desk);
    return { ok: true, skipped: "halt", desk };
  }

  let tape = [];
  try {
    tape = await fetchTape();
  } catch (e) {
    desk.lastError = e?.message || "tape_failed";
    desk.lastTickAt = new Date().toISOString();
    await saveDesk(sb, desk);
    return { ok: false, error: desk.lastError, desk };
  }

  const pick = tape[0] || null;
  if (!pick) {
    desk.lastError = "empty_tape";
    desk.lastTickAt = new Date().toISOString();
    await saveDesk(sb, desk);
    return { ok: true, skipped: "empty_tape", desk };
  }

  let thesis = ruleThesis(pick, desk);
  thesis = await brainPolish(thesis, pick);
  desk.lastThesis = thesis;
  desk.lastTickAt = thesis.at;
  desk.lastError = null;

  if (thesis.action === "buy" && !desk.open) {
    desk.open = {
      mint: pick.mint,
      symbol: pick.symbol,
      usd: HUNTER_CLIP_USD,
      at: thesis.at,
      dryRun: thesis.dryRun,
    };
    thesis.executed = thesis.dryRun ? "dry_buy" : "live_blocked_until_friday_path";
  } else if (thesis.action === "sell" && desk.open) {
    thesis.closed = desk.open;
    desk.open = null;
    desk.wins += 1;
    thesis.executed = thesis.dryRun ? "dry_sell" : "live_blocked_until_friday_path";
  } else {
    thesis.executed = "logged";
  }

  await pushEvent(sb, thesis);
  await saveDesk(sb, desk);
  return { ok: true, thesis, desk, tape: tape.slice(0, 5) };
}

export async function setHunterArmed(armed) {
  const sb = sbClient();
  const desk = await loadDesk(sb);
  desk.armed = Boolean(armed);
  desk.paused = false;
  desk.dryRun = !liveAllowed() || !desk.armed;
  desk.note = desk.armed
    ? liveAllowed()
      ? "Armed. Live clips allowed by env."
      : "Armed in software but HUNTER_LIVE is off — still dry until you set env."
    : "Disarmed. Thesis loop only.";
  await saveDesk(sb, desk);
  return { ok: true, desk };
}

export async function setHunterPaused(paused) {
  const sb = sbClient();
  const desk = await loadDesk(sb);
  desk.paused = Boolean(paused);
  await saveDesk(sb, desk);
  return { ok: true, desk };
}

export const HUNTER_CORE_TOOLS = [
  {
    name: "orbitx_agent_desk",
    description:
      "MCP hunter agent ALPHA desk — isolated wallet, $4 seed experiment, thesis + equity. MCP-only agent. Call when user asks about the 24/7 agent.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "orbitx_agent_feed",
    description: "Hunter agent thesis + dry fills feed (real-time log).",
    inputSchema: { type: "object", properties: { limit: { type: "integer" }, authCode: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "orbitx_agent_tick",
    description: "Run one hunter loop now: screen tape, write thesis, dry buy/skip. No Vercel Pro required.",
    inputSchema: { type: "object", properties: { authCode: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "orbitx_agent_arm",
    description: "Arm or pause hunter ALPHA. Live swaps still require HUNTER_LIVE env. Default stays dry.",
    inputSchema: {
      type: "object",
      properties: {
        armed: { type: "boolean" },
        paused: { type: "boolean" },
        authCode: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];
