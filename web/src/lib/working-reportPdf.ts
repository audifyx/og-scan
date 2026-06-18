// FILE: web/src/lib/working-reportPdf.ts
// WORKING PDF that pulls actual data and shows it

import jsPDF from 'jspdf';
import { Token } from '@/lib/og';
import { supabase } from '@/lib/supabase';

export async function generateWorkingReport(token: Token): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 15;
  let pageNum = 1;

  const newPage = () => {
    doc.addPage();
    pageNum++;
    yPos = 15;
  };

  const checkPage = (space: number = 20) => {
    if (yPos + space > pageHeight - 10) {
      newPage();
    }
  };

  const addTitle = (text: string) => {
    checkPage(10);
    doc.setFontSize(14);
    doc.setTextColor(56, 196, 220);
    doc.text(text, 10, yPos);
    yPos += 8;
  };

  const addText = (text: string, size = 9, color = [100, 100, 100]) => {
    checkPage(5);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, 10, yPos);
    yPos += 4;
  };

  // ═════════════════════════════════════════════════════════════
  // PAGE 1: TOKEN SUMMARY
  // ═════════════════════════════════════════════════════════════

  doc.setFontSize(20);
  doc.setTextColor(56, 196, 220);
  doc.text(`$${token.name}`, 10, yPos);
  yPos += 10;

  doc.setFontSize(14);
  doc.setTextColor(100, 255, 100);
  doc.text(`Price: $${token.usdPrice.toFixed(10)}`, 10, yPos);
  yPos += 6;

  const changeColor = token.change24h >= 0 ? [100, 255, 100] : [255, 100, 100];
  doc.setTextColor(...changeColor);
  doc.text(`24H: ${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`, 10, yPos);
  yPos += 10;

  addTitle('CONTRACT DETAILS');
  addText(`CA: ${token.mint}`);
  addText(`Chain: Solana`);
  addText(`Decimals: ${token.decimals || 6}`);
  addText(`Mint Auth Renounced: ${token.mintAuthorityRenounced ? 'Yes' : 'No'}`);
  addText(`Freeze Auth Renounced: ${token.freezeAuthorityRenounced ? 'Yes' : 'No'}`);

  addTitle('MARKET DATA');
  addText(`Market Cap: $${(token.marketCap / 1e6).toFixed(2)}M`);
  addText(`Liquidity: $${(token.liquidity / 1e3).toFixed(1)}K`);
  addText(`Volume 24H: $${(token.volume24h / 1e3).toFixed(1)}K`);
  addText(`Holders: ${(token.holderCount / 1e3).toFixed(1)}K`);
  addText(`Top Holder %: ${token.topHolderPercent?.toFixed(2) || 'N/A'}%`);

  // ═════════════════════════════════════════════════════════════
  // PAGE 2+: TRY TO PULL HOLDER DATA
  // ═════════════════════════════════════════════════════════════

  newPage();
  addTitle('HOLDER DATA');

  try {
    console.log('Fetching holders from Supabase for mint:', token.mint);
    
    const { data: holders, error } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', token.mint)
      .order('balance_usd', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase error:', error);
      addText('Error fetching from holder_snapshots table', 10, [255, 100, 100]);
    }

    if (holders && holders.length > 0) {
      addText(`Found ${holders.length} holders`);
      yPos += 4;

      doc.setFontSize(8);
      doc.setTextColor(56, 196, 220);
      const cols = [10, 40, 70, 100, 130];
      doc.text('Wallet', cols[0], yPos);
      doc.text('Balance $', cols[1], yPos);
      doc.text('% Supply', cols[2], yPos);
      doc.text('Unrealized %', cols[3], yPos);
      doc.text('Type', cols[4], yPos);
      yPos += 4;

      holders.forEach((h: any) => {
        checkPage(4);
        const pnlColor = h.unrealized_pnl_percent >= 0 ? [100, 255, 100] : [255, 100, 100];
        doc.setTextColor(100, 150, 150);
        doc.setFontSize(7);
        
        doc.text(h.wallet_address.slice(0, 12) + '...', cols[0], yPos);
        doc.text(`$${(h.balance_usd / 1000).toFixed(1)}K`, cols[1], yPos);
        doc.text(`${(h.balance_percent_of_supply || 0).toFixed(2)}%`, cols[2], yPos);
        
        doc.setTextColor(...pnlColor);
        doc.text(`${h.unrealized_pnl_percent?.toFixed(0) || 'N/A'}%`, cols[3], yPos);
        
        doc.setTextColor(56, 196, 220);
        doc.text(h.classification || 'Unknown', cols[4], yPos);
        
        yPos += 3;
      });
    } else {
      addText('No holder data in holder_snapshots table', 10, [200, 100, 100]);
      addText('Holders table is empty or not populated yet', 9, [150, 150, 150]);
    }
  } catch (error) {
    console.error('Error fetching holders:', error);
    addText(`Error: ${String(error)}`, 10, [255, 100, 100]);
  }

  // ═════════════════════════════════════════════════════════════
  // PAGE 3+: TRY TO PULL TRANSACTION DATA
  // ═════════════════════════════════════════════════════════════

  newPage();
  addTitle('TRANSACTION HISTORY');

  try {
    console.log('Fetching transactions from Supabase for mint:', token.mint);
    
    const { data: transactions, error } = await supabase
      .from('transactions_extended')
      .select('*')
      .eq('mint_address', token.mint)
      .order('blockchain_timestamp', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase error:', error);
      addText('Error fetching from transactions_extended table', 10, [255, 100, 100]);
    }

    if (transactions && transactions.length > 0) {
      addText(`Found ${transactions.length} transactions`);
      yPos += 4;

      doc.setFontSize(7);
      doc.setTextColor(56, 196, 220);
      const cols = [10, 40, 70, 100, 130];
      doc.text('Time', cols[0], yPos);
      doc.text('Type', cols[1], yPos);
      doc.text('Amount', cols[2], yPos);
      doc.text('Volume $', cols[3], yPos);
      doc.text('PnL $', cols[4], yPos);
      yPos += 4;

      transactions.forEach((tx: any) => {
        checkPage(3);
        const date = new Date(tx.blockchain_timestamp * 1000).toLocaleDateString();
        const pnlColor = (tx.profit_loss_usd || 0) >= 0 ? [100, 255, 100] : [255, 100, 100];
        
        doc.setTextColor(100, 150, 150);
        doc.setFontSize(6);
        
        doc.text(date, cols[0], yPos);
        doc.text(tx.direction?.toUpperCase() || 'SWAP', cols[1], yPos);
        doc.text(`${(Number(tx.token_amount) / 1e6).toFixed(2)}`, cols[2], yPos);
        doc.text(`$${(tx.usd_volume || 0).toFixed(0)}`, cols[3], yPos);
        
        doc.setTextColor(...pnlColor);
        doc.text(`$${(tx.profit_loss_usd || 0).toFixed(0)}`, cols[4], yPos);
        
        yPos += 2.5;
      });
    } else {
      addText('No transaction data in transactions_extended table', 10, [200, 100, 100]);
      addText('Transactions table is empty or not populated yet', 9, [150, 150, 150]);
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
    addText(`Error: ${String(error)}`, 10, [255, 100, 100]);
  }

  // ═════════════════════════════════════════════════════════════
  // PAGE N: TRY TO PULL ANOMALIES
  // ═════════════════════════════════════════════════════════════

  newPage();
  addTitle('REAL-TIME ANOMALIES & ALERTS');

  try {
    console.log('Fetching anomalies from Supabase for mint:', token.mint);
    
    const { data: anomalies, error } = await supabase
      .from('real_time_alerts')
      .select('*')
      .eq('mint_address', token.mint)
      .order('triggered_timestamp', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase error:', error);
      addText('Error fetching from real_time_alerts table', 10, [255, 100, 100]);
    }

    if (anomalies && anomalies.length > 0) {
      addText(`Found ${anomalies.length} anomalies`);
      yPos += 4;

      doc.setFontSize(7);
      anomalies.forEach((a: any) => {
        checkPage(3);
        const severityColor = 
          a.severity === 'critical' ? [255, 100, 100] :
          a.severity === 'high' ? [255, 200, 100] :
          [100, 200, 255];
        
        doc.setTextColor(...severityColor);
        const date = new Date(a.triggered_timestamp * 1000).toLocaleString();
        doc.text(`[${a.severity}] ${a.alert_type}: ${a.metric_value?.toFixed(2)} (${a.percent_change?.toFixed(1)}%) - ${date}`, 10, yPos);
        yPos += 3;
      });
    } else {
      addText('No anomaly data in real_time_alerts table', 10, [200, 100, 100]);
      addText('Alerts table is empty or not populated yet', 9, [150, 150, 150]);
    }
  } catch (error) {
    console.error('Error fetching anomalies:', error);
    addText(`Error: ${String(error)}`, 10, [255, 100, 100]);
  }

  // ═════════════════════════════════════════════════════════════
  // FOOTER
  // ═════════════════════════════════════════════════════════════

  for (let p = 1; p <= doc.internal.pages.length - 1; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `OG Scan Report | Page ${p} of ${doc.internal.pages.length - 1} | ${token.mint.slice(0, 20)}... | ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  return doc;
}
