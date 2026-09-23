/**
 * Super Computer desk wallet — same model as orbitxtrade.world:
 * one generated Solana key per user, sealed at rest, backend signs, user can export.
 */
import crypto from "node:crypto";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag";

function kek() {
  const raw =
    process.env.EMBEDDED_WALLET_SECRET ||
    process.env.APP_WALLET_ENC_KEY ||
    process.env.DELEGATED_WALLET_ENC_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!raw) throw new Error("EMBEDDED_WALLET_SECRET is not configured");
  return crypto.createHash("sha256").update(`orbitx-desk-wallet:${raw}`).digest();
}

function sealSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", kek(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function openSecret(blob) {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", kek(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function packDeskSecret(secret, mnemonic) {
  if (!mnemonic) return secret;
  return JSON.stringify({ v: 2, secret, mnemonic });
}

function unpackDeskSecret(plain) {
  const trimmed = String(plain || "").trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.secret === "string") {
        return { secret: parsed.secret, mnemonic: parsed.mnemonic || null };
      }
    } catch {}
  }
  return { secret: trimmed, mnemonic: null };
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
    `wallet_secrets?user_id=eq.${encodeURIComponent(userId)}&chain=eq.solana&select=id,user_id,address,ciphertext,created_at&limit=1`,
  ).catch(() => []);
  const row = rows?.[0];
  if (!row) return null;
  return { ...row, public_key: row.address };
}

export async function createUserWallet(userId) {
  const existing = await getUserWallet(userId);
  if (existing) return { id: existing.id, publicKey: existing.public_key, existing: true };
  const { Keypair } = await import("@solana/web3.js");
  const bs58 = (await import("bs58")).default || (await import("bs58"));
  const wallet = Keypair.generate();
  const address = wallet.publicKey.toBase58();
  const secret = bs58.encode(wallet.secretKey);
  const ciphertext = sealSecret(packDeskSecret(secret, null));
  const rows = await db("wallet_secrets", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, chain: "solana", address, ciphertext }),
  });
  const row = rows?.[0] || rows;
  return { id: row.id, publicKey: address, existing: false };
}

export async function revokeUserWallet(userId) {
  await db(`wallet_secrets?user_id=eq.${encodeURIComponent(userId)}&chain=eq.solana`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function exportUserWalletSecret(row) {
  const packed = openSecret(row.ciphertext);
  const opened = unpackDeskSecret(packed);
  return opened.secret;
}

async function loadKeypair(row) {
  const { Keypair } = await import("@solana/web3.js");
  const bs58 = (await import("bs58")).default || (await import("bs58"));
  const packed = openSecret(row.ciphertext);
  const opened = unpackDeskSecret(packed);
  return Keypair.fromSecretKey(bs58.decode(opened.secret));
}

function rpcUrl() {
  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : "https://api.mainnet-beta.solana.com";
}

export async function signUserSwap(row, { inputMint, outputMint, amount }) {
  const { VersionedTransaction } = await import("@solana/web3.js");
  const kp = await loadKeypair(row);
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
