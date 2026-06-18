╔════════════════════════════════════════════════════════════════════════════════╗
║                  OG SCAN ADVANCED INTELLIGENCE SYSTEM                          ║
║           Complete Data Enrichment Pipeline & Forensics Framework              ║
║                          v2.0 - Enterprise Grade                               ║
╚════════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════════
PART 1: CRITICAL MISSING DATA CHECKLIST
═══════════════════════════════════════════════════════════════════════════════════

[CRITICAL] = System breaks without it
[HIGH] = Major analysis gaps
[MEDIUM] = Nice to have
[OPTIONAL] = Enhancement

───────────────────────────────────────────────────────────────────────────────────
A. WALLET & HOLDER INTELLIGENCE (CURRENTLY 5% COMPLETE)
───────────────────────────────────────────────────────────────────────────────────

MISSING: PER-HOLDER FORENSIC PROFILE
  ☐ [CRITICAL] Exact token balance per wallet (not %, raw amounts)
  ☐ [CRITICAL] USD value realized + unrealized per holder
  ☐ [CRITICAL] Entry price & cost basis (avg buy price)
  ☐ [CRITICAL] Realized PnL = (sell price - buy price) × qty sold
  ☐ [CRITICAL] Unrealized PnL = (current price - avg cost) × current balance
  ☐ [CRITICAL] PnL % gain/loss per wallet
  ☐ [CRITICAL] Wallet classification:
              - Bot (automated trading patterns)
              - Sniper (bought within 1 min of launch)
              - Insider (early access, pre-launch wallet)
              - Whale (>5% of token supply)
              - Diamond hand (never sold, accumulating)
              - Exit liquidity (seller, dumping)
              - LP provider (liquidity pool participant)
              - CEX wallet (exchange deposit addr)
              - Dev/Deployer (creator wallet)
  ☐ [CRITICAL] Wallet age (creation date)
  ☐ [CRITICAL] First interaction timestamp with token
  ☐ [CRITICAL] Holding time (current - first buy)
  ☐ [CRITICAL] Buy/sell frequency (flip count)
  ☐ [CRITICAL] Number of transactions per holder

MISSING: HOLDER BEHAVIORAL CLUSTERING
  ☐ [HIGH] Group holders by behavior similarity:
           - Accumulator (only buying)
           - Distributor (only selling)
           - Swing trader (buy/sell cycles)
           - Momentum chaser (FOMO buyer)
           - Exit pump (big single sale)
  ☐ [HIGH] Cluster cohesion score (how likely are these wallets related?)
  ☐ [HIGH] Wallet risk score:
           - Rug risk (if holder dumps, % price impact)
           - Exit liquidity risk per wallet
           - Concentration risk (top 10 = X% of supply)

MISSING: INSIDER / PRIVILEGED WALLET DETECTION
  ☐ [HIGH] Pre-launch wallet identification
  ☐ [HIGH] Team member wallets
  ☐ [HIGH] Dev fund wallets
  ☐ [HIGH] Advisor/investor early wallets
  ☐ [HIGH] Whale wallet historical performance
  ☐ [HIGH] Wallet relationship graph (clustering by transaction patterns)

───────────────────────────────────────────────────────────────────────────────────
B. TRANSACTION & TRADE FLOW ANALYTICS (MISSING 90%)
───────────────────────────────────────────────────────────────────────────────────

MISSING: COMPLETE TRANSACTION HISTORY
  ☐ [CRITICAL] All buy transactions (buyer, amount, price, timestamp, slippage)
  ☐ [CRITICAL] All sell transactions (seller, amount, price, timestamp, impact)
  ☐ [CRITICAL] Transaction direction (buy vs sell, net flow)
  ☐ [CRITICAL] DEX used per transaction (Jupiter, Raydium, Orca, etc.)
  ☐ [CRITICAL] Gas/fees paid per transaction
  ☐ [CRITICAL] Transaction signature (for verification)
  ☐ [CRITICAL] Wallet-to-wallet transfers (internal redistribution)

MISSING: TOP TRADER LEADERBOARD
  ☐ [HIGH] Top 50 buyers by USD volume
           - Wallet address
           - Total USD invested
           - Total tokens acquired
           - Average buy price
           - Current holdings
           - Current PnL
  ☐ [HIGH] Top 50 sellers by USD volume
           - Wallet address
           - Total USD earned
           - Total tokens sold
           - Average sell price
           - Remaining holdings
           - Realized PnL
  ☐ [HIGH] Net PnL leaderboard
           - Most profitable traders
           - Worst performing traders
           - Win rate % (profitable trades / total trades)
  ☐ [HIGH] Most traded wallets (highest flip frequency)

MISSING: WASH TRADING & MANIPULATION DETECTION
  ☐ [HIGH] Circular trading patterns (wallet A → B → C → A)
  ☐ [HIGH] Same-wallet buy/sell within <5 min (likely self-trade)
  ☐ [HIGH] Price pumps correlated with single wallet activity
  ☐ [HIGH] Coordinated wallet groups (likely same person)
  ☐ [HIGH] Synthetic volume detection (trades that don't move market)
  ☐ [MEDIUM] Bot trading patterns (consistent timing, size, price)

MISSING: ORDER FLOW ANALYSIS
  ☐ [HIGH] Buy/sell ratio over time (hourly, daily)
  ☐ [HIGH] Volume-weighted average price (VWAP)
  ☐ [HIGH] Cumulative delta (buy volume - sell volume)
  ☐ [HIGH] Order book imbalance
  ☐ [HIGH] Slippage curves per exchange
  ☐ [MEDIUM] MEV (Maximal Extractable Value) impact detection

───────────────────────────────────────────────────────────────────────────────────
C. LIQUIDITY FORENSICS (MISSING 85%)
───────────────────────────────────────────────────────────────────────────────────

MISSING: LP PROVIDER INTELLIGENCE
  ☐ [CRITICAL] All liquidity pool addresses
  ☐ [CRITICAL] LP token holder breakdown
  ☐ [CRITICAL] LP provider wallet identities (who added liquidity)
  ☐ [CRITICAL] Liquidity amount per provider (USD value)
  ☐ [CRITICAL] LP lock status & unlock dates
  ☐ [CRITICAL] LP concentration risk (top 3 LPs = X% of total liquidity)
  ☐ [CRITICAL] Rugpull risk score based on LP patterns

MISSING: LIQUIDITY TIMELINE & EVENTS
  ☐ [HIGH] Liquidity inflow/outflow per day
  ☐ [HIGH] Liquidity migration events (moving from Raydium → Orca, etc.)
  ☐ [HIGH] LP removal events (sudden liquidity drops)
  ☐ [HIGH] LP addition events (new liquidity sources)
  ☐ [HIGH] LP unlock date predictions
  ☐ [HIGH] Liquidity burn events

MISSING: PAIR CREATION & POOL EVOLUTION
  ☐ [HIGH] All trading pairs (SOL/MERLIN, USDC/MERLIN, etc.)
  ☐ [HIGH] Pair creation transaction history
  ☐ [HIGH] TVL (Total Value Locked) per pair
  ☐ [HIGH] 24h volume per pair
  ☐ [HIGH] Slippage impact curves per pair
  ☐ [MEDIUM] Fee tier impact (0.25%, 1%, etc.)

MISSING: AMM-SPECIFIC METRICS
  ☐ [HIGH] Impermanent loss calculations for LPs
  ☐ [HIGH] LP APY/APR estimates
  ☐ [HIGH] LP fee accumulation
  ☐ [HIGH] Virtual liquidity (hidden order book)
  ☐ [MEDIUM] K-curve behavior (Uniswap constant product formula)

───────────────────────────────────────────────────────────────────────────────────
D. DEPLOYER & TOKEN CREATION FORENSICS (MISSING 80%)
───────────────────────────────────────────────────────────────────────────────────

MISSING: FULL DEPLOYER HISTORY
  ☐ [CRITICAL] Deployer wallet address (full fingerprint)
  ☐ [CRITICAL] All tokens ever created by deployer
  ☐ [CRITICAL] Success rate of deployer (how many tokens survived/mooned)
  ☐ [CRITICAL] Failure rate (rugged, abandoned, died)
  ☐ [CRITICAL] Average time-to-ATH for deployer tokens
  ☐ [CRITICAL] Average max drawdown for deployer tokens
  ☐ [CRITICAL] Rug history (if any)
  ☐ [CRITICAL] Token abandonment patterns

MISSING: CREATOR WALLET PROFILING
  ☐ [HIGH] Creator SOL balance history
  ☐ [HIGH] Creator funding sources (where SOL came from)
  ☐ [HIGH] Creator trading activity in other tokens
  ☐ [HIGH] Creator interaction with known scam wallets
  ☐ [HIGH] Creator wallet age
  ☐ [HIGH] Creator previous airdrops/launches

MISSING: INITIAL DISTRIBUTION FORENSICS
  ☐ [HIGH] Genesis/presale wallet list
  ☐ [HIGH] Team allocation breakdown
  ☐ [HIGH] Marketing wallet allocation
  ☐ [HIGH] Vesting schedule + unlock dates
  ☐ [HIGH] Early sniper wallet identification (first 1-100 buyers)
  ☐ [HIGH] Launch date exact timestamp
  ☐ [HIGH] Pre-launch vs post-launch behavior divergence

───────────────────────────────────────────────────────────────────────────────────
E. PRICE & MARKET MICROSTRUCTURE (MISSING 70%)
───────────────────────────────────────────────────────────────────────────────────

MISSING: COMPLETE PRICE HISTORY
  ☐ [CRITICAL] 1-minute OHLCV (Open, High, Low, Close, Volume) candles
  ☐ [CRITICAL] 5-minute OHLCV
  ☐ [CRITICAL] 1-hour OHLCV
  ☐ [CRITICAL] 4-hour OHLCV
  ☐ [CRITICAL] Daily OHLCV
  ☐ [CRITICAL] ATH exact price + timestamp
  ☐ [CRITICAL] ATL exact price + timestamp
  ☐ [CRITICAL] Time to ATH from launch
  ☐ [CRITICAL] Current drawdown % from ATH (time-series)
  ☐ [CRITICAL] Price volatility (std dev over windows)

MISSING: TECHNICAL ANALYSIS METRICS
  ☐ [HIGH] Moving averages (20/50/200 SMA/EMA)
  ☐ [HIGH] RSI (Relative Strength Index) - overbought/oversold
  ☐ [HIGH] MACD (trend momentum)
  ☐ [HIGH] Bollinger Bands (volatility)
  ☐ [HIGH] Support & resistance levels
  ☐ [HIGH] Volume profile (where is volume concentrated?)
  ☐ [MEDIUM] Fibonacci retracement levels
  ☐ [MEDIUM] Wyckoff distribution/accumulation patterns

MISSING: MARKET MICROSTRUCTURE
  ☐ [HIGH] Buy/sell volume ratio (momentum indicator)
  ☐ [HIGH] Order flow imbalance (cumulative buy - sell)
  ☐ [HIGH] Volume spikes correlated with price action
  ☐ [HIGH] Slippage on buys vs sells
  ☐ [HIGH] Market depth (bid/ask spread)
  ☐ [MEDIUM] Flash crash detection
  ☐ [MEDIUM] Pump & dump pattern detection

───────────────────────────────────────────────────────────────────────────────────
F. RISK & SECURITY SCORING (MISSING 60%)
───────────────────────────────────────────────────────────────────────────────────

MISSING: ADVANCED RISK METRICS
  ☐ [CRITICAL] Rugpull probability score
           - LP lock status
           - Creator history
           - Holder concentration
           - Liquidity ratio
           - Dev fund size
  ☐ [CRITICAL] Whale dump risk (top 5 holders can crash % if sell)
  ☐ [CRITICAL] Liquidity risk (low liquidity = high slippage)
  ☐ [CRITICAL] Concentration risk (Gini coefficient for holder distribution)
  ☐ [HIGH] Smart contract audit status
  ☐ [HIGH] Known exploit patterns in contract
  ☐ [HIGH] Authority risks (who controls mint/freeze)
  ☐ [HIGH] Governance centralization risk

MISSING: BEHAVIORAL RISK FLAGS
  ☐ [HIGH] Unusual trading patterns
  ☐ [HIGH] Bot activity detection
  ☐ [HIGH] Pump and dump probability
  ☐ [HIGH] Insider trading patterns
  ☐ [HIGH] Market manipulation signals
  ☐ [MEDIUM] Sentiment risk (social media analysis)

───────────────────────────────────────────────────────────────────────────────────
G. NARRATIVE & SOCIAL INTELLIGENCE (MISSING 90%)
───────────────────────────────────────────────────────────────────────────────────

MISSING: NARRATIVE EVOLUTION
  ☐ [HIGH] Narrative origin (who created, when)
  ☐ [HIGH] Narrative adoption timeline
  ☐ [HIGH] Narrative cluster mapping (similar tokens)
  ☐ [HIGH] Narrative sentiment tracking
  ☐ [HIGH] Narrative uniqueness score

MISSING: SOCIAL DATA INTEGRATION
  ☐ [HIGH] Twitter follower count history
  ☐ [HIGH] Tweet mention volume & sentiment
  ☐ [HIGH] Influencer engagement (who's talking about it)
  ☐ [HIGH] Telegram member count history
  ☐ [HIGH] Discord activity metrics
  ☐ [HIGH] Reddit discussion volume
  ☐ [MEDIUM] Sentiment scoring (positive/negative/neutral)
  ☐ [MEDIUM] Organic vs paid promotion ratio

MISSING: COMMUNITY ANALYSIS
  ☐ [HIGH] Community growth rate
  ☐ [HIGH] Active member count (DAU/MAU)
  ☐ [HIGH] Whale participation in community
  ☐ [HIGH] Community sentiment correlation with price
  ☐ [MEDIUM] Mod trust level
  ☐ [MEDIUM] FUD vs hype ratio

───────────────────────────────────────────────────────────────────────────────────
H. DEX PROMOTION & PAID SIGNAL TRACKING (MISSING 70%)
───────────────────────────────────────────────────────────────────────────────────

MISSING: COMPLETE DEX PAID HISTORY
  ☐ [CRITICAL] DexScreener profile paid status (yes/no + amount)
  ☐ [CRITICAL] DexScreener trending promotion (duration, cost)
  ☐ [CRITICAL] DexScreener boost active/inactive + remaining time
  ☐ [CRITICAL] All past boost campaigns (dates, duration, cost)
  ☐ [CRITICAL] Birdeye featured status
  ☐ [CRITICAL] Paid ads on other platforms
  ☐ [HIGH] Promotion ROI (marketing spend vs price impact)
  ☐ [HIGH] Promotion correlation with price movement
  ☐ [MEDIUM] Influencer paid partnerships list

MISSING: DETAILED PAID ORDER BREAKDOWN
  ☐ [CRITICAL] Profile paid order: cost, start date, end date
  ☐ [CRITICAL] Community takeover paid: cost, duration
  ☐ [CRITICAL] Ads paid: cost, impressions, clicks
  ☐ [CRITICAL] Boost paid orders: cost per boost, duration
  ☐ [HIGH] Total marketing spend (SOL)
  ☐ [HIGH] Marketing spend as % of market cap
  ☐ [HIGH] ROI on paid promotions

───────────────────────────────────────────────────────────────────────────────────
I. COMPARATIVE ANALYTICS (MISSING 85%)
───────────────────────────────────────────────────────────────────────────────────

MISSING: BENCHMARKING AGAINST CLUSTER
  ☐ [HIGH] Percentile rank vs narrative cluster:
           - Liquidity percentile
           - Volume percentile
           - Holder count percentile
           - Price action percentile
           - Risk percentile
  ☐ [HIGH] Historical performance vs similar tokens
  ☐ [HIGH] Correlation with Bitcoin/Ethereum/SOL
  ☐ [MEDIUM] Correlation with narrative cluster tokens

MISSING: EARLY STAGE COMPARISON METRICS
  ☐ [HIGH] Days since launch
  ☐ [HIGH] Price change from launch (absolute + %)
  ☐ [HIGH] Holder growth rate (new holders/day)
  ☐ [HIGH] Volume growth rate
  ☐ [MEDIUM] Time-to-profitability vs similar tokens

───────────────────────────────────────────────────────────────────────────────────
J. ADVANCED DETECTION ENGINES (MISSING 95%)
───────────────────────────────────────────────────────────────────────────────────

MISSING: ANOMALY DETECTION
  ☐ [HIGH] Sudden liquidity changes (alert threshold)
  ☐ [HIGH] Unusual holder concentration shifts
  ☐ [HIGH] Price action anomalies (gaps, flash crashes)
  ☐ [HIGH] Trading volume anomalies
  ☐ [MEDIUM] Wallet behavior anomalies (sudden large buys/sells)

MISSING: RELATIONSHIP MAPPING
  ☐ [HIGH] Holder wallet relationships (clustering)
  ☐ [HIGH] Deployer fingerprinting (connection to other rugs)
  ☐ [HIGH] Shared wallet patterns (same IP, same signing, etc.)
  ☐ [HIGH] LP provider connections
  ☐ [MEDIUM] Transaction graph analysis

MISSING: PREDICTIVE MODELS
  ☐ [MEDIUM] Price prediction (ML model)
  ☐ [MEDIUM] Rug probability forecast
  ☐ [MEDIUM] Holder exit probability model
  ☐ [MEDIUM] Whale action prediction


═══════════════════════════════════════════════════════════════════════════════════
PART 2: REQUIRED DATA SOURCES & API INTEGRATION
═══════════════════════════════════════════════════════════════════════════════════

TIER 1: CORE INFRASTRUCTURE (MUST HAVE)
─────────────────────────────────────────

1. HELIUS (RPC + Enhanced API)
   Purpose: Transaction indexing, wallet history, token metadata
   Endpoints needed:
   - getTokenTransactions(mint, limit=10000)
   - getWalletTransactions(wallet, limit=10000)
   - getToken(mint) — full metadata
   - getTokenMetadata(mint)
   - getTokenSupply(mint)
   - searchAssets(mint, page) — holder pagination

2. BIRDEYE (Price & Liquidity API)
   Purpose: Price history, volume, liquidity tracking
   Endpoints:
   - /defi/token_price_history (1m/5m/1h/4h/D candles)
   - /defi/token_liquidity_history
   - /defi/token_volume_history
   - /defi/token_top_traders
   - /defi/pair_overview (per trading pair)
   - /defi/token_holders (paginated)

3. DEXSCREENER API
   Purpose: DEX data, paid status, featured status
   Endpoints:
   - /latest/dex/tokens/{mint} — real-time DEX data
   - /latest/dex/pairs/{chainId}/{pairAddress}
   - Boost status (via scraping or direct API)
   - Featured token list

4. SOLSCAN / SOLANA FM
   Purpose: Advanced wallet profiling, risk scoring
   Endpoints:
   - /v2/account/{address} — full wallet data
   - /v2/account/{address}/transactions
   - /transaction/{signature}
   - /token/{mint}/holders — paginated holders

5. MAGIC EDEN / TENSOR (Optional)
   Purpose: NFT activity (if tokens are launch NFTs)
   Endpoints:
   - Launchpad data
   - Creator history

6. JUPITER SWAP API
   Purpose: Swap data, price oracle
   Endpoints:
   - /quote (price quotes)
   - /swap (swap history)
   - /tokens

TIER 2: CUSTOM DATA LAYER (INTERNAL SUPABASE)
───────────────────────────────────────────────

Tables to create:

1. tokens_extended
   - mint_address PK
   - deployer_address
   - creation_timestamp
   - initial_supply
   - current_supply
   - burn_history
   - deploy_tx_signature
   - narrative_cluster_id
   - narrative_fingerprint

2. token_holders_snapshot
   - id PK
   - mint_address FK
   - wallet_address
   - balance
   - balance_usd
   - average_entry_price
   - realized_pnl
   - unrealized_pnl
   - wallet_classification
   - first_buy_timestamp
   - last_buy_timestamp
   - total_buys
   - total_sells
   - hold_duration_days
   - entry_price_percentile
   - snapshot_timestamp

3. wallet_profiles
   - wallet_address PK
   - wallet_age_days
   - total_transactions
   - total_tokens_traded
   - success_rate (% profitable trades)
   - avg_trade_duration
   - deployer_tokens_created
   - deployer_rug_count
   - deployer_success_rate
   - risk_score
   - clustering_group
   - cluster_similarity_score

4. transactions_extended
   - tx_signature PK
   - blockchain_timestamp
   - buyer_wallet
   - seller_wallet
   - dex_used (Jupiter, Raydium, Orca)
   - token_amount
   - usd_volume
   - price_impact
   - slippage_percent
   - transaction_type (buy/sell/transfer)
   - profit_loss_usd
   - profit_loss_percent

5. liquidity_pools_extended
   - pool_address PK
   - mint_address FK
   - paired_token (SOL, USDC, etc.)
   - lp_token_supply
   - tvl_usd
   - creation_timestamp
   - trading_enabled

6. liquidity_providers_snapshot
   - id PK
   - pool_address FK
   - lp_wallet_address
   - lp_balance
   - lp_balance_usd
   - share_percent
   - impermanent_loss
   - fees_earned
   - snapshot_timestamp

7. dex_paid_campaigns
   - id PK
   - mint_address FK
   - campaign_type (profile, trending, boost, ads, cto)
   - platform (DexScreener, Birdeye, etc.)
   - cost_sol
   - start_timestamp
   - end_timestamp
   - price_before
   - price_after
   - price_impact_percent
   - roi_percent

8. price_candles_extended
   - id PK
   - mint_address FK
   - timeframe (1m, 5m, 1h, 4h, 1d)
   - open_price
   - high_price
   - low_price
   - close_price
   - volume_usd
   - buy_volume
   - sell_volume
   - candle_timestamp

9. wallet_clusters
   - cluster_id PK
   - wallet_addresses (array)
   - cluster_score (0-100, confidence)
   - likely_same_entity (bool)
   - clustering_method (tx graph, timing, IP, etc.)

10. social_sentiment
    - id PK
    - mint_address FK
    - platform (twitter, telegram, discord)
    - mention_count
    - positive_mentions
    - negative_mentions
    - sentiment_score
    - engagement_rate
    - timestamp

TIER 3: MACHINE LEARNING / REAL-TIME
──────────────────────────────────────

1. Real-time price monitoring
   - Price update every 1m
   - Alert on anomalies
   - Pump/dump detection

2. Holder pattern detection
   - Clustering algorithm (DBSCAN)
   - Anomaly detection (Isolation Forest)

3. Risk scoring model
   - Input: holder distribution, LP locks, deployer history, DEX paid status
   - Output: 0-100 risk score
   - Retrain weekly


═══════════════════════════════════════════════════════════════════════════════════
PART 3: COMPLETE DATA SCHEMA SPECIFICATION
═══════════════════════════════════════════════════════════════════════════════════

TOKEN ENTITY (Extended)
───────────────────────

{
  "mint": "AvxFBjWydMYWD7C8pHzSkGxNYAFWr7aNBbAKm84bpump",
  "symbol": "MERLIN",
  "name": "The Patriotic Duck",
  "metadata": {
    "uri": "https://...",
    "image": "https://...",
    "description": "..."
  },
  "supply": {
    "total": 1000000000,
    "current": 999999999,
    "burned": 1,
    "decimals": 6
  },
  "authority": {
    "mint_authority": "renounced",
    "freeze_authority": "renounced",
    "update_authority": "address"
  },
  "creation": {
    "timestamp": 1718150400,
    "transaction": "tx_signature",
    "deployer_wallet": "a9UCxxxxx",
    "deployer_solana_balance_at_launch": 5.25,
    "deployer_previous_tokens": 12,
    "deployer_success_rate": 0.25,
    "deployer_rug_count": 3
  },
  "liquidity": {
    "pools": [
      {
        "pair_address": "...",
        "pair": "MERLIN/SOL",
        "dex": "Raydium",
        "tvl_usd": 115035,
        "creation_timestamp": 1718150400,
        "lp_supply": 1000000,
        "current_price": 0.001445,
        "is_locked": true,
        "unlock_date": 1750150400,
        "lp_concentration": {
          "top_1_percent": 35,
          "top_5_percent": 65,
          "top_10_percent": 85
        },
        "lp_providers": [
          {
            "wallet": "addr1",
            "lp_amount": 350000,
            "usd_value": 35000,
            "share_percent": 35,
            "wallet_classification": "deployer"
          },
          {
            "wallet": "addr2",
            "lp_amount": 100000,
            "usd_value": 10000,
            "share_percent": 10,
            "wallet_classification": "whale"
          }
        ]
      }
    ]
  },
  "holders": {
    "total_count": 3515,
    "unique_wallets": 3500,
    "concentration": {
      "top_1": 3.95,
      "top_5": 12.50,
      "top_10": 20.80,
      "gini_coefficient": 0.72
    },
    "holder_classes": {
      "whales": 15,
      "diamond_hands": 450,
      "swing_traders": 280,
      "snipers": 120,
      "exit_liquidity": 85,
      "bots": 45,
      "unknown": 1520
    },
    "growth_rate": 50,
    "holders_per_day": [
      {"date": "2026-06-12", "count": 10},
      {"date": "2026-06-13", "count": 85},
      {"date": "2026-06-14", "count": 320}
    ]
  },
  "price_action": {
    "current_price": 0.001445,
    "24h_volume_usd": 1330000,
    "24h_change_percent": -23.82,
    "market_cap": 1440000,
    "fdv": 1440000,
    "liquidity_effective": 115035,
    "buy_sell_ratio": 0.65,
    "order_flow_imbalance": -0.35,
    "price_history": {
      "ath": {"price": 0.00189, "timestamp": 1718170000, "date": "2026-06-12T12:45:00Z"},
      "atl": {"price": 0.000900, "timestamp": 1718140000},
      "current_from_ath_percent": -23.54
    },
    "technical_metrics": {
      "rsi_1h": 28.5,
      "rsi_4h": 35.2,
      "rsi_1d": 42.1,
      "macd_signal": "bearish",
      "bollinger_bands": {
        "upper": 0.00180,
        "middle": 0.00145,
        "lower": 0.00110
      }
    }
  },
  "forensics": {
    "og_classification": "TRUE_OG_CTO",
    "confidence": 88,
    "risk_score": 6,
    "data_completeness": 100,
    "scores": {
      "dominance": 83,
      "origin": 93,
      "true_og_probability": 85,
      "clone_probability": 3,
      "cto_probability": 60,
      "rug_risk": 19,
      "migration_risk": 14,
      "revival_risk": 15,
      "deployer_trust": 80,
      "liquidity_authenticity": 78,
      "holder_distribution": 92,
      "on_chain_activity": 100
    },
    "classification_layers": {
      "origin_identity": "Original Contract",
      "original_contract": true,
      "control_status": "Community / CTO Controlled",
      "lifecycle_status": "Original Live Contract"
    },
    "secondary_labels": [
      "Primary Token",
      "Dominance Rank #1",
      "First Mint",
      "Earliest Verified Origin",
      "Original Contract",
      "Same CA Continued",
      "Community Takeover"
    ]
  },
  "narrative": {
    "cluster_id": "OGN-27D899D3",
    "cluster_aliases": ["Merlin", "The Patriotic Duck"],
    "narrative_strength": 0.92,
    "emergence_timestamp": 1718150400,
    "narrative_uniqueness": 0.85,
    "social_data": {
      "twitter_followers": 12500,
      "twitter_mentions_24h": 450,
      "twitter_sentiment": 0.72,
      "telegram_members": 8500,
      "telegram_messages_24h": 2100,
      "discord_members": 3200,
      "reddit_mentions": 85
    }
  },
  "dex_paid": {
    "is_paid": false,
    "campaigns": [
      {
        "type": "profile",
        "platform": "DexScreener",
        "cost_sol": 2.5,
        "active": false,
        "start_date": "2026-06-12T10:00:00Z",
        "end_date": "2026-06-15T10:00:00Z",
        "price_before": 0.000950,
        "price_after": 0.001445,
        "impact_percent": 52.1
      }
    ],
    "total_marketing_spend_sol": 2.5,
    "marketing_spend_percent_of_mcap": 0.17,
    "roi_percent": 52.1
  }
}

WALLET ENTITY (Extended)
────────────────────────

{
  "address": "CQCixxxxxxxxxxxxxxxxxxxxxxxxxgbEB",
  "label": "largest_holder",
  "classification": "whale",
  "age_days": 425,
  "total_tokens_traded": 187,
  "created_timestamp": 1705891200,
  "solana_balance": 15.5,
  "total_usd_traded": 2500000,
  "success_rate": 0.68,
  "win_rate": 0.68,
  "token_positions": {
    "mint": {
      "balance": 39500000,
      "balance_usd": 57037.50,
      "acquired_amount": 50000000,
      "sold_amount": 10500000,
      "average_entry_price": 0.00128,
      "current_price": 0.001445,
      "unrealized_pnl": {
        "usd": 12337.50,
        "percent": 12.7
      },
      "realized_pnl": {
        "usd": 2150,
        "percent": 3.6
      },
      "total_pnl": {
        "usd": 14487.50,
        "percent": 16.3
      },
      "first_buy": 1718150300,
      "last_activity": 1718170000,
      "holding_time_days": 0.23,
      "transaction_count": 5,
      "buy_count": 3,
      "sell_count": 2,
      "flip_frequency": "high"
    }
  },
  "deployer_profile": {
    "is_deployer": false,
    "tokens_created": 0
  },
  "behavior_profile": {
    "cluster_id": 42,
    "cluster_size": 8,
    "cluster_similarity": 0.87,
    "likely_same_entity": true,
    "clustering_signals": [
      "same_transaction_timing",
      "correlated_buys",
      "shared_ip_patterns"
    ]
  },
  "risk_indicators": {
    "rug_risk_if_dumps": 8.5,
    "price_impact_percent": 8.5,
    "exit_probability_72h": 0.35,
    "suspicious_activity": false,
    "large_unrealized_gains": true
  }
}

TRANSACTION ENTITY
──────────────────

{
  "signature": "tx_signature_here",
  "timestamp": 1718150400,
  "type": "swap",
  "direction": "buy",
  "buyer": "CQCi...",
  "seller": "GXdt...",
  "token_mint": "AvxFBj...",
  "token_amount": 1000000,
  "usd_volume": 1445,
  "token_price": 0.001445,
  "dex": "Jupiter",
  "dex_program_id": "Jupiter...",
  "pair": "MERLIN/SOL",
  "slippage_percent": 2.5,
  "price_impact_percent": 0.8,
  "fee_sol": 0.00025,
  "slippage_sol": 0.0036,
  "profit_loss_usd": null,
  "profit_loss_percent": null,
  "is_wash_trade": false,
  "is_suspicious": false,
  "mev_extracted": 0,
  "block_number": 280000000,
  "instruction_count": 2
}

HOLDER SNAPSHOT ENTITY
──────────────────────

{
  "snapshot_id": "uuid",
  "snapshot_timestamp": 1718170000,
  "mint": "AvxFBj...",
  "wallet": "CQCi...",
  "balance": 39500000,
  "balance_usd": 57037.50,
  "balance_percent_of_supply": 3.95,
  "token_value_ranking": 1,
  "holder_count_ranking": 1,
  "classification": "whale",
  "average_entry_price": 0.00128,
  "unrealized_pnl": {
    "usd": 12337.50,
    "percent": 12.7,
    "breakeven_price": 0.00128
  },
  "realized_pnl": {
    "usd": 2150,
    "percent": 3.6
  },
  "acquisition_timeline": {
    "first_buy_timestamp": 1718150300,
    "last_buy_timestamp": 1718170000,
    "first_sell_timestamp": null,
    "last_sell_timestamp": null,
    "holding_duration_seconds": 19700,
    "holding_duration_days": 0.23
  },
  "transaction_stats": {
    "total_transactions": 5,
    "buy_count": 3,
    "sell_count": 2,
    "transfer_count": 0,
    "flip_frequency": "high"
  },
  "cost_basis": {
    "total_cost_usd": 64000,
    "total_received_usd": 66150,
    "net_cashflow": -2150,
    "avg_cost_per_token": 0.00128
  }
}

LIQUIDITY PROVIDER SNAPSHOT
─────────────────────────────

{
  "snapshot_id": "uuid",
  "snapshot_timestamp": 1718170000,
  "pool_address": "pool_addr...",
  "mint": "AvxFBj...",
  "lp_wallet": "addr1...",
  "lp_token_balance": 350000,
  "lp_token_supply_total": 1000000,
  "share_percent": 35.0,
  "tvl_usd": 115035,
  "lp_usd_value": 40262.25,
  "fees_earned_24h_usd": 125.50,
  "fees_earned_7d_usd": 750.30,
  "apr_estimated": 45.2,
  "impermanent_loss_24h_usd": -35.50,
  "impermanent_loss_percent": -0.088,
  "locked_until": 1750150400,
  "days_until_unlock": 8000,
  "withdrawal_risk": "locked_lp"
}


═══════════════════════════════════════════════════════════════════════════════════
PART 4: ENRICHMENT PIPELINE (IMPLEMENTATION ORDER)
═══════════════════════════════════════════════════════════════════════════════════

PHASE 1: CORE DATA INGESTION (WEEK 1-2)
────────────────────────────────────────

Task 1.1: Token Creation Forensics
  → Helius: getTokenMetadata(mint)
  → Helius: getTokenTransactions(mint, limit=all)
  → Parse first transaction = deployer
  → Solscan: Get deployer history (all tokens created)
  → Create tokens_extended table
  → Track deployer rug patterns
  Estimated tokens to scan: 500k
  Est. API calls: 2M
  Est. storage: 2GB

Task 1.2: Full Holder Snapshot
  → Helius: searchAssets(mint, paginate)
  → Fetch all holder wallets + balances
  → Birdeye: getTokenHolders(mint, paginate)
  → Create token_holders_snapshot table
  → Backfill holder history (last 30 days)
  Estimated holders to track: 50M
  Est. API calls: 100M
  Est. storage: 50GB

Task 1.3: Transaction History Indexing
  → Helius: getTokenTransactions(mint, all)
  → For each transaction:
     - Parse buyer/seller from tx data
     - Extract token amount, price, timestamp
     - Determine DEX (Jupiter, Raydium, Orca)
     - Calculate slippage + impact
  → Create transactions_extended table
  Estimated total transactions: 100M
  Est. API calls: 100M
  Est. storage: 100GB

Task 1.4: Liquidity Pool Forensics
  → DexScreener: getAllPairs(mint)
  → For each pair:
     - Get LP token supply
     - Get LP holders + amounts
     - Get lock status
  → Create liquidity_pools_extended table
  → Create liquidity_providers_snapshot table
  Est. API calls: 500k
  Est. storage: 5GB

PHASE 2: PRICE & TECHNICAL DATA (WEEK 2-3)
────────────────────────────────────────────

Task 2.1: Complete Price History
  → Birdeye: getTokenPriceHistory(mint, 1m, all)
  → Birdeye: getTokenPriceHistory(mint, 5m, all)
  → Birdeye: getTokenPriceHistory(mint, 1h, all)
  → Create price_candles_extended table
  → Calculate technical indicators (RSI, MACD, BB)
  Est. candles per token: 50k
  Est. API calls: 1M
  Est. storage: 50GB

Task 2.2: Volume Analysis
  → Extract buy_volume vs sell_volume per candle
  → Calculate VWAP (volume-weighted avg price)
  → Calculate cumulative delta
  → Create volume_profile table
  Est. API calls: 500k
  Est. storage: 10GB

PHASE 3: ADVANCED FORENSICS (WEEK 3-4)
─────────────────────────────────────────

Task 3.1: Wallet Profiling
  → For each holder wallet:
     - Get total transaction history (Helius)
     - Calculate success rate (win/loss)
     - Classify as: whale, sniper, bot, trader, etc.
     - Find clustering patterns
  → Create wallet_profiles table
  Est. wallets to profile: 10M
  Est. API calls: 50M
  Est. storage: 20GB

Task 3.2: DEX Paid Campaign Tracking
  → DexScreener: Check profile_paid status
  → DexScreener: Check featured/boost status
  → Birdeye: Check featured status
  → Parse all paid order history
  → Create dex_paid_campaigns table
  → Correlate paid promotions with price action
  Est. campaigns: 50k
  Est. API calls: 500k
  Est. storage: 1GB

Task 3.3: Risk Scoring Model
  → Create scoring function for:
     - Rugpull probability
     - Whale dump risk
     - Liquidity risk
     - Concentration risk
  → Input: holder distribution, LP locks, deployer history, price action
  → Output: 0-100 risk score
  → Store in tokens_extended.risk_score
  Est. computations: 500k
  Est. time: 1 hour

PHASE 4: REAL-TIME MONITORING (WEEK 4)
───────────────────────────────────────

Task 4.1: Real-Time Price Feed
  → Setup WebSocket to Jupiter/DexScreener
  → Price update every 1 second
  → Store candles every 1 minute
  → Alert on anomalies (>10% move)
  
Task 4.2: Holder Tracking
  → Monitor top 100 holders
  → Alert on large sells (>5% dumps)
  → Track holder growth rate
  → Update snapshots every 5 min

Task 4.3: Anomaly Detection
  → Setup alerting for:
     - Flash crashes (>20% in 1 min)
     - Liquidity drops (>50% in 1 hour)
     - Sudden large buys/sells
     - Unusual holder concentration changes

PHASE 5: MACHINE LEARNING (WEEK 5+)
──────────────────────────────────────

Task 5.1: Clustering Algorithm
  → Use DBSCAN to cluster similar wallets
  → Similarity metrics:
     - Transaction timing correlation
     - Buy/sell pattern similarity
     - Address proximity (IP patterns)
  → Detect coordinated activity

Task 5.2: Pump & Dump Detection
  → ML model inputs:
     - Price velocity
     - Volume spike
     - Holder concentration shift
     - Social sentiment shift
  → Detect patterns before rug

Task 5.3: Price Prediction
  → LSTM model:
     - Input: last 100 price candles
     - Output: next 24h price prediction
     - Retrain daily


═══════════════════════════════════════════════════════════════════════════════════
PART 5: PRIORITY RANKING (CRITICAL TO OPTIONAL)
═══════════════════════════════════════════════════════════════════════════════════

TIER 1: CRITICAL (SYSTEM BREAKS WITHOUT IT)
──────────────────────────────────────────────

PRIORITY 1: Token creation + deployer forensics
  Why: Enables rug detection, deployer track record
  Effort: 1 week
  Impact: 50 points

PRIORITY 2: Full holder balances + classifications
  Why: Risk assessment, whale tracking
  Effort: 2 weeks
  Impact: 45 points

PRIORITY 3: Complete transaction history
  Why: PnL calculation, trader identification
  Effort: 2 weeks
  Impact: 40 points

PRIORITY 4: Liquidity pool analysis + LP lock tracking
  Why: Rugpull risk, liquidity risk
  Effort: 1 week
  Impact: 35 points

PRIORITY 5: Price history + OHLCV candles
  Why: Technical analysis, volatility metrics
  Effort: 1 week
  Impact: 35 points

TIER 2: HIGH IMPACT (MAJOR ANALYSIS GAPS)
───────────────────────────────────────────

PRIORITY 6: Wallet clustering + behavior classification
  Why: Insider detection, coordination detection
  Effort: 2 weeks
  Impact: 30 points

PRIORITY 7: DEX paid campaign tracking
  Why: Marketing correlation, ROI analysis
  Effort: 1 week
  Impact: 25 points

PRIORITY 8: Realized/unrealized PnL per holder
  Why: Exit probability, whale behavior prediction
  Effort: 1 week
  Impact: 25 points

PRIORITY 9: Top trader leaderboard
  Why: Identify successful traders, copycat strategies
  Effort: 1 week
  Impact: 20 points

PRIORITY 10: Technical analysis indicators
  Why: Price action patterns, momentum
  Effort: 1 week
  Impact: 20 points

TIER 3: MEDIUM IMPACT (NICE TO HAVE)
──────────────────────────────────────

PRIORITY 11: Order flow imbalance + buy/sell ratio
  Why: Market structure, manipulation detection
  Effort: 1 week
  Impact: 15 points

PRIORITY 12: Wash trading detection
  Why: Volume manipulation detection
  Effort: 2 weeks
  Impact: 15 points

PRIORITY 13: Social sentiment tracking
  Why: Community health, hype vs reality
  Effort: 2 weeks
  Impact: 10 points

PRIORITY 14: Real-time anomaly alerting
  Why: Early warning system
  Effort: 1 week
  Impact: 10 points

PRIORITY 15: Comparative analytics (percentile vs cluster)
  Why: Benchmarking, relative performance
  Effort: 1 week
  Impact: 10 points

TIER 4: OPTIONAL (ENHANCEMENT)
───────────────────────────────

PRIORITY 16: ML price prediction model
  Effort: 4 weeks
  Impact: 5 points

PRIORITY 17: Impermanent loss calculations
  Effort: 1 week
  Impact: 5 points

PRIORITY 18: MEV impact analysis
  Effort: 2 weeks
  Impact: 5 points

PRIORITY 19: Governance token analysis
  Effort: 2 weeks
  Impact: 3 points


═══════════════════════════════════════════════════════════════════════════════════
PART 6: IMPLEMENTATION ROADMAP (12-WEEK SPRINT)
═══════════════════════════════════════════════════════════════════════════════════

WEEK 1-2: FOUNDATIONAL DATA LAYER
  ✓ Setup Supabase schema (all tables)
  ✓ Connect Helius API (token + transaction indexing)
  ✓ Ingest token metadata for 1000 tokens
  ✓ Ingest all holder data for 1000 tokens
  ✓ Create tokens_extended table with deployer history
  → Deliverable: Core data ingestion pipeline

WEEK 3-4: TRANSACTION & LIQUIDITY FORENSICS
  ✓ Index all transactions for 1000 tokens (100M+ txs)
  ✓ Calculate PnL per transaction
  ✓ Map all liquidity pools (Raydium, Orca, Jupiter)
  ✓ Create liquidity_providers_snapshot
  ✓ Track LP lock status + unlock dates
  → Deliverable: Complete transaction history + liquidity maps

WEEK 5-6: PRICE & TECHNICAL DATA
  ✓ Ingest 1m/5m/1h OHLCV candles (Birdeye)
  ✓ Calculate RSI, MACD, Bollinger Bands
  ✓ Identify support/resistance levels
  ✓ Calculate volatility metrics
  ✓ Create price_candles_extended table
  → Deliverable: Complete price history + technical analysis

WEEK 7-8: WALLET PROFILING & CLUSTERING
  ✓ Profile all wallets (success rate, risk score)
  ✓ Classify wallets (whale, sniper, bot, trader)
  ✓ Implement DBSCAN clustering
  ✓ Detect coordinated activity
  ✓ Create wallet_profiles + wallet_clusters tables
  → Deliverable: Wallet intelligence system

WEEK 9-10: ADVANCED FORENSICS
  ✓ Implement risk scoring model
  ✓ Track DEX paid campaigns (DexScreener, Birdeye)
  ✓ Calculate promotional ROI
  ✓ Detect wash trading patterns
  ✓ Implement anomaly detection (price spikes, liquidity drops)
  → Deliverable: Risk scoring + fraud detection

WEEK 11-12: REAL-TIME + REPORTING
  ✓ Setup real-time WebSocket feeds
  ✓ Create alerting system
  ✓ Build analytics dashboard
  ✓ Create PDF report generation with full data
  ✓ Setup scheduled data refreshes
  → Deliverable: Complete intelligence platform


═══════════════════════════════════════════════════════════════════════════════════
PART 7: API INTEGRATION CHECKLIST
═══════════════════════════════════════════════════════════════════════════════════

HELIUS
  ☐ Setup API key
  ☐ Implement rate limiting (100 req/sec)
  ☐ Create getToken() wrapper
  ☐ Create searchAssets() paginator
  ☐ Create getTokenTransactions() wrapper
  ☐ Create getWalletTransactions() wrapper
  ☐ Error handling + retry logic

BIRDEYE
  ☐ Setup API key
  ☐ Implement getTokenPriceHistory()
  ☐ Implement getTokenLiquidityHistory()
  ☐ Implement getTokenVolumeHistory()
  ☐ Implement getTokenHolders()
  ☐ Implement getTokenTopTraders()

DEXSCREENER
  ☐ Setup API
  ☐ Implement tokenPairs() endpoint
  ☐ Implement pairDetails() endpoint
  ☐ Scrape featured/boost status (if not API)
  ☐ Scrape paid status (if not API)

SOLSCAN / SOLANA FM
  ☐ Setup API
  ☐ Implement getAccount() endpoint
  ☐ Implement getAccountTransactions()
  ☐ Implement getTransaction()

JUPITER
  ☐ Setup swap API
  ☐ Implement /quote endpoint
  ☐ Implement historical swap data

REAL-TIME WEBSOCKETS
  ☐ Setup DexScreener WebSocket
  ☐ Setup Jupiter WebSocket
  ☐ Setup Raydium WebSocket
  ☐ Real-time price updates
  ☐ Real-time trade notifications


═══════════════════════════════════════════════════════════════════════════════════
PART 8: ESTIMATED INFRASTRUCTURE COSTS (MONTHLY)
═══════════════════════════════════════════════════════════════════════════════════

HELIUS: $500-2000
  - 100M calls/month at standard tier

BIRDEYE: $200-500
  - 50M API calls/month

DEXSCREENER: Free (public API)

SOLSCAN: Free (public API, rate limited)

DATABASE (Supabase):
  - Storage: 500GB = $200/month
  - Compute: Standard = $500/month
  - Total: $700/month

COMPUTE (Vercel):
  - Serverless functions for data processing
  - Real-time alerts + webhooks
  - Est: $200/month

DATA PROCESSING (AWS Lambda optional):
  - Heavy ML workloads
  - Batch processing
  - Est: $300-500/month

TOTAL MONTHLY: ~$2000-4500

TOTAL ANNUAL: ~$24,000-54,000


═══════════════════════════════════════════════════════════════════════════════════
FINAL DELIVERABLE STRUCTURE
═══════════════════════════════════════════════════════════════════════════════════

/og-scan-advanced-system/
  ├── /data-layer/
  │   ├── schema.sql (all table definitions)
  │   ├── migrations/ (version control for schema)
  │   └── seeds/ (sample data)
  │
  ├── /api-integrations/
  │   ├── helius.ts (Helius wrapper)
  │   ├── birdeye.ts (Birdeye wrapper)
  │   ├── dexscreener.ts (DexScreener wrapper)
  │   ├── solscan.ts (Solscan wrapper)
  │   └── jupiter.ts (Jupiter wrapper)
  │
  ├── /data-pipeline/
  │   ├── token-forensics.ts (deployer + creation analysis)
  │   ├── holder-analysis.ts (balance + PnL calculation)
  │   ├── transaction-indexing.ts (full tx history)
  │   ├── liquidity-tracking.ts (LP analysis)
  │   ├── price-candles.ts (OHLCV ingestion)
  │   └── risk-scoring.ts (risk model)
  │
  ├── /analytics-engine/
  │   ├── wallet-clustering.ts (DBSCAN)
  │   ├── pattern-detection.ts (wash trades, pumps)
  │   ├── anomaly-detection.ts (real-time alerts)
  │   └── ml-models/ (price prediction, etc)
  │
  ├── /reporting/
  │   ├── pdf-generator.ts (enhanced with all data)
  │   ├── dashboard.tsx (real-time analytics)
  │   ├── alerts.ts (email/webhook notifications)
  │   └── exports/ (CSV, JSON exports)
  │
  └── /real-time/
      ├── websocket-manager.ts (price feeds)
      ├── stream-processor.ts (real-time updates)
      └── cache.ts (Redis for hot data)

═══════════════════════════════════════════════════════════════════════════════════
