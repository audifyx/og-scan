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
  applyDefaultBuyAmount,
  deskKeyboard,
  cmdsPage,
  collectMediaUrls,
  extractMint,
  formatFamilyMenu,
  formatGroupWelcomeHtml,
  formatHelpDesk,
  formatTelegramStartGate,
  formatMediaCountdown,
  formatOrbitXFaqHtml,
  formatOrbitXTelegramResult,
  formatToolMenu,
  inferPublicTool,
  isPublicGroupTrigger,
  isOfficialBotUsername,
  orbitXFaqSystemAddon,
  isPrivilegedTelegramTool,
  isTelegramAdminWallet,
  loginCode,
  mediaEtaSeconds,
  mergeTokenScanPayloads,
  missingToolInput,
  parseCallInvocation,
  resolveOfficialCommand,
  shouldSkipTelegramSender,
  telegramChatExtras,
  telegramMessageParts,
  TOKEN_INTEL_TOOLS,
} from "./orbitx/telegram-orbitx-lib.js";
import {
  accessStatusFromRow,
  isOrbitXBetaCode,
  loadTelegramBotAccess,
  looksLikeEarlyAccessCode,
  looksLikeSolanaTxRef,
  parseSolanaTxSignature,
  redeemEarlyAccessCode,
  resolveBurnPackageFromText,
  upsertTelegramBotAccess,
} from "./orbitx/telegram-bot-access.js";
import { confirmAccessBurn, prepareAccessMcpPurchase } from "./orbitx/mcp-burn-access.js";
import {
  DEFAULT_TELEGRAM_NIM_MODEL,
  formatOrbitXLinksHtml,
  OFFICIAL_ORBITX_TELEGRAM_SYSTEM,
  ORBITX_GC,
  ORBITX_MINT,
} from "./orbitx/orbitx-telegram-knowledge.js";
import { fetchTelegramTokenSnapshot, hasMarketSnapshot, looksLikeFailedQuoteCard, looksLikeOrbitXCard } from "./orbitx/telegram-token-snapshot.js";
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
  const data = await r.json().catch(() => ({ ok: false }));
  return { ...data, httpStatus: r.status };
}

async function sendLong(chatId, text, extra = {}) {
  const MAX = 3800;
  const { reply_markup, ...rest } = extra;
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
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const payload = {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: rest.parse_mode === "HTML" ? false : true,
      ...rest,
    };
    if (reply_markup && i === chunks.length - 1) payload.reply_markup = reply_markup;
    last = await tg("sendMessage", payload);
    const delivered = last?.ok === true || last?.httpStatus === 200;
    if (!delivered && rest.parse_mode) {
      last = await tg("sendMessage", {
        chat_id: chatId,
        text: chunk.replace(/<[^>]+>/g, ""),
        disable_web_page_preview: true,
        ...(reply_markup && i === chunks.length - 1 ? { reply_markup } : {}),
        ...(rest.message_thread_id != null ? { message_thread_id: rest.message_thread_id } : {}),
        ...(rest.reply_to_message_id != null
          ? { reply_to_message_id: rest.reply_to_message_id, allow_sending_without_reply: true }
          : {}),
      });
    }
  }
  return last;
}

async function sendMedia(chatId, urls, extra = {}) {
  const thread = extra.message_thread_id != null ? { message_thread_id: extra.message_thread_id } : {};
  for (const media of urls || []) {
    const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(media) || /video/i.test(media);
    if (isVid) await tg("sendVideo", { chat_id: chatId, video: media, ...thread });
    else await tg("sendPhoto", { chat_id: chatId, photo: media, ...thread });
  }
}

function typingBody(chatId, extra = {}, action = "typing") {
  const body = { chat_id: chatId, action };
  if (extra.message_thread_id != null) body.message_thread_id = extra.message_thread_id;
  return body;
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

const BUY_TOOL_ALIASES = {
  orbitx_trade: "orbitx_prepare_buy",
  orbitx_swap: "orbitx_prepare_buy",
  trade: "orbitx_prepare_buy",
  swap: "orbitx_prepare_buy",
  orbitx_buy: "orbitx_prepare_buy",
  orbitx_buy_auto: "orbitx_prepare_buy",
};

async function runTool({ tool, args, req, link, allowPrivileged }) {
  const hub = await import("./orbitx-hub.js");
  const requested = String(tool || "").trim();
  if (!requested) return { ok: false, error: "tool_required" };
  const aliased = BUY_TOOL_ALIASES[requested] || BUY_TOOL_ALIASES[requested.toLowerCase()] || requested;
  const name =
    hub.resolveOrbitXToolName(aliased) ||
    hub.resolveOrbitXToolName(requested) ||
    hub.resolveEmbeddedAgentToolName(aliased) ||
    aliased;
  if (!hub.hasEmbeddedAgentTool(name) && name !== "x_post") {
    return {
      ok: false,
      error: `Unknown OrbitX tool: ${requested}`,
      message: `Unknown OrbitX tool: ${requested}. Try /cmds or /call prepare_buy. Live catalog has ${hub.listAllOrbitXTools().length} tools.`,
      hint: "/cmds · /shop · /buy CA 0.1 sol · /login in DM",
    };
  }
  const privileged =
    isPrivilegedTelegramTool(name) || isPrivilegedTelegramTool(requested) || name === "x_post";
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
  const cleanArgs = applyDefaultBuyAmount(name, args);
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
      if (!link.wallet_address && link.telegram_user_id) {
        await sb(`telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(String(link.telegram_user_id))}`, {
          method: "PATCH",
          body: JSON.stringify({ wallet_address: wallet, updated_at: new Date().toISOString() }),
        }).catch(() => null);
      }
    }
    if (link.auto_buy && /buy|trade|swap|confirm_buy/.test(name)) {
      if (cleanArgs.autoConfirm !== false) cleanArgs.autoConfirm = true;
    }
    if (!wallet && /buy|sell|launch|mint|credits|access|nft_prepare|nft_submit|burn|claim/.test(name)) {
      return {
        ok: false,
        error: "wallet_required",
        message: "Connect Phantom on https://www.orbitx.world/telegram after /login, then send /buy again.",
        loginUrl: "https://www.orbitx.world/telegram",
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
  // Quote Dex/Jupiter/Gecko first. Never self-HTTP /api/ogdex/* from this webhook —
  // same-isolate calls hang and abort the live quote (TOKEN cards / "no live quote").
  const snapshot = await fetchTelegramTokenSnapshot(mint).catch((error) => {
    console.warn("[telegram-orbitx] snapshot", error?.message || error);
    return null;
  });
  const verified = await lookupVerifiedMint(mint).catch(() => null);
  void req;
  void link;
  void isGroup;
  return mergeTokenScanPayloads({
    token: snapshot,
    verified,
  });
}

async function handleVerify(chatId, text, { isGroup, from, link, extra }) {
  if (isGroup) {
    await sendLong(
      chatId,
      "Send /verify in a private DM with @theorbitxmcpbot — paste the Solscan burn link, or (admin) a mint CA.",
      extra,
    );
    return;
  }

  const rest = String(text || "").replace(/^\S+\s*/, "").trim();
  const sig = parseSolanaTxSignature(rest || text);
  if (sig && (looksLikeSolanaTxRef(rest || text) || rest)) {
    await verifyAccessBurn(chatId, sig, { from, link, extra });
    return;
  }

  if (!rest) {
    await sendAccessStatus(chatId, from, extra);
    return;
  }

  if (!link?.user_id) {
    await sendLong(chatId, "To verify a burn, paste the Solscan tx link. To admin-verify a mint, /login first.", extra);
    return;
  }
  if (!isTelegramAdminWallet(link.wallet_address)) {
    await sendLong(
      chatId,
      "Paste the Solscan burn link after /verify (or send the tx signature). Mint /verify is admin-only.",
      extra,
    );
    return;
  }
  const mint = extractMint(text);
  if (!mint) {
    await sendLong(chatId, "Usage: /verify &lt;Solscan tx link&gt;  ·  or admin: /verify CA", extra);
    return;
  }
  let symbol = null;
  let name = null;
  try {
    const token = await raceTimeout(fetchTelegramTokenSnapshot(mint), 8_000);
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

async function sendAccessStatus(chatId, from, extra = {}) {
  const row = await loadTelegramBotAccess(sb, from?.id);
  const status = accessStatusFromRow(row);
  if (!status.active) {
    await sendLong(
      chatId,
      "No access yet. Share <code>ORBITX BETA</code> on /start (first 25 get lifetime), or burn $ORBITX for timed access, then /verify the Solscan link.",
      { parse_mode: "HTML", ...extra },
    );
    return status;
  }
  await sendLong(
    chatId,
    [
      "<b>OrbitX access</b>",
      `Time left: <b>${status.remainingLabel}</b>`,
      status.source ? `Source: ${status.source}${status.packageId ? ` · ${status.packageId}` : ""}` : "",
      "Public intel still works in groups. Linked DMs unlock /trade /shop /tweet while access is active.",
    ]
      .filter(Boolean)
      .join("\n"),
    { parse_mode: "HTML", ...extra },
  );
  return status;
}

async function handleStartDm(chatId, from, link, extra) {
  const row = await loadTelegramBotAccess(sb, from?.id);
  const status = accessStatusFromRow(row);
  await sendCard(
    chatId,
    formatTelegramStartGate({
      remainingLabel: status.active ? status.remainingLabel : "",
      linked: Boolean(link),
    }),
    extra,
  );
}

async function handleCode(chatId, text, { isGroup, from, link, extra }) {
  if (isGroup) {
    await sendLong(chatId, "Redeem codes in a private DM with @theorbitxmcpbot: /code YOURCODE", extra);
    return;
  }
  const rest = String(text || "")
    .replace(/^\/?(?:code|redeem)(?:@\w+)?\s*/i, "")
    .trim();
  if (!looksLikeEarlyAccessCode(rest)) {
    awaitingCode.set(String(from.id), Date.now());
    await sendLong(
      chatId,
      "Paste <code>ORBITX BETA</code> here, or send <code>/code ORBITX BETA</code>. First 25 get lifetime MCP.",
      { parse_mode: "HTML", ...extra },
    );
    return;
  }
  awaitingCode.delete(String(from.id));
  const out = await redeemEarlyAccessCode(sb, {
    telegramUserId: String(from.id),
    userId: link?.user_id || null,
    wallet: link?.wallet_address || null,
    code: rest,
  });
  if (!out.ok) {
    await sendLong(chatId, out.message || "That code did not work. Try again or burn $ORBITX.", extra);
    return;
  }
  const lifetime = out.packageId === "lifetime" || out.remainingLabel === "lifetime";
  await sendLong(
    chatId,
    lifetime
      ? `<b>${out.message || "Lifetime MCP unlocked"}</b>\nYou have <b>lifetime</b> access.\n/trade /shop /tweet work in this DM after /login.`
      : `<b>Access unlocked</b>\nYou have <b>${out.remainingLabel}</b>.\n/trade /shop /tweet work in this DM after /login.`,
    { parse_mode: "HTML", ...extra },
  );
}

async function startAccessBurn(chatId, from, packageId, { isGroup, req, link, extra }) {
  if (isGroup) {
    await sendLong(chatId, "Burns are private. DM @theorbitxmcpbot, /login, then tap a burn on /start.", extra);
    return;
  }
  if (!link?.user_id || !link?.wallet_address) {
    await sendLong(
      chatId,
      "First <code>/login</code> so the buy-and-burn is for YOUR wallet. Then tap the burn again.",
      { parse_mode: "HTML", ...extra },
    );
    return;
  }
  const pkg = String(packageId || "").trim().toLowerCase();
  if (!["hour", "day", "week", "month"].includes(pkg)) {
    await handleStartDm(chatId, from, link, extra);
    return;
  }
  pendingBurnPkg.set(String(from.id), pkg);
  const out = prepareAccessMcpPurchase({
    base: publicBase(req),
    wallet: link.wallet_address,
    packageId: pkg,
  });
  if (!out?.ok) {
    await sendLong(chatId, out?.message || "Could not prepare the buy-and-burn. Try /login again.", extra);
    return;
  }
  await sendCard(chatId, formatOrbitXTelegramResult(out, "orbitx_mcp_access_buy"), extra);
  await sendLong(
    chatId,
    [
      "One Jupiter sign <b>buys then burns</b> in the same transaction.",
      "When it lands, copy the Solscan tx link and send:",
      "<code>/verify https://solscan.io/tx/SIGNATURE</code>",
      "I’ll confirm the burn and tell you how long you have left.",
    ].join("\n"),
    { parse_mode: "HTML", ...extra },
  );
}

async function handleBurn(chatId, text, { isGroup, from, req, link, extra }) {
  if (isGroup) {
    await sendLong(chatId, "Burns are private. DM @theorbitxmcpbot, /login, then /burn hour (or day / week / month).", extra);
    return;
  }
  const pkg = resolveBurnPackageFromText(text);
  if (!pkg?.id) {
    await handleStartDm(chatId, from, link, extra);
    return;
  }
  await startAccessBurn(chatId, from, pkg.id, { isGroup, req, link, extra });
}

async function verifyAccessBurn(chatId, signature, { from, link, extra }) {
  const pkg = pendingBurnPkg.get(String(from?.id || "")) || null;
  let confirmed;
  try {
    confirmed = await confirmAccessBurn(sb, {
      userId: link?.user_id || null,
      signature,
      packageId: pkg,
      wallet: link?.wallet_address || null,
    });
  } catch (error) {
    await sendLong(chatId, `Could not verify that burn: ${error?.message || error}`, extra);
    return;
  }
  if (!confirmed?.ok) {
    await sendLong(chatId, confirmed?.message || "That transaction is not a matching $ORBITX burn yet. Wait a few seconds and /verify the Solscan link again.", extra);
    return;
  }
  const saved = await upsertTelegramBotAccess(sb, {
    telegram_user_id: String(from.id),
    user_id: link?.user_id || null,
    wallet_address: confirmed.walletAddress || confirmed.wallet || link?.wallet_address || null,
    source: "burn",
    package_id: confirmed.packageId || pkg,
    tx_signature: signature,
    expires_at: confirmed.expiresAt,
  });
  pendingBurnPkg.delete(String(from.id));
  const explorer = confirmed.explorer || `https://solscan.io/tx/${signature}`;
  const schemaNote =
    saved?.error === "access_write_failed" || confirmed.schemaMissing
      ? "\nApply the telegram_bot_access SQL migration if remaining time does not persist."
      : "";
  await sendLong(
    chatId,
    [
      "<b>Burn verified</b>",
      confirmed.message || "Access granted.",
      confirmed.remainingLabel ? `Time left: <b>${confirmed.remainingLabel}</b>` : "",
      `<a href="${explorer}">Solscan</a>`,
      schemaNote,
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
  return formatHelpDesk(isPrivate, linked);
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
const scanCooldown = new Map();
const seenUpdateIds = new Map();
const awaitingCode = new Map();
const pendingBurnPkg = new Map();

function alreadyHandledUpdate(updateId) {
  const id = Number(updateId);
  if (!Number.isFinite(id)) return false;
  const prev = seenUpdateIds.get(id);
  if (prev && Date.now() - prev < 120_000) return true;
  seenUpdateIds.set(id, Date.now());
  if (seenUpdateIds.size > 800) {
    const cutoff = Date.now() - 180_000;
    for (const [k, ts] of seenUpdateIds) {
      if (ts < cutoff) seenUpdateIds.delete(k);
    }
  }
  return false;
}

function scanCooldownKey(chatId, mint) {
  return `${chatId}:${String(mint || "").trim().toLowerCase()}`;
}

function recentlyScanned(chatId, mint) {
  const id = String(mint || "").trim().toLowerCase();
  if (!id || chatId == null) return false;
  const prev = scanCooldown.get(scanCooldownKey(chatId, mint));
  return Boolean(prev && Date.now() - prev < 25_000);
}

function rememberSuccessfulScan(chatId, mint) {
  const id = String(mint || "").trim().toLowerCase();
  if (!id || chatId == null) return;
  scanCooldown.set(scanCooldownKey(chatId, mint), Date.now());
  if (scanCooldown.size > 2000) {
    const cutoff = Date.now() - 90_000;
    for (const [k, ts] of scanCooldown) {
      if (ts < cutoff) scanCooldown.delete(k);
    }
  }
}

function forgetScan(chatId, mint) {
  scanCooldown.delete(scanCooldownKey(chatId, mint));
}

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
    ? "This user is linked to their OrbitX account in a private DM — they can /trade /buy /sell /tweet /post."
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
    { parse_mode: "HTML", reply_markup: deskKeyboard(), ...extra },
  );
}

function withTelegramToolArgs(tool, args) {
  const next = applyDefaultBuyAmount(tool, args);
  if (!isMediaGenTool(tool)) return next;
  return { ...next, wait: false };
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
  await sendCard(chatId, formatOrbitXTelegramResult(timed, tool), extra);
  await sendMedia(chatId, collectMediaUrls(timed || result), extra);
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
    await sendCard(chatId, formatOrbitXTelegramResult(result, "orbitx_media_status"), extra);
    return;
  }
  if (state === "success" || state === "succeeded" || state === "completed" || state === "done") {
    await markMediaJob(taskId, "succeeded");
    await sendCard(chatId, formatMediaCountdown({ kind, taskId, state: "success" }), extra);
    await sendMedia(chatId, collectMediaUrls(result), extra);
    return;
  }
  if (state === "fail" || state === "failed" || state === "error") {
    await markMediaJob(taskId, "failed");
    await sendCard(
      chatId,
      formatMediaCountdown({
        kind,
        taskId,
        state: "fail",
        failMsg: result?.failMsg || result?.error || result?.message,
      }),
      extra,
    );
    return;
  }
  await sendCard(
    chatId,
    formatMediaCountdown({
      kind,
      taskId,
      startedAt: startedAtMs(job, result),
      etaSeconds: Number(job?.eta_seconds) > 0 ? Number(job.eta_seconds) : mediaEtaSeconds(kind),
      state: result?.state || "waiting",
    }),
    extra,
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
    "3. Confirm. Then /trade /buy /sell /tweet /post work in this DM.",
  ].join("\n");
}

async function sendCard(chatId, formatted, extra = {}) {
  const parts = telegramMessageParts(formatted);
  return sendLong(chatId, parts.text, {
    parse_mode: "HTML",
    reply_markup: parts.reply_markup,
    ...extra,
  });
}

async function handleCallbackQuery(cq, req) {
  const data = String(cq?.data || "").trim();
  const chatId = cq?.message?.chat?.id;
  const from = cq?.from || {};
  const { extra } = telegramChatExtras(cq?.message);
  if (cq?.id) await tg("answerCallbackQuery", { callback_query_id: cq.id });
  if (!chatId || !data.startsWith("ox:")) return;
  const key = data.slice(3);
  if (key === "links") {
    await sendLinks(chatId, extra);
    return;
  }
  if (key.startsWith("chart:")) {
    const mint = key.slice(6);
    if (!mint) return;
    await tg("sendChatAction", typingBody(chatId, extra));
    try {
      const result = await runTool({
        tool: "orbitx_dex_chart",
        args: { mint, ca: mint },
        req,
        link: from.id ? await loadLink(from.id) : null,
        allowPrivileged: false,
      });
      await sendCard(chatId, formatOrbitXTelegramResult(result, "orbitx_dex_chart"), extra);
    } catch (error) {
      await tg("sendMessage", { chat_id: chatId, text: `Chart error: ${error?.message || error}`, ...extra });
    }
    return;
  }
  if (key.startsWith("gate:")) {
    const gate = key.slice(5);
    const chatType = String(cq?.message?.chat?.type || "");
    const isGroup = chatType === "group" || chatType === "supergroup";
    const link = from.id ? await loadLink(from.id) : null;
    if (gate === "beta") {
      await handleCode(chatId, "/code ORBITX BETA", { isGroup, from, link, extra });
      return;
    }
    if (gate === "code") {
      awaitingCode.set(String(from.id), Date.now());
      await sendLong(
        chatId,
        "Paste <code>ORBITX BETA</code> here, or send <code>/code ORBITX BETA</code>. First 25 supporters get lifetime MCP.",
        { parse_mode: "HTML", ...extra },
      );
      return;
    }
    if (gate === "login") {
      if (isGroup) {
        await sendLong(chatId, "Login is private. Message @theorbitxmcpbot and send /login.", extra);
        return;
      }
      try {
        const body = await startLogin(from, publicBase(req));
        await sendLong(chatId, body, { parse_mode: "HTML", ...extra });
      } catch (error) {
        await sendLong(chatId, `Could not start login: ${error?.message || error}`, extra);
      }
      return;
    }
    if (["hour", "day", "week", "month"].includes(gate)) {
      await startAccessBurn(chatId, from, gate, { isGroup, req, link, extra });
      return;
    }
  }
  await sendCard(chatId, formatFamilyMenu(key), extra);
}

async function handleMyChatMember(update) {
  const m = update?.my_chat_member;
  if (!m) return;
  const chat = m.chat || {};
  const isGroup = chat.type === "group" || chat.type === "supergroup";
  if (!isGroup || !chat.id) return;
  const status = String(m.new_chat_member?.status || "");
  const old = String(m.old_chat_member?.status || "");
  if (!["member", "administrator"].includes(status)) return;
  if (["member", "administrator"].includes(old)) return;
  const extra = {};
  const thread = Number(m.message_thread_id);
  if (Number.isFinite(thread) && thread > 0) extra.message_thread_id = thread;
  await sendLong(chat.id, formatGroupWelcomeHtml(), { parse_mode: "HTML", ...extra });
}

async function handleTelegramUpdate(update, req) {
  if (alreadyHandledUpdate(update?.update_id)) return;
  if (update.my_chat_member) {
    await handleMyChatMember(update);
    return;
  }
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, req);
    return;
  }
  const msg = update.message || update.edited_message || update.channel_post;
  if (!msg) return;
  const chatId = msg.chat?.id;
  if (!chatId) return;
  const from = msg.from || {};
  if (shouldSkipTelegramSender(msg)) return;
  let text = String(msg.text || msg.caption || "").trim();
  const quoted = String(msg.reply_to_message?.text || msg.reply_to_message?.caption || "");
  const failedQuote = looksLikeFailedQuoteCard(text) || looksLikeFailedQuoteCard(quoted);
  const stubMint = extractMint(text) || extractMint(quoted);
  if (looksLikeOrbitXCard(text) && !failedQuote) return;
  if (
    quoted &&
    isOfficialBotUsername(msg.reply_to_message?.from?.username) &&
    looksLikeOrbitXCard(quoted) &&
    !failedQuote &&
    (!text || extractMint(text) === extractMint(quoted))
  ) {
    return;
  }
  if (failedQuote && stubMint) text = `/token ${stubMint}`;
  const { isGroup, extra: replyExtra } = telegramChatExtras(msg);
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

  if (!isGroup && !text.startsWith("/") && isOrbitXBetaCode(text)) {
    awaitingCode.delete(String(from.id));
    await handleCode(chatId, `/code ${text.trim()}`, { isGroup, from, link, extra: replyExtra });
    return;
  }

  if (!isGroup && awaitingCode.get(String(from.id)) && !text.startsWith("/")) {
    if (looksLikeEarlyAccessCode(text)) {
      awaitingCode.delete(String(from.id));
      await handleCode(chatId, `/code ${text.trim()}`, { isGroup, from, link, extra: replyExtra });
      return;
    }
    awaitingCode.delete(String(from.id));
  }

  if (!isGroup && looksLikeSolanaTxRef(text) && !text.toLowerCase().startsWith("/token")) {
    await handleVerify(chatId, `/verify ${text}`, { isGroup, from, link, extra: replyExtra });
    return;
  }

  const bare = text.toLowerCase().split(/\s+/)[0].replace(/@.*$/, "").replace(/^\//, "");

  if (isGroup && !isPublicGroupTrigger(text, msg)) return;

  const hub = await import("./orbitx-hub.js");
  const tools = hub.listAllOrbitXTools();

  if (bare === "start") {
    if (isGroup) {
      await sendCard(chatId, helpText(false, Boolean(link)), replyExtra);
      return;
    }
    await handleStartDm(chatId, from, link, replyExtra);
    return;
  }

  if (bare === "help") {
    await sendCard(chatId, helpText(!isGroup, Boolean(link)), replyExtra);
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
    await sendLong(chatId, page.text, { parse_mode: "HTML", reply_markup: page.reply_markup, ...replyExtra });
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
    await handleVerify(chatId, text, { isGroup, from, link, extra: replyExtra });
    return;
  }

  if (bare === "code") {
    await handleCode(chatId, text, { isGroup, from, link, extra: replyExtra });
    return;
  }

  if (bare === "burn") {
    await handleBurn(chatId, text, { isGroup, from, req, link, extra: replyExtra });
    return;
  }

  if (bare === "access") {
    if (isGroup) {
      await sendLong(chatId, "Access status is private. DM @theorbitxmcpbot and send /access.", replyExtra);
      return;
    }
    await sendAccessStatus(chatId, from, replyExtra);
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
      await sendLong(chatId, page.text, { parse_mode: "HTML", reply_markup: page.reply_markup, ...replyExtra });
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
      await tg("sendChatAction", typingBody(chatId, replyExtra));
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

  if (tool === "orbitx_mcp_access_buy" || (tool === "orbitx_shop" && ["hour", "day", "week", "month"].includes(String(args.package || args.packageId || "").trim()))) {
    const pkg =
      String(args.package || args.packageId || "").trim() || resolveBurnPackageFromText(text)?.id || "";
    await startAccessBurn(chatId, from, pkg, { isGroup, req, link, extra: replyExtra });
    return;
  }

  const mintArg = String(args.mint || args.ca || extractMint(text) || "").trim();
  if (
    (tool === "orbitx_prepare_buy" ||
      tool === "orbitx_buy_orbitx" ||
      tool === "orbitx_buy" ||
      tool === "orbitx_trade" ||
      tool === "orbitx_swap" ||
      tool === "orbitx_confirm_buy") &&
    !args.mint &&
    !mintArg
  ) {
    args.mint = ORBITX_MINT;
    args.ca = ORBITX_MINT;
  }
  if (
    (tool === "orbitx_get_wallet" || tool === "orbitx_get_swaps" || tool === "orbitx_get_balance") &&
    !args.address &&
    !args.publicKey &&
    link?.wallet_address
  ) {
    args.address = link.wallet_address;
    args.publicKey = link.wallet_address;
  }
  const needed = missingToolInput(tool, { ...args, mint: args.mint || mintArg, ca: args.ca || mintArg });
  if (needed) {
    await sendCard(chatId, formatToolMenu(tool), replyExtra);
    return;
  }
  if (TOKEN_INTEL_TOOLS.has(tool) && mintArg) {
    await tg("sendChatAction", typingBody(chatId, replyExtra));
    try {
      const merged = await buildBrandedScan(mintArg, { req, link, isGroup });
      if (hasMarketSnapshot(merged?.token || merged)) {
        rememberSuccessfulScan(chatId, mintArg);
      } else {
        forgetScan(chatId, mintArg);
      }
      await sendCard(chatId, formatOrbitXTelegramResult(merged, tool), replyExtra);
      await sendMedia(chatId, collectMediaUrls(merged), replyExtra);
    } catch (error) {
      forgetScan(chatId, mintArg);
      await tg("sendMessage", {
        chat_id: chatId,
        text: `OrbitX scan error: ${error?.message || error}`,
        ...replyExtra,
      });
    }
    return;
  }

  await tg(
    "sendChatAction",
    typingBody(
      chatId,
      replyExtra,
      tool.includes("video") ? "upload_video" : tool.includes("image") || tool.includes("grok") ? "upload_photo" : "typing",
    ),
  );
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
    allowed_updates: ["message", "edited_message", "channel_post", "callback_query", "my_chat_member"],
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
        `telegram_orbitx_links?user_id=eq.${encodeURIComponent(user.id)}&select=telegram_user_id,telegram_username,wallet_address,auto_buy,created_at&limit=5`,
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
    let autoBuy = false;
    let tgLink = user?.id ? { user_id: user.id, wallet_address: wallet } : null;
    if (user?.id) {
      const rows = await sb(
        `telegram_orbitx_links?user_id=eq.${encodeURIComponent(user.id)}&select=telegram_user_id,user_id,wallet_address,auto_buy&limit=1`,
      ).catch(() => []);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        autoBuy = Boolean(row.auto_buy);
        tgLink = {
          telegram_user_id: row.telegram_user_id,
          user_id: user.id,
          wallet_address: row.wallet_address || wallet,
          auto_buy: autoBuy,
        };
      }
    }
    const toolArgs = withTelegramToolArgs(tool, args);
    if (
      (tool === "orbitx_prepare_buy" ||
        tool === "orbitx_buy_orbitx" ||
        tool === "orbitx_buy" ||
        tool === "orbitx_trade" ||
        tool === "orbitx_swap" ||
        tool === "orbitx_confirm_buy") &&
      !toolArgs.mint &&
      !toolArgs.ca
    ) {
      toolArgs.mint = ORBITX_MINT;
      toolArgs.ca = ORBITX_MINT;
    }
    if (autoBuy && /buy|trade|swap|confirm_buy/.test(tool) && toolArgs.autoConfirm !== false) {
      toolArgs.autoConfirm = true;
    }
    const mint = String(toolArgs.mint || toolArgs.ca || "").trim();
    if (TOKEN_INTEL_TOOLS.has(tool) && mint) {
      const merged = await buildBrandedScan(mint, {
        req,
        link: tgLink,
        isGroup: false,
      });
      return json(res, {
        ok: true,
        tool,
        text: telegramMessageParts(formatOrbitXTelegramResult(merged, tool)).text,
        imageUrls: collectMediaUrls(merged),
        result: merged,
      });
    }
    const result = await runTool({
      tool,
      args: toolArgs,
      req,
      link: tgLink,
      allowPrivileged: Boolean(user?.id),
    });
    return json(res, {
      ok: result?.ok !== false,
      tool,
      text: telegramMessageParts(formatOrbitXTelegramResult(result, tool)).text,
      imageUrls: collectMediaUrls(result),
      result,
    });
  }

  if (action === "web.autobuy") {
    if (!user?.id) return json(res, { error: "unauthorized", message: "Sign in with your OrbitX wallet first." }, 401);
    const enabled = body.enabled === true || body.on === true;
    try {
      await sb(`telegram_orbitx_links?user_id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ auto_buy: enabled, updated_at: new Date().toISOString() }),
      });
    } catch {
      /* column may not exist until migration */
    }
    await runTool({
      tool: "orbitx_trade_auto",
      args: { enabled },
      req,
      link: { user_id: user.id, wallet_address: await loadWallet(user.id) },
      allowPrivileged: true,
    }).catch(() => null);
    return json(res, {
      ok: true,
      autoBuy: enabled,
      message: enabled
        ? "Auto-sign ON. Next /buy opens Phantom immediately. You still approve in the wallet."
        : "Auto-sign OFF. Each buy waits for you to tap Sign.",
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
        sha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        trade: "orbitx_prepare_buy",
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
    if (body.update_id != null || body.message || body.channel_post || body.callback_query || body.my_chat_member) {
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
