/**
 * OrbitX Anti-Vamp scoring — shared by the API checker and unit tests.
 * Hard-blocks only real identity collisions; soft-flags lookalikes for fee routing.
 */

export const HARD_MATCH_SIM = 0.92;
export const SOFT_MATCH_SIM = 0.72;

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

/**
 * Returns a 0..1 similarity used for soft flags, plus whether it is a hard collision.
 * Hard = exact name, exact ticker (≥2 chars), or very high bigram with similar lengths.
 */
export function scoreIdentity(
  candidateName: string,
  candidateTicker: string,
  name: string,
  ticker: string,
): { sim: number; hard: boolean } {
  const nName = normalizeIdentity(name);
  const nTicker = normalizeIdentity(ticker);
  const nCandName = normalizeIdentity(candidateName);
  const nCandTicker = normalizeIdentity(candidateTicker);

  if (!nName && !nTicker) return { sim: 0, hard: false };

  // Exact ticker collision (meaningful tickers only).
  if (nTicker.length >= 2 && nCandTicker.length >= 2 && nCandTicker === nTicker) {
    return { sim: 1, hard: true };
  }
  // Exact name collision (ignore ultra-short junk names).
  if (nName.length >= 3 && nCandName.length >= 3 && nCandName === nName) {
    return { sim: 1, hard: true };
  }

  const nameSim = bigramSimilarity(nCandName, nName);
  const tickerSim = bigramSimilarity(nCandTicker, nTicker);

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

  const sim = Math.max(nameSim, tickerSim);
  return { sim, hard: hardName || hardTicker };
}
