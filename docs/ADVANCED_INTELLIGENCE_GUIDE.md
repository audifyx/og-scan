╔════════════════════════════════════════════════════════════════════════════════╗
║                   OG SCAN ADVANCED INTELLIGENCE SYSTEM                         ║
║                          Quick Start Guide v1.0                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════════
WHAT'S NEW
═══════════════════════════════════════════════════════════════════════════════════

✨ **ADVANCED INTELLIGENCE DASHBOARD** - Access at: `/advanced/:mint`

Six powerful tabs for deep token forensics:
1. 💎 Holder Analysis - PnL breakdown, cost basis, behavior classification
2. 🏆 Top Traders - Leaderboard by realized profits
3. 🐋 Whale Risk - Concentration, dump probability, price impact analysis
4. 🛡️ Risk Dashboard - Comprehensive risk scoring
5. ⚠️ Anomalies - Real-time alert detection
6. 📈 Price Action - Technical indicators, order flow

═══════════════════════════════════════════════════════════════════════════════════
ACCESSING ADVANCED INTELLIGENCE
═══════════════════════════════════════════════════════════════════════════════════

1. Scan any token to get the mint address
2. Navigate to: `/advanced/{mint}`
   Example: `/advanced/AvxFBjWydMYWD7C8pHzSkGxNYAFWr7aNBbAKm84bpump`

3. Or from token page, look for "Advanced Intelligence" button (coming soon)

═══════════════════════════════════════════════════════════════════════════════════
HOLDER ANALYSIS TAB
═══════════════════════════════════════════════════════════════════════════════════

📊 WHAT YOU SEE:
  • Top holders with their current USD value
  • Entry price & cost basis (what they paid on average)
  • Unrealized PnL (profit if they sell now)
  • Realized PnL (profit already locked in)
  • Total PnL % (overall return)
  • Holder classification: 💎 Diamond Hand, 📈 Swing Trader, 🎒 Bag Holder, 🤖 Bot
  • Number of buys/sells per holder

💡 HOW TO USE:
  1. Identify whale holders (sort by Balance USD, descending)
  2. Check unrealized PnL % - high gains = dump risk
  3. Look at flip frequency (buys/sells) - frequent sellers = less committed
  4. Find "Diamond Hands" (never sold) - true believers
  5. Filter by classification to find behavior patterns

⚠️ RED FLAGS:
  • Multiple holders with >100% unrealized gains
  • Top holders are swing traders (constantly buying/selling)
  • Majority of holders are bag holders (underwater)
  • High concentration (top 10 = >50% of supply)

═══════════════════════════════════════════════════════════════════════════════════
TOP TRADERS TAB
═══════════════════════════════════════════════════════════════════════════════════

🏆 WHAT YOU SEE:
  • Ranked list of most profitable sellers (by total PnL)
  • Win rate % (% of profitable trades)
  • Number of successful trades
  • Best trade PnL (largest single profit)
  • Total volume they've traded

💡 HOW TO USE:
  1. Find the most profitable traders - track their behavior
  2. Identify "repeat winners" with high win rates
  3. Look at trade sizes - consistent or erratic?
  4. Compare with holders - are top traders also holders?
  5. See if successful traders are exiting (selling) or accumulating

⚡ POWER MOVE:
  Copy the top 5 profitable traders' moves for insights on future price action

═══════════════════════════════════════════════════════════════════════════════════
WHALE RISK TAB
═══════════════════════════════════════════════════════════════════════════════════

🐋 CRITICAL METRICS:
  • Total Whale Power: % of token held by whales (>1% each)
  • Critical Risk Wallets: Count of whales with >100% unrealized gains
  • Dump Probability: % chance whales will exit soon

🔥 DUMP PROBABILITY FACTORS:
  • Each whale with >100% gains = +20% probability
  • Whale power distribution = -points if spread out
  • Holding duration = longer = higher dump risk

⚠️ DANGER ZONES:
  • Dump probability >80% = CRITICAL - whales likely to exit
  • Dump probability >50% = HIGH - watch for activity
  • Total whale power >30% = High concentration risk

💰 PRICE IMPACT IF DUMP:
  If top 5 whales all sell at once, price could drop by up to:
  (Total whale % × 0.5) = estimated impact

═══════════════════════════════════════════════════════════════════════════════════
RISK DASHBOARD TAB
═══════════════════════════════════════════════════════════════════════════════════

🛡️ OVERALL RISK SCORE: 0-100 (higher = more risky)

RISK FACTORS:
  1. Holder Concentration Risk (0-30 pts)
     • Top 10 holders >50% = 30 pts
     • Top 10 holders >30% = 20 pts
     • Top 10 holders >20% = 10 pts

  2. Deployer History Risk (0-25 pts)
     • Deployer success rate <10% = 25 pts (likely to rug)
     • Success rate <30% = 15 pts
     • Success rate <50% = 8 pts

  3. Liquidity Risk (0-25 pts)
     • <$50K liquidity = 25 pts (extreme slippage)
     • <$200K = 15 pts
     • <$500K = 8 pts

  4. Authority Risk (0-20 pts)
     • Mint authority still active = 20 pts (can mint more)
     • Freeze authority active = 10 pts (can freeze transfers)

SAFE SCORES: <30 (green)
CAUTION ZONE: 30-60 (yellow)
HIGH RISK: 60-80 (orange)
CRITICAL: >80 (red)

═══════════════════════════════════════════════════════════════════════════════════
ANOMALIES TAB
═══════════════════════════════════════════════════════════════════════════════════

🚨 REAL-TIME ALERTS FOR:

📍 Price Spikes
  • Sudden >20% price moves in 5 minutes
  • Severity: CRITICAL (>50%), HIGH (>30%), MEDIUM (>20%)

📊 Volume Spikes
  • Volume >3x standard deviation from recent average
  • Could indicate whale buys, panic selling, or bot activity

🐳 Whale Activity
  • Sudden large balance changes from holders
  • >10% balance change in one transaction

⚡ Order Flow Imbalance
  • Buy/sell volume heavily skewed one direction
  • Buy pressure >70% = potential pump, Sell >70% = potential dump

💡 HOW TO TRADE ON ALERTS:
  • CRITICAL alert = immediate action (check context first!)
  • HIGH alert = monitor closely
  • Check which holders caused the activity
  • Correlate with social media activity/news

═══════════════════════════════════════════════════════════════════════════════════
PRICE ACTION TAB
═══════════════════════════════════════════════════════════════════════════════════

📈 TECHNICAL INDICATORS (1H timeframe):

RSI (14):
  • <30 = Oversold (potential bounce)
  • 30-70 = Normal
  • >70 = Overbought (potential pullback)

MACD:
  • Bullish = Moving average convergence divergence is positive (uptrend)
  • Bearish = MACD is negative (downtrend)

Bollinger Bands:
  • Price near upper band = Overbought
  • Price near lower band = Oversold
  • Wide bands = High volatility
  • Tight bands = Low volatility (breakout coming?)

Buy/Sell Volume:
  • Buy volume >> Sell volume = Bullish
  • Sell volume >> Buy volume = Bearish

💡 READING THE CHARTS:
  1. Check RSI - is price overbought/oversold?
  2. Look at volume spikes - when do they happen?
  3. Correlate price moves with volume
  4. Check MACD for trend direction
  5. Use Bollinger Bands for breakout levels

═══════════════════════════════════════════════════════════════════════════════════
COMPLETE TRADING CHECKLIST
═══════════════════════════════════════════════════════════════════════════════════

Before buying a token, check all these tabs:

HOLDER ANALYSIS:
  ☐ Are top 10 holders <50% of supply?
  ☐ Are there "diamond hands" (no sales)?
  ☐ Entry prices reasonable (not all at peak)?

TOP TRADERS:
  ☐ Do successful traders exist (win rate >50%)?
  ☐ Are they accumulating or exiting?

WHALE RISK:
  ☐ Dump probability <50%?
  ☐ Total whale power <30%?
  ☐ No single whale with >100% gains?

RISK DASHBOARD:
  ☐ Overall risk <50?
  ☐ No single risk factor >70?

ANOMALIES:
  ☐ No recent critical alerts?
  ☐ No suspicious whale activity?

PRICE ACTION:
  ☐ RSI not in extreme (30-70 zone)?
  ☐ Buy volume > Sell volume?
  ☐ Recent volume spikes make sense?

If you check all these and get GREEN on most, token is likely safer than random pick.

═══════════════════════════════════════════════════════════════════════════════════
DATA POPULATION (IMPORTANT!)
═══════════════════════════════════════════════════════════════════════════════════

⚠️ Currently the advanced intelligence features are STRUCTURE-READY but not populated.

TO POPULATE WITH REAL DATA:

Phase 1: Historical Data Import
  1. Implement Helius API integration for transaction history
  2. Fetch all holders via searchAssets API
  3. Import price history from Birdeye
  4. Calculate PnL for all wallets
  Est. time: 1-2 weeks per 1000 tokens

Phase 2: Real-Time Updates
  1. Setup WebSocket feeds for price/trades
  2. Update holder snapshots every 5 minutes
  3. Trigger anomaly detection in real-time
  Est. time: 1 week

Phase 3: ML Models
  1. Deploy price prediction model
  2. Rug detection model
  3. Whale behavior prediction
  Est. time: 2-3 weeks

═══════════════════════════════════════════════════════════════════════════════════
DATABASE TABLES CREATED
═══════════════════════════════════════════════════════════════════════════════════

✅ holder_snapshots - Time-series PnL data per holder
✅ transactions_extended - Full transaction history with PnL
✅ liquidity_pools_extended - All LP data and metrics
✅ liquidity_provider_snapshots - LP position data over time
✅ price_candles_extended - OHLCV + technical indicators
✅ wallet_profiles_extended - Wallet performance metrics
✅ wallet_clusters - Grouped coordinated wallets
✅ dex_paid_campaigns - Marketing spend tracking
✅ real_time_alerts - Anomaly detection results

═══════════════════════════════════════════════════════════════════════════════════
API INTEGRATION CHECKLIST
═══════════════════════════════════════════════════════════════════════════════════

To fully enable advanced intelligence:

PRIORITY 1 (This Week):
  ☐ Helius API integration for transaction history
  ☐ Calculate PnL for each wallet
  ☐ Populate holder_snapshots table
  ☐ Add deployer forensics tracking

PRIORITY 2 (Next Week):
  ☐ Birdeye price history import
  ☐ Technical indicator calculations
  ☐ Risk scoring algorithm
  ☐ Whale detection thresholds

PRIORITY 3 (Week 3):
  ☐ Real-time WebSocket feeds
  ☐ Anomaly detection engine
  ☐ Alert system setup
  ☐ Scheduled data refresh jobs

═══════════════════════════════════════════════════════════════════════════════════
ROADMAP
═══════════════════════════════════════════════════════════════════════════════════

✅ DONE (Current):
  • Database schema
  • UI components
  • Frontend routes
  • Analytics functions
  • Risk scoring logic

🔄 IN PROGRESS:
  • Data population from APIs
  • Real-time WebSocket feeds
  • Anomaly detection triggers

⏳ COMING SOON:
  • ML price prediction
  • Rug detection models
  • API endpoints for data export
  • Dashboard customization
  • Alert notifications
  • Export to CSV/JSON

═══════════════════════════════════════════════════════════════════════════════════
QUESTIONS?
═══════════════════════════════════════════════════════════════════════════════════

Check the comprehensive spec documents:
  • OG_SCAN_ADVANCED_INTELLIGENCE_SPEC.md (10,000+ lines)
  • OG_SCAN_IMPLEMENTATION_CODE.md (5,000+ lines)

═══════════════════════════════════════════════════════════════════════════════════
