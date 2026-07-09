/**
 * Server-side Solana vanity mint generation.
 *
 * A "vanity" mint is a Keypair whose base58 public key ends with a chosen
 * suffix (e.g. "orb" → address ends in ...orb). Addresses are found by brute
 * force: generate a keypair, check the suffix, repeat. Cost grows ~58x per
 * extra character, so short suffixes ("orb") are grindable live inside a
 * serverless request while long ones ("orbit") must be pre-ground into a pool.
 *
 * SECURITY: secret keys generated here MUST stay server-side. They are used to
 * partial-sign the Pump create transaction and are never returned to the client.
 */

import { Keypair } from "@solana/web3.js";

/** Base58 alphabet used by Solana/Bitcoin (excludes 0 O I l). */
export const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface GrindOptions {
  suffix: string;
  caseInsensitive?: boolean;
  /** Stop grinding after this many ms (default 8000). */
  timeBudgetMs?: number;
  /** Hard cap on attempts regardless of time (default Infinity). */
  maxAttempts?: number;
}

export interface GrindResult {
  keypair: Keypair;
  address: string;
  attempts: number;
  elapsedMs: number;
}

/**
 * Validate a suffix against the base58 alphabet. Returns the list of chars
 * that can never appear in a base58 address (so the caller can fail fast
 * instead of grinding forever).
 */
export function invalidSuffixChars(suffix: string, caseInsensitive: boolean): string[] {
  const bad: string[] = [];
  for (const ch of suffix) {
    const variants = caseInsensitive
      ? Array.from(new Set([ch.toLowerCase(), ch.toUpperCase()]))
      : [ch];
    if (!variants.some((v) => BASE58_ALPHABET.includes(v))) bad.push(ch);
  }
  return bad;
}

/**
 * Estimate the average number of keypairs needed to find one match, so we can
 * decide up front whether a live grind is realistic or the pool is required.
 */
export function estimateAvgAttempts(suffix: string, caseInsensitive: boolean): number {
  let favorable = 1;
  for (const ch of suffix) {
    const variants = caseInsensitive
      ? Array.from(new Set([ch.toLowerCase(), ch.toUpperCase()]))
      : [ch];
    const count = variants.filter((v) => BASE58_ALPHABET.includes(v)).length;
    favorable *= Math.max(count, 1);
  }
  return Math.round(Math.pow(58, suffix.length) / favorable);
}

export function matchesSuffix(address: string, suffix: string, caseInsensitive: boolean): boolean {
  if (caseInsensitive) return address.toLowerCase().endsWith(suffix.toLowerCase());
  return address.endsWith(suffix);
}

/**
 * Grind a vanity mint keypair live. Time-boxed so it can never exceed the
 * serverless function budget. Returns null if not found within the budget.
 */
export function grindVanityMint(opts: GrindOptions): GrindResult | null {
  const { suffix, caseInsensitive = true, timeBudgetMs = 8000, maxAttempts = Infinity } = opts;

  const bad = invalidSuffixChars(suffix, caseInsensitive);
  if (bad.length > 0) {
    throw new Error(
      `Suffix "${suffix}" contains characters that never appear in base58 addresses: ${bad.join(", ")} (base58 excludes 0, O, I, l).`,
    );
  }

  const deadline = Date.now() + timeBudgetMs;
  let attempts = 0;

  while (Date.now() < deadline && attempts < maxAttempts) {
    // Check in batches so Date.now() isn't called on every iteration.
    for (let i = 0; i < 2000; i++) {
      const kp = Keypair.generate();
      const address = kp.publicKey.toBase58();
      attempts++;
      if (matchesSuffix(address, suffix, caseInsensitive)) {
        return { keypair: kp, address, attempts, elapsedMs: timeBudgetMs - (deadline - Date.now()) };
      }
    }
  }
  return null;
}

/** Serialize a Keypair's 64-byte secret to a JSON array string (pool storage). */
export function secretToJson(kp: Keypair): string {
  return JSON.stringify(Array.from(kp.secretKey));
}

/** Rebuild a Keypair from a JSON array secret produced by secretToJson. */
export function keypairFromJson(json: string): Keypair {
  const arr = JSON.parse(json);
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error("Invalid secret key: expected a 64-byte JSON array.");
  }
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}
