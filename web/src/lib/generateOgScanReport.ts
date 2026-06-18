import { Token } from '@/lib/og';

export async function generateOgScanReport(data: any): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const { token, token: tokenData, score, holders_data = [], transactions_data = [], anomalies_data = [], whaleRisk_data, predictions_data, rugRisk_data } = data;

  console.log('📄 Generating comprehensive PDF...');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const gold = [255, 215, 0];
  const black = [26, 26, 26];
  const green = [100, 255, 0];
  const red = [255, 68, 68];
  
  let yPos = 12;

  // ===== PAGE 1: HEADER =====
  doc.setFillColor(...gold);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setTextColor(...black);
  doc.setFontSize(26);
  doc.text('🔍 OG SCAN', margin, 18);
  doc.setFontSize(9);
  doc.text('Complete Token Intelligence Report', margin, 25);

  yPos = 36;

  // Token Header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 24, 'F');
  doc.setTextColor(...black);
  doc.setFontSize(13);
  doc.text(token.name, margin + 3, yPos + 7);
  doc.setFontSize(9);
  doc.text(`$${(token.priceUsd || 0).toFixed(8)}`, margin + 3, yPos + 13);
  const change = token.stats24h?.priceChange || 0;
  doc.setTextColor(change >= 0 ? ...green : ...red);
  doc.text(`24H: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, margin + 3, yPos + 18);
  doc.setTextColor(...black);
  doc.text(`Mint: ${token.mint.slice(0, 14)}...`, pageWidth - margin - 45, yPos + 13);

  yPos += 28;

  // Key Metrics Grid
  doc.setTextColor(...gold);
  doc.setFontSize(10);
  doc.text('MARKET METRICS', margin, yPos);
  yPos += 4;

  doc.setFontSize(8);
  doc.setTextColor(...black);
  const metrics = [
    `Market Cap: $${(token.marketCapUsd / 1e6).toFixed(2)}M`,
    `Liquidity: $${(token.liquidityUsd / 1e3).toFixed(1)}K`,
    `24h Vol: $${(token.volume24hUsd / 1e3).toFixed(1)}K`,
    `Holders: ${(token.holderCount || 0).toLocaleString()}`,
    `Supply: ${(token.totalSupply / 1e9).toFixed(2)}B`,
    `Age: ${Math.floor((Date.now() - new Date(token.createdAt || 0).getTime()) / (1000 * 60 * 60 * 24))}d`,
  ];

  let col = 0;
  metrics.forEach((m, i) => {
    if (i % 2 === 0 && i > 0) yPos += 3.5;
    doc.text(m, margin + (i % 2) * (pageWidth / 2.5), yPos);
    if (i % 2 === 1) yPos += 3.5;
  });

  yPos += 4;

  // ===== TOP HOLDERS TABLE =====
  if (holders_data.length > 0) {
    doc.setTextColor(...gold);
    doc.setFontSize(10);
    doc.text(`TOP HOLDERS (${Math.min(holders_data.length, 20)})`, margin, yPos);
    yPos += 4;

    const holderRows = holders_data.slice(0, 20).map((h: any, idx: number) => [
      `${idx + 1}`,
      h.wallet?.slice(0, 10) || 'N/A',
      `$${(h.usd_value / 1000).toFixed(1)}K`,
      `${h.percentage.toFixed(2)}%`,
      `${h.unrealized_pnl?.toFixed(0) || 0}%`,
    ]);

    doc.autoTable({
      head: [['#', 'Wallet', 'Value', '%', 'PnL%']],
      body: holderRows,
      startY: yPos,
      margin: margin,
      theme: 'grid',
      headStyles: { fillColor: gold, textColor: black, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { textColor: black, fontSize: 6.5 },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      columnStyles: { 0: { halign: 'center' }, 1: { halign: 'left' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });

    yPos = (doc as any).lastAutoTable.finalY + 3;
  }

  // ===== PAGE 2 =====
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 12;
  }

  // WHALE ANALYSIS
  if (whaleRisk_data) {
    doc.setTextColor(...gold);
    doc.setFontSize(10);
    doc.text('WHALE ANALYSIS', margin, yPos);
    yPos += 4;

    doc.setFontSize(8);
    doc.setTextColor(...black);
    const whaleMetrics = [
      `Total Whale Power: ${(whaleRisk_data.totalWhalePower || 0).toFixed(1)}%`,
      `Critical Risk Wallets: ${whaleRisk_data.criticalRiskWallets?.length || 0}`,
      `Dump Probability: ${(whaleRisk_data.dumpProbability || 0).toFixed(0)}%`,
      `Price Impact: ${(whaleRisk_data.priceImpact || 0).toFixed(2)}%`,
    ];

    whaleMetrics.forEach((m, i) => {
      doc.text(m, margin + (i % 2) * (pageWidth / 2.5), yPos);
      if (i % 2 === 1) yPos += 3.5;
    });
    yPos += 3;
  }

  // TRANSACTIONS
  if (transactions_data.length > 0) {
    doc.setTextColor(...gold);
    doc.setFontSize(10);
    doc.text(`RECENT TRANSACTIONS (${Math.min(transactions_data.length, 30)})`, margin, yPos);
    yPos += 4;

    const txRows = transactions_data.slice(0, 30).map((t: any) => [
      new Date((t.blockchain_timestamp || 0) * 1000).toLocaleDateString(),
      (t.direction || 'SWAP').toUpperCase(),
      `${((t.token_amount || 0) / 1e6).toFixed(2)}`,
      `$${(t.usd_volume || 0).toFixed(0)}`,
      `$${(t.profit_loss_usd || 0).toFixed(0)}`,
    ]);

    doc.autoTable({
      head: [['Date', 'Type', 'Qty', 'Vol', 'PnL']],
      body: txRows,
      startY: yPos,
      margin: margin,
      theme: 'grid',
      headStyles: { fillColor: gold, textColor: black, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { textColor: black, fontSize: 6.5 },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    yPos = (doc as any).lastAutoTable.finalY + 3;
  }

  // ===== PAGE 3 =====
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = 12;
  }

  // ML PREDICTIONS
  if (predictions_data) {
    doc.setTextColor(...gold);
    doc.setFontSize(10);
    doc.text('PRICE PREDICTIONS (ML)', margin, yPos);
    yPos += 4;

    doc.setFontSize(8);
    doc.setTextColor(...black);
    const predMetrics = [
      `1H Forecast: $${(predictions_data.price_1h || token.priceUsd).toFixed(8)}`,
      `Direction: ${predictions_data.direction_1h || 'NEUTRAL'}`,
      `24H Forecast: $${(predictions_data.price_24h || token.priceUsd).toFixed(8)}`,
      `Direction: ${predictions_data.direction_24h || 'NEUTRAL'}`,
    ];

    predMetrics.forEach((m, i) => {
      doc.text(m, margin + (i % 2) * (pageWidth / 2.5), yPos);
      if (i % 2 === 1) yPos += 3.5;
    });
    yPos += 3;
  }

  // RUG RISK
  if (rugRisk_data) {
    doc.setTextColor(...gold);
    doc.setFontSize(10);
    doc.text('RUG RISK ASSESSMENT', margin, yPos);
    yPos += 4;

    doc.setFontSize(8);
    doc.setTextColor(...black);
    const rugMetrics = [
      `Rug Probability: ${(rugRisk_data.rug_probability || 0).toFixed(1)}%`,
      `Verdict: ${rugRisk_data.rug_verdict || 'UNKNOWN'}`,
    ];

    rugMetrics.forEach(m => {
      doc.text(m, margin + 3, yPos);
      yPos += 3.5;
    });
  }

  yPos += 5;

  // ANOMALIES
  if (anomalies_data.length > 0) {
    doc.setTextColor(...gold);
    doc.setFontSize(10);
    doc.text(`ANOMALIES & ALERTS (${anomalies_data.length})`, margin, yPos);
    yPos += 4;

    doc.setFontSize(7);
    doc.setTextColor(...black);
    anomalies_data.slice(0, 15).forEach((a: any) => {
      const time = new Date((a.triggered_timestamp || 0) * 1000).toLocaleDateString();
      doc.text(`${a.alert_type || 'Alert'} [${(a.severity || 'INFO').toUpperCase()}] - ${time}`, margin + 2, yPos);
      yPos += 2.5;
      if (yPos > pageHeight - 15) {
        doc.addPage();
        yPos = 12;
      }
    });
  }

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, pageHeight - 5);
  doc.text(`OG SCAN Intelligence | ${token.name} (${token.mint.slice(0, 8)}...)`, pageWidth / 2, pageHeight - 5, { align: 'center' });

  return doc.output('blob');
}
