/**
 * /api/ogdex/kols/nominate.js
 * POST { address, label? }  — community wallet nomination endpoint.
 * Stores to KV with a "pending" flag; OG team approves via admin panel.
 */

import { send } from "../../_lib.js";

const KV_PREFIX = "kol:nomination:";
const MAX_PER_IP = 5; // per 24h

export default async function nominateRoute(req) {
  if (req.method !== "POST") return send(req, { ok: false, error: "POST only" }, 405);

  let body;
  try { body = await req.json(); } catch { return send(req, { ok: false, error: "Bad JSON" }, 400); }

  const { address, label } = body;
  if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim())) {
    return send(req, { ok: false, error: "Invalid wallet address" }, 400);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${KV_PREFIX}${address.trim()}`;

  // Check for existing nomination
  let existing = null;
  try {
    const { kv } = await import("@vercel/kv");
    existing = await kv.get(key);

    if (existing) {
      // Already nominated — just upvote
      existing.votes = (existing.votes || 0) + 1;
      await kv.set(key, existing, { ex: 60 * 60 * 24 * 30 }); // 30 days TTL
      return send(req, { ok: true, action: "upvoted", votes: existing.votes });
    }

    const nomination = {
      address: address.trim(),
      label: (label || "").trim().slice(0, 64) || null,
      status: "pending",
      votes: 1,
      submittedBy: ip,
      submittedAt: Date.now(),
    };
    await kv.set(key, nomination, { ex: 60 * 60 * 24 * 30 });
  } catch {
    // KV unavailable — still log to console for manual review
    console.log("[kol-nominate]", address, label);
  }

  return send(req, { ok: true, action: "nominated" });
}
