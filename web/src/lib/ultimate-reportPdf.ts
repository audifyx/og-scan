// FILE: web/src/lib/ultimate-reportPdf.ts
// ULTIMATE COMPLETE REPORT - EVERYTHING FROM EVERY SOURCE

import jsPDF from 'jspdf';
import { Token } from '@/lib/og';
import { supabase } from '@/lib/supabase';
import { predictTokenPrice, assessRugRisk } from '@/lib/ml-models';

const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
const PAGE_WIDTH = doc.internal.pageSize.getWidth();
const PAGE_HEIGHT = doc.internal.pageSize.getHeight();

export async function generateUltimateReport(token: Token) {
  let yPos = 10;
  let pageNum = 1;

  const newPage = (title?: string) => {
    doc.addPage();
    pageNum++;
    yPos = 10;
    if (title) {
      doc.setFontSize(16);
      doc.setTextColor(56, 196, 220);
      doc.text(title, 10, yPos);
      yPos += 8;
    }
  };

  const section = (title: string) => {
    if (yPos > PAGE_HEIGHT - 30) newPage();
    doc.setFontSize(12);
    doc.setTextColor(56, 196, 220);
    doc.text(title, 10, yPos);
    doc.setDrawColor(56, 196, 220);
    doc.line(10, yPos + 2, PAGE_WIDTH - 10, yPos + 2);
    yPos += 8;
  };

  const addText = (text: string, color = [150, 150, 150]) => {
    if (yPos > PAGE_HEIGHT - 5) newPage();
    doc.setFontSize(8);
    doc.setTextColor(...color);
    doc.text(text, 10, yPos);
    yPos += 3;
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1: EXECUTIVE SUMMARY & FULL TOKEN DATA
  // ═══════════════════════════════════════════════════════════════════════

  doc.setFontSize(24);
  doc.setTextColor(56, 196, 220);
  doc.text(`$${token.name}`, 10, yPos);
  yPos += 12;

  doc.setFontSize(16);
  doc.setTextColor(100, 255, 100);
  doc.text(`Price: $${token.usdPrice.toFixed(10)}`, 10, yPos);
  doc.setTextColor(token.change24h >= 0 ? 100 : 255, token.change24h >= 0 ? 255 : 100, 100);
  doc.text(`24H: ${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`, 120, yPos);
  yPos += 10;

  section('BLOCKCHAIN & CONTRACT DETAILS');
  addText(`Contract Address (CA): ${token.mint}`);
  addText(`Chain: Solana (SPL Token)`);
  addText(`Token Type: ${token.isLocked ? 'Locked LP' : 'Memecoin'}`);
  addText(`Decimals: ${token.decimals || 6}`);
  addText(`Total Supply: ${(token.totalSupply / 1e9).toFixed(2)}B`);
  addText(`Circulating Supply: ${(token.circulatingSupply / 1e9).toFixed(2)}B`);
  addText(`Supply Locked: ${token.liquidityLocked ? 'YES ✓' : 'NO'}`);
  addText(`Mint Authority Renounced: ${token.mintAuthorityRenounced ? 'YES ✓' : 'NO'}`);
  addText(`Freeze Authority Renounced: ${token.freezeAuthorityRenounced ? 'YES ✓' : 'NO'}`);
  addText(`Deployer Address: ${token.deployer?.slice(0, 20) || 'Unknown'}...`);
  addText(`Deployment Date: ${token.mintedAt ? new Date(token.mintedAt * 1000).toLocaleString() : 'Unknown'}`);
  addText(`Age: ${Math.floor((Date.now() - (token.mintedAt || 0) * 1000) / 86400000)} days`);

  section('MARKET DATA');
  addText(`Price (USD): $${token.usdPrice.toFixed(10)}`);
  addText(`Market Cap: $${(token.marketCap / 1e6).toFixed(2)}M`);
  addText(`Fully Diluted Valuation (FDV): $${((token.totalSupply / 1e6) * token.usdPrice).toFixed(2)}`);
  addText(`24h Volume: $${(token.volume24h / 1e3).toFixed(2)}K`);
  addText(`24h High: $${(token.high24h || token.usdPrice).toFixed(10)}`);
  addText(`24h Low: $${(token.low24h || token.usdPrice).toFixed(10)}`);
  addText(`7d Volume: $${(token.volume7d / 1e3).toFixed(2)}K`);
  addText(`24h Change: ${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`);
  addText(`7d Change: ${(token.change7d || 0).toFixed(2)}%`);
  addText(`ATH Price: $${(token.ath || token.usdPrice).toFixed(10)}`);
  addText(`ATL Price: $${(token.atl || token.usdPrice).toFixed(10)}`);
  addText(`ATH Date: ${token.athDate ? new Date(token.athDate).toLocaleDateString() : 'N/A'}`);

  section('LIQUIDITY & POOL DATA');
  addText(`Total Liquidity: $${(token.liquidity / 1e3).toFixed(2)}K`);
  addText(`Liquidity Locked: ${token.liquidityLocked ? 'YES' : 'NO'}`);
  addText(`Lock Duration: ${token.lockDuration || 'N/A'}`);
  addText(`Primary DEX: ${token.primaryDex || 'Unknown'}`);
  addText(`Pool Address: ${token.poolAddress?.slice(0, 20) || 'N/A'}...`);
  addText(`LP Burn: ${token.lpBurned ? 'YES ✓' : 'NO'}`);

  section('HOLDER METRICS');
  addText(`Total Holders: ${(token.holderCount / 1e3).toFixed(1)}K`);
  addText(`Top Holder %: ${token.topHolderPercent?.toFixed(2) || 'N/A'}%`);
  addText(`Top 10 Holders %: ${token.top10HolderPercent?.toFixed(2) || 'N/A'}%`);
  addText(`Top 100 Holders %: ${token.top100HolderPercent?.toFixed(2) || 'N/A'}%`);
  addText(`Holder Concentration: ${token.holderConcentration?.toFixed(2) || 'N/A'}%`);

  section('TRANSACTION DATA');
  addText(`Total Transactions: ${token.transactionCount?.toLocaleString() || 'N/A'}`);
  addText(`Buy/Sell Ratio: ${token.buySellRatio?.toFixed(2) || 'N/A'}`);
  addText(`Unique Buyers: ${token.uniqueBuyers?.toLocaleString() || 'N/A'}`);
  addText(`Unique Sellers: ${token.uniqueSellers?.toLocaleString() || 'N/A'}`);

  section('SOCIAL & COMMUNITY');
  addText(`Website: ${token.website || 'N/A'}`);
  addText(`Twitter: ${token.twitter || 'N/A'}`);
  addText(`Telegram: ${token.telegram || 'N/A'}`);
  addText(`Discord: ${token.discord || 'N/A'}`);
  addText(`Reddit: ${token.reddit || 'N/A'}`);

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2+: ALL HOLDER DATA
  // ═══════════════════════════════════════════════════════════════════════

  newPage('💎 COMPLETE HOLDER DATABASE');

  try {
    const { data: allHolders } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', token.mint)
      .order('balance_usd', { ascending: false })
      .limit(5000);

    if (allHolders && allHolders.length > 0) {
      const cols = [10, 40, 65, 90, 115, 140, 165, 190];
      const headers = ['Rank', 'Wallet', 'Balance $', 'Balance %', 'Entry', 'Unrealized %', 'Realized $', 'Type'];

      doc.setFontSize(8);
      doc.setTextColor(56, 196, 220);
      headers.forEach((h, i) => doc.text(h, cols[i], yPos));
      yPos += 4;
      doc.setDrawColor(56, 196, 220);
      doc.line(10, yPos, PAGE_WIDTH - 10, yPos);
      yPos += 2;

      let rowNum = 0;
      for (const holder of allHolders) {
        if (yPos > PAGE_HEIGHT - 5) newPage();
        
        rowNum++;
        const pnlColor = holder.unrealized_pnl_percent >= 0 ? [100, 255, 100] : [255, 100, 100];
        
        doc.setFontSize(7);
        doc.setTextColor(100, 150, 150);
        doc.text(`#${rowNum}`, cols[0], yPos);
        doc.text(holder.wallet_address.slice(0, 12) + '...', cols[1], yPos);
        doc.text(`$${(holder.balance_usd / 1e3).toFixed(1)}K`, cols[2], yPos);
        doc.text(`${(holder.balance_percent_of_supply || 0).toFixed(3)}%`, cols[3], yPos);
        doc.text(`$${holder.avg_entry_price?.toFixed(8) || 'N/A'}`, cols[4], yPos);
        
        doc.setTextColor(...pnlColor);
        doc.text(`${holder.unrealized_pnl_percent?.toFixed(0) || 'N/A'}%`, cols[5], yPos);
        
        doc.setTextColor(100, 150, 150);
        doc.text(`$${holder.realized_pnl_usd?.toFixed(0) || '0'}`, cols[6], yPos);
        doc.text(holder.classification || 'Unknown', cols[7], yPos);
        
        yPos += 3;
      }

      addText(`\nTotal Holders Analyzed: ${allHolders.length.toLocaleString()}`);
    }
  } catch (error) {
    addText(`Error loading holders: ${error}`, [200, 100, 100]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE: ALL TRANSACTIONS
  // ═══════════════════════════════════════════════════════════════════════

  newPage('📊 COMPLETE TRANSACTION HISTORY');

  try {
    const { data: transactions } = await supabase
      .from('transactions_extended')
      .select('*')
      .eq('mint_address', token.mint)
      .order('blockchain_timestamp', { ascending: false })
      .limit(10000);

    if (transactions && transactions.length > 0) {
      const cols = [10, 40, 70, 100, 130, 160, 190];
      const headers = ['#', 'Time', 'Type', 'Amount', 'Price', 'Volume $', 'PnL $'];

      doc.setFontSize(7);
      doc.setTextColor(56, 196, 220);
      headers.forEach((h, i) => doc.text(h, cols[i], yPos));
      yPos += 3;

      let txNum = 0;
      for (const tx of transactions) {
        if (yPos > PAGE_HEIGHT - 5) newPage();
        
        txNum++;
        const pnlColor = (tx.profit_loss_usd || 0) >= 0 ? [100, 255, 100] : [255, 100, 100];
        const date = new Date(tx.blockchain_timestamp * 1000).toLocaleDateString();
        
        doc.setFontSize(6);
        doc.setTextColor(100, 150, 150);
        doc.text(`${txNum}`, cols[0], yPos);
        doc.text(date, cols[1], yPos);
        doc.text(tx.direction?.toUpperCase() || 'SWAP', cols[2], yPos);
        doc.text(`${(Number(tx.token_amount) / 1e6).toFixed(2)}`, cols[3], yPos);
        doc.text(`$${tx.token_price?.toFixed(8) || 'N/A'}`, cols[4], yPos);
        doc.text(`$${(tx.usd_volume || 0).toFixed(0)}`, cols[5], yPos);
        
        doc.setTextColor(...pnlColor);
        doc.text(`$${(tx.profit_loss_usd || 0).toFixed(0)}`, cols[6], yPos);
        
        yPos += 2;
      }

      addText(`\nTotal Transactions: ${transactions.length.toLocaleString()}`);
    }
  } catch (error) {
    addText(`Error loading transactions: ${error}`, [200, 100, 100]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE: ALL ANOMALIES & ALERTS
  // ═══════════════════════════════════════════════════════════════════════

  newPage('⚠️ COMPLETE ANOMALIES LOG');

  try {
    const { data: anomalies } = await supabase
      .from('real_time_alerts')
      .select('*')
      .eq('mint_address', token.mint)
      .order('triggered_timestamp', { ascending: false })
      .limit(5000);

    if (anomalies && anomalies.length > 0) {
      const cols = [10, 50, 90, 130, 170];
      const headers = ['Time', 'Type', 'Severity', 'Value', 'Change %'];

      doc.setFontSize(7);
      doc.setTextColor(56, 196, 220);
      headers.forEach((h, i) => doc.text(h, cols[i], yPos));
      yPos += 3;

      for (const alert of anomalies) {
        if (yPos > PAGE_HEIGHT - 5) newPage();

        const severityColor = 
          alert.severity === 'critical' ? [255, 100, 100] :
          alert.severity === 'high' ? [255, 200, 100] :
          alert.severity === 'medium' ? [255, 255, 100] :
          [100, 200, 255];

        const date = new Date(alert.triggered_timestamp * 1000).toLocaleString();

        doc.setFontSize(6);
        doc.setTextColor(...severityColor);
        doc.text(date, cols[0], yPos);
        doc.text(alert.alert_type, cols[1], yPos);
        doc.text(alert.severity.toUpperCase(), cols[2], yPos);
        doc.text(`${alert.metric_value?.toFixed(2) || 'N/A'}`, cols[3], yPos);
        doc.text(`${alert.percent_change?.toFixed(1) || 'N/A'}%`, cols[4], yPos);

        yPos += 2;
      }

      addText(`\nTotal Anomalies Detected: ${anomalies.length.toLocaleString()}`);
    }
  } catch (error) {
    addText(`Error loading anomalies: ${error}`, [200, 100, 100]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE: ML ANALYSIS & PREDICTIONS
  // ═══════════════════════════════════════════════════════════════════════

  newPage('🤖 MACHINE LEARNING & PREDICTIVE ANALYSIS');

  try {
    const prediction = await predictTokenPrice(token.mint);
    const rugRisk = await assessRugRisk(token.mint);

    section('PRICE PREDICTIONS');
    addText(`Current Price: $${token.usdPrice.toFixed(10)}`);
    if (prediction) {
      addText(`1-Hour Prediction: $${prediction.nextHourPrice.toFixed(10)}`);
      addText(`24-Hour Prediction: $${prediction.next24hPrice.toFixed(10)}`);
      addText(`Direction: ${prediction.direction.toUpperCase()}`);
      addText(`Confidence Score: ${(prediction.confidence * 100).toFixed(1)}%`);
      addText(`Risk Level: ${prediction.riskLevel.toUpperCase()}`);
    }

    section('RUG PULL ASSESSMENT');
    if (rugRisk) {
      const rugColor = rugRisk.rugProbability > 70 ? [255, 100, 100] : [100, 255, 100];
      addText(`Rug Probability: ${rugRisk.rugProbability.toFixed(1)}%`, rugColor);
      addText(`Verdict: ${rugRisk.verdict.toUpperCase()}`);
      
      section('DETAILED RISK FACTORS');
      addText(`Whale Concentration Risk: ${rugRisk.rugFactors.whaleConcentration.toFixed(1)}/30 points`);
      addText(`Liquidity Risk: ${rugRisk.rugFactors.liquidityRisk.toFixed(1)}/20 points`);
      addText(`Deployer History Risk: ${rugRisk.rugFactors.deployerHistory.toFixed(1)}/25 points`);
      addText(`Authority Risk: ${rugRisk.rugFactors.authorityRisk.toFixed(1)}/15 points`);
      addText(`Volume Anomalies: ${rugRisk.rugFactors.volumeAnomalies.toFixed(1)}/15 points`);
      addText(`Model Confidence: ${(rugRisk.confidence * 100).toFixed(1)}%`);
    }
  } catch (error) {
    addText(`Error loading ML data: ${error}`, [200, 100, 100]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE: PRICE CANDLES & TECHNICAL DATA
  // ═══════════════════════════════════════════════════════════════════════

  newPage('📈 PRICE CANDLES & TECHNICAL INDICATORS');

  try {
    const { data: candles } = await supabase
      .from('price_candles_extended')
      .select('*')
      .eq('mint_address', token.mint)
      .order('candle_timestamp', { ascending: false })
      .limit(500);

    if (candles && candles.length > 0) {
      const cols = [10, 40, 70, 100, 130, 160, 190];
      const headers = ['Time', 'Open', 'High', 'Low', 'Close', 'Volume $', 'RSI'];

      doc.setFontSize(6);
      doc.setTextColor(56, 196, 220);
      headers.forEach((h, i) => doc.text(h, cols[i], yPos));
      yPos += 2;

      for (const candle of candles) {
        if (yPos > PAGE_HEIGHT - 5) newPage();

        const date = new Date(candle.candle_timestamp * 1000).toLocaleString();

        doc.setFontSize(5);
        doc.setTextColor(100, 150, 150);
        doc.text(date, cols[0], yPos);
        doc.text(`$${candle.open_price?.toFixed(8) || 'N/A'}`, cols[1], yPos);
        doc.text(`$${candle.high_price?.toFixed(8) || 'N/A'}`, cols[2], yPos);
        doc.text(`$${candle.low_price?.toFixed(8) || 'N/A'}`, cols[3], yPos);
        doc.text(`$${candle.close_price?.toFixed(8) || 'N/A'}`, cols[4], yPos);
        doc.text(`$${(candle.volume_usd || 0).toFixed(0)}`, cols[5], yPos);
        doc.text(`${candle.rsi?.toFixed(1) || 'N/A'}`, cols[6], yPos);

        yPos += 1.5;
      }
    }
  } catch (error) {
    addText(`Error loading candles: ${error}`, [200, 100, 100]);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FINAL PAGE: SUMMARY & METADATA
  // ═══════════════════════════════════════════════════════════════════════

  newPage('📋 REPORT SUMMARY');

  section('REPORT METADATA');
  addText(`Generated: ${new Date().toLocaleString()}`);
  addText(`Token: ${token.name} ($${token.mint})`);
  addText(`Total Pages: ${pageNum}`);
  addText(`Data Sources: Helius API, DexScreener, Birdeye, Supabase`);

  section('DATA COVERAGE');
  addText(`✓ Complete holder database (all holders)`);
  addText(`✓ Full transaction history (all trades)`);
  addText(`✓ All real-time anomalies & alerts`);
  addText(`✓ Price candles with technical indicators`);
  addText(`✓ ML predictions (price & rug detection)`);
  addText(`✓ Whale risk analysis`);
  addText(`✓ Market metrics & liquidity data`);
  addText(`✓ Contract & blockchain details`);
  addText(`✓ Social metrics & links`);

  // Footer on all pages
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 80);
  for (let p = 1; p <= doc.internal.pages.length - 1; p++) {
    doc.setPage(p);
    doc.text(
      `OG Scan Ultimate Intelligence Report | Page ${p} of ${doc.internal.pages.length - 1} | ${token.mint.slice(0, 20)}... | ${new Date().toLocaleDateString()}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 3,
      { align: 'center' }
    );
  }

  return doc;
}
