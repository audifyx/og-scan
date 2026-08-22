/**
 * OrbitX on-chain attestation codec.
 *
 * Uses the Solana Memo program (already used by desk-shop burns).
 * Stores a content hash — never raw posts, images, or secrets.
 *
 * Memo body (UTF-8, typically < 80 bytes):
 *   ox1|<kind>|<sha256-hex>
 *
 * A memo-only tx from an existing wallet is usually 5_000 lamports
 * (0.000005 SOL) — under the 0.00001 SOL target. Creating a new PDA
 * does NOT meet that target (rent ~0.002 SOL) and is avoided here.
 */

export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const ATTEST_PREFIX = "ox1";
export const TARGET_LAMPORTS = 10_000; // 0.00001 SOL
export const TYPICAL_MEMO_LAMPORTS = 5_000; // one signature, no new accounts

export const ATTEST_KINDS = [
  "launch",
  "burn",
  "claim",
  "bagwork",
  "post",
  "vote",
  "referral",
  "reward",
  "campaign",
  "game",
  "swap",
];

export function isAttestKind(kind) {
  return ATTEST_KINDS.includes(String(kind || ""));
}

/** Deterministic SHA-256 hex of a canonical JSON payload (browser or Node). */
export async function contentHash(payload) {
  const canonical = canonicalize(payload);
  const bytes = new TextEncoder().encode(canonical);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return hex(new Uint8Array(buf));
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(canonical).digest("hex");
}

export function canonicalize(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function hex(u8) {
  return Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function encodeMemo({ kind, hash }) {
  const k = String(kind || "").toLowerCase();
  const h = String(hash || "").toLowerCase().replace(/[^0-9a-f]/g, "");
  if (!isAttestKind(k)) throw new Error("Unknown attestation kind.");
  if (h.length !== 64) throw new Error("Hash must be SHA-256 hex (64 chars).");
  return `${ATTEST_PREFIX}|${k}|${h}`;
}

export function parseMemo(raw) {
  const text = String(raw || "").trim();
  const parts = text.split("|");
  if (parts.length < 3 || parts[0] !== ATTEST_PREFIX) return null;
  const kind = parts[1];
  const hash = parts[2].toLowerCase();
  if (!isAttestKind(kind) || !/^[0-9a-f]{64}$/.test(hash)) return null;
  return { kind, hash, raw: text };
}

export function extractMemosFromTx(tx) {
  const out = [];
  if (!tx?.transaction) return out;
  const msg = tx.transaction.message;
  const keys = (msg?.accountKeys || []).map((k) => (typeof k === "string" ? k : k.pubkey || k));
  const ixs = msg?.instructions || [];
  for (const ix of ixs) {
    const pid = typeof ix.programId === "string"
      ? ix.programId
      : keys[ix.programIdIndex] || ix.programId?.toString?.();
    if (pid !== MEMO_PROGRAM_ID) continue;
    const data = decodeIxData(ix.data);
    const parsed = parseMemo(data);
    if (parsed) out.push(parsed);
  }
  const inner = tx.meta?.innerInstructions || [];
  for (const group of inner) {
    for (const ix of group.instructions || []) {
      const pid = typeof ix.programId === "string"
        ? ix.programId
        : keys[ix.programIdIndex];
      if (pid !== MEMO_PROGRAM_ID) continue;
      const parsed = parseMemo(decodeIxData(ix.data));
      if (parsed) out.push(parsed);
    }
  }
  return out;
}

function bytesToUtf8(bytes) {
  if (typeof TextDecoder !== "undefined") return new TextDecoder().decode(bytes);
  return String.fromCharCode(...bytes);
}

function decodeIxData(data) {
  if (!data) return "";
  if (typeof data === "string") {
    try {
      if (typeof Buffer !== "undefined") return Buffer.from(data, "base64").toString("utf8");
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytesToUtf8(bytes);
    } catch {
      return data;
    }
  }
  if (Array.isArray(data)) return bytesToUtf8(Uint8Array.from(data));
  return String(data);
}

export function txFeeLamports(tx) {
  const fee = Number(tx?.meta?.fee);
  return Number.isFinite(fee) && fee >= 0 ? fee : null;
}

export function meetsCostTarget(lamports) {
  return Number(lamports) > 0 && Number(lamports) < TARGET_LAMPORTS;
}

export function costNote(lamports) {
  const sol = Number(lamports || 0) / 1e9;
  if (!lamports && lamports !== 0) {
    return "Fee unknown until the transaction is confirmed on-chain.";
  }
  if (meetsCostTarget(lamports)) {
    return `${sol.toFixed(9)} SOL — under the 0.00001 SOL target.`;
  }
  return `${sol.toFixed(9)} SOL — above 0.00001 SOL (typical for swaps, new accounts, or priority fees). Not padded.`;
}

export function solscanTxUrl(signature, cluster = "mainnet-beta") {
  const sig = String(signature || "").trim();
  if (!sig) return null;
  const q = cluster && cluster !== "mainnet-beta" ? `?cluster=${encodeURIComponent(cluster)}` : "";
  return `https://solscan.io/tx/${sig}${q}`;
}

export function solscanTokenUrl(mint, cluster = "mainnet-beta") {
  const m = String(mint || "").trim();
  if (!m) return null;
  const q = cluster && cluster !== "mainnet-beta" ? `?cluster=${encodeURIComponent(cluster)}` : "";
  return `https://solscan.io/token/${m}${q}`;
}

export function isLikelySignature(sig) {
  const s = String(sig || "").trim();
  return s.length >= 32 && s.length <= 128 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}
