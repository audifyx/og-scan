/**
 * MCP launch sniper — watches new-launch screeners and auto-buys matching
 * launches via backend-signed desk wallet. Per-user cooldown + daily spend cap.
 * Backend signs every fill. Never buys blind: dev-holding check is fail-safe.
 */
import {
  needAuth,
  sb,
  tokenInfo,
  solUsd,
  walletRow,
  tokenBalance,
  appWalletBuy,
  appWalletSell,
  USDC_MINT,
  claimFillRow,
  resolveFillRow,
  FILL_STATUS,
} from "./_mcp-app-wallet.js";

const SNIPE_KIND = "app_snipe";
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const authCode = { type: "string" };

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o != null ? o[k] : undefined), obj);
}

function launchpadLabel(row) {
  return String(row.launchpad || row.dex || row.dexId || row.source || row.launchpadName || row.program || "").toLowerCase();
}

function rowLiquidity(row) {
  const l = row.liquidity;
  if (l != null && typeof l !== "object") return num(l, 0);
  if (l && typeof l === "object") return num(l.usd ?? l.total ?? l.totalUsd ?? l.value, 0);
  return num(row.liquidityUsd ?? row.liqUsd, 0);
}

function rowAgeMin(row) {
  const t = row.pairCreatedAt ?? row.createdAt ?? row.pair_created_at ?? row.launchedAt;
  if (t == null) return null;
  let ms = num(t, NaN);
  if (Number.isNaN(ms)) {
    ms = Date.parse(String(t));
    if (Number.isNaN(ms)) return null;
  } else if (ms < 1e12) {
    ms = ms * 1000; // epoch seconds
  }
  return (Date.now() - ms) / 60000;
}

async function findActiveRow(client, userId, includeFilling = false) {
  const { data } = await client
    .from("ox_live_events")
    .select("id,meta,created_at")
    .eq("kind", SNIPE_KIND)
    .eq("agent_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = data || [];
  // includeFilling: for arm/stop, which must find a config even while a buy is
  // in-flight (otherwise re-arm would insert a duplicate active row). The tick
  // itself always uses strict "active" — that exclusion IS the fill mutex.
  return rows.find((r) => (r.meta || {}).status === "active" || (includeFilling && (r.meta || {}).status === FILL_STATUS)) || null;
}

async function latestRow(client, userId) {
  const { data } = await client
    .from("ox_live_events")
    .select("id,meta,created_at")
    .eq("kind", SNIPE_KIND)
    .eq("agent_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data || [])[0] || null;
}

function summarize(meta) {
  return {
    name: meta?.name || null,
    status: meta?.status || "active",
    filters: meta?.filters || {},
    maxBuyUsd: meta?.maxBuyUsd,
    cooldownMin: meta?.cooldownMin,
    dailyCapUsd: meta?.dailyCapUsd,
    spentUsd: num(meta?.spentUsd, 0),
    spentDay: meta?.spentDay || null,
    lastBuyAt: meta?.lastBuyAt || null,
    fills: (meta?.fills || []).length,
  };
}

export async function appSnipe(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const row = await walletRow(gate.userId);
  if (!row) return { ok: false, error: "no_wallet", message: "Create a desk wallet first." };

  const minLiquidityUsd = Math.max(0, num(args.minLiquidityUsd, 5000));
  const maxDevHoldingPct = clamp(num(args.maxDevHoldingPct, 20), 0, 100);
  let launchpads = args.launchpads;
  if (!Array.isArray(launchpads) || !launchpads.length) launchpads = ["pumpfun"];
  launchpads = launchpads.map((s) => String(s).toLowerCase().trim()).filter(Boolean);
  if (!launchpads.length) launchpads = ["pumpfun"];
  const maxBuyUsd = clamp(num(args.maxBuyUsd, 5), 0.5, 100);
  const cooldownMin = Math.max(1, num(args.cooldownMin, 30));
  const dailyCapUsd = Math.max(5, num(args.dailyCapUsd, 50));
  const name = args.name != null ? String(args.name).slice(0, 60) : null;

  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable", message: "Sniper config store unreachable. Retry in a minute." };

  const today = todayUtc();
  const existing = await findActiveRow(client, gate.userId, true);
  const prev = existing?.meta || {};
  const meta = {
    name,
    filters: { minLiquidityUsd, maxDevHoldingPct, launchpads },
    maxBuyUsd,
    cooldownMin,
    dailyCapUsd,
    spentDay: today,
    spentUsd: 0,
    lastBuyAt: null,
    seenMints: Array.isArray(prev.seenMints) ? prev.seenMints.slice(-200) : [],
    fills: Array.isArray(prev.fills) ? prev.fills.slice(-20) : [],
    status: "active",
    createdAt: prev.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    await client.from("ox_live_events").update({ meta, mint: null, symbol: meta.name || "sniper", side: "buy" }).eq("id", existing.id);
  } else {
    await client.from("ox_live_events").insert({
      kind: SNIPE_KIND,
      agent_id: gate.userId,
      mint: null,
      symbol: name || "sniper",
      side: "buy",
      thesis: `snipe launches (${launchpads.join(",")}) up to $${maxBuyUsd}/buy, cap $${dailyCapUsd}/day`,
      meta,
    });
  }
  return {
    ok: true,
    sniper: summarize(meta),
    message: `Sniper ${existing ? "updated" : "armed"}. Buys up to $${maxBuyUsd} per qualifying launch (${launchpads.join(", ")}, min $${minLiquidityUsd.toLocaleString()} liquidity, dev ≤ ${maxDevHoldingPct}%), ${cooldownMin}min cooldown between buys, daily cap $${dailyCapUsd}. Backend signs. Stop with orbitx_app_snipe_stop.`,
  };
}

export async function appSnipeStop(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const existing = await findActiveRow(client, gate.userId, true);
  if (!existing) return { ok: false, error: "no_sniper", message: "No active sniper config." };
  const meta = { ...(existing.meta || {}), status: "stopped", stoppedAt: new Date().toISOString() };
  await client.from("ox_live_events").update({ meta }).eq("id", existing.id);
  return { ok: true };
}

export async function appSnipeStatus(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const row = (await findActiveRow(client, gate.userId)) || (await latestRow(client, gate.userId));
  if (!row) return { ok: false, error: "no_sniper", message: "No sniper config yet." };
  const m = row.meta || {};
  const today = todayUtc();
  const spentToday = m.spentDay === today ? num(m.spentUsd, 0) : 0;
  const fills = Array.isArray(m.fills) ? m.fills : [];
  return {
    ok: true,
    status: m.status || "active",
    name: m.name || null,
    filters: m.filters || {},
    maxBuyUsd: m.maxBuyUsd,
    cooldownMin: m.cooldownMin,
    dailyCapUsd: m.dailyCapUsd,
    spentToday,
    remainingToday: Math.max(0, num(m.dailyCapUsd, 0) - spentToday),
    lastBuyAt: m.lastBuyAt || null,
    lastCheckAt: m.lastCheckAt || null,
    lastError: m.lastError || null,
    fillsCount: fills.length,
    recentFills: fills.slice(-5).reverse(),
  };
}

async function fetchJson(url, timeoutMs) {
  const r = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

export async function tickUserSniper(userId, ctx = {}) {
  const base = String(ctx?.base || "https://orbitx.world").replace(/\/$/, "");
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const r = await findActiveRow(client, userId);
  if (!r) return { ok: true, checked: 0, skipped: "no_active_config" };
  const m = { ...(r.meta || {}) };
  const f = m.filters || {};
  const now = Date.now();
  const nowIso = new Date().toISOString();

  // Cooldown
  if (m.lastBuyAt && now - Date.parse(m.lastBuyAt) < num(m.cooldownMin, 30) * 60e3) {
    return { ok: true, checked: 1, skipped: "cooldown", lastBuyAt: m.lastBuyAt };
  }

  // Daily cap rollover
  const today = todayUtc();
  if (m.spentDay !== today) {
    m.spentDay = today;
    m.spentUsd = 0;
  }
  m.spentUsd = num(m.spentUsd, 0);
  if (m.spentUsd >= num(m.dailyCapUsd, 50)) {
    // Guarded: never clobber a concurrent "filling" claim's status.
    await client.from("ox_live_events").update({ meta: { ...m, lastCheckAt: nowIso } }).eq("id", r.id).neq("meta->>status", FILL_STATUS);
    return { ok: true, checked: 1, skipped: "daily_cap" };
  }

  // New-launch screener
  let rows;
  try {
    const j = await fetchJson(`${base}/api/ogdex/screener?type=new&interval=1h&limit=30&chain=solana`, 10000);
    rows = j.rows || j.data || j.tokens;
  } catch (e) {
    // Guarded: never clobber a concurrent "filling" claim's status.
    await client.from("ox_live_events").update({ meta: { ...m, lastCheckAt: nowIso, lastError: `screener: ${e?.message || String(e)}` } }).eq("id", r.id).neq("meta->>status", FILL_STATUS);
    return { ok: true, checked: 1, skipped: "screener_error" };
  }
  if (!Array.isArray(rows)) rows = [];

  const seen = new Set(Array.isArray(m.seenMints) ? m.seenMints : []);
  const launchpads = Array.isArray(f.launchpads) && f.launchpads.length ? f.launchpads.map((s) => String(s).toLowerCase()) : ["pumpfun"];
  const minLiq = num(f.minLiquidityUsd, 5000);
  const maxDev = clamp(num(f.maxDevHoldingPct, 20), 0, 100);

  // Screen to candidates
  const candidates = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const mint = String(row.mint || row.address || "").trim();
    if (!MINT_RE.test(mint) || seen.has(mint)) continue;
    const ageMin = rowAgeMin(row);
    if (ageMin != null && ageMin >= 90) continue;
    if (rowLiquidity(row) < minLiq) continue;
    const label = launchpadLabel(row);
    if (label && !launchpads.some((lp) => label.includes(lp))) continue;
    candidates.push({ mint, symbol: String(row.symbol || row.name || "?").slice(0, 20) });
  }

  // Dev-holding gate, fail-safe: reject > cap; skip entirely when unknown.
  const rejects = [];
  let chosen = null;
  let truncated = false;
  const deadlineMs = Number(ctx?.deadlineMs || 0);
  for (const c of candidates) {
    if (deadlineMs && Date.now() > deadlineMs) { truncated = true; break; }
    let pct = null;
    try {
      const j = await fetchJson(`${base}/api/ogdex/forensics?mint=${c.mint}`, 10000);
      const raw = getPath(j, "dev.holding.pct") ?? getPath(j, "devHolding.pct") ?? getPath(j, "dev.holdingPct");
      if (raw != null && raw !== "") pct = Number(raw);
    } catch {
      /* forensics down — fail-safe skip below */
    }
    if (pct == null || !Number.isFinite(pct)) {
      rejects.push({ mint: c.mint, symbol: c.symbol, reason: "dev_unknown" });
      continue;
    }
    if (pct > maxDev) {
      rejects.push({ mint: c.mint, symbol: c.symbol, reason: "dev_holding", pct });
      continue;
    }
    c.devHoldingPct = pct;
    chosen = c;
    break; // max 1 buy per tick per user
  }

  // Remember every evaluated candidate so rejects aren't re-fetched next tick.
  for (const c of candidates) seen.add(c.mint);
  m.seenMints = [...seen].slice(-200);
  m.lastCheckAt = nowIso;

  const buys = [];
  if (chosen) {
    const size = Math.min(num(m.maxBuyUsd, 5), num(m.dailyCapUsd, 50) - m.spentUsd);
    if (size >= 0.5) {
      if (deadlineMs && Date.now() > deadlineMs) {
        return { ok: true, checked: 1, candidates: candidates.length, rejects: rejects.slice(0, 10), buys, truncated: true };
      }
      // Claim-then-execute: the claim serializes overlapping ticks, so the
      // in-memory spentUsd += size below can't race (F1), and the spend is
      // persisted by the guarded resolve.
      const claimed = await claimFillRow(client, r.id, m, { openValue: "active", bumpAttempts: false });
      if (!claimed) {
        // Lost the race — another tick owns this sniper cycle. Touch nothing.
        return { ok: true, checked: 1, candidates: candidates.length, rejects: rejects.slice(0, 10), buys, skipped: "claim_lost" };
      }
      let fill;
      try {
        fill = await appWalletBuy({ userId }, { mint: chosen.mint, usd: size });
      } catch (e) {
        fill = { ok: false, error: "fill_threw", message: e?.message || String(e) };
      }
      let metaWriteFailed = false;
      if (fill && fill.ok) {
        let priceUsd = 0;
        try {
          priceUsd = (await tokenInfo(chosen.mint)).priceUsd || 0;
        } catch {
          /* best-effort entry mark */
        }
        m.spentUsd += size;
        m.lastBuyAt = nowIso;
        m.lastError = null;
        const fills = Array.isArray(m.fills) ? m.fills : [];
        fills.push({ mint: chosen.mint, symbol: chosen.symbol, usd: size, priceUsd, signature: fill.signature || null, at: nowIso, devHoldingPct: chosen.devHoldingPct });
        m.fills = fills.slice(-20);
        buys.push({ mint: chosen.mint, symbol: chosen.symbol, usd: size, signature: fill.signature || null });
      } else {
        m.lastError = fill?.error || fill?.message || "buy_failed";
      }
      // Guarded resolve (retries transport errors). If it fails, the spend
      // is NOT silently lost — metaWriteFailed surfaces in the tick result
      // (F7), and the stale claim is reaped by a later tick.
      const resolved = await resolveFillRow(client, r.id, m, "active");
      if (!resolved) metaWriteFailed = true;
      return { ok: true, checked: 1, candidates: candidates.length, rejects: rejects.slice(0, 10), buys, ...(truncated ? { truncated: true } : {}), ...(metaWriteFailed ? { metaWriteFailed: true } : {}) };
    }
  }

  try {
    // Guarded: never clobber a concurrent "filling" claim's status.
    await client.from("ox_live_events").update({ meta: m }).eq("id", r.id).neq("meta->>status", FILL_STATUS);
  } catch {
    /* meta write is best-effort; no fill happened on this path */
  }
  return { ok: true, checked: 1, candidates: candidates.length, rejects: rejects.slice(0, 10), buys, ...(truncated ? { truncated: true } : {}) };
}

export function dispatchSniperTools(name, args, auth) {
  if (name === "orbitx_app_snipe") return appSnipe(auth, args || {});
  if (name === "orbitx_app_snipe_stop") return appSnipeStop(auth);
  if (name === "orbitx_app_snipe_status") return appSnipeStatus(auth);
  return null;
}

export const SNIPER_TOOLS = [
  {
    name: "orbitx_app_snipe",
    description:
      "Arm a launch sniper: auto-buys newly launched tokens that pass ALL filters — min liquidity, dev holding % cap (fail-safe: skipped when dev data unknown), launchpad allowlist. Safety rails: per-user cooldown between buys, daily spend cap, max $ per buy, never buys the same mint twice. Backend signs every fill. Re-arming replaces the existing config.",
    inputSchema: {
      type: "object",
      properties: {
        minLiquidityUsd: { type: "number" },
        maxDevHoldingPct: { type: "number" },
        launchpads: { type: "array", items: { type: "string" } },
        maxBuyUsd: { type: "number" },
        cooldownMin: { type: "number" },
        dailyCapUsd: { type: "number" },
        name: { type: "string" },
        authCode,
      },
    },
  },
  {
    name: "orbitx_app_snipe_stop",
    description: "Stop the active launch sniper. No more auto-buys.",
    inputSchema: { type: "object", properties: { authCode } },
  },
  {
    name: "orbitx_app_snipe_status",
    description: "Show the sniper config: filters, today's spend vs daily cap, last buy, recent fills.",
    inputSchema: { type: "object", properties: { authCode } },
  },
];
