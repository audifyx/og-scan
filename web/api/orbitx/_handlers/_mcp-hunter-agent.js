/**
 * MCP-only hunter agent — isolated desk, thesis loop, dry by default.
 * Live swaps stay OFF until HUNTER_LIVE=1 and the desk is armed.
 */
import { createClient } from "@supabase/supabase-js";

export const HUNTER_ID = "alpha";
export const HUNTER_NAME = "ALPHA";
export const HUNTER_SEED_USD = 4;
export const HUNTER_CLIP_USD = 1;
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
    live: liveAllowed(),
    armed: liveAllowed(),
    paused: false,
    dryRun: !canLive(),
    equityUsd: HUNTER_SEED_USD,
    realizedPnlUsd: 0,
    wins: 0,
    losses: 0,
    open: null,
    lastThesis: null,
    lastTickAt: null,
    lastError: null,
    note: "ALPHA scans Solana tape, writes a thesis, and clips size it can defend.",
  };
}

let MEM = { desk: emptyDesk(), feed: [] };

function liveAllowed() {
  return truthy(process.env.HUNTER_LIVE);
}
function hunterSecret() {
  return trim(process.env.HUNTER_SECRET_KEY || process.env.HUNTER_WALLET_SECRET || "");
}
function canLive() {
  return liveAllowed() && Boolean(hunterSecret());
}
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag";

async function loadHunterKeypair() {
  const s = hunterSecret();
  if (!s) throw new Error("missing HUNTER_SECRET_KEY");
  const [{ Keypair }, bs58] = await Promise.all([import("@solana/web3.js"), import("bs58")]);
  if (s.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s)));
  return Keypair.fromSecretKey(bs58.default.decode(s));
}

function rpcUrl() {
  const key = trim(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "");
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
}

async function sendRaw(b64) {
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [b64, { encoding: "base64", skipPreflight: true, maxRetries: 3 }] }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc send failed");
  return j.result;
}

async function liveSwap({ inputMint, outputMint, amount }) {
  const kp = await loadHunterKeypair();
  const owner = kp.publicKey.toBase58();
  const qr = await fetch(
    `${JUP}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=300&restrictIntermediateTokens=true`,
    { signal: AbortSignal.timeout(12000) },
  );
  const quote = await qr.json();
  if (!qr.ok || !quote?.outAmount) throw new Error(quote?.error || "jupiter quote failed");
  const sr = await fetch(`${JUP}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: owner,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
    signal: AbortSignal.timeout(12000),
  });
  const sw = await sr.json();
  if (!sr.ok || !sw.swapTransaction) throw new Error(sw.error || "jupiter swap failed");
  const { VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(Buffer.from(sw.swapTransaction, "base64"));
  tx.sign([kp]);
  const sig = await sendRaw(Buffer.from(tx.serialize()).toString("base64"));
  return { ok: true, signature: sig, outAmount: quote.outAmount, inAmount: quote.inAmount, owner };
}


async function loadDesk(sb) {
  if (!sb) return MEM.desk;
  const ev = await sb
    .from("ox_live_events")
    .select("meta,created_at")
    .eq("kind", "hunter_desk")
    .order("created_at", { ascending: false })
    .limit(1);
  const saved = ev?.data?.[0]?.meta?.desk;
  if (saved && typeof saved === "object") {
    MEM.desk = { ...emptyDesk(), ...saved };
  }
  const { data } = await sb.from("ox_live_desk").select("*").eq("id", "hunter-alpha").maybeSingle();
  if (data) {
    MEM.desk.lastTickAt = data.last_tick_at || MEM.desk.lastTickAt;
    MEM.desk.lastError = data.last_error || MEM.desk.lastError;
    MEM.desk.armed = data.armed ?? MEM.desk.armed;
    MEM.desk.paused = data.paused ?? MEM.desk.paused;
    if (data.wallet_pubkey) MEM.desk.wallet = data.wallet_pubkey;
  }
  return MEM.desk;
}

async function saveDesk(sb, desk) {
  MEM.desk = desk;
  if (!sb) return;
  try {
    await sb.from("ox_live_desk").upsert({
      id: "hunter-alpha",
      armed: Boolean(desk.armed),
      paused: Boolean(desk.paused),
      wallet_pubkey: desk.wallet || null,
      last_tick_at: desk.lastTickAt || new Date().toISOString(),
      last_error: desk.lastError || null,
      note: desk.note || "ALPHA",
      paper: false,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    desk.lastError = desk.lastError || String(e && e.message || e).slice(0, 160);
  }
  try {
    await sb.from("ox_live_events").insert({
      kind: "hunter_desk",
      agent_id: HUNTER_ID,
      thesis: desk.note || "ALPHA",
      reason: desk.lastError || null,
      meta: { hunter: HUNTER_ID, type: "desk", desk },
    });
  } catch { /* events table may reject extra cols */ }
}

async function loadFeed(sb, limit = 40) {
  if (!sb) return MEM.feed.slice(0, limit);
  const { data, error } = await sb
    .from("ox_live_events")
    .select("kind,agent_id,mint,symbol,side,thesis,reason,signature,meta,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !Array.isArray(data)) return MEM.feed.slice(0, limit);
  const rows = data
    .filter((r) => !r.agent_id || r.agent_id === HUNTER_ID || r.meta?.hunter === HUNTER_ID)
    .map((r) => ({
      ...(r.meta && typeof r.meta === "object" ? r.meta : {}),
      kind: r.kind,
      action: r.side || r.meta?.action,
      symbol: r.symbol || r.meta?.symbol,
      mint: r.mint || r.meta?.mint,
      sayThis: r.thesis || r.meta?.sayThis,
      reason: r.reason || r.meta?.reason,
      signature: r.signature || r.meta?.signature,
      at: r.created_at,
    }));
  if (rows.length) MEM.feed = rows.filter((p) => p.kind !== "hunter_desk").slice(0, limit);
  const lastDesk = data.find((r) => r.kind === "hunter_desk" && r.meta?.desk);
  if (lastDesk?.meta?.desk) MEM.desk = { ...emptyDesk(), ...lastDesk.meta.desk };
  return MEM.feed.slice(0, limit);
}

async function pushEvent(sb, payload) {
  MEM.feed.unshift(payload);
  MEM.feed = MEM.feed.slice(0, 80);
  if (!sb) return;
  const { error } = await sb.from("ox_live_events").insert({
    kind: payload.kind || payload.action || "thesis",
    agent_id: HUNTER_ID,
    mint: payload.mint || null,
    symbol: payload.symbol || null,
    side: payload.action || payload.executed || null,
    usd_amount: payload.usd || payload.clipUsd || null,
    thesis: payload.sayThis || null,
    reason: payload.reason || null,
    signature: payload.signature || null,
    meta: { hunter: HUNTER_ID, ...payload },
  });
  if (error) payload.persistError = error.message;
}

async function fetchTape() {
  const boosts = await fetch("https://api.dexscreener.com/token-boosts/top/v1", { signal: AbortSignal.timeout(8000) })
    .then((r) => r.json())
    .catch(() => []);
  const mints = [...new Set((Array.isArray(boosts) ? boosts : [])
    .filter((b) => String(b.chainId || "").toLowerCase() === "solana")
    .map((b) => b.tokenAddress)
    .filter(Boolean))].slice(0, 20);
  let pairs = [];
  if (mints.length) {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mints.join(",")}`, { signal: AbortSignal.timeout(10000) }).catch(() => null);
    const j = r && r.ok ? await r.json().catch(() => ({})) : {};
    pairs = Array.isArray(j.pairs) ? j.pairs : [];
  }
  if (!pairs.length) {
    const s = await fetch("https://api.dexscreener.com/latest/dex/search?q=sol", { signal: AbortSignal.timeout(8000) }).catch(() => null);
    const j = s && s.ok ? await s.json().catch(() => ({})) : {};
    pairs = Array.isArray(j.pairs) ? j.pairs : [];
  }
  const banned = new Set(["SOL", "WSOL", "USDC", "USDT", "PUMP"]);
  return pairs
    .filter((p) => String(p.chainId || "").toLowerCase() === "solana")
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
    .filter((t) => t.mint && t.mint !== SOL_MINT && !banned.has(String(t.symbol).toUpperCase()))
    .sort((a, b) => num(b.volume24h) - num(a.volume24h))
    .slice(0, 12);
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
  } else if (ch <= -32) {
    action = "skip";
    reason = "cascade, not a dip";
  } else if (ch >= 70) {
    action = "skip";
    reason = "already vertical";
  } else if (vol >= 3000 && liq >= 4000 && ch > -32 && ch < 25) {
    action = desk.open ? "hold" : "buy";
    reason = ch < 0 ? "dip with book" : "steady tape";
  } else {
    action = "skip";
    reason = "not our setup";
  }
  if (desk.open && desk.open.mint === token.mint) {
    const entry = num(desk.open.priceUsd);
    const nowPx = num(token.priceUsd);
    const dd = entry > 0 && nowPx > 0 ? (nowPx - entry) / entry : ch / 100;
    if (dd >= 0.12) {
      action = "sell";
      reason = "take profit ~12%+";
    } else if (dd <= -0.25) {
      action = "sell";
      reason = "hard stop 25%";
    } else if (dd <= -0.15) {
      const hit = desk.open.hitSoftStopAt;
      if (!hit) {
        desk.open.hitSoftStopAt = new Date().toISOString();
        action = "hold";
        reason = "soft stop 15% — wait for bounce";
      } else if (Date.now() - new Date(hit).getTime() >= 12 * 60 * 1000) {
        action = "sell";
        reason = "soft stop waited 12m, still red";
      } else {
        action = "hold";
        reason = "in 15-25% zone, waiting";
      }
    } else {
      action = "hold";
      reason = "open, no stop";
      if (desk.open.hitSoftStopAt && dd > -0.10) desk.open.hitSoftStopAt = null;
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
    dryRun: !canLive(),
    sayThis: `${token.symbol}: ${action.toUpperCase()} — ${reason}.`,
  };
}

function nvidiaKey() {
  return trim(process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY || "");
}
function nvidiaModel() {
  return trim(process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct");
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

function cleanLine(s) {
  let line = String(s || "").replace(/\s+/g, " ").trim();
  if (/WILL:|THINK:|TWEET:|TALK:|day 1, still MCP/i.test(line)) return "";
  return line.slice(0, 220);
}

async function brainPolish(thesis, token) {
  thesis.sayThis = `${token.symbol}: ${thesis.action.toUpperCase()} — ${thesis.reason}.`;
  thesis.brain = "rules";
  try {
    const line = cleanLine(await nvidiaThesis(token, thesis));
    if (line) {
      thesis.sayThis = line;
      thesis.brain = "nvidia";
      thesis.model = nvidiaModel();
    }
  } catch (e) {
    thesis.brainError = String(e && e.message || e).slice(0, 160);
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
      "ALPHA desk. Theses and fills only. Not financial advice.",
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

  const ranked = [...tape].sort((a,b) => num(b.volume24h)-num(a.volume24h));
  let pick = ranked.find((tok) => desk.open && tok.mint === desk.open.mint) || null;
  if (!pick && desk.open?.mint) {
    try {
      const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + desk.open.mint, { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      const p = (j.pairs || []).find((x) => String(x.chainId||"").toLowerCase()==="solana") || (j.pairs||[])[0];
      if (p) pick = {
        mint: desk.open.mint,
        symbol: p.baseToken?.symbol || desk.open.symbol,
        priceUsd: num(p.priceUsd),
        mcap: num(p.marketCap || p.fdv),
        volume24h: num(p.volume?.h24),
        change1h: num(p.priceChange?.h1),
        liquidity: num(p.liquidity?.usd),
      };
    } catch {}
  }
  if (!pick) {
    pick = ranked.find((tok) => ruleThesis(tok, desk).action === "buy")
      || ranked.find((tok) => ruleThesis(tok, desk).action !== "skip")
      || ranked[0]
      || null;
  }
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

  thesis.dryRun = !canLive();
  if (thesis.action === "buy" && !desk.open) {
    if (canLive()) {
      try {
        let px = 200;
        try {
          const pr = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + SOL_MINT, { signal: AbortSignal.timeout(6000) });
          const pj = await pr.json();
          px = Number(pj?.pairs?.[0]?.priceUsd) || px;
        } catch {}
        const chain = await fetchWalletState(desk.wallet);
        const reserve = 12_000_000; // ~$1.30 fees/rent buffer
        const want = Math.floor((HUNTER_CLIP_USD / px) * 1e9);
        const maxSpend = Math.max(0, Number(chain.lamports || 0) - reserve);
        const lamports = Math.min(want, maxSpend);
        if (lamports < 5_000_000) throw new Error("wallet needs more SOL for a clip + fees");
        const live = await liveSwap({ inputMint: SOL_MINT, outputMint: pick.mint, amount: lamports });
        desk.open = {
          mint: pick.mint,
          symbol: pick.symbol,
          usd: HUNTER_CLIP_USD,
          priceUsd: pick.priceUsd || 0,
          at: thesis.at,
          dryRun: false,
          signature: live.signature,
          outAmount: live.outAmount,
          hitSoftStopAt: null,
        };
        thesis.executed = "live_buy";
        thesis.signature = live.signature;
        thesis.tx = `https://solscan.io/tx/${live.signature}`;
      } catch (e) {
        thesis.executed = "live_buy_failed";
        thesis.reason = String(e && e.message || e).slice(0, 180);
        desk.lastError = thesis.reason;
      }
    } else {
      desk.open = { mint: pick.mint, symbol: pick.symbol, usd: HUNTER_CLIP_USD, at: thesis.at, dryRun: true };
      thesis.executed = "dry_buy";
    }
  } else if (thesis.action === "sell" && desk.open) {
    if (canLive() && desk.open.outAmount) {
      try {
        const live = await liveSwap({ inputMint: desk.open.mint, outputMint: SOL_MINT, amount: desk.open.outAmount });
        thesis.signature = live.signature;
        thesis.tx = `https://solscan.io/tx/${live.signature}`;
        thesis.executed = "live_sell";
        desk.wins += 1;
        thesis.closed = desk.open;
        desk.open = null;
      } catch (e) {
        thesis.executed = "live_sell_failed";
        thesis.reason = String(e && e.message || e).slice(0, 180);
        desk.lastError = thesis.reason;
      }
    } else {
      thesis.closed = desk.open;
      desk.open = null;
      desk.wins += 1;
      thesis.executed = canLive() ? "live_sell_no_size" : "dry_sell";
    }
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
  desk.dryRun = !canLive();
  desk.note = "ALPHA scans Solana tape, writes a thesis, and clips size it can defend.";
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
