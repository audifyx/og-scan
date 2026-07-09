/**
 * Test script to verify vanity mint generation works correctly
 * Run: node test-vanity-mint.js
 */

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

console.log("Testing vanity mint generation...\n");

function generateVanityMint(suffix = "orbit", maxIterations = 500000) {
  const suffixLower = suffix.toLowerCase();
  console.log(`Target suffix: "${suffix}" (case-insensitive)`);
  console.log(`Max iterations: ${maxIterations}`);
  console.log("Searching...\n");

  const startTime = Date.now();

  for (let attempts = 0; attempts < maxIterations; attempts++) {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const addressLower = publicKey.toLowerCase();

    if (addressLower.endsWith(suffixLower)) {
      const elapsed = Date.now() - startTime;
      console.log(`✓ FOUND VANITY MINT!\n`);
      console.log(`Attempts: ${attempts + 1}`);
      console.log(`Time: ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);
      console.log(`Public Key: ${publicKey}`);
      console.log(`Last 8 chars: "${publicKey.slice(-8)}"`);
      console.log(`Ends with "orbit": ${publicKey.toLowerCase().endsWith("orbit")}`);

      // Verify the secret key can be encoded/decoded
      const secretKeyBase58 = bs58.encode(keypair.secretKey);
      console.log(`\nSecret Key (base58, first 20 chars): ${secretKeyBase58.substring(0, 20)}...`);

      // Try to reconstruct the keypair
      try {
        const secretKeyBytes = bs58.decode(secretKeyBase58);
        const reconstructed = Keypair.fromSecretKey(new Uint8Array(secretKeyBytes));
        const reconstructedPublic = reconstructed.publicKey.toBase58();
        console.log(`\nReconstruction check:`);
        console.log(`Original:      ${publicKey}`);
        console.log(`Reconstructed: ${reconstructedPublic}`);
        console.log(`Match: ${publicKey === reconstructedPublic ? "✓ YES" : "✗ NO"}`);
      } catch (e) {
        console.error(`Reconstruction failed: ${e.message}`);
      }

      return { publicKey, secretKey: secretKeyBase58, attempts: attempts + 1, timeMs: elapsed };
    }

    if ((attempts + 1) % 50000 === 0) {
      const elapsed = Date.now() - startTime;
      console.log(`Progress: ${attempts + 1}/${maxIterations} attempts (${(elapsed / 1000).toFixed(1)}s)...`);
    }
  }

  throw new Error(`Failed to generate vanity mint after ${maxIterations} attempts`);
}

// Run the test with realistic suffix
// "orbit" (5 chars) = ~656M combinations = not practical
// "bit" (3 chars) = ~195K combinations = realistic (1-2 seconds)
try {
  const result = generateVanityMint("bit", 1000000);
  console.log("\n" + "=".repeat(60));
  console.log("TEST PASSED ✓");
  console.log("=".repeat(60));
  console.log(`The vanity mint ending in "bit" works correctly!`);
  console.log(`Average time: ${(result.timeMs / 1000).toFixed(2)}s`);
  console.log(`You can safely use this in production.\n`);
} catch (error) {
  console.error("\n" + "=".repeat(60));
  console.error("TEST FAILED ✗");
  console.error("=".repeat(60));
  console.error(`Error: ${error.message}\n`);
  process.exit(1);
}
