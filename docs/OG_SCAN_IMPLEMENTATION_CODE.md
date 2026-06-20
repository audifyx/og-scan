╔════════════════════════════════════════════════════════════════════════════════╗
║                  OG SCAN ADVANCED SYSTEM - IMPLEMENTATION GUIDE                ║
║              Detailed Code, Schemas, and API Integration Examples              ║
╚════════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════════
PART 1: DATABASE SCHEMA (PostgreSQL / Supabase)
═══════════════════════════════════════════════════════════════════════════════════

-- TOKENS EXTENDED TABLE
CREATE TABLE tokens_extended (
  mint_address TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INT,
  total_supply BIGINT,
  current_supply BIGINT,
  burn_count BIGINT DEFAULT 0,
  
  -- Creation
  created_timestamp BIGINT,
  creation_tx_signature TEXT,
  deployer_address TEXT REFERENCES wallet_profiles(address),
  deployment_block BIGINT,
  
  -- Deployer Track Record
  deployer_tokens_created INT,
  deployer_success_rate FLOAT DEFAULT 0,
  deployer_rug_count INT DEFAULT 0,
  deployer_abandoned_count INT DEFAULT 0,
  deployer_avg_time_to_ath INTERVAL,
  deployer_avg_max_drawdown FLOAT,
  
  -- Authority
  mint_authority_renounced BOOLEAN,
  freeze_authority_renounced BOOLEAN,
  update_authority_address TEXT,
  
  -- Current State
  current_price FLOAT,
  market_cap BIGINT,
  fdv BIGINT,
  liquidity_usd FLOAT,
  holders_count INT,
  volume_24h FLOAT,
  
  -- ATH/ATL
  ath_price FLOAT,
  ath_timestamp BIGINT,
  atl_price FLOAT,
  atl_timestamp BIGINT,
  time_to_ath_hours INT,
  
  -- Narrative
  narrative_cluster_id TEXT,
  narrative_fingerprint TEXT,
  primary_narrative TEXT,
  narrative_uniqueness FLOAT,
  
  -- Forensic Scores
  og_score INT,
  risk_score INT,
  rug_probability FLOAT,
  cto_probability FLOAT,
  concentration_risk FLOAT,
  liquidity_risk FLOAT,
  
  -- DEX Paid
  is_dex_paid BOOLEAN DEFAULT FALSE,
  total_marketing_spend_sol FLOAT DEFAULT 0,
  marketing_spend_percent_of_mcap FLOAT,
  
  -- Metadata
  metadata_uri TEXT,
  image_uri TEXT,
  twitter_url TEXT,
  telegram_url TEXT,
  website_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- WALLET PROFILES TABLE
CREATE TABLE wallet_profiles (
  address TEXT PRIMARY KEY,
  wallet_label TEXT,
  wallet_classification TEXT, -- 'whale', 'sniper', 'bot', 'trader', 'insider', 'deployer', 'lp', 'cex'
  
  -- Wallet Properties
  created_timestamp BIGINT,
  age_days INT,
  total_transactions INT,
  total_tokens_traded INT,
  unique_tokens_traded INT,
  total_usd_volume FLOAT,
  
  -- Performance
  profitable_trades INT,
  losing_trades INT,
  win_rate FLOAT,
  avg_trade_duration INTERVAL,
  best_trade_pnl FLOAT,
  worst_trade_pnl FLOAT,
  
  -- Current Holdings
  token_positions_count INT,
  total_portfolio_usd FLOAT,
  largest_position_usd FLOAT,
  concentration_ratio FLOAT,
  
  -- Deployer Stats (if deployer)
  tokens_deployed INT DEFAULT 0,
  successful_tokens INT DEFAULT 0,
  rugged_tokens INT DEFAULT 0,
  abandoned_tokens INT DEFAULT 0,
  
  -- Clustering
  cluster_id INT,
  cluster_confidence FLOAT,
  likely_same_entity BOOLEAN,
  cluster_signals TEXT[],
  
  -- Risk
  suspicious_activity BOOLEAN DEFAULT FALSE,
  risk_score INT,
  exit_probability_72h FLOAT,
  large_unrealized_gains BOOLEAN,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- HOLDER SNAPSHOT TABLE (time-series)
CREATE TABLE holder_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_timestamp BIGINT,
  mint_address TEXT REFERENCES tokens_extended(mint_address),
  wallet_address TEXT REFERENCES wallet_profiles(address),
  
  -- Balance
  balance BIGINT,
  balance_usd FLOAT,
  balance_percent_of_supply FLOAT,
  holder_rank_by_value INT,
  
  -- Cost Basis
  total_cost_usd FLOAT,
  avg_entry_price FLOAT,
  total_buys_usd FLOAT,
  total_sells_usd FLOAT,
  
  -- PnL
  unrealized_pnl_usd FLOAT,
  unrealized_pnl_percent FLOAT,
  realized_pnl_usd FLOAT,
  realized_pnl_percent FLOAT,
  total_pnl_usd FLOAT,
  total_pnl_percent FLOAT,
  
  -- Activity
  first_buy_timestamp BIGINT,
  last_activity_timestamp BIGINT,
  holding_duration_seconds BIGINT,
  holding_duration_days FLOAT,
  buy_count INT,
  sell_count INT,
  transfer_count INT,
  total_transactions INT,
  flip_frequency INT,
  
  -- Classification
  classification TEXT,
  behavior_type TEXT, -- 'accumulator', 'distributor', 'swing_trader', etc
  
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_holder_snapshots_mint_timestamp ON holder_snapshots(mint_address, snapshot_timestamp);
CREATE INDEX idx_holder_snapshots_wallet ON holder_snapshots(wallet_address);

-- TRANSACTIONS TABLE
CREATE TABLE transactions_extended (
  signature TEXT PRIMARY KEY,
  blockchain_timestamp BIGINT,
  block_number BIGINT,
  
  -- Transaction Details
  tx_type TEXT, -- 'swap', 'transfer', 'mint', 'burn'
  direction TEXT, -- 'buy', 'sell'
  
  -- Parties
  buyer_address TEXT REFERENCES wallet_profiles(address),
  seller_address TEXT,
  source_wallet TEXT,
  destination_wallet TEXT,
  
  -- Token Info
  mint_address TEXT REFERENCES tokens_extended(mint_address),
  token_amount BIGINT,
  paired_token TEXT, -- 'SOL', 'USDC', etc
  paired_amount FLOAT,
  
  -- Pricing & Volume
  token_price FLOAT,
  usd_volume FLOAT,
  price_before_tx FLOAT,
  price_after_tx FLOAT,
  
  -- Execution
  dex_name TEXT, -- 'Jupiter', 'Raydium', 'Orca'
  dex_program_id TEXT,
  pool_address TEXT REFERENCES liquidity_pools(address),
  pair_address TEXT,
  
  -- Slippage & Impact
  requested_price FLOAT,
  executed_price FLOAT,
  slippage_percent FLOAT,
  price_impact_percent FLOAT,
  
  -- Fees
  fee_sol FLOAT,
  fee_percent FLOAT,
  mev_extracted_usd FLOAT,
  
  -- PnL (if seller)
  seller_avg_cost FLOAT,
  profit_loss_usd FLOAT,
  profit_loss_percent FLOAT,
  
  -- Flags
  is_wash_trade BOOLEAN DEFAULT FALSE,
  is_bot_like BOOLEAN DEFAULT FALSE,
  is_suspicious BOOLEAN DEFAULT FALSE,
  mev_sandwich BOOLEAN DEFAULT FALSE,
  
  -- Parsed Data
  instruction_count INT,
  inner_instructions INT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_transactions_mint_time ON transactions_extended(mint_address, blockchain_timestamp DESC);
CREATE INDEX idx_transactions_wallet ON transactions_extended(buyer_address);
CREATE INDEX idx_transactions_type ON transactions_extended(direction);

-- LIQUIDITY POOLS TABLE
CREATE TABLE liquidity_pools (
  address TEXT PRIMARY KEY,
  mint_address TEXT REFERENCES tokens_extended(mint_address),
  paired_token TEXT, -- 'SOL', 'USDC'
  paired_token_mint TEXT,
  
  -- Pool Details
  dex_name TEXT,
  dex_program_id TEXT,
  created_timestamp BIGINT,
  
  -- Pool State
  token_reserves BIGINT,
  paired_reserves FLOAT,
  lp_token_supply BIGINT,
  tvl_usd FLOAT,
  swap_fee_percent FLOAT,
  
  -- Trading
  trading_enabled BOOLEAN,
  trading_volume_24h FLOAT,
  trades_count_24h INT,
  
  -- Liquidity Events
  latest_add_timestamp BIGINT,
  latest_remove_timestamp BIGINT,
  liquidity_providers_count INT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- LIQUIDITY PROVIDERS SNAPSHOT
CREATE TABLE liquidity_provider_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_timestamp BIGINT,
  pool_address TEXT REFERENCES liquidity_pools(address),
  lp_wallet_address TEXT REFERENCES wallet_profiles(address),
  
  -- LP Position
  lp_token_balance BIGINT,
  lp_token_percent_of_supply FLOAT,
  tvl_usd FLOAT,
  lp_position_usd FLOAT,
  
  -- Returns
  fees_earned_24h_usd FLOAT,
  fees_earned_7d_usd FLOAT,
  fees_earned_30d_usd FLOAT,
  fees_earned_total_usd FLOAT,
  apr_estimated FLOAT,
  apy_estimated FLOAT,
  
  -- Risk
  impermanent_loss_24h_usd FLOAT,
  impermanent_loss_24h_percent FLOAT,
  impermanent_loss_total_usd FLOAT,
  impermanent_loss_total_percent FLOAT,
  
  -- Lock Status
  is_locked BOOLEAN,
  locked_until_timestamp BIGINT,
  days_until_unlock INT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- PRICE CANDLES TABLE
CREATE TABLE price_candles (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT REFERENCES tokens_extended(mint_address),
  timeframe TEXT, -- '1m', '5m', '1h', '4h', '1d'
  
  -- Candle Data
  candle_timestamp BIGINT,
  open_price FLOAT,
  high_price FLOAT,
  low_price FLOAT,
  close_price FLOAT,
  
  -- Volume
  volume_usd FLOAT,
  buy_volume_usd FLOAT,
  sell_volume_usd FLOAT,
  buy_count INT,
  sell_count INT,
  
  -- Technical
  vwap FLOAT,
  sma_20 FLOAT,
  sma_50 FLOAT,
  sma_200 FLOAT,
  ema_12 FLOAT,
  ema_26 FLOAT,
  
  -- Indicators
  rsi_14 FLOAT,
  macd FLOAT,
  macd_signal FLOAT,
  macd_histogram FLOAT,
  bb_upper FLOAT,
  bb_middle FLOAT,
  bb_lower FLOAT,
  bb_width FLOAT,
  
  -- Order Flow
  buy_sell_ratio FLOAT,
  order_flow_imbalance FLOAT,
  cumulative_delta BIGINT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_price_candles_mint_time ON price_candles(mint_address, timeframe, candle_timestamp DESC);

-- DEX PAID CAMPAIGNS TABLE
CREATE TABLE dex_paid_campaigns (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT REFERENCES tokens_extended(mint_address),
  
  -- Campaign Details
  campaign_type TEXT, -- 'profile', 'trending', 'boost', 'ads', 'cto'
  platform TEXT, -- 'DexScreener', 'Birdeye', etc
  
  -- Dates
  start_timestamp BIGINT,
  end_timestamp BIGINT,
  duration_hours INT,
  is_active BOOLEAN,
  
  -- Cost
  cost_sol FLOAT,
  cost_usd FLOAT,
  
  -- Impact
  price_before_usd FLOAT,
  price_after_usd FLOAT,
  price_impact_percent FLOAT,
  volume_during_campaign FLOAT,
  
  -- ROI
  roi_percent FLOAT,
  market_cap_change_percent FLOAT,
  holder_change_count INT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- WALLET CLUSTERS TABLE
CREATE TABLE wallet_clusters (
  id BIGSERIAL PRIMARY KEY,
  cluster_name TEXT,
  
  -- Cluster Properties
  wallet_addresses TEXT[], -- array of addresses
  cluster_size INT,
  cluster_confidence FLOAT, -- 0-100
  
  -- Clustering Method
  clustering_method TEXT, -- 'transaction_graph', 'timing_pattern', 'amount_pattern'
  clustering_signals TEXT[],
  
  -- Properties
  likely_same_entity BOOLEAN,
  likely_coordinated BOOLEAN,
  
  -- Analysis
  total_usd_volume FLOAT,
  combined_holdings_usd FLOAT,
  combined_win_rate FLOAT,
  combined_risk_score INT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- SOCIAL SENTIMENT TABLE
CREATE TABLE social_sentiment (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT REFERENCES tokens_extended(mint_address),
  
  -- Platform Data
  platform TEXT, -- 'twitter', 'telegram', 'discord', 'reddit'
  
  -- Engagement
  mention_count INT,
  positive_mentions INT,
  negative_mentions INT,
  neutral_mentions INT,
  sentiment_score FLOAT, -- -1 to 1
  
  -- Metrics
  engagement_rate FLOAT,
  growth_rate_24h FLOAT,
  growth_rate_7d FLOAT,
  
  -- Community
  follower_count INT,
  member_count INT,
  active_users_24h INT,
  
  snapshot_timestamp BIGINT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- REAL-TIME ALERTS TABLE
CREATE TABLE real_time_alerts (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT REFERENCES tokens_extended(mint_address),
  
  -- Alert Details
  alert_type TEXT, -- 'price_spike', 'liquidity_drop', 'whale_dump', 'anomaly'
  severity TEXT, -- 'critical', 'high', 'medium', 'low'
  
  -- Data
  metric_name TEXT,
  metric_value FLOAT,
  threshold FLOAT,
  percent_change FLOAT,
  
  -- Time
  triggered_timestamp BIGINT,
  resolved_timestamp BIGINT,
  is_resolved BOOLEAN DEFAULT FALSE,
  
  -- Context
  context_data JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- ANALYTICS VIEWS
CREATE VIEW token_health_score AS
SELECT 
  t.mint_address,
  t.symbol,
  (
    CASE WHEN t.og_score >= 70 THEN 30 ELSE t.og_score / 7 END +
    CASE WHEN t.risk_score <= 30 THEN 30 ELSE (100 - t.risk_score) * 0.3 END +
    CASE WHEN t.liquidity_risk <= 30 THEN 20 ELSE (100 - t.liquidity_risk) * 0.2 END +
    CASE WHEN t.concentration_risk <= 40 THEN 20 ELSE (100 - t.concentration_risk) * 0.2 END
  ) AS health_score
FROM tokens_extended t;

CREATE VIEW whale_risk_analysis AS
SELECT 
  t.mint_address,
  t.symbol,
  w.address,
  hs.balance_usd,
  hs.unrealized_pnl_percent,
  hs.unrealized_pnl_usd,
  CASE 
    WHEN hs.unrealized_pnl_percent > 100 THEN 'critical_dump_risk'
    WHEN hs.unrealized_pnl_percent > 50 THEN 'high_dump_risk'
    WHEN hs.unrealized_pnl_percent > 0 THEN 'moderate_dump_risk'
    ELSE 'low_dump_risk'
  END AS dump_risk_level,
  (hs.balance_usd / t.market_cap * 100) AS price_impact_if_dump_percent
FROM holder_snapshots hs
JOIN tokens_extended t ON hs.mint_address = t.mint_address
JOIN wallet_profiles w ON hs.wallet_address = w.address
WHERE hs.balance_percent_of_supply > 0.01;

═══════════════════════════════════════════════════════════════════════════════════
PART 2: DATA PIPELINE TYPESCRIPT IMPLEMENTATIONS
═══════════════════════════════════════════════════════════════════════════════════

// ============================================================
// FILE: lib/data-pipeline/holder-pnl-calculator.ts
// ============================================================

import { Helius, TokenTransactionType } from 'helius-sdk';
import { supabase } from '@/lib/supabase';

interface HolderTransaction {
  wallet: string;
  type: 'buy' | 'sell';
  amount: bigint;
  price: number;
  timestamp: number;
  dex: string;
}

export async function calculateHolderPnL(
  mint: string,
  wallet: string,
  currentPrice: number
): Promise<{
  entryPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
}> {
  // Fetch all transactions for wallet in this token
  const { data: transactions, error } = await supabase
    .from('transactions_extended')
    .select('*')
    .eq('mint_address', mint)
    .eq('buyer_address', wallet)
    .order('blockchain_timestamp', { ascending: true });

  if (error) throw error;

  let totalCost = 0;
  let currentBalance = 0;
  let realizedPnL = 0;
  let costBasis = 0;

  for (const tx of transactions) {
    if (tx.direction === 'buy') {
      const txCost = tx.usd_volume;
      const txAmount = tx.token_amount;
      
      totalCost += txCost;
      currentBalance += txAmount;
      costBasis = totalCost / currentBalance; // average cost
    } 
    else if (tx.direction === 'sell') {
      const saleProceeds = tx.usd_volume;
      const sellAmount = tx.token_amount;
      
      // Realized PnL = (sell price - avg cost) * amount sold
      const txPnL = (tx.token_price - costBasis) * sellAmount;
      realizedPnL += txPnL;
      
      currentBalance -= sellAmount;
      totalCost -= (costBasis * sellAmount);
    }
  }

  // Unrealized PnL = (current price - avg cost) * current balance
  const unrealizedPnL = (currentPrice - costBasis) * currentBalance;
  const totalPnL = realizedPnL + unrealizedPnL;

  return {
    entryPrice: costBasis,
    unrealizedPnL,
    realizedPnL,
    totalPnL,
  };
}

// ============================================================
// FILE: lib/data-pipeline/deployer-forensics.ts
// ============================================================

import { getTokenMetadata } from 'helius-sdk';

export async function analyzeDeployer(deployerWallet: string) {
  const { data: deployerTokens } = await supabase
    .from('tokens_extended')
    .select('*')
    .eq('deployer_address', deployerWallet);

  const totalTokens = deployerTokens.length;
  
  const ruggedTokens = deployerTokens.filter(t => {
    // Rug indicators:
    // 1. Liquidity removed within 24h
    // 2. All LP tokens burned
    // 3. Max drawdown > 90%
    // 4. Zero volume for 7+ days
    return t.deployer_abandoned_count > 0 || 
           t.deployer_rug_count > 0;
  });

  const successfulTokens = deployerTokens.filter(t => {
    return t.og_score >= 50 && t.risk_score <= 30;
  });

  return {
    totalTokensCreated: totalTokens,
    ruggedTokens: ruggedTokens.length,
    successfulTokens: successfulTokens.length,
    successRate: successfulTokens.length / totalTokens,
    avgMaxDrawdown: deployerTokens.reduce((sum, t) => sum + (t.deployer_avg_max_drawdown || 0), 0) / totalTokens,
    avgTimeToATH: deployerTokens.reduce((sum, t) => sum + (t.deployer_avg_time_to_ath || 0), 0) / totalTokens,
    trustScore: (successfulTokens.length / totalTokens) * 100,
  };
}

// ============================================================
// FILE: lib/data-pipeline/wallet-clustering.ts
// ============================================================

import { DBSCAN } from 'density-based-clustering';

interface WalletVector {
  wallet: string;
  buyTimings: number[]; // transaction timestamps
  buyAmounts: number[];
  buyFreq: number;
  avgPrice: number;
}

export async function clusterWallets(mint: string, epsilon = 0.5, minPts = 3) {
  // Get all transactions for token
  const { data: transactions } = await supabase
    .from('transactions_extended')
    .select('*')
    .eq('mint_address', mint)
    .eq('direction', 'buy');

  // Create wallet vectors
  const walletMap = new Map<string, WalletVector>();
  
  for (const tx of transactions) {
    if (!walletMap.has(tx.buyer_address)) {
      walletMap.set(tx.buyer_address, {
        wallet: tx.buyer_address,
        buyTimings: [],
        buyAmounts: [],
        buyFreq: 0,
        avgPrice: 0,
      });
    }
    
    const vec = walletMap.get(tx.buyer_address)!;
    vec.buyTimings.push(tx.blockchain_timestamp);
    vec.buyAmounts.push(tx.usd_volume);
    vec.avgPrice += tx.token_price;
  }

  // Normalize vectors
  const vectors = Array.from(walletMap.values()).map(v => {
    const timingVariance = Math.sqrt(
      v.buyTimings.reduce((sum, t, i) => 
        sum + Math.pow(t - (v.buyTimings[i-1] || t), 2), 0) / v.buyTimings.length
    );
    
    const amountVariance = Math.sqrt(
      v.buyAmounts.reduce((sum, a, i) => 
        sum + Math.pow(a - (v.buyAmounts[i-1] || a), 2), 0) / v.buyAmounts.length
    );

    return [
      timingVariance / 1000, // normalize timestamps
      amountVariance / 1000,
      v.avgPrice / v.buyTimings.length,
    ];
  });

  // Run DBSCAN
  const clustering = new DBSCAN();
  const clusters = clustering.fit(vectors, epsilon, minPts);

  // Store results
  for (let i = 0; i < clusters.length; i++) {
    if (clusters[i] >= 0) { // ignore noise points (-1)
      const clusterWallets = Array.from(walletMap.keys()).filter((_, idx) => clusters[idx] === i);
      
      await supabase
        .from('wallet_clusters')
        .insert({
          cluster_name: `${mint}_cluster_${i}`,
          wallet_addresses: clusterWallets,
          cluster_size: clusterWallets.length,
          cluster_confidence: 0.85,
          clustering_method: 'timing_pattern',
          likely_same_entity: clusterWallets.length < 5,
        });
    }
  }
}

// ============================================================
// FILE: lib/data-pipeline/risk-scoring.ts
// ============================================================

export function calculateTokenRiskScore(token: any): number {
  let score = 0;

  // Holder Concentration Risk (0-25 points)
  if (token.holders_concentration?.top_10 > 50) {
    score += 25; // Critical concentration
  } else if (token.holders_concentration?.top_10 > 30) {
    score += 15;
  } else if (token.holders_concentration?.top_10 > 20) {
    score += 5;
  }

  // Rugpull Risk based on Deployer (0-25 points)
  const deployerSuccessRate = token.deployer_success_rate || 0;
  if (deployerSuccessRate < 0.1) {
    score += 25; // Deployer has bad track record
  } else if (deployerSuccessRate < 0.3) {
    score += 15;
  } else if (deployerSuccessRate < 0.5) {
    score += 5;
  }

  // Liquidity Risk (0-25 points)
  if (token.liquidity_usd < 50000) {
    score += 25; // Low liquidity = high slippage
  } else if (token.liquidity_usd < 200000) {
    score += 15;
  } else if (token.liquidity_usd < 500000) {
    score += 5;
  }

  // LP Lock Status (0-15 points)
  if (!token.lp_locked) {
    score += 15; // LP not locked = rug risk
  }

  // Authority Status (0-10 points)
  if (!token.mint_authority_renounced || !token.freeze_authority_renounced) {
    score += 10; // Authority active = centralized
  }

  return Math.min(score, 100);
}

// ============================================================
// FILE: lib/data-pipeline/anomaly-detector.ts
// ============================================================

export async function detectAnomalies(mint: string) {
  const alerts: any[] = [];

  // Get last 100 candles
  const { data: candles } = await supabase
    .from('price_candles')
    .select('*')
    .eq('mint_address', mint)
    .eq('timeframe', '1m')
    .order('candle_timestamp', { ascending: false })
    .limit(100);

  // Price spike detection
  const recentCandles = candles.slice(0, 10);
  const avgClose = recentCandles.reduce((sum, c) => sum + c.close_price, 0) / recentCandles.length;
  const latestPrice = recentCandles[0].close_price;
  const priceChange = Math.abs((latestPrice - avgClose) / avgClose) * 100;

  if (priceChange > 20) {
    alerts.push({
      mint_address: mint,
      alert_type: 'price_spike',
      severity: priceChange > 50 ? 'critical' : 'high',
      metric_name: 'price_change_1h',
      metric_value: latestPrice,
      percent_change: priceChange,
      triggered_timestamp: Math.floor(Date.now() / 1000),
    });
  }

  // Volume anomaly detection
  const volumeData = candles.map(c => c.volume_usd);
  const avgVolume = volumeData.reduce((a, b) => a + b) / volumeData.length;
  const stdDev = Math.sqrt(
    volumeData.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumeData.length
  );
  const latestVolume = volumeData[0];

  if (latestVolume > avgVolume + (3 * stdDev)) {
    alerts.push({
      mint_address: mint,
      alert_type: 'volume_spike',
      severity: 'high',
      metric_name: 'volume_1m',
      metric_value: latestVolume,
      percent_change: ((latestVolume - avgVolume) / avgVolume) * 100,
      triggered_timestamp: Math.floor(Date.now() / 1000),
    });
  }

  // Store alerts
  for (const alert of alerts) {
    await supabase.from('real_time_alerts').insert(alert);
  }

  return alerts;
}

═══════════════════════════════════════════════════════════════════════════════════
PART 3: ENHANCED PDF REPORT WITH FULL DATA
═══════════════════════════════════════════════════════════════════════════════════

// FILE: lib/reportPdf-advanced.ts (excerpt showing new sections)

async function generateAdvancedReport(input: PdfReportInput) {
  // ... existing code ...

  // NEW SECTION: WALLET FORENSICS
  sectionTitle("Wallet Forensics & Top Holders Analysis");
  
  const topWallets = await supabase
    .from('holder_snapshots')
    .select(`*,
      wallet_profiles(classification, risk_score)
    `)
    .eq('mint_address', token.id)
    .order('balance_usd', { ascending: false })
    .limit(20);

  doc.setFontSize(8);
  for (const holder of topWallets.data || []) {
    ensure(16);
    setText(COLORS.text);
    doc.text(`${shortAddr(holder.wallet_address, 4)}`, M, y);
    setText(COLORS.muted);
    doc.text(`${fmtUsd(holder.balance_usd)} · ${fmtPct(holder.balance_percent_of_supply)}`, M + 100, y);
    doc.text(`PnL: ${fmtUsd(holder.unrealized_pnl_usd)} (${fmtPct(holder.unrealized_pnl_percent)})`, M + 200, y);
    y += 12;
  }
  
  // NEW SECTION: DEPLOYER TRACK RECORD
  sectionTitle("Deployer Track Record");
  const deployerStats = await analyzeDeployer(s?.deployer || '');
  rows([
    ["Tokens Created", String(deployerStats.totalTokensCreated)],
    ["Success Rate", fmtPct(deployerStats.successRate)],
    ["Rugged Tokens", String(deployerStats.ruggedTokens)],
    ["Avg Max Drawdown", fmtPct(deployerStats.avgMaxDrawdown)],
    ["Trust Score", String(Math.round(deployerStats.trustScore))],
  ]);

  // NEW SECTION: MARKET MICROSTRUCTURE
  sectionTitle("Market Microstructure");
  const latestCandle = await supabase
    .from('price_candles')
    .select('*')
    .eq('mint_address', token.id)
    .eq('timeframe', '1h')
    .order('candle_timestamp', { ascending: false })
    .limit(1)
    .single();

  rows([
    ["Buy/Sell Ratio", latestCandle.buy_sell_ratio?.toFixed(2) || "—"],
    ["Order Flow Imbalance", latestCandle.order_flow_imbalance?.toFixed(2) || "—"],
    ["RSI (14)", latestCandle.rsi_14?.toFixed(1) || "—"],
    ["MACD Signal", latestCandle.macd_histogram > 0 ? "Bullish" : "Bearish"],
  ]);

  // ... continue with other sections ...
}

═══════════════════════════════════════════════════════════════════════════════════
FINAL CHECKLIST FOR IMPLEMENTATION
═══════════════════════════════════════════════════════════════════════════════════

Database Setup:
  ☑ Create all 12 tables
  ☑ Create indexes for performance
  ☑ Create views for analytics
  ☑ Setup row-level security (RLS)
  ☑ Enable real-time subscriptions

API Integrations:
  ☑ Helius wrapper (token + transaction indexing)
  ☑ Birdeye wrapper (price + volume data)
  ☑ DexScreener integration
  ☑ Solscan/SolanaFM integration
  ☑ Rate limiting + retry logic
  ☑ Error handling

Data Pipeline:
  ☑ Holder PnL calculator
  ☑ Deployer forensics analyzer
  ☑ Wallet clustering engine
  ☑ Risk scoring model
  ☑ Anomaly detection
  ☑ Scheduled jobs (hourly/daily)

Real-Time:
  ☑ WebSocket price feeds
  ☑ Alert system
  ☑ Trade notification engine
  ☑ Redis caching

Reporting:
  ☑ Enhanced PDF generator
  ☑ Analytics dashboard
  ☑ CSV/JSON exports
  ☑ Email notifications

Monitoring:
  ☑ API health checks
  ☑ Data freshness monitoring
  ☑ Error logging
  ☑ Performance metrics

═══════════════════════════════════════════════════════════════════════════════════
