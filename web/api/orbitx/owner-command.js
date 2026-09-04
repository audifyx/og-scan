/**
 * Owner command center data layer.
 * Uses the same REST `sb(path, init)` helper as telegram / hub (service role).
 *
 * Metric rules (do not invent numbers):
 * - ONLINE: heartbeat within 60s
 * - AWAY: heartbeat 60s–5min
 * - OFFLINE: else (including is_online stuck true)
 * - Completed ledger rows require verified_onchain = true
 * - Burns counted only from ox_admin_burns.verified_onchain or mcp_burn_ledger
 */

export const PRESENCE_ONLINE_MS = 60_000;
export const PRESENCE_AWAY_MS = 5 * 60_000;
export const HEARTBEAT_CREDIT_MAX_MS = 20_000;
export const HOUR_MS = 3_600_000;

export function presenceStatus(lastHeartbeatAt, now = Date.now()) {
  const t = lastHeartbeatAt ? new Date(lastHeartbeatAt).getTime() : 0;
  if (!t || Number.isNaN(t)) return "offline";
  const age = now - t;
  if (age <= PRESENCE_ONLINE_MS) return "online";
  if (age <= PRESENCE_AWAY_MS) return "away";
  return "offline";
}

export function appFromPath(path) {
  const p = String(path || "/");
  if (/ORBITX_DEX|\/trade/i.test(p)) return "dex";
  if (/\/play/i.test(p)) return "games";
  if (/\/hq|orbitx-social|\/community/i.test(p)) return "communities";
  if (/\/predictions/i.test(p)) return "predictions";
  if (/orbitxlaunch|\/launch/i.test(p)) return "launches";
  if (/\/intel/i.test(p)) return "intel";
  if (/\/agent/i.test(p)) return "agent";
  if (/\/telegram/i.test(p)) return "telegram";
  if (/Orbitxcity|orbitxcity/i.test(p)) return "city";
  if (/^\/os/i.test(p)) return "os";
  if (/\/shop/i.test(p)) return "shop";
  return "app";
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function startOfUtcDay(offset = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString();
}

/** Calendar windows in UTC: today, week starting Monday, month starting the 1st. */
export function calendarBounds(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const today = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = today.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const week = new Date(today);
  week.setUTCDate(today.getUTCDate() + mondayOffset);
  const month = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return {
    today: today.toISOString(),
    week: week.toISOString(),
    month: month.toISOString(),
  };
}

/** Credit only the gap since the last beat, capped, and never a 5min+ hole. */
export function creditHeartbeatMs(prevHeartbeatAt, nowMs = Date.now(), maxMs = HEARTBEAT_CREDIT_MAX_MS) {
  if (!prevHeartbeatAt) return 0;
  const prev = new Date(prevHeartbeatAt).getTime();
  if (!prev || Number.isNaN(prev)) return 0;
  const delta = nowMs - prev;
  if (delta <= 0) return 0;
  if (delta > PRESENCE_AWAY_MS) return 0;
  return Math.min(delta, maxMs);
}

export function sessionAgeMs(startedAt, nowMs = Date.now()) {
  if (!startedAt) return 0;
  const t = new Date(startedAt).getTime();
  if (!t || Number.isNaN(t)) return 0;
  return Math.max(0, nowMs - t);
}

export function sessionMsInWindow(session, fromIso, toMs = Date.now()) {
  const start = new Date(session?.started_at || 0).getTime();
  const end = session?.ended_at ? new Date(session.ended_at).getTime() : toMs;
  const from = new Date(fromIso).getTime();
  if (!start || Number.isNaN(start) || !from || Number.isNaN(from)) return 0;
  const a = Math.max(start, from);
  const b = Math.min(end || toMs, toMs);
  return b > a ? b - a : 0;
}

export function hoursFromMs(ms) {
  const n = Number(ms || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round((n / HOUR_MS) * 10) / 10;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function stayedLongerThanHour(totalOnlineMs) {
  return Number(totalOnlineMs || 0) >= HOUR_MS;
}

export function stayedHourAmong(signups, presenceRows) {
  const byId = Object.fromEntries(
    list(presenceRows).map((p) => [p.user_id, Number(p.total_online_ms || 0)]),
  );
  return list(signups).filter((u) => stayedLongerThanHour(byId[u.user_id])).length;
}

export function sumMsInWindow(sessions, fromIso, toMs = Date.now()) {
  return list(sessions).reduce((s, row) => s + sessionMsInWindow(row, fromIso, toMs), 0);
}

function list(v) {
  return Array.isArray(v) ? v : [];
}

export async function recordOwnerEvent(sb, event) {
  if (typeof sb !== "function") return null;
  try {
    await sb("ox_admin_events", {
      method: "POST",
      body: JSON.stringify({
        event_type: String(event.event_type || "PAGE_VIEW"),
        user_id: event.user_id || null,
        wallet_address: event.wallet_address || null,
        application: event.application || appFromPath(event.path),
        title: event.title || null,
        metadata: event.metadata || {},
        tx_signature: event.tx_signature || null,
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    return null;
  }
  return true;
}

export async function recordVerifiedBurn(sb, row) {
  if (typeof sb !== "function") return null;
  const sig = String(row.tx_signature || "").trim();
  if (!sig) return null;
  const body = {
    user_id: row.user_id || null,
    wallet_address: row.wallet_address || null,
    application: row.application || "agent",
    tokens_burned: Number(row.tokens_burned || 0),
    value_usd: row.value_usd ?? null,
    tx_signature: sig,
    mint: row.mint || "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
    verified_onchain: true,
    source: row.source || "mcp_burn",
    metadata: row.metadata || {},
  };
  try {
    await sb("ox_admin_burns", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { Prefer: "return=minimal" },
    });
  } catch (e) {
    if (!/23505|duplicate|unique/i.test(String(e?.message || e))) return null;
  }
  await recordOwnerEvent(sb, {
    event_type: "ORBITX_BURNED",
    user_id: row.user_id,
    wallet_address: row.wallet_address,
    application: body.application,
    title: `OrbitX burn — ${body.tokens_burned}`,
    tx_signature: sig,
    metadata: { tokens: body.tokens_burned },
  });
  return true;
}

export async function recordLedger(sb, row) {
  if (typeof sb !== "function") return null;
  try {
    await sb("ox_admin_ledger", {
      method: "POST",
      body: JSON.stringify({
        chain: row.chain || "solana",
        tx_signature: row.tx_signature || null,
        user_id: row.user_id || null,
        wallet_address: row.wallet_address || null,
        application: row.application || "dex",
        tx_type: row.tx_type || "swap",
        status: row.status || "pending",
        input_amount: row.input_amount ?? null,
        output_amount: row.output_amount ?? null,
        value_usd: row.value_usd ?? null,
        fee_bps: row.fee_bps ?? 120,
        fee_usd_calc: row.fee_usd_calc ?? null,
        fee_usd_actual: row.fee_usd_actual ?? null,
        fee_cap_applied: Boolean(row.fee_cap_applied),
        orbitx_bought: row.orbitx_bought ?? null,
        orbitx_burned: row.orbitx_burned ?? null,
        burn_signature: row.burn_signature || null,
        error: row.error || null,
        verified_onchain: Boolean(row.verified_onchain),
        metadata: row.metadata || {},
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    return null;
  }
  return true;
}

async function loadPresenceRow(sb, userId) {
  try {
    const rows = await sb(
      `ox_admin_presence?user_id=eq.${encodeURIComponent(userId)}&select=user_id,session_id,session_started_at,last_heartbeat_at,total_online_ms&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch {
    return null;
  }
}

async function touchSession(sb, row) {
  if (!row?.session_id) return;
  const body = {
    session_id: row.session_id,
    user_id: row.user_id,
    started_at: row.started_at,
    last_heartbeat_at: row.last_heartbeat_at,
    ended_at: row.ended_at || null,
    duration_ms: Math.max(0, Number(row.duration_ms || 0)),
    current_path: row.current_path || null,
    current_app: row.current_app || null,
    device: row.device || null,
  };
  try {
    await sb("ox_admin_sessions", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  } catch {
    try {
      await sb(`ox_admin_sessions?session_id=eq.${encodeURIComponent(row.session_id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          last_heartbeat_at: body.last_heartbeat_at,
          ended_at: body.ended_at,
          duration_ms: body.duration_ms,
          current_path: body.current_path,
          current_app: body.current_app,
          device: body.device,
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      /* session table may not exist yet */
    }
  }
}

export async function upsertPresence(sb, row) {
  if (typeof sb !== "function" || !row?.user_id) return null;
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const offline = row.status === "offline";
  const existing = await loadPresenceRow(sb, row.user_id);
  const incomingSession = row.session_id || existing?.session_id || null;
  const prevHb = existing?.last_heartbeat_at || null;
  const prevAge = prevHb ? nowMs - new Date(prevHb).getTime() : Infinity;
  const stale = !prevHb || prevAge > PRESENCE_AWAY_MS;
  const sessionChanged = Boolean(
    incomingSession && existing?.session_id && incomingSession !== existing.session_id,
  );
  const shouldClose = Boolean(existing?.session_id && (offline || stale || sessionChanged));

  if (shouldClose && existing.session_id) {
    const started = existing.session_started_at || existing.last_heartbeat_at || now;
    const closedMs = Math.max(0, new Date(existing.last_heartbeat_at || now).getTime() - new Date(started).getTime());
    await touchSession(sb, {
      session_id: existing.session_id,
      user_id: row.user_id,
      started_at: started,
      last_heartbeat_at: existing.last_heartbeat_at || now,
      ended_at: now,
      duration_ms: closedMs,
      current_path: row.current_path,
      current_app: row.current_app || appFromPath(row.current_path),
      device: row.device,
    });
  }

  // Offline must not refresh heartbeat — readers use last_heartbeat_at, not status.
  const heartbeatAt = offline
    ? new Date(nowMs - PRESENCE_AWAY_MS - 1_000).toISOString()
    : now;
  const sessionStartedAt = offline || stale || sessionChanged || !existing?.session_started_at
    ? (offline ? existing?.session_started_at || null : now)
    : existing.session_started_at;
  const credited = offline ? 0 : creditHeartbeatMs(prevHb, nowMs);
  const totalOnlineMs = Math.max(0, Number(existing?.total_online_ms || 0) + credited);
  const body = {
    user_id: row.user_id,
    username: row.username || null,
    avatar_url: row.avatar_url || null,
    wallet_address: row.wallet_address || null,
    status: offline ? "offline" : "online",
    last_seen_at: now,
    last_heartbeat_at: heartbeatAt,
    current_path: row.current_path || "/",
    current_app: row.current_app || appFromPath(row.current_path),
    device: row.device || null,
    user_agent: row.user_agent || null,
    session_id: incomingSession,
    session_started_at: sessionStartedAt,
    total_online_ms: totalOnlineMs,
    updated_at: now,
  };
  try {
    await sb("ox_admin_presence", {
      method: "POST",
      body: JSON.stringify({ ...body, created_at: now }),
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
  } catch {
    try {
      await sb(`ox_admin_presence?user_id=eq.${encodeURIComponent(row.user_id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      try {
        const { session_started_at: _s, total_online_ms: _t, ...legacy } = body;
        await sb(`ox_admin_presence?user_id=eq.${encodeURIComponent(row.user_id)}`, {
          method: "PATCH",
          body: JSON.stringify(legacy),
          headers: { Prefer: "return=minimal" },
        });
      } catch {
        return null;
      }
    }
  }
  if (!offline && incomingSession) {
    const openMs = sessionAgeMs(sessionStartedAt, nowMs);
    await touchSession(sb, {
      session_id: incomingSession,
      user_id: row.user_id,
      started_at: sessionStartedAt || now,
      last_heartbeat_at: heartbeatAt,
      ended_at: null,
      duration_ms: openMs,
      current_path: body.current_path,
      current_app: body.current_app,
      device: body.device,
    });
  }
  return true;
}

export async function buildOverview(sb) {
  const today = startOfUtcDay(0);
  const monthRolling = isoDaysAgo(30);
  const cal = calendarBounds();
  const now = Date.now();

  const [
    profiles,
    newToday,
    newYesterday,
    newWeek,
    newMonth,
    presence,
    sessions,
    ledger,
    burns,
    mcpBurns,
    tokens,
    activityToday,
  ] = await Promise.all([
    sb("profiles?select=user_id,created_at&limit=20000").catch(() => []),
    sb(`profiles?select=user_id,created_at&created_at=gte.${cal.today}&limit=5000`).catch(() => []),
    sb(`profiles?select=user_id&created_at=gte.${startOfUtcDay(-1)}&created_at=lt.${cal.today}&limit=5000`).catch(() => []),
    sb(`profiles?select=user_id,created_at&created_at=gte.${cal.week}&limit=8000`).catch(() => []),
    sb(`profiles?select=user_id,created_at&created_at=gte.${cal.month}&limit=12000`).catch(() => []),
    sb("ox_admin_presence?select=user_id,status,last_heartbeat_at,current_app,username,avatar_url,wallet_address,current_path,device,last_seen_at,session_id,session_started_at,total_online_ms&limit=5000").catch(() => []),
    sb(`ox_admin_sessions?select=user_id,started_at,ended_at,duration_ms,last_heartbeat_at&last_heartbeat_at=gte.${cal.month}&limit=20000`).catch(() => []),
    sb(`ox_admin_ledger?select=id,status,value_usd,fee_usd_actual,fee_usd_calc,application,tx_type,verified_onchain,created_at,fee_cap_applied&created_at=gte.${monthRolling}&limit=8000`).catch(() => []),
    sb(`ox_admin_burns?select=tokens_burned,verified_onchain,created_at,application&created_at=gte.${monthRolling}&limit=5000`).catch(() => []),
    sb(`mcp_burn_ledger?select=tokens_burned,created_at,tx_signature&created_at=gte.${monthRolling}&limit=5000`).catch(() => []),
    sb(`orbitx_tokens?select=id,created_at,launch_type&created_at=gte.${monthRolling}&limit=4000`).catch(() => []),
    sb(`user_activity?select=user_id,created_at&created_at=gte.${today}&limit=8000`).catch(() => []),
  ]);

  const live = list(presence).map((p) => {
    const status = presenceStatus(p.last_heartbeat_at, now);
    const sessionMs = status === "offline" ? 0 : sessionAgeMs(p.session_started_at, now);
    return {
      ...p,
      liveStatus: status,
      session_ms: sessionMs,
      total_online_ms: Number(p.total_online_ms || 0),
    };
  });
  const online = live.filter((p) => p.liveStatus === "online");
  const away = live.filter((p) => p.liveStatus === "away");
  const completed = list(ledger).filter((r) => r.status === "completed" && r.verified_onchain);
  const feeOf = (r) => Number(r.fee_usd_actual ?? r.fee_usd_calc ?? 0);
  const inRange = (iso, since) => Boolean(iso && iso >= since);
  const sum = (rows, fn) => rows.reduce((s, r) => s + (fn(r) || 0), 0);
  const verifiedBurns = [...list(burns).filter((b) => b.verified_onchain !== false), ...list(mcpBurns)];

  const apps = {};
  for (const row of live) {
    const app = row.current_app || "app";
    apps[app] = apps[app] || { online: 0, away: 0 };
    if (row.liveStatus === "online") apps[app].online += 1;
    if (row.liveStatus === "away") apps[app].away += 1;
  }
  const feesByApp = {};
  for (const row of completed) {
    const app = row.application || "app";
    feesByApp[app] = (feesByApp[app] || 0) + feeOf(row);
  }

  return {
    generatedAt: new Date().toISOString(),
    definitions: {
      online: "heartbeat within 60s",
      away: "heartbeat 60s–5min",
      offline: "no heartbeat in 5min",
      signup: "profiles.created_at in the UTC calendar window",
      stayedHour: "that signup's accumulated heartbeat time is at least 60 minutes",
      hoursOnline: "sum of session overlaps in the UTC window from heartbeats (not estimated)",
      completedTx: "ledger.status=completed AND verified_onchain",
      burn: "ox_admin_burns.verified_onchain or mcp_burn_ledger row",
      fee: "min(1.2% of USD notional, $10), backend-enforced",
    },
    users: {
      total: list(profiles).length,
      newToday: list(newToday).length,
      newYesterday: list(newYesterday).length,
      newWeek: list(newWeek).length,
      newMonth: list(newMonth).length,
      stayedHourToday: stayedHourAmong(list(newToday), live),
      stayedHourWeek: stayedHourAmong(list(newWeek), live),
      stayedHourMonth: stayedHourAmong(list(newMonth), live),
      hoursOnlineToday: hoursFromMs(sumMsInWindow(list(sessions), cal.today, now)),
      hoursOnlineWeek: hoursFromMs(sumMsInWindow(list(sessions), cal.week, now)),
      hoursOnlineMonth: hoursFromMs(sumMsInWindow(list(sessions), cal.month, now)),
      hoursOnlineAll: hoursFromMs(sum(live, (p) => Number(p.total_online_ms || 0))),
      onlineHoursNow: hoursFromMs(sum(online, (p) => Number(p.session_ms || 0))),
      onlineNow: online.length,
      awayNow: away.length,
      dau: new Set(list(activityToday).map((a) => a.user_id).filter(Boolean)).size,
    },
    windows: {
      today: cal.today,
      week: cal.week,
      month: cal.month,
    },
    activity: {
      txMonth: completed.length,
      txToday: completed.filter((r) => inRange(r.created_at, today)).length,
      volumeMonthUsd: sum(completed, (r) => Number(r.value_usd || 0)),
      volumeTodayUsd: sum(
        completed.filter((r) => inRange(r.created_at, today)),
        (r) => Number(r.value_usd || 0),
      ),
      launchesMonth: list(tokens).length,
      launchesToday: list(tokens).filter((t) => inRange(t.created_at, today)).length,
      jupiterMonth: completed.filter((r) => /swap|jupiter|buy|sell/i.test(String(r.tx_type || ""))).length,
    },
    revenue: {
      feesMonthUsd: sum(completed, feeOf),
      feesTodayUsd: sum(completed.filter((r) => inRange(r.created_at, today)), feeOf),
      feesWeekUsd: sum(completed.filter((r) => inRange(r.created_at, cal.week)), feeOf),
      feesByApp,
      avgFeeUsd: completed.length ? sum(completed, feeOf) / completed.length : 0,
      maxFeeUsd: completed.reduce((m, r) => Math.max(m, feeOf(r)), 0),
    },
    burns: {
      tokensMonth: sum(verifiedBurns, (b) => Number(b.tokens_burned || 0)),
      tokensToday: sum(
        verifiedBurns.filter((b) => inRange(b.created_at, today)),
        (b) => Number(b.tokens_burned || 0),
      ),
      countMonth: verifiedBurns.length,
      countToday: verifiedBurns.filter((b) => inRange(b.created_at, today)).length,
    },
    apps,
    live: online.slice(0, 40),
  };
}

export async function buildHealth(sb) {
  const checks = [];
  const ping = async (name, fn) => {
    const t0 = Date.now();
    try {
      await fn();
      checks.push({ name, ok: true, state: "healthy", ms: Date.now() - t0 });
    } catch (e) {
      checks.push({ name, ok: false, state: "critical", ms: Date.now() - t0, error: String(e?.message || e) });
    }
  };
  await ping("database", async () => {
    const rows = await sb("profiles?select=user_id&limit=1");
    if (!Array.isArray(rows)) throw new Error("profiles read failed");
  });
  await ping("jupiter", async () => {
    const r = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112");
    if (!r.ok) throw new Error(`jupiter ${r.status}`);
  });
  await ping("solana_rpc", async () => {
    const rpc =
      process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com";
    const r = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
    });
    const j = await r.json();
    if (j.result && j.result !== "ok") throw new Error(String(j.result));
    if (j.error) throw new Error(j.error.message || "rpc error");
  });

  let failedToday = 0;
  let lastBurn = null;
  try {
    const today = startOfUtcDay(0);
    const failed = await sb(`ox_admin_ledger?select=id&status=eq.failed&created_at=gte.${today}&limit=200`);
    failedToday = Array.isArray(failed) ? failed.length : 0;
    const burns = await sb("ox_admin_burns?select=created_at,tokens_burned,tx_signature&order=created_at.desc&limit=1");
    lastBurn = Array.isArray(burns) ? burns[0] || null : null;
  } catch {
    /* tables may be missing until migration */
  }

  const worst = checks.some((c) => !c.ok) ? "critical" : failedToday > 20 ? "warning" : "healthy";
  return {
    state: worst,
    checks,
    failedTransactionsToday: failedToday,
    lastVerifiedBurn: lastBurn,
    feeProcessor: "inline (DEX SOL fee attach + Jupiter bps backup)",
    burnProcessor: lastBurn ? "healthy" : "idle",
  };
}

export const OWNER_EVENT_TYPES = [
  "USER_REGISTERED",
  "USER_LOGIN",
  "USER_LOGOUT",
  "USER_ONLINE",
  "USER_OFFLINE",
  "PAGE_VIEW",
  "APP_OPENED",
  "SWAP_STARTED",
  "SWAP_COMPLETED",
  "SWAP_FAILED",
  "JUPITER_TRANSACTION",
  "FEE_COLLECTED",
  "ORBITX_PURCHASED",
  "ORBITX_BURNED",
  "TOKEN_LAUNCHED",
  "REFERRAL_CREATED",
  "COMMUNITY_CREATED",
];

function missingTable(e) {
  return /does not exist|42P01|PGRST205|schema cache|relation/i.test(String(e?.message || e));
}

export async function safeList(sb, path) {
  try {
    const rows = await sb(path);
    return list(rows);
  } catch (e) {
    if (missingTable(e)) return [];
    return [];
  }
}

export async function writeOwnerAudit(sb, row) {
  if (typeof sb !== "function") return null;
  try {
    await sb("ox_admin_audit", {
      method: "POST",
      body: JSON.stringify({
        admin_user_id: row.admin_user_id || null,
        admin_email: row.admin_email || null,
        action: String(row.action || "lookup"),
        target_type: row.target_type || null,
        target_id: row.target_id || null,
        ip: row.ip || null,
        before: row.before || null,
        after: row.after || null,
      }),
      headers: { Prefer: "return=minimal" },
    });
  } catch {
    return null;
  }
  return true;
}

export async function upsertLedger(sb, row) {
  const sig = String(row.tx_signature || "").trim();
  if (!sig) return recordLedger(sb, row);
  const existing = await safeList(
    sb,
    `ox_admin_ledger?tx_signature=eq.${encodeURIComponent(sig)}&select=id,status,verified_onchain&limit=1`,
  );
  if (existing[0]?.id) {
    try {
      await sb(`ox_admin_ledger?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: row.status || existing[0].status,
          verified_onchain: Boolean(row.verified_onchain || existing[0].verified_onchain),
          value_usd: row.value_usd ?? undefined,
          fee_usd_calc: row.fee_usd_calc ?? undefined,
          fee_usd_actual: row.fee_usd_actual ?? undefined,
          fee_cap_applied: row.fee_cap_applied ?? undefined,
          error: row.error || null,
          orbitx_bought: row.orbitx_bought ?? undefined,
          orbitx_burned: row.orbitx_burned ?? undefined,
          burn_signature: row.burn_signature || undefined,
          metadata: row.metadata || undefined,
          updated_at: new Date().toISOString(),
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {
      return null;
    }
    return true;
  }
  return recordLedger(sb, { ...row, tx_signature: sig });
}

export async function searchOwnerUsers(sb, q, limit = 40) {
  const term = String(q || "").trim();
  const n = Math.min(Math.max(Number(limit) || 40, 1), 80);
  if (!term) {
    const live = await safeList(
      sb,
      "ox_admin_presence?select=user_id,username,avatar_url,wallet_address,status,last_heartbeat_at,last_seen_at,current_path,current_app,device,session_id,session_started_at,total_online_ms&order=last_heartbeat_at.desc&limit=80",
    );
    const now = Date.now();
    return live.map((p) => annotatePresence(p, now));
  }
  const like = `*${term.replace(/[,()*]/g, "")}*`;
  let path = `profiles?select=user_id,username,avatar_url,wallet_address,sol_wallet,created_at,xp,current_level,last_seen_at,last_active_at,is_online&or=(username.ilike.${encodeURIComponent(like)},wallet_address.ilike.${encodeURIComponent(like)})&limit=${n}`;
  if (/^[0-9a-f-]{36}$/i.test(term)) {
    path = `profiles?select=user_id,username,avatar_url,wallet_address,sol_wallet,created_at,xp,current_level,last_seen_at,last_active_at,is_online&user_id=eq.${encodeURIComponent(term)}&limit=1`;
  } else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(term)) {
    path = `profiles?select=user_id,username,avatar_url,wallet_address,sol_wallet,created_at,xp,current_level,last_seen_at,last_active_at,is_online&or=(wallet_address.eq.${encodeURIComponent(term)},sol_wallet.eq.${encodeURIComponent(term)})&limit=${n}`;
  }
  const profiles = await safeList(sb, path);
  const ids = profiles.map((p) => p.user_id).filter(Boolean);
  const presence = ids.length
    ? await safeList(
        sb,
        `ox_admin_presence?user_id=in.(${ids.map((id) => encodeURIComponent(id)).join(",")})&select=user_id,status,last_heartbeat_at,last_seen_at,current_path,current_app,device,wallet_address,session_started_at,total_online_ms`,
      )
    : [];
  const byId = Object.fromEntries(presence.map((p) => [p.user_id, p]));
  const now = Date.now();
  return profiles.map((p) => {
    const hit = byId[p.user_id] || {};
    const hb = hit.last_heartbeat_at || p.last_active_at || p.last_seen_at;
    return {
      ...p,
      wallet_address: p.wallet_address || p.sol_wallet || hit.wallet_address || null,
      current_path: hit.current_path || null,
      current_app: hit.current_app || null,
      device: hit.device || null,
      last_heartbeat_at: hb,
      session_started_at: hit.session_started_at || null,
      total_online_ms: Number(hit.total_online_ms || 0),
      ...annotatePresence({ ...hit, last_heartbeat_at: hb }, now),
    };
  });
}

function annotatePresence(p, now = Date.now()) {
  const status = presenceStatus(p?.last_heartbeat_at, now);
  const sessionMs = status === "offline" ? 0 : sessionAgeMs(p?.session_started_at, now);
  return {
    liveStatus: status,
    session_ms: sessionMs,
    session_label: formatClock(sessionMs),
    total_online_ms: Number(p?.total_online_ms || 0),
    total_label: formatClock(Number(p?.total_online_ms || 0)),
  };
}

export async function getOwnerUserHub(sb, userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  const profiles = await safeList(
    sb,
    `profiles?user_id=eq.${encodeURIComponent(uid)}&select=user_id,username,avatar_url,wallet_address,sol_wallet,created_at,xp,current_level,last_seen_at,last_active_at,is_online,bio,referral_code,referred_by&limit=1`,
  );
  const profile = profiles[0] || null;
  if (!profile) return null;
  const [
    presenceRows,
    events,
    activity,
    ledger,
    burns,
    mcpBurns,
  ] = await Promise.all([
    safeList(sb, `ox_admin_presence?user_id=eq.${encodeURIComponent(uid)}&limit=1`),
    safeList(
      sb,
      `ox_admin_events?user_id=eq.${encodeURIComponent(uid)}&select=id,event_type,application,title,metadata,tx_signature,created_at&order=created_at.desc&limit=80`,
    ),
    safeList(
      sb,
      `user_activity?user_id=eq.${encodeURIComponent(uid)}&select=id,activity_type,title,description,data,created_at&order=created_at.desc&limit=40`,
    ),
    safeList(
      sb,
      `ox_admin_ledger?user_id=eq.${encodeURIComponent(uid)}&select=id,tx_signature,application,tx_type,status,value_usd,fee_usd_actual,fee_usd_calc,fee_cap_applied,orbitx_burned,verified_onchain,created_at,error,chain&order=created_at.desc&limit=80`,
    ),
    safeList(
      sb,
      `ox_admin_burns?user_id=eq.${encodeURIComponent(uid)}&select=tokens_burned,value_usd,tx_signature,application,verified_onchain,created_at,source&order=created_at.desc&limit=40`,
    ),
    safeList(
      sb,
      `mcp_burn_ledger?user_id=eq.${encodeURIComponent(uid)}&select=tokens_burned,tx_signature,created_at,package_id&order=created_at.desc&limit=40`,
    ),
  ]);
  const presence = presenceRows[0] || null;
  const completed = ledger.filter((r) => r.status === "completed" && r.verified_onchain);
  const feeOf = (r) => Number(r.fee_usd_actual ?? r.fee_usd_calc ?? 0);
  const verifiedBurns = [...burns.filter((b) => b.verified_onchain !== false), ...mcpBurns];
  const timeline = [
    ...events.map((e) => ({
      at: e.created_at,
      kind: e.event_type,
      title: e.title || e.event_type,
      application: e.application,
      signature: e.tx_signature,
      source: "event",
    })),
    ...activity.map((a) => ({
      at: a.created_at,
      kind: a.activity_type,
      title: a.title || a.activity_type,
      application: a.data?.path || null,
      signature: null,
      source: "activity",
    })),
    ...completed.map((t) => ({
      at: t.created_at,
      kind: t.tx_type,
      title: `${t.tx_type} ${t.value_usd ? `$${Number(t.value_usd).toFixed(2)}` : ""}`.trim(),
      application: t.application,
      signature: t.tx_signature,
      source: "ledger",
    })),
  ]
    .filter((x) => x.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 80);

  return {
    profile: {
      ...profile,
      wallet_address: profile.wallet_address || profile.sol_wallet || presence?.wallet_address || null,
    },
    presence: presence
      ? { ...presence, ...annotatePresence(presence) }
      : {
          ...annotatePresence({ last_heartbeat_at: profile.last_active_at || profile.last_seen_at }),
          last_seen_at: profile.last_seen_at,
        },
    stats: {
      sessions: activity.filter((a) => /session|login/i.test(String(a.activity_type || ""))).length,
      transactions: completed.length,
      jupiter: completed.filter((r) => /swap|jupiter|buy|sell/i.test(String(r.tx_type || ""))).length,
      volumeUsd: completed.reduce((s, r) => s + Number(r.value_usd || 0), 0),
      feesUsd: completed.reduce((s, r) => s + feeOf(r), 0),
      burns: verifiedBurns.reduce((s, b) => s + Number(b.tokens_burned || 0), 0),
      xp: Number(profile.xp || 0),
      hoursOnlineMs: Number(presence?.total_online_ms || 0),
      currentSessionMs:
        presence && presenceStatus(presence.last_heartbeat_at) !== "offline"
          ? sessionAgeMs(presence.session_started_at)
          : 0,
    },
    timeline,
    ledger: completed,
    burns: verifiedBurns,
  };
}

export function deviceFromUserAgent(ua) {
  const s = String(ua || "");
  if (/iPhone|iPad|Android|Mobile/i.test(s)) return "mobile";
  if (/Electron/i.test(s)) return "desktop-app";
  if (s) return "desktop";
  return "unknown";
}
