import { Keypair } from "@solana/web3.js";

function generateVanityMint(suffix = "obx", maxIterations = 1000000) {
  let attempts = 0;
  const startTime = Date.now();

  for (let i = 0; i < maxIterations; i++) {
    const keypair = Keypair.generate();
    const pubkey = keypair.publicKey.toBase58();
    attempts++;

    if (pubkey.endsWith(suffix)) {
      const timeMs = Date.now() - startTime;
      console.log(`✓ Found vanity address ending in "${suffix}": ${pubkey}`);
      console.log(`  Attempts: ${attempts}`);
      console.log(`  Time: ${timeMs}ms`);
      return { pubkey, attempts, timeMs };
    }
  }

  throw new Error(`Could not generate vanity address ending in "${suffix}" after ${maxIterations} attempts`);
}

// Test it
try {
  generateVanityMint("obx", 1000000);
} catch (e) {
  console.error(`Error: ${e.message}`);
}
