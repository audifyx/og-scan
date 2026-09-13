import { activeDelegatedWallet, createDelegatedWallet, revokeDelegatedWallet } from "./orbitx/delegated-wallet.js";

async function userFromRequest(req) {
  const auth = req.headers.authorization || ""; const url = process.env.SUPABASE_URL || ""; const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!auth.startsWith("Bearer ") || !url || !anon) return null;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: anon } }); return response.ok ? response.json() : null;
}
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const user = await userFromRequest(req); if (!user?.id) return res.status(401).json({ error: "unauthorized" });
  try {
    if (req.method === "GET") { const row = await activeDelegatedWallet(user.id); return res.status(200).json(row ? { id: row.id, publicKey: row.public_key, perTradeCapUsd: Number(row.per_trade_cap_usd), lifetimeCapUsd: Number(row.lifetime_cap_usd), expiresAt: row.expires_at, revoked: !!row.revoked } : null); }
    if (req.body?.action === "revoke") { await revokeDelegatedWallet(user.id); return res.status(200).json({ ok: true }); }
    const existing = await activeDelegatedWallet(user.id); if (existing) return res.status(409).json({ error: "active_wallet_exists" });
    return res.status(201).json(await createDelegatedWallet(user.id, req.body?.agentId || null));
  } catch (error) { return res.status(400).json({ error: error?.message || "delegated_wallet_request_failed" }); }
}
