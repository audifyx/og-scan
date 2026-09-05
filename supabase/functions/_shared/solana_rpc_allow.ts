/** Allowlisted Solana JSON-RPC methods for keyed RPC proxies. */
export const SOLANA_RPC_ALLOWED = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getBlockTime",
  "getFeeForMessage",
  "getLatestBlockhash",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getRecentPrioritizationFees",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "getTransactionCount",
  "isBlockhashValid",
  "sendTransaction",
  "simulateTransaction",
]);

export const SOLANA_RPC_BATCH_MAX = 10;
