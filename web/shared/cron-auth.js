/**
 * Cron authorization — server only.
 *
 * The ONLY accepted credential is `Authorization: Bearer <CRON_SECRET>`
 * compared timing-safely. Header presence (`x-vercel-cron`) and user-agent
 * strings (`vercel-cron`) are NOT authorization: any HTTP client can set
 * them, and nothing on Render strips them. (Vercel Cron itself sends the
 * Bearer secret automatically when CRON_SECRET is set in the project env.)
 *
 * Fails closed: when CRON_SECRET is unset, nothing is authorized.
 */
import { timingSafeEqual } from "crypto";

export function cronBearerOk(authHeader, env = process.env) {
  const secret = String(env.CRON_SECRET || "").trim();
  if (!secret) return false;
  const provided = String(authHeader || "");
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function cronAuthorized(req, env = process.env) {
  const h = req?.headers || {};
  return cronBearerOk(h.authorization || h.Authorization || "", env);
}
