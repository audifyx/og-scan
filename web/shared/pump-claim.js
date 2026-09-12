/**
 * Pump.fun creator-fee claim constants shared by the launchpad UI and MCP ops.
 *
 * Primary path is permissionless `collect_creator_fee_v2` built locally so a
 * Helius/PumpPortal "429: max usage reached" (user-facing "used usage") cannot
 * block creator claims. Legacy `collect_creator_fee` (creator must sign) is
 * kept only for compatibility checks — do not send it.
 *
 * Do not mix collect_* with fee-sharing coins (Pump Fees program owner).
 */
export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const PUMP_AMM_PROGRAM_ID = "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA";
export const PUMP_FEES_PROGRAM_ID = "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ";
/** Anchor discriminator for legacy `global:collect_creator_fee` (creator signer). */
export const COLLECT_CREATOR_FEE_DISCRIMINATOR = [20, 22, 86, 123, 198, 28, 219, 132];
/** Anchor discriminator for permissionless `collect_creator_fee_v2`. */
export const COLLECT_CREATOR_FEE_V2_DISCRIMINATOR = [207, 17, 138, 242, 4, 34, 19, 56];
export const PUMP_CREATOR_VAULT_SEED = "creator-vault";
export const PUMP_EVENT_AUTHORITY_SEED = "__event_authority";
/** Wrapped SOL — quote mint for SOL-paired collect_creator_fee_v2. */
export const WSOL_MINT = "So11111111111111111111111111111111111111112";
/** Rent-exempt minimum for a 0-byte system account (lamports). */
export const SYSTEM_ACCOUNT_RENT_LAMPORTS = 890_880;
export const PUBLIC_SOLANA_RPC = "https://api.mainnet-beta.solana.com";

/**
 * Keyless RPCs that can still send txs when Helius credits are exhausted.
 * Public mainnet often 403s `sendTransaction` from cloud IPs — keep extras.
 * Ankr public and dRPC need paid keys; do not use them here.
 */
export const CLAIM_RPC_URLS = [
  "https://solana-rpc.publicnode.com",
  "https://rpc.solanatracker.io/public",
  PUBLIC_SOLANA_RPC,
];

export function collectErrorText(err) {
  if (err == null) return "";
  if (typeof err === "string" || typeof err === "number") return String(err);
  const parts = [];
  if (err.message) parts.push(String(err.message));
  if (err.status != null) parts.push(String(err.status));
  if (err.code != null) parts.push(String(err.code));
  if (err.error && err.error !== err) parts.push(collectErrorText(err.error));
  if (err.data && err.data !== err) parts.push(collectErrorText(err.data));
  if (err.raw) parts.push(collectErrorText(err.raw));
  return parts.join(" ");
}

/** True when an RPC/PumpPortal error is Helius credit exhaustion (not a generic 429). */
export function isRpcQuotaError(err) {
  const m = collectErrorText(err).toLowerCase();
  if (!m) return false;
  if (m.includes("max usage reached")) return true;
  if (m.includes("used usage")) return true;
  if (m.includes("credits exhausted")) return true;
  if (m.includes("credit limit")) return true;
  if (m.includes("usage limit")) return true;
  if (m.includes("quota exceeded")) return true;
  if (m.includes("usage reached")) return true;
  if (/\busage\b/.test(m) && /\b(max|used|limit|exceed|quota|credit)\b/.test(m)) return true;
  return false;
}

/** Quota, 429, 403, 5xx, or network — try the next RPC. */
export function isRpcUnavailableError(err) {
  if (isRpcQuotaError(err)) return true;
  const m = collectErrorText(err).toLowerCase();
  if (!m) return false;
  if (/\b429\b/.test(m) || /too many requests|rate.?limit/.test(m)) return true;
  if (/forbidden|access denied|\b403\b/.test(m)) return true;
  if (/\b50[234]\b/.test(m) || /bad gateway|service unavailable/.test(m)) return true;
  if (/failed to fetch|networkerror|econnreset|etimedout|timed out|timeout|fetch failed/.test(m)) return true;
  if (/unhealthy|try again later|node is behind/.test(m)) return true;
  return false;
}

export async function jsonRpcWithFallback(payload, urls = CLAIM_RPC_URLS) {
  let lastErr;
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: payload.id ?? 1,
          method: payload.method,
          params: payload.params || [],
        }),
        signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(12_000)
          : undefined,
      });
      const data = await r.json().catch(() => null);
      if (data && data.error && isRpcUnavailableError(data.error)) {
        lastErr = data.error;
        continue;
      }
      if (!r.ok) {
        const probe = { status: r.status, message: data ? JSON.stringify(data) : r.statusText };
        if (isRpcUnavailableError(probe) || isRpcQuotaError(probe)) {
          lastErr = probe;
          continue;
        }
      }
      if (data) return data;
      lastErr = new Error(`RPC ${r.status}`);
    } catch (e) {
      lastErr = e;
      if (!isRpcUnavailableError(e)) throw e;
    }
  }
  const msg = lastErr && (lastErr.message || lastErr.code)
    ? String(lastErr.message || lastErr.code)
    : "All Solana RPCs failed";
  return { jsonrpc: "2.0", id: payload.id ?? 1, error: { code: -32603, message: msg } };
}
