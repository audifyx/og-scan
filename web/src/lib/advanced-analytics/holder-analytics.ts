// FILE: web/src/lib/advanced-analytics/holder-analytics.ts
// Holder analysis functions for advanced intelligence

import { supabase } from '@/lib/supabase';

/**
 * Get top holders by PnL
 */
export async function getTopHoldersByPnL(mint: string, limit: number = 100) {
  try {
    const { data, error } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', mint)
      .order('unrealized_pnl_usd', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map(h => ({
      wallet: h.wallet_address,
      balanceUsd: h.balance_usd || 0,
      balance: h.balance || 0,
      entryPrice: h.avg_entry_price || 0,
      unrealizedPnL: h.unrealized_pnl_percent || 0,
      realizedPnL: h.realized_pnl_usd || 0,
      classification: h.classification,
      holdingDays: h.holding_duration_days || 0,
    }));
  } catch (error) {
    console.error('Error getting top holders:', error);
    return [];
  }
}

/**
 * Get top traders by PnL
 */
export async function getTopTradersByPnL(mint: string, limit: number = 100) {
  try {
    const { data: transactions } = await supabase
      .from('transactions_extended')
      .select('*')
      .eq('mint_address', mint)
      .eq('direction', 'sell')
      .limit(10000);

    if (!transactions) return [];

    const traderMap = new Map<string, any>();
    for (const tx of transactions) {
      if (!tx.seller_address) continue;
      if (!traderMap.has(tx.seller_address)) {
        traderMap.set(tx.seller_address, {
          wallet: tx.seller_address,
          trades: [],
          totalPnL: 0,
          totalVolume: 0,
        });
      }
      const trader = traderMap.get(tx.seller_address)!;
      trader.trades.push(tx);
      trader.totalPnL += tx.profit_loss_usd || 0;
      trader.totalVolume += tx.usd_volume || 0;
    }

    return Array.from(traderMap.values())
      .map(t => ({
        wallet: t.wallet,
        totalPnL: t.totalPnL,
        totalVolume: t.totalVolume,
        tradeCount: t.trades.length,
        winRate: (t.trades.filter((tx: any) => tx.profit_loss_usd > 0).length / t.trades.length) * 100,
      }))
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting top traders:', error);
    return [];
  }
}

/**
 * Analyze whale risk
 */
export async function analyzeWhaleRisk(mint: string) {
  try {
    const { data: holders } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', mint)
      .order('balance_usd', { ascending: false })
      .limit(100);

    if (!holders || holders.length === 0) {
      return {
        totalWhalePower: 0,
        criticalRiskWallets: 0,
        dumpProbability: 0,
        priceImpactPercent: 0,
      };
    }

    const whales = holders.filter(h => (h.balance_percent_of_supply || 0) > 1);
    const totalWhalePower = whales.reduce((sum, h) => sum + (h.balance_percent_of_supply || 0), 0);
    const criticalRiskWallets = whales.filter(h => (h.unrealized_pnl_percent || 0) > 100).length;

    const dumpProbability = Math.min(100, totalWhalePower * 2 + criticalRiskWallets * 10);
    const priceImpactPercent = totalWhalePower / 5;

    return {
      totalWhalePower,
      criticalRiskWallets,
      dumpProbability,
      priceImpactPercent,
    };
  } catch (error) {
    console.error('Error analyzing whale risk:', error);
    return {
      totalWhalePower: 0,
      criticalRiskWallets: 0,
      dumpProbability: 0,
      priceImpactPercent: 0,
    };
  }
}
