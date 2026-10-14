import type { VercelRequest, VercelResponse } from "@vercel/node";

// POST /api/kol/send-alert
// Sends a Telegram buy/sell alert. Two modes:
//  1) { botConfigId | trackerId } — resolves the stored bot token server-side
//     via Supabase service role (token never leaves the server).
//  2) { botToken, chatId } — direct dispatch (used before migration is applied).
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type Payload = {
  botToken?: string; chatId?: string; threadId?: string; botConfigId?: string; trackerId?: string;
  wallet: string; action: "buy" | "sell"; kolName?: string;
  tokenSymbol?: string; tokenMint?: string; amount?: number; solAmount?: number;
  txSignature?: string; imageUrl?: string; test?: boolean;
};

function fmtNum(n?: number | null): string {
  if (n == null || !isFinite(n)) return "?";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function buildAlertText(p: Payload): string {
  const emoji = p.action === "buy" ? "🟢" : "🔴";
  const verb = p.action === "buy" ? "bought" : "sold";
  const who = p.kolName || `${p.wallet.slice(0, 4)}…${p.wallet.slice(-4)}`;
  const token = p.tokenSymbol || (p.tokenMint ? `${p.tokenMint.slice(0, 6)}…` : "token");
  const lines = [
    `${emoji} <b>${p.action.toUpperCase()} ALERT</b>${p.test ? " (test)" : ""}`,
    `<b>${who}</b> ${verb} ${fmtNum(p.amount)} <b>${token}</b>${p.solAmount ? ` (${fmtNum(p.solAmount)} SOL)` : ""}`,
    `Wallet: <code>${p.wallet}</code>`,
  ];
  if (p.txSignature) lines.push(`Tx: https://solscan.io/tx/${p.txSignature}`);
  if (p.tokenMint) lines.push(`Chart: https://dexscreener.com/solana/${p.tokenMint}`);
  return lines.join("\n");
}

async function sbFetch(path: string, init?: RequestInit) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json", ...(init?.headers || {}),
    },
  });
  return r;
}

export async function sendTelegram(botToken: string, chatId: string, text: string, imageUrl?: string, threadId?: string) {
  // message_thread_id keeps alerts inside ONE forum topic instead of the whole group
  const thread = threadId ? { message_thread_id: Number(threadId) } : {};
  if (imageUrl) {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: text, parse_mode: "HTML", ...thread }),
    });
    const j = (await r.json()) as any;
    if (j?.ok) return j;
  }
  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: false, ...thread }),
  });
  return (await r.json()) as any;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const p = (req.body || {}) as Payload;
  if (!p.wallet || !p.action) return res.status(400).json({ ok: false, error: "wallet and action required" });

  let botToken = String(p.botToken || "").trim();
  let chatId = String(p.chatId || "").trim();
  let threadId = String(p.threadId || "").trim();
  let imageUrl = p.imageUrl;
  let trackerId = p.trackerId || null;
  let userId: string | null = null;

  // Server-side token resolution (preferred; token never exposed to client)
  if ((!botToken || !chatId) && SERVICE_KEY && (p.botConfigId || p.trackerId)) {
    const filter = p.botConfigId ? `id=eq.${encodeURIComponent(p.botConfigId)}` : `linked_tracker_id=eq.${encodeURIComponent(p.trackerId!)}`;
    const r = await sbFetch(`telegram_bot_configs?${filter}&select=id,user_id,bot_token,chat_id,message_thread_id,bot_image_url,linked_tracker_id&limit=1`);
    const rows = (await r.json().catch(() => [])) as any[];
    const bot = rows?.[0];
    if (bot) {
      botToken = botToken || bot.bot_token;
      chatId = chatId || bot.chat_id;
      threadId = threadId || bot.message_thread_id || "";
      imageUrl = imageUrl || bot.bot_image_url || undefined;
      trackerId = trackerId || bot.linked_tracker_id || null;
      userId = bot.user_id || null;
    }
  }

  if (!botToken || !chatId) return res.status(400).json({ ok: false, error: "no bot token / chat id available" });

  try {
    const text = buildAlertText(p);
    const tg = await sendTelegram(botToken, chatId, text, imageUrl, threadId || undefined);
    const sent = tg?.ok === true;

    if (!p.test && SERVICE_KEY) {
      await sbFetch("kol_alert_log", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          tracker_id: trackerId, user_id: userId, wallet_address: p.wallet, action: p.action,
          token_symbol: p.tokenSymbol ?? null, token_mint: p.tokenMint ?? null,
          amount: p.amount ?? null, sol_amount: p.solAmount ?? null,
          tx_signature: p.txSignature ?? null, status: sent ? "sent" : "failed",
        }),
      }).catch(() => {});
    }

    return res.status(sent ? 200 : 502).json({ ok: sent, description: tg?.description || null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
