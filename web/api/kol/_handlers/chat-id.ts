import type { VercelRequest, VercelResponse } from "@vercel/node";

// POST /api/kol/chat-id  { botToken }
// Calls Telegram getUpdates server-side and returns the most recent chat id.
// The token is used transiently and never logged or stored here.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const botToken = String((req.body as any)?.botToken || "").trim();
  if (!/^\d+:[\w-]{30,}$/.test(botToken)) return res.status(400).json({ ok: false, error: "invalid bot token format" });

  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=25`);
    const j = (await r.json()) as any;
    if (!j?.ok) return res.status(400).json({ ok: false, error: j?.description || "getUpdates failed (is the token correct?)" });

    const updates: any[] = Array.isArray(j.result) ? j.result : [];
    for (let i = updates.length - 1; i >= 0; i--) {
      const msg = updates[i]?.message || updates[i]?.channel_post || updates[i]?.my_chat_member;
      const chat = msg?.chat;
      if (chat?.id) {
        return res.status(200).json({
          ok: true,
          chatId: String(chat.id),
          chatType: chat.type || null,
          chatTitle: chat.title || chat.username || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || null,
          // If the message was sent inside a forum topic, capture it so alerts stay in that topic
          threadId: msg?.is_topic_message && msg?.message_thread_id ? String(msg.message_thread_id) : null,
        });
      }
    }
    return res.status(404).json({
      ok: false,
      error: "No messages found. Open Telegram, send your bot any message (e.g. /start), then try again.",
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
