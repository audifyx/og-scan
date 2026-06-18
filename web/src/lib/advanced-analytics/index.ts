// FILE: web/src/lib/advanced-analytics/holder-analytics.ts

import { supabase } from '@/lib/supabase';
import { fmtUsd, fmtPct } from '@/lib/og';

export interface HolderAnalysis {
  wallet: string;
  balance: bigint;
  balanceUsd: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  entryPrice: number;
  currentPrice: number;
  holdingDays: number;
  buyCount: number;
  sellCount: number;
  classification: string;
  riskScore: number;
}

/**
 * Calculate comprehensive PnL for a holder
 */
export async function analyzeHolder(
  mint: string,
  wallet: string,
  currentPrice: number
): Promise<HolderAnalysis | null> {
  try {
    // Get all transactions for this wallet in this token
    const { data: transactions, error } = await supabase
      .from('transactions_extended')
      .select('*')
      .eq('mint_address', mint)
      .or(`buyer_address.eq.${wallet},seller_address.eq.${wallet}`)
      .order('blockchain_timestamp', { ascending: true });

    if (error) throw error;
    if (!transactions || transactions.length === 0) return null;

    let totalCost = 0;
    let currentBalance = 0;
    let realizedPnL = 0;
    let costBasis = 0;
    let buyCount = 0;
    let sellCount = 0;
    let firstBuyTime = 0;

    // Process transactions
    for (const tx of transactions) {
      if (tx.direction === 'buy' && tx.buyer_address === wallet) {
        const txCost = tx.usd_volume || 0;
        const txAmount = Number(tx.token_amount) || 0;
        
        if (!firstBuyTime) firstBuyTime = tx.blockchain_timestamp;
        
        totalCost += txCost;
        currentBalance += txAmount;
        costBasis = totalCost / (currentBalance || 1);
        buyCount++;
      } 
      else if (tx.direction === 'sell' && tx.seller_address === wallet) {
        const saleProceeds = tx.usd_volume || 0;
        const sellAmount = Number(tx.token_amount) || 0;
        
        // Realized PnL = (sell price - cost basis) * amount
        const txPnL = (tx.token_price - costBasis) * sellAmount;
        realizedPnL += txPnL;
        
        currentBalance -= sellAmount;
        totalCost -= (costBasis * sellAmount);
        sellCount++;
      }
    }

    const unrealizedPnL = (currentPrice - costBasis) * currentBalance;
    const totalPnL = realizedPnL + unrealizedPnL;
    const holdingDays = firstBuyTime ? (Date.now() / 1000 - firstBuyTime) / 86400 : 0;

    // Classify holder
    const classification = classifyHolder({
      buyCount,
      sellCount,
      unrealizedPnL,
      holdingDays,
      balancePercent: 0, // will calculate separately
    });

    // Risk score based on PnL
    const riskScore = calculateHolderRiskScore({
      unrealizedPnL,
      balanceUsd: currentBalance * currentPrice,
      entryPrice: costBasis,
    });

    return {
      wallet,
      balance: BigInt(currentBalance),
      balanceUsd: currentBalance * currentPrice,
      unrealizedPnL,
      realizedPnL,
      totalPnL,
      entryPrice: costBasis,
      currentPrice,
      holdingDays,
      buyCount,
      sellCount,
      classification,
      riskScore,
    };
  } catch (error) {
    console.error('Error analyzing holder:', error);
    return null;
  }
}

/**
 * Classify holder based on behavior
 */
function classifyHolder(data: {
  buyCount: number;
  sellCount: number;
  unrealizedPnL: number;
  holdingDays: number;
  balancePercent: number;
}): string {
  const { buyCount, sellCount, unrealizedPnL, holdingDays } = data;

  if (buyCount === 0) return 'inactive';
  if (sellCount === 0 && unrealizedPnL > 0) return 'diamond_hand';
  if (sellCount === 0 && unrealizedPnL < 0) return 'bag_holder';
  if (buyCount > 5 || sellCount > 3) return 'swing_trader';
  if (holdingDays < 1 && buyCount === 1) return 'sniper';
  if (unrealizedPnL > 50000) return 'whale';
  return 'trader';
}

/**
 * Calculate risk score for a holder
 */
function calculateHolderRiskScore(data: {
  unrealizedPnL: number;
  balanceUsd: number;
  entryPrice: number;
}): number {
  const { unrealizedPnL, balanceUsd } = data;
  
  // High unrealized gains = high dump risk
  if (unrealizedPnL > balanceUsd * 5) return 95; // 500% gains
  if (unrealizedPnL > balanceUsd * 2) return 85; // 200% gains
  if (unrealizedPnL > balanceUsd) return 70; // 100% gains
  if (unrealizedPnL > 0) return 40; // profitable
  if (unrealizedPnL > -balanceUsd * 0.5) return 30; // under -50%
  return 15; // severe losses
}

/**
 * Get top holders with PnL analysis
 */
export async function getTopHoldersByPnL(
  mint: string,
  limit: number = 50
): Promise<HolderAnalysis[]> {
  try {
    const { data: snapshots } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', mint)
      .order('unrealized_pnl_usd', { ascending: false })
      .limit(limit);

    return (snapshots || []) as any[];
  } catch (error) {
    console.error('Error fetching top holders:', error);
    return [];
  }
}

/**
 * Detect whale dump risk
 */
export async function analyzeWhaleRisk(mint: string): Promise<{
  totalWhalePower: number;
  criticalRiskWallets: number;
  priceImpactPercent: number;
  dumpProbability: number;
}> {
  try {
    const { data: whales } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', mint)
      .gt('balance_percent_of_supply', 1)
      .order('balance_usd', { ascending: false });

    if (!whales || whales.length === 0) {
      return {
        totalWhalePower: 0,
        criticalRiskWallets: 0,
        priceImpactPercent: 0,
        dumpProbability: 0,
      };
    }

    const totalWhalePower = whales.reduce((sum, w) => sum + w.balance_percent_of_supply, 0);
    const criticalRiskWallets = whales.filter(w => w.unrealized_pnl_percent > 100).length;
    
    // If top 5 wallets dump, what's the price impact?
    const top5Power = whales.slice(0, 5).reduce((sum, w) => sum + w.balance_percent_of_supply, 0);
    const priceImpactPercent = top5Power * 0.5; // Rough estimate: 50% of holdings dumps

    // Dump probability increases with:
    // - High unrealized gains (want to lock profit)
    // - Long holding period (bored holders)
    // - Recent competitor token launch
    const dumpProbability = Math.min(
      100,
      criticalRiskWallets * 20 + // 20% per whale with >100% gains
      (totalWhalePower / 10) + // distributed power reduces risk
      (whales[0]?.holding_duration_days || 0) / 10 // longer holding = higher dump risk
    );

    return {
      totalWhalePower,
      criticalRiskWallets,
      priceImpactPercent,
      dumpProbability,
    };
  } catch (error) {
    console.error('Error analyzing whale risk:', error);
    return {
      totalWhalePower: 0,
      criticalRiskWallets: 0,
      priceImpactPercent: 0,
      dumpProbability: 0,
    };
  }
}

// FILE: web/src/lib/advanced-analytics/trader-leaderboard.ts

export interface TraderStats {
  wallet: string;
  totalVolume: number;
  profitableCount: number;
  loosingCount: number;
  winRate: number;
  bestTradePnL: number;
  worstTradePnL: number;
  avgTradePnL: number;
  totalPnL: number;
  tradeCount: number;
}

/**
 * Get top traders by PnL
 */
export async function getTopTradersByPnL(
  mint: string,
  limit: number = 100
): Promise<TraderStats[]> {
  try {
    const { data: transactions } = await supabase
      .from('transactions_extended')
      .select('*')
      .eq('mint_address', mint)
      .eq('direction', 'sell')
      .order('profit_loss_usd', { ascending: false })
      .limit(limit * 2); // Get more to aggregate by wallet

    if (!transactions) return [];

    const traderMap = new Map<string, TraderStats>();

    for (const tx of transactions) {
      const wallet = tx.seller_address;
      if (!wallet) continue;

      if (!traderMap.has(wallet)) {
        traderMap.set(wallet, {
          wallet,
          totalVolume: 0,
          profitableCount: 0,
          loosingCount: 0,
          winRate: 0,
          bestTradePnL: -Infinity,
          worstTradePnL: Infinity,
          avgTradePnL: 0,
          totalPnL: 0,
          tradeCount: 0,
        });
      }

      const stats = traderMap.get(wallet)!;
      const pnl = tx.profit_loss_usd || 0;

      stats.totalVolume += tx.usd_volume || 0;
      stats.tradeCount++;
      stats.totalPnL += pnl;
      stats.bestTradePnL = Math.max(stats.bestTradePnL, pnl);
      stats.worstTradePnL = Math.min(stats.worstTradePnL, pnl);
      
      if (pnl > 0) stats.profitableCount++;
      else stats.loosingCount++;
    }

    const traders = Array.from(traderMap.values());
    for (const trader of traders) {
      trader.winRate = trader.tradeCount > 0 ? (trader.profitableCount / trader.tradeCount) * 100 : 0;
      trader.avgTradePnL = trader.tradeCount > 0 ? trader.totalPnL / trader.tradeCount : 0;
    }

    return traders.sort((a, b) => b.totalPnL - a.totalPnL).slice(0, limit);
  } catch (error) {
    console.error('Error fetching top traders:', error);
    return [];
  }
}

// FILE: web/src/lib/advanced-analytics/risk-scoring.ts

export interface RiskProfile {
  holderConcentrationRisk: number;
  whaleDumpRisk: number;
  liquidityRisk: number;
  deployerRisk: number;
  authorityRisk: number;
  overallRiskScore: number;
}

export function calculateTokenRiskScore(tokenData: any): RiskProfile {
  let holderConcentrationRisk = 0;
  let liquidityRisk = 0;
  let deployerRisk = 0;
  let authorityRisk = 0;

  // Holder Concentration Risk (0-30 points)
  const top10 = tokenData.topHoldersPercent || 0;
  if (top10 > 50) holderConcentrationRisk = 30;
  else if (top10 > 30) holderConcentrationRisk = 20;
  else if (top10 > 20) holderConcentrationRisk = 10;
  else if (top10 > 10) holderConcentrationRisk = 5;

  // Liquidity Risk (0-25 points)
  const liq = tokenData.liquidity || 0;
  if (liq < 50000) liquidityRisk = 25;
  else if (liq < 200000) liquidityRisk = 15;
  else if (liq < 500000) liquidityRisk = 8;
  else if (liq < 1000000) liquidityRisk = 3;

  // Deployer Risk (0-25 points)
  const deployerSuccessRate = tokenData.deployerSuccessRate || 0.5;
  if (deployerSuccessRate < 0.1) deployerRisk = 25;
  else if (deployerSuccessRate < 0.3) deployerRisk = 15;
  else if (deployerSuccessRate < 0.5) deployerRisk = 8;

  // Authority Risk (0-20 points)
  if (!tokenData.mintAuthorityRenounced || !tokenData.freezeAuthorityRenounced) {
    authorityRisk = 20;
  }

  const overallRiskScore = Math.min(
    100,
    holderConcentrationRisk + liquidityRisk + deployerRisk + authorityRisk
  );

  return {
    holderConcentrationRisk,
    whaleDumpRisk: holderConcentrationRisk, // Related to concentration
    liquidityRisk,
    deployerRisk,
    authorityRisk,
    overallRiskScore,
  };
}

// FILE: web/src/lib/advanced-analytics/anomaly-detection.ts

export interface Anomaly {
  type: 'price_spike' | 'volume_spike' | 'liquidity_drop' | 'whale_activity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  value: number;
  threshold: number;
  percentChange: number;
  timestamp: number;
}

export async function detectAnomalies(mint: string): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  try {
    // Get last 100 candles (price spikes)
    const { data: candles } = await supabase
      .from('price_candles_extended')
      .select('*')
      .eq('mint_address', mint)
      .eq('timeframe', '5m')
      .order('candle_timestamp', { ascending: false })
      .limit(100);

    if (candles && candles.length > 0) {
      const recent = candles.slice(0, 20);
      const avgClose = recent.reduce((sum, c) => sum + (c.close_price || 0), 0) / recent.length;
      const latest = recent[0]?.close_price || 0;
      const priceChange = Math.abs((latest - avgClose) / avgClose) * 100;

      if (priceChange > 30) {
        anomalies.push({
          type: 'price_spike',
          severity: priceChange > 50 ? 'critical' : 'high',
          value: latest,
          threshold: avgClose,
          percentChange: priceChange,
          timestamp: Math.floor(Date.now() / 1000),
        });
      }

      // Volume anomaly
      const volumes = recent.map(c => c.volume_usd || 0);
      const avgVol = volumes.reduce((a, b) => a + b) / volumes.length;
      const stdDev = Math.sqrt(volumes.reduce((sum, v) => sum + Math.pow(v - avgVol, 2), 0) / volumes.length);

      if (volumes[0] > avgVol + (3 * stdDev)) {
        anomalies.push({
          type: 'volume_spike',
          severity: 'high',
          value: volumes[0],
          threshold: avgVol,
          percentChange: ((volumes[0] - avgVol) / avgVol) * 100,
          timestamp: Math.floor(Date.now() / 1000),
        });
      }
    }

    // Whale activity detection
    const { data: snapshots } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', mint)
      .order('snapshot_timestamp', { ascending: false })
      .limit(10);

    if (snapshots && snapshots.length > 1) {
      const latest = snapshots[0];
      const previous = snapshots[1];

      if (latest && previous) {
        const balanceChange = Math.abs(latest.balance - previous.balance) / previous.balance * 100;
        if (balanceChange > 10) {
          anomalies.push({
            type: 'whale_activity',
            severity: balanceChange > 50 ? 'critical' : 'high',
            value: latest.balance_usd || 0,
            threshold: previous.balance_usd || 0,
            percentChange: balanceChange,
            timestamp: Math.floor(Date.now() / 1000),
          });
        }
      }
    }
  } catch (error) {
    console.error('Error detecting anomalies:', error);
  }

  return anomalies;
}
