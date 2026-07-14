import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
const OG_SCAN_URL = "https://www.ogscan.fun/app";

const ALLOWED_ORIGINS = ["https://ogscan.fun", "https://www.ogscan.fun", "https://orbitx.world", "https://www.orbitx.world"];
function corsFor(origin: string | null) {
  const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://ogscan.fun";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
    "Vary": "Origin",
  };
}

// Simple deduplication: track recently sent event IDs in memory
// (per-instance, sufficient for rate-limiting duplicate webhook fires)
const recentlySent = new Set<string>();

async function sendTelegram(text: string, parseMode: "HTML" | "Markdown" = "HTML") {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: false,
      disable_notification: false,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("Telegram send error:", JSON.stringify(data));
    throw new Error(`Telegram error: ${data.description}`);
  }
  return data;
}

function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(str: string, max = 120): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max).trimEnd() + "..." : str;
}

// ─── Message builders per event type ────────────────────────────────────────

function buildSpaceMessage(record: Record<string, unknown>, eventType: string): string | null {
  if (eventType !== "INSERT") return null;
  const isActive = record["is_active"] || record["is_live"];
  const title = escapeHtml(String(record["title"] || record["name"] || "Untitled Space"));
  const host = escapeHtml(String(record["host_username"] || "Someone"));
  const topic = record["topic"] ? `\n🎯 <b>Topic:</b> ${escapeHtml(String(record["topic"]))}` : "";
  return (
    `🎙️ <b>New Space just started on OG SCAN!</b>\n\n` +
    `👤 <b>Host:</b> @${host}\n` +
    `📢 <b>Space:</b> ${title}${topic}\n\n` +
    `🔗 <a href="${OG_SCAN_URL}">Join on OG SCAN →</a>`
  );
}

function buildCommunityPostMessage(record: Record<string, unknown>, eventType: string): string | null {
  if (eventType !== "INSERT") return null;
  // Skip reposts / quote posts to avoid spam
  if (record["parent_post_id"] || record["quote_post_id"]) return null;
  const username = escapeHtml(String(record["username"] || "Someone"));
  const content = escapeHtml(truncate(String(record["content"] || ""), 200));
  const ticker = record["ticker"] ? ` $${escapeHtml(String(record["ticker"]))}` : "";
  return (
    `✍️ <b>New post in the OG SCAN community!</b>\n\n` +
    `👤 @${username}${ticker}\n` +
    `💬 ${content}\n\n` +
    `🔗 <a href="${OG_SCAN_URL}/community">Read on OG SCAN →</a>`
  );
}

function buildNewCommunityMessage(record: Record<string, unknown>, eventType: string): string | null {
  if (eventType !== "INSERT") return null;
  const name = escapeHtml(String(record["name"] || "New Community"));
  const creator = escapeHtml(String(record["creator_name"] || "Someone"));
  const desc = record["description"] ? `\n📝 ${escapeHtml(truncate(String(record["description"]), 120))}` : "";
  const slug = record["slug"] ? `${OG_SCAN_URL}/community/${record["slug"]}` : `${OG_SCAN_URL}/community`;
  return (
    `🏘️ <b>New community just launched on OG SCAN!</b>\n\n` +
    `👥 <b>Community:</b> ${name}${desc}\n` +
    `👤 <b>Created by:</b> @${creator}\n\n` +
    `🔗 <a href="${slug}">Join the community →</a>`
  );
}

function buildLiveFeedMessage(record: Record<string, unknown>, eventType: string): string | null {
  if (eventType !== "INSERT") return null;
  const evType = String(record["event_type"] || "event");
  const symbol = record["token_symbol"] ? `$${escapeHtml(String(record["token_symbol"]))}` : "";
  const isWhale = record["is_whale"] ? "🐋 " : "";
  const amtUsd = record["amount_usd"]
    ? `$${Number(record["amount_usd"]).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "";
  const typeLabel: Record<string, string> = {
    buy: "🟢 Buy",
    sell: "🔴 Sell",
    swap: "🔄 Swap",
    launch: "🚀 Launch",
    whale_buy: "🐋🟢 Whale Buy",
    whale_sell: "🐋🔴 Whale Sell",
  };
  const label = typeLabel[evType.toLowerCase()] || `📡 ${escapeHtml(evType)}`;
  const amtStr = amtUsd ? ` · ${amtUsd}` : "";
  return (
    `${isWhale}${label} spotted on the OG SCAN live feed!\n\n` +
    `🪙 ${symbol || "Token activity"}${amtStr}\n\n` +
    `🔗 <a href="${OG_SCAN_URL}/live">Watch live →</a>`
  );
}

function buildVoiceLobbyMessage(record: Record<string, unknown>, eventType: string): string | null {
  if (eventType !== "INSERT") return null;
  const topic = escapeHtml(String(record["topic"] || record["name"] || "Voice Lobby"));
  return (
    `🎤 <b>Voice lobby just opened on OG SCAN!</b>\n\n` +
    `🗣️ <b>Topic:</b> ${topic}\n\n` +
    `🔗 <a href="${OG_SCAN_URL}/community">Jump in →</a>`
  );
}

function buildTradingLobbyMessage(record: Record<string, unknown>, eventType: string): string | null {
  if (eventType !== "INSERT") return null;
  const name = escapeHtml(String(record["name"] || "Trading Lobby"));
  const creator = escapeHtml(String(record["creator_name"] || "Someone"));
  const desc = record["description"] ? `\n📝 ${escapeHtml(truncate(String(record["description"]), 100))}` : "";
  return (
    `📈 <b>New trading lobby created on OG SCAN!</b>\n\n` +
    `🏦 <b>Lobby:</b> ${name}${desc}\n` +
    `👤 <b>By:</b> @${creator}\n\n` +
    `🔗 <a href="${OG_SCAN_URL}/community">View on OG SCAN →</a>`
  );
}

function buildNewUserMessage(record: Record<string, unknown>, eventType: string): string | null {
  if (eventType !== "INSERT") return null;
  const username = escapeHtml(String(record["username"] || record["display_name"] || "a new member"));
  const isPioneer = record["is_pioneer"] ? " 🏅" : "";
  return (
    `👋 <b>Welcome to OG SCAN, @${username}!</b>${isPioneer}\n\n` +
    `A new member just joined the community — give them a warm OG welcome! 🔥\n\n` +
    `OG SCAN is your home for Solana meme coin intelligence: live feeds, community rooms, voice lobbies, spaces, raids &amp; more.\n\n` +
    `🔗 <a href="${OG_SCAN_URL}">Dive in at OG SCAN →</a>`
  );
}


function buildOgScanMessage(record: Record<string, unknown>, eventType: string): string | null {
  if (eventType !== "INSERT") return null;
  const tier = String(record["tier"] || "");
  // Only announce high-signal verdicts to avoid spamming the community
  if (tier !== "OG_TOKEN" && tier !== "DANGEROUS_TOKEN") return null;
  const sym = record["symbol"]
    ? `$${escapeHtml(String(record["symbol"]))}`
    : escapeHtml(String(record["name"] || "Token"));
  const conf = Number(record["confidence"] || 0);
  const risk = Number(record["risk_score"] || 0);
  const mint = String(record["mint"] || "");
  const handle = record["scanner_handle"] ? `@${escapeHtml(String(record["scanner_handle"]))}` : "an OG";
  const rationale = escapeHtml(truncate(String(record["rationale"] || ""), 160));
  const head = tier === "OG_TOKEN"
    ? `✅ <b>OG TOKEN identified on OG SCAN!</b>`
    : `🛑 <b>DANGEROUS token flagged on OG SCAN!</b>`;
  const link = `https://www.ogscan.fun/intel-token/${mint}`;
  return (
    `${head}\n\n` +
    `🪙 <b>${sym}</b> · scanned by ${handle}\n` +
    `🎯 Confidence: <b>${conf}%</b> · Risk: <b>${risk}/100</b>\n` +
    (rationale ? `💬 ${rationale}\n` : "") +
    `🔎 <code>${escapeHtml(mint)}</code>\n\n` +
    `🔗 <a href="${link}">View full intel →</a>`
  );
}

// ─── Route webhook payload to correct builder ────────────────────────────────

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  schema: string;
};

function buildMessage(payload: WebhookPayload): string | null {
  const { type, table, record } = payload;

  switch (table) {
    case "spaces":
    case "active_spaces":
      return buildSpaceMessage(record, type);
    case "community_posts":
      return buildCommunityPostMessage(record, type);
    case "communities":
      return buildNewCommunityMessage(record, type);
    case "live_feed_events":
      // Only whale events on live feed to avoid spam
      if (!record["is_whale"]) return null;
      return buildLiveFeedMessage(record, type);
    case "voice_lobbies":
      return buildVoiceLobbyMessage(record, type);
    case "trading_lobbies":
      return buildTradingLobbyMessage(record, type);
    case "profiles":
      return buildNewUserMessage(record, type);
    case "ogi_scan_log":
      return buildOgScanMessage(record, type);
    default:
      return null;
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = corsFor(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify webhook secret — only Supabase database webhooks should call this
  if (WEBHOOK_SECRET) {
    const incomingSecret = req.headers.get("x-webhook-secret");
    if (incomingSecret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const payload: WebhookPayload = await req.json();
    const { type, table, record } = payload;

    // Dedup using record id + table
    const dedupKey = `${table}:${record?.id}:${type}`;
    if (recentlySent.has(dedupKey)) {
      return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    recentlySent.add(dedupKey);
    // Clean up dedup set if it grows too large
    if (recentlySent.size > 500) {
      const iter = recentlySent.values();
      for (let i = 0; i < 100; i++) recentlySent.delete(iter.next().value);
    }

    const message = buildMessage(payload);

    if (!message) {
      return new Response(JSON.stringify({ ok: true, skipped: "no message for this event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sendTelegram(message);

    console.log(`✅ Telegram announcement sent for ${table} ${type} id=${record?.id}`);

    return new Response(JSON.stringify({ ok: true, table, type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("telegram-announcer error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
