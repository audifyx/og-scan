// OG DEX — wallet balance for the trade panel: SOL balance + a specific token's
// holding (so sells are based on what the user actually holds).
//
// ROOT CAUSE (fixed here): this route called callFn("rpc-proxy") DIRECTLY.
// When the proxy is down/rejects the method, rpc() returned null and the
// handler reported sol: 0 / token 0 with ok: true — a silent zero. The
// wallet route already used the resilient path; this one never migrated.
// Fix: resilientRpcDetailed (proxy -> public RPC fallback) + ATA derivation
// for the requested mint (getTokenAccountsByOwner is indexed-blocked on
// every path) + explicit degraded/complete flags. A failed fetch is an
// error, never a zero.
import { send, resilientRpcDetailed, cache } from "../_lib.js";
import { ataHoldings, lamportsToSol } from "../_txscan.js";

const isPubkey = (v) => typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);

/**
 * Pure response builder (unit-tested): null balance = fetch failed -> error,
 * never 0. `tokenState` is { uiAmount, decimals, raw } or null when unknown.
 */
export function buildBalanceResponse({ owner, bal, balSource, tokenState, tokenSource, degradedSources }) {
  const retrievedAt = new Date().toISOString();
  if (bal == null) {
    return {
      ok: false,
      error: "sol_balance_unavailable",
      message: "SOL balance could not be retrieved from any RPC — not zero, unknown.",
      owner,
      sol: null,
      token: tokenState ?? null,
      degraded: true,
      degradedSources: [...new Set([...(degradedSources || []), "balance"])],
      source: balSource || null,
      tokenSource: tokenSource || null,
      retrievedAt,
    };
  }
  const sol = lamportsToSol(typeof bal === "number" ? bal : bal.value || 0);
  return {
    ok: true,
    owner,
    sol,
    token: tokenState ?? { uiAmount: 0, decimals: 0, raw: "0" },
    degraded: (degradedSources || []).length > 0,
    degradedSources: degradedSources || [],
    source: balSource || null,
    tokenSource: tokenSource || null,
    retrievedAt,
  };
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const owner = url.searchParams.get("owner") || url.searchParams.get("address") || "";
  const mint = url.searchParams.get("mint") || "";
  if (!isPubkey(owner)) return send(res, 400, { ok: false, error: "invalid owner" });
  cache(res, 5, 15);
  try {
    const degradedSources = [];
    const { result: bal, source: balSource } = await resilientRpcDetailed("getBalance", [owner]);

    // Token holding: try indexed first (works when Helius serves it), then
    // ATA derivation (works on public RPCs). Never report 0 from a failure.
    let tokenState = null;
    let tokenSource = null;
    if (isPubkey(mint)) {
      const { result: accts, source: acctsSource } = await resilientRpcDetailed(
        "getTokenAccountsByOwner",
        [owner, { mint }, { encoding: "jsonParsed" }],
      );
      if (accts?.value?.length) {
        let total = 0n;
        let decimals = 0;
        let uiAmount = 0;
        for (const a of accts.value) {
          const ta = a.account?.data?.parsed?.info?.tokenAmount;
          if (ta) {
            total += BigInt(ta.amount || "0");
            decimals = Number(ta.decimals) || decimals;
            uiAmount += Number(ta.uiAmount || 0);
          }
        }
        tokenState = { uiAmount, decimals, raw: total.toString() };
        tokenSource = acctsSource;
      } else {
        // Indexed path empty OR failed — ATA derivation decides which.
        // Empty value + a source = genuinely no account (not an error).
        // Null result = the RPC failed -> fall through to ATA.
        if (accts && Array.isArray(accts.value)) {
          tokenState = { uiAmount: 0, decimals: 0, raw: "0" };
          tokenSource = acctsSource;
        } else {
          try {
            const holdings = await ataHoldings(owner, [mint]);
            const hit = holdings[0];
            if (hit) {
              tokenState = { uiAmount: hit.uiAmount, decimals: hit.decimals, raw: hit.raw };
              tokenSource = "ata-derived";
            } else {
              tokenState = { uiAmount: 0, decimals: 0, raw: "0" };
              tokenSource = "ata-derived";
            }
          } catch {
            degradedSources.push("token");
            tokenState = null;
            tokenSource = null;
          }
        }
      }
    }

    return send(res, 200, buildBalanceResponse({
      owner,
      bal,
      balSource,
      tokenState,
      tokenSource,
      degradedSources,
    }));
  } catch (e) {
    return send(res, 200, {
      ok: false,
      error: String(e?.message || e),
      owner,
      sol: null,
      token: null,
      degraded: true,
      degradedSources: ["balance"],
      retrievedAt: new Date().toISOString(),
    });
  }
}
