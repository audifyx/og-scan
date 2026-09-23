/**
 * Per-user MCP trading wallet. Not delegated-agent. Not owner/hunter.
 * One generated keypair per user. Encrypted at rest so MCP can sign their txs.
 */
import crypto from "node:crypto";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag";

function encKey() {
  const raw = process.env.APP_WALLET_ENC_KEY || process.env.DELEGATED_WALLET_ENC_KEY || "";
  if (!raw) throw new Error("APP_WALLET_ENC_KEY is not configured");
  const value = Buffer.from(raw, "base64");
  if (value.length !== 32) throw new Error("APP_WALLET_ENC_KEY must decode to 32 bytes");
  return value;
}
function encrypt(bytes) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(bytes)), cipher.final()]);
  return {
    encrypted_secret: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
  };
}
function decrypt(row) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_secret, "base64")), decipher.final()]);
}
async function db(path, init = {}) {
  const base = process.env.SUPABASE_URL || "";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !secret) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  let data = null;
  try { data = body ? JSON.parse(body) : null; } catch { data = body; }
  if (!response.ok) throw new Error(typeof data === "object" ? data?.message || data?.hint || "Database request failed" : String(data));
  return data;
}

export async function getUserWallet(userId) {
  const rows = await db(
    `mcp_user_wallets?user_id=eq.${encodeURIComponent(userId)}&revoked=eq.false&order=created_at.desc&limit=1`,
  ).catch(() => []);
  return rows?.[0] || null;
}

export async function createUserWallet(userId) {
  const existing = await getUserWallet(userId);
  if (existing) return { id: existing.id, publicKey: existing.public_key, existing: true };
  const { Keypair } = await import("@solana/web3.js");
  const wallet = Keypair.generate();
  const encrypted = encrypt(wallet.secretKey);
  const rows = await db("mcp_user_wallets", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      public_key: wallet.publicKey.toBase58(),
      ...encrypted,
      revoked: false,
    }),
  });
  const row = rows?.[0] || rows;
  return { id: row.id, publicKey: row.public_key, existing: false };
}

export async function revokeUserWallet(userId) {
  await db(`mcp_user_wallets?user_id=eq.${encodeURIComponent(userId)}&revoked=eq.false`, {
    method: "PATCH",
    body: JSON.stringify({ revoked: true, revoked_at: new Date().toISOString() }),
    headers: { Prefer: "return=minimal" },
  });
}

export async function exportUserWalletSecret(row) {
  const secret = decrypt(row);
  const bs58 = await import("bs58");
  const enc = bs58.default ? bs58.default.encode(secret) : bs58.encode(secret);
  secret.fill(0);
  return enc;
}

function rpcUrl() {
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
}

export async function signUserSwap(row, { inputMint, outputMint, amount }) {
  const { Keypair, VersionedTransaction } = await import("@solana/web3.js");
  const secret = decrypt(row);
  const kp = Keypair.fromSecretKey(new Uint8Array(secret));
  secret.fill(0);
  const owner = kp.publicKey.toBase58();
  const amt = String(Math.max(1, Math.floor(Number(amount) || 0)));
  const qr = await fetch(
    `${JUP}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amt}&slippageBps=200&restrictIntermediateTokens=true`,
    { signal: AbortSignal.timeout(12000) },
  );
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
  const tx = VersionedTransaction.deserialize(Buffer.from(sw.swapTransaction, "base64"));
  tx.sign([kp]);
  const b64 = Buffer.from(tx.serialize()).toString("base64");
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [b64, { encoding: "base64", skipPreflight: true, maxRetries: 4 }],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc send failed");
  return { ok: true, signature: j.result, owner, outAmount: quote.outAmount };
}

export { SOL_MINT };
