import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";

// IMPORTANT: this endpoint intentionally does NOT import @solana/web3.js.
// That pulls in rpc-websockets (for its Connection/RPC subscription code,
// which this function never uses — it only ever generates keypairs), and a
// recent rpc-websockets version requires the ESM-only `uuid` package via
// require(), which crashes the whole function on cold start with
// ERR_REQUIRE_ESM. @noble/curves/ed25519 generates keypairs in the exact
// same format (32-byte seed + 32-byte pubkey = Solana's 64-byte secretKey),
// fully compatible with Keypair.fromSecretKey() on the client, with zero
// risk of dragging in unrelated networking deps.

// Brute-forcing a 3-char base58 suffix needs ~100k+ keypair generations,
// which reliably blows past Vercel's default function timeout. Hobby plan
// allows up to 60s — use all of it, and bail out cleanly with a clear error
// before Vercel kills the function, instead of returning a random address.
export const config = {
  maxDuration: 60,
};

const TIME_BUDGET_MS = 55_000; // leave headroom under the 60s hard limit

interface EdKeypair { publicKey: Uint8Array; secretKey64: Uint8Array }

function generateKeypair(): EdKeypair {
  const kp = ed25519.keygen(); // { secretKey: 32-byte seed, publicKey: 32-byte pubkey }
  const secretKey64 = new Uint8Array(64);
  secretKey64.set(kp.secretKey, 0);
  secretKey64.set(kp.publicKey, 32);
  return { publicKey: kp.publicKey, secretKey64 };
}

/**
 * POST /api/vanity-mint
 *
 * Generate a Solana vanity mint keypair whose address ends with "obx" — the
 * OrbitX Launchpad brand suffix. Every coin launched through the Launchpad
 * gets a custom CA ending in "obx". Computation time: ~1s for a 3-char suffix.
 *
 * Request body:
 * {
 *   suffix?: string; // defaults to "obx" (3 chars)
 *   maxIterations?: number; // defaults to 1000000
 * }
 *
 * Response:
 * {
 *   publicKey: string;        // base58 encoded, ends with suffix
 *   secretKey: string;        // base58 encoded (serialized secret key)
 *   secretKeyArray: number[]; // raw secret key bytes (dependency-free client reconstruction)
 *   generatedAt: string;      // ISO timestamp
 *   attempts: number;         // how many attempts before finding
 *   timeMs: number;           // how long it took in milliseconds
 * }
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { suffix = "obx", maxIterations = 1000000 } = req.body || {};

    if (typeof suffix !== "string" || suffix.length === 0) {
      return res.status(400).json({ error: "Invalid suffix parameter" });
    }

    console.log(`[v0] Starting vanity mint generation for suffix: ${suffix}`);
    const startTime = Date.now();

    const suffixLower = suffix.toLowerCase();
    let keypair: EdKeypair | null = null;
    let attempts = 0;

    // Intensive search for vanity address — bounded by both attempt count
    // and a wall-clock time budget so we never let Vercel's hard timeout
    // cut us off mid-response.
    for (attempts = 0; attempts < maxIterations; attempts++) {
      const candidate = generateKeypair();
      const address = bs58.encode(candidate.publicKey).toLowerCase();

      if (address.endsWith(suffixLower)) {
        keypair = candidate;
        console.log(
          `[v0] Vanity mint found after ${attempts + 1} attempts, ${Date.now() - startTime}ms: ${bs58.encode(candidate.publicKey)}`
        );
        break;
      }

      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.error(
          `[v0] Vanity search out of time after ${attempts + 1} attempts, ${Date.now() - startTime}ms`
        );
        return res.status(504).json({
          error: `Vanity address search for '${suffix}' timed out after ${attempts + 1} attempts. Try again — it's probabilistic.`,
        });
      }

      if ((attempts + 1) % 100000 === 0) {
        console.log(
          `[v0] Vanity search in progress: ${attempts + 1}/${maxIterations} attempts (${Date.now() - startTime}ms)`
        );
      }
    }

    if (!keypair || attempts >= maxIterations) {
      console.error(
        `[v0] Failed to generate vanity mint after ${attempts} attempts in ${Date.now() - startTime}ms`
      );
      return res.status(500).json({
        error: `Failed to generate vanity mint ending in '${suffix}' after ${maxIterations} attempts`,
      });
    }

    // Return the keypair information
    // The secret key is returned to the client so they can use it for signing
    const secretKeyBytes = keypair.secretKey64;
    const secretKeyBase58 = bs58.encode(secretKeyBytes);

    return res.status(200).json({
      publicKey: bs58.encode(keypair.publicKey),
      secretKey: secretKeyBase58,
      secretKeyArray: Array.from(secretKeyBytes),
      generatedAt: new Date().toISOString(),
      attempts,
      timeMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error("[v0] Vanity mint API error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
