import type { VercelRequest, VercelResponse } from "@vercel/node";

// POST /api/kol/bot-setup  { botToken, name?, bio? }
// Verifies the token (getMe) and applies branding server-side:
//   setMyName + setMyDescription + setMyShortDescription.
// NOTE: a bot's PROFILE PHOTO cannot be set via the Bot API — only via
// @BotFather (/setuserpic). The uploaded image is instead attached to alerts.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const { botToken, name, bio } = (req.body || {}) as { botToken?: string; name?: string; bio?: string };
  const token = String(botToken || "").trim();
  if (!/^\d+:[\w-]{30,}$/.test(token)) return res.status(400).json({ ok: false, error: "invalid bot token format" });

  try {
    const meR = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = (await meR.json()) as any;
    if (!me?.ok) return res.status(400).json({ ok: false, error: me?.description || "token rejected by Telegram" });

    const applied: Record<string, boolean> = {};
    if (name) {
      const r = await fetch(`https://api.telegram.org/bot${token}/setMyName`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: String(name).slice(0, 64) }),
      });
      applied.name = ((await r.json()) as any)?.ok === true;
    }
    if (bio) {
      const r1 = await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: String(bio).slice(0, 512) }),
      });
      applied.description = ((await r1.json()) as any)?.ok === true;
      const r2 = await fetch(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ short_description: String(bio).slice(0, 120) }),
      });
      applied.shortDescription = ((await r2.json()) as any)?.ok === true;
    }

    return res.status(200).json({
      ok: true,
      botUsername: me.result?.username || null,
      botId: me.result?.id || null,
      applied,
      note: "Profile photo must be set via @BotFather (/setuserpic). Your image is attached to every alert instead.",
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
