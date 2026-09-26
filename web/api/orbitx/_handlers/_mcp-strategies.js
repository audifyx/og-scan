/**
 * OrbitX strategy engine — one tick to run them all.
 *
 * The `limits/tick` route (hit every ~5 min by the external scheduler) used to
 * only fill limit orders. It now sweeps every strategy family: limit orders,
 * copy-trading mirrors, trailing stops + take-profit ladders, the launch
 * sniper, and alert-triggered trades.
 *
 * Per-user / per-strategy failures are isolated: one user's bad row never
 * stops the sweep. Route path stays `limits/tick` so the existing scheduler
 * keeps working unchanged.
 */
import { sb, tickUserLimits } from "./_mcp-app-wallet.js";
import { tickUserCopy } from "./_mcp-copy.js";
import { tickUserTrailing } from "./_mcp-trailing.js";
import { tickUserSniper } from "./_mcp-sniper.js";
import { tickUserAlerts } from "./_mcp-alerts.js";

const JOBS = [
  { name: "limits", kinds: ["app_limit"], run: (uid, ctx) => tickUserLimits(uid, ctx) },
  { name: "copy", kinds: ["app_copy"], run: (uid, ctx) => tickUserCopy(uid, ctx) },
  { name: "trailing", kinds: ["app_trailing", "app_ladder"], run: (uid, ctx) => tickUserTrailing(uid, ctx) },
  { name: "sniper", kinds: ["app_snipe"], run: (uid, ctx) => tickUserSniper(uid, ctx) },
  { name: "alerts", kinds: ["app_alert"], run: (uid, ctx) => tickUserAlerts(uid, ctx) },
];

function hasAction(r) {
  if (!r || typeof r !== "object") return false;
  return (
    (Array.isArray(r.fills) && r.fills.length > 0) ||
    (Array.isArray(r.mirrors) && r.mirrors.length > 0) ||
    (Array.isArray(r.buys) && r.buys.length > 0) ||
    (Array.isArray(r.triggered) && r.triggered.length > 0) ||
    r.ok === false
  );
}

const ALL_STRATEGY_KINDS = ["app_limit", "app_copy", "app_trailing", "app_ladder", "app_snipe", "app_alert"];

/**
 * Cheap pre-check: is there any open strategy work at all?
 * Lets the tick skip the expensive per-user sweep when nobody has active
 * orders — the fill machinery only runs when there are fills to check.
 * Conservative (fail-open): any doubt → true, run the sweep as before.
 * Family conventions: limits/trailing/ladder/alerts treat missing meta.status
 * as open; copy treats missing as active; sniper requires status === "active".
 * "filling" (a claim held by an in-flight tick) also counts — the sweep must
 * run so stale claims get reaped instead of idling forever.
 */
export async function hasOpenStrategies() {
  try {
    const client = await sb();
    if (!client) return true;
    const { count } = await client
      .from("ox_live_events")
      .select("id", { count: "exact", head: true })
      .in("kind", ALL_STRATEGY_KINDS)
      .or("meta->>status.is.null,meta->>status.in.(open,active,filling)")
      .limit(1);
    return (count || 0) > 0;
  } catch {
    return true;
  }
}

export async function tickAllStrategies({ maxUsers = 200, base, timeBudgetMs = 50000 } = {}) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  // Idle short-circuit: no open orders anywhere → skip the sweep entirely.
  // (The AgentPlus mind-loop segment of the tick still runs separately.)
  if (!(await hasOpenStrategies())) {
    return { ok: true, strategies: JOBS.map((j) => j.name), users: 0, active: 0, truncated: false, results: [], skipped: "idle_no_open_strategies" };
  }
  const ctx = { base: base || "https://orbitx.world", deadlineMs: Date.now() + timeBudgetMs };
  const results = [];
  const usersSeen = new Set();
  const started = Date.now();
  let truncated = false;

  for (const job of JOBS) {
    let users = [];
    try {
      const { data } = await client
        .from("ox_live_events")
        .select("agent_id")
        .in("kind", job.kinds)
        .limit(2000);
      users = [...new Set((data || []).map((r) => r.agent_id).filter(Boolean))].slice(0, maxUsers);
    } catch {
      continue; // discovery failure for one family never stops the sweep
    }
    for (const userId of users) {
      if (Date.now() - started > timeBudgetMs) { truncated = true; break; }
      usersSeen.add(userId);
      try {
        const r = await job.run(userId, ctx);
        if (r?.truncated) truncated = true;
        if (hasAction(r)) results.push({ strategy: job.name, userId, ...r });
      } catch (e) {
        results.push({ strategy: job.name, userId, ok: false, error: e?.message || String(e) });
      }
    }
    if (truncated) break;
  }
  return { ok: true, strategies: JOBS.map((j) => j.name), users: usersSeen.size, active: results.length, truncated, results };
}

// Back-compat: the old route handler name still works (limits only).
export async function tickAllLimitsCompat(opts) {
  const { tickAllLimits } = await import("./_mcp-app-wallet.js");
  return tickAllLimits(opts);
}
