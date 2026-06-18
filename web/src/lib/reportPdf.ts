import { Token } from '@/lib/og';
import { OgClassification } from '@/lib/classification';

export interface PdfReportInput {
  token: Token;
  score?: OgClassification;
  report?: string;
}

export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  const { token } = input;

  try {
    // Generate simple HTML report
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OG Scan Report</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0a0a0a; color: #fff; margin: 0; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; background: #1a1a1a; padding: 30px; border-radius: 10px; }
    .header { background: linear-gradient(135deg, #FFD700 0%, #FFC700 100%); color: #000; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
    .header h1 { margin: 0 0 10px 0; font-size: 32px; }
    .header .token-name { font-size: 24px; margin: 10px 0; }
    .header .price { font-size: 20px; margin: 10px 0; }
    .section { margin: 30px 0; }
    .section h2 { color: #FFD700; border-bottom: 2px solid #FFD700; padding-bottom: 10px; font-size: 18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; }
    .card { background: #2a2a2a; padding: 15px; border-radius: 8px; border-left: 4px solid #FFD700; }
    .card-label { color: #999; font-size: 12px; margin-bottom: 5px; }
    .card-value { color: #FFD700; font-size: 20px; font-weight: bold; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; }
    .positive { color: #64FF00; }
    .negative { color: #FF4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>🔍 OG SCAN</div>
      <div class="token-name">${token.name}</div>
      <div class="price">$${(token.priceUsd || 0).toFixed(8)}</div>
      <div class="${(token.stats24h?.priceChange || 0) >= 0 ? 'positive' : 'negative'}">
        24H: ${(token.stats24h?.priceChange || 0) >= 0 ? '+' : ''}${(token.stats24h?.priceChange || 0).toFixed(2)}%
      </div>
    </div>

    <div class="section">
      <h2>KEY METRICS</h2>
      <div class="grid">
        <div class="card">
          <div class="card-label">Market Cap</div>
          <div class="card-value">$${(token.marketCapUsd ? token.marketCapUsd / 1e6 : 0).toFixed(2)}M</div>
        </div>
        <div class="card">
          <div class="card-label">Liquidity</div>
          <div class="card-value">$${(token.liquidityUsd ? token.liquidityUsd / 1e3 : 0).toFixed(1)}K</div>
        </div>
        <div class="card">
          <div class="card-label">24H Volume</div>
          <div class="card-value">$${(token.volume24hUsd ? token.volume24hUsd / 1e3 : 0).toFixed(1)}K</div>
        </div>
        <div class="card">
          <div class="card-label">Holders</div>
          <div class="card-value">${token.holderCount || 'N/A'}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>CONTRACT INFO</h2>
      <div class="grid">
        <div class="card">
          <div class="card-label">Total Supply</div>
          <div class="card-value">${(token.totalSupply ? token.totalSupply / 1e9 : 0).toFixed(2)}B</div>
        </div>
        <div class="card">
          <div class="card-label">Decimals</div>
          <div class="card-value">${token.decimals || 'N/A'}</div>
        </div>
        <div class="card">
          <div class="card-label">Mint Address</div>
          <div class="card-value" style="font-size: 12px; word-break: break-all;">${token.mint}</div>
        </div>
        <div class="card">
          <div class="card-label">Chain</div>
          <div class="card-value">${token.chainId || 'Solana'}</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <strong>OG SCAN Intelligence Report</strong><br>
      Generated: ${new Date().toLocaleString()}<br>
      Blockchain Intelligence Platform
    </div>
  </div>
</body>
</html>`;

    // Download as HTML
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${token.name}-${token.mint.slice(0, 8)}-OGScan.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ Report downloaded:', link.download);
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error generating report');
  }
}
