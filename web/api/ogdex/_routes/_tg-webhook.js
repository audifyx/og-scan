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
 */
import { scanMint } from "./_tg-scan.js";
import { readBody } from "../_lib.js";

const WEBAPP_URL = "https://orbitx.world/tg-scanner.html";
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const seen = new Set(); // update_id — dropped duplicates (Telegram retries)
const SEEN_MAX = 2000;

function openScannerKeyboard() {
  return {
    inline_keyboard: [[{ text: "Open Scanner", web_app: { url: WEBAPP_URL } }]],
  };
}

function fmtUsd(v) {
  if (v == null) return null;
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
}

function scanReply(result) {
  const lines = [];
  const short = result.mint.slice(0, 6) + "…" + result.mint.slice(-4);
  lines.push("Token " + short);
  lines.push("OG Score: " + (result.score ?? "—") + "/100 — " + result.verdict);
  if (result.price != null) lines.push("Price: $" + result.price);
  if (result.liquidity != null) lines.push("Liquidity: " + fmtUsd(result.liquidity));
  if (result.holders != null) lines.push("Holders: " + result.holders);
  lines.push("");
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
  if (result.topHolderPct != null) lines.push("Top holder: " + result.topHolderPct + "%");
  lines.push("");
  lines.push("Open the scanner for the full breakdown. Not financial advice.");
  return lines.join("\n");
}

const START_TEXT =
  "OrbitX OG Scanner\n\nPaste any Solana token address and I will give you its OG score (0-100) plus the headline checks: honeypot, mint/freeze authority, LP lock/burn, dev exit.\n\nFree forever. Not financial advice.\n\nTap below to open the scanner, or just send me a token address here.";
const HELP_TEXT =
  "How the scanner works:\n\n• /scan <address> — scan a token, e.g. /scan 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9\n• Or just paste a token address — no command needed.\n• Open the scanner button below for the full score card.\n\nScores come from the real OrbitX engine: contract, liquidity, holders, dev and trading signals. Unknown means unknown — never guessed. Free forever. Not financial advice.";

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
