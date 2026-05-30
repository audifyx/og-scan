/**
 * solana-api.ts — Wallet data via Helius DAS + Enhanced TX + Jupiter Price API.
 *
 * Uses Helius DAS `getAssetsByOwner` which returns ALL token types:
 *   • SPL Token (Bonk, meme coins, etc.)
 *   • Token-2022 (PumpFun, Printrr, Believe, etc.)
 *   • NFTs, cNFTs, programmable NFTs
 *
 * Transaction parsing covers:
 *   • Jupiter swaps (type: SWAP, source: JUPITER)
 *   • Pump.fun trades (type: UNKNOWN, source: PUMP_FUN — parsed via events.swap)
 *   • Native SOL transfers
 *   • Token transfers
 *
 * Prices:
 *   • SOL price from Jupiter Price v3 API (fast, accurate)
 *   • Token prices from DAS price_info + Jupiter Price v3 fallback
 */

import { HELIUS_API_KEY, HELIUS_RPC, JUPITER_BASE, JUPITER_API_KEY, SOL_MINT } from "@/lib/og";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const HELIUS_API_BASE = `https://api.helius.xyz/v0`;
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Known DEX/AMM program IDs for swap detection
const PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const JUPITER_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const RAYDIUM_PROGRAM = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const ORCA_PROGRAM = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";

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
  // Helius Enhanced fields
  events?: {
    swap?: {
      nativeInput?: { account: string; amount: string };
      nativeOutput?: { account: string; amount: string };
      tokenInputs?: Array<{ userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }>;
      tokenOutputs?: Array<{ userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }>;
      nativeFees?: Array<{ account: string; amount: string }>;
      tokenFees?: Array<{ userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }>;
      innerSwaps?: Array<{
        programInfo: { source: string; account: string; programName: string; instructionName: string };
        tokenInputs?: Array<{ userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }>;
        tokenOutputs?: Array<{ userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }>;
        nativeInput?: { account: string; amount: string };
        nativeOutput?: { account: string; amount: string };
      }>;
    };
  };
  accountData?: Array<{
    account: string;
    nativeBalanceChange: number;
    tokenBalanceChanges?: Array<{
      userAccount: string;
      tokenAccount: string;
      mint: string;
      rawTokenAmount: { tokenAmount: string; decimals: number };
    }>;
  }>;
}

/* Enriched transaction returned to UI */
export interface ParsedTransaction {
  signature: string;
  timestamp?: number;
  type: string;
  source?: string;
  description?: string;
  fee?: number;
  // What the user received
  receivedMint?: string;
  receivedAmount?: number;
  receivedDecimals?: number;
  // What the user spent
  spentMint?: string;
  spentAmount?: number;
  spentDecimals?: number;
  // SOL amounts
  solDelta?: number;          // net SOL change (positive = received, negative = spent)
  solIn?: number;
  solOut?: number;
  // Classification
  isBuy?: boolean;            // user received token, spent SOL
  isSell?: boolean;           // user spent token, received SOL
  isSwap?: boolean;           // token → token
  isIncoming?: boolean;       // received SOL/token transfer
  isOutgoing?: boolean;       // sent SOL/token transfer
  // USD estimates
  usdValue?: number;
  // For display
  displayAmount?: string;
  displayLabel?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Jupiter Price API (v3) — fast, reliable, covers pump.fun tokens
   Response format: { [mint]: { usdPrice: number, priceChange24h: number, ... } }
   ═══════════════════════════════════════════════════════════════ */

interface JupPriceEntry {
  usdPrice?: number;
  priceChange24h?: number;
  liquidity?: number;
  decimals?: number;
}

const _jupPriceCache: Record<string, { price: number; ts: number }> = {};
const JUP_PRICE_CACHE_MS = 15_000;

export async function fetchJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  const now = Date.now();
  const toFetch = mints.filter(m => !_jupPriceCache[m] || now - _jupPriceCache[m].ts > JUP_PRICE_CACHE_MS);
  
  if (toFetch.length > 0) {
    try {
      // Jupiter price v3 — batched, authenticated
      // Response: { [mint]: { usdPrice: number, priceChange24h: number, ... } }
      const chunks = [];
      for (let i = 0; i < toFetch.length; i += 100) {
        chunks.push(toFetch.slice(i, i + 100));
      }
      await Promise.all(chunks.map(async (chunk) => {
        const url = `${JUPITER_BASE}/price/v3?ids=${chunk.join(",")}`;
        const res = await fetch(url, {
          headers: { "Authorization": `Bearer ${JUPITER_API_KEY}` },
        });
        if (!res.ok) return;
        const data = await res.json() as Record<string, JupPriceEntry>;
        for (const [mint, entry] of Object.entries(data)) {
          const price = typeof entry?.usdPrice === "number" ? entry.usdPrice : 0;
          if (price > 0) _jupPriceCache[mint] = { price, ts: now };
        }
      }));
    } catch { /* fallback to cached */ }
  }

  const result: Record<string, number> = {};
  for (const mint of mints) {
    result[mint] = _jupPriceCache[mint]?.price ?? 0;
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   SOL Price — Jupiter Price API (fast, accurate)
   ═══════════════════════════════════════════════════════════════ */

let _solPriceCache: { price: number; change24h: number; ts: number } | null = null;
const SOL_PRICE_CACHE_MS = 20_000;

export async function fetchSolPrice(): Promise<{ price: number; change24h: number }> {
  const now = Date.now();
  if (_solPriceCache && now - _solPriceCache.ts < SOL_PRICE_CACHE_MS) {
    return { price: _solPriceCache.price, change24h: _solPriceCache.change24h };
  }

  try {
    // Jupiter price v3 — response: { [mint]: { usdPrice: number, priceChange24h: number } }
    const res = await fetch(
      `${JUPITER_BASE}/price/v3?ids=${SOL_MINT}`,
      { headers: { "Authorization": `Bearer ${JUPITER_API_KEY}` } }
    );
    if (res.ok) {
      const data = await res.json() as Record<string, JupPriceEntry>;
      const solEntry = data[SOL_MINT];
      if (solEntry) {
        const price = typeof solEntry.usdPrice === "number" ? solEntry.usdPrice : 0;
        if (price > 0) {
          const change24h = typeof solEntry.priceChange24h === "number" ? solEntry.priceChange24h : 0;
          _solPriceCache = { price, change24h, ts: now };
          return { price, change24h };
        }
      }
    }
  } catch { /* fall through */ }

  // DexScreener fallback
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${SOL_MINT}`);
    const pairs = await res.json() as Array<{ priceUsd?: string; priceChange?: { h24?: string } }>;
    const pair = Array.isArray(pairs) ? pairs[0] : null;
    if (pair) {
      const price = parseFloat(pair.priceUsd ?? "0");
      const change24h = parseFloat(String(pair.priceChange?.h24 ?? "0"));
      if (price > 0) {
        _solPriceCache = { price, change24h, ts: now };
        return { price, change24h };
      }
    }
  } catch { /* ignore */ }

  return { price: _solPriceCache?.price ?? 150, change24h: _solPriceCache?.change24h ?? 0 };
}

/* ═══════════════════════════════════════════════════════════════
   Helius RPC call helper
   ═══════════════════════════════════════════════════════════════ */

async function heliusRpc(method: string, params: unknown): Promise<unknown> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json() as { result: unknown; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

/* ═══════════════════════════════════════════════════════════════
   DAS — getAssetsByOwner (ALL token programs)
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

const _dasCache: Record<string, { data: DasResponse; ts: number }> = {};
const DAS_CACHE_MS = 10_000;

async function fetchAllDasAssets(walletAddress: string): Promise<DasResponse> {
  const cached = _dasCache[walletAddress];
  if (cached && Date.now() - cached.ts < DAS_CACHE_MS) return cached.data;

  const allItems: DasAsset[] = [];
  let page = 1;
  let nativeBalance: DasResponse["nativeBalance"] = undefined;
  let totalSeen = 0;

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

export async function getWalletOverview(walletAddress: string): Promise<WalletOverview> {
  const [dasData, solData] = await Promise.all([
    fetchAllDasAssets(walletAddress),
    fetchSolPrice(),
  ]);

  const solBalance = (dasData.nativeBalance?.lamports ?? 0) / 1e9;
  const solUsd = solBalance * solData.price;

  const fungibleInterfaces = new Set(["FungibleToken", "FungibleAsset"]);
  let tokenCount = 0;
  let nftCount = 0;
  let tokenUsdTotal = 0;

  for (const item of dasData.items) {
    if (fungibleInterfaces.has(item.interface)) {
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

export async function getAssets(
  walletAddress: string,
  page = 1,
  limit = 50
): Promise<{ items: TokenAsset[]; total: number }> {
  try {
    const dasData = await fetchAllDasAssets(walletAddress);

    const fungibleInterfaces = new Set(["FungibleToken", "FungibleAsset"]);
    const fungible = dasData.items.filter(
      (a) => fungibleInterfaces.has(a.interface) && (a.token_info?.balance ?? 0) > 0
    );

    fungible.sort((a, b) => {
      const va = a.token_info?.price_info?.total_price ?? 0;
      const vb = b.token_info?.price_info?.total_price ?? 0;
      return vb - va;
    });

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
 * Enriches token list with Jupiter prices for tokens that DAS has $0 price.
 * This covers pump.fun tokens, new launches, etc.
 */
export async function enrichTokenPrices(
  items: TokenAsset[],
  solPrice: number
): Promise<TokenAsset[]> {
  // Find tokens with missing or $0 prices
  const zeroMints = items
    .filter((t) => (t.token_info?.price_info?.price_per_token ?? 0) === 0 && (t.token_info?.balance ?? 0) > 0)
    .map((t) => t.id)
    .slice(0, 50);

  if (zeroMints.length === 0) return items;

  const jupPrices = await fetchJupiterPrices(zeroMints);

  return items.map((token) => {
    if ((token.token_info?.price_info?.price_per_token ?? 0) > 0) return token;
    const jupPrice = jupPrices[token.id] ?? 0;
    if (jupPrice === 0) return token;

    const balance = (token.token_info?.balance ?? 0) / Math.pow(10, token.token_info?.decimals ?? 0);
    const totalPrice = balance * jupPrice;

    return {
      ...token,
      token_info: {
        ...token.token_info!,
        price_info: {
          price_per_token: jupPrice,
          total_price: totalPrice,
        },
      },
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   Transaction Parsing
   ═══════════════════════════════════════════════════════════════ */

/**
 * Parse a single raw Helius Enhanced Transaction into a clean ParsedTransaction.
 * Handles: Jupiter swaps, pump.fun buys/sells, Raydium/Orca swaps, transfers.
 */
function parseHeliusTx(rawTx: Record<string, unknown>, walletAddress: string, solPrice: number): ParsedTransaction {
  const sig = rawTx.signature as string;
  const ts = rawTx.timestamp as number | undefined;
  const type = ((rawTx.type as string) || "UNKNOWN").toUpperCase();
  const source = ((rawTx.source as string) || "").toUpperCase();
  const description = rawTx.description as string | undefined;
  const fee = rawTx.fee as number | undefined;
  const feePayer = rawTx.feePayer as string | undefined;

  const addr = walletAddress.toLowerCase();

  // Raw arrays
  const nativeTransfers = (rawTx.nativeTransfers as Transaction["nativeTransfers"]) ?? [];
  const tokenTransfers = (rawTx.tokenTransfers as Transaction["tokenTransfers"]) ?? [];
  const events = rawTx.events as Transaction["events"] | undefined;
  const accountData = (rawTx.accountData as Transaction["accountData"]) ?? [];

  const base: ParsedTransaction = {
    signature: sig,
    timestamp: ts,
    type,
    source,
    description,
    fee,
  };

  /* ── Strategy 1: Helius events.swap (covers Jupiter, Raydium, Orca, pump.fun) ── */
  if (events?.swap) {
    const swap = events.swap;
    const walletLower = addr;

    // Determine what the user received and spent
    // nativeInput: user spent SOL; nativeOutput: user received SOL
    const solIn = swap.nativeInput?.account?.toLowerCase() === walletLower
      ? parseInt(swap.nativeInput.amount ?? "0") / 1e9
      : 0;
    const solOut = swap.nativeOutput?.account?.toLowerCase() === walletLower
      ? parseInt(swap.nativeOutput.amount ?? "0") / 1e9
      : 0;

    // Token outputs user received
    const tokenOut = swap.tokenOutputs?.find(
      (t) => t.userAccount?.toLowerCase() === walletLower
    );
    // Token inputs user spent
    const tokenIn = swap.tokenInputs?.find(
      (t) => t.userAccount?.toLowerCase() === walletLower
    );

    // If no direct match try inner swaps
    const innerSwapOut = !tokenOut
      ? swap.innerSwaps?.flatMap((s) => s.tokenOutputs ?? []).find(
          (t) => t.userAccount?.toLowerCase() === walletLower
        )
      : undefined;
    const innerSwapIn = !tokenIn
      ? swap.innerSwaps?.flatMap((s) => s.tokenInputs ?? []).find(
          (t) => t.userAccount?.toLowerCase() === walletLower
        )
      : undefined;

    const receivedToken = tokenOut ?? innerSwapOut;
    const spentToken = tokenIn ?? innerSwapIn;

    let receivedAmount = 0;
    let receivedMint: string | undefined;
    let receivedDecimals = 0;
    let spentAmount = 0;
    let spentMint: string | undefined;
    let spentDecimals = 0;

    if (receivedToken) {
      receivedDecimals = receivedToken.rawTokenAmount.decimals;
      receivedAmount = parseFloat(receivedToken.rawTokenAmount.tokenAmount) / Math.pow(10, receivedDecimals);
      receivedMint = receivedToken.mint;
    }
    if (spentToken) {
      spentDecimals = spentToken.rawTokenAmount.decimals;
      spentAmount = Math.abs(parseFloat(spentToken.rawTokenAmount.tokenAmount)) / Math.pow(10, spentDecimals);
      spentMint = spentToken.mint;
    }

    const isBuy = solIn > 0 && receivedMint != null && receivedMint !== SOL_MINT;
    const isSell = solOut > 0 && spentMint != null && spentMint !== SOL_MINT;
    const isSwap = !isBuy && !isSell && !!receivedMint && !!spentMint;

    const usdSolSide = (solIn || solOut) * solPrice;
    const usdValue = usdSolSide > 0 ? usdSolSide : 0;

    let displayAmount = "";
    if (isBuy && receivedAmount > 0) {
      displayAmount = `+${receivedAmount < 1 ? receivedAmount.toFixed(4) : receivedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens`;
    } else if (isSell) {
      displayAmount = `+${solOut.toFixed(4)} SOL`;
    } else if (isSwap && receivedAmount > 0) {
      displayAmount = `+${receivedAmount < 1 ? receivedAmount.toFixed(4) : receivedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens`;
    }

    return {
      ...base,
      type: type === "UNKNOWN" && (isBuy || isSell) ? (isBuy ? "BUY" : "SELL") : type,
      receivedMint, receivedAmount, receivedDecimals,
      spentMint, spentAmount, spentDecimals,
      solDelta: solOut - solIn,
      solIn, solOut,
      isBuy, isSell, isSwap,
      usdValue,
      displayAmount,
    };
  }

  /* ── Strategy 2: accountData token balance changes (pump.fun fallback) ── */
  if (accountData.length > 0 && (type === "UNKNOWN" || type === "SWAP")) {
    const walletLower = addr;
    let solDelta = 0;
    let receivedMint: string | undefined;
    let receivedAmount = 0;
    let receivedDecimals = 0;
    let spentMint: string | undefined;
    let spentAmount = 0;
    let spentDecimals = 0;

    for (const account of accountData) {
      if (account.account?.toLowerCase() === walletLower) {
        solDelta += (account.nativeBalanceChange ?? 0) / 1e9;
      }
      for (const tokenChange of account.tokenBalanceChanges ?? []) {
        if (tokenChange.userAccount?.toLowerCase() !== walletLower) continue;
        const rawAmt = parseFloat(tokenChange.rawTokenAmount.tokenAmount);
        const decimals = tokenChange.rawTokenAmount.decimals;
        const amt = rawAmt / Math.pow(10, decimals);
        if (rawAmt > 0) {
          receivedMint = tokenChange.mint;
          receivedAmount = amt;
          receivedDecimals = decimals;
        } else if (rawAmt < 0) {
          spentMint = tokenChange.mint;
          spentAmount = Math.abs(amt);
          spentDecimals = decimals;
        }
      }
    }

    if (receivedMint || spentMint) {
      const isBuy = receivedMint != null && receivedMint !== SOL_MINT && solDelta < 0;
      const isSell = spentMint != null && spentMint !== SOL_MINT && solDelta > 0;
      const isSwap = !isBuy && !isSell && !!receivedMint && !!spentMint;

      const solSide = Math.abs(solDelta) - (fee ?? 0) / 1e9;
      const usdValue = solSide * solPrice;

      let displayAmount = "";
      if (isBuy && receivedAmount > 0) {
        displayAmount = `+${receivedAmount < 1 ? receivedAmount.toFixed(4) : receivedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens`;
      } else if (isSell && solDelta > 0) {
        displayAmount = `+${solDelta.toFixed(4)} SOL`;
      }

      return {
        ...base,
        type: isBuy ? "BUY" : isSell ? "SELL" : "SWAP",
        receivedMint, receivedAmount, receivedDecimals,
        spentMint, spentAmount, spentDecimals,
        solDelta,
        solIn: solDelta < 0 ? Math.abs(solDelta) : 0,
        solOut: solDelta > 0 ? solDelta : 0,
        isBuy, isSell, isSwap,
        usdValue,
        displayAmount,
      };
    }
  }

  /* ── Strategy 3: tokenTransfers + nativeTransfers (classic SPL / Jupiter) ── */
  if (type === "SWAP" || tokenTransfers.length > 0) {
    const walletLower = addr;
    // Find which token the user received and which they spent
    const received = tokenTransfers.find((t) => t.toUserAccount?.toLowerCase() === walletLower);
    const spent = tokenTransfers.find((t) => t.fromUserAccount?.toLowerCase() === walletLower);
    const native = nativeTransfers[0];
    const solIn = native?.toUserAccount?.toLowerCase() === walletLower ? Math.abs(native.amount) / 1e9 : 0;
    const solOut = native?.fromUserAccount?.toLowerCase() === walletLower ? Math.abs(native.amount) / 1e9 : 0;

    const isBuy = received != null && received.mint !== SOL_MINT && (solOut > 0 || (!received && !spent));
    const isSell = spent != null && spent.mint !== SOL_MINT && solIn > 0;
    const isSwap = !!received && !!spent;

    const solSide = (solIn || solOut);
    const usdValue = solSide * solPrice;

    let displayAmount = "";
    if (received) {
      displayAmount = `+${received.tokenAmount < 1 ? received.tokenAmount.toFixed(4) : received.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} tokens`;
    } else if (solIn > 0) {
      displayAmount = `+${solIn.toFixed(4)} SOL`;
    } else if (solOut > 0) {
      displayAmount = `-${solOut.toFixed(4)} SOL`;
    }

    return {
      ...base,
      receivedMint: received?.mint,
      receivedAmount: received?.tokenAmount,
      spentMint: spent?.mint,
      spentAmount: spent?.tokenAmount,
      solDelta: solIn - solOut,
      solIn, solOut,
      isBuy, isSell, isSwap,
      usdValue,
      displayAmount,
    };
  }

  /* ── Strategy 4: Native SOL transfer ── */
  if (nativeTransfers.length > 0) {
    const walletLower = addr;
    const incoming = nativeTransfers.filter((t) => t.toUserAccount?.toLowerCase() === walletLower);
    const outgoing = nativeTransfers.filter((t) => t.fromUserAccount?.toLowerCase() === walletLower);
    const solIn = incoming.reduce((s, t) => s + Math.abs(t.amount) / 1e9, 0);
    const solOut = outgoing.reduce((s, t) => s + Math.abs(t.amount) / 1e9, 0);
    const solDelta = solIn - solOut;

    return {
      ...base,
      type: "TRANSFER",
      solDelta,
      solIn,
      solOut,
      isIncoming: solIn > 0 && solOut === 0,
      isOutgoing: solOut > 0 && solIn === 0,
      usdValue: Math.abs(solDelta) * solPrice,
      displayAmount: solDelta >= 0 ? `+${solIn.toFixed(4)} SOL` : `-${solOut.toFixed(4)} SOL`,
    };
  }

  return { ...base };
}

/**
 * Get parsed transaction history for a wallet.
 * Helius Enhanced API returns rich data including events.swap for all DEXes + pump.fun.
 */
export async function getTransactions(
  walletAddress: string,
  limit = 50
): Promise<Transaction[]> {
  try {
    const res = await fetch(
      `${HELIUS_API_BASE}/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`
    );
    if (!res.ok) throw new Error(`Helius TX API error: ${res.status}`);
    const txs = await res.json() as Array<Record<string, unknown>>;
    if (!Array.isArray(txs)) return [];

    // Return raw Helius response mapped to Transaction interface (preserving events + accountData)
    return txs.map((tx) => ({
      signature: tx.signature as string,
      timestamp: tx.timestamp as number | undefined,
      type: (tx.type as string) || "UNKNOWN",
      description: (tx.description as string) || undefined,
      fee: tx.fee as number | undefined,
      feePayer: (tx.feePayer as string) || undefined,
      source: (tx.source as string) || undefined,
      nativeTransfers: tx.nativeTransfers as Transaction["nativeTransfers"],
      tokenTransfers: tx.tokenTransfers as Transaction["tokenTransfers"],
      events: tx.events as Transaction["events"],
      accountData: tx.accountData as Transaction["accountData"],
    }));
  } catch (err) {
    console.error("[getTransactions] error:", err);
    return [];
  }
}

/**
 * Parse raw transactions into clean ParsedTransaction objects with buy/sell/swap classification.
 * This is the main function for PnL, volume, and history display.
 */
export async function parseTransactions(
  rawTxs: Transaction[],
  walletAddress: string
): Promise<ParsedTransaction[]> {
  const { price: solPrice } = await fetchSolPrice();

  return rawTxs.map((tx) => {
    // Cast to Record<string, unknown> for parser
    return parseHeliusTx(tx as unknown as Record<string, unknown>, walletAddress, solPrice);
  });
}

/**
 * Enrich parsed transactions with token metadata (name, symbol, image) from DexScreener.
 * Batches unique mints to minimize API calls.
 */
export async function enrichTxsWithMetadata(
  parsed: ParsedTransaction[]
): Promise<Array<ParsedTransaction & { tokenName?: string; tokenSymbol?: string; tokenImage?: string }>> {
  // Collect unique mints from received or spent tokens
  const uniqueMints = [
    ...new Set(
      parsed
        .flatMap((tx) => [tx.receivedMint, tx.spentMint])
        .filter((m): m is string => !!m && m !== SOL_MINT)
    ),
  ].slice(0, 30);

  const mintMeta: Record<string, { name: string; symbol: string; image?: string }> = {};

  await Promise.allSettled(
    uniqueMints.map(async (mint) => {
      try {
        const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`);
        const pairs = await res.json() as Array<{ baseToken?: { name?: string; symbol?: string }; info?: { imageUrl?: string } }>;
        const pair = Array.isArray(pairs) ? pairs[0] : null;
        if (pair?.baseToken) {
          mintMeta[mint] = {
            name: pair.baseToken.name ?? "Unknown",
            symbol: pair.baseToken.symbol ?? "???",
            image: pair.info?.imageUrl,
          };
        }
      } catch { /* skip */ }
    })
  );

  return parsed.map((tx) => {
    const mainMint = tx.receivedMint ?? tx.spentMint;
    const meta = mainMint ? mintMeta[mainMint] : undefined;
    return {
      ...tx,
      tokenName: mainMint === SOL_MINT ? "Solana" : (meta?.name ?? undefined),
      tokenSymbol: mainMint === SOL_MINT ? "SOL" : (meta?.symbol ?? undefined),
      tokenImage: mainMint === SOL_MINT ? undefined : (meta?.image ?? undefined),
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   PnL Computation
   ═══════════════════════════════════════════════════════════════ */

export interface TokenPnL {
  mint: string;
  symbol: string;
  name: string;
  image?: string;
  currentValue: number;
  currentPrice: number;
  balance: number;
  totalBought: number;      // USD spent buying
  totalSold: number;        // USD received selling
  totalBuyTokens: number;
  totalSellTokens: number;
  avgBuyPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  roi: number;
  buyCount: number;
  sellCount: number;
  totalVolume: number;
  trades: Array<{
    signature: string;
    timestamp?: number;
    side: "buy" | "sell";
    tokenAmount: number;
    solAmount: number;
    usdValue: number;
    pricePerToken: number;
  }>;
}

export interface WalletPnLSummary {
  totalPortfolioValue: number;
  totalInvested: number;
  totalRealized: number;
  totalUnrealized: number;
  totalPnl: number;
  totalVolume: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  winCount: number;
  lossCount: number;
  biggestWin: { symbol: string; pnl: number } | null;
  biggestLoss: { symbol: string; pnl: number } | null;
  tokens: TokenPnL[];
}

/**
 * Compute full wallet PnL from transaction history.
 * Fetches up to 200 transactions for accuracy.
 */
export async function computeWalletPnL(
  walletAddress: string,
  currentTokens: Array<{ mint: string; symbol: string; name: string; image?: string; price: number; value: number; balance: number }>,
  txLimit = 200
): Promise<WalletPnLSummary> {
  const [rawTxs, { price: solPrice }] = await Promise.all([
    getTransactions(walletAddress, txLimit),
    fetchSolPrice(),
  ]);

  const parsed = await parseTransactions(rawTxs, walletAddress);

  // Group trades by token mint
  const tokenTradeGroups: Record<string, TokenPnL["trades"]> = {};

  for (const tx of parsed) {
    if (!tx.isBuy && !tx.isSell) continue;

    const mint = tx.isBuy ? (tx.receivedMint ?? "") : (tx.spentMint ?? "");
    if (!mint || mint === SOL_MINT) continue;

    const tokenAmount = tx.isBuy ? (tx.receivedAmount ?? 0) : (tx.spentAmount ?? 0);
    const solAmount = tx.isBuy ? (tx.solIn ?? 0) : (tx.solOut ?? 0);
    const usdValue = solAmount * solPrice;
    const pricePerToken = tokenAmount > 0 ? usdValue / tokenAmount : 0;

    if (!tokenTradeGroups[mint]) tokenTradeGroups[mint] = [];
    tokenTradeGroups[mint].push({
      signature: tx.signature,
      timestamp: tx.timestamp,
      side: tx.isBuy ? "buy" : "sell",
      tokenAmount,
      solAmount,
      usdValue,
      pricePerToken,
    });
  }

  // Get metadata for traded tokens not in current holdings
  const tradedMints = Object.keys(tokenTradeGroups);
  const knownMints = new Set(currentTokens.map((t) => t.mint));
  const unknownMints = tradedMints.filter((m) => !knownMints.has(m)).slice(0, 20);

  const mintMeta: Record<string, { symbol: string; name: string; image?: string }> = {};
  await Promise.allSettled(
    unknownMints.map(async (mint) => {
      try {
        const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`);
        const pairs = await res.json() as Array<{ baseToken?: { name?: string; symbol?: string }; info?: { imageUrl?: string } }>;
        const pair = Array.isArray(pairs) ? pairs[0] : null;
        if (pair?.baseToken) {
          mintMeta[mint] = {
            name: pair.baseToken.name ?? "Unknown",
            symbol: pair.baseToken.symbol ?? "???",
            image: pair.info?.imageUrl,
          };
        }
      } catch { /* skip */ }
    })
  );

  // Also enrich unknown mint prices via Jupiter
  const unknownMintsWithTrades = unknownMints.filter((m) => tokenTradeGroups[m]?.length > 0);
  const jupPrices = unknownMintsWithTrades.length > 0
    ? await fetchJupiterPrices(unknownMintsWithTrades)
    : {};

  // Build per-token PnL
  const tokenPnlList: TokenPnL[] = tradedMints.map((mint) => {
    const trades = tokenTradeGroups[mint];
    const currentToken = currentTokens.find((t) => t.mint === mint);
    const meta = mintMeta[mint];

    const currentPrice = currentToken?.price ?? jupPrices[mint] ?? 0;
    const currentBalance = currentToken?.balance ?? 0;
    const currentValue = currentToken?.value ?? currentBalance * currentPrice;

    const buys = trades.filter((t) => t.side === "buy");
    const sells = trades.filter((t) => t.side === "sell");

    const totalBought = buys.reduce((s, t) => s + t.usdValue, 0);
    const totalSold = sells.reduce((s, t) => s + t.usdValue, 0);
    const totalBuyTokens = buys.reduce((s, t) => s + t.tokenAmount, 0);
    const totalSellTokens = sells.reduce((s, t) => s + t.tokenAmount, 0);

    const avgBuyPrice = totalBuyTokens > 0 ? totalBought / totalBuyTokens : 0;

    // Realized PnL: what we sold vs cost basis
    const realizedPnl = totalSold - avgBuyPrice * totalSellTokens;

    // Unrealized PnL: current value of holdings vs cost basis
    const costOfHoldings = avgBuyPrice * currentBalance;
    const unrealizedPnl = currentBalance > 0 ? currentValue - costOfHoldings : 0;

    const totalPnl = realizedPnl + unrealizedPnl;
    const roi = totalBought > 0 ? (totalPnl / totalBought) * 100 : 0;
    const totalVolume = totalBought + totalSold;

    return {
      mint,
      symbol: currentToken?.symbol ?? meta?.symbol ?? "???",
      name: currentToken?.name ?? meta?.name ?? "Unknown",
      image: currentToken?.image ?? meta?.image,
      currentValue,
      currentPrice,
      balance: currentBalance,
      totalBought,
      totalSold,
      totalBuyTokens,
      totalSellTokens,
      avgBuyPrice,
      realizedPnl,
      unrealizedPnl,
      totalPnl,
      roi,
      buyCount: buys.length,
      sellCount: sells.length,
      totalVolume,
      trades: trades.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    };
  });

  const validTokens = tokenPnlList.filter((t) => t.totalBought > 0 || t.currentValue > 0);
  const sorted = [...validTokens].sort((a, b) => b.totalPnl - a.totalPnl);

  const totalPortfolioValue = currentTokens.reduce((s, t) => s + t.value, 0);
  const totalInvested = validTokens.reduce((s, t) => s + t.totalBought, 0);
  const totalRealized = validTokens.reduce((s, t) => s + t.realizedPnl, 0);
  const totalUnrealized = validTokens.reduce((s, t) => s + t.unrealizedPnl, 0);
  const totalBuyVolume = validTokens.reduce((s, t) => s + t.totalBought, 0);
  const totalSellVolume = validTokens.reduce((s, t) => s + t.totalSold, 0);

  const biggestWin = sorted.find((t) => t.totalPnl > 0) ?? null;
  const biggestLoss = [...sorted].reverse().find((t) => t.totalPnl < 0) ?? null;

  return {
    totalPortfolioValue,
    totalInvested,
    totalRealized,
    totalUnrealized,
    totalPnl: totalRealized + totalUnrealized,
    totalVolume: totalBuyVolume + totalSellVolume,
    totalBuyVolume,
    totalSellVolume,
    winCount: validTokens.filter((t) => t.totalPnl > 0).length,
    lossCount: validTokens.filter((t) => t.totalPnl < 0).length,
    biggestWin: biggestWin ? { symbol: biggestWin.symbol, pnl: biggestWin.totalPnl } : null,
    biggestLoss: biggestLoss ? { symbol: biggestLoss.symbol, pnl: biggestLoss.totalPnl } : null,
    tokens: sorted,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Utility Functions
   ═══════════════════════════════════════════════════════════════ */

export function getBalance(walletAddress: string): Promise<{ balance: number; usdValue: number }> {
  return Promise.all([
    heliusRpc("getBalance", [walletAddress]) as Promise<{ value: number }>,
    fetchSolPrice(),
  ]).then(([balResult, solData]) => {
    const sol = ((balResult as { value?: number })?.value ?? 0) / 1e9;
    return { balance: sol, usdValue: sol * solData.price };
  });
}

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
