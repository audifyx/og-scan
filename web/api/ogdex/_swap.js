// Classify one jsonParsed Solana transaction for a given owner: swap, transfer,
// or other (ATA create/close, account init, ...). Uses pre/post token + SOL
// balance deltas plus the program IDs actually invoked.
//
// Why program-based: a plain transfer-in (tokens in, SOL fee out) has the same
// balance-delta SHAPE as a buy, so delta-only classification mislabels
// transfers as swaps. A swap must invoke a DEX program.
//
// DEX program IDs — verified on-chain / official sources, never guessed:
// - Jupiter v6 aggregator: JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 (Jupiter tx-parser packages agree)
// - Raydium AMM v4, Raydium CLMM, Orca Whirlpool, PumpSwap, pump.fun:
//   same verified IDs as the holder LP-marking fix (ogdex/_holders.js).
export const DEX_PROGRAMS = new Set([
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter v6
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mb", // Raydium AMM v4
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Orca Whirlpool
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // PumpSwap
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // pump.fun
]);

const SOL = "So11111111111111111111111111111111111111112";
const STABLE = new Set(["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"]);
const DUST = 1e-9;

/** All program IDs invoked by the tx (top-level + inner instructions). */
export function txPrograms(tx) {
  const out = new Set();
  const msg = tx?.transaction?.message;
  const walk = (ixns) => {
    for (const ix of ixns || []) {
      if (typeof ix?.programId === "string") out.add(ix.programId);
      // jsonParsed inner instructions live on the outer instruction.
      walk(ix?.innerInstructions?.flatMap((g) => g?.instructions || []));
    }
  };
  walk(msg?.instructions);
  return [...out];
}

/**
 * Full classification. Never returns null for a well-formed tx — failed txs
 * report kind "failed" so callers can count them instead of dropping them.
 * tokenDeltas: per-mint net uiAmount change for the owner (stables included).
 */
export function parseTx(tx, owner) {
  const sig = tx?.transaction?.signatures?.[0] || null;
  const base = {
    txHash: sig,
    time: (tx?.blockTime || 0) * 1000,
    feeLamports: tx?.meta?.fee ?? null,
    feeSol: tx?.meta?.fee != null ? tx.meta.fee / 1e9 : null,
    failed: Boolean(tx?.meta?.err),
    error: tx?.meta?.err || null,
  };
  try {
    if (!tx || !tx.meta) return { ...base, kind: "unknown", tokenDeltas: {}, solDelta: 0, programs: [] };
    const msg = tx.transaction?.message;
    const keys = (msg?.accountKeys || []).map((k) => (typeof k === "string" ? k : k.pubkey));
    const ownerIdx = keys.indexOf(owner);
    const pre = tx.meta?.preTokenBalances || [];
    const post = tx.meta?.postTokenBalances || [];

    const deltas = {};
    const add = (arr, sign) => {
      for (const b of arr) {
        if (b.owner !== owner) continue;
        const amt = Number(b.uiTokenAmount?.uiAmount || 0);
        deltas[b.mint] = (deltas[b.mint] || 0) + sign * amt;
      }
    };
    add(post, 1); add(pre, -1);
    // Drop dust.
    for (const m of Object.keys(deltas)) if (Math.abs(deltas[m]) < DUST) delete deltas[m];

    let solDelta = 0;
    if (ownerIdx >= 0 && tx.meta?.preBalances && tx.meta?.postBalances) {
      solDelta = (tx.meta.postBalances[ownerIdx] - tx.meta.preBalances[ownerIdx]) / 1e9;
    }
    if (deltas[SOL]) { solDelta += deltas[SOL]; delete deltas[SOL]; }

    const programs = txPrograms(tx);
    const dexHit = programs.find((p) => DEX_PROGRAMS.has(p)) || null;

    if (base.failed) return { ...base, kind: "failed", tokenDeltas: deltas, solDelta, programs };

    // Swap = DEX program invoked + a non-stable token moved.
    // If a DEX program was invoked but the wallet only moved stables (e.g.
    // its ATA was closed / swept as a route hop in someone else's Jupiter
    // tx), that is NOT the wallet trading — fall through to transfer/other.
    if (dexHit) {
      let mint = null, best = 0;
      for (const [m, d] of Object.entries(deltas)) {
        if (STABLE.has(m)) continue;
        if (Math.abs(d) > Math.abs(best)) { best = d; mint = m; }
      }
      if (mint && Math.abs(best) >= DUST) {
        return {
          ...base,
          kind: "swap",
          dexProgram: dexHit,
          side: best > 0 ? "buy" : "sell",
          mint,
          tokenAmount: Math.abs(best),
          solAmount: Math.abs(solDelta),
          tokenDeltas: deltas,
          solDelta,
          programs,
        };
      }
    }

    // No swap: any token/SOL movement is a transfer (or rent/ATA mgmt).
    if (Object.keys(deltas).length > 0 || Math.abs(solDelta) >= DUST) {
      return { ...base, kind: "transfer", dexProgram: dexHit, tokenDeltas: deltas, solDelta, programs };
    }
    return { ...base, kind: "other", dexProgram: dexHit, tokenDeltas: deltas, solDelta, programs };
  } catch {
    return { ...base, kind: "unknown", tokenDeltas: {}, solDelta: 0, programs: [] };
  }
}

/**
 * Back-compat swap parser: returns the swap shape only when the tx is a real
 * swap (DEX program + token moved). Transfers are NOT swaps anymore.
 * NOTE: callers must not filter on solAmount > 0 — USDC/stable-leg swaps have
 * solAmount 0 and are real swaps.
 */
export function parseSwap(tx, owner) {
  const c = parseTx(tx, owner);
  if (c.kind !== "swap") return null;
  return {
    txHash: c.txHash,
    side: c.side,
    mint: c.mint,
    tokenAmount: c.tokenAmount,
    solAmount: c.solAmount,
    time: c.time,
  };
}
