/**
 * POST /api/orbitx-tx-report
 *
 * Authenticated (or signature-verified) report of a platform transaction.
 * Never marks completed until Solana RPC confirms the signature with no error.
 * Fee is recomputed server-side: min(1.2% of USD, $10). Client fee fields are ignored.
 */
import { computePlatformTxFee, PLATFORM_TX_FEE_WALLET } from "../shared/platform-tx-fee.js";
import { appFromPath, recordOwnerEvent, upsertLedger } from "./orbitx/owner-command.js";

export const config = { maxDuration: 30 };

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "") ||
    "https://api.mainnet-beta.solana.com"
  );
}

async function rpc(method, params) {
  const r = await fetch(rpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || "rpc_error");
  return j.result;
}

async function authUser(token) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function sb(path, init = {}) {
  if (!SERVICE_KEY) throw new Error("missing_service_role");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text.slice(0, 240) || `supabase ${r.status}`);
  return text ? JSON.parse(text) : null;
}

function lamportsToWallet(tx, wallet) {
  if (!tx?.transaction || !tx?.meta) return 0;
  const keys = (tx.transaction.message?.accountKeys || []).map((k) =>
    typeof k === "string" ? k : k.pubkey || k,
  );
  const idx = keys.findIndex((k) => String(k) === wallet);
  if (idx < 0) return 0;
  const pre = Number(tx.meta.preBalances?.[idx] || 0);
  const post = Number(tx.meta.postBalances?.[idx] || 0);
  return Math.max(0, post - pre);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const user = await authUser(token);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const signature = String(body.signature || body.tx_signature || "").trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) {
      return res.status(400).json({ error: "signature required" });
    }

    let tx = null;
    try {
      tx = await rpc("getTransaction", [
        signature,
        { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
      ]);
    } catch {
      tx = null;
    }

    const failed = Boolean(tx?.meta?.err);
    const verified = Boolean(tx) && !failed;
    const status = !tx ? "processing" : failed ? "failed" : "completed";
    const feeLamports = verified ? lamportsToWallet(tx, PLATFORM_TX_FEE_WALLET) : 0;
    const valueUsd = Number(body.valueUsd || body.value_usd || 0);
    const fee = computePlatformTxFee({
      valueUsd: valueUsd > 0 ? valueUsd : undefined,
      valueSol: feeLamports > 0 && valueUsd <= 0 ? undefined : Number(body.valueSol || body.amountSol || 0),
      solUsd: Number(body.solUsd || 0),
    });
    const actualFeeUsd =
      feeLamports > 0 && Number(body.solUsd) > 0
        ? (feeLamports / 1e9) * Number(body.solUsd)
        : verified
          ? fee.feeUsd
          : null;

    const application = body.application || appFromPath(body.path);
    const row = {
      chain: "solana",
      tx_signature: signature,
      user_id: user?.id || body.userId || null,
      wallet_address: body.wallet || body.wallet_address || null,
      application,
      tx_type: body.txType || body.tx_type || "swap",
      status,
      value_usd: valueUsd || fee.valueUsd || null,
      fee_bps: 120,
      fee_usd_calc: fee.feeUsd,
      fee_usd_actual: actualFeeUsd,
      fee_cap_applied: fee.capApplied,
      verified_onchain: verified,
      error: failed ? JSON.stringify(tx.meta.err).slice(0, 240) : null,
      metadata: {
        mint: body.mint || null,
        path: body.path || null,
        feeWallet: PLATFORM_TX_FEE_WALLET,
        feeLamports,
      },
    };

    await upsertLedger(sb, row);
    if (verified) {
      await recordOwnerEvent(sb, {
        event_type: "JUPITER_TRANSACTION",
        user_id: row.user_id,
        wallet_address: row.wallet_address,
        application,
        title: `Swap completed${valueUsd ? ` — $${Number(valueUsd).toFixed(2)}` : ""}`,
        tx_signature: signature,
        metadata: { feeUsd: actualFeeUsd, capApplied: fee.capApplied },
      });
      if (actualFeeUsd > 0) {
        await recordOwnerEvent(sb, {
          event_type: "FEE_COLLECTED",
          user_id: row.user_id,
          wallet_address: row.wallet_address,
          application,
          title: `Platform fee — $${Number(actualFeeUsd).toFixed(2)}`,
          tx_signature: signature,
        });
      }
    } else if (failed) {
      await recordOwnerEvent(sb, {
        event_type: "SWAP_FAILED",
        user_id: row.user_id,
        wallet_address: row.wallet_address,
        application,
        title: "Swap failed",
        tx_signature: signature,
      });
    }

    return res.status(200).json({
      ok: true,
      status,
      verified,
      signature,
      feeUsd: actualFeeUsd,
      explorer: `https://solscan.io/tx/${signature}`,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, skipped: true, error: String(e?.message || e).slice(0, 160) });
  }
}
