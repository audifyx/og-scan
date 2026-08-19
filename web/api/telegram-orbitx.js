/**
 * Official OrbitX Telegram bot + web companion.
 *
 * POST  Telegram webhook (secret header)
 * POST  { action: "web.*" } with Supabase JWT for /telegram
 * GET   ?action=health | configure
 *
 * Token: TELEGRAM_ORBITX_BOT_TOKEN (Vercel env — never commit).
 */
export const config = { maxDuration: 120 };

import { randomUUID } from "crypto";
import {
  GROUP_COMMANDS,
  OFFICIAL_BOT_ABOUT,
  OFFICIAL_BOT_NAME,
  OFFICIAL_BOT_SHORT,
  OFFICIAL_BOT_USERNAME,
  PRIVATE_COMMANDS,
  argsFromCommand,
  cmdsPage,
  collectMediaUrls,
  extractMint,
  formatMediaCountdown,
  formatOrbitXFaqHtml,
  formatOrbitXTelegramResult,
  inferPublicTool,
  orbitXFaqSystemAddon,
  isPrivilegedTelegramTool,
  isTelegramAdminWallet,
  loginCode,
  mediaEtaSeconds,
  mergeTokenScanPayloads,
  parseCallInvocation,
  resolveOfficialCommand,
  TOKEN_INTEL_TOOLS,
} from "./orbitx/telegram-orbitx-lib.js";
import {
  DEFAULT_TELEGRAM_NIM_MODEL,
  formatOrbitXLinksHtml,
  OFFICIAL_ORBITX_TELEGRAM_SYSTEM,
  ORBITX_GC,
  ORBITX_TELEGRAM_BLURB,
} from "./orbitx/orbitx-telegram-knowledge.js";
import { nvidiaChat, postTweetOAuth2 } from "./orbitx/x-agent-lib.js";
import { memoryRateLimit } from "./orbitx/ai-runtime.js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const FALLBACK = "https://www.orbitx.world";
const BOT_TOKEN = process.env.TELEGRAM_ORBITX_BOT_TOKEN || "";
const WEBHOOK_SECRET =
  process.env.TELEGRAM_ORBITX_WEBHOOK_SECRET ||
  (BOT_TOKEN ? BOT_TOKEN.slice(-24).replace(/[^a-zA-Z0-9]/g, "x") : "");

function json(res, body, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function ok(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("ok");
}

function header(req, name) {
  const h = req.headers || {};
  return h[name.toLowerCase()] || h[name] || "";
}

function officialOrigin() {
  const env = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL;
  if (env) return String(env).replace(/\/$/, "").replace("://orbitx.world", "://www.orbitx.world");
  return FALLBACK;
}

function publicBase(req) {
  return officialOrigin();
}

async function readBody(req) {
  try {
    if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    const chunks = [];
    for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function sb(path, init = {}) {
  if (!SUPA_URL || !SRK) throw new Error("supabase_not_configured");
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
      Prefer: init.headers?.Prefer || "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`supabase ${r.status}: ${t.slice(0, 220)}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

async function getJwtUser(req) {
  const auth = header(req, "authorization");
  if (!auth.startsWith("Bearer ") || !SUPA_URL || !ANON) return null;
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id, email: u.email || null } : null;
}

async function tg(method, body, { form } = {}) {
  if (!BOT_TOKEN) return { ok: false, description: "TELEGRAM_ORBITX_BOT_TOKEN missing" };
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: form ? undefined : { "Content-Type": "application/json" },
    body: form || JSON.stringify(body),
  });
  return r.json().catch(() => ({ ok: false }));
}

async function sendLong(chatId, text, extra = {}) {
  const MAX = 3800;
  const str = String(text || "");
  const chunks = [];
  if (str.length <= MAX) chunks.push(str);
  else {
    let buf = "";
    for (const line of str.split("\n")) {
      if ((buf + "\n" + line).length > MAX) {
        if (buf) chunks.push(buf);
        buf = line;
      } else buf = buf ? `${buf}\n${line}` : line;
    }
    if (buf) chunks.push(buf);
  }
  let last = null;
  for (const chunk of chunks) {
    last = await tg("sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: extra.parse_mode === "HTML" ? false : true,
      ...extra,
    });
    if (!last?.ok && extra.parse_mode) {
      last = await tg("sendMessage", {
        chat_id: chatId,
        text: chunk.replace(/<[^>]+>/g, ""),
        disable_web_page_preview: true,
      });
    }
  }
  return last;
}

async function sendMedia(chatId, urls) {
  for (const media of urls || []) {
    const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(media) || /video/i.test(media);
    if (isVid) await tg("sendVideo", { chat_id: chatId, video: media });
    else await tg("sendPhoto", { chat_id: chatId, photo: media });
  }
}

async function loadLink(telegramUserId) {
  const id = String(telegramUserId || "").trim();
  if (!id) return null;
  try {
    const rows = await sb(
      `telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(id)}&select=telegram_user_id,user_id,telegram_username,wallet_address,auto_buy&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch {
    try {
      const rows = await sb(
        `telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(id)}&select=telegram_user_id,user_id,telegram_username,wallet_address&limit=1`,
      );
      return Array.isArray(rows) ? rows[0] : null;
    } catch {
      return null;
    }
  }
}

async function loadWallet(userId) {
  const rows = await sb(
    `wallet_identities?user_id=eq.${encodeURIComponent(userId)}&select=wallet&order=created_at.asc&limit=1`,
  );
  return Array.isArray(rows) ? rows[0]?.wallet || null : null;
}

async function runTool({ tool, args, req, link, allowPrivileged }) {
  const hub = await import("./orbitx-hub.js");
  const requested = String(tool || "").trim();
  const name = hub.resolveOrbitXToolName(requested) || requested;
  if (!name) return { ok: false, error: "tool_required" };
  if (!hub.hasEmbeddedAgentTool(name) && name !== "x_post") {
    return {
      ok: false,
      error: `Unknown OrbitX tool: ${requested}`,
      message: `Unknown OrbitX tool: ${requested}. Try /cmds or /call prepare_buy. Live catalog has ${hub.listAllOrbitXTools().length} tools.`,
      hint: "/cmds · /shop · /buy CA 0.1 sol · /login in DM",
    };
  }
  const privileged = isPrivilegedTelegramTool(name) || name === "x_post";
  if (privileged && !allowPrivileged) {
    return {
      ok: false,
      error: "login_required",
      message: "This action is only for YOUR linked OrbitX account. Message @theorbitxmcpbot privately and tap /login.",
    };
  }
  if (privileged && !link?.user_id) {
    return {
      ok: false,
      error: "login_required",
      message: "Link your OrbitX wallet first: /login (private DM only). Nobody else can use your account.",
    };
  }
  const cleanArgs = { ...(args || {}) };
  delete cleanArgs.__resolvedTool;
  if (
    allowPrivileged &&
    link?.wallet_address &&
    ["orbitx_get_wallet", "orbitx_get_balance", "orbitx_get_swaps", "orbitx_whoami"].includes(name) &&
    !cleanArgs.publicKey &&
    !cleanArgs.address
  ) {
    cleanArgs.publicKey = link.wallet_address;
    cleanArgs.address = link.wallet_address;
  }
  if (name === "x_post") {
    return postLinkedX(link.user_id, cleanArgs);
  }
  if (privileged) {
    const emailRows = await sb(
      `wallet_identities?user_id=eq.${encodeURIComponent(link.user_id)}&select=wallet&limit=1`,
    ).catch(() => []);
    const wallet = String(link.wallet_address || emailRows?.[0]?.wallet || "").trim() || null;
    if (wallet) {
      cleanArgs.publicKey = wallet;
      cleanArgs.address = wallet;
      cleanArgs.buyerWallet = cleanArgs.buyerWallet || wallet;
    }
    if (link.auto_buy && /^orbitx_(prepare_buy|buy|buy_orbitx|buy_auto)$/.test(name)) {
      if (cleanArgs.autoConfirm !== false) cleanArgs.autoConfirm = true;
    }
    if (!wallet && /buy|sell|launch|mint|credits|access|nft_prepare|nft_submit|burn|claim/.test(name)) {
      return {
        ok: false,
        error: "wallet_required",
        message: "This OrbitX account has no Phantom wallet yet. Open https://www.orbitx.world/telegram after /login and connect Phantom.",
      };
    }
    return hub.runEmbeddedAgentTool({
      userId: link.user_id,
      walletAddress: wallet,
      toolName: name,
      args: cleanArgs,
      req,
    });
  }
  return hub.runPublicOrbitXTool({ toolName: name, args: cleanArgs, req });
}

function raceTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function lookupVerifiedMint(mint) {
  const id = String(mint || "").trim();
  if (!id) return null;
  try {
    const rows = await sb(
      `orbitx_token_verifications?mint=eq.${encodeURIComponent(id)}&select=mint,symbol,name,verified_by_wallet,verified_at&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch {
    return null;
  }
}

async function buildBrandedScan(mint, { req, link, isGroup }) {
  const ctx = {
    req,
    link,
    allowPrivileged: false,
  };
  const args = { mint };
  const [token, xray, forensics, boosts, verified] = await Promise.all([
    raceTimeout(runTool({ tool: "orbitx_get_token", args, ...ctx }), 12_000).catch(() => null),
    raceTimeout(runTool({ tool: "orbitx_xray", args, ...ctx }), 12_000).catch(() => null),
    raceTimeout(runTool({ tool: "orbitx_get_forensics", args: { mint, first: "0" }, ...ctx }), 10_000).catch(() => null),
    raceTimeout(runTool({ tool: "orbitx_boosts", args: {}, ...ctx }), 8_000).catch(() => null),
    lookupVerifiedMint(mint),
  ]);
  const merged = mergeTokenScanPayloads({ token, xray, forensics, boosts, verified });
  void isGroup;
  return merged;
}

async function handleVerify(chatId, text, { isGroup, link, extra }) {
  if (isGroup) {
    await sendLong(
      chatId,
      "Token verify is admin-only in a private DM after /login with the admin wallet.",
      extra,
    );
    return;
  }
  if (!link?.user_id) {
    await sendLong(chatId, "Auth mode required. Send /login in this DM, then /verify CA.", extra);
    return;
  }
  if (!isTelegramAdminWallet(link.wallet_address)) {
    await sendLong(
      chatId,
      "Only the OrbitX admin wallet can /verify a mint. Link that wallet with /login.",
      extra,
    );
    return;
  }
  const mint = extractMint(text);
  if (!mint) {
    await sendLong(chatId, "Usage: /verify CA", extra);
    return;
  }
  let symbol = null;
  let name = null;
  try {
    const token = await raceTimeout(
      runTool({ tool: "orbitx_get_token", args: { mint }, req: null, link, allowPrivileged: false }),
      10_000,
    );
    symbol = token?.token?.symbol || token?.symbol || null;
    name = token?.token?.name || token?.name || null;
  } catch {
    /* still allow verify */
  }
  const row = {
    mint,
    symbol,
    name,
    verified_by_telegram_user_id: String(link.telegram_user_id || ""),
    verified_by_wallet: String(link.wallet_address || ""),
    verified_at: new Date().toISOString(),
  };
  try {
    const existing = await lookupVerifiedMint(mint);
    if (existing) {
      await sb(`orbitx_token_verifications?mint=eq.${encodeURIComponent(mint)}`, {
        method: "PATCH",
        body: JSON.stringify({
          symbol: symbol || existing.symbol,
          name: name || existing.name,
          verified_by_telegram_user_id: row.verified_by_telegram_user_id,
          verified_by_wallet: row.verified_by_wallet,
          verified_at: row.verified_at,
        }),
      });
    } else {
      await sb("orbitx_token_verifications", { method: "POST", body: JSON.stringify(row) });
    }
  } catch (error) {
    await sendLong(
      chatId,
      `Could not save verification (apply orbitx_token_verifications migration): ${error?.message || error}`,
      extra,
    );
    return;
  }
  await sendLong(
    chatId,
    [
      "<b>✓ OrbitX Verified</b>",
      name ? `${name} · $${symbol || "TOKEN"}` : "",
      `<code>${mint}</code>`,
      "This badge now shows whenever the mint is scanned in Telegram (/token, CA drop, /scan, /xray).",
    ]
      .filter(Boolean)
      .join("\n"),
    { parse_mode: "HTML", ...extra },
  );
}

async function postLinkedX(userId, args) {
  const text = String(args.text || args.prompt || args.q || "").trim();
  if (!text) return { ok: false, error: "text_required", message: "Usage: /tweet your post" };
  let profile;
  try {
    const rows = await sb(
      `profiles?user_id=eq.${encodeURIComponent(userId)}&select=twitter_access_token,twitter_username,twitter_oauth_scopes&limit=1`,
    );
    profile = Array.isArray(rows) ? rows[0] : null;
  } catch {
    profile = null;
  }
  if (!profile?.twitter_access_token) {
    return {
      ok: false,
      error: "x_not_connected",
      message: "Connect X at https://www.orbitx.world/x then retry /tweet.",
    };
  }
  const posted = await postTweetOAuth2(profile.twitter_access_token, { text: text.slice(0, 280) });
  if (!posted?.ok) {
    return {
      ok: false,
      error: posted?.error || "x_post_failed",
      message: posted?.message || "X rejected the post. Reconnect at /x.",
    };
  }
  return {
    ok: true,
    message: `Posted as @${profile.twitter_username || "account"}`,
    tweetId: posted.tweetId || posted.id || null,
  };
}

function helpText(isPrivate, linked) {
  return [
    `<b>OrbitX</b> · @${OFFICIAL_BOT_USERNAME}`,
    ORBITX_TELEGRAM_BLURB,
    "Anyone can ask about live products — DEX, City, OS, Play, Intel, Launchpad, HQ.",
    "",
    "<b>Commands</b>",
    "/cmds — slash menu + live tool catalog",
    "/token mint · /chart ca · /scan · /xray · /research",
    "Drop a CA in chat for a branded scan (MC, ATH, holders, whales, bundles, boosts)",
    "/img prompt · /vid prompt — Grok Imagine (a few minutes)",
    "/check — countdown + poll the latest image/video job",
    "/faq [topic] — OrbitX FAQ (token, MCP, burns, City, DEX)",
    "/shop — MCP seats + credits (linked wallet for buys)",
    "/links · /group — every URL + community GC",
    "/ask — talk to OrbitX AI",
    "",
    isPrivate
      ? linked
        ? "Account linked. /me · /buy CA 0.1 sol · /trade · /orbitx · /shop · /autobuy on · /launch · /mint · /call tool"
        : "/login to bind THIS Telegram to YOUR OrbitX wallet. Nobody else can trade for you."
      : "Groups stay public. Wallet commands (/buy /tweet) only work in DM after /login.",
    "",
    `Live team chat: ${ORBITX_GC}`,
    "If a feat is live-ops / you need a human, join the GC and ask a team member.",
    "Web: https://www.orbitx.world/telegram",
  ].join("\n");
}

function isMediaGenTool(name) {
  return name === "orbitx_generate_image" || name === "orbitx_generate_video";
}

function mediaKindForTool(name, fallback) {
  if (name === "orbitx_generate_video" || fallback === "video") return "video";
  return "image";
}

function parseTaskId(result) {
  if (!result || typeof result !== "object") return "";
  return String(result.taskId || result.id || result.jobId || "").trim();
}

const mediaJobsByChat = new Map();
const mediaJobsByTask = new Map();

function cacheMediaJob(job) {
  if (!job?.task_id) return;
  mediaJobsByTask.set(String(job.task_id), job);
  if (job.chat_id) mediaJobsByChat.set(String(job.chat_id), job);
}

async function rememberMediaJob({ chatId, fromId, taskId, kind, prompt }) {
  if (!taskId) return null;
  const job = {
    chat_id: String(chatId),
    telegram_user_id: fromId != null ? String(fromId) : null,
    task_id: String(taskId),
    kind: mediaKindForTool("", kind),
    prompt: prompt ? String(prompt).slice(0, 500) : null,
    eta_seconds: mediaEtaSeconds(kind),
    started_at: new Date().toISOString(),
    status: "waiting",
  };
  cacheMediaJob(job);
  try {
    await sb("telegram_orbitx_media_jobs", {
      method: "POST",
      body: JSON.stringify(job),
    });
  } catch {
    /* table may not exist until the migration is applied */
  }
  return job;
}

async function latestMediaJob(chatId) {
  try {
    const rows = await sb(
      `telegram_orbitx_media_jobs?chat_id=eq.${encodeURIComponent(String(chatId))}&select=task_id,kind,prompt,eta_seconds,started_at,status&order=started_at.desc&limit=8`,
    );
    const list = Array.isArray(rows) ? rows : [];
    const open = list.find((row) => !["succeeded", "failed", "success", "fail"].includes(String(row.status || "").toLowerCase()));
    const picked = open || list[0] || null;
    if (picked) cacheMediaJob({ ...picked, chat_id: String(chatId) });
    if (picked) return picked;
  } catch {
    /* ignore missing table */
  }
  return mediaJobsByChat.get(String(chatId)) || null;
}

async function findMediaJob(taskId, chatId) {
  const id = String(taskId || "").trim();
  if (id) {
    try {
      const rows = await sb(
        `telegram_orbitx_media_jobs?task_id=eq.${encodeURIComponent(id)}&select=task_id,kind,prompt,eta_seconds,started_at,status,chat_id&limit=1`,
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        cacheMediaJob(row);
        return row;
      }
    } catch {
      /* ignore */
    }
    if (mediaJobsByTask.has(id)) return mediaJobsByTask.get(id);
  }
  return latestMediaJob(chatId);
}

async function markMediaJob(taskId, status) {
  const id = String(taskId || "").trim();
  if (!id) return;
  const cached = mediaJobsByTask.get(id);
  if (cached) cacheMediaJob({ ...cached, status });
  try {
    await sb(`telegram_orbitx_media_jobs?task_id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  } catch {
    /* ignore */
  }
}

async function handleAutoBuy(chatId, text, { isGroup, link, extra = {} }) {
  if (isGroup) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Auto-buy is private. DM @theorbitxmcpbot, /login, then /autobuy on or /autobuy off.",
      ...extra,
    });
    return;
  }
  if (!link?.user_id) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Link YOUR wallet first: /login. Auto-buy only applies to this Telegram account.",
      ...extra,
    });
    return;
  }
  const rest = String(text || "").replace(/^\S+\s*/, "").trim().toLowerCase();
  let enabled = Boolean(link.auto_buy);
  if (/\b(off|disable|manual|sign)\b/.test(rest)) enabled = false;
  else if (/\b(on|enable|auto)\b/.test(rest) || rest === "") enabled = rest === "" ? !enabled : true;
  try {
    await sb(`telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(String(link.telegram_user_id))}`, {
      method: "PATCH",
      body: JSON.stringify({ auto_buy: enabled, updated_at: new Date().toISOString() }),
    });
  } catch {
    /* column may not exist until migration */
  }
  await runTool({
    tool: "orbitx_trade_auto",
    args: { enabled },
    req: extra.req,
    link,
    allowPrivileged: true,
  }).catch(() => null);
  await sendLong(
    chatId,
    enabled
      ? "<b>Auto-buy ON</b>\nNext /buy or “buy CA with 10$ usdc” sends a Phantom auto-prompt. You still sign. OrbitX never holds keys.\n/autobuy off to require Sign each time."
      : "<b>Auto-buy OFF</b>\nEach buy returns a Sign link. Say <b>confirm</b> after a quote, or /autobuy on.",
    { parse_mode: "HTML", ...extra },
  );
}

async function handleCmds(text, tools) {
  const rest = String(text || "").replace(/^\/(cmds|menu)(@\w+)?\s*/i, "").trim();
  const pageMatch = rest.match(/^(\d+)$/);
  const page = pageMatch ? Number(pageMatch[1]) : 1;
  const query = pageMatch ? "" : rest;
  return cmdsPage(tools, { page, query });
}

async function askAi(prompt, { linked }) {
  const extra = linked
    ? "This user is linked to their OrbitX account in a private DM — they can /buy /sell /tweet /post."
    : "This chat is public unless they /login in a private DM.";
  const nim = await nvidiaChat({
    system: `${OFFICIAL_ORBITX_TELEGRAM_SYSTEM}\n\n${extra}\n\n${orbitXFaqSystemAddon(prompt)}`,
    user: String(prompt || "gm").slice(0, 6000),
    model: process.env.TELEGRAM_NIM_MODEL || DEFAULT_TELEGRAM_NIM_MODEL,
    maxTokens: 900,
    temperature: 0.45,
  });
  if (nim.ok && nim.content) return String(nim.content).replace(/```[\s\S]*?```/g, "").trim().slice(0, 3900);
  return nim.message || "OrbitX AI is offline (NVIDIA_API_KEY). Slash commands still work: /cmds /token /chart /img /check /links.";
}

async function sendLinks(chatId, extra = {}) {
  await sendLong(
    chatId,
    `${formatOrbitXLinksHtml()}\n\nNeed a live human answer? Join ${ORBITX_GC} and ask a team member.`,
    { parse_mode: "HTML", ...extra },
  );
}

function withTelegramToolArgs(tool, args) {
  if (!isMediaGenTool(tool)) return args || {};
  return { ...(args || {}), wait: false };
}

function startedAtMs(job, result) {
  if (job?.started_at) {
    const parsed = Date.parse(job.started_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (Number.isFinite(Number(result?.startedAt))) return Number(result.startedAt);
  return Date.now();
}

async function replyToolResult(chatId, result, { tool, extra, job } = {}) {
  const timed =
    result && typeof result === "object" && parseTaskId(result)
      ? {
          ...result,
          kind: result.kind || job?.kind,
          startedAt: result.startedAt || startedAtMs(job, result),
          etaSeconds: result.etaSeconds || job?.eta_seconds || mediaEtaSeconds(result.kind || job?.kind),
        }
      : result;
  await sendLong(chatId, formatOrbitXTelegramResult(timed, tool), { parse_mode: "HTML", ...extra });
  await sendMedia(chatId, collectMediaUrls(timed || result));
}

async function handleCheck(chatId, text, { req, link, extra }) {
  const rest = String(text || "").replace(/^\S+\s*/, "").trim();
  const argId = rest.split(/\s+/)[0] || "";
  const job = await findMediaJob(argId, chatId);
  const taskId = argId || job?.task_id || "";
  if (!taskId) {
    await sendLong(
      chatId,
      [
        "<b>Nothing to check yet.</b>",
        "Start an image or video first:",
        "/img neon orbitx city",
        "/vid orbitx trailer",
        "Then keep sending /check until the countdown hits ready (usually a few minutes).",
      ].join("\n"),
      { parse_mode: "HTML", ...extra },
    );
    return;
  }
  const result = await runTool({
    tool: "orbitx_media_status",
    args: { taskId },
    req,
    link,
    allowPrivileged: false,
  });
  const state = String(result?.state || result?.status || "").toLowerCase();
  const kind = job?.kind || result?.kind || "image";
  if (result?.error && !state) {
    await sendLong(chatId, formatOrbitXTelegramResult(result), { parse_mode: "HTML", ...extra });
    return;
  }
  if (state === "success" || state === "succeeded" || state === "completed" || state === "done") {
    await markMediaJob(taskId, "succeeded");
    await sendLong(
      chatId,
      formatMediaCountdown({ kind, taskId, state: "success" }),
      { parse_mode: "HTML", ...extra },
    );
    await sendMedia(chatId, collectMediaUrls(result));
    return;
  }
  if (state === "fail" || state === "failed" || state === "error") {
    await markMediaJob(taskId, "failed");
    await sendLong(
      chatId,
      formatMediaCountdown({
        kind,
        taskId,
        state: "fail",
        failMsg: result?.failMsg || result?.error || result?.message,
      }),
      { parse_mode: "HTML", ...extra },
    );
    return;
  }
  await sendLong(
    chatId,
    formatMediaCountdown({
      kind,
      taskId,
      startedAt: startedAtMs(job, result),
      etaSeconds: Number(job?.eta_seconds) > 0 ? Number(job.eta_seconds) : mediaEtaSeconds(kind),
      state: result?.state || "waiting",
    }),
    { parse_mode: "HTML", ...extra },
  );
}

async function startLogin(telegramUser, base) {
  const code = loginCode();
  const expires = new Date(Date.now() + 15 * 60_000).toISOString();
  await sb("telegram_orbitx_login_codes", {
    method: "POST",
    body: JSON.stringify({
      code,
      telegram_user_id: String(telegramUser.id),
      telegram_username: telegramUser.username || null,
      expires_at: expires,
    }),
  });
  const url = `${base}/telegram?code=${encodeURIComponent(code)}`;
  return [
    "<b>Link OrbitX</b>",
    "1. Open the secure page (expires in 15 minutes)",
    url,
    "2. Sign in with the wallet you use on OrbitX",
    "3. Confirm. Then /buy /sell /tweet /post work in this DM.",
  ].join("\n");
}

async function handleTelegramUpdate(update, req) {
  const msg = update.message || update.edited_message || update.channel_post;
  if (!msg) return;
  const text = String(msg.text || msg.caption || "").trim();
  const chatId = msg.chat?.id;
  if (!chatId) return;
  const chatType = String(msg.chat?.type || "");
  const isGroup = chatType === "group" || chatType === "supergroup";
  const from = msg.from || {};
  const replyExtra = isGroup ? { reply_to_message_id: msg.message_id } : {};
  const link = from.id ? await loadLink(from.id) : null;
  const limit = memoryRateLimit(
    `tg-orbitx:${isGroup ? chatId : from.id || chatId}`,
    isGroup ? 40 : 60,
    60_000,
  );
  if (limit.limited) {
    await tg("sendMessage", { chat_id: chatId, text: "Slow down — too many OrbitX requests.", ...replyExtra });
    return;
  }

  const bare = text.toLowerCase().split(/\s+/)[0].replace(/@.*$/, "").replace(/^\//, "");
  const mentioned =
    new RegExp(`@${OFFICIAL_BOT_USERNAME}\\b`, "i").test(text) ||
    Boolean(msg.reply_to_message?.from?.username?.toLowerCase() === OFFICIAL_BOT_USERNAME);

  if (isGroup && text && !text.startsWith("/") && !mentioned) return;

  const hub = await import("./orbitx-hub.js");
  const tools = hub.listAllOrbitXTools();

  if (bare === "start" || bare === "help") {
    await sendLong(chatId, helpText(!isGroup, Boolean(link)), { parse_mode: "HTML", ...replyExtra });
    return;
  }

  if (bare === "login" || bare === "auth") {
    if (isGroup) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "Login is private. Message @theorbitxmcpbot directly and send /login.",
        ...replyExtra,
      });
      return;
    }
    try {
      const body = await startLogin(from, publicBase(req));
      await sendLong(chatId, body, { parse_mode: "HTML" });
    } catch (error) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: `Could not start login: ${error?.message || error}`,
      });
    }
    return;
  }

  if (bare === "logout") {
    if (isGroup) return;
    if (link) {
      await sb(`telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(String(from.id))}`, { method: "DELETE" });
    }
    await tg("sendMessage", { chat_id: chatId, text: "Unlinked. This chat is public-only until /login." });
    return;
  }

  if (bare === "me") {
    if (!link) {
      await tg("sendMessage", { chat_id: chatId, text: "Not linked. Send /login in this private chat." });
      return;
    }
    await sendLong(
      chatId,
      `<b>Linked OrbitX</b>\nuser: <code>${link.user_id}</code>\nwallet: <code>${link.wallet_address || "n/a"}</code>\nauto-buy: ${link.auto_buy ? "ON (Phantom auto-prompt)" : "OFF (sign each trade)"}\ntelegram: @${link.telegram_username || from.username || "user"}`,
      { parse_mode: "HTML" },
    );
    return;
  }

  if (bare === "cmds" || bare === "menu") {
    const page = await handleCmds(text, tools);
    await sendLong(chatId, page.text, { parse_mode: "HTML", ...replyExtra });
    return;
  }

  if (bare === "links" || bare === "group" || bare === "gc") {
    await sendLinks(chatId, replyExtra);
    return;
  }

  if (bare === "faq") {
    await sendLong(chatId, formatOrbitXFaqHtml(text), { parse_mode: "HTML", ...replyExtra });
    return;
  }

  if (bare === "check" || (bare === "media" && !String(text).replace(/^\S+\s*/, "").trim())) {
    await handleCheck(chatId, text, { req, link, extra: replyExtra });
    return;
  }

  if (bare === "verify") {
    await handleVerify(chatId, text, { isGroup, link, extra: replyExtra });
    return;
  }

  if (bare === "autobuy") {
    await handleAutoBuy(chatId, text, { isGroup, link, extra: { ...replyExtra, req } });
    return;
  }

  let tool = "";
  let args = {};
  if (bare === "call") {
    const parsed = parseCallInvocation(text);
    tool = parsed.tool;
    args = parsed.args;
  } else if (bare === "ask" || (text && !text.startsWith("/"))) {
    const inferred = inferPublicTool(text.replace(new RegExp(`@${OFFICIAL_BOT_USERNAME}`, "ig"), " ").trim());
    if (inferred?.meta === "links") {
      await sendLinks(chatId, replyExtra);
      return;
    }
    if (inferred?.meta === "check") {
      await handleCheck(chatId, text, { req, link, extra: replyExtra });
      return;
    }
    if (inferred?.meta === "cmds") {
      const page = await handleCmds(text, tools);
      await sendLong(chatId, page.text, { parse_mode: "HTML", ...replyExtra });
      return;
    }
    if (inferred?.meta === "faq") {
      await sendLong(chatId, formatOrbitXFaqHtml(inferred.args?.q || text), {
        parse_mode: "HTML",
        ...replyExtra,
      });
      return;
    }
    if (inferred?.meta === "autobuy") {
      await handleAutoBuy(chatId, text, { isGroup, link, extra: { ...replyExtra, req } });
      return;
    }
    if (inferred?.tool) {
      tool = inferred.tool;
      args = inferred.args;
    } else {
      await tg("sendChatAction", { chat_id: chatId, action: "typing" });
      const prompt = bare === "ask" ? text.replace(/^\S+\s*/, "").trim() || "gm" : text;
      const answer = await askAi(prompt, { linked: Boolean(link) });
      await sendLong(chatId, answer, replyExtra);
      return;
    }
  } else {
    const resolved = resolveOfficialCommand(bare);
    if (resolved.kind === "tool" && resolved.tool) {
      tool = resolved.tool;
      args = argsFromCommand(resolved.command, text);
      if (args.__resolvedTool) tool = args.__resolvedTool;
    }
  }

  if (!tool) {
    if (text.startsWith("/")) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "Unknown command. Try /cmds, /shop, /buy, /links, /check, or /help.",
        ...replyExtra,
      });
    }
    return;
  }

  const mintArg = String(args.mint || args.ca || extractMint(text) || "").trim();
  if (TOKEN_INTEL_TOOLS.has(tool) && mintArg) {
    await tg("sendChatAction", { chat_id: chatId, action: "typing" });
    try {
      const merged = await buildBrandedScan(mintArg, { req, link, isGroup });
      await sendLong(chatId, formatOrbitXTelegramResult(merged), { parse_mode: "HTML", ...replyExtra });
      await sendMedia(chatId, collectMediaUrls(merged));
    } catch (error) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: `OrbitX scan error: ${error?.message || error}`,
        ...replyExtra,
      });
    }
    return;
  }

  await tg("sendChatAction", {
    chat_id: chatId,
    action: tool.includes("video") ? "upload_video" : tool.includes("image") || tool.includes("grok") ? "upload_photo" : "typing",
  });
  try {
    args = withTelegramToolArgs(tool, args);
    const result = await runTool({
      tool,
      args,
      req,
      link,
      allowPrivileged: !isGroup && Boolean(link),
    });
    const taskId = parseTaskId(result);
    let job = null;
    if (taskId && isMediaGenTool(tool)) {
      job = await rememberMediaJob({
        chatId,
        fromId: from.id,
        taskId,
        kind: mediaKindForTool(tool, result?.kind),
        prompt: args.prompt,
      });
    }
    await replyToolResult(chatId, result, { tool, extra: replyExtra, job });
  } catch (error) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `OrbitX tool error: ${error?.message || error}`,
      ...replyExtra,
    });
  }
}

async function configureBot(req) {
  if (!BOT_TOKEN) return { ok: false, error: "TELEGRAM_ORBITX_BOT_TOKEN is not set" };
  const base = officialOrigin();
  const webhookUrl = `${base}/api/telegram-orbitx`;
  const me = await tg("getMe", {});
  const name = await tg("setMyName", { name: OFFICIAL_BOT_NAME });
  const short = await tg("setMyShortDescription", { short_description: OFFICIAL_BOT_SHORT.slice(0, 120) });
  const about = await tg("setMyDescription", { description: OFFICIAL_BOT_ABOUT.slice(0, 512) });
  const groupCmds = await tg("setMyCommands", {
    commands: GROUP_COMMANDS.slice(0, 100),
    scope: { type: "all_group_chats" },
  });
  const privateCmds = await tg("setMyCommands", {
    commands: PRIVATE_COMMANDS.slice(0, 100),
    scope: { type: "all_private_chats" },
  });
  const defaultCmds = await tg("setMyCommands", { commands: GROUP_COMMANDS.slice(0, 100) });
  const webhook = await tg("setWebhook", {
    url: webhookUrl,
    secret_token: process.env.TELEGRAM_ORBITX_WEBHOOK_SECRET || undefined,
    allowed_updates: ["message", "edited_message", "channel_post", "callback_query"],
    drop_pending_updates: false,
  });
  const photo = await setBotPhoto(base);
  return {
    ok: Boolean(me?.ok && webhook?.ok),
    me: me?.result || null,
    webhook: webhook?.ok ? webhookUrl : webhook,
    name,
    short,
    about,
    photo,
    groupCmds: groupCmds?.ok,
    privateCmds: privateCmds?.ok,
    defaultCmds: defaultCmds?.ok,
  };
}

async function setBotPhoto(base) {
  try {
    const url = `${base}/brand/orbitx-telegram-bot.png`;
    const img = await fetch(url);
    if (!img.ok) return { ok: false, skipped: true, status: img.status };
    const buf = Buffer.from(await img.arrayBuffer());
    const form = new FormData();
    form.append("photo", JSON.stringify({ type: "static", photo: "attach://pic" }));
    form.append("pic", new Blob([buf], { type: "image/png" }), "orbitx-telegram-bot.png");
    return tg("setMyProfilePhoto", null, { form });
  } catch (error) {
    return { ok: false, error: error?.message || "photo_failed" };
  }
}

let lastWebhookEnsure = 0;
const WEBHOOK_ENSURE_MS = 5 * 60_000;

async function ensureWebhook(req) {
  if (!BOT_TOKEN) return { ok: false, skipped: true, error: "no_token" };
  const want = `${officialOrigin()}/api/telegram-orbitx`;
  if (Date.now() - lastWebhookEnsure < WEBHOOK_ENSURE_MS) {
    return { ok: true, cached: true, url: want };
  }
  lastWebhookEnsure = Date.now();
  const info = await tg("getWebhookInfo", {});
  const current = String(info?.result?.url || "");
  if (current === want) return { ok: true, already: true, url: want };
  return configureBot(req);
}

async function handleWeb(req, res, body) {
  const action = String(body.action || "").toLowerCase();
  const user = await getJwtUser(req);
  const hub = await import("./orbitx-hub.js");

  if (action === "web.status") {
    let links = [];
    if (user?.id) {
      links = await sb(
        `telegram_orbitx_links?user_id=eq.${encodeURIComponent(user.id)}&select=telegram_user_id,telegram_username,wallet_address,created_at&limit=5`,
      ).catch(() => []);
    }
    return json(res, {
      ok: true,
      bot: { username: OFFICIAL_BOT_USERNAME, name: OFFICIAL_BOT_NAME, about: OFFICIAL_BOT_SHORT },
      signedIn: Boolean(user?.id),
      links: Array.isArray(links) ? links : [],
      tools: hub.listAllOrbitXTools().length,
    });
  }

  if (action === "web.cmds") {
    const tools = hub.listAllOrbitXTools();
    const page = await handleCmds(`/cmds ${body.query || body.page || ""}`, tools);
    return json(res, { ok: true, ...page, tools: tools.slice(0, 80) });
  }

  if (action === "web.link") {
    if (!user?.id) return json(res, { error: "unauthorized", message: "Sign in with your OrbitX wallet first." }, 401);
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) return json(res, { error: "code_required" }, 400);
    const rows = await sb(
      `telegram_orbitx_login_codes?code=eq.${encodeURIComponent(code)}&select=*&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return json(res, { error: "invalid_code" }, 404);
    if (row.consumed_at) return json(res, { error: "code_already_used" }, 409);
    if (new Date(row.expires_at).getTime() <= Date.now()) return json(res, { error: "code_expired" }, 410);
    const telegramUserId = String(row.telegram_user_id);
    const wallet = await loadWallet(user.id);
    const link = {
      telegram_user_id: telegramUserId,
      user_id: user.id,
      telegram_username: row.telegram_username,
      wallet_address: wallet,
      updated_at: new Date().toISOString(),
    };
    await sb(
      `telegram_orbitx_links?user_id=eq.${encodeURIComponent(user.id)}&telegram_user_id=neq.${encodeURIComponent(telegramUserId)}`,
      { method: "DELETE" },
    ).catch(() => null);
    const existing = await loadLink(telegramUserId);
    if (existing) {
      await sb(`telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(telegramUserId)}`, {
        method: "PATCH",
        body: JSON.stringify(link),
      });
    } else {
      await sb("telegram_orbitx_links", { method: "POST", body: JSON.stringify(link) });
    }
    await sb(`telegram_orbitx_login_codes?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    });
    if (BOT_TOKEN) {
      await tg("sendMessage", {
        chat_id: telegramUserId,
        text: "OrbitX linked. This Telegram can now /buy /trade /orbitx /shop /launch /mint for YOUR wallet only. /autobuy on for Phantom auto-prompt.",
      });
    }
    return json(res, { ok: true, link: { telegramUserId, wallet } });
  }

  if (action === "web.call") {
    const tool = String(body.tool || "").trim();
    const args = body.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : {};
    const privileged = isPrivilegedTelegramTool(tool) || tool === "x_post";
    if (privileged && !user?.id) {
      return json(res, { error: "unauthorized", message: "Sign in with your OrbitX wallet to run this tool." }, 401);
    }
    const wallet = user?.id ? await loadWallet(user.id) : null;
    const toolArgs = withTelegramToolArgs(tool, args);
    const mint = String(toolArgs.mint || toolArgs.ca || "").trim();
    if (TOKEN_INTEL_TOOLS.has(tool) && mint) {
      const merged = await buildBrandedScan(mint, {
        req,
        link: user?.id ? { user_id: user.id, wallet_address: wallet } : null,
        isGroup: false,
      });
      return json(res, {
        ok: true,
        tool,
        text: formatOrbitXTelegramResult(merged),
        imageUrls: collectMediaUrls(merged),
        result: merged,
      });
    }
    const result = await runTool({
      tool,
      args: toolArgs,
      req,
      link: user?.id ? { user_id: user.id, wallet_address: wallet } : null,
      allowPrivileged: Boolean(user?.id),
    });
    return json(res, {
      ok: result?.ok !== false,
      tool,
      text: formatOrbitXTelegramResult(result),
      imageUrls: collectMediaUrls(result),
      result,
    });
  }

  return json(res, { error: "unknown_web_action" }, 400);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token");
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url || "/", FALLBACK);
      const action = String(url.searchParams.get("action") || "health");
      if (action === "configure") {
        const provided =
          url.searchParams.get("secret") ||
          header(req, "x-orbitx-telegram-secret") ||
          "";
        if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
          return json(res, { error: "forbidden" }, 403);
        }
        return json(res, await configureBot(req));
      }
      const hub = await import("./orbitx-hub.js");
      const webhook = await ensureWebhook(req).catch((error) => ({
        ok: false,
        error: error?.message || "ensure_failed",
      }));
      return json(res, {
        ok: true,
        service: "telegram-orbitx",
        bot: OFFICIAL_BOT_USERNAME,
        tools: hub.listAllOrbitXTools().length,
        tokenConfigured: Boolean(BOT_TOKEN),
        webhook: webhook?.url || webhook,
        webhookOk: webhook?.ok !== false,
      });
    }

    if (req.method !== "POST") return json(res, { error: "method_not_allowed" }, 405);
    const secret = header(req, "x-telegram-bot-api-secret-token");
    const body = await readBody(req);

    if (String(body.action || "").startsWith("web.")) {
      return handleWeb(req, res, body);
    }

    if (WEBHOOK_SECRET && secret && secret !== WEBHOOK_SECRET) {
      res.statusCode = 403;
      return res.end("forbidden");
    }

    // Telegram webhook updates have update_id; never require JWT.
    if (body.update_id != null || body.message || body.channel_post) {
      await handleTelegramUpdate(body, req);
      return ok(res);
    }

    return json(res, { error: "unknown_payload" }, 400);
  } catch (error) {
    console.error("[telegram-orbitx]", error);
    if (header(req, "x-telegram-bot-api-secret-token") || req.method === "POST") return ok(res);
    return json(res, { error: error?.message || "internal_error" }, 500);
  }
}
