// Parse a buy/sell swap out of a jsonParsed Solana transaction for a given owner.
// Uses pre/post token + SOL balance deltas — works for typical DEX swaps without an indexer.
const SOL = "So11111111111111111111111111111111111111112";
const STABLE = new Set(["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"]);

export function parseSwap(tx, owner) {
  try {
    if (!tx || tx.meta?.err) return null;
    const msg = tx.transaction?.message;
    const keys = (msg?.accountKeys || []).map((k) => (typeof k === "string" ? k : k.pubkey));
    const ownerIdx = keys.indexOf(owner);
    const pre = tx.meta?.preTokenBalances || [];
    const post = tx.meta?.postTokenBalances || [];

    // token deltas for this owner, keyed by mint
    const deltas = {};
    const add = (arr, sign) => {
      for (const b of arr) {
        if (b.owner !== owner) continue;
        const amt = Number(b.uiTokenAmount?.uiAmount || 0);
        deltas[b.mint] = (deltas[b.mint] || 0) + sign * amt;
      }
    };
    add(post, 1); add(pre, -1);

    // SOL delta (lamports) for owner account
    let solDelta = 0;
    if (ownerIdx >= 0 && tx.meta?.preBalances && tx.meta?.postBalances) {
      solDelta = (tx.meta.postBalances[ownerIdx] - tx.meta.preBalances[ownerIdx]) / 1e9;
    }
    // wrapped SOL token delta counts as SOL too
    if (deltas[SOL]) { solDelta += deltas[SOL]; delete deltas[SOL]; }

    // pick the traded token = largest |delta| that isn't a stable
    let mint = null, best = 0;
    for (const [m, d] of Object.entries(deltas)) {
      if (STABLE.has(m)) continue;
      if (Math.abs(d) > Math.abs(best)) { best = d; mint = m; }
    }
    if (!mint || Math.abs(best) < 1e-9) return null;

    const side = best > 0 ? "buy" : "sell";
    return {
      txHash: tx.transaction?.signatures?.[0] || null,
      side,
      mint,
      tokenAmount: Math.abs(best),
      solAmount: Math.abs(solDelta),
      time: (tx.blockTime || 0) * 1000,
    };
  } catch { return null; }
}
