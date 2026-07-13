import { Keypair } from "@solana/web3.js";

/**
 * OrbitX Launchpad vanity mint.
 *
 * Every coin launched through the Launchpad gets a custom contract address
 * (CA) ending in the brand suffix "orb". Generation is done server-side by
 * /api/vanity-mint (brute-forcing base58 suffixes is CPU heavy and would
 * freeze the browser), which returns the mint keypair. We reconstruct the
 * Keypair from the raw secret-key bytes so the dex app needs no extra base58
 * dependency.
 */
export const VANITY_SUFFIX = "orb";

export interface VanityMint {
  keypair: Keypair;
  address: string;
  attempts: number;
  timeMs: number;
}

/**
 * Ask the server for a fresh mint keypair whose address ends in `suffix`.
 * Retries a couple of times because generation is probabilistic and can
 * occasionally hit the serverless time budget.
 */
export async function generateVanityMint(
  suffix: string = VANITY_SUFFIX,
  tries = 3,
): Promise<VanityMint> {
  let lastErr = "";
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch("/api/vanity-mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suffix }),
      });
      const data = await r.json();
      if (!r.ok || !data?.secretKeyArray) {
        lastErr = data?.error || `vanity-mint failed (${r.status})`;
        continue;
      }
      const keypair = Keypair.fromSecretKey(Uint8Array.from(data.secretKeyArray));
      return {
        keypair,
        address: keypair.publicKey.toBase58(),
        attempts: data.attempts ?? 0,
        timeMs: data.timeMs ?? 0,
      };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "Could not generate a vanity mint address");
}

/** True when `address` ends with the vanity suffix (case-insensitive). */
export function isVanityAddress(address: string, suffix: string = VANITY_SUFFIX): boolean {
  return address.toLowerCase().endsWith(suffix.toLowerCase());
}
