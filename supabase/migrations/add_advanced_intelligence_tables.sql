-- Advanced Intelligence Tables for OG Scan
-- Adds comprehensive forensics, holder analysis, transaction tracking

-- Holder Snapshots (time-series PnL data)
CREATE TABLE IF NOT EXISTS holder_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_timestamp BIGINT NOT NULL,
  mint_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  
  -- Balance
  balance BIGINT NOT NULL,
  balance_usd FLOAT NOT NULL,
  balance_percent_of_supply FLOAT,
  holder_rank_by_value INT,
  
  -- Cost Basis & PnL
  total_cost_usd FLOAT,
  avg_entry_price FLOAT,
  unrealized_pnl_usd FLOAT,
  unrealized_pnl_percent FLOAT,
  realized_pnl_usd FLOAT,
  realized_pnl_percent FLOAT,
  total_pnl_usd FLOAT,
  total_pnl_percent FLOAT,
  
  -- Activity
  first_buy_timestamp BIGINT,
  last_activity_timestamp BIGINT,
  holding_duration_days FLOAT,
  buy_count INT DEFAULT 0,
  sell_count INT DEFAULT 0,
  total_transactions INT DEFAULT 0,
  flip_frequency INT DEFAULT 0,
  
  -- Classification
  classification TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_holder_snapshots_mint_time ON holder_snapshots(mint_address, snapshot_timestamp DESC);
CREATE INDEX idx_holder_snapshots_wallet ON holder_snapshots(wallet_address);

-- Transactions Extended (full tx history with PnL)
CREATE TABLE IF NOT EXISTS transactions_extended (
  signature TEXT PRIMARY KEY,
  blockchain_timestamp BIGINT NOT NULL,
  block_number BIGINT,
  
  -- Transaction Type
  tx_type TEXT,
  direction TEXT,
  
  -- Parties
  buyer_address TEXT,
  seller_address TEXT,
  
  -- Token
  mint_address TEXT NOT NULL,
  token_amount BIGINT,
  paired_token TEXT,
  
  -- Pricing
  token_price FLOAT,
  usd_volume FLOAT,
  price_impact_percent FLOAT,
  slippage_percent FLOAT,
  
  -- Execution
  dex_name TEXT,
  dex_program_id TEXT,
  pool_address TEXT,
  
  -- Fees & MEV
  fee_sol FLOAT,
  mev_extracted_usd FLOAT,
  
  -- PnL (for sellers)
  seller_avg_cost FLOAT,
  profit_loss_usd FLOAT,
  profit_loss_percent FLOAT,
  
  -- Flags
  is_wash_trade BOOLEAN DEFAULT FALSE,
  is_bot_like BOOLEAN DEFAULT FALSE,
  is_suspicious BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transactions_mint_time ON transactions_extended(mint_address, blockchain_timestamp DESC);
CREATE INDEX idx_transactions_wallet ON transactions_extended(buyer_address);

-- Liquidity Pools Extended
CREATE TABLE IF NOT EXISTS liquidity_pools_extended (
  address TEXT PRIMARY KEY,
  mint_address TEXT NOT NULL,
  paired_token TEXT,
  
  -- Pool Details
  dex_name TEXT,
  created_timestamp BIGINT,
  
  -- State
  token_reserves BIGINT,
  paired_reserves FLOAT,
  lp_token_supply BIGINT,
  tvl_usd FLOAT,
  
  -- Trading
  trading_enabled BOOLEAN DEFAULT TRUE,
  trading_volume_24h FLOAT,
  liquidity_providers_count INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Liquidity Provider Snapshots
CREATE TABLE IF NOT EXISTS liquidity_provider_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_timestamp BIGINT NOT NULL,
  pool_address TEXT NOT NULL REFERENCES liquidity_pools_extended(address),
  lp_wallet_address TEXT NOT NULL,
  
  -- Position
  lp_token_balance BIGINT,
  lp_token_percent FLOAT,
  lp_position_usd FLOAT,
  
  -- Returns
  fees_earned_24h_usd FLOAT DEFAULT 0,
  fees_earned_7d_usd FLOAT DEFAULT 0,
  apr_estimated FLOAT,
  
  -- Risk
  impermanent_loss_usd FLOAT DEFAULT 0,
  impermanent_loss_percent FLOAT DEFAULT 0,
  
  -- Lock Status
  is_locked BOOLEAN DEFAULT FALSE,
  locked_until_timestamp BIGINT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Price Candles Extended (OHLCV + indicators)
CREATE TABLE IF NOT EXISTS price_candles_extended (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT NOT NULL,
  timeframe TEXT,
  candle_timestamp BIGINT NOT NULL,
  
  -- OHLCV
  open_price FLOAT,
  high_price FLOAT,
  low_price FLOAT,
  close_price FLOAT,
  volume_usd FLOAT,
  buy_volume_usd FLOAT,
  sell_volume_usd FLOAT,
  
  -- Technical
  sma_20 FLOAT,
  sma_50 FLOAT,
  sma_200 FLOAT,
  rsi_14 FLOAT,
  macd FLOAT,
  macd_signal FLOAT,
  bb_upper FLOAT,
  bb_middle FLOAT,
  bb_lower FLOAT,
  
  -- Order Flow
  buy_sell_ratio FLOAT,
  order_flow_imbalance FLOAT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_price_candles_mint_time ON price_candles_extended(mint_address, timeframe, candle_timestamp DESC);

-- Wallet Profiles (extended)
CREATE TABLE IF NOT EXISTS wallet_profiles_extended (
  address TEXT PRIMARY KEY,
  wallet_label TEXT,
  classification TEXT,
  
  -- Stats
  created_timestamp BIGINT,
  age_days INT,
  total_transactions INT,
  total_tokens_traded INT,
  total_usd_volume FLOAT,
  
  -- Performance
  win_rate FLOAT,
  avg_trade_duration INTERVAL,
  
  -- Clustering
  cluster_id INT,
  cluster_confidence FLOAT,
  likely_same_entity BOOLEAN DEFAULT FALSE,
  
  -- Risk
  risk_score INT DEFAULT 0,
  suspicious_activity BOOLEAN DEFAULT FALSE,
  
  -- Deployer Stats
  tokens_deployed INT DEFAULT 0,
  deployer_success_rate FLOAT DEFAULT 0,
  rugged_tokens INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallet Clusters
CREATE TABLE IF NOT EXISTS wallet_clusters (
  id BIGSERIAL PRIMARY KEY,
  cluster_name TEXT,
  wallet_addresses TEXT[],
  cluster_size INT,
  cluster_confidence FLOAT,
  clustering_method TEXT,
  likely_same_entity BOOLEAN DEFAULT FALSE,
  likely_coordinated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- DEX Paid Campaigns
CREATE TABLE IF NOT EXISTS dex_paid_campaigns (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT NOT NULL,
  
  -- Campaign
  campaign_type TEXT,
  platform TEXT,
  start_timestamp BIGINT,
  end_timestamp BIGINT,
  cost_sol FLOAT,
  
  -- Impact
  price_before FLOAT,
  price_after FLOAT,
  price_impact_percent FLOAT,
  volume_during_campaign FLOAT,
  roi_percent FLOAT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Real-Time Alerts
CREATE TABLE IF NOT EXISTS real_time_alerts (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT NOT NULL,
  
  -- Alert
  alert_type TEXT,
  severity TEXT,
  metric_name TEXT,
  metric_value FLOAT,
  percent_change FLOAT,
  
  -- Status
  triggered_timestamp BIGINT,
  is_resolved BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics Views
CREATE OR REPLACE VIEW token_health_score_view AS
SELECT 
  mint_address,
  ROUND(
    COALESCE((SELECT og_score FROM tokens WHERE mint = mint_address LIMIT 1), 0) * 0.3 +
    (100 - COALESCE((SELECT risk_score FROM tokens WHERE mint = mint_address LIMIT 1), 0)) * 0.3 +
    COALESCE((SELECT COUNT(*) * 100 / 3500 FROM holder_snapshots WHERE mint_address = holder_snapshots.mint_address), 0) * 0.2 +
    COALESCE((SELECT volume_24h FROM tokens WHERE mint = mint_address LIMIT 1), 0) / 1000000 * 0.2
  )::INT AS health_score
FROM (SELECT DISTINCT mint_address FROM holder_snapshots);

CREATE OR REPLACE VIEW whale_risk_analysis_view AS
SELECT 
  hs.mint_address,
  hs.wallet_address,
  hs.balance_usd,
  hs.unrealized_pnl_percent,
  CASE 
    WHEN hs.unrealized_pnl_percent > 100 THEN 'CRITICAL'
    WHEN hs.unrealized_pnl_percent > 50 THEN 'HIGH'
    WHEN hs.unrealized_pnl_percent > 0 THEN 'MODERATE'
    ELSE 'LOW'
  END AS dump_risk_level
FROM holder_snapshots hs
WHERE hs.balance_percent_of_supply > 0.01
ORDER BY hs.balance_usd DESC;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
