/**
 * OrbitX bundle analysis — PURE logic, no I/O, no secrets.
 * Shared by the TS client (`web/src/crypto/bundle.ts`) and the server route
 * (`web/api/_bundle.js`). Single source of truth for clustering + risk so the
 * client and server can never disagree about what a "bundle" is.
 *
 * HONESTY RULE: every function here works only on the traces it is given.
 * A holder with no funding source is never assigned one; a cluster needs
 * >= 2 members with observed evidence. Missing data stays missing — the
 * summarizer reports `state: "unknown"` / `"partial"` instead of a number.
 */

// --- thresholds (documented, tunable in one place) ---------------------------
/** Two first-buys count as one window when they land within this span. */
export const BUNDLE_WINDOW_MS = 60_000;
/** Bundled-supply % at/above which the flag steps up a level. */
export const BUNDLE_RISK_STEPS = { low: 5, medium: 15, high: 30 };
/** Dev-linked supply % that forces the flag up regardless of bundle size. */
export const DEV_LINKED_STEPS = { medium: 10, high: 20 };
/** In-memory server cache TTL (ms) — see _bundle.js. */
export const BUNDLE_CACHE_TTL_MS = 180_000;
/** Max hops in a funding-chain walk (holder -> funder -> funder's funder...). */
export const FUNDING_CHAIN_MAX_HOPS = 3;
/** A single trade at/above this USD size counts as a whale alert. */
export const WHALE_ALERT_MIN_USD = 5_000;
/** Max trades returned by the trade-tape action. */
export const TAPE_MAX_TRADES = 15;

/**
 * @typedef {Object} HolderTrace
 * @property {string} address            holder wallet
 * @property {string|null} tokenAccount  holder's token account for this mint
 * @property {number|null} supplyPct     % of total supply held (null if unknown)
 * @property {number|null} firstBuyAtMs  block time of the holder's first
 *   observed receipt of this token (null when the history could not be read)
 * @property {string|null} fundingSource wallet that funded the holder's first
 *   receipt (token sender). Null when the first receipt came via an AMM swap
 *   (no single funder) or the history was unreadable.
 * @property {string[]} fundingChain     [holder, hop1 funder, hop2 funder, ...]
 *   — every hop observed on-chain, never inferred.
 * @property {boolean} traced            true when first-buy + funding were read
 * @property {string|null} traceNote     why this holder is untraced / partial
 * @property {boolean} devLinked         holder is the creator / mint authority,
 *   or was funded by one of them
 * @property {boolean} viaAmm            first receipt came through an AMM swap
 */

/**
 * @typedef {Object} BundleCluster
 * @property {string} id
 * @property {"funding"|"window"|"funding+window"} kind
 * @property {string|null} fundingSource common funder (null for pure window clusters)
 * @property {string[]} fundingChain    observed chain behind the cluster
 * @property {string[]} members         holder wallets
 * @property {number} supplyPct         summed % of supply across members
 * @property {number|null} timeSpanSeconds first-buy span (null when buy times unknown)
 * @property {number|null} windowStartMs
 * @property {number|null} windowEndMs
 * @property {boolean} devLinked        any member is dev-linked
 * @property {boolean} sourceBehindOtherLaunches the common funder created
 *   other tokens (null when that check could not run)
 * @property {number|null} sourceOtherLaunches how many other tokens the
 *   funder created (null when unknown)
 * @property {string} evidence          human-readable basis, e.g. "same funder"
 */

/** @typedef {"none"|"low"|"medium"|"high"|"unknown"} BundleRisk */

function round2(n) {
  return Math.round(n * 100) / 100;
}

// --- funding-chain endpoints + hop parsing (Team A, scanner v2) -------------
// A funding chain stops when the funder is a known program — an exchange,
// DEX or launchpad — because there is no wallet behind it to walk to. Every
// program id below is verified (same set _holders.js uses for AMM vaults,
// plus the documented Jupiter Aggregator v6 program). Anything else keeps
// walking until max hops or genesis.

/** Program id -> human label for funding-chain terminals. */
export const KNOWN_FUNDING_PROGRAMS = {
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": "pump.fun",
  pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA: "PumpSwap",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mb": "Raydium AMM",
  CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK: "Raydium CLMM",
  whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc: "Orca Whirlpool",
  JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4: "Jupiter Aggregator",
};

/**
 * Label for a funding-chain terminal address, or null when it is an ordinary
 * wallet (the walk continues). Never guesses: an unlisted address is a
 * wallet, not an exchange.
 * @param {string|null} address
 * @returns {string|null}
 */
export function fundingEndpointKind(address) {
  if (!address) return null;
  return KNOWN_FUNDING_PROGRAMS[address] ?? null;
}

/**
 * Parse the SOL funding hop in a parsed transaction: who funded `recipient`
 * and by how much. Strict by design — a hop is only observed when the
 * recipient actually gained SOL in this tx:
 *   1. a parsed system transfer to the recipient (source + lamports), or
 *   2. a balance gain with no parsed transfer — the biggest SOL loser is
 *      the funder and the gain is the amount.
 * Returns null when the recipient gained no SOL (e.g. they authored the tx
 * and only paid fees) — that tx proves no funding hop, it is not one.
 * @param {Object} tx jsonParsed transaction (getTransaction result)
 * @param {string} recipient wallet that received SOL
 * @returns {{ source: string, amountSol: number } | null}
 */
export function parseSolFundingHop(tx, recipient) {
  if (!tx || tx.meta?.err || !recipient) return null;
  const instructions = tx?.transaction?.message?.instructions || [];
  for (const ix of instructions) {
    if (ix?.program !== "system") continue;
    const info = ix?.parsed?.info;
    if (ix?.parsed?.type === "transfer" && info?.destination === recipient && info?.source && info.source !== recipient) {
      const lamports = Number(info.lamports || 0);
      if (lamports > 0) return { source: info.source, amountSol: lamports / 1e9 };
    }
  }
  const keys = (tx?.transaction?.message?.accountKeys || []).map((k) =>
    typeof k === "string" ? k : k?.pubkey,
  );
  const pre = tx?.meta?.preBalances || [];
  const post = tx?.meta?.postBalances || [];
  const idx = keys.indexOf(recipient);
  if (idx < 0) return null;
  const gain = (post[idx] || 0) - (pre[idx] || 0);
  if (gain <= 0) return null;
  let best = null;
  let bestLoss = 0;
  for (let i = 0; i < keys.length; i += 1) {
    if (keys[i] === recipient) continue;
    const loss = (pre[i] || 0) - (post[i] || 0);
    if (loss > bestLoss) {
      bestLoss = loss;
      best = keys[i];
    }
  }
  if (!best || bestLoss <= 0) return null;
  return { source: best, amountSol: gain / 1e9 };
}

// --- dev history: outcome classification --------------------------------------
// "Rugged" needs evidence. The DexScreener token endpoint carries no ATH, so
// the -99%-from-ATH check cannot run from this data — it is NOT approximated
// here; a token whose price history is unreadable stays "unknown" for that
// criterion and can still be "rugged" on LP removal alone.

/**
 * Classify one prior token's outcome from observed DexScreener pair data.
 *   rugged — a pair exists but its liquidity is $0: the LP was removed.
 *   dead   — pair exists with liquidity, but zero 24h volume AND zero 24h
 *            trades: nobody trades it any more.
 *   alive  — pair exists with liquidity and 24h activity.
 *   unknown — no pair data at all (delisted / fetch failed / never traded).
 * @param {Object} input
 * @param {boolean} input.pairExists
 * @param {number|null} input.liquidityUsd
 * @param {number|null} input.volume24h
 * @param {number|null} input.txns24h
 * @returns {"alive"|"dead"|"rugged"|"unknown"}
 */
export function classifyDevOutcome(input) {
  if (!input || input.pairExists !== true) return "unknown";
  const liq = input.liquidityUsd;
  if (typeof liq === "number" && liq <= 0) return "rugged";
  if (liq == null) return "unknown";
  const vol = input.volume24h ?? null;
  const txns = input.txns24h ?? null;
  if (vol === 0 && txns === 0) return "dead";
  if (vol == null && txns == null) return "unknown";
  return "alive";
}

// --- live risk score -----------------------------------------------------------
// Recomputed from the intel available at call time — never cached across
// intel arrivals. Base 100 (higher = safer, same direction as the OG score);
// each factor is a signed deduction with a human label. No evidence at all
// returns score null, never a made-up 100 or 0.

/**
 * @typedef {Object} LiveRiskFactor
 * @property {string} label human-readable cause, e.g. "Bundled supply 32%"
 * @property {number} points signed deduction (always <= 0)
 */

/**
 * Live risk from the intel gathered so far. Callers re-run this every time a
 * new intel field lands (bundle / dev history / same-dev / tape) — the score
 * moves as evidence arrives instead of freezing at first paint.
 * @param {Object} input
 * @param {number|null} [input.bundledSupplyPct]
 * @param {number|null} [input.devLinkedPct]
 * @param {boolean} [input.sameDevFlagged]
 * @param {number} [input.ruggedPriorCount] prior rugged tokens from the same source
 * @param {number|null} [input.whaleSellUsd] whale sell volume (USD, recent tape)
 * @param {number|null} [input.whaleBuyUsd] whale buy volume (USD, recent tape)
 * @returns {{ score: number|null, factors: LiveRiskFactor[] }}
 */
export function computeLiveRisk(input = {}) {
  const factors = [];
  const push = (label, points) => {
    if (points < 0) factors.push({ label, points });
  };
  let evidence = 0;

  const bundled = input.bundledSupplyPct;
  if (typeof bundled === "number" && Number.isFinite(bundled)) {
    evidence += 1;
    if (bundled >= 30) push(`Bundled supply ${bundled}%`, -25);
    else if (bundled >= 15) push(`Bundled supply ${bundled}%`, -15);
    else if (bundled >= 5) push(`Bundled supply ${bundled}%`, -5);
    else if (bundled > 0) push(`Bundled supply ${bundled}%`, -2);
  }
  const devLinked = input.devLinkedPct;
  if (typeof devLinked === "number" && Number.isFinite(devLinked)) {
    evidence += 1;
    if (devLinked >= 20) push(`Dev-linked supply ${devLinked}%`, -15);
    else if (devLinked >= 10) push(`Dev-linked supply ${devLinked}%`, -8);
    else if (devLinked > 0) push(`Dev-linked supply ${devLinked}%`, -3);
  }
  if (input.sameDevFlagged === true) {
    evidence += 1;
    push("Dev traces to a source behind a prior rugged token", -20);
  } else if (input.sameDevFlagged === false) {
    evidence += 1;
  }
  const ruggedPrior = input.ruggedPriorCount;
  if (typeof ruggedPrior === "number" && Number.isFinite(ruggedPrior) && ruggedPrior > 0) {
    evidence += 1;
    push(`${ruggedPrior} prior rugged token${ruggedPrior === 1 ? "" : "s"} from the same source`, -Math.min(20, 10 * ruggedPrior));
  }
  const sell = input.whaleSellUsd;
  const buy = input.whaleBuyUsd;
  if ((typeof sell === "number" && Number.isFinite(sell)) || (typeof buy === "number" && Number.isFinite(buy))) {
    evidence += 1;
    const s = sell ?? 0;
    const b = buy ?? 0;
    if (s > b && s >= 50_000) push(`Whale sells $${Math.round(s).toLocaleString()} outweigh buys`, -10);
    else if (s > b && s >= WHALE_ALERT_MIN_USD) push(`Whale sells $${Math.round(s).toLocaleString()} outweigh buys`, -5);
  }

  if (evidence === 0) return { score: null, factors: [] };
  const score = Math.max(0, Math.min(100, 100 + factors.reduce((s, f) => s + f.points, 0)));
  return { score, factors };
}


function memberView(t) {
  return {
    address: t.address,
    supplyPct: t.supplyPct,
    firstBuyAtMs: t.firstBuyAtMs ?? null,
    fundingSource: t.fundingSource ?? null,
    devLinked: Boolean(t.devLinked),
  };
}

/**
 * Group holders funded by the same source address. A cluster needs >= 2
 * members — one wallet funded by X is not a bundle. Members funded via an
 * AMM swap (fundingSource null) never cluster here.
 * @param {HolderTrace[]} traces
 * @returns {BundleCluster[]}
 */
export function clusterByFundingSource(traces) {
  const bySource = new Map();
  for (const t of traces || []) {
    if (!t || !t.fundingSource || t.fundingSource === t.address) continue;
    if (!bySource.has(t.fundingSource)) bySource.set(t.fundingSource, []);
    bySource.get(t.fundingSource).push(t);
  }
  const out = [];
  for (const [source, members] of bySource) {
    if (members.length < 2) continue;
    const times = members.map((m) => m.firstBuyAtMs).filter((v) => typeof v === "number");
    out.push({
      id: `funding:${source.slice(0, 8)}`,
      kind: "funding",
      fundingSource: source,
      fundingChain: members[0]?.fundingChain?.length ? [...members[0].fundingChain] : [source],
      members: members.map(memberView),
      supplyPct: round2(members.reduce((s, m) => s + (m.supplyPct || 0), 0)),
      timeSpanSeconds: times.length >= 2 ? Math.round((Math.max(...times) - Math.min(...times)) / 1000) : null,
      windowStartMs: times.length ? Math.min(...times) : null,
      windowEndMs: times.length ? Math.max(...times) : null,
      devLinked: members.some((m) => m.devLinked),
      sourceBehindOtherLaunches: null,
      sourceOtherLaunches: null,
      evidence: `${members.length} wallets funded by the same source wallet`,
    });
  }
  return out;
}

/**
 * Group holders whose first buys landed in the same tight time window
 * (default 60s). Greedy sliding window over first-buy times; a holder joins
 * at most one window cluster. Holders with unknown first-buy time never
 * cluster here.
 * @param {HolderTrace[]} traces
 * @param {number} [windowMs]
 * @returns {BundleCluster[]}
 */
export function clusterByBuyWindow(traces, windowMs = BUNDLE_WINDOW_MS) {
  const timed = (traces || [])
    .filter((t) => t && typeof t.firstBuyAtMs === "number")
    .sort((a, b) => a.firstBuyAtMs - b.firstBuyAtMs);
  const out = [];
  let i = 0;
  while (i < timed.length) {
    const start = timed[i];
    const group = [start];
    let j = i + 1;
    while (j < timed.length && timed[j].firstBuyAtMs - start.firstBuyAtMs <= windowMs) {
      group.push(timed[j]);
      j += 1;
    }
    if (group.length >= 2) {
      out.push({
        id: `window:${start.firstBuyAtMs}`,
        kind: "window",
        fundingSource: null,
        fundingChain: [],
        members: group.map(memberView),
        supplyPct: round2(group.reduce((s, m) => s + (m.supplyPct || 0), 0)),
        timeSpanSeconds: Math.round((group[group.length - 1].firstBuyAtMs - start.firstBuyAtMs) / 1000),
        windowStartMs: start.firstBuyAtMs,
        windowEndMs: group[group.length - 1].firstBuyAtMs,
        devLinked: group.some((m) => m.devLinked),
        sourceBehindOtherLaunches: null,
        sourceOtherLaunches: null,
        evidence: `${group.length} first buys within ${Math.round(windowMs / 1000)}s`,
      });
    }
    i = group.length >= 2 ? j : i + 1;
  }
  return out;
}

/**
 * Merge a funding cluster and a window cluster when they describe (mostly)
 * the same wallets — one coordinated group, not two. Overlap >= 50% of the
 * smaller cluster merges; the surviving cluster keeps the funding source and
 * gains the window evidence.
 * @param {BundleCluster[]} clusters
 * @returns {BundleCluster[]}
 */
export function mergeClusters(clusters) {
  const list = [...(clusters || [])];
  const merged = [];
  const used = new Set();
  for (let a = 0; a < list.length; a += 1) {
    if (used.has(a)) continue;
    let base = { ...list[a], members: [...list[a].members] };
    for (let b = a + 1; b < list.length; b += 1) {
      if (used.has(b)) continue;
      const other = list[b];
      const setA = new Set(base.members.map((m) => m.address));
      const shared = other.members.filter((m) => setA.has(m.address)).length;
      const smaller = Math.min(base.members.length, other.members.length);
      if (smaller > 0 && shared / smaller >= 0.5) {
        used.add(b);
        const all = new Map(base.members.map((m) => [m.address, m]));
        for (const m of other.members) if (!all.has(m.address)) all.set(m.address, m);
        const members = [...all.values()];
        base = {
          ...base,
          kind: base.fundingSource || other.fundingSource ? "funding+window" : base.kind,
          fundingSource: base.fundingSource || other.fundingSource || null,
          members,
          supplyPct: round2(members.reduce((s, m) => s + (m.supplyPct || 0), 0)),
          devLinked: base.devLinked || other.devLinked,
          evidence: [base.evidence, other.evidence].filter(Boolean).join(" + "),
          timeSpanSeconds: base.timeSpanSeconds ?? other.timeSpanSeconds ?? null,
          windowStartMs: base.windowStartMs ?? other.windowStartMs ?? null,
          windowEndMs: base.windowEndMs ?? other.windowEndMs ?? null,
          sourceBehindOtherLaunches: base.sourceBehindOtherLaunches ?? other.sourceBehindOtherLaunches ?? null,
          sourceOtherLaunches: base.sourceOtherLaunches ?? other.sourceOtherLaunches ?? null,
        };
      }
    }
    merged.push(base);
  }
  return merged.sort((x, y) => y.supplyPct - x.supplyPct);
}

/**
 * Bundle-risk flag from observed percentages only. Dev-linked supply forces
 * the flag up even when the bundled total is small — a dev holding through
 * proxies is the same risk as a bundle.
 * @param {number|null} bundledSupplyPct
 * @param {number|null} devLinkedPct
 * @returns {BundleRisk}
 */
export function bundleRiskFor(bundledSupplyPct, devLinkedPct) {
  if (bundledSupplyPct == null && devLinkedPct == null) return "unknown";
  const b = bundledSupplyPct ?? 0;
  const d = devLinkedPct ?? 0;
  if (b <= 0 && d <= 0) return "none";
  if (b >= BUNDLE_RISK_STEPS.high || d >= DEV_LINKED_STEPS.high) return "high";
  if (b >= BUNDLE_RISK_STEPS.medium || d >= DEV_LINKED_STEPS.medium) return "medium";
  return "low";
}

/**
 * Assemble the typed result the coordinator folds into the OG score.
 * Never invents: percentages are null when their inputs are missing, and
 * `state` says plainly whether the numbers cover every holder examined.
 *
 * @param {Object} input
 * @param {string} input.mint
 * @param {HolderTrace[]} input.traces        non-pool top holders examined
 * @param {number} input.holdersTotal         top holders found (incl. pools)
 * @param {number|null} input.topHoldersSupplyPct summed supply % of the
 *   examined holders (null when supply was unreadable)
 * @param {string|null} [input.creator]
 * @param {string|null} [input.mintAuthority]
 * @param {boolean} [input.creatorKnown]      false when neither creator nor
 *   mint authority could be read — dev-link % is then unknown, not 0
 * @param {string|null} [input.reason]        why the result is partial/unknown
 * @returns {Object} BundleAnalysis
 */
export function summarizeBundleAnalysis(input) {
  const traces = input.traces || [];
  const traced = traces.filter((t) => t.traced);
  const untraced = traces.filter((t) => !t.traced);
  const clusters = mergeClusters([
    ...clusterByFundingSource(traces),
    ...clusterByBuyWindow(traces),
  ]);
  const clusteredAddrs = new Set(clusters.flatMap((c) => c.members.map((m) => m.address)));
  const bundledSupplyPct =
    traces.length === 0 ? null : round2(traces.filter((t) => clusteredAddrs.has(t.address)).reduce((s, t) => s + (t.supplyPct || 0), 0));
  const devLinked = traces.filter((t) => t.devLinked);
  const devLinkedPct = input.creatorKnown
    ? round2(devLinked.reduce((s, t) => s + (t.supplyPct || 0), 0))
    : null;
  const holdersTotal = input.holdersTotal ?? traces.length;

  let state = "complete";
  let reason = input.reason || null;
  if (traces.length === 0) {
    state = "unknown";
    reason = reason || "Top-holder data unavailable — holder list could not be read.";
  } else if (untraced.length > 0) {
    state = "partial";
    reason =
      reason ||
      `${untraced.length} of ${traces.length} top holders could not be traced (history too deep or RPC failed) — bundled % covers traced holders only.`;
  } else if (input.reason) {
    state = "partial";
  }

  return {
    mint: input.mint,
    state,
    reason,
    analyzedAt: new Date().toISOString(),
    holdersTotal,
    holdersAnalyzed: traces.length,
    holdersTraced: traced.length,
    holdersUntraced: untraced.length,
    untracedAddresses: untraced.map((t) => t.address),
    topHoldersSupplyPct: input.topHoldersSupplyPct ?? null,
    bundledSupplyPct: state === "unknown" ? null : bundledSupplyPct,
    clusters,
    clusterCount: clusters.length,
    devLinkedPct,
    devLinkedWallets: devLinked.map((t) => ({
      address: t.address,
      supplyPct: t.supplyPct,
      fundingSource: t.fundingSource ?? null,
      via: t.address === input.creator || t.address === input.mintAuthority ? "creator" : "funded-by-creator",
    })),
    creator: input.creator ?? null,
    mintAuthority: input.mintAuthority ?? null,
    creatorKnown: Boolean(input.creatorKnown),
    risk: state === "unknown" ? "unknown" : bundleRiskFor(bundledSupplyPct, devLinkedPct),
    fundingSources: [...new Set(traces.map((t) => t.fundingSource).filter(Boolean))],
    // Per-holder traces (lean view) — the raw material for sniper radar,
    // holder conviction, fresh-wallet radar and cost basis. First-buy times
    // and funding sources are observed only; untraced holders keep nulls.
    traces: traces.map((t) => ({
      address: t.address,
      tokenAccount: t.tokenAccount ?? null,
      supplyPct: t.supplyPct ?? null,
      firstBuyAtMs: t.firstBuyAtMs ?? null,
      fundingSource: t.fundingSource ?? null,
      fundingChain: Array.isArray(t.fundingChain) ? [...t.fundingChain] : [t.address],
      traced: Boolean(t.traced),
      traceNote: t.traceNote ?? null,
      devLinked: Boolean(t.devLinked),
      viaAmm: Boolean(t.viaAmm),
    })),
  };
}

// --- Team A wave 3: pure intel helpers (B2–B6) --------------------------------
// All functions here are pure (no fetch, no I/O) so the client and the
// server can share them and vitest can cover them. Every helper degrades to
// null / "unknown" when its inputs are missing — never an invented number.
// Models are documented where they appear; "CPAMM" = constant-product
// approximation against the pool's USD liquidity.

/** CEX hot wallets, Solana mainnet. EMPTY by design (2026-11-08): no
 *  verifiable public list of Binance / Coinbase / OKX / Bybit Solana hot
 *  wallet addresses exists (Helius identity is paid-only; web search found
 *  none). Add an address here ONLY from a verified source (exchange proof-
 *  of-reserves page, explorer label, paid identity feed) — never from
 *  memory. An empty list means "no CEX deposit can be flagged", never
 *  "no deposit happened". */
export const KNOWN_CEX_HOT_WALLETS = [];

/** Holder-conviction label thresholds (documented, see holderConviction):
 *  diamond = first buy >= 30 days ago; paper = first buy < 30 days ago
 *  (has not yet proven diamond hands); unknown = first-buy time unobserved.
 *  @param {number|null} holdDays
 *  @returns {"diamond"|"paper"|"unknown"} */
export function convictionLabel(holdDays) {
  if (holdDays == null || !Number.isFinite(holdDays)) return "unknown";
  return holdDays >= 30 ? "diamond" : "paper";
}

/** Wallet-age label thresholds (documented, see walletAges): fresh = first
 *  observed transaction < 30 days ago; aged = >= 30 days ago; unknown =
 *  no transaction observed or first-seen time unreadable.
 *  @param {number|null} ageDays
 *  @returns {"fresh"|"aged"|"unknown"} */
export function walletAgeLabel(ageDays) {
  if (ageDays == null || !Number.isFinite(ageDays)) return "unknown";
  return ageDays >= 30 ? "aged" : "fresh";
}

/**
 * Constant-product price impact of trading `sizeUsd` against a pool whose
 * total USD liquidity is `liquidityUsd`. Model: impactPct =
 * 100 * size / (liquidity + size) — the pool's USD depth is treated as the
 * counter-side depth; symmetric for buys and sells. Returns nulls when
 * depth is unknown or <= 0.
 * @param {number} sizeUsd
 * @param {number|null} liquidityUsd
 * @returns {{ buyPct: number|null, sellPct: number|null }}
 */
export function slippageForSize(sizeUsd, liquidityUsd) {
  if (
    typeof sizeUsd !== "number" ||
    !Number.isFinite(sizeUsd) ||
    sizeUsd <= 0 ||
    typeof liquidityUsd !== "number" ||
    !Number.isFinite(liquidityUsd) ||
    liquidityUsd <= 0
  ) {
    return { buyPct: null, sellPct: null };
  }
  const pct = Math.round((100 * sizeUsd) / (liquidityUsd + sizeUsd) * 100) / 100;
  return { buyPct: pct, sellPct: pct };
}

/**
 * Dev-sell simulator (CPAMM model). Selling the dev's whole holding moves
 * the price by roughly holdingUsd / (liquidityUsd + holdingUsd) — same
 * formula as slippageForSize, with the dev holding as the size. Returns
 * null impact when depth or holdings are unknown.
 * @param {Object} input
 * @param {number|null} input.devHoldingPct % of supply the dev holds
 * @param {number|null} input.marketCapUsd
 * @param {number|null} input.liquidityUsd
 * @returns {{ devHoldingPct: number|null, devHoldingUsd: number|null, estPriceImpactPct: number|null, model: string } | null}
 */
export function simulateDevSell(input = {}) {
  const pct = input.devHoldingPct;
  const mcap = input.marketCapUsd;
  const liq = input.liquidityUsd;
  const holdingUsd =
    typeof pct === "number" && Number.isFinite(pct) && typeof mcap === "number" && Number.isFinite(mcap)
      ? Math.round(((pct / 100) * mcap) * 100) / 100
      : null;
  if (holdingUsd == null || typeof liq !== "number" || !Number.isFinite(liq) || liq <= 0) {
    return null;
  }
  const { sellPct } = slippageForSize(holdingUsd, liq);
  return {
    devHoldingPct: pct,
    devHoldingUsd: holdingUsd,
    estPriceImpactPct: sellPct,
    model: "constant-product: impact = holdingUsd / (liquidityUsd + holdingUsd); assumes the dev sells the whole holding into the deepest pool in one trade",
  };
}

/**
 * Entry/exit planner: largest USD buy/sell that moves the price ~1% under
 * the CPAMM model. Inverting impact = size/(liq+size) = 0.01 gives
 * size = liq * 0.01 / 0.99. Nulls when depth is unknown.
 * @param {number|null} liquidityUsd
 * @returns {{ maxBuyUsdFor1Pct: number|null, maxSellUsdFor1Pct: number|null, depthUsd: number|null, model: string }}
 */
export function entryExitFor1Pct(liquidityUsd) {
  if (typeof liquidityUsd !== "number" || !Number.isFinite(liquidityUsd) || liquidityUsd <= 0) {
    return { maxBuyUsdFor1Pct: null, maxSellUsdFor1Pct: null, depthUsd: null, model: "constant-product 1% move: size = liquidity * 0.01 / 0.99" };
  }
  const size = Math.round(((liquidityUsd * 0.01) / 0.99) * 100) / 100;
  return {
    maxBuyUsdFor1Pct: size,
    maxSellUsdFor1Pct: size,
    depthUsd: liquidityUsd,
    model: "constant-product 1% move: size = liquidity * 0.01 / 0.99",
  };
}

/**
 * Wash-trading detector over the observed trade tape. A round-trip is one
 * wallet buying then selling (or selling then buying) a similar USD size
 * within 10 minutes — the classic wash signature. Score 0–100 =
 * round-trip volume / total tape volume * 100. No round-trips →
 * verdict "no wash pattern observed" (score 0), never a fabricated pair.
 * @param {Array<{wallet: string, time: number|null, sizeUsd: number, side: "buy"|"sell"}>} tape
 * @returns {{ score: number, pairs: Array<{a: string, b: string, roundTrips: number, volumeUsd: number}>, verdict: string }}
 */
export function detectWashTrading(tape) {
  const trades = Array.isArray(tape) ? tape : [];
  const byWallet = new Map();
  for (const t of trades) {
    if (!t || !t.wallet || typeof t.sizeUsd !== "number" || !Number.isFinite(t.sizeUsd)) continue;
    if (!byWallet.has(t.wallet)) byWallet.set(t.wallet, []);
    byWallet.get(t.wallet).push(t);
  }
  const pairs = [];
  let washVol = 0;
  let totalVol = 0;
  for (const t of trades) totalVol += typeof t.sizeUsd === "number" ? t.sizeUsd : 0;
  for (const [wallet, list] of byWallet) {
    const sorted = [...list].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
    let roundTrips = 0;
    let vol = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        if (a.side === b.side) continue;
        if (a.time != null && b.time != null && b.time - a.time > 600_000) break;
        const smaller = Math.min(a.sizeUsd, b.sizeUsd);
        const larger = Math.max(a.sizeUsd, b.sizeUsd);
        if (larger > 0 && smaller / larger >= 0.8) {
          roundTrips += 1;
          vol += smaller * 2;
          break;
        }
      }
    }
    if (roundTrips > 0) {
      pairs.push({ a: wallet, b: wallet, roundTrips, volumeUsd: Math.round(vol * 100) / 100 });
      washVol += vol;
    }
  }
  const score = totalVol > 0 ? Math.min(100, Math.round((100 * washVol) / totalVol)) : 0;
  return {
    score,
    pairs: pairs.sort((x, y) => y.volumeUsd - x.volumeUsd),
    verdict:
      pairs.length === 0
        ? "no wash pattern observed"
        : score >= 50
          ? "strong wash pattern — most tape volume is round-trips"
          : "possible wash pattern — some round-trip volume observed",
  };
}

/**
 * Chart patterns from OHLC candles (oldest → newest). Documented candle
 * rules — no pattern fires on fewer candles than its rule needs:
 *   doji      — |open-close| <= 10% of (high-low), range > 0.
 *   hammer    — lower shadow >= 2x body, upper shadow <= 10% of range,
 *               body in the top third of the range.
 *   bullish-engulfing / bearish-engulfing — 2 candles, second body fully
 *               covers the first body, opposite directions.
 *   three-white-soldiers / three-black-crows — 3 consecutive closes in the
 *               same direction, each closing above/below the prior close.
 * Confidence: "high" when the signal is large (body >= 2% of open for
 * engulfing/soldiers, shadow >= 3x body for hammer); else "medium".
 * @param {Array<{open: number, high: number, low: number, close: number, at: number|null}>} candles
 * @returns {Array<{type: string, detectedAt: number|null, confidence: "high"|"medium"|"low", detail: string}>}
 */
export function detectChartPatterns(candles) {
  const cs = Array.isArray(candles) ? candles.filter((c) => c && [c.open, c.high, c.low, c.close].every((v) => typeof v === "number" && Number.isFinite(v) && v > 0)) : [];
  const out = [];
  if (cs.length === 0) return out;
  const last = cs[cs.length - 1];
  const range = last.high - last.low;
  const body = Math.abs(last.open - last.close);
  if (range > 0 && body <= 0.1 * range) {
    out.push({ type: "doji", detectedAt: last.at ?? null, confidence: "medium", detail: "Open ≈ close — indecision on the latest candle." });
  }
  if (range > 0 && body > 0) {
    const lowerShadow = Math.min(last.open, last.close) - last.low;
    const upperShadow = last.high - Math.max(last.open, last.close);
    if (lowerShadow >= 2 * body && upperShadow <= 0.1 * range) {
      out.push({
        type: "hammer",
        detectedAt: last.at ?? null,
        confidence: lowerShadow >= 3 * body ? "high" : "medium",
        detail: "Long lower shadow with a small body near the high — buyers stepped in below.",
      });
    }
  }
  if (cs.length >= 2) {
    const prev = cs[cs.length - 2];
    const prevBull = prev.close > prev.open;
    const lastBull = last.close > last.open;
    if (prevBull !== lastBull) {
      const engulfed =
        lastBull
          ? last.open <= prev.close && last.close >= prev.open
          : last.open >= prev.close && last.close <= prev.open;
      if (engulfed) {
        const movePct = Math.abs((last.close - last.open) / last.open) * 100;
        out.push({
          type: lastBull ? "bullish-engulfing" : "bearish-engulfing",
          detectedAt: last.at ?? null,
          confidence: movePct >= 2 ? "high" : "medium",
          detail: `Latest candle's body fully covers the prior candle's body (${movePct.toFixed(1)}% move).`,
        });
      }
    }
  }
  if (cs.length >= 3) {
    const three = cs.slice(-3);
    const up = three.every((c, i) => (i === 0 ? true : c.close > three[i - 1].close) && c.close > c.open);
    const down = three.every((c, i) => (i === 0 ? true : c.close < three[i - 1].close) && c.close < c.open);
    if (up) {
      out.push({ type: "three-white-soldiers", detectedAt: last.at ?? null, confidence: "high", detail: "Three consecutive candles closing higher, each closing above its open." });
    } else if (down) {
      out.push({ type: "three-black-crows", detectedAt: last.at ?? null, confidence: "high", detail: "Three consecutive candles closing lower, each closing below its open." });
    }
  }
  return out;
}

/**
 * Range-based volatility from OHLC candles: (max high − min low) /
 * mean close * 100 over the window. Not annualised, not a returns stddev —
 * it is the observed price range as a % of the mean price. Returns nulls
 * when a window has no candles.
 * @param {Array<{high: number, low: number, close: number}>} candles24h
 * @param {Array<{high: number, low: number, close: number}>} candles7d
 * @returns {{ volatilityPct24h: number|null, volatilityPct7d: number|null, source: string }}
 */
export function volatilityFromCandles(candles24h, candles7d) {
  const rangeVol = (cs) => {
    const list = Array.isArray(cs) ? cs.filter((c) => c && typeof c.high === "number" && typeof c.low === "number" && typeof c.close === "number") : [];
    if (!list.length) return null;
    const hi = Math.max(...list.map((c) => c.high));
    const lo = Math.min(...list.map((c) => c.low));
    const mean = list.reduce((s, c) => s + c.close, 0) / list.length;
    if (!(mean > 0)) return null;
    return Math.round(((100 * (hi - lo)) / mean) * 100) / 100;
  };
  return {
    volatilityPct24h: rangeVol(candles24h),
    volatilityPct7d: rangeVol(candles7d),
    source: "GeckoTerminal OHLCV candles (range / mean close, not annualised)",
  };
}

/**
 * Bundle-decay trend from successive bundled-% snapshots (oldest → newest).
 * < 2 snapshots → "unknown" (one scan cannot show a trend). Growing =
 * last >= 1.1x first; unwinding = last <= 0.9x first; else flat.
 * @param {Array<{at: number, bundledPct: number|null}>} snapshots
 * @returns {"growing"|"unwinding"|"flat"|"unknown"}
 */
export function bundleDecayTrend(snapshots) {
  const pts = Array.isArray(snapshots) ? snapshots.filter((s) => s && typeof s.bundledPct === "number" && Number.isFinite(s.bundledPct)) : [];
  if (pts.length < 2) return "unknown";
  const first = pts[0].bundledPct;
  const last = pts[pts.length - 1].bundledPct;
  if (first <= 0) return last > 0 ? "growing" : "flat";
  if (last >= first * 1.1) return "growing";
  if (last <= first * 0.9) return "unwinding";
  return "flat";
}

/**
 * Rug-leaderboard danger score from a prior token's outcome (documented):
 * rugged = 100, dead = 60, alive = 20, unknown = null (excluded from the
 * board — unscorable tokens are counted, not ranked).
 * @param {"alive"|"dead"|"rugged"|"unknown"} outcome
 * @returns {number|null}
 */
export function dangerScoreForOutcome(outcome) {
  if (outcome === "rugged") return 100;
  if (outcome === "dead") return 60;
  if (outcome === "alive") return 20;
  return null;
}

/**
 * USD size that drops the price by `dropPct`% under the CPAMM model.
 * Selling Δx of the token moves price to x/(x+Δx); for a drop fraction
 * d the sale is worth (liquidityUsd / 2) * d / (1 - d) — the /2 is the
 * token side's USD depth (total liquidity is both sides).
 * @param {number|null} liquidityUsd
 * @param {number} dropPct e.g. 10, 25, 50
 * @returns {number|null}
 */
export function usdToDropPricePct(liquidityUsd, dropPct) {
  if (typeof liquidityUsd !== "number" || !Number.isFinite(liquidityUsd) || liquidityUsd <= 0) return null;
  const d = dropPct / 100;
  if (!(d > 0 && d < 1)) return null;
  return Math.round(((liquidityUsd / 2) * d) / (1 - d) * 100) / 100;
}
