import { Token } from '@/lib/og';
import { supabase } from '@/lib/supabase';

export async function fetchCompleteTokenData(token: Token) {
  const mint = token.mint;

  const [holders, transactions, anomalies, whaleRisk, predictions, rugRisk] = await Promise.all([
    fetchHolders(mint),
    fetchTransactions(mint),
    fetchAnomalies(mint),
    fetchWhaleAnalysis(mint),
    fetchPredictions(mint),
    fetchRugRisk(mint),
  ]).catch(err => {
    console.warn('Data fetch:', err);
    return [[], [], [], null, null, null];
  });

  return {
    token: {
      name: token.name,
      symbol: token.symbol || '',
      mint: token.mint,
      chain: 'solana',
      decimals: token.decimals || 9,
      creation_time: token.createdAt || null,
      market_cap: token.marketCapUsd || 0,
      liquidity: token.liquidityUsd || 0,
      volume_24h: token.volume24hUsd || 0,
      price: token.priceUsd || 0,
      price_change_24h: token.stats24h?.priceChange || 0,
      holders_count: token.holderCount || 0,
    },
    holders_data: holders,
    transactions_data: transactions,
    anomalies_data: anomalies,
    whaleRisk_data: whaleRisk,
    predictions_data: predictions,
    rugRisk_data: rugRisk,
  };
}

async function fetchHolders(mint: string) {
  try {
    const { data } = await supabase.from('holder_snapshots').select('*').eq('mint_address', mint).order('balance_usd', { ascending: false }).limit(100);
    return (data || []).map((h: any) => ({
      wallet: h.wallet_address,
      balance: h.balance_tokens || 0,
      usd_value: h.balance_usd || 0,
      percentage: h.balance_percent_of_supply || 0,
      unrealized_pnl: h.unrealized_pnl_usd || 0,
      type: h.classification || 'unknown',
    }));
  } catch (err) {
    return [];
  }
}

async function fetchTransactions(mint: string) {
  try {
    const { data } = await supabase.from('transactions_extended').select('*').eq('mint_address', mint).order('blockchain_timestamp', { ascending: false }).limit(500);
    return data || [];
  } catch (err) {
    return [];
  }
}

async function fetchAnomalies(mint: string) {
  try {
    const { data } = await supabase.from('real_time_alerts').select('*').eq('mint_address', mint).order('triggered_timestamp', { ascending: false }).limit(100);
    return data || [];
  } catch (err) {
    return [];
  }
}

async function fetchWhaleAnalysis(mint: string) {
  try {
    const { analyzeWhaleRisk } = await import('@/lib/advanced-analytics/holder-analytics');
    return await analyzeWhaleRisk(mint);
  } catch (err) {
    return null;
  }
}

async function fetchPredictions(mint: string) {
  try {
    const { predictTokenPrice } = await import('@/lib/ml-models');
    return await predictTokenPrice(mint);
  } catch (err) {
    return null;
  }
}

async function fetchRugRisk(mint: string) {
  try {
    const { assessRugRisk } = await import('@/lib/ml-models');
    return await assessRugRisk(mint);
  } catch (err) {
    return null;
  }
}
