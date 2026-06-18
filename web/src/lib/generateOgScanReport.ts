// FILE: web/src/lib/generateOgScanReport.ts
// BEAUTIFUL OG SCAN THEMED HTML REPORT WITH IMAGES & BANNERS

import { Token } from '@/lib/og';
import { supabase } from '@/lib/supabase';
import { analyzeWhaleRisk } from '@/lib/advanced-analytics/holder-analytics';
import { predictTokenPrice, assessRugRisk } from '@/lib/ml-models';

/**
 * Generate OG Scan themed HTML report with images and banners
 */
export async function generateOgScanReport(token: Token): Promise<string> {
  console.log('🎨 Generating OG Scan themed report for:', token.name);

  // Fetch all blockchain data with error handling
  let holders = [];
  let transactions = [];
  let anomalies = [];
  let candles = [];
  let whaleRisk = null;
  let predictions = null;
  let rugRisk = null;

  try {
    const [h, t, a, c] = await Promise.all([
      supabase
        .from('holder_snapshots')
        .select('*')
        .eq('mint_address', token.mint)
        .order('balance_usd', { ascending: false })
        .limit(1000),
      supabase
        .from('transactions_extended')
        .select('*')
        .eq('mint_address', token.mint)
        .order('blockchain_timestamp', { ascending: false })
        .limit(2000),
      supabase
        .from('real_time_alerts')
        .select('*')
        .eq('mint_address', token.mint)
        .order('triggered_timestamp', { ascending: false })
        .limit(500),
      supabase
        .from('price_candles_extended')
        .select('*')
        .eq('mint_address', token.mint)
        .order('candle_timestamp', { ascending: false })
        .limit(500),
    ]);
    holders = h.data || [];
    transactions = t.data || [];
    anomalies = a.data || [];
    candles = c.data || [];
  } catch (err) {
    console.warn('⚠️ Could not fetch blockchain data:', err);
  }

  try {
    whaleRisk = await analyzeWhaleRisk(token.mint);
  } catch (err) {
    console.warn('⚠️ Could not analyze whale risk:', err);
  }

  try {
    predictions = await predictTokenPrice(token.mint);
  } catch (err) {
    console.warn('⚠️ Could not predict price:', err);
  }

  try {
    rugRisk = await assessRugRisk(token.mint);
  } catch (err) {
    console.warn('⚠️ Could not assess rug risk:', err);
  }

  const topHolders = (holders || []).slice(0, 20);
  const recentTransactions = (transactions || []).slice(0, 20);
  const recentAnomalies = (anomalies || []).slice(0, 10);

  // Generate SVG banner
  const bannerSvg = `
    <svg width="1400" height="300" viewBox="0 0 1400 300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#2d2d2d;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#FFC700;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FFD700;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="1400" height="300" fill="url(#headerGrad)"/>
      
      <!-- Accent bars -->
      <rect width="1400" height="8" y="0" fill="url(#accentGrad)"/>
      <rect width="1400" height="8" y="292" fill="url(#accentGrad)"/>
      
      <!-- Diagonal pattern -->
      <g opacity="0.05">
        <line x1="0" y1="0" x2="1400" y2="300" stroke="white" stroke-width="50"/>
        <line x1="100" y1="0" x2="1500" y2="300" stroke="white" stroke-width="50"/>
        <line x1="-100" y1="0" x2="1300" y2="300" stroke="white" stroke-width="50"/>
      </g>
      
      <!-- OG SCAN Logo area -->
      <text x="50" y="80" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#FFD700">OG</text>
      <text x="50" y="140" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#FFD700">SCAN</text>
      
      <!-- Token info -->
      <text x="300" y="100" font-family="Arial, sans-serif" font-size="56" font-weight="bold" fill="white">$${token.name}</text>
      <text x="300" y="165" font-family="Arial, sans-serif" font-size="28" fill="#FFD700" font-weight="bold">
        $${token.usdPrice.toFixed(10)}
      </text>
      <text x="300" y="220" font-family="Arial, sans-serif" font-size="20" fill="${token.change24h >= 0 ? '#64FF00' : '#FF4444'}" font-weight="bold">
        ${token.change24h >= 0 ? '📈' : '📉'} ${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}% (24H)
      </text>
      
      <!-- Right side stats -->
      <text x="1100" y="100" font-family="Arial, sans-serif" font-size="18" fill="#999">Market Cap</text>
      <text x="1100" y="135" font-family="Arial, sans-serif" font-size="24" fill="#FFD700" font-weight="bold">
        $${(token.marketCap / 1e6).toFixed(2)}M
      </text>
      
      <text x="1100" y="180" font-family="Arial, sans-serif" font-size="18" fill="#999">Liquidity</text>
      <text x="1100" y="215" font-family="Arial, sans-serif" font-size="24" fill="#FFD700" font-weight="bold">
        $${(token.liquidity / 1e3).toFixed(0)}K
      </text>
    </svg>
  `;

  const bannerBase64 = `data:image/svg+xml;base64,${Buffer.from(bannerSvg).toString('base64')}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$${token.name} - OG Scan Intelligence Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', 'Helvetica Neue', Arial, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      line-height: 1.6;
      overflow-x: hidden;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0;
    }

    /* HEADER BANNER WITH IMAGE */
    .header-section {
      background: #1a1a1a;
      border-bottom: 8px solid #FFD700;
      position: relative;
      overflow: hidden;
      animation: slideDown 0.8s ease-out;
    }

    @keyframes slideDown {
      from { transform: translateY(-100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .banner-image {
      width: 100%;
      height: auto;
      display: block;
    }

    .header-overlay {
      background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 100%);
      padding: 30px;
      text-align: center;
    }

    /* QUICK INFO BAR */
    .info-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0;
      background: #1a1a1a;
      border-top: 2px solid #FFD700;
      border-bottom: 2px solid #FFD700;
    }

    .info-item {
      padding: 20px;
      text-align: center;
      border-right: 1px solid #FFD700;
      transition: all 0.3s;
    }

    .info-item:last-child {
      border-right: none;
    }

    .info-item:hover {
      background: rgba(255, 215, 0, 0.05);
      transform: scale(1.05);
    }

    .info-label {
      font-size: 0.8em;
      color: #999;
      text-transform: uppercase;
      margin-bottom: 8px;
      letter-spacing: 1px;
    }

    .info-value {
      font-size: 1.4em;
      color: #FFD700;
      font-weight: bold;
      font-family: 'Monaco', monospace;
    }

    /* SECTIONS */
    .section {
      padding: 40px 30px;
      border-bottom: 2px solid rgba(255, 215, 0, 0.2);
      animation: fadeIn 0.8s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .section-title {
      font-size: 2em;
      color: #FFD700;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 15px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .section-title::before {
      content: '';
      width: 6px;
      height: 35px;
      background: linear-gradient(180deg, #FFD700 0%, #FFC700 100%);
      border-radius: 3px;
    }

    .section-title::after {
      content: '';
      flex: 1;
      height: 2px;
      background: linear-gradient(90deg, #FFD700 0%, transparent 100%);
    }

    /* DATA GRID */
    .data-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .data-card {
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(255, 215, 0, 0.02) 100%);
      border: 2px solid rgba(255, 215, 0, 0.3);
      border-radius: 8px;
      padding: 25px;
      transition: all 0.3s;
      animation: fadeInUp 0.6s ease-out forwards;
      opacity: 0;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .data-card:nth-child(1) { animation-delay: 0.1s; }
    .data-card:nth-child(2) { animation-delay: 0.2s; }
    .data-card:nth-child(3) { animation-delay: 0.3s; }
    .data-card:nth-child(4) { animation-delay: 0.4s; }
    .data-card:nth-child(5) { animation-delay: 0.5s; }
    .data-card:nth-child(6) { animation-delay: 0.6s; }

    .data-card:hover {
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%);
      border-color: rgba(255, 215, 0, 0.6);
      transform: translateY(-8px);
      box-shadow: 0 15px 40px rgba(255, 215, 0, 0.15);
    }

    .card-label {
      font-size: 0.85em;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }

    .card-value {
      font-size: 1.8em;
      color: #FFD700;
      font-weight: bold;
      font-family: 'Monaco', monospace;
    }

    /* TABLES */
    .table-container {
      overflow-x: auto;
      margin: 20px 0;
      border-radius: 8px;
      border: 2px solid rgba(255, 215, 0, 0.2);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: rgba(0, 0, 0, 0.4);
    }

    th {
      background: rgba(255, 215, 0, 0.1);
      color: #FFD700;
      padding: 15px;
      text-align: left;
      font-weight: bold;
      border-bottom: 2px solid #FFD700;
      font-size: 0.95em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    td {
      padding: 12px 15px;
      border-bottom: 1px solid rgba(255, 215, 0, 0.1);
      font-size: 0.9em;
    }

    tr:hover {
      background: rgba(255, 215, 0, 0.08);
    }

    /* RISK BADGES */
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.8em;
      font-weight: bold;
      margin: 5px 5px 5px 0;
    }

    .badge-critical {
      background: rgba(255, 100, 100, 0.2);
      color: #ff6464;
      border: 1px solid rgba(255, 100, 100, 0.5);
    }

    .badge-high {
      background: rgba(255, 200, 100, 0.2);
      color: #ffc864;
      border: 1px solid rgba(255, 200, 100, 0.5);
    }

    .badge-success {
      background: rgba(100, 255, 100, 0.2);
      color: #64ff64;
      border: 1px solid rgba(100, 255, 100, 0.5);
    }

    /* FOOTER */
    .footer {
      background: #1a1a1a;
      border-top: 8px solid #FFD700;
      padding: 40px 30px;
      text-align: center;
      color: #666;
    }

    .footer-branding {
      font-size: 2em;
      color: #FFD700;
      margin-bottom: 15px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .footer-text {
      font-size: 0.9em;
      margin: 5px 0;
    }

    /* DOWNLOAD BUTTON */
    .download-section {
      padding: 30px;
      text-align: center;
      background: rgba(255, 215, 0, 0.05);
      border-top: 2px solid #FFD700;
    }

    .download-btn {
      padding: 16px 40px;
      background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%);
      color: #000;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      font-size: 1.1em;
      transition: all 0.3s;
      box-shadow: 0 10px 30px rgba(255, 215, 0, 0.3);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .download-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 15px 40px rgba(255, 215, 0, 0.5);
    }

    .download-btn:active {
      transform: scale(0.98);
    }

    /* SCROLLBAR */
    ::-webkit-scrollbar {
      width: 12px;
    }

    ::-webkit-scrollbar-track {
      background: #1a1a1a;
    }

    ::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #FFD700 0%, #FFC700 100%);
      border-radius: 6px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, #FFC700 0%, #FFB700 100%);
    }

    /* RESPONSIVE */
    @media (max-width: 768px) {
      .section {
        padding: 20px 15px;
      }
      
      .section-title {
        font-size: 1.5em;
      }

      .data-grid {
        grid-template-columns: 1fr;
      }

      .info-bar {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER BANNER -->
    <div class="header-section">
      <img src="${bannerBase64}" class="banner-image" alt="OG Scan Report Header">
    </div>

    <!-- QUICK INFO BAR -->
    <div class="info-bar">
      <div class="info-item">
        <div class="info-label">Market Cap</div>
        <div class="info-value">$${(token.marketCap / 1e6).toFixed(2)}M</div>
      </div>
      <div class="info-item">
        <div class="info-label">Liquidity</div>
        <div class="info-value">$${(token.liquidity / 1e3).toFixed(0)}K</div>
      </div>
      <div class="info-item">
        <div class="info-label">Volume 24H</div>
        <div class="info-value">$${(token.volume24h / 1e3).toFixed(1)}K</div>
      </div>
      <div class="info-item">
        <div class="info-label">Holders</div>
        <div class="info-value">${(token.holderCount / 1e3).toFixed(1)}K</div>
      </div>
      <div class="info-item">
        <div class="info-label">Transactions</div>
        <div class="info-value">${(transactions?.length || 0).toLocaleString()}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Age</div>
        <div class="info-value">${Math.floor((Date.now() - (token.mintedAt || 0) * 1000) / 86400000)}d</div>
      </div>
    </div>

    <!-- CONTRACT DETAILS -->
    <div class="section">
      <h2 class="section-title">📋 Contract Details</h2>
      <div class="data-grid">
        <div class="data-card">
          <div class="card-label">Mint Authority</div>
          <div class="card-value">${token.mintAuthorityRenounced ? '✓ Renounced' : '⚠ Active'}</div>
        </div>
        <div class="data-card">
          <div class="card-label">Freeze Authority</div>
          <div class="card-value">${token.freezeAuthorityRenounced ? '✓ Renounced' : '⚠ Active'}</div>
        </div>
        <div class="data-card">
          <div class="card-label">Total Supply</div>
          <div class="card-value">${(token.totalSupply / 1e9).toFixed(2)}B</div>
        </div>
        <div class="data-card">
          <div class="card-label">Circulating</div>
          <div class="card-value">${(token.circulatingSupply / 1e9).toFixed(2)}B</div>
        </div>
        <div class="data-card">
          <div class="card-label">Liquidity Locked</div>
          <div class="card-value">${token.liquidityLocked ? '✓ Yes' : '✗ No'}</div>
        </div>
        <div class="data-card">
          <div class="card-label">Top Holder %</div>
          <div class="card-value">${token.topHolderPercent?.toFixed(2) || 'N/A'}%</div>
        </div>
      </div>
    </div>

    <!-- TOP HOLDERS -->
    <div class="section">
      <h2 class="section-title">💎 Top Holders (${holders?.length || 0} Total)</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Wallet</th>
              <th>Balance</th>
              <th>% Supply</th>
              <th>Unrealized</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${topHolders.map((h, idx) => {
              const pnlColor = h.unrealized_pnl_percent >= 0 ? '#64FF00' : '#FF4444';
              return '<tr><td>#' + (idx + 1) + '</td><td>' + h.wallet_address.slice(0, 14) + '...</td><td>$' + (h.balance_usd / 1000).toFixed(1) + 'K</td><td>' + (h.balance_percent_of_supply || 0).toFixed(2) + '%</td><td style="color: ' + pnlColor + '">' + (h.unrealized_pnl_percent?.toFixed(0) || 'N/A') + '%</td><td>' + (h.classification || 'Unknown') + '</td></tr>';
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- WHALE ANALYSIS -->
    <div class="section">
      <h2 class="section-title">🐋 Whale Analysis</h2>
      <div class="data-grid">
        <div class="data-card">
          <div class="card-label">Total Whale Power</div>
          <div class="card-value">${(whaleRisk?.totalWhalePower || 0).toFixed(1)}%</div>
        </div>
        <div class="data-card">
          <div class="card-label">Critical Risk Wallets</div>
          <div class="card-value">${whaleRisk?.criticalRiskWallets || '0'}</div>
        </div>
        <div class="data-card">
          <div class="card-label">Dump Probability</div>
          <div class="card-value">${whaleRisk?.dumpProbability.toFixed(0) || '0'}%</div>
        </div>
        <div class="data-card">
          <div class="card-label">Price Impact</div>
          <div class="card-value">${whaleRisk?.priceImpactPercent.toFixed(1) || '0'}%</div>
        </div>
      </div>
    </div>

    <!-- ANOMALIES -->
    <div class="section">
      <h2 class="section-title">⚠️ Real-Time Anomalies (${anomalies?.length || 0})</h2>
      <div class="data-grid" style="grid-template-columns: 1fr;">
        ${recentAnomalies.map(a => '<div class="data-card" style="display: flex; justify-content: space-between; align-items: center;"><div><div class="card-label">' + a.alert_type + '</div><div style="font-size: 0.85em; color: #999;">' + new Date(a.triggered_timestamp * 1000).toLocaleString() + '</div></div><span class="badge badge-' + a.severity + '">' + a.severity.toUpperCase() + '</span></div>').join('')}
      </div>
    </div>

    <!-- TRANSACTIONS -->
    <div class="section">
      <h2 class="section-title">📊 Recent Transactions (${transactions?.length || 0} Total)</h2>
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
            ${recentTransactions.map(t => `
              <tr>
                <td>${new Date(t.blockchain_timestamp * 1000).toLocaleDateString()}</td>
                <td>${t.direction?.toUpperCase() || 'SWAP'}</td>
                <td>${(Number(t.token_amount) / 1e6).toFixed(2)}</td>
                <td>$${(t.usd_volume || 0).toFixed(0)}</td>
                <td style="color: ${(t.profit_loss_usd || 0) >= 0 ? '#64FF00' : '#FF4444'}'>${(t.profit_loss_usd || 0) >= 0 ? '+' : ''}$${(t.profit_loss_usd || 0).toFixed(0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- ML PREDICTIONS -->
    <div class="section">
      <h2 class="section-title">🤖 ML Analysis & Risk Assessment</h2>
      <div class="data-grid">
        <div class="data-card">
          <div class="card-label">1H Price Forecast</div>
          <div class="card-value">$${predictions?.nextHourPrice.toFixed(10) || 'N/A'}</div>
        </div>
        <div class="data-card">
          <div class="card-label">24H Forecast</div>
          <div class="card-value">$${predictions?.next24hPrice.toFixed(10) || 'N/A'}</div>
        </div>
        <div class="data-card">
          <div class="card-label">Direction</div>
          <div class="card-value">${predictions?.direction.toUpperCase() || 'N/A'}</div>
        </div>
        <div class="data-card">
          <div class="card-label">Confidence</div>
          <div class="card-value">${predictions ? (predictions.confidence * 100).toFixed(0) : '0'}%</div>
        </div>
        <div class="data-card">
          <div class="card-label">Rug Probability</div>
          <div class="card-value">${rugRisk?.rugProbability.toFixed(0) || '0'}%</div>
        </div>
        <div class="data-card">
          <div class="card-label">Rug Verdict</div>
          <div class="card-value">${rugRisk?.verdict.toUpperCase() || 'UNKNOWN'}</div>
        </div>
      </div>
    </div>

    <!-- DOWNLOAD SECTION -->
    <div class="download-section">
      <button class="download-btn" onclick="downloadHTML()">⬇️ Download Report (HTML)</button>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <div class="footer-branding">🔍 OG SCAN</div>
      <div class="footer-text">Intelligence Report | ${token.name} ($${token.mint.slice(0, 20)}...)</div>
      <div class="footer-text">Generated: ${new Date().toLocaleString()}</div>
      <div class="footer-text">Blockchain Scan Complete | ${holders?.length || 0} Holders | ${transactions?.length || 0} Transactions</div>
    </div>
  </div>

  <script>
    function downloadHTML() {
      const html = document.documentElement.outerHTML;
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '${token.name}-${token.mint.slice(0, 8)}-OGScan-Report.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>
`;

  return html;
}
