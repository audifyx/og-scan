// FILE: web/src/api/intelligence.ts
// API endpoints for advanced intelligence data export
// Can be deployed as Vercel serverless functions or API routes

import { supabase } from '@/lib/supabase';
import { predictTokenPrice, assessRugRisk } from '@/lib/ml-models';

/**
 * Get holder data with PnL
 */
export async function getHolders(mint: string, limit = 100, offset = 0) {
  try {
    const { data, error } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', mint)
      .order('balance_usd', { ascending: false })
      .range(offset, offset + limit);

    if (error) throw error;

    return {
      success: true,
      data,
      count: data?.length || 0,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get top traders leaderboard
 */
export async function getTopTraders(mint: string, limit = 100) {
  try {
    const { data, error } = await supabase
      .from('transactions_extended')
      .select('*')
      .eq('mint_address', mint)
      .eq('direction', 'sell')
      .order('profit_loss_usd', { ascending: false })
      .limit(limit * 2);

    if (error) throw error;

    // Aggregate by trader
    const traderMap = new Map<string, any>();
    for (const tx of data || []) {
      if (!tx.seller_address) continue;
      if (!traderMap.has(tx.seller_address)) {
        traderMap.set(tx.seller_address, {
          wallet: tx.seller_address,
          trades: [],
          totalPnL: 0,
        });
      }
      const trader = traderMap.get(tx.seller_address)!;
      trader.trades.push(tx);
      trader.totalPnL += tx.profit_loss_usd || 0;
    }

    const traders = Array.from(traderMap.values())
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, limit)
      .map(t => ({
        wallet: t.wallet,
        totalPnL: t.totalPnL,
        tradeCount: t.trades.length,
        winRate: (t.trades.filter((tx: any) => tx.profit_loss_usd > 0).length / t.trades.length) * 100,
      }));

    return {
      success: true,
      data: traders,
      count: traders.length,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get ML price prediction
 */
export async function getPricePrediction(mint: string) {
  try {
    const prediction = await predictTokenPrice(mint);

    if (!prediction) {
      return { success: false, error: 'Not enough data' };
    }

    return { success: true, data: prediction };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get rug pull risk assessment
 */
export async function getRugRisk(mint: string) {
  try {
    const rugRisk = await assessRugRisk(mint);

    if (!rugRisk) {
      return { success: false, error: 'Not enough data' };
    }

    return { success: true, data: rugRisk };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get recent anomalies
 */
export async function getAnomalies(mint: string, limit = 50, severity?: string) {
  try {
    let query = supabase
      .from('real_time_alerts')
      .select('*')
      .eq('mint_address', mint);

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query
      .order('triggered_timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { success: true, data, count: data?.length || 0 };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Export all data
 */
export async function exportData(mint: string) {
  try {
    const [holders, traders, anomalies, prediction, rugRisk] = await Promise.all([
      supabase.from('holder_snapshots').select('*').eq('mint_address', mint),
      supabase.from('transactions_extended').select('*').eq('mint_address', mint),
      supabase.from('real_time_alerts').select('*').eq('mint_address', mint),
      predictTokenPrice(mint),
      assessRugRisk(mint),
    ]);

    return {
      success: true,
      data: {
        mint,
        timestamp: new Date().toISOString(),
        holders: holders.data,
        transactions: traders.data,
        anomalies: anomalies.data,
        predictions: prediction,
        rugRisk,
      },
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
