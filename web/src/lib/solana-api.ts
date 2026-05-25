/**
 * solana-api.ts — Wallet data via Helius DAS + DexScreener direct APIs.
 *
 * Uses Helius DAS `getAssetsByOwner` which returns ALL token types:
 *   • SPL Token (Bonk, meme coins, etc.)
 *   • Token-2022 (PumpFun, Printrr, Believe, etc.)
 *   • NFTs, cNFTs, programmable NFTs
 *
 * No edge functions needed.
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
    token_program?: string;
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
async function heliusRpc(method: string, params: unknown): Promise<unknown> {
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
   DAS — getAssetsByOwner  (catches ALL token programs)
   ═══════════════════════════════════════════════════════════════ */

interface DasAsset {
  id: string;
  interface: string;
  content?: {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
    json_uri?: string;
  };
  token_info?: {
    balance?: number;
    decimals?: number;
    token_program?: string;
    associated_token_address?: string;
    price_info?: {
      price_per_token?: number;
      total_price?: number;
      currency?: string;
    };
  };
  ownership?: { owner?: string };
}

interface DasResponse {
  total: number;
  limit: number;
  page: number;
  items: DasAsset[];
  nativeBalance?: {
    lamports: number;
    price_per_sol: number;
    total_price: number;
  };
}

// Simple 10-second cache so parallel getWalletOverview + getAssets share one DAS call
const _dasCache: Record<string, { data: DasResponse; ts: number }> = {};
const DAS_CACHE_MS = 10_000;

async function fetchAllDasAssets(walletAddress: string): Promise<DasResponse> {
  const cached = _dasCache[walletAddress];
  if (cached && Date.now() - cached.ts < DAS_CACHE_MS) return cached.data;
  const allItems: DasAsset[] = [];
  let page = 1;
  let nativeBalance: DasResponse["nativeBalance"] = undefined;
  let totalSeen = 0;

  // Paginate through all assets (DAS max 1000 per page)
  while (true) {
    const res = (await heliusRpc("getAssetsByOwner", {
      ownerAddress: walletAddress,
      displayOptions: {
        showFungible: true,
        showNativeBalance: true,
        showZeroBalance: false,
      },
      sortBy: { sortBy: "recent_action", sortDirection: "desc" },
      page,
      limit: 1000,
    })) as DasResponse;

    if (page === 1 && res.nativeBalance) {
      nativeBalance = res.nativeBalance;
    }

    allItems.push(...(res.items ?? []));
    totalSeen += res.items?.length ?? 0;

    // Stop if we got fewer than the limit or hit a reasonable cap
    if (!res.items || res.items.length < 1000 || totalSeen >= 5000) break;
    page++;
  }

  const result: DasResponse = { total: allItems.length, limit: 1000, page: 1, items: allItems, nativeBalance };
  _dasCache[walletAddress] = { data: result, ts: Date.now() };
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   API Functions
   ═══════════════════════════════════════════════════════════════ */

/**
 * Full wallet overview using DAS — one call gets SOL balance + all token counts.
 */
export async function getWalletOverview(walletAddress: string): Promise<WalletOverview> {
  const [dasData, solData] = await Promise.all([
    fetchAllDasAssets(walletAddress),
    fetchSolPrice(),
  ]);

  // SOL balance from DAS nativeBalance (in lamports)
  const solBalance = (dasData.nativeBalance?.lamports ?? 0) / 1e9;
  const solUsd = solBalance * solData.price;

  // Separate fungible tokens from NFTs
  const fungibleInterfaces = new Set(["FungibleToken", "FungibleAsset"]);
  let tokenCount = 0;
  let nftCount = 0;
  let tokenUsdTotal = 0;

  for (const item of dasData.items) {
    if (fungibleInterfaces.has(item.interface)) {
      // Only count tokens with actual balance
      const bal = item.token_info?.balance ?? 0;
      if (bal > 0) {
        tokenCount++;
        tokenUsdTotal += item.token_info?.price_info?.total_price ?? 0;
      }
    } else {
      nftCount++;
    }
  }

  return {
    balance: solBalance,
    usdValue: solUsd,
    solPrice: solData.price,
    priceChange24h: solData.change24h,
    totalUsdValue: solUsd + tokenUsdTotal,
    tokenCount,
    nftCount,
    totalAssets: tokenCount + nftCount,
  };
}

/**
 * Get token assets — uses DAS so Token-2022, PumpFun, Printrr, etc. are all included.
 */
export async function getAssets(walletAddress: string, page = 1, limit = 50): Promise<{ items: TokenAsset[]; total: number }> {
  try {
    const dasData = await fetchAllDasAssets(walletAddress);

    // Filter to fungible tokens with balance > 0
    const fungibleInterfaces = new Set(["FungibleToken", "FungibleAsset"]);
    const fungible = dasData.items.filter(
      (a) => fungibleInterfaces.has(a.interface) && (a.token_info?.balance ?? 0) > 0
    );

    // Sort by USD value descending (most valuable first)
    fungible.sort((a, b) => {
      const va = a.token_info?.price_info?.total_price ?? 0;
      const vb = b.token_info?.price_info?.total_price ?? 0;
      return vb - va;
    });

    // Paginate
    const sliced = fungible.slice((page - 1) * limit, page * limit);

    const tokens: TokenAsset[] = sliced.map((a) => ({
      id: a.id,
      content: {
        metadata: {
          name: a.content?.metadata?.name || a.content?.metadata?.symbol || "Unknown",
          symbol: a.content?.metadata?.symbol || "???",
        },
        links: {
          image: a.content?.links?.image || undefined,
        },
      },
      token_info: {
        balance: a.token_info?.balance ?? 0,
        decimals: a.token_info?.decimals ?? 0,
        token_program: a.token_info?.token_program,
        price_info: a.token_info?.price_info
          ? {
              price_per_token: a.token_info.price_info.price_per_token ?? 0,
              total_price: a.token_info.price_info.total_price ?? 0,
            }
          : undefined,
      },
      interface: a.interface,
    }));

    return { items: tokens, total: fungible.length };
  } catch (err) {
    console.error("[getAssets] error:", err);
    return { items: [], total: 0 };
  }
}

/**
 * Parsed transaction history via Helius enhanced API.
 * Already covers all programs (Token, Token-2022, system, etc.)
 */
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
