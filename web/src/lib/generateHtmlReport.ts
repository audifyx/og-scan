// FILE: web/src/lib/generateHtmlReport.ts
// Generate beautiful interactive HTML report with full blockchain scan

import { Token } from '@/lib/og';
import { supabase } from '@/lib/supabase';
import { analyzeWhaleRisk } from '@/lib/advanced-analytics/holder-analytics';
import { predictTokenPrice, assessRugRisk } from '@/lib/ml-models';

export interface HtmlReportData {
  token: Token;
  holders: any[];
  transactions: any[];
  anomalies: any[];
  whaleRisk: any;
  predictions: any;
  rugRisk: any;
  candles: any[];
  traders: any[];
}

/**
 * Scan entire blockchain for token data
 */
export async function scanBlockchainForToken(mint: string): Promise<HtmlReportData> {
  console.log('🔍 Scanning blockchain for:', mint);

  try {
    // Fetch all data in parallel
    const [
      holdersRes,
      transactionsRes,
      anomaliesRes,
      candlesRes,
      tradersRes,
      whaleRiskData,
      predictionsData,
      rugRiskData,
    ] = await Promise.allSettled([
      supabase
        .from('holder_snapshots')
        .select('*')
        .eq('mint_address', mint)
        .order('balance_usd', { ascending: false })
        .limit(1000),
      supabase
        .from('transactions_extended')
        .select('*')
        .eq('mint_address', mint)
        .order('blockchain_timestamp', { ascending: false })
        .limit(2000),
      supabase
        .from('real_time_alerts')
        .select('*')
        .eq('mint_address', mint)
        .order('triggered_timestamp', { ascending: false })
        .limit(500),
      supabase
        .from('price_candles_extended')
        .select('*')
        .eq('mint_address', mint)
        .order('candle_timestamp', { ascending: false })
        .limit(500),
      supabase
        .from('wallet_profiles_extended')
        .select('*')
        .eq('mint_address', mint)
        .limit(100),
      analyzeWhaleRisk(mint),
      predictTokenPrice(mint),
      assessRugRisk(mint),
    ]);

    return {
      token: {} as Token,
      holders: holdersRes.status === 'fulfilled' ? holdersRes.value.data || [] : [],
      transactions: transactionsRes.status === 'fulfilled' ? transactionsRes.value.data || [] : [],
      anomalies: anomaliesRes.status === 'fulfilled' ? anomaliesRes.value.data || [] : [],
      whaleRisk: whaleRiskData.status === 'fulfilled' ? whaleRiskData.value : null,
      predictions: predictionsData.status === 'fulfilled' ? predictionsData.value : null,
      rugRisk: rugRiskData.status === 'fulfilled' ? rugRiskData.value : null,
      candles: candlesRes.status === 'fulfilled' ? candlesRes.value.data || [] : [],
      traders: tradersRes.status === 'fulfilled' ? tradersRes.value.data || [] : [],
    };
  } catch (error) {
    console.error('Blockchain scan error:', error);
    throw error;
  }
}

/**
 * Generate beautiful HTML report
 */
export async function generateHtmlReport(token: Token): Promise<string> {
  console.log('📊 Scanning and generating HTML report for:', token.name);

  // Scan blockchain
  const data = await scanBlockchainForToken(token.mint);

  // Calculate statistics
  const topHolders = data.holders.slice(0, 20);
  const totalHolderValue = data.holders.reduce((sum, h) => sum + (h.balance_usd || 0), 0);
  const avgHolderValue = totalHolderValue / Math.max(data.holders.length, 1);
  const whaleCount = data.holders.filter((h) => (h.balance_percent_of_supply || 0) > 1).length;

  const totalVolume = data.transactions.reduce((sum, t) => sum + (t.usd_volume || 0), 0);
  const profitableTrades = data.transactions.filter((t) => (t.profit_loss_usd || 0) > 0).length;
  const avgProfit = (data.transactions.reduce((sum, t) => sum + (t.profit_loss_usd || 0), 0) / Math.max(data.transactions.length, 1));

  const criticalAnomalies = data.anomalies.filter((a) => a.severity === 'critical').length;
  const highAnomalies = data.anomalies.filter((a) => a.severity === 'high').length;

  // Generate HTML
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$${token.name} - OG Scan Intelligence Report</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1a1f2e 100%);
      color: #e0e0e0;
      line-height: 1.6;
      overflow-x: hidden;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0;
    }

    /* HEADER BANNER */
    .header-banner {
      background: linear-gradient(135deg, #1a1f2e 0%, #2d3748 50%, #1a1f2e 100%);
      border-bottom: 3px solid #38c4dc;
      padding: 40px 20px;
      text-align: center;
      position: relative;
      overflow: hidden;
      animation: slideDown 0.6s ease-out;
    }

    @keyframes slideDown {
      from { transform: translateY(-50px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .header-banner::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at 50% 0%, rgba(56, 196, 220, 0.1) 0%, transparent 70%);
      pointer-events: none;
    }

    .header-content {
      position: relative;
      z-index: 1;
    }

    .token-title {
      font-size: 3.5em;
      font-weight: 900;
      background: linear-gradient(135deg, #38c4dc 0%, #64ffda 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 15px;
      letter-spacing: -2px;
      animation: fadeInDown 0.8s ease-out;
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .price-info {
      display: flex;
      justify-content: center;
      align-items: baseline;
      gap: 30px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .price {
      font-size: 2em;
      color: #64ffda;
      font-weight: bold;
    }

    .change {
      font-size: 1.5em;
      font-weight: bold;
      padding: 8px 16px;
      border-radius: 8px;
      ${token.change24h >= 0 
        ? 'background: rgba(100, 255, 100, 0.1); color: #64ff64;' 
        : 'background: rgba(255, 100, 100, 0.1); color: #ff6464;'
      }
    }

    .contract-info {
      font-size: 0.9em;
      color: #999;
      margin-top: 15px;
      font-family: 'Monaco', 'Courier New', monospace;
      word-break: break-all;
    }

    /* STATS GRID */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      padding: 30px 20px;
      background: rgba(0, 0, 0, 0.2);
    }

    .stat-card {
      background: linear-gradient(135deg, rgba(56, 196, 220, 0.1) 0%, rgba(100, 255, 100, 0.05) 100%);
      border: 1px solid rgba(56, 196, 220, 0.3);
      border-radius: 12px;
      padding: 20px;
      transition: all 0.3s ease;
      animation: fadeInUp 0.6s ease-out forwards;
      opacity: 0;
    }

    .stat-card:nth-child(1) { animation-delay: 0.1s; }
    .stat-card:nth-child(2) { animation-delay: 0.2s; }
    .stat-card:nth-child(3) { animation-delay: 0.3s; }
    .stat-card:nth-child(4) { animation-delay: 0.4s; }
    .stat-card:nth-child(5) { animation-delay: 0.5s; }
    .stat-card:nth-child(6) { animation-delay: 0.6s; }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .stat-card:hover {
      background: linear-gradient(135deg, rgba(56, 196, 220, 0.2) 0%, rgba(100, 255, 100, 0.1) 100%);
      border-color: rgba(56, 196, 220, 0.6);
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(56, 196, 220, 0.1);
    }

    .stat-label {
      font-size: 0.85em;
      color: #999;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .stat-value {
      font-size: 1.8em;
      font-weight: bold;
      color: #38c4dc;
    }

    /* SECTIONS */
    .section {
      padding: 40px 20px;
      border-bottom: 1px solid rgba(56, 196, 220, 0.1);
      animation: fadeIn 0.8s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .section-title {
      font-size: 2em;
      color: #38c4dc;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: bold;
    }

    .section-title::before {
      content: '';
      width: 4px;
      height: 30px;
      background: linear-gradient(180deg, #38c4dc 0%, #64ffda 100%);
      border-radius: 2px;
    }

    .data-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .data-item {
      background: rgba(56, 196, 220, 0.05);
      border: 1px solid rgba(56, 196, 220, 0.2);
      border-radius: 10px;
      padding: 20px;
      transition: all 0.3s ease;
    }

    .data-item:hover {
      background: rgba(56, 196, 220, 0.1);
      border-color: rgba(56, 196, 220, 0.5);
      transform: translateX(5px);
    }

    .data-label {
      font-size: 0.9em;
      color: #999;
      margin-bottom: 8px;
    }

    .data-value {
      font-size: 1.4em;
      color: #64ffda;
      font-weight: bold;
    }

    /* TABLES */
    .table-container {
      overflow-x: auto;
      margin: 20px 0;
      border-radius: 10px;
      border: 1px solid rgba(56, 196, 220, 0.2);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: rgba(0, 0, 0, 0.3);
    }

    th {
      background: rgba(56, 196, 220, 0.1);
      color: #38c4dc;
      padding: 15px;
      text-align: left;
      font-weight: bold;
      border-bottom: 2px solid rgba(56, 196, 220, 0.3);
      font-size: 0.95em;
    }

    td {
      padding: 12px 15px;
      border-bottom: 1px solid rgba(56, 196, 220, 0.1);
      font-size: 0.9em;
    }

    tr:hover {
      background: rgba(56, 196, 220, 0.05);
    }

    /* CHARTS */
    .chart-container {
      position: relative;
      height: 400px;
      margin: 30px 0;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      padding: 20px;
      border: 1px solid rgba(56, 196, 220, 0.2);
    }

    /* RISK BADGES */
    .risk-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: bold;
      margin: 5px 5px 5px 0;
    }

    .risk-critical {
      background: rgba(255, 100, 100, 0.2);
      color: #ff6464;
      border: 1px solid rgba(255, 100, 100, 0.4);
    }

    .risk-high {
      background: rgba(255, 200, 100, 0.2);
      color: #ffc864;
      border: 1px solid rgba(255, 200, 100, 0.4);
    }

    .risk-medium {
      background: rgba(255, 255, 100, 0.2);
      color: #ffff64;
      border: 1px solid rgba(255, 255, 100, 0.4);
    }

    .risk-low {
      background: rgba(100, 255, 100, 0.2);
      color: #64ff64;
      border: 1px solid rgba(100, 255, 100, 0.4);
    }

    /* FOOTER */
    .footer {
      background: rgba(0, 0, 0, 0.5);
      border-top: 1px solid rgba(56, 196, 220, 0.2);
      padding: 30px 20px;
      text-align: center;
      color: #666;
      font-size: 0.9em;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }

    .footer-link {
      color: #38c4dc;
      text-decoration: none;
      transition: color 0.3s;
    }

    .footer-link:hover {
      color: #64ffda;
    }

    /* DOWNLOAD BUTTON */
    .download-btn {
      position: fixed;
      bottom: 30px;
      right: 30px;
      padding: 12px 24px;
      background: linear-gradient(135deg, #38c4dc 0%, #64ffda 100%);
      color: #0f172a;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      font-size: 0.95em;
      transition: all 0.3s;
      box-shadow: 0 10px 30px rgba(56, 196, 220, 0.3);
      z-index: 1000;
    }

    .download-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 40px rgba(56, 196, 220, 0.5);
    }

    .download-btn:active {
      transform: translateY(-1px);
    }

    /* SCROLLBAR */
    ::-webkit-scrollbar {
      width: 10px;
    }

    ::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.3);
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(56, 196, 220, 0.5);
      border-radius: 5px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(56, 196, 220, 0.8);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER BANNER -->
    <div class="header-banner">
      <div class="header-content">
        <h1 class="token-title">\$${token.name}</h1>
        <div class="price-info">
          <div class="price">$${token.usdPrice.toFixed(10)}</div>
          <div class="change">${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}% (24H)</div>
        </div>
        <div class="contract-info">
          ${token.mint}
        </div>
      </div>
    </div>

    <!-- QUICK STATS -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Market Cap</div>
        <div class="stat-value">$${(token.marketCap / 1e6).toFixed(2)}M</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Liquidity</div>
        <div class="stat-value">$${(token.liquidity / 1e3).toFixed(0)}K</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">24H Volume</div>
        <div class="stat-value">$${(token.volume24h / 1e3).toFixed(1)}K</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Holders</div>
        <div class="stat-value">${(token.holderCount / 1e3).toFixed(1)}K</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Transactions</div>
        <div class="stat-value">${(data.transactions.length || 0).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Age</div>
        <div class="stat-value">${Math.floor((Date.now() - (token.mintedAt || 0) * 1000) / 86400000)} days</div>
      </div>
    </div>

    <!-- CONTRACT DETAILS -->
    <div class="section">
      <h2 class="section-title">📋 Contract Details</h2>
      <div class="data-grid">
        <div class="data-item">
          <div class="data-label">Mint Authority</div>
          <div class="data-value">${token.mintAuthorityRenounced ? '✓ Renounced' : '✗ Active'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Freeze Authority</div>
          <div class="data-value">${token.freezeAuthorityRenounced ? '✓ Renounced' : '✗ Active'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Total Supply</div>
          <div class="data-value">${(token.totalSupply / 1e9).toFixed(2)}B</div>
        </div>
        <div class="data-item">
          <div class="data-label">Circulating Supply</div>
          <div class="data-value">${(token.circulatingSupply / 1e9).toFixed(2)}B</div>
        </div>
        <div class="data-item">
          <div class="data-label">Liquidity Locked</div>
          <div class="data-value">${token.liquidityLocked ? '✓ Yes' : '✗ No'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Top Holder %</div>
          <div class="data-value">${token.topHolderPercent?.toFixed(2) || 'N/A'}%</div>
        </div>
      </div>
    </div>

    <!-- HOLDER ANALYSIS -->
    <div class="section">
      <h2 class="section-title">💎 Top Holders (${data.holders.length} Total)</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Wallet</th>
              <th>Balance</th>
              <th>% of Supply</th>
              <th>Unrealized PnL</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${topHolders.map((h, idx) => \`
              <tr>
                <td>#\${idx + 1}</td>
                <td>\${h.wallet_address.slice(0, 12)}...</td>
                <td>$\${(h.balance_usd / 1000).toFixed(1)}K</td>
                <td>\${(h.balance_percent_of_supply || 0).toFixed(2)}%</td>
                <td style="color: \${h.unrealized_pnl_percent >= 0 ? '#64ff64' : '#ff6464'}">\${h.unrealized_pnl_percent?.toFixed(0) || 'N/A'}%</td>
                <td>\${h.classification || 'Unknown'}</td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- WHALE ANALYSIS -->
    <div class="section">
      <h2 class="section-title">🐋 Whale Analysis</h2>
      <div class="data-grid">
        <div class="data-item">
          <div class="data-label">Total Whale Power</div>
          <div class="data-value">\${data.whaleRisk?.totalWhalePower.toFixed(1) || '0'}%</div>
        </div>
        <div class="data-item">
          <div class="data-label">Critical Risk Wallets</div>
          <div class="data-value">\${data.whaleRisk?.criticalRiskWallets || '0'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Dump Probability</div>
          <div class="data-value">\${data.whaleRisk?.dumpProbability.toFixed(0) || '0'}%</div>
        </div>
        <div class="data-item">
          <div class="data-label">Price Impact (if whales exit)</div>
          <div class="data-value">\${data.whaleRisk?.priceImpactPercent.toFixed(1) || '0'}%</div>
        </div>
      </div>
    </div>

    <!-- RECENT ANOMALIES -->
    <div class="section">
      <h2 class="section-title">⚠️ Real-Time Anomalies (${data.anomalies.length} Total)</h2>
      <div class="data-grid" style="grid-template-columns: 1fr;">
        ${data.anomalies.slice(0, 10).map(a => \`
          <div class="data-item" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div class="data-label">\${a.alert_type}</div>
              <div style="font-size: 0.9em; color: #999;">\${new Date(a.triggered_timestamp * 1000).toLocaleString()}</div>
            </div>
            <div class="risk-badge risk-\${a.severity}">\${a.severity.toUpperCase()}</div>
          </div>
        \`).join('')}
      </div>
    </div>

    <!-- TRANSACTIONS -->
    <div class="section">
      <h2 class="section-title">📊 Transaction History (${data.transactions.length} Total)</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Volume</th>
              <th>PnL</th>
            </tr>
          </thead>
          <tbody>
            ${data.transactions.slice(0, 20).map(t => \`
              <tr>
                <td>\${new Date(t.blockchain_timestamp * 1000).toLocaleDateString()}</td>
                <td>\${t.direction?.toUpperCase() || 'SWAP'}</td>
                <td>\${(Number(t.token_amount) / 1e6).toFixed(2)}</td>
                <td>$\${(t.usd_volume || 0).toFixed(0)}</td>
                <td style="color: \${(t.profit_loss_usd || 0) >= 0 ? '#64ff64' : '#ff6464'};">$\${(t.profit_loss_usd || 0).toFixed(0)}</td>
              </tr>
            \`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- ML PREDICTIONS -->
    <div class="section">
      <h2 class="section-title">🤖 ML Predictions & Risk Assessment</h2>
      <div class="data-grid">
        <div class="data-item">
          <div class="data-label">1H Price Forecast</div>
          <div class="data-value">$\${data.predictions?.nextHourPrice.toFixed(10) || 'N/A'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">24H Price Forecast</div>
          <div class="data-value">$\${data.predictions?.next24hPrice.toFixed(10) || 'N/A'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Direction</div>
          <div class="data-value">\${data.predictions?.direction.toUpperCase() || 'N/A'}</div>
        </div>
        <div class="data-item">
          <div class="data-label">Confidence</div>
          <div class="data-value">\${data.predictions ? (data.predictions.confidence * 100).toFixed(0) : '0'}%</div>
        </div>
        <div class="data-item">
          <div class="data-label">Rug Probability</div>
          <div class="data-value">\${data.rugRisk?.rugProbability.toFixed(0) || '0'}%</div>
        </div>
        <div class="data-item">
          <div class="data-label">Rug Verdict</div>
          <div class="data-value">\${data.rugRisk?.verdict.toUpperCase() || 'UNKNOWN'}</div>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-links">
        <a href="#" class="footer-link">Dextools</a>
        <a href="#" class="footer-link">Dexscreener</a>
        <a href="#" class="footer-link">SolScan</a>
      </div>
      <p>OG Scan Intelligence Report | Generated ${new Date().toLocaleString()}</p>
      <p>Token: ${token.mint.slice(0, 20)}... | Holders: ${data.holders.length} | Transactions: ${data.transactions.length}</p>
    </div>
  </div>

  <!-- DOWNLOAD BUTTON -->
  <button class="download-btn" onclick="downloadAsHTML()">⬇️ Download HTML</button>

  <script>
    function downloadAsHTML() {
      const html = document.documentElement.outerHTML;
      const blob = new Blob([html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '${token.name}-${token.mint.slice(0, 8)}-OGScan-Report.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>
`;

  return html;
}
