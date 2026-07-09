/**
 * Vanity mint SOURCE resolver.
 *
 * Strategy (in order):
 *   1. If a pre-ground pool exists for the configured suffix, atomically claim
 *      one keypair from it (required for long suffixes like "orbit" that can't
 *      be ground live).
 *   2. Otherwise grind live within the serverless time budget (fine for short
 *      suffixes like "orb").
 *
 * Config via env:
 *   VANITY_SUFFIX            default "orb"
 *   VANITY_CASE_INSENSITIVE  default "true"
 *   VANITY_LIVE_BUDGET_MS    default 8000
 *   VANITY_USE_POOL          "true" to try the pool first (default "false")
 */

import { Keypair } from "@solana/web3.js";
import {
  grindVanityMint,
  keypairFromJson,
  estimateAvgAttempts,
  invalidSuffixChars,
} from "./vanity";

export interface VanityConfig {
  suffix: string;
  caseInsensitive: boolean;
  liveBudgetMs: number;
  usePool: boolean;
}

export function loadVanityConfig(): VanityConfig {
  return {
    suffix: (process.env.VANITY_SUFFIX || "orb").trim(),
    caseInsensitive: (process.env.VANITY_CASE_INSENSITIVE || "true") !== "false",
    liveBudgetMs: Number(process.env.VANITY_LIVE_BUDGET_MS || 8000),
    usePool: (process.env.VANITY_USE_POOL || "false") === "true",
  };
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

/**
 * Atomically claim one unused keypair from the pool for this suffix via the
 * `claim_vanity_mint` RPC (uses FOR UPDATE SKIP LOCKED, so concurrent launches
 * never hand out the same key). Returns null if the pool is empty or unconfigured.
 */
async function claimFromPool(suffix: string): Promise<Keypair | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_vanity_mint`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify({ p_suffix: suffix }),
  });
  if (!res.ok) {
    console.error("claim_vanity_mint failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  const secret = Array.isArray(data) ? data[0]?.secret_key : data?.secret_key;
  if (!secret) return null; // pool empty
  return keypairFromJson(typeof secret === "string" ? secret : JSON.stringify(secret));
}

export interface ResolvedMint {
  keypair: Keypair;
  address: string;
  source: "pool" | "live";
}

/**
 * Resolve a vanity mint keypair for the current launch.
 * Throws a clear, user-facing error when neither source can produce one.
 */
export async function resolveVanityMint(cfg: VanityConfig): Promise<ResolvedMint> {
  const bad = invalidSuffixChars(cfg.suffix, cfg.caseInsensitive);
  if (bad.length > 0) {
    throw new Error(
      `Configured VANITY_SUFFIX "${cfg.suffix}" can't exist in a base58 address (bad chars: ${bad.join(", ")}). base58 excludes 0, O, I, l.`,
    );
  }

  if (cfg.usePool) {
    const claimed = await claimFromPool(cfg.suffix);
    if (claimed) {
      return { keypair: claimed, address: claimed.publicKey.toBase58(), source: "pool" };
    }
    // Pool empty: only safe to fall back to live grind if the suffix is cheap.
    const avg = estimateAvgAttempts(cfg.suffix, cfg.caseInsensitive);
    if (avg > 2_000_000) {
      throw new Error(
        `Vanity pool for "...${cfg.suffix}" is empty and this suffix is too expensive to grind live (~${avg.toLocaleString()} keys avg). Run the offline grinder to refill the pool.`,
      );
    }
  }

  const ground = grindVanityMint({
    suffix: cfg.suffix,
    caseInsensitive: cfg.caseInsensitive,
    timeBudgetMs: cfg.liveBudgetMs,
  });
  if (!ground) {
    const avg = estimateAvgAttempts(cfg.suffix, cfg.caseInsensitive);
    throw new Error(
      `Couldn't find a "...${cfg.suffix}" address within ${cfg.liveBudgetMs}ms (needs ~${avg.toLocaleString()} keys avg). Increase VANITY_LIVE_BUDGET_MS, raise the function timeout, or use a pre-ground pool.`,
    );
  }
  return { keypair: ground.keypair, address: ground.address, source: "live" };
}
