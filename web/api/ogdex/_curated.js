import { jup } from "./_lib.js";
import { normToken } from "./_normalize.js";

// Curated OG / blue-chip Solana memecoins.
export const OG_MINTS = [
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", // WIF
  "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", // POPCAT
  "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", // FARTCOIN
  "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",  // MEW
  "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82",  // BOME
  "63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9", // GIGA
  "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump", // PNUT
  "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY", // MOODENG
  "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk",  // WEN
  "5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC", // BODEN(?)
  "3B5wuUrMEi5yATD7on46hKfej3pfmd7t1RKgrsN3pump", // BILLY
  "5mbK36SZ7J19An8jFochhQS4of8g6BwUjbeCSxBSoWdp", // MICHI
];

// Celebrity / political tokens.
export const CELEB_MINTS = [
  "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", // TRUMP
  "FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P", // MELANIA
  "3S8qX1MsMqRbiwKg2cQyx7nis1oHMgaCuc9c4VfvVdPN", // MOTHER (Iggy)
  "4Cnk9EPnW5ixfLZatCPJjDB1PUtcRpVVgTQukm9epump", // DADDY (Tate)
  "A8C3xuqscfmyLrte3VmTqrAq8kgMASF8upcjg6V8hLp", // GME(?)
];

// Fetch full token data for a list of mints (parallel Jupiter search).
export async function fetchMints(mints) {
  const out = await Promise.all(
    mints.map(async (m) => {
      try {
        const d = await jup(`/tokens/v2/search?query=${m}`);
        const list = Array.isArray(d) ? d : [];
        const raw = list.find((t) => (t.id || t.mint) === m) || list[0];
        return raw ? normToken(raw, "24h") : null;
      } catch { return null; }
    })
  );
  return out.filter(Boolean);
}
