/**
 * Official-bot auto-buy: per-user hot wallet, server-signed Jupiter swap.
 * Toggle on MCP dashboard (/agent) or /telegram. No Sign link, no second click.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import { callFn } from "../ogdex/_lib.js";

const WRAP_SALT = "orbitx-tg-auto-trade-v1";

export function autoTradeWrapKeyBytes() {
  const raw = String(process.env.TELEGRAM_AUTO_TRADE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!raw) return null;
  return scryptSync(raw, WRAP_SALT, 32);
}

export function encryptSecretBytes(secret, key = autoTradeWrapKeyBytes()) {
  if (!key) throw new Error("auto_trade_unconfigured");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(secret)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecretBytes(ciphertext, iv, key = autoTradeWrapKeyBytes()) {
  if (!key) throw new Error("auto_trade_unconfigured");
  const buf = Buffer.from(String(ciphertext || ""), "base64");
  const ivBuf = Buffer.from(String(iv || ""), "base64");
  if (buf.length < 17 || ivBuf.length !== 12) throw new Error("auto_trade_corrupt");
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(data), decipher.final()]));
}

function asUuid(userId) {
  const id = String(userId || "").trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : "";
}

export async function loadAutoTradePublicKey(sb, userId) {
  const state = await loadAutoTradeState(sb, userId);
  return state?.publicKey || null;
}

export async function loadAutoTradeState(sb, userId) {
  const id = asUuid(userId);
  if (!id || typeof sb !== "function") return null;
  try {
    const rows = await sb(
      `telegram_auto_trade_wallets?user_id=eq.${encodeURIComponent(id)}&select=public_key,enabled&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    const pk = String(row?.public_key || "").trim();
    if (!pk) return null;
    return { publicKey: pk, enabled: row.enabled === true };
  } catch {
    try {
      const rows = await sb(
        `telegram_auto_trade_wallets?user_id=eq.${encodeURIComponent(id)}&select=public_key&limit=1`,
      );
      const pk = String(rows?.[0]?.public_key || "").trim();
      return pk ? { publicKey: pk, enabled: null } : null;
    } catch {
      return null;
    }
  }
}

async function patchWalletEnabled(sb, userId, enabled) {
  const id = asUuid(userId);
  if (!id) return;
  await sb(`telegram_auto_trade_wallets?user_id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled: Boolean(enabled), updated_at: new Date().toISOString() }),
  }).catch(() => null);
}

export async function ensureAutoTradeWallet(sb, userId, opts = {}) {
  const id = asUuid(userId);
  if (!id) return { ok: false, error: "unauthorized", message: "Sign in to enable Auto-buy." };
  if (!autoTradeWrapKeyBytes()) {
    return {
      ok: false,
      error: "auto_trade_unconfigured",
      message: "Auto-buy is not configured on the server (missing TELEGRAM_AUTO_TRADE_KEY).",
    };
  }
  const existing = await loadAutoTradeState(sb, id);
  if (existing?.publicKey) {
    if (opts.enabled != null) await patchWalletEnabled(sb, id, opts.enabled);
    return {
      ok: true,
      publicKey: existing.publicKey,
      created: false,
      enabled: opts.enabled != null ? Boolean(opts.enabled) : existing.enabled,
    };
  }

  const kp = Keypair.generate();
  const enc = encryptSecretBytes(kp.secretKey);
  const row = {
    user_id: id,
    public_key: kp.publicKey.toBase58(),
    secret_cipher: enc.ciphertext,
    secret_iv: enc.iv,
    enabled: opts.enabled !== false,
    updated_at: new Date().toISOString(),
  };
  try {
    await sb("telegram_auto_trade_wallets", {
      method: "POST",
      body: JSON.stringify(row),
    });
  } catch (e) {
    try {
      const { enabled: _enabled, ...legacy } = row;
      await sb("telegram_auto_trade_wallets", {
        method: "POST",
        body: JSON.stringify(legacy),
      });
    } catch (e2) {
      const again = await loadAutoTradePublicKey(sb, id);
      if (again) return { ok: true, publicKey: again, created: false, enabled: opts.enabled !== false };
      return {
        ok: false,
        error: "auto_wallet_create_failed",
        message: e2 instanceof Error ? e2.message : (e instanceof Error ? e.message : "Could not create Auto-buy wallet. Apply the telegram_auto_trade_wallets migration."),
      };
    }
  }
  return { ok: true, publicKey: kp.publicKey.toBase58(), created: true, enabled: opts.enabled !== false };
}

/** Dashboard / Telegram toggle. Creates the hot wallet on enable; never returns the secret. */
export async function setAutoBuyEnabled(sb, userId, enabled) {
  const id = asUuid(userId);
  if (!id) return { ok: false, error: "unauthorized", message: "Sign in to enable Auto-buy." };
  const on = Boolean(enabled);
  let wallet = { ok: true, publicKey: null, created: false };
  if (on) {
    wallet = await ensureAutoTradeWallet(sb, id, { enabled: true });
    if (!wallet.ok) return wallet;
  } else {
    const existing = await loadAutoTradePublicKey(sb, id);
    if (existing) {
      await patchWalletEnabled(sb, id, false);
      wallet = { ok: true, publicKey: existing, created: false };
    }
  }
  await sb(`telegram_orbitx_links?user_id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ auto_buy: on, updated_at: new Date().toISOString() }),
  }).catch(() => null);
  return {
    ok: true,
    enabled: on,
    publicKey: wallet.publicKey || null,
    created: Boolean(wallet.created),
  };
}

async function loadAutoTradeKeypair(sb, userId) {
  const id = asUuid(userId);
  if (!id) return null;
  const rows = await sb(
    `telegram_auto_trade_wallets?user_id=eq.${encodeURIComponent(id)}&select=public_key,secret_cipher,secret_iv&limit=1`,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.secret_cipher || !row?.secret_iv) return null;
  const secret = decryptSecretBytes(row.secret_cipher, row.secret_iv);
  const kp = Keypair.fromSecretKey(secret);
  if (row.public_key && kp.publicKey.toBase58() !== row.public_key) {
    throw new Error("Auto-buy wallet key mismatch");
  }
  return kp;
}

function signTxBase64(keypair, b64) {
  const raw = Buffer.from(String(b64 || ""), "base64");
  if (!raw.length) throw new Error("empty_transaction");
  try {
    const vtx = VersionedTransaction.deserialize(raw);
    vtx.sign([keypair]);
    return Buffer.from(vtx.serialize()).toString("base64");
  } catch {
    const tx = Transaction.from(raw);
    tx.partialSign(keypair);
    return Buffer.from(tx.serialize()).toString("base64");
  }
}

export async function sendSignedBase64(signedB64) {
  const r = await callFn("rpc-proxy", {
    method: "sendTransaction",
    params: [signedB64, { encoding: "base64", skipPreflight: true, maxRetries: 3 }],
    id: 1,
    provider: "helius",
  });
  const sig = r?.data?.result ?? r?.result ?? r?.data?.error ?? r?.error;
  if (typeof sig === "string" && sig.length > 20) return sig;
  const err = r?.data?.error?.message || r?.error?.message || r?.message || "broadcast_failed";
  throw new Error(String(err));
}

export async function broadcastAutoTrade(keypair, txB64, feeTxB64) {
  const signatures = [];
  if (feeTxB64) {
    signatures.push(await sendSignedBase64(signTxBase64(keypair, feeTxB64)));
  }
  const sig = await sendSignedBase64(signTxBase64(keypair, txB64));
  signatures.push(sig);
  return { signature: sig, signatures };
}

/**
 * When Auto-buy is on, build the Jupiter tx for the hot wallet and broadcast it.
 * Returns null when Auto-buy is off (caller should return a Sign link).
 */
export async function tryAutoExecuteTrade(opts) {
  const {
    sb,
    userId,
    auto,
    fetchJson,
    base,
    action = "buy",
    mint,
    amount,
    slippage = 10,
    pool = "auto",
    amountUsd = null,
    solUsd = null,
  } = opts || {};
  if (!auto) return null;
  if (!userId) {
    return {
      ok: false,
      error: "unauthorized",
      message: "Sign in and turn Auto-buy on in the MCP dashboard.",
    };
  }
  const state = await loadAutoTradeState(sb, userId);
  if (state?.enabled === false) return null;
  let keypair;
  try {
    keypair = await loadAutoTradeKeypair(sb, userId);
  } catch (e) {
    return {
      ok: false,
      error: "auto_trade_unconfigured",
      message: e instanceof Error ? e.message : "Auto-buy wallet could not be unlocked.",
    };
  }
  if (!keypair) {
    const created = await ensureAutoTradeWallet(sb, userId, { enabled: true });
    if (!created.ok) return created;
    return {
      ok: false,
      error: "auto_wallet_unfunded",
      requiresSignature: false,
      executed: false,
      wallet: created.publicKey,
      mint,
      amount,
      message: `Auto-buy is ON. Send SOL to ${created.publicKey} then send the buy again — no Sign link.`,
      solscanAccount: `https://solscan.io/account/${created.publicKey}`,
    };
  }

  const pk = keypair.publicKey.toBase58();
  const data = await fetchJson(`${base}/api/ogdex/trade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: pk,
      action,
      mint,
      amount,
      denominatedInSol: action === "buy",
      slippage,
      pool,
      platformFee: true,
    }),
  });
  if (!data?.ok || !data?.tx) {
    return {
      ok: false,
      status: "prepare_failed",
      executed: false,
      requiresSignature: false,
      error: data?.error || "Could not build trade",
      wallet: pk,
      mint,
      amount,
      message: data?.error || "Could not build the Jupiter swap. Check SOL balance on the Auto-buy wallet.",
    };
  }

  try {
    const sent = await broadcastAutoTrade(keypair, data.tx, data.feeTx);
    return {
      ok: true,
      executed: true,
      requiresSignature: false,
      confirmMode: "auto",
      status: "filled",
      action,
      wallet: pk,
      mint,
      amount,
      amountUsd,
      solUsd,
      slippage,
      pool,
      via: data.via || "jupiter",
      signature: sent.signature,
      signatures: sent.signatures,
      solscan: `https://solscan.io/tx/${sent.signature}`,
      solscanToken: mint ? `https://solscan.io/token/${encodeURIComponent(mint)}` : null,
      solscanAccount: `https://solscan.io/account/${pk}`,
      message: `Bought. Tx ${sent.signature}`,
      instructions: ["Already sent. No Sign step."],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      executed: false,
      requiresSignature: false,
      error: "auto_broadcast_failed",
      wallet: pk,
      mint,
      amount,
      message: /insufficient|0x1/i.test(msg)
        ? `Auto-buy wallet needs SOL: ${pk}`
        : msg,
      solscanAccount: `https://solscan.io/account/${pk}`,
    };
  }
}
