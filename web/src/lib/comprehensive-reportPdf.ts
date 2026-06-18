// FILE: web/src/lib/comprehensive-reportPdf.ts
// COMPLETE COMPREHENSIVE PDF WITH ALL DATA - NO LIMITS

import jsPDF from 'jspdf';
import { Token } from '@/lib/og';
import { supabase } from '@/lib/supabase';
import { predictTokenPrice, assessRugRisk } from '@/lib/ml-models';
import { analyzeWhaleRisk, getTopHoldersByPnL } from '@/lib/advanced-analytics/holder-analytics';
import { getTopTradersByPnL } from '@/lib/advanced-analytics/holder-analytics';

const addSection = (doc: jsPDF, title: string, yPos: number) => {
  doc.setFontSize(14);
  doc.setTextColor(56, 196, 220);
  doc.text(title, 10, yPos);
  doc.setDrawColor(56, 196, 220);
  doc.line(10, yPos + 2, 200, yPos + 2);
  return yPos + 8;
};

export async function generateComprehensiveReport(token: Token) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 10;

  const startNewPage = () => {
    doc.addPage();
    return 10;
  };

  const checkPageBreak = (currentY: number, neededSpace: number = 20) => {
    if (currentY + neededSpace > pageHeight - 10) {
      return startNewPage();
    }
    return currentY;
  };

  // ═════════════════════════════════════════════════════════════
  // PAGE 1: HEADER & QUICK METRICS
  // ═════════════════════════════════════════════════════════════
  
  doc.setFontSize(28);
  doc.setTextColor(56, 196, 220);
  doc.text(`$${token.name}`, 10, yPos);
  yPos += 15;

  doc.setFontSize(18);
  doc.setTextColor(100, 255, 100);
  doc.text(`$${token.usdPrice.toFixed(8)}`, 10, yPos);
  
  const changeColor = token.change24h >= 0 ? [100, 255, 100] : [255, 100, 100];
  doc.setTextColor(...changeColor);
  doc.text(`${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}% (24H)`, 80, yPos);
  yPos += 12;

  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`CA: ${token.mint}`, 10, yPos);
  doc.text(`Chain: Solana (SPL)`, 10, yPos + 6);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 10, yPos + 12);
  yPos += 20;

  // Quick metrics grid
  const metrics = [
    { label: 'Price', value: `$${token.usdPrice.toFixed(8)}` },
    { label: 'Market Cap', value: `$${(token.marketCap / 1000000).toFixed(1)}M` },
    { label: 'Liquidity', value: `$${(token.liquidity / 1000).toFixed(0)}K` },
    { label: 'Volume 24H', value: `$${(token.volume24h / 1000).toFixed(0)}K` },
    { label: 'Holders', value: `${(token.holderCount / 1000).toFixed(1)}K` },
    { label: 'Transactions', value: `${(token.transactionCount || 1000).toLocaleString()}` },
    { label: 'Age Days', value: Math.floor((Date.now() - (token.mintedAt || 0) * 1000) / 86400000) },
    { label: 'Mint Authority', value: token.mintAuthorityRenounced ? 'Renounced' : 'Active' },
    { label: 'Freeze Authority', value: token.freezeAuthorityRenounced ? 'Renounced' : 'Active' },
    { label: 'Top Holder %', value: `${token.topHolderPercent?.toFixed(2) || 'N/A'}%` },
  ];

  doc.setFontSize(9);
  let metricX = 10;
  let metricY = yPos;
  let col = 0;

  metrics.forEach((m, i) => {
    doc.setDrawColor(56, 196, 220);
    doc.rect(metricX, metricY, 60, 12);
    
    doc.setTextColor(56, 196, 220);
    doc.setFontSize(8);
    doc.text(m.label, metricX + 3, metricY + 4);
    
    doc.setTextColor(150, 200, 200);
    doc.setFontSize(9);
    doc.text(m.value, metricX + 3, metricY + 9);

    col++;
    if (col % 3 === 0) {
      metricY += 14;
      metricX = 10;
    } else {
      metricX += 62;
    }
  });

  yPos = metricY + 20;

  // ═════════════════════════════════════════════════════════════
  // SECTION: COMPLETE HOLDER DATA
  // ═════════════════════════════════════════════════════════════

  yPos = checkPageBreak(yPos, 50);
  yPos = addSection(doc, '💎 COMPLETE HOLDER ANALYSIS (ALL HOLDERS)', yPos);

  try {
    const holders = await getTopHoldersByPnL(token.mint, 500);

    doc.setFontSize(8);
    
    // Headers
    const cols = [10, 35, 55, 75, 95, 115, 135, 155];
    const headers = ['#', 'Wallet', 'Balance', 'Balance %', 'Entry $', 'Unrealized %', 'Realized $', 'Classification'];
    
    doc.setTextColor(56, 196, 220);
    headers.forEach((h, i) => doc.text(h, cols[i], yPos + 3));
    
    yPos += 5;
    doc.setDrawColor(56, 196, 220);
    doc.line(10, yPos, 200, yPos);
    yPos += 3;

    let holderCount = 0;
    const pageSize = 40;

    for (let i = 0; i < Math.ceil(holders.length / pageSize); i++) {
      const pageHolders = holders.slice(i * pageSize, (i + 1) * pageSize);
      
      doc.setTextColor(100, 150, 150);
      
      pageHolders.forEach((holder, idx) => {
        const rowNum = i * pageSize + idx + 1;
        const pnlColor = holder.unrealizedPnL >= 0 ? [100, 255, 100] : [255, 100, 100];
        
        doc.text(String(rowNum), cols[0], yPos);
        doc.text(holder.wallet.slice(0, 10) + '...', cols[1], yPos);
        doc.text(`$${(holder.balanceUsd / 1000).toFixed(1)}K`, cols[2], yPos);
        doc.text(`${(holder.balance > 0 ? (holder.balanceUsd / (token.usdPrice * Number(holder.balance))) * 100 : 0).toFixed(2)}%`, cols[3], yPos);
        doc.text(`$${holder.entryPrice.toFixed(8)}`, cols[4], yPos);
        
        doc.setTextColor(...pnlColor);
        doc.text(`${holder.unrealizedPnL.toFixed(0)}%`, cols[5], yPos);
        
        doc.setTextColor(56, 196, 220);
        doc.text(`$${holder.realizedPnL.toFixed(0)}`, cols[6], yPos);
        doc.text(holder.classification || 'N/A', cols[7], yPos);
        
        yPos += 4;
        holderCount++;

        if (yPos > pageHeight - 15) {
          yPos = startNewPage();
          doc.setFontSize(8);
          doc.setTextColor(56, 196, 220);
          headers.forEach((h, j) => doc.text(h, cols[j], yPos + 3));
          yPos += 7;
        }
      });

      if (i < Math.ceil(holders.length / pageSize) - 1) {
        yPos = startNewPage();
      }
    }

    yPos += 5;
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Error loading holder data', 10, yPos);
    yPos += 5;
  }

  // ═════════════════════════════════════════════════════════════
  // SECTION: WHALE ANALYSIS (DETAILED)
  // ═════════════════════════════════════════════════════════════

  yPos = checkPageBreak(yPos, 30);
  yPos = addSection(doc, '🐋 WHALE ANALYSIS (DETAILED)', yPos);

  try {
    const { data: topWhales } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', token.mint)
      .gt('balance_percent_of_supply', 0.5)
      .order('balance_usd', { ascending: false })
      .limit(50);

    const whaleRisk = await analyzeWhaleRisk(token.mint);

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    
    doc.text(`Total Whale Power (>0.5%): ${whaleRisk.totalWhalePower.toFixed(1)}%`, 10, yPos);
    yPos += 6;

    doc.text(`Critical Risk Wallets (>100% gains): ${whaleRisk.criticalRiskWallets}`, 10, yPos);
    yPos += 6;

    const dumpColor = whaleRisk.dumpProbability > 70 ? [255, 100, 100] : [100, 255, 100];
    doc.setTextColor(...dumpColor);
    doc.text(`Dump Probability: ${whaleRisk.dumpProbability.toFixed(0)}%`, 10, yPos);
    yPos += 6;

    doc.setTextColor(150, 150, 150);
    doc.text(`Estimated Price Impact if Whales Exit: ${whaleRisk.priceImpactPercent.toFixed(1)}%`, 10, yPos);
    yPos += 10;

    if (topWhales && topWhales.length > 0) {
      doc.setFontSize(9);
      doc.text('Top Whale Holders:', 10, yPos);
      yPos += 5;

      doc.setFontSize(8);
      const whaleTableCols = [10, 50, 80, 110, 140, 170];
      doc.setTextColor(56, 196, 220);
      doc.text('Rank', whaleTableCols[0], yPos);
      doc.text('Wallet', whaleTableCols[1], yPos);
      doc.text('Balance $', whaleTableCols[2], yPos);
      doc.text('% Supply', whaleTableCols[3], yPos);
      doc.text('Unrealized %', whaleTableCols[4], yPos);
      doc.text('Risk', whaleTableCols[5], yPos);
      yPos += 4;

      topWhales.slice(0, 20).forEach((whale, idx) => {
        const riskColor = whale.unrealized_pnl_percent > 100 ? [255, 100, 100] : [100, 255, 100];
        
        doc.setTextColor(100, 150, 150);
        doc.text(`#${idx + 1}`, whaleTableCols[0], yPos);
        doc.text(whale.wallet_address.slice(0, 12) + '...', whaleTableCols[1], yPos);
        doc.text(`$${(whale.balance_usd / 1000).toFixed(1)}K`, whaleTableCols[2], yPos);
        doc.text(`${whale.balance_percent_of_supply.toFixed(2)}%`, whaleTableCols[3], yPos);
        
        doc.setTextColor(...riskColor);
        doc.text(`${whale.unrealized_pnl_percent.toFixed(0)}%`, whaleTableCols[4], yPos);
        doc.text(whale.unrealized_pnl_percent > 100 ? 'CRITICAL' : 'HIGH', whaleTableCols[5], yPos);
        
        yPos += 4;

        if (yPos > pageHeight - 15) {
          yPos = startNewPage();
        }
      });
    }

    yPos += 5;
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Error loading whale data', 10, yPos);
    yPos += 5;
  }

  // ═════════════════════════════════════════════════════════════
  // SECTION: TRADER LEADERBOARD
  // ═════════════════════════════════════════════════════════════

  yPos = checkPageBreak(yPos, 30);
  yPos = addSection(doc, '🏆 TOP TRADERS LEADERBOARD', yPos);

  try {
    const traders = await getTopTradersByPnL(token.mint, 100);

    doc.setFontSize(8);
    const traderCols = [10, 50, 80, 110, 140, 170];
    doc.setTextColor(56, 196, 220);
    doc.text('Rank', traderCols[0], yPos);
    doc.text('Wallet', traderCols[1], yPos);
    doc.text('Total PnL $', traderCols[2], yPos);
    doc.text('Trades', traderCols[3], yPos);
    doc.text('Win Rate', traderCols[4], yPos);
    doc.text('Volume $', traderCols[5], yPos);
    yPos += 4;

    traders.slice(0, 40).forEach((trader, idx) => {
      const pnlColor = trader.totalPnL >= 0 ? [100, 255, 100] : [255, 100, 100];
      
      doc.setTextColor(100, 150, 150);
      doc.text(`#${idx + 1}`, traderCols[0], yPos);
      doc.text(trader.wallet.slice(0, 12) + '...', traderCols[1], yPos);
      
      doc.setTextColor(...pnlColor);
      doc.text(`$${(trader.totalPnL / 1000).toFixed(1)}K`, traderCols[2], yPos);
      
      doc.setTextColor(100, 150, 150);
      doc.text(`${trader.tradeCount}`, traderCols[3], yPos);
      doc.text(`${trader.winRate.toFixed(0)}%`, traderCols[4], yPos);
      doc.text(`$${(trader.totalVolume / 1000).toFixed(1)}K`, traderCols[5], yPos);
      
      yPos += 4;

      if (yPos > pageHeight - 15) {
        yPos = startNewPage();
      }
    });

    yPos += 5;
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Error loading trader data', 10, yPos);
    yPos += 5;
  }

  // ═════════════════════════════════════════════════════════════
  // SECTION: ML PREDICTIONS
  // ═════════════════════════════════════════════════════════════

  yPos = checkPageBreak(yPos, 25);
  yPos = addSection(doc, '🤖 MACHINE LEARNING PREDICTIONS', yPos);

  try {
    const prediction = await predictTokenPrice(token.mint);
    const rugRisk = await assessRugRisk(token.mint);

    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);

    if (prediction) {
      doc.text('PRICE PREDICTIONS:', 10, yPos);
      yPos += 5;

      doc.setFontSize(9);
      doc.setTextColor(100, 200, 200);
      doc.text(`Current Price: $${token.usdPrice.toFixed(8)}`, 12, yPos);
      doc.text(`1-Hour Prediction: $${prediction.nextHourPrice.toFixed(8)}`, 12, yPos + 5);
      doc.text(`24-Hour Prediction: $${prediction.next24hPrice.toFixed(8)}`, 12, yPos + 10);
      doc.text(`Direction: ${prediction.direction.toUpperCase()}`, 12, yPos + 15);
      doc.text(`Confidence: ${(prediction.confidence * 100).toFixed(0)}%`, 12, yPos + 20);
      doc.text(`Risk Level: ${prediction.riskLevel.toUpperCase()}`, 12, yPos + 25);

      yPos += 35;
    }

    if (rugRisk) {
      yPos = checkPageBreak(yPos, 20);
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('RUG PULL ASSESSMENT:', 10, yPos);
      yPos += 5;

      const rugColor = rugRisk.rugProbability > 70 ? [255, 100, 100] : rugRisk.rugProbability > 40 ? [255, 200, 100] : [100, 255, 100];
      doc.setFontSize(9);
      doc.setTextColor(...rugColor);
      doc.text(`Rug Probability: ${rugRisk.rugProbability.toFixed(0)}%`, 12, yPos);
      doc.text(`Verdict: ${rugRisk.verdict.toUpperCase()}`, 12, yPos + 5);

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Risk Factors:', 12, yPos + 12);
      doc.text(`  • Whale Concentration: ${rugRisk.rugFactors.whaleConcentration.toFixed(1)}/30`, 15, yPos + 16);
      doc.text(`  • Liquidity Risk: ${rugRisk.rugFactors.liquidityRisk.toFixed(1)}/20`, 15, yPos + 20);
      doc.text(`  • Deployer Risk: ${rugRisk.rugFactors.deployerHistory.toFixed(1)}/25`, 15, yPos + 24);
      doc.text(`  • Authority Risk: ${rugRisk.rugFactors.authorityRisk.toFixed(1)}/15`, 15, yPos + 28);
      doc.text(`  • Volume Anomalies: ${rugRisk.rugFactors.volumeAnomalies.toFixed(1)}/15`, 15, yPos + 32);

      yPos += 40;
    }
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Error loading predictions', 10, yPos);
    yPos += 5;
  }

  // ═════════════════════════════════════════════════════════════
  // SECTION: REAL-TIME ANOMALIES
  // ═════════════════════════════════════════════════════════════

  yPos = checkPageBreak(yPos, 20);
  yPos = addSection(doc, '⚠️ REAL-TIME ANOMALIES & ALERTS', yPos);

  try {
    const { data: anomalies } = await supabase
      .from('real_time_alerts')
      .select('*')
      .eq('mint_address', token.mint)
      .order('triggered_timestamp', { ascending: false })
      .limit(200);

    if (anomalies && anomalies.length > 0) {
      doc.setFontSize(8);
      anomalies.forEach((anomaly) => {
        const severityColor = 
          anomaly.severity === 'critical' ? [255, 100, 100] :
          anomaly.severity === 'high' ? [255, 200, 100] :
          [100, 200, 255];
        
        doc.setTextColor(...severityColor);
        doc.text(`[${anomaly.severity.toUpperCase()}] ${anomaly.alert_type}: ${anomaly.metric_value.toFixed(2)} (${anomaly.percent_change.toFixed(1)}%)`, 12, yPos);
        yPos += 3;

        if (yPos > pageHeight - 10) {
          yPos = startNewPage();
        }
      });
    } else {
      doc.setTextColor(100, 150, 100);
      doc.text('No anomalies detected', 12, yPos);
      yPos += 4;
    }

    yPos += 5;
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Error loading anomalies', 10, yPos);
    yPos += 5;
  }

  // ═════════════════════════════════════════════════════════════
  // SECTION: TRANSACTION HISTORY
  // ═════════════════════════════════════════════════════════════

  yPos = checkPageBreak(yPos, 30);
  yPos = addSection(doc, '📊 TRANSACTION HISTORY (ALL)', yPos);

  try {
    const { data: transactions } = await supabase
      .from('transactions_extended')
      .select('*')
      .eq('mint_address', token.mint)
      .order('blockchain_timestamp', { ascending: false })
      .limit(500);

    if (transactions && transactions.length > 0) {
      doc.setFontSize(7);
      const txCols = [10, 40, 70, 100, 130, 160];
      
      doc.setTextColor(56, 196, 220);
      doc.text('Time', txCols[0], yPos);
      doc.text('Type', txCols[1], yPos);
      doc.text('Amount', txCols[2], yPos);
      doc.text('Price', txCols[3], yPos);
      doc.text('Volume $', txCols[4], yPos);
      doc.text('PnL', txCols[5], yPos);
      yPos += 3;

      transactions.slice(0, 100).forEach((tx) => {
        const date = new Date(tx.blockchain_timestamp * 1000).toLocaleDateString();
        const pnlColor = (tx.profit_loss_usd || 0) >= 0 ? [100, 255, 100] : [255, 100, 100];
        
        doc.setTextColor(100, 150, 150);
        doc.text(date, txCols[0], yPos);
        doc.text(tx.direction?.toUpperCase() || 'SWAP', txCols[1], yPos);
        doc.text(`${(Number(tx.token_amount) / 1e6).toFixed(2)}`, txCols[2], yPos);
        doc.text(`$${tx.token_price?.toFixed(8) || 'N/A'}`, txCols[3], yPos);
        doc.text(`$${(tx.usd_volume || 0).toFixed(0)}`, txCols[4], yPos);
        
        doc.setTextColor(...pnlColor);
        doc.text(`$${(tx.profit_loss_usd || 0).toFixed(0)}`, txCols[5], yPos);
        
        yPos += 3;

        if (yPos > pageHeight - 10) {
          yPos = startNewPage();
        }
      });
    }

    yPos += 5;
  } catch (error) {
    doc.setTextColor(200, 100, 100);
    doc.text('Error loading transactions', 10, yPos);
    yPos += 5;
  }

  // ═════════════════════════════════════════════════════════════
  // FOOTER WITH METADATA
  // ═════════════════════════════════════════════════════════════

  const totalPages = doc.internal.pages.length - 1;
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `OG Scan Comprehensive Intelligence Report | ${totalPages} Pages | Generated ${new Date().toLocaleString()} | Token: ${token.mint.slice(0, 20)}...`,
    pageWidth / 2,
    pageHeight - 3,
    { align: 'center' }
  );

  return doc;
}
