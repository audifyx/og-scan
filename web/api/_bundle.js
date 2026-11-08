/**
 * OrbitX bundle detection — server route.
 *
 * GET /api/ogdex/bundle?mint=<mint>  (wired into web/api/ogdex.js ROUTES)
 *
 * All heavy Solana RPC runs here, never from the client. Data path:
 *   1. Top holders — getLabeledHolders (Helius via Supabase rpc-proxy, with
 *      KV last-known-good fallback). Liquidity-pool vaults are excluded from
 *      bundle math; they are not holders.
 *   2. Mint authority — getAccountInfo (jsonParsed). Creator — pump.fun
 *      coin API, best effort.
 *   3. Per holder (cap 20, chunked x5): walk the holder's token-account
 *      signature history back to its OLDEST tx (max 2 pages x 1000 sigs) and
 *      read the first receipt of this token. The token sender in that tx is
 *      the hop-1 funding source; a first receipt through an AMM swap has no
 *      single funder and is labeled viaAmm, never assigned one.
 *   4. Hop 2 (Solscan-style funding-chain walk): for each distinct funder
 *      behind >= 2 holders (or a dev-linked holder), read that funder's
 *      oldest sampled SOL receipt to find who funded the funder. Holders
 *      sharing a hop-2 funder cluster too.
 *   5. Source-behind-other-launches: when HELIUS_API_KEY is set in server
 *      env, Helius DAS getAssetsByCreator counts other fungible tokens the
 *      funder created. Without the key the field stays null (unknown), and
 *      the rest of the analysis still runs on public RPC.
 *
 * HONESTY RULE: anything unreadable degrades to state "unknown"/"partial"
 * with a reason. No bundled % or cluster is ever invented. Overall scan
 * budget is 45s — holders not traced in budget are listed as untraced.
 *
 * Underscore-prefixed file: NOT a Vercel function by itself (function count
 * unchanged). ogdex.js imports the default handler into its ROUTES map.
 */
import { getLabeledHolders, AMM_PROGRAMS } from "./ogdex/_holders.js";
import { resilientRpc } from "./ogdex/_lib.js";
import {
  BUNDLE_CACHE_TTL_MS,
  FUNDING_CHAIN_MAX_HOPS,
  WHALE_ALERT_MIN_USD,
  TAPE_MAX_TRADES,
  bundleRiskFor,
  clusterByFundingSource,
  clusterByBuyWindow,
  mergeClusters,
  summarizeBundleAnalysis,
  fundingEndpointKind,
  parseSolFundingHop,
  classifyDevOutcome,
  computeLiveRisk,
  walletAgeLabel,
  detectChartPatterns,
  volatilityFromCandles,
  bundleDecayTrend,
  usdToDropPricePct,
} from "../shared/bundle-analysis.js";

const MAX_HOLDERS = 20;
const SIG_PAGE_LIMIT = 1000;
const MAX_SIG_PAGES = 2;
const HOLDER_CONCURRENCY = 5;
const MAX_HOP2_SOURCES = 5;
const SCAN_BUDGET_MS = 45_000;
const HOLDER_TIMEOUT_MS = 12_000;
/** Per-hop budget for the funding-chain walk (sequential hops). */
const CHAIN_BUDGET_MS = 30_000;
/** Max dev wallets walked / source wallets history-checked per same-dev scan. */
const SAME_DEV_MAX_WALLETS = 3;
const SAME_DEV_MAX_SOURCES = 5;
/** Max prior tokens classified per dev-history lookup. */
const DEV_HISTORY_MAX_TOKENS = 12;
const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
// ── Team A wave 3 (B6 deep intel) ────────────────────────────────────────────
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
/** Jupiter v6 quote-api is unreachable from this deployment's egress, but
 *  the lite-api host answers — verified live 2026-11-08. */
const JUP_LITE_QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const RUGCHECK_REPORT = "https://api.rugcheck.xyz/v1/tokens";
const GECKO_OHLCV = "https://api.geckoterminal.com/api/v2/networks/solana/pools";
/** Bundle-decay snapshots: in-memory only (warm instances; Vercel is
 *  ephemeral). One snapshot per fresh bundle scan, max 10 per mint, 24h
 *  TTL. < 2 snapshots → trend "unknown". */
const decaySnapshots = new Map();
function recordBundleSnapshot(mint, bundledPct) {
  if (typeof bundledPct !== "number" || !Number.isFinite(bundledPct)) return;
  const now = Date.now();
  const list = (decaySnapshots.get(mint) || []).filter((s) => now - s.at < 86_400_000);
  list.push({ at: now, bundledPct: Math.round(bundledPct * 100) / 100 });
  decaySnapshots.set(mint, list.slice(-10));
  if (decaySnapshots.size > 200) decaySnapshots.delete(decaySnapshots.keys().next().value);
}

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function withTimeout(promise, ms, fallback) {
  let timer = null;
  const guard = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, guard]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function heliusKey() {
  // REACT_APP_HELIUS_KEY is the live key already set in Vercel env (no
  // HELIUS_API_KEY exists there — verified 2026-11-08). The rpc-proxy's
  // Helius provider is unconfigured, so direct Helius is the working path.
  return process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY || process.env.REACT_APP_HELIUS_KEY || "";
}

/** In-memory per-key cache (warm instances only; Vercel is ephemeral).
 *  Keys are namespaced: `bundle:<mint>`, `chain:<wallet>`,
 *  `devhist:<wallet>`, `tape:<mint>`, `samedev:<mint>`. */
const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  const ttl = hit.payload?.state === "unknown" ? 60_000 : BUNDLE_CACHE_TTL_MS;
  if (Date.now() - hit.at > ttl) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
}
function cachePut(key, payload) {
  cache.set(key, { at: Date.now(), payload });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
}

/** Default RPC transport: resilientRpc (Helius proxy -> public fallback). */
async function defaultRpc(method, params) {
  return resilientRpc(method, params);
}

async function fetchPumpCreator(mint, fetchImpl = fetch) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    try {
      const r = await fetchImpl(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
        headers: { Accept: "application/json" },
        signal: ctl.signal,
      });
      if (!r.ok) return null;
      const j = await r.json().catch(() => null);
      return typeof j?.creator === "string" ? j.creator : null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/**
 * Oldest signature for an address, paging `before` backwards.
 * Returns { signature, blockTime, reachedGenesis, empty } — `empty` is true
 * when the address has no observed transactions at all (fresh wallet),
 * which is different from an unreadable history (null return).
 * Caps at MAX_SIG_PAGES so a huge history (e.g. ORBITX) degrades instead of
 * burning the whole scan budget.
 */
async function oldestSignature(address, rpc, fetchImpl) {
  let before = null;
  let oldest = null;
  let reachedGenesis = false;
  for (let page = 0; page < MAX_SIG_PAGES; page += 1) {
    const opts = { limit: SIG_PAGE_LIMIT };
    if (before) opts.before = before;
    const sigs = await withTimeout(rpc("getSignaturesForAddress", [address, opts]), HOLDER_TIMEOUT_MS, null);
    if (!Array.isArray(sigs) || !sigs.length) {
      reachedGenesis = true;
      break;
    }
    oldest = sigs[sigs.length - 1];
    before = oldest.signature;
    if (sigs.length < SIG_PAGE_LIMIT) {
      reachedGenesis = true;
      break;
    }
  }
  if (!oldest?.signature) {
    return { signature: null, blockTime: null, reachedGenesis, empty: true };
  }
  return { signature: oldest.signature, blockTime: oldest.blockTime ?? null, reachedGenesis, empty: false };
}

/** token-account address -> owner wallet, from pre/post token balances. */
function tokenAccountOwners(tx) {
  const keys = (tx?.transaction?.message?.accountKeys || []).map((k) =>
    typeof k === "string" ? k : k?.pubkey,
  );
  const out = new Map();
  for (const b of [...(tx?.meta?.preTokenBalances || []), ...(tx?.meta?.postTokenBalances || [])]) {
    if (b?.accountIndex != null && keys[b.accountIndex] && b?.owner) {
      out.set(keys[b.accountIndex], b.owner);
    }
  }
  return out;
}

/**
 * Parse a holder's first-receipt tx (jsonParsed). Returns the funding
 * source (token sender), first-buy time, and whether it came via an AMM.
 */
function parseFirstReceipt(tx, mint, holder) {
  if (!tx || tx.meta?.err) return { fundingSource: null, viaAmm: false, note: "first transaction failed or unreadable" };
  const owners = tokenAccountOwners(tx);
  const instructions = tx?.transaction?.message?.instructions || [];
  let fundingSource = null;
  let sawMintTransfer = false;
  for (const ix of instructions) {
    const info = ix?.parsed?.info;
    const type = ix?.parsed?.type;
    if (!info || (type !== "transfer" && type !== "transferChecked")) continue;
    if (ix?.parsed?.info?.mint && info.mint !== mint) continue;
    const destOwner = owners.get(info.destination);
    if (destOwner !== holder) continue;
    sawMintTransfer = true;
    const srcOwner = owners.get(info.source);
    if (!srcOwner || srcOwner === holder) continue;
    fundingSource = srcOwner;
    break;
  }
  // Balance-delta fallback: holder gained tokens but no direct transfer
  // instruction named them (AMM swap / multi-hop route).
  if (!sawMintTransfer) {
    const pre = (tx.meta?.preTokenBalances || []).filter((b) => b.mint === mint && b.owner === holder);
    const post = (tx.meta?.postTokenBalances || []).filter((b) => b.mint === mint && b.owner === holder);
    const preAmt = pre.reduce((s, b) => s + Number(b.uiTokenAmount?.uiAmount || 0), 0);
    const postAmt = post.reduce((s, b) => s + Number(b.uiTokenAmount?.uiAmount || 0), 0);
    if (postAmt > preAmt) {
      return { fundingSource: null, viaAmm: true, note: "first receipt via AMM swap — no single funder" };
    }
    return { fundingSource: null, viaAmm: false, note: "oldest transaction shows no receipt of this token" };
  }
  return { fundingSource, viaAmm: false, note: fundingSource ? null : "first receipt sender could not be resolved" };
}

/**
 * SOL funder in a tx where `recipient` gained SOL — strict observed hop
 * only (see parseSolFundingHop in shared/bundle-analysis.js). Returns
 * { source, amountSol } or null when no SOL receipt is observed in the tx.
 */
function parseSolFunder(tx, recipient) {
  return parseSolFundingHop(tx, recipient);
}

/** Trace one holder: oldest tx of their token account -> first buy + funder. */
async function traceHolder(holder, mint, creator, mintAuthority, rpc) {
  const base = {
    address: holder.owner,
    tokenAccount: holder.tokenAccount || null,
    supplyPct: typeof holder.pct === "number" ? Math.round(holder.pct * 100) / 100 : null,
    firstBuyAtMs: null,
    fundingSource: null,
    fundingChain: [holder.owner],
    traced: false,
    traceNote: null,
    devLinked: false,
    viaAmm: false,
  };
  const accountAddr = holder.tokenAccount || holder.owner;
  const oldest = await oldestSignature(accountAddr, rpc).catch(() => null);
  if (!oldest || !oldest.signature) {
    return {
      ...base,
      traceNote: oldest?.empty
        ? "no transactions observed for this token account"
        : "token-account history unreadable (RPC failed)",
    };
  }
  const tx = await withTimeout(
    rpc("getTransaction", [oldest.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]),
    HOLDER_TIMEOUT_MS,
    null,
  ).catch(() => null);
  if (!tx) {
    return { ...base, firstBuyAtMs: oldest.blockTime ? oldest.blockTime * 1000 : null, traceNote: "first transaction could not be fetched" };
  }
  const parsed = parseFirstReceipt(tx, mint, holder.owner);
  const fundingSource = parsed.fundingSource;
  const chain = [holder.owner];
  if (fundingSource) chain.push(fundingSource);
  const devLinked =
    holder.owner === creator ||
    holder.owner === mintAuthority ||
    (fundingSource != null && (fundingSource === creator || fundingSource === mintAuthority));
  return {
    ...base,
    firstBuyAtMs: tx.blockTime ? tx.blockTime * 1000 : oldest.blockTime ? oldest.blockTime * 1000 : null,
    fundingSource,
    fundingChain: chain,
    traced: true,
    traceNote: parsed.note,
    devLinked,
    viaAmm: parsed.viaAmm,
  };
}

/** Hop 2: who funded the funder (oldest sampled SOL receipt, 1 page).
 *  Returns { source, amountSol, sig, atMs } or null — never an inferred hop. */
async function hop2Funder(source, rpc) {
  const oldest = await oldestSignature(source, rpc).catch(() => null);
  if (!oldest || !oldest.signature) return null;
  const tx = await withTimeout(
    rpc("getTransaction", [oldest.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]),
    HOLDER_TIMEOUT_MS,
    null,
  ).catch(() => null);
  if (!tx) return null;
  const hop = parseSolFunder(tx, source);
  if (!hop) return null;
  return {
    source: hop.source,
    amountSol: hop.amountSol,
    sig: oldest.signature,
    atMs: tx.blockTime ? tx.blockTime * 1000 : oldest.blockTime ? oldest.blockTime * 1000 : null,
  };
}

/** Helius DAS: how many other fungible tokens did `creator` create? */
async function countOtherLaunches(address, mint, fetchImpl = fetch) {
  const key = heliusKey();
  if (!key || !address) return null;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetchImpl(`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "bundle-other-launches",
          method: "getAssetsByCreator",
          params: { creatorAddress: address, onlyVerified: false, page: 1, limit: 100 },
        }),
        signal: ctl.signal,
      });
      if (!r.ok) return null;
      const j = await r.json().catch(() => null);
      const items = j?.result?.items || [];
      return items.filter(
        (a) => (a?.interface === "FungibleToken" || a?.interface === "FungibleAsset") && a?.id !== mint,
      ).length;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/**
 * Full bundle analysis for a mint. `opts` lets tests inject transports:
 *   opts.rpc      (method, params) => result        (default: resilientRpc)
 *   opts.holders  (mint, price, limit) => { holders, pools, source }
 *   opts.fetch    fetch implementation
 *   opts.now      () => ms (scan-budget clock, tests only)
 */
export async function analyzeBundles(mint, opts = {}) {
  const rpc = opts.rpc || defaultRpc;
  const holdersFn = opts.holders || getLabeledHolders;
  const fetchImpl = opts.fetch || fetch;
  const startedAt = (opts.now || Date.now)();
  const elapsed = () => (opts.now || Date.now)() - startedAt;
  const overBudget = () => elapsed() > SCAN_BUDGET_MS;

  const cached = cacheGet(`bundle:${mint}`);
  if (cached && !opts.noCache) return { analysis: cached, cached: true };

  let holdersRes;
  try {
    holdersRes = await holdersFn(mint, null, 25);
  } catch {
    holdersRes = { holders: [], pools: [], source: "none" };
  }
  const allHolders = Array.isArray(holdersRes?.holders) ? holdersRes.holders : [];
  const realHolders = allHolders.filter((h) => !h.isPool).slice(0, MAX_HOLDERS);
  if (!realHolders.length) {
    // Say WHY the data is missing — the holder fetch records its last RPC
    // error (no key / rejected key / rate-limited / unreachable). Never
    // include any credential material in the reason.
    const lastErr = String(holdersRes?.lastError || "");
    const reason = /no helius key/i.test(lastErr)
      ? "Helius API key missing in Vercel env — holder data unavailable."
      : /401|unauthorized|invalid.*(api.?key|key)/i.test(lastErr)
        ? "Helius rejected the API key — holder data unavailable."
        : /429|rate.?limit/i.test(lastErr)
          ? "Helius rate-limited (429) — holder data unavailable, try again shortly."
          : `Top-holder data unavailable (Helius index / RPC unreachable${lastErr ? ` — last RPC error: ${lastErr.slice(0, 120)}` : ""}). Try again shortly.`;
    const analysis = summarizeBundleAnalysis({
      mint,
      traces: [],
      holdersTotal: allHolders.length,
      topHoldersSupplyPct: null,
      creatorKnown: false,
      reason,
    });
    cachePut(`bundle:${mint}`, analysis);
    return { analysis, cached: false };
  }
  const topHoldersSupplyPct = Math.round(
    realHolders.reduce((s, h) => s + (typeof h.pct === "number" ? h.pct : 0), 0) * 100,
  ) / 100;

  const [mintInfo, creator] = await Promise.all([
    withTimeout(rpc("getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }]), 8000, null).catch(() => null),
    fetchPumpCreator(mint, fetchImpl),
  ]);
  const mintAuthority = mintInfo?.value?.data?.parsed?.info?.mintAuthority ?? null;
  const creatorKnown = Boolean(creator || mintAuthority);

  // Trace holders in chunks; stop starting new traces once over budget.
  const traces = [];
  for (let i = 0; i < realHolders.length; i += HOLDER_CONCURRENCY) {
    const chunk = realHolders.slice(i, i + HOLDER_CONCURRENCY);
    if (overBudget()) {
      for (const h of chunk) {
        traces.push({
          address: h.owner,
          tokenAccount: h.tokenAccount || null,
          supplyPct: typeof h.pct === "number" ? h.pct : null,
          firstBuyAtMs: null,
          fundingSource: null,
          fundingChain: [h.owner],
          traced: false,
          traceNote: "scan time budget reached before this holder could be traced",
          devLinked: h.owner === creator || h.owner === mintAuthority,
          viaAmm: false,
        });
      }
      continue;
    }
    const done = await Promise.all(
      chunk.map((h) => traceHolder(h, mint, creator, mintAuthority, rpc).catch(() => ({
        address: h.owner,
        tokenAccount: h.tokenAccount || null,
        supplyPct: typeof h.pct === "number" ? h.pct : null,
        firstBuyAtMs: null,
        fundingSource: null,
        fundingChain: [h.owner],
        traced: false,
        traceNote: "trace failed (RPC error)",
        devLinked: h.owner === creator || h.owner === mintAuthority,
        viaAmm: false,
      }))),
    );
    traces.push(...done);
  }

  // Hop 2 — only for funders behind >= 2 traced holders (or a dev-linked one).
  const funderCounts = new Map();
  for (const t of traces) {
    if (t.fundingSource) funderCounts.set(t.fundingSource, (funderCounts.get(t.fundingSource) || 0) + 1);
  }
  const hop2Targets = [...funderCounts.entries()]
    .filter(([src, n]) => n >= 2 || traces.some((t) => t.fundingSource === src && t.devLinked))
    .map(([src]) => src)
    .slice(0, MAX_HOP2_SOURCES);
  const hop2 = new Map();
  for (const src of hop2Targets) {
    if (overBudget()) break;
    const hop = await hop2Funder(src, rpc).catch(() => null);
    if (hop && hop.source !== src) hop2.set(src, hop.source);
  }
  if (hop2.size) {
    for (const t of traces) {
      const h2 = t.fundingSource ? hop2.get(t.fundingSource) : null;
      if (h2 && !t.fundingChain.includes(h2)) t.fundingChain.push(h2);
    }
  }

  // Cluster: funding (hop 1) + window + funding via hop 2.
  let clusters = mergeClusters([
    ...clusterByFundingSource(traces),
    ...clusterByBuyWindow(traces),
  ]);
  if (hop2.size) {
    const hop2Traces = traces.map((t) => ({
      ...t,
      fundingSource: t.fundingChain[2] || null,
    }));
    const extra = clusterByFundingSource(hop2Traces).map((c) => ({
      ...c,
      id: `funding2:${c.fundingSource?.slice(0, 8) || "?"}`,
      evidence: `${c.evidence} (via intermediate wallets)`,
    }));
    clusters = mergeClusters([...clusters, ...extra]);
  }

  // Source-behind-other-launches (Helius DAS; null without a key).
  const distinctFunders = [...new Set(clusters.map((c) => c.fundingSource).filter(Boolean))];
  for (const src of distinctFunders) {
    const count = await countOtherLaunches(src, mint, fetchImpl);
    if (count == null) continue;
    for (const c of clusters) {
      if (c.fundingSource === src) {
        c.sourceOtherLaunches = count;
        c.sourceBehindOtherLaunches = count > 0;
      }
    }
  }

  const analysis = summarizeBundleAnalysis({
    mint,
    traces,
    holdersTotal: allHolders.length,
    topHoldersSupplyPct,
    creator,
    mintAuthority,
    creatorKnown,
  });
  // summarizeBundleAnalysis rebuilds clusters from traces; re-attach the
  // hop-2 + other-launches enrichment (it recomputes hop-1/window clusters
  // identically from the same traces).
  const enrichedById = new Map(clusters.map((c) => [c.id, c]));
  for (const c of analysis.clusters) {
    const enriched = enrichedById.get(c.id);
    if (enriched) {
      c.sourceBehindOtherLaunches = enriched.sourceBehindOtherLaunches;
      c.sourceOtherLaunches = enriched.sourceOtherLaunches;
    }
  }
  // Hop-2-only clusters are not rebuilt by the summarizer — append them.
  for (const c of clusters) {
    if (c.id.startsWith("funding2:") && !analysis.clusters.some((x) => x.id === c.id)) {
      analysis.clusters.push(c);
    }
  }
  analysis.clusters.sort((a, b) => b.supplyPct - a.supplyPct);
  analysis.clusterCount = analysis.clusters.length;
  const clusteredAddrs = new Set(analysis.clusters.flatMap((c) => c.members.map((m) => m.address)));
  analysis.bundledSupplyPct =
    analysis.state === "unknown"
      ? null
      : Math.round(traces.filter((t) => clusteredAddrs.has(t.address)).reduce((s, t) => s + (t.supplyPct || 0), 0) * 100) / 100;
  // Recompute risk with the enriched cluster set (hop-2 clusters included).
  if (analysis.state !== "unknown") {
    analysis.risk = bundleRiskFor(analysis.bundledSupplyPct, analysis.devLinkedPct);
  }

  cachePut(`bundle:${mint}`, analysis);
  recordBundleSnapshot(mint, analysis.bundledSupplyPct);
  return { analysis, cached: false };
}

// ── Team A (scanner v2): funding chain, dev history, same-dev, tape ───────
// Every hop / outcome here is observed on-chain or from a live API response.
// Missing data degrades to state "unknown"/"partial" with a reason — never a
// guessed hop, invented launch, or fabricated trade.

/** GET JSON with a hard timeout; null on any failure (caller degrades). */
async function fetchJson(url, fetchImpl, timeoutMs, init = {}) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: ctl.signal, ...init });
      if (!r.ok) return null;
      return await r.json().catch(() => null);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Multi-hop funding-chain walk (Solscan-style, server-side).
 * Given a dev/holder wallet, walks funding hops backwards — holder ->
 * funder -> funder's funder — up to FUNDING_CHAIN_MAX_HOPS (3) or until a
 * known exchange/DEX/pump.fun program. Each hop carries its evidence
 * (tx signature + SOL amount + time) and is only recorded when the SOL
 * receipt was actually observed in the oldest sampled transaction
 * (parseSolFundingHop is strict: no gain, no hop). Sequential hops with a
 * 30s budget so one deep wallet cannot eat the function timeout.
 *
 * @param {string} wallet
 * @param {Object} [opts] opts.rpc (method, params) => result; opts.now () => ms
 * @returns {Promise<{wallet, chain: string[], hops: {from,to,sig,amountSol,at,reachedGenesis}[], terminal: {kind,label,program?}|null, state: "complete"|"partial"|"unknown", reason: string|null}>}
 */
export async function walkFundingChain(wallet, opts = {}) {
  const rpc = opts.rpc || defaultRpc;
  const maxHops = opts.maxHops || FUNDING_CHAIN_MAX_HOPS;
  const now = opts.now || Date.now;
  const startedAt = now();
  const cacheKey = `chain:${wallet}`;
  const cached = cacheGet(cacheKey);
  if (cached && !opts.noCache) return cached;

  const chain = [wallet];
  const hops = [];
  let current = wallet;
  let terminal = null;
  let state = "complete";
  let reason = null;

  for (let hop = 0; hop < maxHops; hop += 1) {
    if (now() - startedAt > CHAIN_BUDGET_MS) {
      state = "partial";
      reason = "funding-chain walk hit its time budget — chain continues beyond the hops shown";
      break;
    }
    const oldest = await oldestSignature(current, rpc).catch(() => null);
    if (!oldest || !oldest.signature) {
      if (oldest?.empty) {
        terminal = { kind: "genesis", label: "no transactions observed for this wallet" };
      } else {
        state = "partial";
        reason = `signature history unreadable for ${current.slice(0, 8)}… — walk stopped here`;
      }
      break;
    }
    const tx = await withTimeout(
      rpc("getTransaction", [oldest.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]),
      HOLDER_TIMEOUT_MS,
      null,
    ).catch(() => null);
    if (!tx) {
      state = "partial";
      reason = `oldest transaction for ${current.slice(0, 8)}… could not be fetched — walk stopped here`;
      break;
    }
    const parsed = parseSolFundingHop(tx, current);
    if (!parsed) {
      terminal = {
        kind: "genesis",
        label: oldest.reachedGenesis
          ? "oldest transaction shows no SOL receipt — no earlier funder observed"
          : "oldest sampled transaction shows no SOL receipt — funding before the sampled window is unobserved",
      };
      break;
    }
    hops.push({
      from: current,
      to: parsed.source,
      sig: oldest.signature,
      amountSol: round6(parsed.amountSol),
      at: tx.blockTime ? tx.blockTime * 1000 : oldest.blockTime ? oldest.blockTime * 1000 : null,
      reachedGenesis: oldest.reachedGenesis,
    });
    chain.push(parsed.source);
    const kind = fundingEndpointKind(parsed.source);
    if (kind) {
      terminal = { kind: "program", label: `funded from ${kind} — chain terminates at a known program`, program: parsed.source };
      break;
    }
    current = parsed.source;
  }
  if (!terminal && hops.length >= maxHops) {
    terminal = { kind: "max-hops", label: `walk stopped after ${maxHops} hops — the chain continues beyond the walk depth` };
  }
  if (!terminal && hops.length === 0 && state === "complete") {
    terminal = { kind: "genesis", label: "no funding hop observed" };
  }
  if (hops.length === 0 && state === "complete" && !terminal) {
    state = "unknown";
    reason = reason || "no funding hop could be observed for this wallet";
  }
  const result = { wallet, chain, hops, terminal, state, reason };
  cachePut(cacheKey, result);
  return result;
}

/** Helius DAS getAssetsByCreator: fungible tokens created by `address`. */
async function getCreatedAssetsViaHelius(address, fetchImpl) {
  const key = heliusKey();
  if (!key || !address) return null;
  const j = await fetchJson(
    `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`,
    fetchImpl,
    8000,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dev-history-assets",
        method: "getAssetsByCreator",
        params: { creatorAddress: address, onlyVerified: false, page: 1, limit: 100 },
      }),
    },
  );
  const items = j?.result?.items;
  if (!Array.isArray(items)) return null;
  return items
    .filter((a) => a?.interface === "FungibleToken" || a?.interface === "FungibleAsset")
    .map((a) => ({
      mint: a?.id || null,
      name: a?.content?.metadata?.name || a?.content?.metadata?.symbol || null,
      launchedAt: null,
    }))
    .filter((t) => t.mint);
}

/** pump.fun coins created by a wallet (profile endpoint, best effort). */
async function getPumpCreatedCoins(address, fetchImpl) {
  const hosts = ["https://frontend-api-v3.pump.fun", "https://frontend-api.pump.fun"];
  for (const host of hosts) {
    const j = await fetchJson(
      `${host}/coins/user-created-coins/${address}?offset=0&limit=50&includeNsfw=false`,
      fetchImpl,
      6000,
    );
    if (Array.isArray(j)) {
      return j
        .map((c) => ({
          mint: c?.mint || null,
          name: c?.name || c?.symbol || null,
          launchedAt: typeof c?.created_timestamp === "number" ? c.created_timestamp : null,
        }))
        .filter((t) => t.mint);
    }
  }
  return null;
}

/** DexScreener token endpoint: pairs for one mint (array response). */
async function fetchDexTokenPairs(mint, fetchImpl) {
  const j = await fetchJson(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, fetchImpl, 8000);
  if (Array.isArray(j)) return j;
  if (Array.isArray(j?.pairs)) return j.pairs;
  return null;
}

function outcomeEvidence(outcome, pair) {
  if (outcome === "rugged") return "LP removed — pair liquidity is $0";
  if (outcome === "dead") return "no trades in 24h (volume $0)";
  if (outcome === "alive") {
    const liq = pair?.liquidity?.usd;
    const vol = pair?.volume?.h24;
    return `trading — liquidity ${typeof liq === "number" ? `$${Math.round(liq).toLocaleString()}` : "unknown"}, 24h volume ${typeof vol === "number" ? `$${Math.round(vol).toLocaleString()}` : "unknown"}`;
  }
  return "pair data unavailable — outcome cannot be determined";
}

/**
 * Dev history: tokens a source wallet launched, with an outcome each.
 * Sources (best effort, first that answers wins the list; both are merged
 * when available): Helius DAS getAssetsByCreator (needs HELIUS_API_KEY) and
 * pump.fun's user-created-coins endpoint. Each token is then classified by
 * live DexScreener pair data — "rugged" ONLY on observed LP removal
 * (liquidity $0 with a pair present); the -99%-from-ATH check cannot run
 * because DexScreener's token endpoint carries no ATH, so it is never
 * approximated. Unclassifiable tokens stay "unknown" with a reason.
 */
export async function fetchDevHistory(wallet, opts = {}) {
  const fetchImpl = opts.fetch || fetch;
  const cacheKey = `devhist:${wallet}`;
  const cached = cacheGet(cacheKey);
  if (cached && !opts.noCache) return cached;

  const [helius, pump] = await Promise.all([
    getCreatedAssetsViaHelius(wallet, fetchImpl).catch(() => null),
    getPumpCreatedCoins(wallet, fetchImpl).catch(() => null),
  ]);
  const byMint = new Map();
  for (const t of [...(helius || []), ...(pump || [])]) {
    if (!byMint.has(t.mint)) byMint.set(t.mint, t);
    else if (!byMint.get(t.mint).launchedAt && t.launchedAt) byMint.get(t.mint).launchedAt = t.launchedAt;
  }
  const created = [...byMint.values()].slice(0, DEV_HISTORY_MAX_TOKENS);
  const sources = { helius: helius != null, pump: pump != null };
  if (!created.length) {
    const result = {
      wallet,
      tokens: [],
      state: "unknown",
      reason:
        helius == null && pump == null
          ? "no launch source answered (Helius DAS needs HELIUS_API_KEY; pump.fun history unreachable) — dev history unknown, not empty"
          : "no tokens found for this wallet in the sources that answered",
      sources,
    };
    cachePut(cacheKey, result);
    return result;
  }

  const tokens = [];
  let failed = 0;
  for (const t of created) {
    const pairs = await fetchDexTokenPairs(t.mint, fetchImpl).catch(() => null);
    if (!pairs?.length) {
      failed += 1;
      tokens.push({ mint: t.mint, name: t.name, outcome: "unknown", launchedAt: t.launchedAt, evidence: outcomeEvidence("unknown", null) });
      continue;
    }
    const best = [...pairs].sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
    const txns = best?.txns?.h24;
    const outcome = classifyDevOutcome({
      pairExists: true,
      liquidityUsd: typeof best?.liquidity?.usd === "number" ? best.liquidity.usd : null,
      volume24h: typeof best?.volume?.h24 === "number" ? best.volume.h24 : null,
      txns24h: txns ? (txns.buys || 0) + (txns.sells || 0) : null,
    });
    tokens.push({
      mint: t.mint,
      name: t.name || best?.baseToken?.name || best?.baseToken?.symbol || null,
      outcome,
      launchedAt: t.launchedAt || (typeof best?.pairCreatedAt === "number" ? best.pairCreatedAt : null),
      evidence: outcomeEvidence(outcome, best),
    });
  }
  const result = {
    wallet,
    tokens,
    state: failed > 0 ? "partial" : "complete",
    reason: failed > 0 ? `${failed} of ${tokens.length} prior token(s) could not be classified (pair data unavailable)` : null,
    sources,
  };
  cachePut(cacheKey, result);
  return result;
}

/**
 * Same-dev detector: flag when a token's dev wallets trace (via the funding
 * chain) to a source wallet behind a prior rugged token. Walks the creator +
 * dev-linked wallets (cap 3), collects every wallet in their funding chains,
 * and checks dev history for each source (cap 5). Returns
 * { flagged, sourceWallet, priorTokens[] } — priorTokens are the rugged
 * priors only, each with the source wallet and the dev wallet it was reached
 * via. flagged is false (not unknown) only when at least one source's
 * history was actually checked and none had a rugged prior; when no history
 * could be checked at all the state is "unknown" and flagged stays false
 * with a reason saying so.
 */
export async function detectSameDev(mint, opts = {}) {
  const cacheKey = `samedev:${mint}`;
  const cached = cacheGet(cacheKey);
  if (cached && !opts.noCache) return cached;

  const { analysis } = await analyzeBundles(mint, opts);
  const devWallets = new Set();
  if (analysis.creator) devWallets.add(analysis.creator);
  for (const w of analysis.devLinkedWallets || []) if (w?.address) devWallets.add(w.address);
  for (const c of analysis.clusters || []) {
    if (c.devLinked && c.fundingSource) devWallets.add(c.fundingSource);
  }
  if (!devWallets.size) {
    const result = {
      flagged: false,
      sourceWallet: null,
      priorTokens: [],
      state: "unknown",
      reason: "no dev wallet could be attributed to this token (creator and dev-linked holders unknown) — same-dev cannot be checked",
    };
    cachePut(cacheKey, result);
    return result;
  }

  const sourceWallets = new Set();
  const viaBySource = new Map();
  for (const dw of [...devWallets].slice(0, SAME_DEV_MAX_WALLETS)) {
    const chainRes = await walkFundingChain(dw, opts).catch(() => null);
    if (!chainRes) continue;
    for (const w of chainRes.chain) {
      sourceWallets.add(w);
      if (!viaBySource.has(w)) viaBySource.set(w, dw);
    }
  }

  const priorTokens = [];
  let historyChecked = 0;
  let historyUnknown = 0;
  for (const src of [...sourceWallets].slice(0, SAME_DEV_MAX_SOURCES)) {
    const hist = await fetchDevHistory(src, opts).catch(() => null);
    if (!hist || hist.state === "unknown") {
      historyUnknown += 1;
      continue;
    }
    historyChecked += 1;
    for (const t of hist.tokens) {
      if (t.outcome === "rugged" && t.mint !== mint) {
        priorTokens.push({ ...t, sourceWallet: src, viaWallet: viaBySource.get(src) || src });
      }
    }
  }

  const flagged = priorTokens.length > 0;
  const result = {
    flagged,
    sourceWallet: flagged ? priorTokens[0].sourceWallet : null,
    priorTokens,
    state: historyChecked === 0 ? "unknown" : historyUnknown > 0 ? "partial" : "complete",
    reason:
      historyChecked === 0
        ? "dev history was unavailable for every source wallet in the funding chain — same-dev cannot be confirmed or ruled out"
        : historyUnknown > 0 && !flagged
          ? `${historyUnknown} source wallet(s) could not be history-checked — a rugged prior there would be missed`
          : null,
  };
  cachePut(cacheKey, result);
  return result;
}

/** Token-balance delta for one owner in a parsed tx (post minus pre). */
function tokenDeltaFor(tx, mint, owner) {
  const sum = (list) =>
    (list || [])
      .filter((b) => b.mint === mint && b.owner === owner)
      .reduce((s, b) => s + Number(b.uiTokenAmount?.uiAmount || 0), 0);
  return sum(tx?.meta?.postTokenBalances) - sum(tx?.meta?.preTokenBalances);
}

/**
 * Parse one pair transaction into a tape row. The fee payer is the trader
 * (direct swaps and Jupiter-routed swaps alike); their token-balance delta
 * for the mint gives side + size. A tx where the fee payer has no delta for
 * the mint is skipped, never guessed — the pool vault's equal-and-opposite
 * delta is not a trade by a wallet.
 */
function parseTapeTx(tx, mint, priceUsd) {
  if (!tx || tx.meta?.err || !Number.isFinite(priceUsd) || priceUsd <= 0) return null;
  const keys = (tx?.transaction?.message?.accountKeys || []).map((k) =>
    typeof k === "string" ? k : k?.pubkey,
  );
  const feePayer = keys[0];
  if (!feePayer) return null;
  const delta = tokenDeltaFor(tx, mint, feePayer);
  if (!delta || !Number.isFinite(delta)) return null;
  return {
    time: tx.blockTime ? tx.blockTime * 1000 : null,
    priceUsd,
    sizeUsd: Math.round(Math.abs(delta) * priceUsd * 100) / 100,
    side: delta > 0 ? "buy" : "sell",
    wallet: feePayer,
  };
}

/**
 * Live trade tape: the most recent swaps on the token's deepest-liquidity
 * DexScreener pair, read off-chain from the pair's signature history and
 * parsed from token-balance deltas (no invented trades). Whale alerts are
 * the tape rows at/above WHALE_ALERT_MIN_USD ($5,000). When no pair, price,
 * or parseable swap exists the tape is null with a reason — an empty tape
 * is never reported as "no trading".
 */
export async function fetchTradeTape(mint, opts = {}) {
  const rpc = opts.rpc || defaultRpc;
  const fetchImpl = opts.fetch || fetch;
  const cacheKey = `tape:${mint}`;
  const cached = cacheGet(cacheKey);
  if (cached && !opts.noCache) return cached;

  const finish = (result) => {
    cachePut(cacheKey, result);
    return result;
  };
  const pairs = await fetchDexTokenPairs(mint, fetchImpl).catch(() => null);
  if (!pairs?.length) {
    return finish({
      mint,
      pairAddress: null,
      priceUsd: null,
      tape: null,
      whaleAlerts: null,
      state: "unknown",
      reason: "no DexScreener pair found for this mint — no trade tape source",
    });
  }
  const best = [...pairs].sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0];
  const pairAddress = best?.pairAddress || null;
  const priceUsd = typeof best?.priceUsd === "number" ? best.priceUsd : Number(best?.priceUsd) || null;
  if (!pairAddress || !priceUsd) {
    return finish({
      mint,
      pairAddress,
      priceUsd,
      tape: null,
      whaleAlerts: null,
      state: "unknown",
      reason: "deepest pair has no address or no USD price — trades cannot be sized",
    });
  }
  const sigs = await withTimeout(
    rpc("getSignaturesForAddress", [pairAddress, { limit: 20 }]),
    8000,
    null,
  ).catch(() => null);
  if (!Array.isArray(sigs) || !sigs.length) {
    return finish({
      mint,
      pairAddress,
      priceUsd,
      tape: null,
      whaleAlerts: null,
      state: "unknown",
      reason: "pair signature history unreadable (RPC failed) — tape unavailable",
    });
  }
  const tape = [];
  for (let i = 0; i < sigs.length; i += HOLDER_CONCURRENCY) {
    const chunk = sigs.slice(i, i + HOLDER_CONCURRENCY);
    const done = await Promise.all(
      chunk.map((s) =>
        withTimeout(
          rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]),
          HOLDER_TIMEOUT_MS,
          null,
        ).catch(() => null),
      ),
    );
    for (const tx of done) {
      const row = parseTapeTx(tx, mint, priceUsd);
      if (row) tape.push(row);
    }
    if (tape.length >= TAPE_MAX_TRADES) break;
  }
  tape.sort((a, b) => (b.time || 0) - (a.time || 0));
  const trimmed = tape.slice(0, TAPE_MAX_TRADES);
  if (!trimmed.length) {
    return finish({
      mint,
      pairAddress,
      priceUsd,
      tape: null,
      whaleAlerts: null,
      state: "unknown",
      reason: "recent pair transactions could not be parsed as swaps — tape unavailable, not empty",
    });
  }
  const whaleAlerts = trimmed
    .filter((t) => t.sizeUsd >= WHALE_ALERT_MIN_USD)
    .map((t) => ({ wallet: t.wallet, amountUsd: t.sizeUsd, side: t.side, time: t.time }))
    .slice(0, 10);
  return finish({
    mint,
    pairAddress,
    priceUsd,
    tape: trimmed,
    whaleAlerts,
    state: "complete",
    reason: null,
  });
}

/**
 * Live risk score: recompute from the intel available right now (bundle +
 * same-dev + tape). Each call re-gathers the inputs — the score moves as
 * new intel arrives instead of freezing at first paint. Pure scoring lives
 * in computeLiveRisk (shared/bundle-analysis.js); this only assembles inputs.
 */
export async function assembleRiskLive(mint, opts = {}) {
  const [bundleRes, sameDevRes, tapeRes] = await Promise.allSettled([
    analyzeBundles(mint, opts),
    detectSameDev(mint, opts),
    fetchTradeTape(mint, opts),
  ]);
  const bundle = bundleRes.status === "fulfilled" ? bundleRes.value.analysis : null;
  const sameDev = sameDevRes.status === "fulfilled" ? sameDevRes.value : null;
  const tape = tapeRes.status === "fulfilled" ? tapeRes.value : null;
  const whales = Array.isArray(tape?.whaleAlerts) ? tape.whaleAlerts : [];
  const whaleSellUsd = whales.filter((w) => w.side === "sell").reduce((s, w) => s + (w.amountUsd || 0), 0);
  const whaleBuyUsd = whales.filter((w) => w.side === "buy").reduce((s, w) => s + (w.amountUsd || 0), 0);
  const { score, factors } = computeLiveRisk({
    bundledSupplyPct: bundle?.bundledSupplyPct ?? null,
    devLinkedPct: bundle?.devLinkedPct ?? null,
    sameDevFlagged: sameDev ? sameDev.flagged : undefined,
    ruggedPriorCount: sameDev?.priorTokens?.length ?? 0,
    whaleSellUsd: whales.length ? whaleSellUsd : null,
    whaleBuyUsd: whales.length ? whaleBuyUsd : null,
  });
  return {
    score,
    updatedAt: new Date().toISOString(),
    factors,
    inputs: {
      bundleState: bundle?.state ?? null,
      sameDevState: sameDev?.state ?? null,
      tapeState: tape?.state ?? null,
    },
  };
}

// ── Team A wave 3 (B6): deep intel — Jupiter sells, RugCheck, Token-2022,
// GeckoTerminal volatility/charts, LP drain, wallet ages, holder overlap ─────
// Every sub-result degrades independently to null + reason (assembleDeepIntel
// uses allSettled). Nothing is fabricated: a failed quote is a null sell sim
// with a reason, not a modelled guess.

/** SOL price in USD via a live Jupiter lite quote (1 SOL → USDC). */
async function fetchSolPriceUsd(fetchImpl) {
  const q = await fetchJson(
    `${JUP_LITE_QUOTE}?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=1000000000&slippageBps=50`,
    fetchImpl,
    8000,
  );
  const out = Number(q?.outAmount);
  if (!Number.isFinite(out) || out <= 0) return null;
  return out / 1e6;
}

/** One real Jupiter lite sell quote: token → SOL. Returns SOL received. */
async function jupiterSellQuote(mint, amountBase, fetchImpl) {
  const q = await fetchJson(
    `${JUP_LITE_QUOTE}?inputMint=${encodeURIComponent(mint)}&outputMint=${SOL_MINT}&amount=${amountBase}&slippageBps=50`,
    fetchImpl,
    8000,
  );
  const out = Number(q?.outAmount);
  if (!Number.isFinite(out) || out <= 0) return null;
  return out / 1e9;
}

/**
 * Exit liquidity — REAL Jupiter lite quotes for selling the token, plus
 * CPAMM depth thresholds for price drops. Sell sizes: 1 SOL worth, 5 SOL
 * worth, 10% of supply. Unknown = nulls with a reason (no quote, no price,
 * no depth), never a modelled number presented as a quote.
 */
export async function fetchExitLiquidity(mint, opts = {}) {
  const rpc = opts.rpc || defaultRpc;
  const fetchImpl = opts.fetch || fetch;
  const model =
    "sell sims: live Jupiter lite-api quotes (token → SOL, 50bps slippage); drop thresholds: constant-product, size = (liquidity/2) * d / (1 - d)";
  const nullOut = (reason) => ({
    sell1Sol: null,
    sell5Sol: null,
    sell10PctSupply: null,
    drop10PctUsd: null,
    drop25PctUsd: null,
    drop50PctUsd: null,
    model,
    reason,
  });
  const [mintInfo, supplyRes, pairs, solPrice] = await Promise.all([
    withTimeout(rpc("getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }]), 15000, null).catch(() => null),
    withTimeout(rpc("getTokenSupply", [mint]), 15000, null).catch(() => null),
    fetchDexTokenPairs(mint, fetchImpl),
    fetchSolPriceUsd(fetchImpl),
  ]);
  let decimals = mintInfo?.value?.data?.parsed?.info?.decimals;
  if (!Number.isFinite(decimals)) {
    // Fallback: RugCheck's report carries the mint decimals (keyless, live).
    // The RPC path is flaky from some egresses; the quote still needs real
    // decimals, so a second source is used rather than guessing 6/9.
    const rug = await fetchJson(`${RUGCHECK_REPORT}/${encodeURIComponent(mint)}/report`, fetchImpl, 8000);
    const d = Number(rug?.token?.decimals);
    if (Number.isFinite(d)) decimals = d;
  }
  const supplyRaw = Number(supplyRes?.value?.amount);
  const solPairs = Array.isArray(pairs) ? pairs.filter((p) => p?.chainId === "solana") : [];
  const deepest = solPairs.sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0] || null;
  const priceUsd = Number(deepest?.priceUsd);
  const liquidityUsd = Number(deepest?.liquidity?.usd);
  if (!Number.isFinite(decimals) || !Number.isFinite(priceUsd) || priceUsd <= 0 || !Number.isFinite(solPrice) || solPrice <= 0) {
    return nullOut("exit-liquidity needs token decimals, a DexScreener price and a live SOL price — one of them was unreadable");
  }
  const tokenAmountForUsd = (usd) => Math.floor((usd / priceUsd) * 10 ** decimals);
  const quoteSell = async (usdWorth) => {
    const amountBase = tokenAmountForUsd(usdWorth);
    if (!(amountBase > 0)) return null;
    // One retry: the lite quote endpoint occasionally drops a single
    // parallel quote while its siblings succeed.
    let solOut = await jupiterSellQuote(mint, amountBase, fetchImpl);
    if (solOut == null) solOut = await jupiterSellQuote(mint, amountBase, fetchImpl);
    if (solOut == null) return null;
    const receivedUsd = Math.round(solOut * solPrice * 100) / 100;
    const slippagePct = Math.round(((usdWorth - receivedUsd) / usdWorth) * 10000) / 100;
    return { receivedUsd, slippagePct };
  };
  const [sell1Sol, sell5Sol] = await Promise.all([quoteSell(solPrice), quoteSell(solPrice * 5)]);
  let sell10PctSupply = null;
  if (Number.isFinite(supplyRaw) && supplyRaw > 0) {
    sell10PctSupply = await quoteSell(0.1 * (supplyRaw / 10 ** decimals) * priceUsd);
  }
  const drop10PctUsd = usdToDropPricePct(liquidityUsd, 10);
  const drop25PctUsd = usdToDropPricePct(liquidityUsd, 25);
  const drop50PctUsd = usdToDropPricePct(liquidityUsd, 50);
  const reason =
    sell1Sol == null && sell5Sol == null
      ? "Jupiter returned no sell route for this token — exit quotes unavailable, not zero"
      : sell10PctSupply == null
        ? "10%-of-supply sell had no Jupiter route (size too large or no liquidity path)"
        : null;
  return { sell1Sol, sell5Sol, sell10PctSupply, drop10PctUsd, drop25PctUsd, drop50PctUsd, model, reason };
}

/**
 * RugCheck report — the API is keyless and live (verified 2026-11-08).
 * score is RugCheck's normalised score; warnings are its risk names.
 * Any fetch failure → null + reason, never a fabricated score.
 */
export async function fetchRugCheck(mint, opts = {}) {
  const fetchImpl = opts.fetch || fetch;
  const report = await fetchJson(`${RUGCHECK_REPORT}/${encodeURIComponent(mint)}/report`, fetchImpl, 8000);
  if (!report || typeof report !== "object") {
    return { score: null, warnings: [], reportUrl: `https://rugcheck.xyz/tokens/${mint}`, source: "rugcheck", reason: "RugCheck API unreachable or returned no report" };
  }
  const scoreRaw = report.score_normalised ?? report.score ?? null;
  const score = typeof scoreRaw === "number" && Number.isFinite(scoreRaw) ? scoreRaw : null;
  const warnings = Array.isArray(report.risks)
    ? report.risks.slice(0, 20).map((r) => (r?.description ? `${r.name} — ${r.description}` : String(r?.name || "unnamed risk")))
    : [];
  if (report.rugged === true) warnings.unshift("RugCheck flags this token as rugged");
  return {
    score,
    warnings,
    reportUrl: `https://rugcheck.xyz/tokens/${mint}`,
    source: "rugcheck",
    reason: score == null ? "RugCheck returned a report with no score" : null,
  };
}

/** Token-2022 extension name → risk. Transfer fees / permanent delegate /
 *  confidential transfers can trap or tax sellers; a metadata pointer is
 *  informational. Unknown extensions default to medium — an unrecognised
 *  program hook is not assumed safe. */
const TOKEN2022_EXTENSION_RISK = {
  transferFeeConfig: "medium",
  transferFee: "medium",
  permanentDelegate: "high",
  transferHook: "medium",
  confidentialTransferMint: "high",
  confidentialTransferFeeConfig: "medium",
  metadataPointer: "low",
  mintCloseAuthority: "medium",
  interestBearingMint: "low",
  nonTransferable: "high",
  defaultAccountState: "low",
  groupPointer: "low",
  groupMemberPointer: "low",
  tokenMetadata: "low",
};

/**
 * Token-2022 check via RPC getAccountInfo (jsonParsed). isToken2022 is
 * decided by the account owner program id — never guessed from the mint.
 * Extensions come from the parsed mint account when the RPC returns them;
 * a Token-2022 mint with no extensions field reports extensions [].
 */
export async function fetchToken2022(mint, opts = {}) {
  const rpc = opts.rpc || defaultRpc;
  const info = await withTimeout(
    rpc("getAccountInfo", [mint, { encoding: "jsonParsed", commitment: "confirmed" }]),
    8000,
    null,
  ).catch(() => null);
  const value = info?.value;
  if (!value) {
    return { isToken2022: null, extensions: [], reason: "mint account unreadable — program owner unknown" };
  }
  const isToken2022 = value.owner === TOKEN_2022_PROGRAM_ID;
  const rawExts = value?.data?.parsed?.info?.extensions;
  const extensions = Array.isArray(rawExts)
    ? rawExts.map((e) => {
        const name = typeof e === "string" ? e : String(e?.extension || e?.type || "unknown");
        return {
          name,
          risk: TOKEN2022_EXTENSION_RISK[name] ?? "medium",
          detail: `Token-2022 extension present on the mint account${name === "permanentDelegate" ? " — a permanent delegate can transfer or freeze any holder's tokens" : name === "transferFeeConfig" ? " — transfers can be taxed up to the configured fee" : name === "nonTransferable" ? " — tokens cannot be transferred at all" : ""}`,
        };
      })
    : [];
  return {
    isToken2022,
    extensions,
    reason: isToken2022 ? null : "standard SPL Token program (Tokenkeg) — no Token-2022 extensions apply",
  };
}

/** GeckoTerminal OHLCV list → {open, high, low, close, at} candles. */
function parseGeckoCandles(j) {
  const list = j?.data?.attributes?.ohlcv_list;
  if (!Array.isArray(list)) return null;
  return list
    .map((row) => {
      if (!Array.isArray(row) || row.length < 5) return null;
      const [ts, open, high, low, close] = row.map(Number);
      if (![ts, open, high, low, close].every((v) => Number.isFinite(v))) return null;
      return { open, high, low, close, at: ts * 1000 };
    })
    .filter(Boolean);
}

/**
 * Volatility + chart patterns from real GeckoTerminal candles for the
 * deepest-liquidity pair. 24h volatility uses hourly candles, 7d uses daily
 * candles; patterns use the daily candles. No pair / no candles → nulls
 * with a reason.
 */
export async function fetchVolatilityAndChart(mint, opts = {}) {
  const fetchImpl = opts.fetch || fetch;
  const pairs = await fetchDexTokenPairs(mint, fetchImpl);
  const solPairs = Array.isArray(pairs) ? pairs.filter((p) => p?.chainId === "solana") : [];
  const deepest = solPairs.sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0] || null;
  const pairAddress = deepest?.pairAddress;
  if (!pairAddress) {
    return {
      volatility: { volatilityPct24h: null, volatilityPct7d: null, source: "GeckoTerminal OHLCV candles (range / mean close, not annualised)" },
      chartPatterns: [],
      pairAddress: null,
      reason: "no DexScreener pair found — no pool to fetch candles for",
    };
  }
  const [hourJ, dayJ] = await Promise.all([
    fetchJson(`${GECKO_OHLCV}/${pairAddress}/ohlcv/hour?aggregate=1&limit=24`, fetchImpl, 8000),
    fetchJson(`${GECKO_OHLCV}/${pairAddress}/ohlcv/day?aggregate=1&limit=30`, fetchImpl, 8000),
  ]);
  const hourCandles = parseGeckoCandles(hourJ);
  const dayCandles = parseGeckoCandles(dayJ);
  if (!hourCandles?.length && !dayCandles?.length) {
    return {
      volatility: { volatilityPct24h: null, volatilityPct7d: null, source: "GeckoTerminal OHLCV candles (range / mean close, not annualised)" },
      chartPatterns: [],
      pairAddress,
      reason: "GeckoTerminal returned no candles for this pool",
    };
  }
  const vol = volatilityFromCandles(hourCandles, dayCandles);
  return {
    volatility: vol,
    chartPatterns: detectChartPatterns(dayCandles),
    pairAddress,
    reason: null,
  };
}

/**
 * LP drain: current depth is observable (DexScreener); 1h/24h-ago depth is
 * NOT — no LP-history source exists in this stack, so those fields are
 * null with a reason rather than back-filled from price history.
 */
export async function fetchLpDrain(mint, opts = {}) {
  const fetchImpl = opts.fetch || fetch;
  const pairs = await fetchDexTokenPairs(mint, fetchImpl);
  const solPairs = Array.isArray(pairs) ? pairs.filter((p) => p?.chainId === "solana") : [];
  const deepest = solPairs.sort((a, b) => (b?.liquidity?.usd || 0) - (a?.liquidity?.usd || 0))[0] || null;
  const lpUsdNow = Number(deepest?.liquidity?.usd);
  return {
    lpUsdNow: Number.isFinite(lpUsdNow) ? lpUsdNow : null,
    lpUsd1hAgo: null,
    lpUsd24hAgo: null,
    dropPct: null,
    removed: null,
    lastCheckedAt: new Date().toISOString(),
    reason: "no LP history source — only current depth is observable; past depth cannot be reconstructed from price data",
  };
}

/**
 * Wallet ages: first-seen = oldest *sampled* signature (max 2 pages x
 * 1000 sigs — a wallet with > 2000 txs reports its oldest sampled tx, not
 * true genesis; the label still holds because sampled-first-seen is a
 * lower bound on age). Fresh wallet = no transactions at all → label
 * "fresh" only when ageDays is known < 30; empty history → firstSeenAt
 * null, label "unknown".
 */
export async function fetchWalletAges(wallets, opts = {}) {
  const rpc = opts.rpc || defaultRpc;
  const list = [...new Set((wallets || []).filter((w) => MINT_RE.test(w)))].slice(0, 10);
  const out = await Promise.all(
    list.map(async (wallet) => {
      const oldest = await withTimeout(oldestSignature(wallet, rpc), HOLDER_TIMEOUT_MS, null).catch(() => null);
      const firstSeenAt = oldest?.blockTime ? oldest.blockTime * 1000 : null;
      const ageDays = firstSeenAt ? Math.floor((Date.now() - firstSeenAt) / 86_400_000) : null;
      return { wallet, firstSeenAt, ageDays, label: walletAgeLabel(ageDays) };
    }),
  );
  return { wallets: out, reason: out.length ? null : "no valid wallets supplied" };
}

/**
 * Holder overlap: for each of the top holders (max 5), read their SPL
 * token accounts and list their other holdings (excluding the scanned
 * mint). Symbol via DexScreener per mint (capped). pctOfWallet stays null
 * — a share of wallet needs USD values for every holding plus SOL, which
 * this route does not price. A wallet whose accounts are unreadable gets
 * otherHoldings: null (unreadable = null, per spec), not an empty list.
 */
export async function fetchHolderOverlap(mint, wallets, opts = {}) {
  const rpc = opts.rpc || defaultRpc;
  const fetchImpl = opts.fetch || fetch;
  const list = [...new Set((wallets || []).filter((w) => MINT_RE.test(w)))].slice(0, 5);
  const results = [];
  for (const wallet of list) {
    const accounts = await withTimeout(
      rpc("getTokenAccountsByOwner", [wallet, { programId: TOKEN_PROGRAM_ID }, { encoding: "jsonParsed" }]),
      HOLDER_TIMEOUT_MS,
      null,
    ).catch(() => null);
    const parsed = accounts?.value;
    if (!Array.isArray(parsed)) {
      results.push({ wallet, otherHoldings: null });
      continue;
    }
    const others = [];
    for (const acc of parsed) {
      const info = acc?.account?.data?.parsed?.info;
      const otherMint = info?.mint;
      const amount = Number(info?.tokenAmount?.uiAmount);
      if (!otherMint || otherMint === mint || !(amount > 0)) continue;
      others.push({ mint: otherMint, uiAmount: amount });
      if (others.length >= 5) break;
    }
    const otherHoldings = [];
    for (const o of others) {
      const pairs = await fetchDexTokenPairs(o.mint, fetchImpl);
      const symbol = Array.isArray(pairs) && pairs[0]?.baseToken?.symbol ? String(pairs[0].baseToken.symbol) : null;
      otherHoldings.push({ mint: o.mint, symbol, pctOfWallet: null });
    }
    results.push({ wallet, otherHoldings });
  }
  if (!results.length) return null;
  if (results.every((r) => r.otherHoldings === null)) {
    return { wallets: results, reason: "holder token accounts unreadable — overlap unknown" };
  }
  return { wallets: results, reason: null };
}

/** Bundle decay: snapshots recorded by each fresh bundle scan. */
export function fetchBundleDecay(mint) {
  const now = Date.now();
  const snapshots = ((decaySnapshots.get(mint) || []).filter((s) => now - s.at < 86_400_000)).map((s) => ({ at: s.at, bundledPct: s.bundledPct }));
  return { snapshots, trend: bundleDecayTrend(snapshots) };
}

/** Deep intel in one call: exit-liquidity + RugCheck + Token-2022 +
 *  volatility/chart + LP drain, each independently null-safe. */
export async function assembleDeepIntel(mint, opts = {}) {
  const [exitRes, rugRes, t22Res, volRes, drainRes] = await Promise.allSettled([
    fetchExitLiquidity(mint, opts),
    fetchRugCheck(mint, opts),
    fetchToken2022(mint, opts),
    fetchVolatilityAndChart(mint, opts),
    fetchLpDrain(mint, opts),
  ]);
  const pick = (r) => (r.status === "fulfilled" ? r.value : null);
  return {
    mint,
    exitLiquidity: pick(exitRes),
    rugCheck: pick(rugRes),
    token2022Extensions: pick(t22Res),
    volatility: pick(volRes)?.volatility ?? null,
    chartPatterns: pick(volRes)?.chartPatterns ?? [],
    lpDrain: pick(drainRes),
    checkedAt: new Date().toISOString(),
  };
}

export { ORBITX_MINT };

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "GET only" }));
  }
  const params = new URL(req.url || "", "http://x").searchParams;
  const qp = (name) => String(req.query?.[name] ?? params.get(name) ?? "").trim();
  // Actions (all served by this one route — no new serverless function):
  //   (default)  ?mint=            bundle scan
  //   chain      ?wallet=          multi-hop funding-chain walk
  //   dev-history ?wallet=         tokens a source wallet launched + outcomes
  //   same-dev   ?mint=            dev traces to a source behind a rugged prior
  //   tape       ?mint=            live trade tape + whale alerts
  //   risk-live  ?mint=            live risk score recomputed from current intel
  const action = qp("action") || "bundle";
  try {
    if (action === "chain" || action === "dev-history") {
      const wallet = qp("wallet");
      if (!MINT_RE.test(wallet)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: "Valid wallet address required." }));
      }
      const out = action === "chain" ? await walkFundingChain(wallet) : await fetchDevHistory(wallet);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, action, ...out }));
    }
    if (action === "wallet-ages" || action === "holder-overlap") {
      const wallets = qp("wallets").split(",").map((w) => w.trim()).filter(Boolean);
      if (!wallets.length || !wallets.every((w) => MINT_RE.test(w))) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: "wallets query param required (comma-separated valid addresses)." }));
      }
      if (action === "wallet-ages") {
        const out = await fetchWalletAges(wallets);
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true, action, ...out }));
      }
      const mint = qp("mint");
      if (!MINT_RE.test(mint)) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, error: "Valid token mint required." }));
      }
      const out = await fetchHolderOverlap(mint, wallets);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, action, ...(out ?? { wallets: [], reason: "holder overlap unavailable" }) }));
    }
    const mint = qp("mint");
    if (!MINT_RE.test(mint)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: "Valid token mint required." }));
    }
    if (action === "same-dev") {
      const out = await detectSameDev(mint);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, action, ...out }));
    }
    if (action === "tape") {
      const out = await fetchTradeTape(mint);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, action, ...out }));
    }
    if (action === "risk-live") {
      const riskLive = await assembleRiskLive(mint);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, action, riskLive }));
    }
    if (action === "deep-intel") {
      const deepIntel = await assembleDeepIntel(mint);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, action, deepIntel }));
    }
    if (action === "bundle-decay") {
      const out = fetchBundleDecay(mint);
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, action, ...out }));
    }
    if (action !== "bundle") {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }));
    }
    const { analysis, cached } = await analyzeBundles(mint);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, analysis, cached }));
  } catch (e) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "bundle scan failed" }));
  }
}
