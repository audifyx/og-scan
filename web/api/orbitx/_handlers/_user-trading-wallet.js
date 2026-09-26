/**
 * Super Computer desk wallet — same model as orbitxtrade.world:
 * one generated Solana key per user, sealed at rest, backend signs, user can export.
 */
import crypto from "node:crypto";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUP = "https://lite-api.jup.ag";

/* ------------------------------------------------------------------ */
/* Signing-auth provenance (F2).                                       */
/*                                                                     */
/* needAuth() used to trust ANY object shaped like { userId } — a       */
/* forged literal passed straight through to backend signing. Every    */
/* credential class minted by the dashboard auth flow is already       */
/* stamped with `source` by enrichAuth (orbitx-hub.js): bearer |        */
/* oauth_token | link_auth | link_session. Signing functions must only */
/* accept those, plus "tick" for the server-side 5-min auto-fill sweep */
/* (no user present on that path). Anything else is rejected.          */
/* ------------------------------------------------------------------ */
export const TICK_AUTH_SOURCE = "tick";
export const SIGNING_AUTH_SOURCES = new Set([
  "bearer",
  "oauth_token",
  "link_auth",
  "link_session",
  TICK_AUTH_SOURCE,
]);

export function isSigningAuth(auth) {
  return !!(
    auth &&
    typeof auth === "object" &&
    typeof auth.userId === "string" &&
    auth.userId.length > 0 &&
    SIGNING_AUTH_SOURCES.has(auth.source)
  );
}

/* ------------------------------------------------------------------ */
/* Slippage validation (F5). The Jupiter quote used to hardcode        */
/* slippageBps=200 with no caller control. It is now a validated      */
/* caller-supplied parameter: integer basis points, 0–5000, default   */
/* 200. Anything outside the range throws BEFORE any network call —   */
/* a bad slippage must never silently become a fill at any price.     */
/* ------------------------------------------------------------------ */
export const SLIPPAGE_BPS_DEFAULT = 200;
export const SLIPPAGE_BPS_MAX = 5000;

export function coerceSlippageBps(v) {
  if (v == null || v === "") return SLIPPAGE_BPS_DEFAULT;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`bad_slippage: slippageBps must be a number 0–${SLIPPAGE_BPS_MAX} (basis points), got ${JSON.stringify(v)}`);
  }
  const bps = Math.round(n);
  if (bps < 0 || bps > SLIPPAGE_BPS_MAX) {
    throw new Error(`bad_slippage: slippageBps ${bps} out of range 0–${SLIPPAGE_BPS_MAX} (basis points)`);
  }
  return bps;
}

export function jupiterQuoteUrl(inputMint, outputMint, amount, slippageBps) {
  const amt = String(Math.max(1, Math.floor(Number(amount) || 0)));
  return `${JUP}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amt}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`;
}
/* End slippage validation (F5). */

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
  const base =
    process.env.SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://ffjipnkhcebjvttliptb.supabase.co";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing on Vercel");
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
  if (!userId) return null;
  const q1 = await db(
    `wallet_secrets?user_id=eq.${encodeURIComponent(userId)}&chain=eq.solana&select=id,user_id,address,ciphertext,created_at&limit=1`,
  ).catch((e) => ({ __err: String(e.message || e) }));
  let row = Array.isArray(q1) ? q1[0] : null;
  if (!row) {
    const q2 = await db(
      `wallet_secrets?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,address,ciphertext,chain,created_at&order=created_at.desc&limit=1`,
    ).catch(() => []);
    row = Array.isArray(q2) ? q2[0] : null;
  }
  if (!row) return null;
  return { ...row, public_key: row.address || row.public_key };
}


export async function getDeskSolLamports(owner) {
  const funds = await getDeskFunds(owner);
  return funds.lamports;
}

export async function getDeskFunds(owner) {
  const empty = {
    owner: owner || "",
    lamports: 0,
    sol: 0,
    usdcRaw: 0,
    usdc: 0,
    wsolRaw: 0,
    wsol: 0,
    rpc: null,
    error: owner ? null : "no_owner",
  };
  if (!owner) return empty;

  const key = String(process.env.REACT_APP_HELIUS_KEY || process.env.HELIUS_API_KEY || "").trim();
  const rpcs = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-rpc.publicnode.com",
    "https://rpc.ankr.com/solana",
    key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : null,
  ].filter(Boolean);

  async function call(url, method, params) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10000),
    });
    return r.json();
  }

  let lamports = 0;
  let used = null;
  let lastErr = null;
  for (const url of rpcs) {
    try {
      const j = await call(url, "getBalance", [owner]);
      if (j.error) {
        lastErr = j.error.message || "getBalance error";
        continue;
      }
      const raw = j.result && typeof j.result === "object" ? j.result.value : j.result;
      const n = Number(raw);
      if (Number.isFinite(n)) {
        lamports = n;
        used = url.split("?")[0];
        break;
      }
    } catch (e) {
      lastErr = String(e.message || e);
    }
  }

  if (!used) {
    try {
      const { Connection, PublicKey } = await import("@solana/web3.js");
      const conn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      lamports = await conn.getBalance(new PublicKey(owner), "confirmed");
      used = "web3.js";
      lastErr = null;
    } catch (e) {
      lastErr = String(e.message || e);
    }
  }

  async function mintAmt(mint) {
    for (const url of rpcs) {
      try {
        const j = await call(url, "getTokenAccountsByOwner", [owner, { mint }, { encoding: "jsonParsed" }]);
        if (j.error) continue;
        return (j.result?.value || []).reduce(
          (s, a) => s + Number(a?.account?.data?.parsed?.info?.tokenAmount?.amount || 0),
          0,
        );
      } catch {}
    }
    return 0;
  }

  const usdcRaw = await mintAmt("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const wsolRaw = await mintAmt("So11111111111111111111111111111111111111112");

  return {
    owner,
    lamports,
    sol: lamports / 1e9,
    usdcRaw,
    usdc: usdcRaw / 1e6,
    wsolRaw,
    wsol: wsolRaw / 1e9,
    rpc: used,
    error: used ? null : lastErr,
  };
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

/* ------------------------------------------------------------------ */
/* Tx confirmation (F3).                                               */
/*                                                                     */
/* signUserSwap / signAndSendUserTx used to return { ok:true } the      */
/* moment the RPC accepted the broadcast (skipPreflight:true) — no      */
/* confirmation. Callers then reported success for txs that may never  */
/* have landed. Every broadcast is now followed by a bounded           */
/* getSignatureStatuses poll. The honest outcome is: confirmed |        */
/* failed-on-chain | unknown (pending). Callers must surface pending   */
/* instead of claiming success, and the tick must settle by signature  */
/* status rather than re-executing blindly (that would double-fill if  */
/* the first tx lands late).                                           */
/* ------------------------------------------------------------------ */

export async function getTxConfirmationStatus(signature, { searchHistory = false } = {}) {
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignatureStatuses",
      params: [[signature], { searchTransactionHistory: !!searchHistory }],
    }),
    signal: AbortSignal.timeout(10000),
  });
  const j = await r.json().catch(() => ({}));
  const v = j?.result?.value?.[0];
  if (!v) return { status: "unknown", signature };
  if (v.err) {
    return { status: v.confirmationStatus || "processed", failed: true, err: v.err, signature };
  }
  const cs = v.confirmationStatus || (typeof v.confirmations === "number" ? "confirmed" : "unknown");
  return { status: cs, slot: v.slot ?? null, confirmations: v.confirmations ?? null, signature };
}

export async function pollTxConfirmation(signature, { budgetMs = 20000, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + Math.max(1000, Number(budgetMs) || 20000);
  const wait = Math.max(250, Number(intervalMs) || 2000);
  let last = { status: "unknown", signature };
  for (;;) {
    try {
      last = await getTxConfirmationStatus(signature);
    } catch {
      last = { status: "unknown", signature }; // transport hiccup — keep waiting, don't crash the poll
    }
    // NOTE: a tx can be "confirmed" (included in a block) yet failed
    // execution (err set) — check failed FIRST, never report it as success.
    if (last.failed) {
      return { confirmed: false, failed: true, confirmationStatus: last.status, txError: last.err, signature };
    }
    if (last.status === "confirmed" || last.status === "finalized") {
      return { confirmed: true, confirmationStatus: last.status, slot: last.slot ?? null, signature };
    }
    if (Date.now() >= deadline) {
      return { confirmed: false, unknown: true, confirmationStatus: "unknown", signature };
    }
    await new Promise((r) => setTimeout(r, wait));
  }
}

export async function signUserSwap(row, { inputMint, outputMint, amount, slippageBps }) {
  const { VersionedTransaction } = await import("@solana/web3.js");
  const kp = await loadKeypair(row);
  const owner = kp.publicKey.toBase58();
  const slip = coerceSlippageBps(slippageBps); // validated before any network call
  const qr = await fetch(
    jupiterQuoteUrl(inputMint, outputMint, amount, slip),
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
  const signature = j.result;
  // F3: broadcast acceptance is NOT success — confirm on-chain before
  // claiming it. Honest outcomes only: confirmed | failed | pending.
  const conf = await pollTxConfirmation(signature);
  if (conf.confirmed) {
    return { ok: true, signature, owner, outAmount: quote.outAmount, slippageBps: slip, confirmed: true, confirmationStatus: conf.confirmationStatus };
  }
  if (conf.failed) {
    return { ok: false, signature, owner, outAmount: quote.outAmount, slippageBps: slip, confirmed: false, error: "tx_failed_onchain", confirmationStatus: conf.confirmationStatus, message: `Swap broadcast but failed on-chain: ${JSON.stringify(conf.txError)}` };
  }
  return { ok: false, pending: true, signature, owner, outAmount: quote.outAmount, slippageBps: slip, confirmed: false, error: "tx_unconfirmed", confirmationStatus: "unknown", message: "Swap broadcast accepted by the RPC but not confirmed within 20s. It may still land — check the explorer before retrying; do NOT blindly re-submit." };
}


export async function loadDeskKeypair(row) {
  return loadKeypair(row);
}

export async function signAndSendUserTx(row, txBase64, extraSigners = []) {
  const { VersionedTransaction, Transaction } = await import("@solana/web3.js");
  const kp = await loadKeypair(row);
  const raw = Buffer.from(String(txBase64 || ""), "base64");
  if (!raw.length) throw new Error("empty transaction");
  const signers = [kp, ...extraSigners.filter(Boolean)];
  let serialized;
  try {
    const tx = VersionedTransaction.deserialize(raw);
    tx.sign(signers);
    serialized = Buffer.from(tx.serialize()).toString("base64");
  } catch {
    const tx = Transaction.from(raw);
    tx.partialSign(...signers);
    serialized = tx.serialize().toString("base64");
  }
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: [serialized, { encoding: "base64", skipPreflight: true, maxRetries: 4 }],
    }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc send failed");
  const signature = j.result;
  // F3: broadcast acceptance is NOT success — confirm on-chain before
  // claiming it. Honest outcomes only: confirmed | failed | pending.
  const conf = await pollTxConfirmation(signature);
  if (conf.confirmed) {
    return { ok: true, signature, owner: kp.publicKey.toBase58(), confirmed: true, confirmationStatus: conf.confirmationStatus };
  }
  if (conf.failed) {
    return { ok: false, signature, owner: kp.publicKey.toBase58(), confirmed: false, error: "tx_failed_onchain", confirmationStatus: conf.confirmationStatus, message: `Transaction broadcast but failed on-chain: ${JSON.stringify(conf.txError)}` };
  }
  return { ok: false, pending: true, signature, owner: kp.publicKey.toBase58(), confirmed: false, error: "tx_unconfirmed", confirmationStatus: "unknown", message: "Transaction broadcast accepted by the RPC but not confirmed within 20s. It may still land — check the explorer before retrying; do NOT blindly re-submit." };
}
