/**
 * OrbitX Anti-Vamp scoring — shared by the API checker and unit tests.
 * Hard-blocks only real identity collisions; soft-flags lookalikes for fee routing.
 */

export const HARD_MATCH_SIM = 0.92;
export const SOFT_MATCH_SIM = 0.72;

/** OrbitX registry enforces unique name/ticker; market sources need fuller identity overlap. */
export type VampMatchContext = "registry" | "market";
export type AntiVampAssetType = "token" | "nft_collection" | "nft_item";

export interface IdentityInput {
  name: string;
  ticker?: string;
  symbol?: string;
}

export interface IdentityScore {
  sim: number;
  hard: boolean;
  reason: "exact_name" | "exact_ticker" | "near_exact_name" | "near_exact_identity" | "soft_overlap" | "none";
}

/** Static emergency denylist. Keep small and reviewable; it is intentionally source-controlled. */
export const KNOWN_VAMP_IDENTITIES: ReadonlyArray<{ name: string; ticker?: string; assetType?: AntiVampAssetType }> = [
  { name: "orbitx", ticker: "obx" },
  { name: "ogscan", ticker: "og" },
];

export function isKnownVampIdentity(input: IdentityInput, assetType: AntiVampAssetType = "token"): boolean {
  const name = normalizeIdentity(input.name);
  const ticker = normalizeIdentity(input.ticker ?? input.symbol ?? "");
  return KNOWN_VAMP_IDENTITIES.some((entry) => {
    if (entry.assetType && entry.assetType !== assetType) return false;
    return normalizeIdentity(entry.name) === name || (!!ticker && normalizeIdentity(entry.ticker ?? "") === ticker);
  });
}

export function identityField(input: IdentityInput): string {
  return input.ticker ?? input.symbol ?? "";
}

export function normalizeIdentity(raw: string): string {
  const stripped = (raw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t" };
  return stripped.replace(/[013457]/g, (c) => map[c] ?? c);
}

/** Dice coefficient over character bigrams. Short strings are conservative. */
export function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  // Single-char / 2-char tokens inflate dice — require exact match only.
  if (a.length < 3 || b.length < 3) return 0;
  const bigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.size === 0 || bb.size === 0) return 0;
  let overlap = 0;
  for (const [g, count] of ba) overlap += Math.min(count, bb.get(g) ?? 0);
  const total =
    [...ba.values()].reduce((s, n) => s + n, 0) + [...bb.values()].reduce((s, n) => s + n, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

function lengthCompatible(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  return ratio >= 0.65;
}

/** True when normalized strings share a meaningful substring (≥3 chars) or exact short ticker. */
export function sharesIdentityFragment(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return a.length >= 2;
  if (a.length < 3 || b.length < 3) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  for (let i = 0; i <= shorter.length - 3; i++) {
    if (longer.includes(shorter.slice(i, i + 3))) return true;
  }
  return false;
}

function combinedSimilarity(nameSim: number, tickerSim: number): number {
  if (nameSim > 0 && tickerSim > 0) return 0.55 * nameSim + 0.45 * tickerSim;
  return Math.max(nameSim, tickerSim) * 0.75;
}

/**
 * Returns a 0..1 similarity used for soft flags, plus whether it is a hard collision.
 * Registry: exact normalized name/ticker always hard-blocks (platform uniqueness).
 * Market (pump.fun / DexScreener): ticker-only collisions are not enough — require name overlap too.
 */
export function scoreIdentity(
  candidateName: string,
  candidateTicker: string,
  name: string,
  ticker: string,
  context: VampMatchContext = "market",
): IdentityScore {
  const nName = normalizeIdentity(name);
  const nTicker = normalizeIdentity(ticker);
  const nCandName = normalizeIdentity(candidateName);
  const nCandTicker = normalizeIdentity(candidateTicker);

  if (!nName && !nTicker) return { sim: 0, hard: false, reason: "none" };

  const exactTicker = nTicker.length >= 2 && nCandTicker.length >= 2 && nCandTicker === nTicker;
  const exactName = nName.length >= 3 && nCandName.length >= 3 && nCandName === nName;

  if (context === "registry") {
    if (exactTicker || exactName) return { sim: 1, hard: true, reason: exactName ? "exact_name" : "exact_ticker" };
  } else {
    if (exactName) return { sim: 1, hard: true, reason: "exact_name" };
    if (exactTicker) {
      const nameSim = bigramSimilarity(nCandName, nName);
      const nameOverlap =
        nameSim >= SOFT_MATCH_SIM ||
        sharesIdentityFragment(nName, nCandName);
      if (!nameOverlap) {
        // Common ticker reuse (e.g. MOON, PEPE) with unrelated name — ignore.
        return { sim: 0, hard: false, reason: "none" };
      }
      return { sim: Math.max(nameSim, 0.88), hard: nameSim >= HARD_MATCH_SIM, reason: nameSim >= HARD_MATCH_SIM ? "near_exact_name" : "soft_overlap" };
    }
  }

  const nameSim = bigramSimilarity(nCandName, nName);
  const tickerSim = bigramSimilarity(nCandTicker, nTicker);
  const sim = combinedSimilarity(nameSim, tickerSim);

  const hardName =
    nameSim >= HARD_MATCH_SIM &&
    nName.length >= 6 &&
    nCandName.length >= 6 &&
    lengthCompatible(nName, nCandName);

  const hardTicker =
    tickerSim >= HARD_MATCH_SIM &&
    nTicker.length >= 4 &&
    nCandTicker.length >= 4 &&
    lengthCompatible(nTicker, nCandTicker);

  const hardBoth =
    nameSim >= SOFT_MATCH_SIM &&
    tickerSim >= SOFT_MATCH_SIM &&
    sim >= HARD_MATCH_SIM;

  return { sim, hard: hardName || hardTicker || hardBoth, reason: hardName ? "near_exact_name" : hardTicker ? "near_exact_identity" : hardBoth ? "near_exact_identity" : sim >= SOFT_MATCH_SIM ? "soft_overlap" : "none" };
}

/** Pre-filter market search hits before scoring — drops unrelated pump/dex noise. */
export function isRelevantMarketCandidate(
  candidateName: string,
  candidateTicker: string,
  name: string,
  ticker: string,
): boolean {
  const nName = normalizeIdentity(name);
  const nTicker = normalizeIdentity(ticker);
  const nCandName = normalizeIdentity(candidateName);
  const nCandTicker = normalizeIdentity(candidateTicker);
  if (!nName && !nTicker) return false;
  if (nName && sharesIdentityFragment(nName, nCandName)) return true;
  if (nTicker && nTicker.length >= 2 && (nTicker === nCandTicker || sharesIdentityFragment(nTicker, nCandTicker))) {
    return true;
  }
  return false;
}
