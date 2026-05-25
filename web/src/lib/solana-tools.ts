/**
 * Solana Tools — direct API implementations replacing the non-existent
 * `solana-tracker` edge function. Each action maps to real Helius / Jupiter /
 * DexScreener / Birdeye API calls using keys already in `og.ts`.
 */

import {
  HELIUS_API_KEY,
  HELIUS_RPC,
  HELIUS_BASE,
  SOL_MINT,
  heliusTxs,
  heliusLargestAccounts,
  heliusTokenSupply,
  jupPrice,
  jupSearchToken,
  birdeyeOhlcv,
  BIRDEYE_API_KEY,
  BIRDEYE_BASE,
} from "./og";

/* ───────── helpers ─────────────────────────────────────────────────────── */
async function rpc(method: string, params: any[]): Promise<any> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function dasSearch(body: any): Promise<any> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "das", method: "searchAssets", params: body }),
  });
  const json = await res.json();
  return json.result;
}

async function heliusGet(path: string, qs: Record<string, string> = {}): Promise<any> {
  const params = new URLSearchParams({ "api-key": HELIUS_API_KEY, ...qs });
  const res = await fetch(`${HELIUS_BASE}${path}?${params}`);
  return res.json();
}

/* ───────── action: getTransactions ──────────────────────────────────── */
export async function getTransactions(walletAddress: string, limit = 100) {
  return heliusTxs(walletAddress, limit);
}

/* ───────── action: getTokenHolders ──────────────────────────────────── */
export async function getTokenHolders(tokenAddress: string, limit = 20) {
  try {
    const [accounts, supply, priceMap] = await Promise.all([
      heliusLargestAccounts(tokenAddress),
      heliusTokenSupply(tokenAddress),
      jupPrice([tokenAddress]),
    ]);
    const usdPrice = priceMap[tokenAddress]?.usdPrice ?? 0;
    const totalSupply = supply?.uiAmount ?? 0;

    return (accounts || []).slice(0, limit).map((a, i) => ({
      rank: i + 1,
      address: a.address,
      amount: a.uiAmount,
      percentage: totalSupply > 0 ? (a.uiAmount / totalSupply) * 100 : 0,
      value: a.uiAmount * usdPrice,
    }));
  } catch (e) {
    console.error("getTokenHolders error:", e);
    return [];
  }
}

/* ───────── action: analyzeToken ─────────────────────────────────────── */
export async function analyzeToken(tokenAddress: string) {
  try {
    const [priceMap, supply, holders, search] = await Promise.all([
      jupPrice([tokenAddress, SOL_MINT]),
      heliusTokenSupply(tokenAddress),
      heliusLargestAccounts(tokenAddress),
      jupSearchToken(tokenAddress),
    ]);

    const price = priceMap[tokenAddress];
    const solPrice = priceMap[SOL_MINT]?.usdPrice ?? 0;
    const info = search?.[0];
    const totalSupply = supply?.uiAmount ?? 0;
    const top10 = (holders || []).slice(0, 10);
    const top10Pct = totalSupply > 0
      ? top10.reduce((s, h) => s + h.uiAmount, 0) / totalSupply * 100
      : 0;

    return {
      address: tokenAddress,
      name: info?.name ?? "Unknown",
      symbol: info?.symbol ?? "???",
      decimals: supply?.decimals ?? 9,
      price: price?.usdPrice ?? 0,
      priceChange24h: price?.priceChange24h ?? 0,
      totalSupply,
      mcap: totalSupply * (price?.usdPrice ?? 0),
      fdv: totalSupply * (price?.usdPrice ?? 0),
      holders: holders?.length ?? 0,
      top10HolderPct: top10Pct,
      logoURI: info?.logoURI ?? null,
      solPrice,
    };
  } catch (e) {
    console.error("analyzeToken error:", e);
    return null;
  }
}

/* ───────── action: getAssets (wallet token balances) ─────────────────── */
export async function getAssets(walletAddress: string) {
  try {
    // Use DAS API for compressed + standard assets
    const result = await dasSearch({
      ownerAddress: walletAddress,
      tokenType: "fungible",
      displayOptions: { showNativeBalance: true },
      limit: 100,
    });

    const assets = (result?.items || []).map((item: any) => ({
      mint: item.id,
      name: item.content?.metadata?.name ?? "Unknown",
      symbol: item.content?.metadata?.symbol ?? "???",
      amount: item.token_info?.balance
        ? item.token_info.balance / Math.pow(10, item.token_info?.decimals ?? 0)
        : 0,
      decimals: item.token_info?.decimals ?? 0,
      logoURI: item.content?.links?.image ?? null,
      pricePerToken: item.token_info?.price_info?.price_per_token ?? 0,
      totalPrice: item.token_info?.price_info?.total_price ?? 0,
    }));

    return {
      assets,
      nativeBalance: result?.nativeBalance?.lamports
        ? result.nativeBalance.lamports / 1e9
        : 0,
    };
  } catch (e) {
    console.error("getAssets error:", e);
    return { assets: [], nativeBalance: 0 };
  }
}

/* ───────── action: getBalance ───────────────────────────────────────── */
export async function getBalance(walletAddress: string) {
  try {
    const result = await rpc("getBalance", [walletAddress]);
    const lamports = result?.value ?? 0;
    const sol = lamports / 1e9;
    const priceMap = await jupPrice([SOL_MINT]);
    const solPrice = priceMap[SOL_MINT]?.usdPrice ?? 0;
    return { sol, usd: sol * solPrice, lamports, solPrice };
  } catch (e) {
    console.error("getBalance error:", e);
    return { sol: 0, usd: 0, lamports: 0, solPrice: 0 };
  }
}

/* ───────── action: getWalletOverview ─────────────────────────────────── */
export async function getWalletOverview(walletAddress: string) {
  try {
    const [balResult, assetsResult, txs] = await Promise.all([
      getBalance(walletAddress),
      getAssets(walletAddress),
      heliusTxs(walletAddress, 50),
    ]);

    const tokenCount = assetsResult.assets.length;
    const totalValue = assetsResult.assets.reduce((s: number, a: any) => s + (a.totalPrice || 0), 0);

    return {
      sol: balResult.sol,
      solUsd: balResult.usd,
      solPrice: balResult.solPrice,
      tokenCount,
      totalTokenValueUsd: totalValue,
      totalValueUsd: balResult.usd + totalValue,
      transactionCount: txs.length,
      tokens: assetsResult.assets.slice(0, 20),
    };
  } catch (e) {
    console.error("getWalletOverview error:", e);
    return { sol: 0, solUsd: 0, solPrice: 0, tokenCount: 0, totalTokenValueUsd: 0, totalValueUsd: 0, transactionCount: 0, tokens: [] };
  }
}

/* ───────── action: getWalletPnL ─────────────────────────────────────── */
export async function getWalletPnL(walletAddress: string) {
  try {
    const txs = await heliusTxs(walletAddress, 100);

    // Compute basic PnL from native transfers
    let totalIn = 0, totalOut = 0, swapCount = 0, txCount = txs.length;

    for (const tx of txs) {
      const type = tx.type || "";
      if (type === "SWAP" || type.includes("SWAP")) swapCount++;

      for (const nt of tx.nativeTransfers || []) {
        if (nt.toUserAccount === walletAddress) totalIn += nt.amount / 1e9;
        if (nt.fromUserAccount === walletAddress) totalOut += nt.amount / 1e9;
      }
    }

    const priceMap = await jupPrice([SOL_MINT]);
    const solPrice = priceMap[SOL_MINT]?.usdPrice ?? 0;
    const netSol = totalIn - totalOut;

    return {
      totalInSol: totalIn,
      totalOutSol: totalOut,
      netSol,
      netUsd: netSol * solPrice,
      swapCount,
      transactionCount: txCount,
      solPrice,
    };
  } catch (e) {
    console.error("getWalletPnL error:", e);
    return { totalInSol: 0, totalOutSol: 0, netSol: 0, netUsd: 0, swapCount: 0, transactionCount: 0, solPrice: 0 };
  }
}

/* ───────── action: getTokenTransactions ──────────────────────────────── */
export async function getTokenTransactions(tokenAddress: string, limit = 50) {
  // Token transactions are fetched from the mint address
  return heliusTxs(tokenAddress, limit);
}

/* ───────── action: getNewPairs ──────────────────────────────────────── */
export async function getNewPairs() {
  try {
    const res = await fetch("https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112");
    const json = await res.json();
    const pairs = (json.pairs || [])
      .filter((p: any) => p.chainId === "solana")
      .sort((a: any, b: any) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0))
      .slice(0, 20)
      .map((p: any) => ({
        pairAddress: p.pairAddress,
        baseToken: p.baseToken,
        quoteToken: p.quoteToken,
        priceUsd: p.priceUsd,
        volume24h: p.volume?.h24 ?? 0,
        liquidity: p.liquidity?.usd ?? 0,
        pairCreatedAt: p.pairCreatedAt,
        url: p.url,
      }));
    return pairs;
  } catch (e) {
    console.error("getNewPairs error:", e);
    return [];
  }
}

/* ───────── action: getLiquidityPools ─────────────────────────────────── */
export async function getLiquidityPools(tokenAddress: string) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    const json = await res.json();
    const pools = (json.pairs || []).map((p: any) => ({
      pairAddress: p.pairAddress,
      dex: p.dexId,
      baseToken: p.baseToken,
      quoteToken: p.quoteToken,
      priceUsd: p.priceUsd,
      volume24h: p.volume?.h24 ?? 0,
      liquidity: p.liquidity?.usd ?? 0,
      fdv: p.fdv ?? 0,
      pairCreatedAt: p.pairCreatedAt,
    }));
    return pools;
  } catch (e) {
    console.error("getLiquidityPools error:", e);
    return [];
  }
}

/* ───────── unified dispatcher (drop-in for old edge function) ───────── */
export async function solanaTracker(action: string, params: Record<string, any> = {}): Promise<{ data: any; error: any }> {
  try {
    let data: any;
    switch (action) {
      case "getTransactions":
        data = await getTransactions(params.walletAddress, params.limit);
        break;
      case "getTokenHolders":
        data = await getTokenHolders(params.tokenAddress, params.limit);
        break;
      case "analyzeToken":
        data = await analyzeToken(params.tokenAddress);
        break;
      case "getAssets":
        data = await getAssets(params.walletAddress);
        break;
      case "getBalance":
        data = await getBalance(params.walletAddress);
        break;
      case "getWalletOverview":
        data = await getWalletOverview(params.walletAddress);
        break;
      case "getWalletPnL":
        data = await getWalletPnL(params.walletAddress);
        break;
      case "getTokenTransactions":
        data = await getTokenTransactions(params.tokenAddress, params.limit);
        break;
      case "getNewPairs":
        data = await getNewPairs();
        break;
      case "getLiquidityPools":
        data = await getLiquidityPools(params.tokenAddress);
        break;
      default:
        return { data: null, error: { message: `Unknown action: ${action}` } };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || "Unknown error" } };
  }
}
