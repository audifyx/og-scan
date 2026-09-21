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

export async function decryptDelegatedSecret(row) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_secret, "base64")), decipher.final()]);
}
export async function exportDelegatedSecret(row) {
  const secret = await decryptDelegatedSecret(row);
  const bs58 = await import("bs58");
  const enc = bs58.default ? bs58.default.encode(secret) : bs58.encode(secret);
  secret.fill(0);
  return enc;
}
export async function loadDelegatedKeypair(row) {
  const { Keypair } = await solana();
  const secret = await decryptDelegatedSecret(row);
  const wallet = Keypair.fromSecretKey(new Uint8Array(secret));
  secret.fill(0);
  return wallet;
}
export async function createAppWallet(userId, agentId = null) {
  const { Keypair } = await solana();
  const wallet = Keypair.generate();
  const encrypted = encrypt(wallet.secretKey);
  const expires = new Date(Date.now() + 3650 * 86400000).toISOString();
  const rows = await db("agent_delegated_wallets", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      agent_id: agentId,
      public_key: wallet.publicKey.toBase58(),
      ...encrypted,
      per_trade_cap_usd: 250,
      lifetime_cap_usd: 5000,
      expires_at: expires,
    }),
  });
  const row = rows?.[0] || rows;
  return {
    id: row.id,
    publicKey: row.public_key,
    perTradeCapUsd: Number(row.per_trade_cap_usd),
    lifetimeCapUsd: Number(row.lifetime_cap_usd),
    expiresAt: row.expires_at,
    kind: "in_app",
  };
}
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag";
function rpcUrl() {
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : (process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com");
}
export async function jupiterSwapDelegated(row, { inputMint, outputMint, amount }) {
  const kp = await loadDelegatedKeypair(row);
  const owner = kp.publicKey.toBase58();
  const amt = String(Math.max(1, Math.floor(Number(amount) || 0)));
  const qr = await fetch(`${JUP}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amt}&slippageBps=200&restrictIntermediateTokens=true`, { signal: AbortSignal.timeout(12000) });
  const quote = await qr.json().catch(() => ({}));
  if (!qr.ok || !quote?.outAmount) throw new Error(quote?.error || "jupiter quote failed");
  const sr = await fetch(`${JUP}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: owner,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 50000,
    }),
    signal: AbortSignal.timeout(12000),
  });
  const sw = await sr.json().catch(() => ({}));
  if (!sr.ok || !sw.swapTransaction) throw new Error(sw.error || "jupiter swap failed");
  const { VersionedTransaction } = await solana();
  const tx = VersionedTransaction.deserialize(Buffer.from(sw.swapTransaction, "base64"));
  tx.sign([kp]);
  const b64 = Buffer.from(tx.serialize()).toString("base64");
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [b64, { encoding: "base64", skipPreflight: true, maxRetries: 4 }] }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc send failed");
  return { ok: true, signature: j.result, outAmount: quote.outAmount, inAmount: quote.inAmount, owner, inputMint, outputMint };
}
export { SOL_MINT };
