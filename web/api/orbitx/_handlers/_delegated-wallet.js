import crypto from "node:crypto";

async function solana() { return import("@solana/web3.js"); }
function key() {
  const raw = process.env.DELEGATED_WALLET_ENC_KEY;
  if (!raw) throw new Error("DELEGATED_WALLET_ENC_KEY is not configured");
  const value = Buffer.from(raw, "base64");
  if (value.length !== 32) throw new Error("DELEGATED_WALLET_ENC_KEY must decode to 32 bytes");
  return value;
}
function encrypt(bytes) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(bytes)), cipher.final()]);
  return { encrypted_secret: encrypted.toString("base64"), iv: iv.toString("base64"), auth_tag: cipher.getAuthTag().toString("base64") };
}
async function db(path, init = {}) {
  const base = process.env.SUPABASE_URL || ""; const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !secret) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${base}/rest/v1/${path}`, { ...init, headers: { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) } });
  const body = await response.text(); let data = null; try { data = body ? JSON.parse(body) : null; } catch { data = body; }
  if (!response.ok) throw new Error(typeof data === "object" ? data?.message || data?.hint || "Database request failed" : String(data));
  return data;
}
export async function createDelegatedWallet(userId, agentId = null) {
  const { Keypair } = await solana(); const wallet = Keypair.generate();
  const encrypted = encrypt(wallet.secretKey); const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  const rows = await db("agent_delegated_wallets", { method: "POST", body: JSON.stringify({ user_id: userId, agent_id: agentId, public_key: wallet.publicKey.toBase58(), ...encrypted, per_trade_cap_usd: 250, lifetime_cap_usd: 1000, expires_at: expires }) });
  const row = rows?.[0] || rows; return { id: row.id, publicKey: row.public_key, perTradeCapUsd: Number(row.per_trade_cap_usd), lifetimeCapUsd: Number(row.lifetime_cap_usd), expiresAt: row.expires_at };
}
export async function revokeDelegatedWallet(userId) { await db(`agent_delegated_wallets?user_id=eq.${encodeURIComponent(userId)}&revoked=eq.false`, { method: "PATCH", body: JSON.stringify({ revoked: true, revoked_at: new Date().toISOString() }), headers: { Prefer: "return=minimal" } }); }
export async function activeDelegatedWallet(userId) { const rows = await db(`agent_delegated_wallets?user_id=eq.${encodeURIComponent(userId)}&revoked=eq.false&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=created_at.desc&limit=1`); return rows?.[0] || null; }
export async function delegatedWalletDb() { return db; }
export async function enforceDelegatedCaps(row, amountUsd) {
  const amount = Number(amountUsd); if (!Number.isFinite(amount) || amount <= 0) throw new Error("Trade amount must be positive");
  if (amount > Number(row.per_trade_cap_usd)) throw new Error(`Per-trade cap exceeded: maximum $${row.per_trade_cap_usd}`);
  const trades = await db(`agent_delegated_wallet_trades?wallet_id=eq.${encodeURIComponent(row.id)}&status=neq.failed&select=amount_usd`);
  const spent = (trades || []).reduce((sum, trade) => sum + Number(trade.amount_usd || 0), 0);
  if (spent + amount > Number(row.lifetime_cap_usd)) throw new Error(`Lifetime cap exceeded: remaining $${Math.max(0, Number(row.lifetime_cap_usd) - spent).toFixed(2)}`);
}
export async function signAndSendDelegated(row, unsignedTxBase64) {
  const { Keypair, VersionedTransaction, Connection } = await solana(); const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(row.iv, "base64")); decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  const secret = Buffer.concat([decipher.update(Buffer.from(row.encrypted_secret, "base64")), decipher.final()]); const wallet = Keypair.fromSecretKey(new Uint8Array(secret));
  const tx = VersionedTransaction.deserialize(Buffer.from(unsignedTxBase64, "base64")); tx.sign([wallet]);
  const rpc = process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL || "https://api.mainnet-beta.solana.com"; return new Connection(rpc, "confirmed").sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
}
export async function recordDelegatedTrade(row, userId, trade) { await db("agent_delegated_wallet_trades", { method: "POST", body: JSON.stringify({ wallet_id: row.id, user_id: userId, ...trade }) }); }
export { db };
