/**
 * Holder Intelligence — bundle / insider / concentration detection from the
 * holder list + safety data we already fetch. Heuristic, on-chain-derived.
 */
export interface HolderIntelResult {
  top10Pct: number | null;
  whaleCount: number;
  bundleWallets: number;
  bundlePct: number;
  kolPct: number;
  serialDev: boolean;
  devTokens: number | null;
  tone: "good" | "warn" | "bad";
  verdict: string;
  flags: { tone: "good" | "warn" | "bad"; text: string }[];
}

export function buildHolderIntel(holders: any[], safety: any, dir: Record<string, any> = {}): HolderIntelResult {
  const hs = Array.isArray(holders) ? holders : [];
  const top10Pct = hs.length ? hs.slice(0, 10).reduce((s, h) => s + (h.pct || 0), 0) : null;
  const whaleCount = hs.filter((h) => (h.pct || 0) >= 1).length;
  const kolPct = hs.filter((h) => dir[h.owner]).reduce((s, h) => s + (h.pct || 0), 0);

  // Bundle heuristic: clusters of wallets holding near-identical small/mid amounts
  // (a hallmark of bundled/coordinated launch buys). Exclude the very top (LP/whales).
  const candidates = hs.filter((h) => (h.pct || 0) >= 0.15 && (h.pct || 0) <= 4);
  const groups: Record<string, any[]> = {};
  for (const h of candidates) {
    const key = (Math.round((h.pct || 0) * 10) / 10).toFixed(1); // bucket by 0.1%
    (groups[key] = groups[key] || []).push(h);
  }
  let bundleWallets = 0, bundlePct = 0;
  for (const k of Object.keys(groups)) {
    const g = groups[k];
    if (g.length >= 4) { bundleWallets += g.length; bundlePct += g.reduce((s, h) => s + (h.pct || 0), 0); }
  }

  const devTokens = safety?.creatorTokensCount ?? null;
  const serialDev = (devTokens ?? 0) >= 5;

  const flags: HolderIntelResult["flags"] = [];
  if (top10Pct != null) {
    if (top10Pct < 20) flags.push({ tone: "good", text: `Top 10 hold ${top10Pct.toFixed(1)}% — healthy distribution.` });
    else if (top10Pct < 40) flags.push({ tone: "warn", text: `Top 10 hold ${top10Pct.toFixed(1)}% — moderate concentration.` });
    else flags.push({ tone: "bad", text: `Top 10 hold ${top10Pct.toFixed(1)}% — heavy concentration; few wallets can dump.` });
  }
  if (bundleWallets >= 4) flags.push({ tone: bundlePct > 15 ? "bad" : "warn", text: `Possible bundle: ${bundleWallets} wallets hold near-identical amounts (~${bundlePct.toFixed(1)}% of supply).` });
  else flags.push({ tone: "good", text: "No obvious bundled-wallet clusters detected." });
  if (whaleCount > 0) flags.push({ tone: whaleCount > 8 ? "warn" : "good", text: `${whaleCount} whale wallet(s) hold ≥1% each.` });
  if (kolPct > 0) flags.push({ tone: "good", text: `Tracked KOLs hold ${kolPct.toFixed(2)}% — smart money present.` });
  if (serialDev) flags.push({ tone: "warn", text: `Creator has deployed ${devTokens} tokens — serial deployer, check their track record.` });
  else if (devTokens != null) flags.push({ tone: "good", text: `Creator has deployed ${devTokens} token(s).` });

  // overall tone
  let tone: HolderIntelResult["tone"] = "good";
  if ((top10Pct ?? 0) >= 40 || bundlePct > 15) tone = "bad";
  else if ((top10Pct ?? 0) >= 25 || bundleWallets >= 4 || serialDev) tone = "warn";
  const verdict = tone === "good" ? "Distribution looks clean" : tone === "warn" ? "Some concentration / bundle risk" : "High concentration / bundle risk";

  return { top10Pct, whaleCount, bundleWallets, bundlePct, kolPct, serialDev, devTokens, tone, verdict, flags };
}
