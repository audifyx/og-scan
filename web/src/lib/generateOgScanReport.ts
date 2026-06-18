import { Token } from '@/lib/og';

export interface ReportData {
  token: Token;
  score?: any;
  report?: any;
  holders?: any[];
  transactions?: any[];
  anomalies?: any[];
  whaleRisk?: any;
  predictions?: any;
  rugRisk?: any;
}

export async function generateOgScanReport(data: ReportData): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const { token, score, report, holders = [], transactions = [], anomalies = [], whaleRisk, predictions, rugRisk } = data;

  console.log('📄 Generating PDF from page data...');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const goldColor = [255, 215, 0];
  const blackColor = [26, 26, 26];
  const greenColor = [100, 255, 0];
  const redColor = [255, 68, 68];
  
  let yPos = 15;

  // Header
  doc.setFillColor(...goldColor);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setTextColor(...blackColor);
  doc.setFontSize(28);
  doc.text('OG SCAN', margin, 20);
  doc.setFontSize(10);
  doc.text('Intelligence Report', margin, 28);

  yPos = 40;

  // Token Info Box
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 22, 'F');
  doc.setTextColor(...blackColor);
  doc.setFontSize(14);
  doc.text(token.name, margin + 3, yPos + 7);
  doc.setFontSize(10);
  doc.text(`$${(token.priceUsd || 0).toFixed(8)}`, margin + 3, yPos + 13);
  const change = token.stats24h?.priceChange || 0;
  doc.setTextColor(...(change >= 0 ? greenColor : redColor));
  doc.text(`24H: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, margin + 3, yPos + 19);
  doc.setTextColor(...blackColor);
  doc.text(`Mint: ${token.mint.slice(0, 15)}...`, pageWidth - margin - 50, yPos + 13);

  yPos += 28;

  // Key Metrics
  doc.setTextColor(...goldColor);
  doc.setFontSize(11);
  doc.text('KEY METRICS', margin, yPos);
  yPos += 6;

  doc.setTextColor(...blackColor);
  doc.setFontSize(9);
  const metricsText = [
    `Market Cap: $${(token.marketCapUsd ? token.marketCapUsd / 1e6 : 0).toFixed(2)}M | Liquidity: $${(token.liquidityUsd ? token.liquidityUsd / 1e3 : 0).toFixed(1)}K | Volume: $${(token.volume24hUsd ? token.volume24hUsd / 1e3 : 0).toFixed(1)}K`,
    `Holders: ${(token.holderCount || 0).toLocaleString()} | Age: ${Math.floor((Date.now() - new Date(token.createdAt || 0).getTime()) / (1000 * 60 * 60 * 24))} days | Supply: ${(token.totalSupply ? token.totalSupply / 1e9 : 0).toFixed(2)}B`
  ];
  metricsText.forEach(text => {
    doc.text(text, margin, yPos);
    yPos += 4;
  });

  yPos += 4;

  // Forensic Scores
  if (score) {
    doc.setTextColor(...goldColor);
    doc.setFontSize(11);
    doc.text('FORENSIC SCORES', margin, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setTextColor(...blackColor);
    const scoreData = [
      [`Dominance: ${score.dominanceScore || 0}%`, `Origin: ${score.originScore || 0}%`],
      [`Risk: ${score.riskScore || 0}%`, `Clone: ${score.cloneScore || 0}%`]
    ];
    scoreData.forEach(([left, right]) => {
      doc.text(left, margin + 3, yPos);
      doc.text(right, pageWidth / 2, yPos);
      yPos += 4;
    });
    yPos += 2;
  }

  // Contract Details
  doc.setTextColor(...goldColor);
  doc.setFontSize(11);
  doc.text('CONTRACT DETAILS', margin, yPos);
  yPos += 5;

  doc.setFontSize(8);
  doc.setTextColor(...blackColor);
  const contractData = [
    ['Total Supply', `${(token.totalSupply ? token.totalSupply / 1e9 : 0).toFixed(2)}B`],
    ['Circulating', `${(token.circulatingSupply ? token.circulatingSupply / 1e9 : 0).toFixed(2)}B`],
    ['Decimals', `${token.decimals || 9}`],
    ['Chain', token.chainId || 'Solana']
  ];
  contractData.forEach(([label, value]) => {
    doc.text(`${label}: ${value}`, margin + 3, yPos);
    yPos += 3.5;
  });

  yPos += 3;

  // Top Holders Table
  if (holders && holders.length > 0) {
    doc.setTextColor(...goldColor);
    doc.setFontSize(11);
    doc.text(`TOP HOLDERS (${Math.min(holders.length, 15)})`, margin, yPos);
    yPos += 5;

    const holderTableData = holders.slice(0, 15).map((h: any, idx: number) => [
      `${idx + 1}`,
      h.wallet_address?.slice(0, 12) || 'N/A',
      `$${((h.balance_usd || 0) / 1000).toFixed(1)}K`,
      `${(h.balance_percent_of_supply || 0).toFixed(2)}%`,
      `${(h.unrealized_pnl_percent || 0).toFixed(0)}%`
    ]);

    doc.autoTable({
      head: [['#', 'Wallet', 'Balance', '% Supply', 'PnL%']],
      body: holderTableData,
      startY: yPos,
      margin: margin,
      theme: 'grid',
      headStyles: { fillColor: goldColor, textColor: blackColor, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { textColor: blackColor, fontSize: 7 },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  // Whale Analysis
  if (whaleRisk) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 15;
    }

    doc.setTextColor(...goldColor);
    doc.setFontSize(11);
    doc.text('WHALE ANALYSIS', margin, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setTextColor(...blackColor);
    const whaleData = [
      [`Total Whale Power: ${(whaleRisk.totalWhalePower || 0).toFixed(1)}%`, `Critical Risk: ${(whaleRisk.criticalRiskWallets?.length || 0)}`],
      [`Dump Probability: ${(whaleRisk.dumpProbability || 0).toFixed(0)}%`, `Price Impact: ${(whaleRisk.priceImpact || 0).toFixed(2)}%`]
    ];
    whaleData.forEach(([left, right]) => {
      doc.text(left, margin + 3, yPos);
      doc.text(right, pageWidth / 2, yPos);
      yPos += 4;
    });
  }

  // Transactions Table
  if (transactions && transactions.length > 0) {
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 15;
    }

    yPos += 3;
    doc.setTextColor(...goldColor);
    doc.setFontSize(11);
    doc.text(`RECENT TRANSACTIONS (${Math.min(transactions.length, 20)})`, margin, yPos);
    yPos += 5;

    const txTableData = transactions.slice(0, 20).map((t: any) => [
      new Date((t.blockchain_timestamp || 0) * 1000).toLocaleDateString(),
      (t.direction || 'SWAP').toUpperCase(),
      `${((t.token_amount || 0) / 1e6).toFixed(2)}`,
      `$${(t.usd_volume || 0).toFixed(0)}`,
      `$${(t.profit_loss_usd || 0).toFixed(0)}`
    ]);

    doc.autoTable({
      head: [['Date', 'Type', 'Amount', 'Volume', 'PnL']],
      body: txTableData,
      startY: yPos,
      margin: margin,
      theme: 'grid',
      headStyles: { fillColor: goldColor, textColor: blackColor, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { textColor: blackColor, fontSize: 7 },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    yPos = (doc as any).lastAutoTable.finalY + 5;
  }

  // Anomalies
  if (anomalies && anomalies.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 15;
    }

    yPos += 3;
    doc.setTextColor(...goldColor);
    doc.setFontSize(11);
    doc.text(`ANOMALIES (${Math.min(anomalies.length, 10)})`, margin, yPos);
    yPos += 5;

    doc.setFontSize(8);
    doc.setTextColor(...blackColor);
    anomalies.slice(0, 10).forEach((a: any) => {
      const time = new Date((a.triggered_timestamp || 0) * 1000).toLocaleDateString();
      doc.text(`${a.alert_type || 'Alert'} [${(a.severity || 'INFO').toUpperCase()}] - ${time}`, margin + 3, yPos);
      yPos += 3;
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 15;
      }
    });
  }

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, pageHeight - 8);
  doc.text('OG SCAN - Blockchain Intelligence', pageWidth / 2, pageHeight - 8, { align: 'center' });

  return doc.output('blob');
}
