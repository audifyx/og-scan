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
 * Widget scans (Bot API 10.4, ./_tg-widget.js): a scan in a PRIVATE chat
 * is answered with sendWidget — the full report as an interactive HTML
 * widget (expandable sections, Refresh, Copy CA, Open in OrbitX). Groups
 * keep the plain-text report: in production, widgets work only in the
 * private chat with the bot, so a widget can never be sent to a group.
 * The widget's Refresh button sends a widget_query update ("r:<mint>");
 * the webhook answers it with answerWidgetQuery carrying compact fresh
 * numbers (<=1024 bytes). If the widget can't be built (size cap), the
 * reply falls back to the text report. The widget caption carries the
 * headline (score, price, safety) so clients without widget support
 * still see the essentials.
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
import { buildScanWidget, buildRefreshData, parseWidgetRequest } from "./_tg-widget.js";
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

function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= 1) return "$" + v.toFixed(2);
  if (v >= 0.01) return "$" + v.toFixed(4);
  return "$" + Number(v.toPrecision(4)).toString();
}

function fmtInt(v) {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v).toLocaleString("en-US");
}

function fmtSupply(v) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(Math.round(v));
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function shortNote(s, max = 90) {
  if (s == null) return null;
  const t = String(s).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut) + "…";
}

function shortAddr(s) {
  if (!s || s.length < 10) return s || null;
  return s.slice(0, 6) + "…" + s.slice(-4);
}

/**
 * Full scan report, in the chat — like a normal TG bot scanner. Paste a CA,
 * get everything the scanner UI shows, as one detailed report: market,
 * chart (price action), pairs (coins paired), holders, dev, safety,
 * bundle, social, clones (vamp or OG + the clone list), the score
 * breakdown and the risk factors. No Mini App needed. Kept under
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
  const desc = shortNote(result.description, 120);
  if (desc) lines.push(desc);
  lines.push("");

  // — Market —
  lines.push("— Market —");
  if (result.price != null) {
    const chg = result.change24h != null ? ` (${fmtPct(result.change24h)} 24h)` : "";
    lines.push(`Price: ${fmtPrice(result.price)}${chg}`);
  }
  const marketBits = [];
  if (result.marketCap != null) marketBits.push(`MCAP: ${fmtUsd(result.marketCap)}`);
  if (result.liquidity != null) marketBits.push(`Liquidity: ${fmtUsd(result.liquidity)}`);
  if (result.volume24h != null) marketBits.push(`Vol 24h: ${fmtUsd(result.volume24h)}`);
  if (marketBits.length) lines.push(marketBits.join(" · "));
  if (result.ageDays != null) {
    const age = result.ageDays < 1 ? "<1 day" : `${Math.floor(result.ageDays)} days`;
    lines.push(`Age: ${age}`);
  }
  if (result.momentumLabel || result.momentum != null) {
    lines.push(
      `Momentum: ${result.momentumLabel || ""}${result.momentum != null ? ` (${Math.round(result.momentum)}/100)` : ""}`.trim(),
    );
  }
  lines.push("");

  // — Token — supply, program, launchpad, verification.
  const tokenLines = [];
  const supplyBits = [];
  if (result.totalSupply != null) supplyBits.push(`Supply: ${fmtSupply(result.totalSupply)}`);
  if (result.decimals != null) supplyBits.push(`Decimals: ${result.decimals}`);
  if (result.fdv != null) supplyBits.push(`FDV: ${fmtUsd(result.fdv)}`);
  if (supplyBits.length) tokenLines.push(supplyBits.join(" · "));
  const progBits = [];
  if (result.tokenProgram) progBits.push(`Program: ${result.tokenProgram}`);
  if (result.launchpad) progBits.push(`Launchpad: ${result.launchpad}`);
  if (result.isVerified === true) progBits.push("✅ Jupiter verified");
  else if (result.isVerified === false) progBits.push("⚠️ Not Jupiter-verified");
  if (progBits.length) tokenLines.push(progBits.join(" · "));
  if (tokenLines.length) {
    lines.push("— Token —");
    for (const l of tokenLines) lines.push(l);
    lines.push("");
  }

  // — Chart — price history (the chart in text form).
  const pa = [];
  if (result.change5m != null) pa.push(`5m ${fmtPct(result.change5m)}`);
  if (result.change1h != null) pa.push(`1h ${fmtPct(result.change1h)}`);
  if (result.change6h != null) pa.push(`6h ${fmtPct(result.change6h)}`);
  if (result.change24h != null) pa.push(`24h ${fmtPct(result.change24h)}`);
  if (pa.length) {
    lines.push("— Chart —");
    lines.push(`Price action: ${pa.join(" · ")}`);
    lines.push("");
  }

  // — History — ATH, created date, migration.
  const histLines = [];
  if (result.athPrice != null || result.athMcap != null) {
    const bits = [];
    if (result.athPrice != null) bits.push(`ATH ${fmtPrice(result.athPrice)}`);
    if (result.athMcap != null) bits.push(`${fmtUsd(result.athMcap)} MCAP`);
    if (result.downFromAthPct != null) {
      bits.push(`-${Number(result.downFromAthPct).toFixed(1)}% from ATH`);
    }
    histLines.push(bits.join(" · "));
  }
  if (result.createdAt) {
    const cd = fmtDate(result.createdAt);
    if (cd) histLines.push(`Created: ${cd}`);
  }
  if (result.bondingComplete === true) {
    histLines.push("Migrated from the pump.fun bonding curve");
  }
  if (histLines.length) {
    lines.push("— History —");
    for (const l of histLines) lines.push(l);
    lines.push("");
  }

  // — Pairs — which coins this token is paired to (the liquidity pools).
  const pairs = Array.isArray(result.pairs) ? result.pairs : null;
  lines.push("— Pairs —");
  if (pairs && pairs.length) {
    for (const p of pairs) {
      const dex = p.dex ? String(p.dex).replace(/^\w/, (c) => c.toUpperCase()) : "Unknown";
      const quote = p.quote || "?";
      const bits = [`${dex} — ${quote}`];
      if (p.liquidity != null) bits.push(`Liq ${fmtUsd(p.liquidity)}`);
      if (p.volume24h != null) bits.push(`Vol ${fmtUsd(p.volume24h)}`);
      if (p.buys24h != null || p.sells24h != null) {
        bits.push(
          `Buys ${fmtInt(p.buys24h ?? 0)} · Sells ${fmtInt(p.sells24h ?? 0)}`,
        );
      }
      lines.push(bits.join(" · "));
    }
  } else {
    lines.push("Pairs: unknown — no DEX pairs found");
  }
  lines.push("");

  // — Holders —
  lines.push("— Holders —");
  const holderBits = [];
  if (result.holders != null) {
    const hc =
      result.holderChange24h != null
        ? ` (${fmtPct(result.holderChange24h)} 24h)`
        : "";
    holderBits.push(`Holders: ${fmtInt(result.holders)}${hc}`);
  }
  if (result.topHolderPct != null) holderBits.push(`Top: ${Number(result.topHolderPct).toFixed(1)}%`);
  if (result.top10Pct != null) holderBits.push(`Top 10: ${Number(result.top10Pct).toFixed(1)}%`);
  if (result.whaleCount != null) holderBits.push(`Whales: ${result.whaleCount}`);
  if (result.kolHolderCount != null && result.kolHolderCount > 0) {
    holderBits.push(`KOL holders: ${result.kolHolderCount}`);
  }
  if (holderBits.length) lines.push(holderBits.join(" · "));
  const th = Array.isArray(result.topHolders) ? result.topHolders : null;
  if (th && th.length) {
    lines.push("Top holders:");
    for (const h of th) {
      const who = shortAddr(h.owner) || (h.label || "?");
      const usd = h.usdValue != null ? ` · ${fmtUsd(h.usdValue)}` : "";
      lines.push(`· ${who} · ${Number(h.pct).toFixed(1)}%${usd}`);
    }
  }
  lines.push("");

  // — Activity — 24h trading activity (Jupiter stats).
  const actLines = [];
  const actBits = [];
  if (result.numBuys24h != null) actBits.push(`${fmtInt(result.numBuys24h)} buys`);
  if (result.numSells24h != null) actBits.push(`${fmtInt(result.numSells24h)} sells`);
  if (result.numTraders24h != null) actBits.push(`${fmtInt(result.numTraders24h)} traders`);
  if (result.netBuyers24h != null) {
    actBits.push(
      `Net ${result.netBuyers24h >= 0 ? "+" : ""}${fmtInt(result.netBuyers24h)} buyers`,
    );
  }
  if (actBits.length) actLines.push(`24h: ${actBits.join(" · ")}`);
  const volBits = [];
  if (result.buyVolume24h != null) volBits.push(`Buy vol ${fmtUsd(result.buyVolume24h)}`);
  if (result.sellVolume24h != null) volBits.push(`Sell vol ${fmtUsd(result.sellVolume24h)}`);
  if (volBits.length) actLines.push(volBits.join(" · "));
  if (result.organicScore != null) {
    actLines.push(
      `Organic score: ${Math.round(result.organicScore)}/100${result.organicScoreLabel ? ` (${result.organicScoreLabel})` : ""}`,
    );
  }
  if (actLines.length) {
    lines.push("— Activity —");
    for (const l of actLines) lines.push(l);
    lines.push("");
  }

  // — Dev — who launched it, how many tokens, still holding or exited.
  lines.push("— Dev —");
  const devWallet = shortAddr(result.devWallet);
  if (devWallet) lines.push(`Dev: ${devWallet}`);
  const devLine =
    result.devExited === true
      ? "👋 Dev has exited"
      : result.devExited === false
        ? "✅ Dev still holds"
        : "❓ Dev position — unknown";
  const devInfo =
    result.devTokensCreated != null
      ? `${devLine} · ${result.devTokensCreated} tokens created`
      : devLine;
  lines.push(
    result.devSerial === true ? `${devInfo} · Serial deployer` : devInfo,
  );
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
  lines.push("");

  // — Safety —
  lines.push("— Safety —");
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
  const checks = Array.isArray(result.honeypotChecks) ? result.honeypotChecks : [];
  const rt = checks.find((c) => c.id === "round-trip");
  if (rt) lines.push(rt.label);
  const tb = result.tradeability;
  if (tb && tb.verdict) {
    lines.push(
      `Tradeability: ${tb.verdict}${tb.note ? ` — ${shortNote(tb.note, 80)}` : ""}`,
    );
  }
  lines.push("");

  // — Bundle —
  lines.push("— Bundle —");
  const b = result.bundle;
  if (b && b.available) {
    let bundleLine = `Bundle: ${b.verdict || "—"}`;
    if (b.bundledSupplyPct != null && !bundleLine.includes("% bundled")) {
      bundleLine += ` (${Number(b.bundledSupplyPct).toFixed(1)}% bundled)`;
    }
    if (b.clusterCount != null && b.clusterCount > 0) bundleLine += ` · ${b.clusterCount} clusters`;
    lines.push(bundleLine);
    const note = shortNote(b.note);
    if (note) lines.push(`  ${note}`);
  } else {
    lines.push("Bundle: unknown — bundle check unavailable");
  }
  lines.push("");

  // — Social —
  lines.push("— Social —");
  const x = result.x;
  if (x) {
    if (x.handle) lines.push(`X: @${x.handle}`);
    else if (x.note) {
      const n = shortNote(x.note);
      if (n) lines.push(`X: ${n}`);
    }
  }
  if (result.xMentions != null) lines.push(`X posts found: ${fmtInt(result.xMentions)}`);
  if (result.redditMentions != null) {
    lines.push(`Reddit posts found: ${fmtInt(result.redditMentions)}`);
  }
  const soc = result.socials || {};
  if (soc.telegram) lines.push(`Telegram: ${soc.telegram}`);
  if (soc.discord) lines.push(`Discord: ${soc.discord}`);
  if (soc.website) lines.push(`Website: ${soc.website}`);
  lines.push("");

  // — Top traders — by PnL (research route; only when it answered).
  const tt = Array.isArray(result.topTraders) ? result.topTraders : null;
  if (tt && tt.length) {
    lines.push("— Top traders —");
    for (const t of tt) {
      const bits = [shortAddr(t.wallet) || "?"];
      if (t.pnl != null) {
        bits.push(`PnL ${(t.pnl >= 0 ? "+" : "-") + fmtUsd(Math.abs(t.pnl))}`);
      }
      if (t.winRate != null) bits.push(`Win ${Number(t.winRate).toFixed(0)}%`);
      if (t.trades != null) bits.push(`${fmtInt(t.trades)} trades`);
      lines.push(`· ${bits.join(" · ")}`);
    }
    lines.push("");
  }

  // — Clones — vamp or OG, how many, and the clones themselves.
  lines.push("— Clones —");
  const cl = result.clones;
  if (cl && cl.state !== "unknown") {
    const isVamp = cl.biggerClone === true;
    const verdict = isVamp
      ? "🧛 VAMP — a bigger same-name token exists"
      : cl.count > 0
        ? "👑 OG — this is the biggest same-name token"
        : "👑 OG — no same-name clones";
    lines.push(`Originality: ${verdict}`);
    if (cl.count != null && cl.count > 0) {
      lines.push(`Same-name clones: ${cl.count}`);
      const list = Array.isArray(cl.list) ? cl.list : [];
      for (const c of list) {
        const sym = c.symbol || c.name || "—";
        const m = shortAddr(c.mint);
        const bits = [sym];
        if (c.mcap != null) bits.push(`MCAP ${fmtUsd(c.mcap)}`);
        if (c.liquidity != null) bits.push(`Liq ${fmtUsd(c.liquidity)}`);
        if (m) bits.push(m);
        lines.push(`· ${bits.join(" · ")}`);
      }
    } else {
      lines.push(cl.label || "No same-name clones found");
    }
  } else {
    lines.push("Clones: unknown — clone check unavailable");
  }
  lines.push("");

  // — Score breakdown —
  lines.push("— Score breakdown —");
  const cats = Array.isArray(result.categories) ? result.categories : [];
  if (cats.length) {
    for (const c of cats) {
      const note = shortNote(c.note, 70);
      lines.push(`· ${c.label}: ${note ? note + " " : ""}(${c.points}/${c.max})`);
    }
  }
  lines.push("");

  // — Risk factors — score caps + any failing/warning trade checks.
  const caps = Array.isArray(result.caps) ? result.caps : [];
  const riskChecks = checks.filter((c) => c.state === "fail" || c.state === "warn");
  if (caps.length || riskChecks.length) {
    lines.push("— Risk factors —");
    for (const cap of caps) {
      const n = shortNote(cap, 90);
      if (n) lines.push(`· ${n}`);
    }
    for (const c of riskChecks) {
      const detail = shortNote(c.detail, 70);
      lines.push(`· ${c.label}${detail ? ` — ${detail}` : ""}`);
    }
    lines.push("");
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

/** Answer a scan: HTML widget in a private chat, text report elsewhere
 * (groups — widgets are private-only in production) or when the widget
 * can't be built. Same data either way. */
function replyScan(res, chatId, chatType, result) {
  if (chatType === "private") {
    try {
      const w = buildScanWidget(result);
      return sendMethod(res, {
        method: "sendWidget",
        chat_id: chatId,
        html: w.html,
        allow_queries: true,
        caption: w.caption,
        reply_markup: openScannerKeyboard(),
      });
    } catch (e) {
      console.error("buildScanWidget failed, text fallback", String((e && e.message) || e).slice(0, 120));
    }
  }
  return sendMethod(res, {
    method: "sendMessage",
    chat_id: chatId,
    text: scanReply(result),
    reply_markup: openScannerKeyboard(),
  });
}

/** Handle a widget_query / shared_widget_query: only "r:<mint>" (refresh)
 * is supported. Re-runs the scan (90s cache — cheap) and answers with
 * compact fresh numbers. Always answers, even on error, so the widget's
 * request promise settles instead of timing out. */
async function handleWidgetQuery(res, query) {
  const parsed = parseWidgetRequest(query && query.data);
  const mint = parsed ? parsed.mint : null;
  if (mint) {
    await logBotUse({ user: query.from, chat: query.chat || null, kind: "widget_query", detail: mint });
  }
  let data;
  if (!parsed) {
    data = JSON.stringify({ e: "unknown request" });
  } else {
    try {
      const result = await scanMint(mint);
      data = buildRefreshData(result);
    } catch {
      data = JSON.stringify({ e: "scan failed" });
    }
  }
  return sendMethod(res, {
    method: "answerWidgetQuery",
    widget_query_id: query.id,
    data,
  });
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
  // Drop duplicate deliveries (Telegram retries slow webhooks) — applies
  // to every update type, including widget queries.
  if (update.update_id != null) {
    if (seen.has(update.update_id)) return sendMethod(res, {});
    seen.add(update.update_id);
    if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value);
  }

  const msg = update && update.message;
  // Widget queries (Refresh button) — no message attached. Answer within
  // the 15s window; the update itself is the auth (it only arrives via
  // the registered webhook URL).
  const wq = update && (update.widget_query || update.shared_widget_query);
  if (wq && wq.id) {
    return handleWidgetQuery(res, wq);
  }
  if (!msg || typeof msg.text !== "string" || !msg.chat || msg.chat.id == null) {
    // Not a text-message update (edited message, callback, etc.) — ack, send nothing.
    return sendMethod(res, {});
  }
  const chatId = msg.chat.id;

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
      return replyScan(res, chatId, msg.chat.type, result);
    } catch {
      return reply("Scan failed — the data sources didn't answer. Try again in a moment.");
    }
  }
  if (MINT_RE.test(text)) {
    try {
      const result = await scanMint(text);
      return replyScan(res, chatId, msg.chat.type, result);
    } catch {
      return reply("Scan failed — the data sources didn't answer. Try again in a moment.");
    }
  }
  return reply(
    "Send a Solana token address to scan it, or /start to open the scanner.",
    { reply_markup: openScannerKeyboard() },
  );
}
