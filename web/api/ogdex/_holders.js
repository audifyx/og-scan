// Resilient top-holder fetch for OG DEX. Helius getTokenLargestAccounts is the
// only efficient "top N" source but its account-index service intermittently
// returns -32603 "overloaded" (esp. for tokens with millions of accounts) and
// rpc-proxy can cold-start slowly. So we: retry with backoff, resolve owners
// (token account -> wallet), classify pool vaults by the program that owns
// the owner account, bound every call with a timeout, and keep a
// last-known-good copy in KV so a transient failure never blanks the UI.
//
// Liquidity pools are NOT holders: a pool vault's owner account is owned by
// an AMM program (Raydium / Orca / PumpSwap / pump.fun), while a real
// wallet's account is owned by the System Program. Pool rows are labeled
// "liquidity pool" (isPool) and excluded from holder-distribution math;
// other program-owned owners are labeled "program vault", not mislabeled
// as LPs and not counted as regular holders.
//
// NOTE: public RPCs cannot substitute for Helius here — their
// getTokenLargestAccounts returns empty / 429s, so there is no live
// fallback when rpc-proxy is down; the KV cache is the fallback.
import { SUPA_FN, ANON, kvGet, kvPut } from "./_lib.js";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// AMM program ids — every one verified, none guessed:
// Raydium CLMM / Orca Whirlpool / PumpSwap from live pool-account owners;
// pump.fun + Raydium AMM v4 from multi-source docs + on-chain executable check.
export const AMM_PROGRAMS = new Set([
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // pump.fun bonding curve
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // PumpSwap
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mb", // Raydium AMM v4
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Orca Whirlpool
]);
const SYSTEM_PROGRAM = "11111111111111111111111111111111";

// "liquidity pool" | "program vault" | null (real wallet / unknown).
export function poolKindFor(ownerProgram) {
  if (!ownerProgram) return null;
  if (AMM_PROGRAMS.has(ownerProgram)) return "liquidity pool";
  if (ownerProgram !== SYSTEM_PROGRAM) return "program vault";
  return null;
}

// Single JSON-RPC call through the Helius-backed rpc-proxy, with a hard timeout.
async function rpc(method, params, timeout = 9000) {
  const ctl = new AbortController();
  const id = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(`${SUPA_FN}/rpc-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params, provider: "helius" }),
      signal: ctl.signal,
    });
    const j = await res.json().catch(() => null);
    if (j?.data?.error || j?.error) return { result: null, error: j?.data?.error?.message || j?.error?.message || "rpc error" };
    return { result: j?.data?.result ?? j?.result ?? null, error: null };
  } catch (e) {
    return { result: null, error: String(e?.message || e) };
  } finally { clearTimeout(id); }
}

// getTokenLargestAccounts with retry — the index service often recovers on retry.
async function largestAccounts(mint, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const { result, error } = await rpc("getTokenLargestAccounts", [mint], 8000);
    if (result?.value?.length) return result.value;
    // Mega tokens (millions of accounts) get a persistent "index overloaded" /
    // "too many accounts" error that won't clear within this request — give it
    // one quick retry then bail so we don't burn the whole function timeout.
    const overloaded = error && /overload|too many accounts/i.test(error);
    if (overloaded && i >= 1) return null;
    if (i < attempts - 1) await sleep(400 * (i + 1));
  }
  return null;
}

// Resolve token-account pubkeys -> owner wallets via getMultipleAccounts.
async function resolveOwners(tokenAccounts) {
  const out = {};
  if (!tokenAccounts.length) return out;
  const { result } = await rpc("getMultipleAccounts", [tokenAccounts, { encoding: "jsonParsed" }], 8000);
  (result?.value || []).forEach((acc, i) => {
    const owner = acc?.data?.parsed?.info?.owner;
    if (owner) out[tokenAccounts[i]] = owner;
  });
  return out;
}

// Owner wallet -> program that owns that account. System Program = real
// wallet; AMM program = pool vault; anything else = program vault.
// Returns {} on failure — callers treat unknown owners as normal holders.
export async function classifyHolderOwners(ownerAddresses) {
  const uniq = [...new Set((ownerAddresses || []).filter(Boolean))];
  const out = {};
  if (!uniq.length) return out;
  try {
    const { result } = await rpc("getMultipleAccounts", [uniq, { encoding: "jsonParsed" }], 8000);
    (result?.value || []).forEach((acc, i) => {
      if (acc?.owner) out[uniq[i]] = acc.owner;
    });
  } catch { /* unknown owners stay unclassified */ }
  return out;
}

function labelFor(pct) {
  if (pct == null) return "holder";
  if (pct >= 1) return "whale";
  if (pct >= 0.5) return "large holder";
  return "holder";
}

// Live fetch: largest accounts -> supply -> owners -> owner programs -> rows.
// Returns [] on failure.
async function fetchHoldersLive(mint, price, limit = 20) {
  const accts = await largestAccounts(mint);
  if (!accts?.length) return [];
  const top = accts.slice(0, limit);
  const supplyRes = await rpc("getTokenSupply", [mint], 6000);
  const total = num(supplyRes.result?.value?.uiAmount) || top.reduce((s, a) => s + (num(a.uiAmount) || 0), 0) || 0;
  const owners = await resolveOwners(top.map((a) => a.address));
  const ownerPrograms = await classifyHolderOwners(Object.values(owners));
  return top.map((a, i) => {
    const amt = num(a.uiAmount) || 0;
    const pct = total ? (amt / total) * 100 : null;
    const owner = owners[a.address] || a.address;
    const ownerProgram = ownerPrograms[owner] || null;
    const kind = poolKindFor(ownerProgram);
    const isPool = kind === "liquidity pool";
    return {
      rank: i + 1,
      owner,
      tokenAccount: a.address,
      uiAmount: amt,
      pct,
      usdValue: price != null ? amt * price : null,
      label: isPool ? "liquidity pool" : kind === "program vault" ? "program vault" : labelFor(pct),
      ...(isPool ? { isPool: true, poolProgram: ownerProgram } : {}),
      ...(kind === "program vault" ? { isProgramVault: true, vaultProgram: ownerProgram } : {}),
    };
  });
}

// Public: resilient labeled holders with last-known-good fallback.
// Returns { holders: [...], pools: [...], source: "live"|"cache"|"none", stale: bool }.
// Pools stay IN holders (marked isPool) so the list shows them correctly,
// and are ALSO split out in `pools` for distribution math.
export async function getLabeledHolders(mint, price = null, limit = 20) {
  const live = await fetchHoldersLive(mint, price, limit).catch(() => []);
  if (live.length) {
    const pools = live.filter((h) => h.isPool);
    kvPut(`holders/${mint}.json`, { ts: Date.now(), holders: live, pools }).catch(() => {});
    return { holders: live, pools, source: "live", stale: false };
  }
  const cached = await kvGet(`holders/${mint}.json`).catch(() => null);
  if (cached?.holders?.length) {
    const holders = cached.holders.map((h) => ({ ...h, usdValue: price != null ? (num(h.uiAmount) || 0) * price : h.usdValue, stale: true }));
    return { holders, pools: holders.filter((h) => h.isPool), source: "cache", stale: true };
  }
  return { holders: [], pools: [], source: "none", stale: false };
}
