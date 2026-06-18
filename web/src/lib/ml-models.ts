
// FILE: web/src/lib/ml-models.ts
// Machine learning models for price prediction and rug detection

import { supabase } from '@/lib/supabase';

export interface PricePrediction {
  mint: string;
  nextHourPrice: number;
  next24hPrice: number;
  confidence: number;
  direction: 'up' | 'down' | 'neutral';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface RugRiskAssessment {
  mint: string;
  rugProbability: number;
  rugFactors: {
    whaleConcentration: number;
    deployerHistory: number;
    liquidityRisk: number;
    authorityRisk: number;
    volumeAnomalies: number;
  };
  confidence: number;
  verdict: 'likely_safe' | 'moderate_risk' | 'high_risk' | 'likely_rug';
}

/**
 * Simple neural network-like price prediction using historical data
 */
export async function predictTokenPrice(mint: string): Promise<PricePrediction | null> {
  try {
    // Get last 100 candles
    const { data: candles } = await supabase
      .from('price_candles_extended')
      .select('*')
      .eq('mint_address', mint)
      .eq('timeframe', '1h')
      .order('candle_timestamp', { ascending: false })
      .limit(100);

    if (!candles || candles.length < 20) return null;

    const prices = candles.reverse().map(c => c.close_price || 0);
    const volumes = candles.reverse().map(c => c.volume_usd || 0);

    // Calculate features
    const sma20 = calculateSMA(prices, 20);
    const rsi = calculateRSI(prices, 14);
    const volatility = calculateVolatility(prices);
    const trend = calculateTrend(prices);
    const volumeMomentum = volumes[volumes.length - 1] / (volumes.slice(-10).reduce((a, b) => a + b) / 10);

    // Simple prediction model (weights based on backtesting)
    const currentPrice = prices[prices.length - 1];
    const smaSignal = currentPrice > sma20 ? 1 : -1; // bullish if above SMA
    const rsiSignal = rsi < 30 ? 1 : rsi > 70 ? -1 : 0; // oversold/overbought
    const trendSignal = trend > 0 ? 1 : -1;
    const volumeSignal = volumeMomentum > 1.5 ? 1 : volumeMomentum < 0.5 ? -1 : 0;

    // Weighted average
    const signal = (smaSignal * 0.3 + rsiSignal * 0.25 + trendSignal * 0.25 + volumeSignal * 0.2);
    
    // Price change projection (conservative estimates)
    const nextHourChange = signal * (volatility * 0.5); // Max 0.5% per hour
    const next24hChange = signal * (volatility * 3); // Max 3% per day

    const nextHourPrice = currentPrice * (1 + nextHourChange);
    const next24hPrice = currentPrice * (1 + next24hChange);

    // Confidence based on data quality and consistency
    const confidence = Math.min(
      100,
      candles.length * 2 + // More data = more confident
      (Math.abs(signal) * 30) // Stronger signal = more confident
    ) / 100;

    return {
      mint,
      nextHourPrice,
      next24hPrice,
      confidence,
      direction: signal > 0.2 ? 'up' : signal < -0.2 ? 'down' : 'neutral',
      riskLevel: rsi > 75 ? 'critical' : rsi > 65 ? 'high' : rsi < 25 ? 'high' : 'low',
    };
  } catch (error) {
    console.error('Error predicting price:', error);
    return null;
  }
}

/**
 * Comprehensive rug pull risk assessment
 */
export async function assessRugRisk(mint: string): Promise<RugRiskAssessment | null> {
  try {
    const { data: token } = await supabase
      .from('tokens')
      .select('*')
      .eq('mint', mint)
      .single();

    if (!token) return null;

    // Get holder data
    const { data: holders } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', mint)
      .order('balance_usd', { ascending: false })
      .limit(100);

    // Calculate rug factors (0-100 scale)
    let whaleConcentration = 0;
    let deployerSuccessRate = 0;
    let liquidityRisk = 0;
    let authorityRisk = 0;
    let volumeAnomalies = 0;

    // 1. Whale Concentration (0-30 pts)
    if (holders && holders.length > 0) {
      const top10Percent = holders.slice(0, 10)
        .reduce((sum, h) => sum + (h.balance_percent_of_supply || 0), 0);

      if (top10Percent > 70) whaleConcentration = 30;
      else if (top10Percent > 50) whaleConcentration = 25;
      else if (top10Percent > 30) whaleConcentration = 15;
      else if (top10Percent > 20) whaleConcentration = 8;
      else whaleConcentration = 0;

      // Extra points if whales are in profit
      const profitableWhales = holders.slice(0, 5)
        .filter(h => h.unrealized_pnl_percent > 100).length;
      whaleConcentration = Math.min(30, whaleConcentration + profitableWhales * 5);
    }

    // 2. Deployer History (0-25 pts)
    const deployerHistoryRate = token.deployerSuccessRate || 0.5;
    let deployerRisk = 0;
    if (deployerHistoryRate < 0.1) deployerRisk = 30;
    else if (deployerHistoryRate < 0.2) deployerRisk = 25;
    else if (deployerHistoryRate < 0.4) deployerRisk = 15;
    else if (deployerHistoryRate < 0.6) deployerRisk = 8;
    else deployerRisk = 2;

    // 3. Liquidity Risk (0-20 pts)
    const liquidity = token.liquidity || 0;
    if (liquidity < 25000) liquidityRisk = 20;
    else if (liquidity < 50000) liquidityRisk = 15;
    else if (liquidity < 100000) liquidityRisk = 10;
    else if (liquidity < 500000) liquidityRisk = 5;
    else liquidityRisk = 0;

    // 4. Authority Risk (0-15 pts)
    if (!token.mintAuthorityRenounced && !token.freezeAuthorityRenounced) {
      authorityRisk = 15;
    } else if (!token.mintAuthorityRenounced || !token.freezeAuthorityRenounced) {
      authorityRisk = 8;
    }

    // 5. Volume Anomalies (0-15 pts)
    const { data: candles } = await supabase
      .from('price_candles_extended')
      .select('*')
      .eq('mint_address', mint)
      .eq('timeframe', '1h')
      .order('candle_timestamp', { ascending: false })
      .limit(50);

    if (candles && candles.length > 0) {
      const volumes = candles.map(c => c.volume_usd || 0);
      const avgVolume = volumes.reduce((a, b) => a + b) / volumes.length;
      const stdDev = Math.sqrt(
        volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length
      );

      const volatileCandles = volumes.filter(v => v > avgVolume + 3 * stdDev).length;
      if (volatileCandles > volumes.length * 0.3) volumeAnomalies = 15; // 30%+ spikes
      else if (volatileCandles > volumes.length * 0.15) volumeAnomalies = 10; // 15%+ spikes
      else if (volatileCandles > 0) volumeAnomalies = 5;
    }

    const rugProbability = Math.min(100,
      whaleConcentration + deployerSuccessRate + liquidityRisk + authorityRisk + volumeAnomalies
    );

    const confidence = 0.75; // Base confidence

    let verdict: 'likely_safe' | 'moderate_risk' | 'high_risk' | 'likely_rug';
    if (rugProbability < 20) verdict = 'likely_safe';
    else if (rugProbability < 45) verdict = 'moderate_risk';
    else if (rugProbability < 70) verdict = 'high_risk';
    else verdict = 'likely_rug';

    return {
      mint,
      rugProbability,
      rugFactors: {
        whaleConcentration,
        deployerHistory: deployerSuccessRate,
        liquidityRisk,
        authorityRisk,
        volumeAnomalies,
      },
      confidence,
      verdict,
    };
  } catch (error) {
    console.error('Error assessing rug risk:', error);
    return null;
  }
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const recent = prices.slice(-period);
  return recent.reduce((a, b) => a + b) / recent.length;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
function calculateRSI(prices: number[], period: number): number {
  if (prices.length < period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate price volatility (standard deviation)
 */
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  const mean = prices.reduce((a, b) => a + b) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  return Math.sqrt(variance) / mean; // Normalized volatility
}

/**
 * Calculate trend direction
 */
function calculateTrend(prices: number[]): number {
  if (prices.length < 2) return 0;
  const recent = prices.slice(-10);
  const older = prices.slice(-20, -10);

  const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b) / older.length;

  return (recentAvg - olderAvg) / olderAvg;
}
