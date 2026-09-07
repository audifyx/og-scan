/**
 * OrbitX Calls desk — alert-only Telegram calls from the /on-chain agents.
 * No commands. Paper track-record from MC at call vs ATH / ATL / now.
 */
import { LIVE_AGENTS, liveAgentVoice, nextLiveAgent, screenLiveCandidate } from "./orbitx-live-desk.js";

export const CALLS_WIN_MULTIPLE = 1.5;
export const CALLS_LOSE_MULTIPLE = 0.7;
export const CALLS_LOSE_AFTER_MS = 24 * 60 * 60 * 1000;
export const CALLS_MAX_PER_TICK = 2;
export const CALLS_COOLDOWN_HOURS = 12;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function trim(v) {
  return String(v || "").trim();
}

export function maskBotToken(token) {
  const t = trim(token);
  if (!t) return "";
  if (t.length <= 10) return "••••";
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export function parseChannelRef(raw) {
  const s = trim(raw);
  if (!s) return null;
  if (/^-?\d+$/.test(s)) return { chatId: s, username: null };
  const m = s.match(/(?:https?:\/\/)?t\.me\/([^/?\s]+)/i) || s.match(/^@?([A-Za-z0-9_]{4,})$/);
  if (m) return { chatId: null, username: m[1].replace(/^@/, "") };
  return null;
}

export function publicWebhookUrl(origin) {
  const base = String(origin || "https://www.orbitx.world").replace(/\/+$/, "");
  return `${base}/api/orbitx-calls?path=hook`;
}

export function mcMultiple(nowMc, callMc) {
  const call = num(callMc);
  const now = num(nowMc);
  if (!(call > 0) || !(now > 0)) return null;
  return now / call;
}

export function applyMark(call, mark = {}, now = Date.now()) {
  const mc = num(mark.market_cap ?? mark.mc ?? mark.mc_now);
  const price = num(mark.price_usd ?? mark.price ?? mark.price_now);
  const at = new Date(now).toISOString();
  const next = { ...call };
  if (mc > 0) {
    next.mc_now = mc;
    const ath = num(next.mc_ath || next.mc_at_call);
    const atlBase = num(next.mc_atl || next.mc_at_call);
    if (!ath || mc >= ath) {
      next.mc_ath = mc;
      next.ath_at = at;
    }
    if (!atlBase || mc <= atlBase) {
      next.mc_atl = mc;
      next.atl_at = at;
    }
  }
  if (price > 0) next.price_now = price;
  next.multiple_now = mcMultiple(next.mc_now, next.mc_at_call);
  next.multiple_ath = mcMultiple(next.mc_ath, next.mc_at_call);
  next.status = resolveCallStatus(next, now);
  if (next.status !== "open" && !next.resolved_at) next.resolved_at = at;
  return next;
}

export function resolveCallStatus(call = {}, now = Date.now()) {
  const winAt = num(call.win_multiple, CALLS_WIN_MULTIPLE);
  const loseAt = num(call.lose_multiple, CALLS_LOSE_MULTIPLE);
  const athX = num(call.multiple_ath);
  const nowX = num(call.multiple_now);
  if (athX >= winAt) return "won";
  const called = Date.parse(call.called_at || 0);
  if (Number.isFinite(called) && now - called >= CALLS_LOSE_AFTER_MS && nowX > 0 && nowX < loseAt) return "lost";
  return "open";
}

export function summarizeCalls(calls = [], opts = {}) {
  const winAt = num(opts.win_multiple, CALLS_WIN_MULTIPLE);
  const rows = Array.isArray(calls) ? calls : [];
  const won = rows.filter((c) => c.status === "won" || num(c.multiple_ath) >= winAt);
  const lost = rows.filter((c) => c.status === "lost");
  const open = rows.filter((c) => (c.status || "open") === "open");
  const resolved = won.length + lost.length;
  const winRate = resolved > 0 ? won.length / resolved : null;
  const multiples = rows.map((c) => num(c.multiple_now)).filter((n) => n > 0);
  const peaks = rows.map((c) => num(c.multiple_ath)).filter((n) => n > 0);
  const avgNow = multiples.length ? multiples.reduce((a, b) => a + b, 0) / multiples.length : null;
  const avgAth = peaks.length ? peaks.reduce((a, b) => a + b, 0) / peaks.length : null;
  const pnlNow = multiples.length ? multiples.reduce((a, b) => a + (b - 1), 0) : 0;
  const pnlAth = peaks.length ? peaks.reduce((a, b) => a + (b - 1), 0) : 0;
  const best = [...rows].sort((a, b) => num(b.multiple_ath) - num(a.multiple_ath))[0] || null;
  return {
    calls: rows.length,
    open: open.length,
    won: won.length,
    lost: lost.length,
    win_rate: winRate,
    avg_multiple_now: avgNow,
    avg_multiple_ath: avgAth,
    pnl_now: pnlNow,
    pnl_ath: pnlAth,
    best,
  };
}

export function stillCooling(existing = [], mint, now = Date.now(), hours = CALLS_COOLDOWN_HOURS) {
  const needle = trim(mint);
  if (!needle) return false;
  const windowMs = num(hours, CALLS_COOLDOWN_HOURS) * 3600_000;
  return existing.some((c) => trim(c.mint) === needle && now - Date.parse(c.called_at || 0) < windowMs);
}

export function pickCallCandidates(tape = [], agent, existing = [], opts = {}) {
  const max = Math.max(1, Math.min(5, num(opts.max_calls_per_tick, CALLS_MAX_PER_TICK)));
  const hours = num(opts.cooldown_hours, CALLS_COOLDOWN_HOURS);
  const now = opts.now || Date.now();
  const out = [];
  for (const coin of tape || []) {
    if (out.length >= max) break;
    if (stillCooling(existing, coin.mint, now, hours)) continue;
    if (out.some((c) => c.mint === coin.mint)) continue;
    const screen = screenLiveCandidate(coin, { canBuy: true, canSell: true });
    if (!screen.ok) continue;
    out.push({ coin, screen, agent });
  }
  return out;
}

function pct(v) {
  if (v == null || v === "") return null;
  const n = num(v);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function usd(v) {
  const n = num(v);
  if (!(n > 0)) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function writeCallThesis(agent, coin = {}, screen = {}) {
  const voice = liveAgentVoice(agent);
  const t = `$${String(coin.symbol || "TOKEN").replace(/^\$/, "").toUpperCase()}`;
  const ch1 = pct(coin.change_1h);
  const ch24 = pct(coin.change_24h);
  let why;
  if (agent?.style === "mean_reversion") {
    why = ch24
      ? `${t} pulled back after ${ch24} on a book that still has depth. That's a dip, not a dump.`
      : `${t} is a pullback on a real book. Tight call, no chase.`;
  } else if (agent?.style === "fresh") {
    why = `${t} is a young listed pair with real depth that dipped instead of ripping vertical.`;
  } else {
    why = ch1
      ? `${t} looks like an early runner (${ch1} this hour) and the tape is buy-led on the dip, not the high.`
      : `${t} screened clean on the 5-minute tape — liquidity, volume, and flow all print.`;
  }
  const extra = [];
  if (usd(coin.liquidity_usd)) extra.push(`${usd(coin.liquidity_usd)} liq`);
  if (usd(coin.volume_1h || coin.volume_24h)) extra.push(`${usd(coin.volume_1h || coin.volume_24h)} vol`);
  if (usd(coin.market_cap)) extra.push(`${usd(coin.market_cap)} MC`);
  const tape = extra.length ? ` Tape: ${extra.join(" · ")}.` : "";
  const score = screen?.score != null ? ` Score ${Math.round(num(screen.score))}.` : "";
  return `${voice.first} is calling ${t}. ${why}${tape}${score} Not a buy order — an alert from the /on-chain agent desk.`;
}

export function buildCallAnalysis(coin = {}, screen = {}, agent = {}) {
  return {
    agent_id: agent?.id || null,
    agent_style: agent?.style || null,
    score: screen?.score ?? null,
    reasons_passed: screen?.ok === true,
    change_5m: coin.change_5m ?? null,
    change_15m: coin.change_15m ?? null,
    change_1h: coin.change_1h ?? null,
    change_24h: coin.change_24h ?? null,
    liquidity_usd: num(coin.liquidity_usd),
    volume_1h: num(coin.volume_1h),
    volume_24h: num(coin.volume_24h),
    buys_1h: num(coin.buys_1h),
    sells_1h: num(coin.sells_1h),
    txns_1h: num(coin.txns_1h),
    pair_age_min: coin.pair_age_min ?? null,
    dex: coin.dex || null,
    twitter: coin.twitter || null,
    telegram: coin.telegram || null,
    website: coin.website || null,
    boosted: Boolean(coin.boosted),
  };
}

export function formatCallTelegram(call = {}) {
  const a = call.analysis || {};
  const t = `$${String(call.symbol || "TOKEN").replace(/^\$/, "").toUpperCase()}`;
  const who = call.agent_name || call.agent_id || "OrbitX";
  const lines = [
    `<b>${escapeHtml(who)} · CALL</b>`,
    `<b>${escapeHtml(t)}</b>`,
    "",
    "<b>WHY THIS CALL</b>",
    escapeHtml(call.thesis || "Clean tape on the 5-minute agent scan."),
    "",
    "<b>FULL TAPE</b>",
    `MC at call: <b>${escapeHtml(usd(call.mc_at_call) || "—")}</b>`,
    `Liq: ${escapeHtml(usd(call.liq_at_call) || "—")} · Vol 24h: ${escapeHtml(usd(call.vol_24h_at_call) || "—")}`,
  ];
  const moves = [pct(a.change_5m), pct(a.change_15m), pct(a.change_1h), pct(a.change_24h)].filter(Boolean);
  if (moves.length) lines.push(`5m / 15m / 1h / 24h: ${escapeHtml(moves.join(" · "))}`);
  if (a.buys_1h || a.sells_1h) lines.push(`Flow 1h: ${num(a.buys_1h)} buys / ${num(a.sells_1h)} sells`);
  if (a.pair_age_min != null) lines.push(`Pair age: ${Math.round(num(a.pair_age_min))}m`);
  if (a.score != null) lines.push(`Agent score: ${Math.round(num(a.score))}`);
  lines.push("");
  lines.push(`CA: <code>${escapeHtml(call.mint || "")}</code>`);
  if (call.url) lines.push(`<a href="${escapeAttr(call.url)}">Dex</a>`);
  lines.push(`<a href="https://www.orbitx.world/on-chain/token/${escapeAttr(call.mint || "")}">OrbitX tape</a>`);
  lines.push("");
  lines.push("<i>Not financial advice. Alert only — no commands. Agents scan every 5 minutes.</i>");
  return lines.join("\n");
}

export function formatMarkUpdate(call = {}) {
  const t = `$${String(call.symbol || "TOKEN").replace(/^\$/, "").toUpperCase()}`;
  const nowX = num(call.multiple_now);
  const athX = num(call.multiple_ath);
  const tag = call.status === "won" ? "WON" : call.status === "lost" ? "LOST" : "MARK";
  return [
    `<b>${escapeHtml(tag)} · ${escapeHtml(t)}</b>`,
    `Now ${escapeHtml(usd(call.mc_now) || "—")} (${nowX ? `${nowX.toFixed(2)}x` : "—"})`,
    `ATH ${escapeHtml(usd(call.mc_ath) || "—")} (${athX ? `${athX.toFixed(2)}x` : "—"}) · ATL ${escapeHtml(usd(call.mc_atl) || "—")}`,
    `Called at ${escapeHtml(usd(call.mc_at_call) || "—")}`,
    `<code>${escapeHtml(call.mint || "")}</code>`,
  ].join("\n");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return String(s || "").replace(/"/g, "&quot;");
}

export function publicDesk(row = {}, chats = [], calls = []) {
  const stats = summarizeCalls(calls, { win_multiple: row.win_multiple });
  const groups = (chats || []).filter((c) => c.status !== "left" && c.status !== "kicked" && c.chat_type !== "private");
  const groupCount = groups.filter((c) => c.chat_type === "group" || c.chat_type === "supergroup" || !c.chat_type).length;
  const channels = groups.filter((c) => c.chat_type === "channel");
  return {
    ok: true,
    live: true,
    connected: Boolean(row.bot_username || row.bot_token),
    bot_username: row.bot_username || null,
    bot_name: row.bot_name || null,
    token_masked: maskBotToken(row.bot_token),
    channel_id: row.channel_id || null,
    channel_title: row.channel_title || null,
    channel_username: row.channel_username || null,
    broadcast_groups: row.broadcast_groups !== false,
    armed: Boolean(row.armed),
    max_calls_per_tick: num(row.max_calls_per_tick, CALLS_MAX_PER_TICK),
    cooldown_hours: num(row.cooldown_hours, CALLS_COOLDOWN_HOURS),
    win_multiple: num(row.win_multiple, CALLS_WIN_MULTIPLE),
    last_tick_at: row.last_tick_at || null,
    last_agent_id: row.last_agent_id || null,
    last_error: row.last_error || null,
    last_posted_at: row.last_posted_at || null,
    agents: LIVE_AGENTS,
    groups: groupCount,
    channels: channels.length,
    chats: (chats || []).map((c) => ({
      chat_id: c.chat_id,
      title: c.title,
      username: c.username,
      chat_type: c.chat_type,
      members: c.members,
      status: c.status,
      is_channel_target: Boolean(c.is_channel_target),
    })),
    stats,
    calls: (calls || []).map(publicCall),
    disclaimer: "Not financial advice. Paper track record from market cap at call vs now / ATH / ATL. Alerts only — the bot does not take commands.",
  };
}

export function publicCall(c = {}) {
  return {
    id: c.id,
    mint: c.mint,
    symbol: c.symbol,
    name: c.name,
    url: c.url,
    agent_id: c.agent_id,
    agent_name: c.agent_name,
    thesis: c.thesis,
    analysis: c.analysis || {},
    mc_at_call: num(c.mc_at_call) || null,
    liq_at_call: num(c.liq_at_call) || null,
    vol_24h_at_call: num(c.vol_24h_at_call) || null,
    vol_1h_at_call: num(c.vol_1h_at_call) || null,
    price_at_call: num(c.price_at_call) || null,
    mc_ath: num(c.mc_ath) || null,
    mc_atl: num(c.mc_atl) || null,
    mc_now: num(c.mc_now) || null,
    price_now: num(c.price_now) || null,
    ath_at: c.ath_at || null,
    atl_at: c.atl_at || null,
    multiple_now: c.multiple_now != null ? num(c.multiple_now) : null,
    multiple_ath: c.multiple_ath != null ? num(c.multiple_ath) : null,
    status: c.status || "open",
    called_at: c.called_at,
    telegram_posts: Array.isArray(c.telegram_posts) ? c.telegram_posts : [],
  };
}

export function nextCallsAgent(lastId) {
  return nextLiveAgent(lastId) || LIVE_AGENTS[0] || null;
}

export function emptyCallsDesk() {
  return publicDesk({}, [], []);
}

export { LIVE_AGENTS };
