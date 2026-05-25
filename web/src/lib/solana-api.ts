/**
 * solana-api.ts — Wallet data via Helius + DexScreener direct APIs.
 * Replaces the broken supabase `solana-tracker` edge function.
 */

import { HELIUS_API_KEY, HELIUS_RPC } from "@/lib/og";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export interface WalletOverview {
  balance: number;
  usdValue: number;
  solPrice: number;
  priceChange24h: number;
  totalUsdValue: number;
  tokenCount: number;
  nftCount: number;
  totalAssets: number;
}

export interface TokenAsset {
  id: string;
  content: {
    metadata: {
      name: string;
      symbol: string;
    };
    links?: {
      image?: string;
    };
  };
  token_info?: {
    balance: number;
    decimals: number;
    price_info?: {
      price_per_token: number;
      total_price: number;
    };
  };
  interface: string;
}

export interface Transaction {
  signature: string;
  timestamp?: number;
  type: string;
  description?: string;
  fee?: number;
  feePayer?: string;
  source?: string;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

/** SOL price from DexScreener (SOL/USDC main pair) */
async function fetchSolPrice(): Promise<{ price: number; change24h: number }> {
  try {
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${SOL_MINT}`);
    const pairs = await res.json();
    const pair = Array.isArray(pairs) ? pairs[0] : null;
    return {
      price: pair ? parseFloat(pair.priceUsd ?? "0") : 0,
      change24h: pair ? parseFloat(pair.priceChange?.h24 ?? "0") : 0,
    };
  } catch {
    return { price: 0, change24h: 0 };
  }
}

/** Helius RPC call */
async function heliusRpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

/* ═══════════════════════════════════════════════════════════════
   API Functions
   ═══════════════════════════════════════════════════════════════ */

export async function getWalletOverview(walletAddress: string): Promise<WalletOverview> {
  const [balResult, solData] = await Promise.all([
    heliusRpc("getBalance", [walletAddress]) as Promise<{ value: number }>,
    fetchSolPrice(),
  ]);

  const solBalance = (balResult?.value ?? 0) / 1e9;
  const usdValue = solBalance * solData.price;

  // Get token accounts to count tokens
  const tokenAccounts = (await heliusRpc("getTokenAccountsByOwner", [
    walletAddress,
    { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
    { encoding: "jsonParsed" },
  ])) as { value: Array<unknown> };

  const tokenCount = tokenAccounts?.value?.length ?? 0;

  return {
    balance: solBalance,
    usdValue,
    solPrice: solData.price,
    priceChange24h: solData.change24h,
    totalUsdValue: usdValue, // Will be enriched when assets are loaded
    tokenCount,
    nftCount: 0,
    totalAssets: tokenCount,
  };
}

export async function getAssets(walletAddress: string, page = 1, limit = 50): Promise<{ items: TokenAsset[]; total: number }> {
  try {
    // Use Helius DAS API for assets
    const res = await fetch(`https://api.helius.xyz/v0/addresses/${walletAddress}/balances?api-key=${HELIUS_API_KEY}`);
    const data = await res.json();

    const tokens: TokenAsset[] = (data.tokens ?? []).slice((page - 1) * limit, page * limit).map((t: Record<string, unknown>) => ({
      id: t.mint as string,
      content: {
        metadata: {
          name: (t.name as string) || (t.symbol as string) || "Unknown",
          symbol: (t.symbol as string) || "???",
        },
        links: { image: (t.logoURI as string) || undefined },
      },
      token_info: {
        balance: Number(t.amount ?? 0),
        decimals: Number(t.decimals ?? 0),
        price_info: t.price
          ? {
              price_per_token: Number(t.price),
              total_price: Number(t.amount ?? 0) / Math.pow(10, Number(t.decimals ?? 0)) * Number(t.price),
            }
          : undefined,
      },
      interface: "FungibleToken",
    }));

    return { items: tokens, total: data.tokens?.length ?? 0 };
  } catch (err) {
    console.error("[getAssets] error:", err);
    return { items: [], total: 0 };
  }
}

export async function getTransactions(walletAddress: string, limit = 20): Promise<Transaction[]> {
  try {
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`
    );
    const txs = await res.json();
    if (!Array.isArray(txs)) return [];

    return txs.map((tx: Record<string, unknown>) => ({
      signature: tx.signature as string,
      timestamp: tx.timestamp as number | undefined,
      type: (tx.type as string) || "UNKNOWN",
      description: (tx.description as string) || undefined,
      fee: tx.fee as number | undefined,
      feePayer: (tx.feePayer as string) || undefined,
      source: (tx.source as string) || undefined,
      nativeTransfers: tx.nativeTransfers as Transaction["nativeTransfers"],
      tokenTransfers: tx.tokenTransfers as Transaction["tokenTransfers"],
    }));
  } catch (err) {
    console.error("[getTransactions] error:", err);
    return [];
  }
}

export async function getBalance(walletAddress: string): Promise<{ balance: number; usdValue: number }> {
  const [balResult, solData] = await Promise.all([
    heliusRpc("getBalance", [walletAddress]) as Promise<{ value: number }>,
    fetchSolPrice(),
  ]);
  const sol = (balResult?.value ?? 0) / 1e9;
  return { balance: sol, usdValue: sol * solData.price };
}

/* ═══════════════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════════════ */

export function formatAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatNumber(num: number, decimals = 2): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(decimals)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(decimals)}K`;
  return num.toFixed(decimals);
}

export function formatUsd(num: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}
