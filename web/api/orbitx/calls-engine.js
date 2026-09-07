/**
 * Admin Calls desk engine — connect a BotFather token from /calls,
 * scan the same /on-chain live tape every 5 minutes, post alerts
 * (no commands) to the linked channel and groups.
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
  emptyCallsDesk,
  formatCallTelegram,
  formatMarkUpdate,
  maskBotToken,
  nextCallsAgent,
  parseChannelRef,
  pickCallCandidates,
  publicDesk,
  publicWebhookUrl,
  writeCallThesis,
} from "../../shared/orbitx-calls-desk.js";
import { loadLiveTape } from "./live-agent-engine.js";

const DEX = "https://api.dexscreener.com/latest/dex";
const TG = "https://api.telegram.org";

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

async function loadDesk(sb) {
  const { data, error } = await sb.from("ox_calls_desk").select("*").eq("id", "main").maybeSingle();
  if (error && /does not exist|schema cache/i.test(error.message || "")) {
    const err = new Error("apply_ox_calls_desk_migration");
    err.code = "42P01";
    throw err;
  }
  if (error) throw new Error(error.message);
  return data || { id: "main" };
}

async function upsertDesk(sb, patch) {
  const cur = await loadDesk(sb).catch(() => ({ id: "main" }));
  const row = { ...cur, id: "main", ...patch, updated_at: new Date().toISOString() };
  const { error } = await sb.from("ox_calls_desk").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return row;
}

async function loadChats(sb) {
  const { data } = await sb.from("ox_calls_chats").select("*").order("last_seen_at", { ascending: false });
  return data || [];
}

async function loadCalls(sb, limit = 80) {
  const { data } = await sb.from("ox_calls_ledger").select("*").order("called_at", { ascending: false }).limit(limit);
  return data || [];
}

async function upsertChat(sb, row) {
  const { error } = await sb.from("ox_calls_chats").upsert(
    { ...row, last_seen_at: new Date().toISOString() },
    { onConflict: "chat_id" },
  );
  if (error) throw new Error(error.message);
}

export async function snapshotCallsDesk({ sb: sbIn } = {}) {
  const sb = sbIn || adminSb();
  if (!sb) return { ...emptyCallsDesk(), error: "supabase_unconfigured" };
  try {
    const [desk, chats, calls] = await Promise.all([loadDesk(sb), loadChats(sb), loadCalls(sb)]);
    return publicDesk(desk, chats, calls);
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
    allowed_updates: ["my_chat_member", "chat_member"],
    drop_pending_updates: true,
  });
  if (!set?.ok) return { ok: false, error: set?.description || "setWebhook_failed" };
  await upsertDesk(sb, {
    bot_token: botToken,
    bot_username: me.result.username,
    bot_id: String(me.result.id),
    bot_name: me.result.first_name || me.result.username,
    webhook_secret: secret,
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

function chatFromMember(upd) {
  const node = upd.my_chat_member || upd.chat_member;
  if (!node?.chat) return null;
  const status = String(node.new_chat_member?.status || "member");
  const left = status === "left" || status === "kicked";
  return {
    chat_id: String(node.chat.id),
    title: node.chat.title || node.chat.username || String(node.chat.id),
    username: node.chat.username || null,
    chat_type: node.chat.type || null,
    status: left ? status : "member",
    is_channel_target: node.chat.type === "channel",
  };
}

export async function ingestCallsHook({ body, secret, sb: sbIn } = {}) {
  const sb = sbIn || adminSb();
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  const desk = await loadDesk(sb);
  if (desk.webhook_secret && secret && secret !== desk.webhook_secret) return { ok: false, error: "bad_secret" };
  const row = chatFromMember(body || {});
  if (!row) return { ok: true, ignored: true };
  await upsertChat(sb, row);
  return { ok: true, chat_id: row.chat_id, status: row.status };
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
    const { error } = await sb
      .from("ox_calls_ledger")
      .update({
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
      })
      .eq("id", call.id);
    if (!error) {
      updated += 1;
      Object.assign(call, next);
    }
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
  if (desk.broadcast_groups !== false) {
    for (const c of chats || []) {
      if (c.status === "left" || c.status === "kicked") continue;
      if (c.chat_type === "private") continue;
      ids.add(String(c.chat_id));
    }
  }
  return [...ids];
}

export async function tickCallsDesk(opts = {}) {
  const sb = opts.sb || adminSb();
  const send = opts.send || ((token, method, body) => tg(token, method, body));
  const tapeFn = opts.tape || loadLiveTape;
  if (!sb) return { ok: false, error: "supabase_unconfigured" };
  let desk;
  try {
    desk = await loadDesk(sb);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
  const chats = await loadChats(sb);
  const calls = await loadCalls(sb, 200);
  let marked = 0;
  try {
    marked = await refreshMarks(sb, desk, calls, { post: Boolean(desk.armed && desk.bot_token), send });
  } catch (e) {
    await upsertDesk(sb, { last_error: e.message || String(e), last_tick_at: new Date().toISOString() }).catch(() => {});
  }

  const agent = nextCallsAgent(desk.last_agent_id);
  const actions = [];
  if (!desk.bot_token) {
    await upsertDesk(sb, { last_tick_at: new Date().toISOString(), last_agent_id: agent?.id, last_error: "connect_bot_first" });
    const snap = await snapshotCallsDesk({ sb });
    return { ...snap, skipped: "connect_bot_first", marked, actions, agent: agent?.id };
  }
  if (!desk.armed && !opts.force) {
    await upsertDesk(sb, { last_tick_at: new Date().toISOString(), last_agent_id: agent?.id, last_error: null });
    const snap = await snapshotCallsDesk({ sb });
    return { ...snap, skipped: "not_armed", marked, actions, agent: agent?.id };
  }
  if (!desk.channel_id && desk.broadcast_groups === false) {
    await upsertDesk(sb, { last_tick_at: new Date().toISOString(), last_error: "link_channel_or_enable_groups" });
    const snap = await snapshotCallsDesk({ sb });
    return { ...snap, skipped: "no_destination", marked, actions, agent: agent?.id };
  }

  const tape = await Promise.resolve().then(() => tapeFn()).catch(() => []);
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
    const { data: inserted } = await sb.from("ox_calls_ledger").insert(row).select("*").single();
    actions.push({ type: "call", mint: coin.mint, symbol: coin.symbol, agent_id: agent?.id, posts: posts.length, id: inserted?.id });
  }

  await upsertDesk(sb, {
    last_tick_at: new Date().toISOString(),
    last_agent_id: agent?.id,
    last_error: null,
    last_posted_at: actions.length ? new Date().toISOString() : desk.last_posted_at,
  });
  const snap = await snapshotCallsDesk({ sb });
  return {
    ...snap,
    ok: true,
    skipped: picks.length ? null : "no_clean_coin",
    marked,
    actions,
    agent: agent?.id,
    targets: targets.length,
    win_multiple: num(desk.win_multiple, CALLS_WIN_MULTIPLE),
    agents: LIVE_AGENTS,
  };
}

export { emptyCallsDesk };
