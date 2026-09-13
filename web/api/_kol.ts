import type { VercelRequest, VercelResponse } from "@vercel/node";
// Single serverless function routing all /api/kol/* endpoints
// Rewritten from /api/kol/<action> via vercel.json (same pattern as /api/ogdex).
// (Hobby plan caps functions per deployment; implementations live in _handlers/,
// which Vercel ignores — same pattern as api/ogdex/_routes).
import transactions from "./kol/_handlers/_transactions";
import chatId from "./kol/_handlers/_chat-id";
import sendAlert from "./kol/_handlers/_send-alert";
import botSetup from "./kol/_handlers/_bot-setup";
import webhook from "./kol/_handlers/_webhook";
import syncWebhook from "./kol/_handlers/_sync-webhook";
import newLaunches from "./kol/_handlers/_new-launches";
import launchDigest from "./kol/_handlers/_launch-digest";

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
