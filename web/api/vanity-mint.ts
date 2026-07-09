import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * POST /api/vanity-mint
 *
 * Generate a Solana vanity mint keypair whose address ends with "bit"
 * Uses shorter suffix for realistic computation time (~0.5-2 seconds).
 *
 * Request body:
 * {
 *   suffix?: string; // defaults to "bit" (3 chars)
 *   maxIterations?: number; // defaults to 1000000
 * }
 *
 * Response:
 * {
 *   publicKey: string; // base58 encoded, ends with suffix
 *   secretKey: string; // base58 encoded (serialized secret key)
 *   generatedAt: string; // ISO timestamp
 *   attempts: number; // how many attempts before finding
 *   timeMs: number; // how long it took in milliseconds
 * }
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { suffix = "bit", maxIterations = 1000000 } = req.body || {};

    if (typeof suffix !== "string" || suffix.length === 0) {
      return res.status(400).json({ error: "Invalid suffix parameter" });
    }

    console.log(`[v0] Starting vanity mint generation for suffix: ${suffix}`);
    const startTime = Date.now();

    const suffixLower = suffix.toLowerCase();
    let keypair: Keypair | null = null;
    let attempts = 0;

    // Intensive search for vanity address
    for (attempts = 0; attempts < maxIterations; attempts++) {
      keypair = Keypair.generate();
      const address = keypair.publicKey.toBase58().toLowerCase();

      if (address.endsWith(suffixLower)) {
        console.log(
          `[v0] Vanity mint found after ${attempts + 1} attempts, ${Date.now() - startTime}ms: ${keypair.publicKey.toBase58()}`
        );
        break;
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
    const secretKeyBytes = keypair.secretKey;
    const secretKeyBase58 = bs58.encode(secretKeyBytes);

    return res.status(200).json({
      publicKey: keypair.publicKey.toBase58(),
      secretKey: secretKeyBase58,
      generatedAt: new Date().toISOString(),
      attempts,
      timeMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error("[v0] Vanity mint API error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
