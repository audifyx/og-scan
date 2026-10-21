import {
  getUserWallet,
  createUserWallet,
  revokeUserWallet,
  exportUserWalletSecret,
  getWalletLockState,
  setWalletPin,
  unlockWallet,
  lockWallet,
  changeWalletPin,
  removeWalletPin,
} from "./orbitx/_handlers/_user-trading-wallet.js";

async function userFromRequest(req) {
  const auth = req.headers.authorization || "";
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const anon = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!auth.startsWith("Bearer ") || !url || !anon) return null;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: anon } });
  return response.ok ? response.json() : null;
}

function statusForError(error) {
  switch (error?.code) {
    case "wrong_pin": return 401;
    case "pin_locked_out": return 429;
    case "wallet_locked": return 423;
    case "weak_pin": return 400;
    case "no_wallet": return 404;
    case "no_pin_set": return 400;
    default: return 400;
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });
  const user = await userFromRequest(req);
  if (!user?.id) return res.status(401).json({ error: "unauthorized" });
  try {
    if (req.method === "GET") {
      const row = await getUserWallet(user.id);
      if (!row) return res.status(200).json(null);
      const lock = await getWalletLockState(user.id);
      return res.status(200).json({
        publicKey: row.public_key,
        owner: "user",
        pinSet: lock.pinSet,
        unlocked: lock.unlocked,
        unlockUntil: lock.unlockUntil,
      });
    }
    const action = req.body?.action;
    if (action === "revoke") {
      await revokeUserWallet(user.id);
      return res.status(200).json({ ok: true });
    }
    if (action === "export") {
      const row = await getUserWallet(user.id);
      if (!row) return res.status(404).json({ error: "no_wallet" });
      // PIN-locked wallets must be unlocked before export, even in the platform.
      const secretKeyBase58 = await exportUserWalletSecret(row);
      return res.status(200).json({ ok: true, publicKey: row.public_key, secretKeyBase58 });
    }
    if (action === "set_pin") {
      const result = await setWalletPin(user.id, req.body?.pin);
      return res.status(200).json(result);
    }
    if (action === "unlock") {
      const result = await unlockWallet(user.id, req.body?.pin);
      return res.status(200).json(result);
    }
    if (action === "lock") {
      const result = await lockWallet(user.id);
      return res.status(200).json(result);
    }
    if (action === "change_pin") {
      const result = await changeWalletPin(user.id, req.body?.currentPin, req.body?.newPin);
      return res.status(200).json(result);
    }
    if (action === "remove_pin") {
      const result = await removeWalletPin(user.id, req.body?.pin);
      return res.status(200).json(result);
    }
    const created = await createUserWallet(user.id);
    return res.status(created.existing ? 200 : 201).json({ publicKey: created.publicKey, owner: "user", existing: created.existing });
  } catch (error) {
    return res.status(statusForError(error)).json({ error: error?.code || "user_wallet_failed", message: error?.message || "user_wallet_failed" });
  }
}
