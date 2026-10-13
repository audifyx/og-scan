// Shared wallet transaction scan — the "fully scanning wallets" layer.
//
// Everything here uses ONLY non-indexed JSON-RPC methods (getBalance,
// getSignaturesForAddress, getTransaction, getMultipleAccounts / getAccountInfo)
// so it works on public RPCs when the Helius proxy rejects indexed calls.
// Indexed getTokenAccountsByOwner is never used: the rpc-proxy rejects it
// ("Method not allowed") and public RPCs block it.
//
// Two building blocks:
//  - scanWalletTxs: paginated signature + parsed-tx scan (swaps, transfers,
//    fees, failed) with explicit completeness — callers must never report
//    "0 swaps" without saying how much history was actually scanned.
//  - ataHoldings: current SPL holdings derived from ATAs (Token + Token-2022)
//    via getMultipleAccounts — no indexed enumeration needed.
import { resilientRpc, resilientRpcDetailed } from "./_lib.js";
import { parseTx } from "./_swap.js";

export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const SOL_MINT = "So11111111111111111111111111111111111111112";

export const lamportsToSol = (lamports) => Number(lamports || 0) / 1e9;
export const rawToUi = (raw, decimals) => Number(raw || 0) / 10 ** Number(decimals || 0);

/** SPL token-account layout (Token + Token-2022 base): mint 0..32, owner 32..64, amount u64LE 64..72. */
export function parseTokenAccountData(data) {
  if (!data) return null;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length < 72) return null;
  return {
    mintBytes: Uint8Array.from(buf.subarray(0, 32)),
    ownerBytes: Uint8Array.from(buf.subarray(32, 64)),
    amount: buf.readBigUInt64LE(64),
  };
}

/** Mint-account layout: decimals u8 at byte 44 (same base for Token + Token-2022). */
export function parseMintDecimals(data) {
  if (!data) return null;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buf.length < 45) return null;
  return buf[44];
}

const eqBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        try { out[i] = await fn(items[i], i); } catch { out[i] = null; }
      }
    }),
  );
  return out;
}

async function rpcTx(signature) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const t = await resilientRpc("getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      if (t) return t;
    } catch { /* retry */ }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

/**
 * Paginated tx scan. `limit` = max txs to return (cap 500); `before` = signature
 * cursor for the next page. Returns parsed txs + aggregates + completeness:
 * - complete: true only when a short page proved there is no more history.
 * - hasMore / nextBefore: pagination cursor (null when complete).
 * - failedFetches: signatures whose getTransaction returned null (counted, not hidden).
 */
export async function scanWalletTxs(address, { limit = 100, before = null } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const retrievedAt = new Date().toISOString();
  const signatures = [];
  let cursor = before || null;
  let complete = false;
  let source = null;
  // Paginate in 100-sig pages until the cap or a short page.
  while (signatures.length < cap) {
    const pageSize = Math.min(100, cap - signatures.length);
    const params = [{ limit: pageSize }];
    if (cursor) params[0].before = cursor;
    const { result, source: src } = await resilientRpcDetailed(
      "getSignaturesForAddress",
      [address, ...params],
    );
    if (src) source = src;
    const page = Array.isArray(result) ? result : null;
    if (page === null) break; // RPC failed — report partial, not empty.
    for (const s of page) signatures.push(s.signature);
    if (page.length < pageSize) { complete = true; break; }
    cursor = page[page.length - 1]?.signature || null;
    if (!cursor) { complete = true; break; }
  }
  const hasMore = !complete;
  const nextBefore = hasMore ? signatures[signatures.length - 1] || null : null;

  const rawTxs = await mapPool(signatures, 8, (sig) => rpcTx(sig));
  const failedFetches = rawTxs.filter((t) => t == null).length;
  const txs = rawTxs.filter(Boolean).map((t) => parseTx(t, address));

  const tokenDeltas = {};
  const touchedMints = new Set();
  const decimalsByMint = {};
  for (const raw of rawTxs.filter(Boolean)) {
    for (const b of [...(raw?.meta?.preTokenBalances || []), ...(raw?.meta?.postTokenBalances || [])]) {
      if (b.owner !== address) continue;
      touchedMints.add(b.mint);
      if (b.uiTokenAmount?.decimals != null) decimalsByMint[b.mint] = Number(b.uiTokenAmount.decimals);
    }
  }
  for (const t of txs) {
    for (const [m, d] of Object.entries(t.tokenDeltas || {})) {
      tokenDeltas[m] = (tokenDeltas[m] || 0) + d;
    }
  }

  return {
    txs,
    signatures,
    scanned: signatures.length,
    fetched: txs.length,
    failedFetches,
    complete,
    hasMore,
    nextBefore,
    tokenDeltas,
    touchedMints: [...touchedMints],
    decimalsByMint,
    swaps: txs.filter((t) => t.kind === "swap"),
    transfers: txs.filter((t) => t.kind === "transfer"),
    failed: txs.filter((t) => t.kind === "failed"),
    source,
    retrievedAt,
  };
}

let _solana = null;
async function loadSolana() {
  if (!_solana) {
    const [web3, spl] = await Promise.all([import("@solana/web3.js"), import("@solana/spl-token")]);
    _solana = { web3, spl };
  }
  return _solana;
}

/**
 * Current holdings via ATA derivation (no indexed enumeration).
 * For each touched mint, derives the ATA under Token + Token-2022 and reads
 * it with getMultipleAccounts. Returns holdings with amount > 0.
 * decimalsByMint (from tx history) wins; otherwise parsed from the mint account.
 */
export async function ataHoldings(address, mints, { decimalsByMint = {} } = {}) {
  const out = [];
  if (!mints?.length) return out;
  const { web3, spl } = await loadSolana();
  const { PublicKey } = web3;
  const { getAssociatedTokenAddressSync } = spl;
  const owner = new PublicKey(address);
  const ownerBytes = owner.toBytes();

  const queries = []; // { mint, programId, ata }
  for (const mint of [...new Set(mints)]) {
    const mintPk = new PublicKey(mint);
    for (const programId of [TOKEN_PROGRAM, TOKEN_2022]) {
      // One bad derivation (e.g. a PDA edge case) must not kill the whole scan.
      try {
        const ata = getAssociatedTokenAddressSync(mintPk, owner, true, new PublicKey(programId));
        queries.push({ mint, programId, ata });
      } catch { /* skip this program for this mint */ }
    }
  }
  // Batch in 100-account chunks (getMultipleAccounts limit).
  const accountByKey = new Map();
  for (let i = 0; i < queries.length; i += 100) {
    const chunk = queries.slice(i, i + 100);
    const res = await resilientRpc("getMultipleAccounts", [
      chunk.map((q) => q.ata.toBase58()),
      { encoding: "base64" },
    ]);
    const values = res?.value || [];
    chunk.forEach((q, j) => {
      const v = values[j];
      if (v?.data?.[0]) accountByKey.set(q.ata.toBase58(), Buffer.from(v.data[0], "base64"));
    });
  }
  // Decimals for mints not covered by tx history: read mint accounts.
  const needDecimals = [...new Set(queries.map((q) => q.mint))].filter((m) => decimalsByMint[m] == null);
  const decimals = { ...decimalsByMint };
  if (needDecimals.length) {
    const res = await resilientRpc("getMultipleAccounts", [
      needDecimals,
      { encoding: "base64" },
    ]);
    (res?.value || []).forEach((v, j) => {
      if (v?.data?.[0]) {
        const d = parseMintDecimals(Buffer.from(v.data[0], "base64"));
        if (d != null) decimals[needDecimals[j]] = d;
      }
    });
  }

  for (const q of queries) {
    const data = accountByKey.get(q.ata.toBase58());
    if (!data) continue;
    const parsed = parseTokenAccountData(data);
    if (!parsed || parsed.amount <= 0n) continue;
    const mintPk = new PublicKey(q.mint);
    if (!eqBytes(parsed.mintBytes, mintPk.toBytes())) continue;
    if (!eqBytes(parsed.ownerBytes, ownerBytes)) continue;
    const dec = decimals[q.mint] ?? 0;
    out.push({
      mint: q.mint,
      programId: q.programId,
      tokenAccount: q.ata.toBase58(),
      raw: parsed.amount.toString(),
      decimals: dec,
      uiAmount: rawToUi(parsed.amount.toString(), dec),
    });
  }
  // Merge duplicate mints across programs (rare: same mint in both programs).
  const byMint = {};
  for (const h of out) {
    byMint[h.mint] = byMint[h.mint] || { ...h };
    if (byMint[h.mint] !== h) {
      byMint[h.mint].raw = (BigInt(byMint[h.mint].raw) + BigInt(h.raw)).toString();
      byMint[h.mint].uiAmount += h.uiAmount;
    }
  }
  return Object.values(byMint);
}
