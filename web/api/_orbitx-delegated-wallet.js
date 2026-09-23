import { getUserWallet, createUserWallet, revokeUserWallet, exportUserWalletSecret } from "./orbitx/_handlers/_user-trading-wallet.js";

async function userFromRequest(req) {
  const auth = req.headers.authorization || "";
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anon = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!auth.startsWith("Bearer ") || !url || !anon) return null;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: anon } });
  return response.ok ? response.json() : null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const user = await userFromRequest(req);
  if (!user?.id) return res.status(401).json({ error: "unauthorized" });
  try {
    if (req.method === "GET") {
      const row = await getUserWallet(user.id);
      return res.status(200).json(row ? { publicKey: row.public_key, owner: "user" } : null);
    }
    if (req.body?.action === "revoke") {
      await revokeUserWallet(user.id);
      return res.status(200).json({ ok: true });
    }
    if (req.body?.action === "export") {
      const row = await getUserWallet(user.id);
      if (!row) return res.status(404).json({ error: "no_wallet" });
      const secretKeyBase58 = await exportUserWalletSecret(row);
      return res.status(200).json({ ok: true, publicKey: row.public_key, secretKeyBase58 });
    }
    const created = await createUserWallet(user.id);
    return res.status(created.existing ? 200 : 201).json({ publicKey: created.publicKey, owner: "user", existing: created.existing });
  } catch (error) {
    return res.status(400).json({ error: error?.message || "user_wallet_failed" });
  }
}
