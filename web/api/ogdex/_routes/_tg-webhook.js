/**
 * POST /api/ogdex/tg-webhook — Telegram webhook for @orbitxapirbot.
 *
 * Receives bot updates (commands + plain messages) and answers them.
 * Read-only scanner, same v1 scope as the Mini App: no wallet, no trading,
 * no payments, no links out.
 *
 * How replies work (no bot token on the server): Telegram executes a method
 * returned in the webhook response body — answering with
 * {"method":"sendMessage","chat_id":...,"text":...} makes Telegram send it
 * (Bot API, "Making requests when getting updates"). The server never holds
 * the bot token, so there is no TELEGRAM_BOT_TOKEN env var to leak or rotate.
 *
 * Commands: /start (welcome + Open Scanner button), /help, /scan [mint].
 * Any other text that looks like a Solana mint is scanned directly via
 * scanMint() from ./_tg-scan.js (same data, same real OG engine, same
 * 90s cache as the Mini App endpoint).
 *
 * A scan takes a few seconds (live data + real engine). Telegram retries
 * slow webhook deliveries, so an in-memory seen-set drops duplicate
 * update_ids instead of answering twice.
 *
 * Security notes (v1): no secret_token check — the handler only ever
 * replies to the chat_id inside the update Telegram sent, with read-only
 * scanner output. Add secret_token + a Vercel env var as a hardening step.
 * No persistence: the seen-set lives in function memory.
 *
 * User logging (2026-11-10): every unique update is recorded in Supabase
 * (telegram_bot_users + telegram_bot_events) via the telegram_bot_log RPC,
 * so the operator can see bot stats at /api/ogdex/tg-stats. Only what
 * Telegram already sends with the update is stored (user id, username,
 * first/last name, chat id/type, the kind of action, the token address
 * for a scan). Arbitrary message text is NEVER stored. The log call is
 * awaited before the reply (so the row lands before the function freezes)
 * but it can never break the reply — any failure is swallowed.
 */
import { scanMint } from "./_tg-scan.js";
import { readBody } from "../_lib.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://ibojtmeqgzabgeiwbvhf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function logBotUse({ user, chat, kind, detail }) {
  if (!SERVICE_KEY || !user || user.id == null) return;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/telegram_bot_log`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: user.id,
        p_username: user.username || null,
        p_first_name: user.first_name || null,
        p_last_name: user.last_name || null,
        p_chat_id: chat ? chat.id : null,
        p_chat_type: chat ? chat.type || null : null,
        p_kind: kind,
        p_detail: detail || null,
      }),
    });
    if (!r.ok) console.error("telegram_bot_log failed", r.status);
  } catch (e) {
    console.error("telegram_bot_log error", String((e && e.message) || e).slice(0, 120));
  }
}

const WEBAPP_URL = "https://orbitx.world/tg-scanner.html";
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const seen = new Set(); // update_id — dropped duplicates (Telegram retries)
const SEEN_MAX = 2000;

const APP_URL = "https://orbitx.world/tg-app.html";

function openScannerKeyboard() {
  // Deep links into the main routes — each opens the tg-app shell with
  // ?route=<key>, and the shell loads that route in the iframe (allowlist
  // in tg-app.html). Scanner + the full desktop stay on the first row.
  return {
    inline_keyboard: [
      [{ text: "Scanner", web_app: { url: WEBAPP_URL } }],
      [{ text: "Open OrbitX", web_app: { url: APP_URL } }],
      [{ text: "Social", web_app: { url: APP_URL + "?route=social" } },
       { text: "DEX", web_app: { url: APP_URL + "?route=dex" } }],
      [{ text: "Trade", web_app: { url: APP_URL + "?route=trade" } },
       { text: "NFT Market", web_app: { url: APP_URL + "?route=nft" } }],
      [{ text: "Intel", web_app: { url: APP_URL + "?route=intel" } },
       { text: "Play", web_app: { url: APP_URL + "?route=play" } }],
    ],
  };
}

function fmtUsd(v) {
  if (v == null) return null;
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
}

function fmtPct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return null;
  return (v >= 0 ? "+" : "") + v.toFixed(digits) + "%";
}

function shortNote(s, max = 90) {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function shortAddr(s) {
  if (!s || s.length < 10) return s || null;
  return s.slice(0, 6) + "…" + s.slice(-4);
}

/**
 * Full scan report, in the chat — like a normal TG bot scanner. Paste a CA,
 * get everything here: market, holders, safety, bundle, dev/source, X,
 * clones and the score breakdown. No Mini App needed. Kept under
 * Telegram's 4096-char message limit (truncated as a last resort).
 */
function scanReply(result) {
  const lines = [];
  const short = result.mint.slice(0, 6) + "…" + result.mint.slice(-4);
  const sym = result.symbol || null;
  const nm = result.name || null;
  const title = sym && nm && sym.toLowerCase() !== nm.toLowerCase() ? `${sym} ${nm}` : sym || nm || null;
  lines.push(title ? `${title} (${short})` : `Token ${short}`);
  lines.push(`OG Score: ${result.score ?? "—"}/100 — ${result.verdict}`);
  lines.push("");
  // Market
  if (result.price != null) {
    const chg = result.change24h != null ? ` (${fmtPct(result.change24h)} 24h)` : "";
    lines.push(`Price: $${result.price}${chg}`);
  }
  if (result.marketCap != null) lines.push(`MCAP: ${fmtUsd(result.marketCap)}`);
  if (result.liquidity != null) lines.push(`Liquidity: ${fmtUsd(result.liquidity)}`);
  if (result.volume24h != null) lines.push(`Vol 24h: ${fmtUsd(result.volume24h)}`);
  // Holders
  const holderBits = [];
  if (result.holders != null) holderBits.push(`Holders: ${result.holders}`);
  if (result.topHolderPct != null) holderBits.push(`Top: ${result.topHolderPct}%`);
  if (result.top10Pct != null) holderBits.push(`Top 10: ${result.top10Pct}%`);
  if (holderBits.length) lines.push(holderBits.join(" · "));
  lines.push("");
  // Safety
  lines.push(
    result.honeypot === false
      ? "✅ No honeypot — sell route open"
      : result.honeypot === true
        ? "🚫 Honeypot — no sell route found"
        : "❓ Honeypot — unknown",
  );
  lines.push(
    result.mintAuthority === "revoked"
      ? "✅ Mint authority revoked"
      : result.mintAuthority === "live"
        ? "⚠️ Mint authority still live"
        : "❓ Mint authority — unknown",
  );
  lines.push(
    result.freezeAuthority === "revoked"
      ? "✅ Freeze authority revoked"
      : result.freezeAuthority === "live"
        ? "⚠️ Freeze authority still live"
        : "❓ Freeze authority — unknown",
  );
  lines.push(
    result.lpLockedPct === 100
      ? "✅ LP 100% locked"
      : result.lpLockedPct != null
        ? "⚠️ LP " + result.lpLockedPct + "% locked"
        : "❓ LP lock — unknown",
  );
  if (result.lpBurned === true) lines.push("🔥 LP burned");
  lines.push(
    result.devExited === true
      ? "👋 Dev has exited"
      : result.devExited === false
        ? "✅ Dev still holds"
        : "❓ Dev position — unknown",
  );
  lines.push("");
  // Bundle
  const b = result.bundle;
  if (b && b.available) {
    const bits = [];
    if (b.bundledSupplyPct != null) bits.push(`${b.bundledSupplyPct.toFixed(1)}% bundled`);
    if (b.clusterCount != null) bits.push(`${b.clusterCount} clusters`);
    lines.push(`Bundle: ${bits.join(" · ")} — ${b.verdict || "—"}`);
    const note = shortNote(b.note);
    if (note) lines.push(`  ${note}`);
  } else {
    lines.push("Bundle: unknown — bundle check unavailable");
  }
  // Dev source trace
  const st = result.sourceTrace;
  if (st && st.available) {
    const bits = [];
    const w = shortAddr(st.sourceWallet);
    if (w) bits.push(`Source: ${w}`);
    if (st.sourceTokensCreated != null) bits.push(`${st.sourceTokensCreated} tokens created`);
    if (bits.length) lines.push(bits.join(" · "));
    const note = shortNote(st.note);
    if (note) lines.push(`  ${note}`);
  }
  // X + clones
  const x = result.x;
  if (x) {
    if (x.handle) lines.push(`X: @${x.handle}`);
    else if (x.note) {
      const n = shortNote(x.note);
      if (n) lines.push(`X: ${n}`);
    }
  }
  const cl = result.clones;
  if (cl) lines.push(`Clones: ${cl.label}`);
  lines.push("");
  // Score breakdown (the "why" behind the score)
  const cats = Array.isArray(result.categories) ? result.categories : [];
  if (cats.length) {
    lines.push("Score breakdown:");
    for (const c of cats) {
      const note = shortNote(c.note, 70);
      lines.push(`· ${c.label}: ${note ? note + " " : ""}(${c.points}/${c.max})`);
    }
  }
  if (Array.isArray(result.unknowns) && result.unknowns.length) {
    lines.push(`Not checked yet: ${result.unknowns.join(", ")} — treated as unknown.`);
  }
  lines.push("");
  lines.push("Not financial advice.");
  let text = lines.join("\n");
  if (text.length > 4000) text = text.slice(0, 3997) + "…";
  return text;
}

const START_TEXT =
  "OrbitX — the official OrbitX bot\n\nPaste any Solana token address and I will give you its OG score (0-100) plus the headline checks: honeypot, mint/freeze authority, LP lock/burn, dev exit.\n\nOr jump straight into any part of the platform below — Social, DEX, Trade, NFT Market, Intel, Play — or open the full OrbitX OS desktop.\n\nFree forever. Not financial advice.\n\nTap below to open the scanner or any part of the app, or just send me a token address here.";
const HELP_TEXT =
  "How the scanner works:\n\n• /scan <address> — scan a token, e.g. /scan 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9\n• Or just paste a token address — no command needed.\n• Open the scanner button below for the full score card.\n• The buttons below jump straight into Social, DEX, Trade, NFT Market, Intel, Play — or open the full OrbitX OS desktop.\n\nScores come from the real OrbitX engine: contract, liquidity, holders, dev and trading signals. Unknown means unknown — never guessed. Free forever. Not financial advice.";

function sendMethod(res, payload) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ ok: false, error: "Telegram webhook only — POST a Bot API update." }),
    );
  }

  let update = {};
  try {
    update = await readBody(req);
  } catch {
    update = {};
  }
  const msg = update && update.message;
  if (!msg || typeof msg.text !== "string" || !msg.chat || msg.chat.id == null) {
    // Not a text-message update (edited message, callback, etc.) — ack, send nothing.
    return sendMethod(res, {});
  }
  const chatId = msg.chat.id;

  // Drop duplicate deliveries (Telegram retries slow webhooks).
  if (update.update_id != null) {
    if (seen.has(update.update_id)) return sendMethod(res, {});
    seen.add(update.update_id);
    if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value);
  }

  const text = msg.text.trim();
  const command = text.split(/\s+/)[0].replace(/@.+$/, "").toLowerCase();
  const arg = text.slice(text.split(/\s+/)[0].length).trim();

  // Log the user + what they did (never blocks or breaks the reply).
  const kind =
    command === "/start" ? "start"
    : command === "/help" ? "help"
    : command === "/scan" ? "scan"
    : MINT_RE.test(text) ? "scan"
    : "text";
  const detail =
    kind === "scan" ? (MINT_RE.test(arg) ? arg : MINT_RE.test(text) ? text : null) : null;
  await logBotUse({ user: msg.from, chat: msg.chat, kind, detail });

  const reply = (textOut, extra = {}) =>
    sendMethod(res, { method: "sendMessage", chat_id: chatId, text: textOut, ...extra });

  if (command === "/start") {
    return reply(START_TEXT, { reply_markup: openScannerKeyboard() });
  }
  if (command === "/help") {
    return reply(HELP_TEXT, { reply_markup: openScannerKeyboard() });
  }
  if (command === "/scan") {
    if (!arg) {
      return reply(
        "Send me a token address to scan — e.g. /scan 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9 — or tap below to open the scanner.",
        { reply_markup: openScannerKeyboard() },
      );
    }
    if (!MINT_RE.test(arg)) {
      return reply("That doesn't look like a token address — it should be 32-44 letters and numbers, with no 0, O, I or l.");
    }
    try {
      const result = await scanMint(arg);
      return reply(scanReply(result), { reply_markup: openScannerKeyboard() });
    } catch {
      return reply("Scan failed — the data sources didn't answer. Try again in a moment.");
    }
  }
  if (MINT_RE.test(text)) {
    try {
      const result = await scanMint(text);
      return reply(scanReply(result), { reply_markup: openScannerKeyboard() });
    } catch {
      return reply("Scan failed — the data sources didn't answer. Try again in a moment.");
    }
  }
  return reply(
    "Send a Solana token address to scan it, or /start to open the scanner.",
    { reply_markup: openScannerKeyboard() },
  );
}
