/**
 * Alert-triggered trades — one-shot conditions, tick evaluates, executes once, never re-fires.
 * Conditions: price_above | price_below | whale_buy_min_usd | volume_spike.
 * Actions: buy_usd | sell_percent | notify_only. Backend signs (desk wallet). No popup.
 */
import { needAuth, sb, tokenInfo, appWalletBuy, appWalletSell } from "./_mcp-app-wallet.js";
import { evmTrades } from "../../ogdex/_evm.js";

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ALERT_TYPES = ["price_above", "price_below", "whale_buy_min_usd", "volume_spike"];
const ALERT_ACTIONS = ["buy_usd", "sell_percent", "notify_only"];
const WHALE_WINDOW_MS = 65 * 60 * 1000;

/** Deepest-liquidity solana pair for a mint, or null. tokenInfo has no volume, so go direct. */
async function deepestPair(mint) {
  const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + mint, { signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  const pairs = (j.pairs || []).filter((x) => String(x.chainId || "").toLowerCase() === "solana");
  pairs.sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0));
  return pairs[0] || null;
}

function pairVolume24h(p) {
  return Number(p?.volume?.h24 || 0);
}

function condText(type, value) {
  switch (type) {
    case "price_above": return `price ≥ $${value}`;
    case "price_below": return `price ≤ $${value}`;
    case "whale_buy_min_usd": return `a whale buys ≥ $${value}`;
    case "volume_spike": return `24h volume ≥ ${value}x baseline`;
    default: return `${type} ${value}`;
  }
}

function actionText(action, actionValue) {
  if (action === "buy_usd") return `buy $${actionValue}`;
  if (action === "sell_percent") return `sell ${actionValue}%`;
  return "notify only";
}

function alertSummary(r) {
  const m = r.meta || {};
  return {
    id: r.id,
    mint: m.mint || r.mint,
    symbol: m.symbol || r.symbol,
    type: m.condType,
    condition: condText(m.condType, m.condValue),
    action: m.action,
    actionDesc: actionText(m.action, m.actionValue),
    status: m.status || "open",
    attempts: Number(m.attempts || 0),
    note: m.note || null,
    createdAt: m.createdAt || r.created_at,
    triggeredAt: m.triggeredAt || null,
  };
}

export async function orbitxAppAlert(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const mint = String(args.mint || args.ca || "").trim();
  if (!MINT_RE.test(mint)) return { ok: false, error: "bad_mint", message: "Invalid Solana mint." };
  const type = String(args.type || "").trim().toLowerCase();
  if (!ALERT_TYPES.includes(type)) {
    return { ok: false, error: "bad_type", message: `type must be one of: ${ALERT_TYPES.join(", ")}` };
  }
  const action = String(args.action || "").trim().toLowerCase();
  if (!ALERT_ACTIONS.includes(action)) {
    return { ok: false, error: "bad_action", message: `action must be one of: ${ALERT_ACTIONS.join(", ")}` };
  }
  const value = Number(args.value);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: "bad_value", message: "value must be a number > 0 (USD price target, whale USD, or volume multiplier)." };
  }
  const note = args.note != null ? String(args.note).slice(0, 140) : null;
  let actionValue = null;
  if (action !== "notify_only") {
    const av = Number(args.actionValue);
    if (!Number.isFinite(av)) return { ok: false, error: "need_action_value", message: `action "${action}" needs actionValue.` };
    if (action === "buy_usd" && (av < 0.5 || av > 1000)) {
      return { ok: false, error: "bad_action_value", message: "Buy size must be $0.5–$1000." };
    }
    if (action === "sell_percent" && (av < 1 || av > 100)) {
      return { ok: false, error: "bad_action_value", message: "Sell percent must be 1–100." };
    }
    actionValue = av;
  }
  const info = await tokenInfo(mint);
  let baselineVol = null;
  if (type === "volume_spike") {
    try {
      baselineVol = pairVolume24h(await deepestPair(mint));
    } catch { /* fall through to check below */ }
    if (!Number.isFinite(baselineVol) || baselineVol <= 0) {
      return { ok: false, error: "baseline_unavailable", message: `No 24h volume baseline available for ${info.symbol}. volume_spike cannot be armed right now.` };
    }
  }
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable", message: "Alert could not be armed — store unreachable. Retry in a minute." };
  const now = new Date().toISOString();
  const meta = {
    mint, symbol: info.symbol, condType: type, condValue: value,
    ...(baselineVol != null ? { baselineVol } : {}),
    action, ...(actionValue != null ? { actionValue } : {}), note,
    status: "open", attempts: 0, createdAt: now,
  };
  const { data, error } = await client.from("ox_live_events").insert({
    kind: "app_alert",
    agent_id: gate.userId,
    mint,
    symbol: info.symbol,
    side: action === "sell_percent" ? "sell" : action === "buy_usd" ? "buy" : null,
    thesis: `alert ${type} ${info.symbol}`,
    meta,
  }).select("id,meta,created_at,mint,symbol").single();
  if (error || !data) return { ok: false, error: "db_write_failed", message: "Alert could not be armed." };
  return {
    ok: true,
    alert: alertSummary(data),
    message: `Alert armed: when ${condText(type, value)} on ${info.symbol} → ${actionText(action, actionValue)}. One-shot.`,
  };
}

export async function orbitxAppAlertsList(auth) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: true, alerts: [] };
  const { data } = await client.from("ox_live_events")
    .select("id,meta,created_at,mint,symbol").eq("kind", "app_alert").eq("agent_id", gate.userId)
    .order("created_at", { ascending: false }).limit(40);
  return { ok: true, alerts: (data || []).map(alertSummary) };
}

export async function orbitxAppAlertCancel(auth, args = {}) {
  const gate = needAuth(auth);
  if (!gate.userId) return gate;
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const idArg = String(args.id || args.alertId || "").trim();
  const mintArg = String(args.mint || args.ca || "").trim();
  if (!idArg && !mintArg) {
    return { ok: false, error: "need_target", message: "Pass id (from orbitx_app_alerts_list) or mint." };
  }
  const { data } = await client.from("ox_live_events")
    .select("id,meta").eq("kind", "app_alert").eq("agent_id", gate.userId).limit(100);
  const targets = (data || []).filter((r) => {
    if ((r.meta?.status || "open") !== "open") return false;
    if (idArg) return String(r.id) === idArg;
    return String(r.meta?.mint || "") === mintArg;
  });
  if (!targets.length) return { ok: false, error: "not_found", message: "No open alert matches." };
  const now = new Date().toISOString();
  for (const t of targets) {
    try {
      await client.from("ox_live_events").update({ meta: { ...(t.meta || {}), status: "cancelled", cancelledAt: now } }).eq("id", t.id);
    } catch { /* best-effort */ }
  }
  return { ok: true, cancelled: targets.map((t) => ({ id: t.id, mint: t.meta?.mint, symbol: t.meta?.symbol, type: t.meta?.condType })) };
}

/** Whale check: any buy ≥ condValue USD on the deepest solana pair in the last 65 min. */
async function whaleHit(mint, condValue) {
  const p = await deepestPair(mint);
  if (!p?.pairAddress) return { ok: false, note: "no pair found for whale scan" };
  const trades = await evmTrades("solana", p.pairAddress, mint, 50);
  const now = Date.now();
  const hit = (trades || []).find((t) => {
    const side = String(t.side || t.kind || "").toLowerCase();
    if (side !== "buy") return false;
    if (!Number.isFinite(Number(t.volumeUsd)) || Number(t.volumeUsd) < Number(condValue)) return false;
    const ts = t.time ? Date.parse(t.time) : NaN;
    return Number.isFinite(ts) && now - ts <= WHALE_WINDOW_MS;
  });
  return { ok: !!hit, trade: hit || null };
}

async function evaluate(m, client) {
  const mint = m.mint;
  const type = m.condType;
  if (type === "price_above" || type === "price_below") {
    const info = await tokenInfo(mint); // throws → caller skips row, no attempt burned
    if (!info.priceUsd) return { hit: false };
    const target = Number(m.condValue);
    return { hit: type === "price_above" ? info.priceUsd >= target : info.priceUsd <= target, price: info.priceUsd };
  }
  if (type === "volume_spike") {
    const p = await deepestPair(mint);
    const cur = pairVolume24h(p);
    if (!cur) return { hit: false };
    return { hit: cur >= Number(m.baselineVol || 0) * Number(m.condValue), price: null, curVol: cur };
  }
  if (type === "whale_buy_min_usd") {
    return await whaleHit(mint, m.condValue); // throws → caller skips with note
  }
  return { hit: false };
}

export async function tickUserAlerts(userId, ctx) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const { data } = await client.from("ox_live_events")
    .select("id,meta").eq("kind", "app_alert").eq("agent_id", userId)
    .order("created_at", { ascending: false }).limit(100);
  const triggered = [];
  let checked = 0;
  for (const r of data || []) {
    const m = r.meta || {};
    if ((m.status || "open") !== "open") continue;
    if (!m.mint || !m.condType || m.condValue == null) continue;
    checked += 1;
    let res;
    try {
      res = await evaluate(m, client);
    } catch (e) {
      // Feed exception — skip row, no attempt burned. Record a best-effort note.
      try {
        await client.from("ox_live_events").update({ meta: { ...m, lastCheckAt: new Date().toISOString(), lastNote: String(e?.message || "eval_error").slice(0, 120) } }).eq("id", r.id);
      } catch { /* best-effort */ }
      continue;
    }
    if (!res || !res.hit) continue;
    // ── Triggered: one-shot execution ──
    const auth = { userId };
    let result;
    try {
      if (m.action === "buy_usd") {
        result = await appWalletBuy(auth, { mint: m.mint, usd: m.actionValue });
      } else if (m.action === "sell_percent") {
        result = await appWalletSell(auth, { mint: m.mint, percent: m.actionValue });
      } else {
        result = { ok: true, notified: true };
      }
    } catch (e) {
      result = { ok: false, error: "action_threw", message: e?.message || String(e) };
    }
    const now = new Date().toISOString();
    const summary = {
      id: r.id, mint: m.mint, symbol: m.symbol, type: m.condType,
      condition: condText(m.condType, m.condValue),
      action: m.action, actionDesc: actionText(m.action, m.actionValue),
      triggerPrice: res.price || null,
      result: { ok: !!result?.ok, signature: result?.signature || null, error: result?.error || null, message: result?.message || null },
    };
    const patch = {
      ...m,
      status: "triggered",
      triggeredAt: now,
      triggerPrice: res.price || null,
      ...(res.trade ? { triggerTrade: { volumeUsd: res.trade.volumeUsd, txHash: res.trade.txHash, time: res.trade.time } } : {}),
      ...(res.curVol != null ? { triggerVol: res.curVol } : {}),
      lastResult: { action: m.action, ok: !!result?.ok, signature: result?.signature || null, error: result?.error || null, message: result?.message || null },
    };
    try {
      await client.from("ox_live_events").update({ meta: patch }).eq("id", r.id);
    } catch { /* trigger status write is best-effort; execution already happened or failed */ }
    triggered.push(summary);
    try {
      const mod = await import("./_mcp-telegram-push.js");
      await mod.pushMcpResultToTelegram?.({ userId, tool: "orbitx_app_alert", result: summary, source: "alert_tick" });
    } catch { /* best-effort push */ }
  }
  return { ok: true, checked, triggered };
}

/** Sweep every user that has alert rows. Per-user failures never stop the sweep. */
export async function tickAllAlerts({ maxUsers = 200 } = {}) {
  const client = await sb();
  if (!client) return { ok: false, error: "db_unavailable" };
  const { data } = await client.from("ox_live_events").select("agent_id").eq("kind", "app_alert").limit(2000);
  const users = [...new Set((data || []).map((r) => r.agent_id).filter(Boolean))].slice(0, maxUsers);
  const results = [];
  for (const userId of users) {
    try {
      const r = await tickUserAlerts(userId);
      if ((r.triggered || []).length || !r.ok) results.push({ userId, ...r });
    } catch (e) {
      results.push({ userId, ok: false, error: e?.message || String(e) });
    }
  }
  return { ok: true, users: users.length, active: results.length, results };
}

export async function dispatchAlertTools(name, args, auth) {
  if (name === "orbitx_app_alert") return orbitxAppAlert(auth, args || {});
  if (name === "orbitx_app_alerts_list") return orbitxAppAlertsList(auth);
  if (name === "orbitx_app_alert_cancel") return orbitxAppAlertCancel(auth, args || {});
  return null;
}

const authCode = { type: "string" };

export const ALERT_TOOLS = [
  {
    name: "orbitx_app_alert",
    description: "Arm a one-shot alert that auto-trades when it fires. type: price_above|price_below (USD price target), whale_buy_min_usd (single whale buy ≥ value USD in last ~65 min), volume_spike (24h volume ≥ value × current baseline). action: buy_usd (actionValue $0.5–1000), sell_percent (actionValue 1–100), notify_only. Backend signs the trade when the condition hits; the alert fires once, never again.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Solana token mint" },
        type: { type: "string", enum: ALERT_TYPES },
        value: { type: "number", description: "USD price target | min whale buy USD | volume multiplier (e.g. 3 = 3x baseline)" },
        action: { type: "string", enum: ALERT_ACTIONS },
        actionValue: { type: "number", description: "Buy USD (0.5–1000) or sell percent (1–100). Not needed for notify_only." },
        note: { type: "string", description: "Optional label for the alert" },
        authCode,
      },
      required: ["mint", "type", "value", "action"],
    },
  },
  {
    name: "orbitx_app_alerts_list",
    description: "List your armed and fired alerts (open, triggered, cancelled) with ids and human-readable conditions.",
    inputSchema: { type: "object", properties: { authCode } },
  },
  {
    name: "orbitx_app_alert_cancel",
    description: "Cancel an open alert. Pass id (from orbitx_app_alerts_list) or mint to cancel all open alerts for that mint.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, mint: { type: "string" }, authCode } },
  },
];
