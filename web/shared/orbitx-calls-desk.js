/**
 * OrbitX Calls desk — alert-only Telegram calls from the /on-chain agents.
 * No commands. Paper track-record from MC at call vs ATH / ATL / now.
 */
import { LIVE_AGENTS, enrichLiveFeedRow, liveAgentVoice, nextLiveAgent, screenLiveCandidate } from "./orbitx-live-desk.js";

export const CALLS_WIN_MULTIPLE = 1.5;
export const CALLS_LOSE_MULTIPLE = 0.7;
export const CALLS_LOSE_AFTER_MS = 24 * 60 * 60 * 1000;
export const CALLS_MAX_PER_TICK = 1;
export const CALLS_COOLDOWN_HOURS = 12;
/** Telegram: at most one call every 2 minutes, 5 calls in any 25-minute window. */
export const CALLS_MIN_GAP_MS = 2 * 60 * 1000;
export const CALLS_WINDOW_MS = 25 * 60 * 1000;
export const CALLS_MAX_PER_WINDOW = 5;

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
  const max = Math.max(1, Math.min(1, num(opts.max_calls_per_tick, CALLS_MAX_PER_TICK)));
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
  lines.push("<i>Not financial advice. Alert only — same live desk as /on-chain.</i>");
  return lines.join("\n");
}

export function unpublishedLiveFeed(feed = [], sinceAt, limit = 8) {
  const rows = Array.isArray(feed) ? feed : [];
  const cap = Math.max(1, Math.min(12, num(limit, 8)));
  const since = Date.parse(sinceAt || 0);
  const hasSince = Number.isFinite(since) && since > 0;
  const fresh = hasSince
    ? rows.filter((row) => {
        const at = Date.parse(row?.at || row?.created_at || 0);
        return Number.isFinite(at) && at > since;
      })
    : rows.slice(0, Math.min(3, cap));
  return [...fresh]
    .sort((a, b) => Date.parse(a?.at || a?.created_at || 0) - Date.parse(b?.at || b?.created_at || 0))
    .slice(-cap);
}

export function isTelegramCallKind(kind) {
  return /^(buy|sell)$/i.test(String(kind || ""));
}

export function parsePostAts(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === "string" ? v : v ? new Date(v).toISOString() : ""))
      .filter((v) => Number.isFinite(Date.parse(v)));
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      return parsePostAts(JSON.parse(raw));
    } catch {
      return Number.isFinite(Date.parse(raw)) ? [raw] : [];
    }
  }
  return [];
}

export function prunePostAts(ats, now = Date.now(), windowMs = CALLS_WINDOW_MS) {
  const cut = now - windowMs;
  return parsePostAts(ats).filter((t) => Date.parse(t) > cut);
}

export function telegramCallGate(ats, now = Date.now(), opts = {}) {
  const gap = opts.minGapMs ?? CALLS_MIN_GAP_MS;
  const windowMs = opts.windowMs ?? CALLS_WINDOW_MS;
  const max = opts.maxPerWindow ?? CALLS_MAX_PER_WINDOW;
  const recent = prunePostAts(ats, now, windowMs);
  const last = recent.length ? Math.max(...recent.map((t) => Date.parse(t))) : 0;
  if (last && now - last < gap) {
    return { ok: false, reason: "min_gap", wait_ms: gap - (now - last), recent };
  }
  if (recent.length >= max) {
    const oldest = Math.min(...recent.map((t) => Date.parse(t)));
    return { ok: false, reason: "window_cap", wait_ms: Math.max(0, windowMs - (now - oldest)), recent };
  }
  return { ok: true, reason: null, wait_ms: 0, recent };
}

export function claimTelegramCall(ats, now = Date.now(), opts = {}) {
  const gate = telegramCallGate(ats, now, opts);
  if (!gate.ok) return gate;
  const iso = new Date(now).toISOString();
  return { ok: true, reason: null, wait_ms: 0, recent: [...gate.recent, iso] };
}

/** Next buy/sell to post. Noise (skip/tick) can be acked without sending. */
export function nextTelegramCall(feed, sinceAt) {
  const fresh = unpublishedLiveFeed(feed, sinceAt, 12);
  const noise = [];
  for (const row of fresh) {
    if (isTelegramCallKind(row.kind)) {
      return {
        call: row,
        ackThrough: noise.length ? noise[noise.length - 1] : null,
        fresh,
      };
    }
    noise.push(row);
  }
  return {
    call: null,
    ackThrough: noise.length ? noise[noise.length - 1] : null,
    fresh,
  };
}

export function formatLiveFeedTelegram(row = {}, ctx = {}) {
  const live = enrichLiveFeedRow(row, ctx);
  const kind = String(live.kind || "tick").toUpperCase();
  const who = live.agent_name || live.agent_handle || "OrbitX";
  const t = live.symbol ? `$${String(live.symbol).replace(/^\$/, "").toUpperCase()}` : "";
  const lines = [
    `<b>${escapeHtml(who.replace(/\s+LIVE$/i, ""))} · ${escapeHtml(kind)}</b>`,
    escapeHtml(live.text || "On the desk."),
  ];
  if (t) lines.push(`<b>${escapeHtml(t)}</b>`);
  if (live.mint) lines.push(`CA: <code>${escapeHtml(live.mint)}</code>`);
  const links = [];
  if (live.mint) links.push(`<a href="https://www.orbitx.world/on-chain/token/${escapeAttr(live.mint)}">OrbitX tape</a>`);
  else links.push(`<a href="https://www.orbitx.world/on-chain">OrbitX /on-chain</a>`);
  if (live.solscan_tx) links.push(`<a href="${escapeAttr(live.solscan_tx)}">Solscan tx</a>`);
  if (live.solscan_token) links.push(`<a href="${escapeAttr(live.solscan_token)}">token</a>`);
  lines.push(links.join(" · "));
  lines.push("<i>Same live desk as /on-chain. Alert only — no commands.</i>");
  return lines.join("\n");
}

export function formatDeskLinkedTelegram() {
  return [
    "<b>OrbitX live desk linked</b>",
    "This chat now gets the same NEON / WARDEN / RAID tape as <a href=\"https://www.orbitx.world/on-chain\">/on-chain</a>.",
    "<i>Alert only — no commands.</i>",
  ].join("\n");
}

export function chatFromTelegramUpdate(upd = {}) {
  const node = upd.my_chat_member || upd.chat_member;
  if (node?.chat) {
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
  const msg = upd.message || upd.edited_message || upd.channel_post || upd.edited_channel_post;
  if (!msg?.chat) return null;
  const c = msg.chat;
  const title =
    c.title || c.username || [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || String(c.id);
  return {
    chat_id: String(c.id),
    title,
    username: c.username || null,
    chat_type: c.type || null,
    status: "member",
    is_channel_target: c.type === "channel",
  };
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
    pace: {
      min_gap_sec: CALLS_MIN_GAP_MS / 1000,
      window_min: CALLS_WINDOW_MS / 60000,
      max_per_window: CALLS_MAX_PER_WINDOW,
      posted_in_window: prunePostAts(row.post_ats).length,
    },
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

function deskWallet(live = {}) {
  if (typeof live.wallet === "string" && live.wallet) return live.wallet;
  if (live.wallet && typeof live.wallet === "object" && typeof live.wallet.pubkey === "string") return live.wallet.pubkey;
  return null;
}

function publicCallStats(calls, incoming) {
  const base = summarizeCalls(calls);
  const src = incoming && typeof incoming === "object" ? incoming : {};
  const bestSrc = src.best || base.best;
  return {
    calls: num(src.calls, base.calls),
    open: num(src.open, base.open),
    won: num(src.won, base.won),
    lost: num(src.lost, base.lost),
    win_rate: src.win_rate != null ? src.win_rate : base.win_rate,
    avg_multiple_now: src.avg_multiple_now ?? base.avg_multiple_now,
    avg_multiple_ath: src.avg_multiple_ath ?? base.avg_multiple_ath,
    pnl_now: src.pnl_now ?? base.pnl_now,
    pnl_ath: src.pnl_ath ?? base.pnl_ath,
    best: bestSrc
      ? {
          mint: bestSrc.mint || null,
          symbol: bestSrc.symbol || null,
          multiple_ath: bestSrc.multiple_ath != null ? num(bestSrc.multiple_ath) : null,
          status: bestSrc.status || null,
        }
      : null,
  };
}

export function publicAgentCallsBoard(live = {}, callDesk = {}) {
  const wallet = deskWallet(live);
  const calls = (callDesk.calls || []).map((c) => {
    const row = publicCall(c);
    return {
      id: row.id,
      mint: row.mint,
      symbol: row.symbol,
      name: row.name,
      url: row.url,
      agent_id: row.agent_id,
      agent_name: row.agent_name,
      thesis: row.thesis,
      mc_at_call: row.mc_at_call,
      mc_ath: row.mc_ath,
      mc_atl: row.mc_atl,
      mc_now: row.mc_now,
      multiple_now: row.multiple_now,
      multiple_ath: row.multiple_ath,
      status: row.status,
      called_at: row.called_at,
    };
  });
  const open = (live.open || []).map((p) => ({
    mint: p.mint,
    symbol: p.symbol,
    agent_id: p.agent_id,
    agent_name: p.agent_name,
    usd_in: p.usd_in,
    pnl_pct: p.pnl_pct,
    thesis: p.thesis,
    tp_pct: p.tp_pct,
  }));
  const fills = (live.fills || []).slice(0, 50).map((f) => ({
    id: f.id,
    created_at: f.created_at,
    agent_id: f.agent_id,
    mint: f.mint,
    symbol: f.symbol,
    side: f.side,
    usd_amount: f.usd_amount,
    pnl_usd: f.pnl_usd,
    pnl_pct: f.pnl_pct,
    signature: f.signature,
    thesis: f.thesis,
    reason: f.reason,
  }));
  const feed = (live.feed || []).slice(0, 80).map((row) => ({
    id: row.id,
    at: row.at,
    kind: row.kind,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    agent_handle: row.agent_handle,
    agent_color: row.agent_color,
    mint: row.mint,
    symbol: row.symbol,
    usd: row.usd,
    pnl_usd: row.pnl_usd,
    text: row.text,
    thesis: row.thesis,
    reason: row.reason,
    signature: row.signature,
    solscan_tx: row.solscan_tx,
    solscan_token: row.solscan_token,
    solscan_account: row.solscan_account,
  }));
  const ledger = live.ledger
    ? {
        started_usd: live.ledger.started_usd,
        currently_usd: live.ledger.currently_usd,
        made_usd: live.ledger.made_usd,
        wins: live.ledger.wins,
        losses: live.ledger.losses,
        holding: live.ledger.holding || null,
      }
    : null;
  const hunt = (Array.isArray(live.hunt) ? live.hunt : []).map((h) => ({
    mint: h.mint,
    symbol: h.symbol,
    clipUsd: h.clipUsd,
    scaleMcap: h.scaleMcap,
    flattenMcap: h.flattenMcap,
  }));
  const agents = (live.agents || LIVE_AGENTS).map((a) => ({
    id: a.id,
    name: a.name,
    handle: a.handle,
    color: a.color,
    wins: a.wins ?? 0,
    losses: a.losses ?? 0,
    currently_hold: a.currently_hold || (a.open?.symbol ? `$${String(a.open.symbol).replace(/^\$/, "")}` : "cash"),
    made_usd: a.made_usd ?? null,
  }));
  return {
    ok: true,
    public: true,
    disclaimer:
      live.disclaimer ||
      "Not financial advice. Public tape from the OrbitX live desk — trades, skips, and calls.",
    wallet,
    fundUrl: live.fundUrl || (wallet ? `https://solscan.io/account/${wallet}` : null),
    worldUrl: live.worldUrl || "https://www.orbitx.world/on-chain",
    last_tick_at: live.last_tick_at || callDesk.last_tick_at || null,
    last_activity_at: live.last_activity_at || null,
    live: Boolean(live.armed && live.enabled && !live.paused),
    trade_usd: live.trade_usd ?? null,
    max_open: live.max_open ?? 1,
    sol_balance: live.sol_balance ?? null,
    usd_balance: live.usd_balance ?? null,
    equity_usd: live.equity_usd ?? null,
    ledger,
    open,
    fills,
    feed,
    agents,
    hunt,
    calls,
    stats: publicCallStats(calls, callDesk.stats),
  };
}

export { LIVE_AGENTS };
