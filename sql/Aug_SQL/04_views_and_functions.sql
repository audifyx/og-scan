-- Views and Helper Functions for Agent System

-- View: Agent Summary (quick overview)
CREATE OR REPLACE VIEW agent_summary_view AS
SELECT 
  a.id,
  a.user_id,
  a.name,
  a.status,
  a.wallet_address,
  a.phantom_connected,
  a.created_at,
  COUNT(DISTINCT CASE WHEN at.direction = 'buy' THEN at.id END) as total_buys,
  COUNT(DISTINCT CASE WHEN at.direction = 'sell' THEN at.id END) as total_sells,
  COALESCE(SUM(CASE WHEN at.direction = 'buy' THEN at.total_value_usd ELSE 0 END), 0) as total_buy_value,
  COALESCE(SUM(CASE WHEN at.direction = 'sell' THEN at.total_value_usd ELSE 0 END), 0) as total_sell_value,
  COUNT(DISTINCT anm.id) as nft_mints_count,
  COUNT(DISTINCT atl.id) as token_launches_count,
  COUNT(DISTINCT asp.id) as social_posts_count
FROM agents a
LEFT JOIN agent_trades at ON a.id = at.agent_id
LEFT JOIN agent_nft_mints anm ON a.id = anm.agent_id
LEFT JOIN agent_token_launches atl ON a.id = atl.agent_id
LEFT JOIN agent_social_posts asp ON a.id = asp.agent_id
GROUP BY a.id, a.user_id, a.name, a.status, a.wallet_address, a.phantom_connected, a.created_at;

-- View: Daily Agent Stats
CREATE OR REPLACE VIEW agent_daily_stats_view AS
SELECT 
  a.id,
  a.name,
  DATE(at.created_at) as trading_date,
  COUNT(DISTINCT at.id) as trades_count,
  COUNT(DISTINCT CASE WHEN at.direction = 'buy' THEN at.id END) as buys,
  COUNT(DISTINCT CASE WHEN at.direction = 'sell' THEN at.id END) as sells,
  SUM(at.total_value_usd) as total_volume_usd,
  AVG(at.slippage_pct) as avg_slippage,
  COUNT(DISTINCT CASE WHEN at.status = 'failed' THEN at.id END) as failed_trades
FROM agents a
LEFT JOIN agent_trades at ON a.id = at.agent_id
GROUP BY a.id, a.name, DATE(at.created_at);

-- Function: Verify User Token Access
CREATE OR REPLACE FUNCTION verify_user_token_access(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  current_holding DECIMAL;
  cumulative_buys DECIMAL;
  min_requirement DECIMAL;
BEGIN
  -- Get minimum requirement
  SELECT min_value_usd INTO min_requirement 
  FROM token_requirements 
  WHERE active = TRUE 
  LIMIT 1;

  -- Get current holding value
  SELECT COALESCE(SUM(value_usd), 0) INTO current_holding
  FROM user_token_holdings
  WHERE user_id = user_id_param AND verified_from_chain = TRUE;

  -- Get cumulative buy value
  SELECT COALESCE(SUM(total_value_usd), 0) INTO cumulative_buys
  FROM user_buy_history
  WHERE user_id = user_id_param AND verified_from_chain = TRUE;

  -- Return TRUE if either current holding OR cumulative buys meet requirement
  RETURN (current_holding >= min_requirement) OR (cumulative_buys >= min_requirement);
END;
$$;

-- Function: Update Access Verification Cache
CREATE OR REPLACE FUNCTION update_access_verification(user_id_param UUID, wallet_address_param TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_holding DECIMAL;
  cumulative_buys DECIMAL;
BEGIN
  -- Calculate current holdings
  SELECT COALESCE(SUM(value_usd), 0) INTO current_holding
  FROM user_token_holdings
  WHERE user_id = user_id_param AND wallet_address = wallet_address_param;

  -- Calculate cumulative buys
  SELECT COALESCE(SUM(total_value_usd), 0) INTO cumulative_buys
  FROM user_buy_history
  WHERE user_id = user_id_param AND wallet_address = wallet_address_param;

  -- Upsert verification record
  INSERT INTO user_access_verification (user_id, wallet_address, meets_token_requirement, current_holding_usd, cumulative_buy_value_usd, expires_at)
  VALUES (user_id_param, wallet_address_param, (current_holding >= 10) OR (cumulative_buys >= 10), current_holding, cumulative_buys, NOW() + INTERVAL '24 hours')
  ON CONFLICT (user_id) DO UPDATE SET
    meets_token_requirement = (current_holding >= 10) OR (cumulative_buys >= 10),
    current_holding_usd = current_holding,
    cumulative_buy_value_usd = cumulative_buys,
    verified_at = NOW(),
    expires_at = NOW() + INTERVAL '24 hours';
END;
$$;

-- Function: Generate API Key Hash (for secure key storage)
-- NOTE: This should be called from application code, not directly in SQL
CREATE OR REPLACE FUNCTION hash_api_key(key_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Return SHA-256 hash of the key
  -- In practice, use application code with proper crypto library
  RETURN encode(digest(key_text, 'sha256'), 'hex');
END;
$$;

-- Function: Log Agent API Call
CREATE OR REPLACE FUNCTION log_agent_api_call(
  agent_id_param UUID,
  api_key_id_param UUID,
  endpoint_param TEXT,
  method_param TEXT,
  status_code_param INTEGER,
  response_time_ms_param INTEGER,
  request_data_param JSONB DEFAULT NULL,
  response_data_param JSONB DEFAULT NULL,
  error_message_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  call_id UUID;
BEGIN
  INSERT INTO agent_api_calls (agent_id, api_key_id, endpoint, method, status_code, response_time_ms, request_data, response_data, error_message)
  VALUES (agent_id_param, api_key_id_param, endpoint_param, method_param, status_code_param, response_time_ms_param, request_data_param, response_data_param, error_message_param)
  RETURNING id INTO call_id;
  
  RETURN call_id;
END;
$$;

-- Function: Record Agent Trade
CREATE OR REPLACE FUNCTION record_agent_trade(
  agent_id_param UUID,
  wallet_address_param TEXT,
  direction_param TEXT,
  token_mint_param TEXT,
  amount_tokens_param DECIMAL,
  price_per_token_param DECIMAL,
  total_value_usd_param DECIMAL,
  dex_used_param TEXT DEFAULT 'jupiter'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  trade_id UUID;
BEGIN
  INSERT INTO agent_trades (
    agent_id, wallet_address, direction, token_mint, amount_tokens, 
    price_per_token, total_value_usd, dex_used, status
  )
  VALUES (
    agent_id_param, wallet_address_param, direction_param, token_mint_param, amount_tokens_param,
    price_per_token_param, total_value_usd_param, dex_used_param, 'pending'
  )
  RETURNING id INTO trade_id;
  
  RETURN trade_id;
END;
$$;

-- Trigger: Update agent updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_updated_at_trigger
BEFORE UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION update_agent_timestamp();

-- Trigger: Update agent_settings updated_at timestamp
CREATE TRIGGER agent_settings_updated_at_trigger
BEFORE UPDATE ON agent_settings
FOR EACH ROW
EXECUTE FUNCTION update_agent_timestamp();
