
// FILE: web/src/lib/enhanced-reportPdf.ts
// Enhanced PDF report with advanced intelligence data integration

import jsPDF from 'jspdf';
import { Token } from '@/lib/og';
import { supabase } from '@/lib/supabase';
import { predictTokenPrice, assessRugRisk } from '@/lib/ml-models';
import { analyzeWhaleRisk, getTopHoldersByPnL } from '@/lib/advanced-analytics/holder-analytics';

export async function generateEnhancedTokenReport(token: Token) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 10;

  // ═════════════════════════════════════════════════════════════
  // HEADER SECTION
  // ═════════════════════════════════════════════════════════════
  
  // Token Title & Price
  doc.setFontSize(24);
  doc.setTextColor(56, 196, 220); // OG Cyan
  doc.text(\`\$\${token.name}\`, 10, yPos);
  
  doc.setFontSize(14);
  doc.setTextColor(200, 200, 200);
  doc.text(\`\$\${token.usdPrice.toFixed(6)}\`, pageWidth - 40, yPos);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 255, 100); // Lime
  const changeColor = token.change24h >= 0 ? [100, 255, 100] : [255, 100, 100];
  doc.setTextColor(...changeColor);
  doc.text(\`\${token.change24h >= 0 ? '+' : ''}\${token.change24h.toFixed(2)}% 24H\`, pageWidth - 40, yPos + 7);

  yPos += 15;

  // ═════════════════════════════════════════════════════════════
  // QUICK METRICS BADGES
  // ═════════════════════════════════════════════════════════════
  
  doc.setFontSize(9);
  doc.setTextColor(100, 200, 200);
  
  const badges = [
    { label: 'DOM', value: \`\${Math.round(token.dominanceRank || 0)}%\` },
    { label: 'ORI', value: \`\${Math.round(token.originalityScore || 0)}%\` },
    { label: 'RSK', value: \`\${Math.round(token.riskScore || 0)}%\` },
    { label: 'CLN', value: \`\${Math.round(token.cloneIndicator || 0)}%\` },
  ];

  let xPos = 10;
  badges.forEach((badge, idx) => {
    doc.setDrawColor(56, 196, 220);
    doc.rect(xPos, yPos, 20, 8);
    doc.setTextColor(56, 196, 220);
    doc.setFontSize(7);
    doc.text(badge.label, xPos + 10, yPos + 4, { align: 'center' });
    doc.text(badge.value, xPos + 10, yPos + 7, { align: 'center' });
    xPos += 22;
  });

  yPos += 12;

  // Liquidity Badge
  doc.setDrawColor(56, 196, 220);
  doc.rect(10, yPos, 40, 8);
  doc.setTextColor(56, 196, 220);
  doc.setFontSize(7);
  doc.text('LP', 12, yPos + 4);
  doc.text(\`\$\${(token.liquidity / 1000).toFixed(1)}K\`, 30, yPos + 4);

  // Holder Count
  doc.setDrawColor(150, 150, 150);
  doc.rect(52, yPos, 25, 8);
  doc.setTextColor(150, 150, 150);
  doc.text('H', 54, yPos + 4);
  doc.text(\`\${(token.holderCount / 1000).toFixed(1)}K\`, 65, yPos + 4);

  yPos += 12;

  // ═════════════════════════════════════════════════════════════
  // CLASSIFICATION & STATUS
  // ═════════════════════════════════════════════════════════════
  
  const classifications = ['OG TOKEN', 'TRUE OG', 'PRIMARY TOKEN'];
  xPos = 10;
  classifications.forEach(cls => {
    doc.setDrawColor(56, 196, 220);
    doc.rect(xPos, yPos, 28, 7);
    doc.setTextColor(56, 196, 220);
    doc.setFontSize(6);
    doc.text(cls, xPos + 14, yPos + 4.5, { align: 'center' });
    xPos += 30;
  });

  yPos += 10;

  // Status Line
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const statusDate = token.mintedAt ? new Date(token.mintedAt * 1000).toLocaleDateString() : 'Unknown';
  doc.text(\`📡 \${statusDate} • 🔒 LOCKED • ⊗ NO PAID BOOST\`, 10, yPos);

  yPos += 8;

  // ═════════════════════════════════════════════════════════════
  // DIVIDER
  // ═════════════════════════════════════════════════════════════
  doc.setDrawColor(56, 196, 220);
  doc.line(10, yPos, pageWidth - 10, yPos);
  yPos += 5;

  // ═════════════════════════════════════════════════════════════
  // HOLDER ANALYSIS SECTION
  // ═════════════════════════════════════════════════════════════
  
  doc.setFontSize(12);
  doc.setTextColor(56, 196, 220);
  doc.text('💎 HOLDER ANALYSIS', 10, yPos);
  yPos += 6;

  try {
    const holders = await getTopHoldersByPnL(token.mint, 10);
    
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    
    let holderYPos = yPos;
    const columnX = [10, 35, 60, 85, 110, 135, 160];
    
    // Headers
    doc.text('Wallet', columnX[0], holderYPos);
    doc.text('Balance', columnX[1], holderYPos);
    doc.text('Entry Price', columnX[2], holderYPos);
    doc.text('Unrealized %', columnX[3], holderYPos);
    doc.text('Classification', columnX[5], holderYPos);
    
    holderYPos += 4;
    
    // Holder rows
    holders.slice(0, 8).forEach((holder) => {
      doc.setTextColor(100, 150, 150);
      doc.setFontSize(7);
      
      doc.text(\`\${holder.wallet.slice(0, 8)}...\`, columnX[0], holderYPos);
      doc.text(\`\$\${(holder.balanceUsd / 1000).toFixed(1)}K\`, columnX[1], holderYPos);
      doc.text(\`\$\${holder.entryPrice.toFixed(8)}\`, columnX[2], holderYPos);
      
      const pnlColor = holder.unrealizedPnL >= 0 ? [100, 255, 100] : [255, 100, 100];
      doc.setTextColor(...pnlColor);
      doc.text(\`\${holder.unrealizedPnL.toFixed(0)}%\`, columnX[3], holderYPos);
      
      doc.setTextColor(56, 196, 220);
      doc.text(holder.classification || 'Unknown', columnX[5], holderYPos);
      
      holderYPos += 4;
    });

    yPos = holderYPos + 4;
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Could not load holder data', 10, yPos);
    yPos += 6;
  }

  // ═════════════════════════════════════════════════════════════
  // WHALE RISK SECTION
  // ═════════════════════════════════════════════════════════════
  
  doc.setFontSize(12);
  doc.setTextColor(56, 196, 220);
  doc.text('🐋 WHALE RISK ANALYSIS', 10, yPos);
  yPos += 6;

  try {
    const whaleRisk = await analyzeWhaleRisk(token.mint);
    
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    
    doc.text(\`Total Whale Power: \${whaleRisk.totalWhalePower.toFixed(1)}%\`, 10, yPos);
    doc.text(\`Critical Risk Wallets: \${whaleRisk.criticalRiskWallets}\`, 10, yPos + 5);
    
    // Dump probability gauge
    const dumpProb = whaleRisk.dumpProbability;
    const dumpColor = dumpProb > 70 ? [255, 100, 100] : dumpProb > 50 ? [255, 200, 100] : [100, 255, 100];
    doc.setTextColor(...dumpColor);
    doc.text(\`Dump Probability: \${dumpProb.toFixed(0)}%\`, 10, yPos + 10);
    
    doc.setTextColor(150, 150, 150);
    doc.text(\`Price Impact if Whales Sell: \${whaleRisk.priceImpactPercent.toFixed(1)}%\`, 10, yPos + 15);
    
    yPos += 20;
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Could not load whale data', 10, yPos);
    yPos += 6;
  }

  // ═════════════════════════════════════════════════════════════
  // ML PREDICTIONS SECTION
  // ═════════════════════════════════════════════════════════════
  
  doc.setFontSize(12);
  doc.setTextColor(56, 196, 220);
  doc.text('🤖 ML PREDICTIONS', 10, yPos);
  yPos += 6;

  try {
    const prediction = await predictTokenPrice(token.mint);
    const rugRisk = await assessRugRisk(token.mint);
    
    if (prediction) {
      doc.setFontSize(9);
      doc.setTextColor(100, 200, 200);
      
      doc.text(\`1H Price: \$\${prediction.nextHourPrice.toFixed(8)}\`, 10, yPos);
      doc.text(\`24H Price: \$\${prediction.next24hPrice.toFixed(8)}\`, 10, yPos + 5);
      doc.text(\`Direction: \${prediction.direction.toUpperCase()}\`, 10, yPos + 10);
      doc.text(\`Confidence: \${(prediction.confidence * 100).toFixed(0)}%\`, 10, yPos + 15);
      
      yPos += 20;
    }

    if (rugRisk) {
      doc.setFontSize(9);
      const rugColor = rugRisk.rugProbability > 70 ? [255, 100, 100] : [100, 255, 100];
      doc.setTextColor(...rugColor);
      
      doc.text(\`Rug Pull Probability: \${rugRisk.rugProbability.toFixed(0)}%\`, 10, yPos);
      doc.text(\`Verdict: \${rugRisk.verdict.toUpperCase()}\`, 10, yPos + 5);
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(\`Whale Concentration: \${rugRisk.rugFactors.whaleConcentration.toFixed(0)}/30\`, 15, yPos + 12);
      doc.text(\`Liquidity Risk: \${rugRisk.rugFactors.liquidityRisk.toFixed(0)}/20\`, 15, yPos + 16);
      doc.text(\`Deployer Risk: \${rugRisk.rugFactors.deployerHistory.toFixed(2)}/25\`, 15, yPos + 20);
      
      yPos += 25;
    }
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Could not load predictions', 10, yPos);
    yPos += 6;
  }

  // ═════════════════════════════════════════════════════════════
  // ANOMALIES SECTION
  // ═════════════════════════════════════════════════════════════
  
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 10;
  }

  doc.setFontSize(12);
  doc.setTextColor(56, 196, 220);
  doc.text('⚠️ RECENT ANOMALIES', 10, yPos);
  yPos += 6;

  try {
    const { data: anomalies } = await supabase
      .from('real_time_alerts')
      .select('*')
      .eq('mint_address', token.mint)
      .order('triggered_timestamp', { ascending: false })
      .limit(5);

    if (anomalies && anomalies.length > 0) {
      doc.setFontSize(8);
      anomalies.forEach((anomaly) => {
        const severityColor = 
          anomaly.severity === 'critical' ? [255, 100, 100] :
          anomaly.severity === 'high' ? [255, 200, 100] :
          [100, 200, 255];
        
        doc.setTextColor(...severityColor);
        doc.text(\`\${anomaly.alert_type}: \${anomaly.metric_value.toFixed(2)} (\${anomaly.percent_change.toFixed(1)}%)\`, 10, yPos);
        yPos += 4;
      });
    } else {
      doc.setTextColor(100, 150, 100);
      doc.text('No recent anomalies detected', 10, yPos);
      yPos += 4;
    }
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Could not load anomalies', 10, yPos);
    yPos += 4;
  }

  yPos += 2;

  // ═════════════════════════════════════════════════════════════
  // FOOTER
  // ═════════════════════════════════════════════════════════════
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    \`OG Scan Advanced Intelligence Report • Generated \${new Date().toLocaleString()} • Powered by Helius, Birdeye, DexScreener\`,
    pageWidth / 2,
    pageHeight - 5,
    { align: 'center' }
  );

  return doc;
}
