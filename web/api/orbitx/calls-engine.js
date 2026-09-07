/**
 * Admin Calls desk engine — the /on-chain live desk, posted to Telegram.
 * Alert-only. Same NEON / WARDEN / RAID tape as the dashboard.
 */
import { createClient } from "@supabase/supabase-js";
import { adminCredentialOk } from "../../shared/desk-unlock.js";
import {
  LIVE_AGENTS,
  rankForLiveStyle,
} from "../../shared/orbitx-live-desk.js";
import {
  applyMark,
  buildCallAnalysis,
  CALLS_COOLDOWN_HOURS,
  CALLS_MAX_PER_TICK,
  CALLS_WIN_MULTIPLE,
  chatFromTelegramUpdate,
  emptyCallsDesk,
  formatCallTelegram,
  formatDeskLinkedTelegram,
  formatLiveFeedTelegram,
  formatMarkUpdate,
  maskBotToken,
  nextCallsAgent,
  parseChannelRef,
  pickCallCandidates,
  publicDesk,
  publicWebhookUrl,
  unpublishedLiveFeed,
  stillCooling,
  writeCallThesis,
} from "../../shared/orbitx-calls-desk.js";
import { snapshotLiveDesk } from "./live-agent-engine.js";
import { CALLS_DDL, CALLS_PROJECT_REF } from "./calls-schema.js";

const DEX = "https://api.dexscreener.com/latest/dex";
const TG = "https://api.telegram.org";
const KV_BUCKET = "ogdex-kv";
const KV_PATH = "ox-calls/state.json";
const TG_ALLOWED_UPDATES = ["message", "edited_message", "channel_post", "edited_channel_post", "my_chat_member", "chat_member"];
let _storeMode = null;
let _applyTried = false;
let _webhookTried = false;

function trim(v) {
  return String(v || "").trim();
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function adminCallsOk(provided, env = process.env) {
  return adminCredentialOk(provided, env);
}

export function adminSb(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function siteOrigin(env = process.env) {
  return trim(env.ORBITX_PUBLIC_URL || env.VITE_PUBLIC_SITE_URL || "https://www.orbitx.world") || "https://www.orbitx.world";
}

async function tg(token, method, body) {
  const r = await fetch(`${TG}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(12_000),
  });
  return r.json().catch(() => ({ ok: false }));
}

function tableMissing(error) {
  const m = `${error?.code || ""} ${error?.message || ""}`;
  return error?.code === "42P01" || /does not exist|schema cache|Could not find the table/i.test(m);
}

function envUrl(env = process.env) {
  return trim(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
}

function envSrk(env = process.env) {
  return trim(env.SUPABASE_SERVICE_ROLE_KEY);
}

async function kvGetState(env = process.env) {
  const url = envUrl(env);
  const key = envSrk(env);
  if (!url || !key) return { desk: { id: "main" }, chats: [], ledger: [] };
  const r = await fetch(`${url}/storage/v1/object/${KV_BUCKET}/${KV_PATH}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) return { desk: { id: "main" }, chats: [], ledger: [] };
  const j = await r.json().catch(() => null);
  if (!j || typeof j !== "object") return { desk: { id: "main" }, chats: [], ledger: [] };
  return {
    desk: j.desk && typeof j.desk === "object" ? j.desk : { id: "main" },
    chats: Array.isArray(j.chats) ? j.chats : [],
    ledger: Array.isArray(j.ledger) ? j.ledger : [],
  };
}

async function kvPutState(state, env = process.env) {
  const url = envUrl(env);
  const key = envSrk(env);
  if (!url || !key) throw new Error("supabase_unconfigured");
  await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: KV_BUCKET, name: KV_BUCKET, public: false }),
  }).catch(() => {});
  const r = await fetch(`${url}/storage/v1/object/${KV_BUCKET}/${KV_PATH}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "x-upsert": "true",
    },
    body: JSON.stringify(state),
  });
  if (!r.ok) throw new Error(`kv_put ${r.status}`);
}

async function storeMode(sb) {
  if (sb?._tables) return "sql";
  if (_storeMode) return _storeMode;
  const { error } = await sb.from("ox_calls_desk").select("id").eq("id", "main").maybeSingle();
  _storeMode = error && tableMissing(error) ? "kv" : "sql";
  return _storeMode;
}

async function applyViaExecSql(env) {
  const url = envUrl(env);
  const key = envSrk(env);
  if (!url || !key) return null;
  const r = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql_text: CALLS_DDL }),
  });
  if (!r.ok) return { ok: false, status: r.status, error: (await r.text()).slice(0, 240), via: "exec_sql" };
  return { ok: true, via: "exec_sql" };
}

async function applyViaManagementApi(env) {
  const token = trim(env.SUPABASE_ACCESS_TOKEN);
  const ref = trim(env.SUPABASE_PROJECT_REF || CALLS_PROJECT_REF);
  if (!token) return { ok: false, error: "no_access_token", via: "kv_fallback" };
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: CALLS_DDL }),
  });
  const txt = await r.text();
  if (!r.ok) return { ok: false, error: txt.slice(0, 400), via: "management_api", status: r.status };
  return { ok: true, via: "management_api" };
}

export async function applyCallsSql(env = process.env) {
  const rpc = await applyViaExecSql(env);
  if (rpc?.ok) {
    _storeMode = "sql";
    return rpc;
  }
  const mgmt = await applyViaManagementApi(env);
  if (mgmt.ok) {
    _storeMode = "sql";
    return mgmt;
  }
  return {
    ok: false,
    error: mgmt.error || rpc?.error || "apply_failed",
    via: "kv_fallback",
    tried: [rpc?.via, mgmt.via].filter(Boolean),
  };
}

async function loadDesk(sb, env = process.env) {
  if ((await storeMode(sb)) === "kv") {
    const st = await kvGetState(env);
    return st.desk || { id: "main" };
  }
  const { data, error } = await sb.from("ox_calls_desk").select("*").eq("id", "main").maybeSingle();
  if (error && tableMissing(error)) {
    _storeMode = "kv";
    return loadDesk(sb, env);
  }
  if (error) throw new Error(error.message);
  return data || { id: "main" };
}

async function upsertDesk(sb, patch, env = process.env) {
  const cur = await loadDesk(sb, env).catch(() => ({ id: "main" }));
  const row = { ...cur, id: "main", ...patch, updated_at: new Date().toISOString() };
  if ((await storeMode(sb)) === "kv") {
    const st = await kvGetState(env);
    st.desk = row;
    await kvPutState(st, env);
    return row;
  }
  const { error } = await sb.from("ox_calls_desk").upsert(row, { onConflict: "id" });
  if (error && tableMissing(error)) {
    _storeMode = "kv";
    return upsertDesk(sb, patch, env);
  }
  if (error) throw new Error(error.message);
  return row;
}

async function loadChats(sb, env = process.env) {
  if ((await storeMode(sb)) === "kv") {
    const st = await kvGetState(env);
    return [...(st.chats || [])].sort((a, b) => String(b.last_seen_at || "").localeCompare(String(a.last_seen_at || "")));
  }
  const { data, error } = await sb.from("ox_calls_chats").select("*").order("last_seen_at", { ascending: false });
  if (error && tableMissing(error)) {
    _storeMode = "kv";
    return loadChats(sb, env);
  }
  return data || [];
}

async function loadCalls(sb, limit = 80, env = process.env) {
  if ((await storeMode(sb)) === "kv") {
    const st = await kvGetState(env);
    return (st.ledger || []).slice(0, limit);
  }
  const { data, error } = await sb.from("ox_calls_ledger").select("*").order("called_at", { ascending: false }).limit(limit);
  if (error && tableMissing(error)) {
    _storeMode = "kv";
    return loadCalls(sb, limit, env);
  }
  return data || [];
}

async function upsertChat(sb, row, env = process.env) {
  const next = { ...row, last_seen_at: new Date().toISOString() };
  if ((await storeMode(sb)) === "kv") {
    const st = await kvGetState(env);
    const i = st.chats.findIndex((c) => String(c.chat_id) === String(next.chat_id));
    if (i >= 0) st.chats[i] = { ...st.chats[i], ...next };
    else st.chats.push(next);
    await kvPutState(st, env);
    return;
  }
  const { error } = await sb.from("ox_calls_chats").upsert(next, { onConflict: "chat_id" });
  if (error && tableMissing(error)) {
    _storeMode = "kv";
    return upsertChat(sb, row, env);
  }
  if (error) throw new Error(error.message);
}

async function insertCall(sb, row, env = process.env) {
  const rec = { id: row.id || crypto.randomUUID(), ...row };
  if ((await storeMode(sb)) === "kv") {
    const st = await kvGetState(env);
    st.ledger = [rec, ...(st.ledger || [])].slice(0, 400);
    await kvPutState(st, env);
    return rec;
  }
  const { data, error } = await sb.from("ox_calls_ledger").insert(row).select("*").single();
  if (error && tableMissing(error)) {
    _storeMode = "kv";
    return insertCall(sb, row, env);
  }
  if (error) throw new Error(error.message);
  return data || rec;
}

async function updateCall(sb, id, patch, env = process.env) {
  if ((await storeMode(sb)) === "kv") {
    const st = await kvGetState(env);
    const rec = st.ledger.find((c) => c.id === id);
    if (rec) Object.assign(rec, patch);
    await kvPutState(st, env);
    return;
  }
  const { error } = await sb.from("ox_calls_ledger").update(patch).eq("id", id);
  if (error && tableMissing(error)) {
    _storeMode = "kv";
    return updateCall(sb, id, patch, env);
  }
  if (error) throw new Error(error.message);
}

async function ensureCallsWebhook(desk, env = process.env) {
  if (!desk?.bot_token || !desk.webhook_secret) return;
  await tg(desk.bot_token, "setWebhook", {
    url: publicWebhookUrl(siteOrigin(env)),
    secret_token: desk.webhook_secret,
    allowed_updates: TG_ALLOWED_UPDATES,
    drop_pending_updates: false,
  }).catch(() => {});
}

export async function snapshotCallsDesk({ sb: sbIn, env = process.env } = {}) {
  const sb = sbIn || adminSb(env);
  if (!sb) return { ...emptyCallsDesk(), error: "supabase_unconfigured" };
  try {
    if (!sb._tables && !_applyTried) {
      _applyTried = true;
      await applyCallsSql(env).catch(() => ({ ok: false }));
    }
    const [desk, chats, calls] = await Promise.all([loadDesk(sb, env), loadChats(sb, env), loadCalls(sb, 80, env)]);
    if (!sb._tables && !_webhookTried && desk.bot_token) {
      _webhookTried = true;
      await ensureCallsWebhook(desk, env);
    }
    const snap = publicDesk(desk, chats, calls);
    snap.store = (await storeMode(sb)) === "kv" ? "kv" : "sql";
    return snap;
  } catch (e) {
    return { ...emptyCallsDesk(), error: e.message || String(e) };
  }
}

export async function connectCallsBot({ token, sb: sbIn, env = process.env } = {}) {
  const sb = sbIn || adminSb(env);
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  const botToken = trim(token);
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(botToken)) return { ok: false, error: "invalid_bot_token" };
  const me = await tg(botToken, "getMe", {});
  if (!me?.ok || !me.result?.username) return { ok: false, error: me?.description || "getMe_failed" };
  const secret = crypto.randomUUID().replace(/-/g, "");
  const hook = publicWebhookUrl(siteOrigin(env));
  const set = await tg(botToken, "setWebhook", {
    url: hook,
    secret_token: secret,
    allowed_updates: TG_ALLOWED_UPDATES,
    drop_pending_updates: false,
  });
  if (!set?.ok) return { ok: false, error: set?.description || "setWebhook_failed" };
  await upsertDesk(sb, {
    bot_token: botToken,
    bot_username: me.result.username,
    bot_id: String(me.result.id),
    bot_name: me.result.first_name || me.result.username,
    webhook_secret: secret,
    armed: true,
    last_error: null,
  });
  return {
    ok: true,
    bot_username: me.result.username,
    bot_name: me.result.first_name,
    webhook: hook,
    token_masked: maskBotToken(botToken),
  };
}

export async function disconnectCallsBot({ sb: sbIn, env = process.env } = {}) {
  const sb = sbIn || adminSb(env);
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  const desk = await loadDesk(sb);
  if (desk.bot_token) await tg(desk.bot_token, "deleteWebhook", { drop_pending_updates: true }).catch(() => {});
  await upsertDesk(sb, {
    bot_token: null,
    bot_username: null,
    bot_id: null,
    bot_name: null,
    webhook_secret: null,
    armed: false,
  });
  return { ok: true };
}

export async function linkCallsChannel({ raw, sb: sbIn } = {}) {
  const sb = sbIn || adminSb();
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  const desk = await loadDesk(sb);
  if (!desk.bot_token) return { ok: false, error: "connect_bot_first" };
  const parsed = parseChannelRef(raw);
  if (!parsed) return { ok: false, error: "paste_@channel_or_chat_id" };
  const chatId = parsed.chatId || `@${parsed.username}`;
  const gc = await tg(desk.bot_token, "getChat", { chat_id: chatId });
  if (!gc?.ok) return { ok: false, error: gc?.description || "getChat_failed" };
  const id = String(gc.result.id);
  const title = gc.result.title || gc.result.username || id;
  const username = gc.result.username || parsed.username || null;
  const type = gc.result.type || "channel";
  let members = null;
  const cnt = await tg(desk.bot_token, "getChatMemberCount", { chat_id: id }).catch(() => null);
  if (cnt?.ok) members = cnt.result;
  await upsertDesk(sb, {
    channel_id: id,
    channel_title: title,
    channel_username: username,
  });
  await upsertChat(sb, {
    chat_id: id,
    title,
    username,
    chat_type: type,
    members,
    status: "member",
    is_channel_target: true,
  });
  return { ok: true, channel_id: id, channel_title: title, channel_username: username, members };
}

export async function unlinkCallsChannel({ sb: sbIn } = {}) {
  const sb = sbIn || adminSb();
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  await upsertDesk(sb, { channel_id: null, channel_title: null, channel_username: null });
  return { ok: true };
}

export async function saveCallsSettings({ patch = {}, sb: sbIn } = {}) {
  const sb = sbIn || adminSb();
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  const next = {};
  if (patch.armed != null) next.armed = Boolean(patch.armed);
  if (patch.broadcast_groups != null) next.broadcast_groups = Boolean(patch.broadcast_groups);
  if (patch.max_calls_per_tick != null) next.max_calls_per_tick = Math.max(1, Math.min(5, num(patch.max_calls_per_tick, 2)));
  if (patch.cooldown_hours != null) next.cooldown_hours = Math.max(1, Math.min(72, num(patch.cooldown_hours, 12)));
  if (patch.win_multiple != null) next.win_multiple = Math.max(1.1, Math.min(5, num(patch.win_multiple, 1.5)));
  await upsertDesk(sb, next);
  return { ok: true };
}

export async function ingestCallsHook({ body, secret, sb: sbIn, send, live } = {}) {
  const sb = sbIn || adminSb();
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  const desk = await loadDesk(sb);
  if (desk.webhook_secret && secret && secret !== desk.webhook_secret) return { ok: false, error: "bad_secret" };
  const row = chatFromTelegramUpdate(body || {});
  if (!row) return { ok: true, ignored: true };
  await upsertChat(sb, row);
  const patch = { armed: true, last_error: null };
  if (!desk.channel_id && row.status === "member" && row.chat_type !== "private") {
    patch.channel_id = row.chat_id;
    patch.channel_title = row.title;
    patch.channel_username = row.username;
  }
  await upsertDesk(sb, patch);
  let pushed = null;
  if (row.status === "member" && desk.bot_token) {
    const sendFn = send || ((token, method, payload) => tg(token, method, payload));
    await sendFn(desk.bot_token, "sendMessage", {
      chat_id: row.chat_id,
      text: formatDeskLinkedTelegram(),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }).catch(() => {});
    pushed = await pushLiveDeskToTelegram({
      sb,
      send: sendFn,
      live,
      catchUp: 3,
      force: true,
    }).catch((e) => ({ ok: false, error: e.message || String(e) }));
  }
  return { ok: true, chat_id: row.chat_id, status: row.status, telegram: pushed };
}

async function dexMarks(mints) {
  const ids = [...new Set((mints || []).filter(Boolean))].slice(0, 30);
  if (!ids.length) return new Map();
  const out = new Map();
  try {
    const r = await fetch(`${DEX}/tokens/${ids.join(",")}`, { signal: AbortSignal.timeout(10_000) });
    const j = await r.json();
    const pairs = j?.pairs || [];
    for (const p of pairs) {
      if (p?.chainId !== "solana") continue;
      const mint = p.baseToken?.address;
      if (!mint) continue;
      const prev = out.get(mint);
      const liq = num(p.liquidity?.usd);
      if (prev && num(prev.liq) >= liq) continue;
      out.set(mint, {
        market_cap: num(p.marketCap || p.fdv),
        price_usd: num(p.priceUsd),
        liq,
      });
    }
  } catch {
    /* ignore */
  }
  return out;
}

async function refreshMarks(sb, desk, calls, { post = false, send } = {}) {
  const openish = (calls || []).filter((c) => c.status !== "lost");
  const marks = await dexMarks(openish.map((c) => c.mint));
  const sendFn = send || ((token, method, body) => tg(token, method, body));
  let updated = 0;
  for (const call of openish) {
    const mark = marks.get(call.mint);
    if (!mark || !(mark.market_cap > 0)) continue;
    const next = applyMark(call, mark, Date.now());
    await updateCall(sb, call.id, {
      mc_now: next.mc_now,
      mc_ath: next.mc_ath,
      mc_atl: next.mc_atl,
      price_now: next.price_now,
      ath_at: next.ath_at,
      atl_at: next.atl_at,
      multiple_now: next.multiple_now,
      multiple_ath: next.multiple_ath,
      status: next.status,
      resolved_at: next.resolved_at || call.resolved_at,
    });
    updated += 1;
    Object.assign(call, next);
    const flipped = call.status !== next.status && (next.status === "won" || next.status === "lost");
    const doubled = num(next.multiple_now) >= 2 && num(call.multiple_now) < 2;
    if (post && desk.bot_token && (flipped || doubled) && desk.channel_id) {
      await sendFn(desk.bot_token, "sendMessage", {
        chat_id: desk.channel_id,
        text: formatMarkUpdate(next),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }).catch(() => {});
    }
  }
  return updated;
}

function deliveryTargets(desk, chats) {
  const ids = new Set();
  if (desk.channel_id) ids.add(String(desk.channel_id));
  for (const c of chats || []) {
    if (c.status === "left" || c.status === "kicked") continue;
    if (desk.broadcast_groups === false && String(c.chat_id) !== String(desk.channel_id) && c.chat_type !== "channel") {
      continue;
    }
    ids.add(String(c.chat_id));
  }
  return [...ids];
}

async function postHtml(send, token, chatId, text) {
  return send(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  }).catch(() => ({ ok: false }));
}

export async function pushLiveDeskToTelegram(opts = {}) {
  const sb = opts.sb || adminSb();
  const send = opts.send || ((token, method, body) => tg(token, method, body));
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  const desk = await loadDesk(sb);
  if (!desk.bot_token) return { ok: false, skipped: "connect_bot_first" };
  if (opts.ensureArmed && desk.armed === false) {
    desk.armed = true;
    await upsertDesk(sb, { armed: true }).catch(() => {});
  }
  if (desk.armed === false && !opts.force) return { ok: true, skipped: "not_armed", posted: 0 };
  if (!sb._tables && !_webhookTried) {
    _webhookTried = true;
    await ensureCallsWebhook(desk);
  }
  const chats = await loadChats(sb);
  const targets = deliveryTargets(desk, chats);
  if (!targets.length) {
    await upsertDesk(sb, { last_error: "add_bot_to_a_group_or_channel", last_tick_at: new Date().toISOString() }).catch(() => {});
    return { ok: true, skipped: "no_destination", posted: 0, targets: 0 };
  }
  const live =
    opts.live !== undefined
      ? opts.live
      : await snapshotLiveDesk({ skipChain: true }).catch(() => ({ feed: [] }));
  const catchUp = opts.catchUp != null ? num(opts.catchUp, 3) : desk.last_posted_at ? 8 : 3;
  const rows = unpublishedLiveFeed(live?.feed || [], desk.last_posted_at, catchUp);
  const actions = [];
  let lastAt = desk.last_posted_at;
  for (const row of rows) {
    const text = formatLiveFeedTelegram(row, { wallet: live?.wallet });
    const posts = [];
    if (!opts.dryRun) {
      for (const chatId of targets) {
        const sent = await postHtml(send, desk.bot_token, chatId, text);
        if (sent?.ok) posts.push({ chat_id: String(chatId), message_id: sent.result?.message_id });
      }
    }
    actions.push({ type: "feed", kind: row.kind, mint: row.mint, symbol: row.symbol, posts: posts.length, id: row.id });
    const at = row.at || row.created_at;
    if (at && (!lastAt || Date.parse(at) >= Date.parse(lastAt))) lastAt = at;
    if (row.kind === "buy" && row.mint) {
      const calls = await loadCalls(sb, 40);
      if (!stillCooling(calls, row.mint)) {
        await insertCall(sb, {
          mint: row.mint,
          symbol: row.symbol,
          name: row.symbol,
          url: row.mint ? `https://www.orbitx.world/on-chain/token/${row.mint}` : null,
          agent_id: row.agent_id,
          agent_name: row.agent_name,
          thesis: row.text || row.thesis,
          analysis: { source: "on-chain-live", kind: row.kind, signature: row.signature },
          mc_at_call: null,
          mc_ath: null,
          mc_atl: null,
          mc_now: null,
          status: "open",
          called_at: at || new Date().toISOString(),
          telegram_posts: posts,
        }).catch(() => {});
      }
    }
  }
  await upsertDesk(sb, {
    last_tick_at: new Date().toISOString(),
    last_error: actions.length || targets.length ? null : "add_bot_to_a_group_or_channel",
    last_posted_at: lastAt || desk.last_posted_at,
    last_agent_id: live?.feed?.[0]?.agent_id || desk.last_agent_id,
  });
  return { ok: true, posted: actions.length, targets: targets.length, actions, skipped: actions.length ? null : "live_feed_quiet" };
}

export async function tickCallsDesk(opts = {}) {
  const sb = opts.sb || adminSb();
  const send = opts.send || ((token, method, body) => tg(token, method, body));
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  let desk;
  try {
    desk = await loadDesk(sb);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
  const calls = await loadCalls(sb, 200);
  let marked = 0;
  try {
    marked = await refreshMarks(sb, desk, calls, { post: Boolean(desk.bot_token) && desk.armed !== false, send });
  } catch (e) {
    await upsertDesk(sb, { last_error: e.message || String(e), last_tick_at: new Date().toISOString() }).catch(() => {});
  }

  const live =
    opts.live !== undefined
      ? opts.live
      : await snapshotLiveDesk({ sb, skipChain: true }).catch(() => ({ feed: [] }));
  const pushed = await pushLiveDeskToTelegram({
    sb,
    send,
    live,
    force: opts.force,
    dryRun: opts.dryRun,
  });
  const actions = [...(pushed.actions || [])];

  if (typeof opts.tape === "function" && desk.bot_token && (desk.armed !== false || opts.force)) {
    const agent = nextCallsAgent(desk.last_agent_id);
    const chats = await loadChats(sb);
    const tape = await Promise.resolve().then(() => opts.tape()).catch(() => []);
    const ranked = rankForLiveStyle(agent?.style || "momentum", tape || []);
    const picks = pickCallCandidates(ranked, agent, calls, {
      max_calls_per_tick: desk.max_calls_per_tick || CALLS_MAX_PER_TICK,
      cooldown_hours: desk.cooldown_hours || CALLS_COOLDOWN_HOURS,
    });
    const targets = deliveryTargets(desk, chats);
    for (const pick of picks) {
      const { coin, screen } = pick;
      const thesis = writeCallThesis(agent, coin, screen);
      const analysis = buildCallAnalysis(coin, screen, agent);
      const row = {
        mint: coin.mint,
        symbol: coin.symbol,
        name: coin.name || coin.symbol,
        url: coin.url || `https://dexscreener.com/solana/${coin.mint}`,
        agent_id: agent?.id,
        agent_name: agent?.name,
        thesis,
        analysis,
        mc_at_call: num(coin.market_cap),
        liq_at_call: num(coin.liquidity_usd),
        vol_24h_at_call: num(coin.volume_24h),
        vol_1h_at_call: num(coin.volume_1h),
        price_at_call: num(coin.price_usd),
        mc_ath: num(coin.market_cap),
        mc_atl: num(coin.market_cap),
        mc_now: num(coin.market_cap),
        price_now: num(coin.price_usd),
        ath_at: new Date().toISOString(),
        atl_at: new Date().toISOString(),
        multiple_now: 1,
        multiple_ath: 1,
        status: "open",
        called_at: new Date().toISOString(),
        telegram_posts: [],
      };
      const text = formatCallTelegram(row);
      const posts = [];
      if (!opts.dryRun) {
        for (const chatId of targets) {
          const sent = await send(desk.bot_token, "sendMessage", {
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          }).catch(() => ({ ok: false }));
          if (sent?.ok) posts.push({ chat_id: String(chatId), message_id: sent.result?.message_id });
        }
      }
      row.telegram_posts = posts;
      const inserted = await insertCall(sb, row);
      actions.push({ type: "call", mint: coin.mint, symbol: coin.symbol, agent_id: agent?.id, posts: posts.length, id: inserted?.id });
    }
  }

  const snap = await snapshotCallsDesk({ sb });
  return {
    ...snap,
    ok: pushed.ok !== false,
    skipped: pushed.skipped || (actions.length ? null : "live_feed_quiet"),
    marked,
    actions,
    posted: pushed.posted || 0,
    targets: pushed.targets || 0,
    agent: live?.feed?.[0]?.agent_id || desk.last_agent_id,
    win_multiple: num(desk.win_multiple, CALLS_WIN_MULTIPLE),
    agents: LIVE_AGENTS,
  };
}

export { emptyCallsDesk };
