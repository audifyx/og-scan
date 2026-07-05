import type { VercelRequest, VercelResponse } from "@vercel/node";
// Single serverless function routing all /api/kol/* endpoints
// (Hobby plan caps functions per deployment; implementations live in _handlers/,
// which Vercel ignores — same pattern as api/ogdex/_routes).
import transactions from "./_handlers/transactions";
import chatId from "./_handlers/chat-id";
import sendAlert from "./_handlers/send-alert";
import botSetup from "./_handlers/bot-setup";
import webhook from "./_handlers/webhook";
import syncWebhook from "./_handlers/sync-webhook";
import newLaunches from "./_handlers/new-launches";
import launchDigest from "./_handlers/launch-digest";

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

const handlers: Record<string, Handler> = {
  "transactions": transactions,
  "chat-id": chatId,
  "send-alert": sendAlert,
  "bot-setup": botSetup,
  "webhook": webhook,
  "sync-webhook": syncWebhook,
  "new-launches": newLaunches,
  "launch-digest": launchDigest,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || "").toLowerCase();
  const h = handlers[action];
  if (!h) return res.status(404).json({ ok: false, error: `unknown kol action: ${action}` });
  return h(req, res);
}
