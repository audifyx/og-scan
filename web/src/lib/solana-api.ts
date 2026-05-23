import { supabase } from "@/lib/supabase";

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

async function callSolanaTracker(action: string, walletAddress: string, options: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke('solana-tracker', {
    body: { action, walletAddress, ...options },
  });

  if (error) {
    console.error('Solana API Error:', error);
    throw new Error(error.message || 'Failed to fetch data');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function getWalletOverview(walletAddress: string): Promise<WalletOverview> {
  return callSolanaTracker('getWalletOverview', walletAddress);
}

export async function getAssets(walletAddress: string, page = 1, limit = 50) {
  return callSolanaTracker('getAssets', walletAddress, { page, limit });
}

export async function getTransactions(walletAddress: string, limit = 20) {
  return callSolanaTracker('getTransactions', walletAddress, { limit });
}

export async function getBalance(walletAddress: string) {
  return callSolanaTracker('getBalance', walletAddress);
}

export function formatAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatNumber(num: number, decimals = 2): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(decimals)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(decimals)}K`;
  }
  return num.toFixed(decimals);
}

export function formatUsd(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}
