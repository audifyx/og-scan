/**
 * Single source of truth for Agent MCP ORBITX hold exemptions.
 * Imported by server (web/api/orbitx/token-hold.js) and client (agentTokenGate / ownerDesk).
 *
 * IMPORTANT: Supabase Auth lowercases emails. SIWS sessions store
 * `{pubkey}@wallet.orbitx.app` in lowercase, which mangles base58 casing.
 * All wallet comparisons against this allowlist MUST be case-insensitive,
 * then canonicalize back to the spelling in this list before persistence.
 */

/** Canonical owner / platform wallets — always skip ORBITX hold. */
export const TOKEN_GATE_EXEMPT_WALLETS_BASE = [
  "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd", // DEF / owner
  "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE", // PLATFORM_WALLET
  "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb", // ROUTED_FEE_WALLET (owner — starts with j)
];

/** Owner emails that skip the hold (matches owner desk). */
export const TOKEN_GATE_EXEMPT_EMAILS_BASE = ["audifyx@gmail.com"];

const SIWS_EMAIL_RE = /^([1-9A-HJ-NP-Za-km-z]{32,44})@wallet\.orbitx\.app$/i;

function bareWallet(wallet) {
  const addr = String(wallet || "").trim();
  if (!addr) return "";
  return addr.includes("@") ? addr.split("@")[0] : addr;
}

/** Map mangled/lowercased pubkey → canonical allowlist spelling. */
export function canonicalizeExemptWallet(wallet, extras = []) {
  const bare = bareWallet(wallet);
  if (!bare) return null;
  const pool = [...TOKEN_GATE_EXEMPT_WALLETS_BASE, ...extras];
  const hit = pool.find((w) => w === bare || w.toLowerCase() === bare.toLowerCase());
  return hit || null;
}

export function isExemptWalletInList(wallet, list) {
  const bare = bareWallet(wallet);
  if (!bare) return false;
  const addr = String(wallet || "").trim();
  return list.some(
    (w) => w === bare || w === addr || w.toLowerCase() === bare.toLowerCase() || w.toLowerCase() === addr.toLowerCase(),
  );
}

export function isExemptEmailInList(email, emailList, walletList) {
  const raw = String(email || "").trim();
  if (!raw) return false;
  const e = raw.toLowerCase();
  if (emailList.some((x) => String(x).toLowerCase() === e)) return true;
  // SIWS — email may be fully lowercased by Supabase; match allowlist case-insensitively.
  const m = raw.match(SIWS_EMAIL_RE);
  return Boolean(m && isExemptWalletInList(m[1], walletList));
}

/** Extract wallet from SIWS email, preferring canonical exempt spelling. */
export function walletFromSiwsEmail(email, extras = []) {
  const raw = String(email || "").trim();
  const m = raw.match(SIWS_EMAIL_RE);
  if (!m) return null;
  return canonicalizeExemptWallet(m[1], extras) || m[1];
}
