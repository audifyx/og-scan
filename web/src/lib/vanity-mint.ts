import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Generate a Solana vanity keypair whose base58 address ends with "obx"
 * Uses 3-character suffix for realistic computation time (~1-2 minutes).
 * For server-side use only (intensive computation).
 *
 * Note: "orbit" (5 chars) would require ~656M combinations - not practical.
 */
export function generateVanityMint(suffix = "obx", maxIterations = 1000000): Keypair {
  const suffixLower = suffix.toLowerCase();

  for (let i = 0; i < maxIterations; i++) {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58().toLowerCase();

    if (address.endsWith(suffixLower)) {
      console.log(`[v0] Vanity mint found after ${i + 1} attempts: ${keypair.publicKey.toBase58()}`);
      return keypair;
    }

    if ((i + 1) % 100000 === 0) {
      console.log(`[v0] Vanity search in progress: ${i + 1} attempts...`);
    }
  }

  throw new Error(`Failed to generate vanity mint ending in '${suffix}' after ${maxIterations} attempts`);
}

/**
 * Validate that an address ends with the suffix
 */
export function validateVanitySuffix(address: string, suffix = "obx"): boolean {
  return address.toLowerCase().endsWith(suffix.toLowerCase());
}
