// send-kol-alert — Telegram alert dispatcher for the KOL Tracker.
// Triggered by trade detection (Helius webhook relay or manual test).
// Looks up the telegram_bot_configs row linked to the tracker and sends
// the alert with the user's own bot token (never exposed to clients).
//
// Deploy: supabase functions deploy send-kol-alert --no-verify-jwt
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AlertPayload = {
  tracker_id?: string;
  bot_config_id?: string;
  wallet_address: string;
  action: "buy" | "sell";
  kol_name?: string;
  token_symbol?: string;
  token_mint?: string;
  amount?: number;
  sol_amount?: number;
  tx_signature?: string;
  test?: boolean;
};

function fmtNum(n: number | undefined | null): string {
  if (n == null || !isFinite(n)) return "?";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function buildMessage(p: AlertPayload): string {
  const emoji = p.action === "buy" ? "🟢" : "🔴";
  const verb = p.action === "buy" ? "bought" : "sold";
  const who = p.kol_name || `${p.wallet_address.slice(0, 4)}…${p.wallet_address.slice(-4)}`;
  const token = p.token_symbol || (p.token_mint ? `${p.token_mint.slice(0, 6)}…` : "token");
  const lines = [
    `${emoji} <b>${p.action.toUpperCase()} ALERT</b>${p.test ? " (test)" : ""}`,
    `<b>${who}</b> ${verb} ${fmtNum(p.amount)} <b>${token}</b>${p.sol_amount ? ` (${fmtNum(p.sol_amount)} SOL)` : ""}`,
    `Wallet: <code>${p.wallet_address}</code>`,
  ];
  if (p.tx_signature) lines.push(`Tx: https://solscan.io/tx/${p.tx_signature}`);
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), { status: 405, headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as AlertPayload;
    if (!payload?.wallet_address || !payload?.action) {
      return new Response(JSON.stringify({ ok: false, error: "wallet_address and action required" }), { status: 400, headers: corsHeaders });
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Resolve the bot config: by id, or by linked tracker.
    let q = db.from("telegram_bot_configs").select("id, user_id, bot_token, bot_name, bot_image_url, chat_id, message_thread_id, linked_tracker_id").limit(1);
    if (payload.bot_config_id) q = q.eq("id", payload.bot_config_id);
    else if (payload.tracker_id) q = q.eq("linked_tracker_id", payload.tracker_id);
    else return new Response(JSON.stringify({ ok: false, error: "tracker_id or bot_config_id required" }), { status: 400, headers: corsHeaders });

    const { data: bots, error: botErr } = await q;
    if (botErr) throw botErr;
    const bot = bots?.[0];
    if (!bot?.bot_token || !bot?.chat_id) {
      return new Response(JSON.stringify({ ok: false, error: "no bot configured (token/chat_id missing)" }), { status: 404, headers: corsHeaders });
    }

    const text = buildMessage(payload);
    let tgRes: Response;
    if (bot.bot_image_url) {
      tgRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: bot.chat_id, photo: bot.bot_image_url, caption: text, parse_mode: "HTML", ...(bot.message_thread_id ? { message_thread_id: Number(bot.message_thread_id) } : {}) }),
      });
      if (!tgRes.ok) {
        tgRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: bot.chat_id, text, parse_mode: "HTML", disable_web_page_preview: false, ...(bot.message_thread_id ? { message_thread_id: Number(bot.message_thread_id) } : {}) }),
        });
      }
    } else {
      tgRes = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: bot.chat_id, text, parse_mode: "HTML", disable_web_page_preview: false, ...(bot.message_thread_id ? { message_thread_id: Number(bot.message_thread_id) } : {}) }),
      });
    }
    const tgJson = await tgRes.json().catch(() => ({}));
    const sent = tgRes.ok && tgJson?.ok !== false;

    if (!payload.test) {
      await db.from("kol_alert_log").insert({
        tracker_id: payload.tracker_id ?? bot.linked_tracker_id ?? null,
        user_id: bot.user_id,
        wallet_address: payload.wallet_address,
        action: payload.action,
        token_symbol: payload.token_symbol ?? null,
        token_mint: payload.token_mint ?? null,
        amount: payload.amount ?? null,
        sol_amount: payload.sol_amount ?? null,
        tx_signature: payload.tx_signature ?? null,
        status: sent ? "sent" : "failed",
      });
    }

    return new Response(JSON.stringify({ ok: sent, telegram: { ok: tgJson?.ok, description: tgJson?.description } }), {
      status: sent ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
