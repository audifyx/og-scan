// Public wallet-name registry. Resolves well-known Solana addresses (exchanges,
// AMMs, launchpads, burn) to a human-readable name so the holders list never
// hides who is actually holding. KOLs are resolved separately via the KOL
// directory; this covers infrastructure + custodial wallets.
export interface WalletLabel { name: string; kind: "exchange" | "amm" | "launchpad" | "burn" | "protocol" | "bridge"; }

export const WALLET_LABELS: Record<string, WalletLabel> = {
  // Burn / incinerator
  "1nc1nerator11111111111111111111111111111111": { name: "Burn Address", kind: "burn" },
  // AMMs / routers
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j": { name: "Raydium Authority V4", kind: "amm" },
  "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin": { name: "Serum DEX", kind: "amm" },
  "Gq7AGMfQYg8YfPwLQVbNzWoBSWmJ4YMmYUMfkpfmXyVL": { name: "Meteora Vault", kind: "amm" },
  // Launchpads
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P": { name: "Pump.fun Fee", kind: "launchpad" },
  "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg": { name: "Pump.fun AMM Authority", kind: "launchpad" },
  // Exchanges (known hot/cold wallets)
  "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9": { name: "Binance", kind: "exchange" },
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": { name: "Coinbase 1", kind: "exchange" },
  "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS": { name: "Coinbase 2", kind: "exchange" },
  "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S": { name: "Coinbase Custody", kind: "exchange" },
  "AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2": { name: "Bybit", kind: "exchange" },
  "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE": { name: "Kraken", kind: "exchange" },
  "ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ": { name: "MEXC", kind: "exchange" },
  "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD": { name: "OKX", kind: "exchange" },
  "u6PJ8DtQuPFnfmwHbGFULQ4u4EgjDiyYKjVEsynXq2w": { name: "Gate.io", kind: "exchange" },
};

export function getWalletLabel(addr?: string | null): WalletLabel | null {
  if (!addr) return null;
  return WALLET_LABELS[addr] || null;
}

export function labelKindClass(kind: WalletLabel["kind"]): string {
  switch (kind) {
    case "exchange": return "bg-blue-500/15 text-blue-300";
    case "amm": return "bg-accent2/15 text-accent2";
    case "launchpad": return "bg-accent/15 text-accent";
    case "burn": return "bg-panel2 text-muted";
    case "bridge": return "bg-blue-400/15 text-blue-300";
    default: return "bg-panel2 text-muted";
  }
}
