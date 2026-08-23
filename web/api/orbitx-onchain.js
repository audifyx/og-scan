/**
 * OrbitX on-chain attestation + indexer.
 * Route: /api/orbitx-onchain  (NOT /api/orbitx/* — that rewrites to orbitx-hub)
 *
 * Blockchain is authority. This API verifies memos via RPC and caches them.
 */
import { createClient } from "@supabase/supabase-js";
import {
  contentHash,
  costNote,
  extractMemosFromTx,
  isAttestKind,
  isLikelySignature,
  meetsCostTarget,
  solscanTxUrl,
  txFeeLamports,
} from "../shared/orbitx-onchain.js";
import { requireOwnerUser } from "../shared/owner-identity.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Wallet",
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function rpcUrl() {
  return (
    process.env.SOLANA_RPC_URL ||
    process.env.HELIUS_RPC_URL ||
    (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : "") ||
    process.env.VITE_SOLANA_RPC ||
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

function bodyOf(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return {}; }
  }
  return req.body && typeof req.body === "object" ? req.body : {};
}

function signerOf(tx) {
  const keys = tx?.transaction?.message?.accountKeys || [];
  const first = keys[0];
  return typeof first === "string" ? first : first?.pubkey || null;
}

async function loadTx(signature) {
  return rpc("getTransaction", [
    signature,
    { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
  ]);
}

function proofFromTx(signature, tx) {
  if (!tx) return { ok: false, error: "Signature not found on-chain." };
  if (tx.meta?.err) return { ok: false, error: "On-chain transaction failed." };
  const memos = extractMemosFromTx(tx);
  const fee = txFeeLamports(tx);
  return {
    ok: true,
    signature,
    explorer: solscanTxUrl(signature),
    wallet: signerOf(tx),
    slot: tx.slot || null,
    block_time: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
    fee_lamports: fee,
    fee_sol: fee != null ? fee / 1e9 : null,
    meets_cost_target: fee != null ? meetsCostTarget(fee) : null,
    cost_note: costNote(fee),
    memos,
    kind: memos[0]?.kind || null,
    content_hash: memos[0]?.hash || null,
  };
}

async function upsertEvent(sb, proof, extra = {}) {
  if (!sb || !proof.ok || !proof.signature) return null;
  const memo = proof.memos?.[0];
  const kind = extra.kind || memo?.kind;
  const content_hash = extra.content_hash || memo?.hash;
  if (!kind || !content_hash) throw new Error("Indexed row needs a kind and content hash from the chain or caller.");
  const row = {
    tx_signature: proof.signature,
    wallet: proof.wallet,
    kind,
    content_hash,
    memo: memo?.raw || extra.memo || "",
    fee_lamports: proof.fee_lamports,
    slot: proof.slot,
    block_time: proof.block_time,
    ref_id: extra.ref_id || null,
    verified: true,
    meets_cost_target: proof.meets_cost_target,
    metadata: {
      source: extra.source || (memo ? "memo-v1" : "indexed-tx"),
      ...(extra.metadata && typeof extra.metadata === "object" ? extra.metadata : {}),
    },
  };
  const { data, error } = await sb.from("ox_onchain_events").upsert(row, { onConflict: "tx_signature" }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

async function handleVerify(req, res) {
  const q = req.query || {};
  const body = bodyOf(req);
  const signature = String(q.signature || body.signature || "").trim();
  if (!isLikelySignature(signature)) return json(res, 400, { ok: false, error: "Valid transaction signature required." });
  const tx = await loadTx(signature);
  const proof = proofFromTx(signature, tx);
  if (!proof.ok) return json(res, 404, proof);
  return json(res, 200, proof);
}

async function handleIndex(req, res, sb) {
  const body = bodyOf(req);
  const signature = String(body.signature || "").trim();
  if (!isLikelySignature(signature)) return json(res, 400, { ok: false, error: "Valid transaction signature required." });
  const tx = await loadTx(signature);
  const proof = proofFromTx(signature, tx);
  if (!proof.ok) return json(res, 400, proof);
  if (body.expect_hash && proof.content_hash && body.expect_hash !== proof.content_hash) {
    return json(res, 400, { ok: false, error: "On-chain hash does not match the provided content." });
  }
  if (body.kind && isAttestKind(body.kind) && proof.kind && proof.kind !== body.kind) {
    return json(res, 400, { ok: false, error: `On-chain kind is ${proof.kind}, not ${body.kind}.` });
  }
  const kind = proof.kind || (isAttestKind(body.kind) ? body.kind : "");
  if (!kind) {
    return json(res, 400, {
      ok: false,
      error: "No OrbitX ox1 memo and no valid kind. Pass kind (launch/burn/claim/…) to index a confirmed economic tx, or attach an ox1 memo.",
      verified: true,
      signature: proof.signature,
      explorer: proof.explorer,
      fee_lamports: proof.fee_lamports,
    });
  }
  const hashFromBody = typeof body.expect_hash === "string" && /^[0-9a-f]{64}$/i.test(body.expect_hash)
    ? body.expect_hash.toLowerCase()
    : "";
  const content_hash = proof.content_hash
    || hashFromBody
    || await contentHash({ signature, kind, ref_id: body.ref_id || null });
  let indexed = null;
  try {
    indexed = await upsertEvent(sb, proof, {
      kind,
      content_hash,
      ref_id: body.ref_id,
      source: proof.kind ? "memo-v1" : "indexed-tx",
      metadata: { indexed_via: "api" },
    });
  } catch (e) {
    return json(res, 503, { ok: false, error: e instanceof Error ? e.message : "Index write failed. Apply ox_onchain_events migration." });
  }
  return json(res, 200, { ...proof, indexed });
}

async function handleRebuild(req, res, sb) {
  const wallet = String(req.query?.wallet || bodyOf(req).wallet || "").trim();
  if (wallet.length < 32) return json(res, 400, { ok: false, error: "Wallet required." });
  const sigs = await rpc("getSignaturesForAddress", [wallet, { limit: 40 }]);
  const found = [];
  const skipped = [];
  for (const row of sigs || []) {
    const signature = row.signature;
    try {
      const tx = await loadTx(signature);
      const proof = proofFromTx(signature, tx);
      if (!proof.ok || !proof.memos?.length) {
        skipped.push({ signature, reason: proof.error || "no_orbitx_memo" });
        continue;
      }
      await upsertEvent(sb, proof, { metadata: { source: "rebuild" } });
      found.push({ signature, kind: proof.kind, explorer: proof.explorer, fee_lamports: proof.fee_lamports });
    } catch (e) {
      skipped.push({ signature, reason: e instanceof Error ? e.message : "rpc" });
    }
  }
  return json(res, 200, {
    ok: true,
    wallet,
    scanned: (sigs || []).length,
    rebuilt: found.length,
    events: found,
    skipped_count: skipped.length,
    note: "Index rebuilt from on-chain memos. Signatures without an ox1| memo are skipped — they are not invented.",
  });
}

async function handleEvents(req, res, sb) {
  const wallet = String(req.query?.wallet || "").trim();
  let q = sb.from("ox_onchain_events").select("*").order("created_at", { ascending: false }).limit(50);
  if (wallet) q = q.eq("wallet", wallet);
  const { data, error } = await q;
  if (error) return json(res, 503, { ok: false, error: error.message });
  return json(res, 200, { ok: true, events: data || [] });
}

async function handleCosts(req, res, sb) {
  const { data: events, error } = await sb
    .from("ox_onchain_events")
    .select("kind, fee_lamports, meets_cost_target, created_at, tx_signature")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return json(res, 503, { ok: false, error: error.message });
  const rows = (events || []).filter((e) => e.fee_lamports != null);
  const fees = rows.map((e) => Number(e.fee_lamports)).sort((a, b) => a - b);
  const sum = fees.reduce((s, n) => s + n, 0);
  const byKind = {};
  for (const e of rows) {
    const k = e.kind || "unknown";
    if (!byKind[k]) byKind[k] = { count: 0, lamports: 0, min: Infinity, max: 0 };
    byKind[k].count += 1;
    byKind[k].lamports += Number(e.fee_lamports);
    byKind[k].min = Math.min(byKind[k].min, Number(e.fee_lamports));
    byKind[k].max = Math.max(byKind[k].max, Number(e.fee_lamports));
  }
  const median = fees.length ? fees[Math.floor(fees.length / 2)] : null;
  return json(res, 200, {
    ok: true,
    sample: rows.length,
    average_lamports: fees.length ? Math.round(sum / fees.length) : null,
    median_lamports: median,
    lowest_lamports: fees[0] ?? null,
    highest_lamports: fees[fees.length - 1] ?? null,
    under_target: rows.filter((e) => e.meets_cost_target).length,
    by_kind: byKind,
    note: "Fees come from confirmed Solana meta.fee. Jupiter swaps and new-account txs will sit above 0.00001 SOL — that is real, not a padded display.",
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    return res.end();
  }
  const sb = admin();
  const action = String(req.query?.action || bodyOf(req).action || "verify").trim();
  try {
    if (action === "verify") return await handleVerify(req, res);
    if (!sb) return json(res, 503, { ok: false, error: "Supabase is not configured." });
    const owner = await requireOwnerUser(req);
    if (!owner) return json(res, 403, { ok: false, error: "denied" });
    if (action === "index") return await handleIndex(req, res, sb);
    if (action === "rebuild") return await handleRebuild(req, res, sb);
    if (action === "events") return await handleEvents(req, res, sb);
    if (action === "costs") return await handleCosts(req, res, sb);
    return json(res, 400, { ok: false, error: `Unknown action: ${action}` });
  } catch (e) {
    return json(res, 500, { ok: false, error: e instanceof Error ? e.message : "On-chain API failed." });
  }
}
