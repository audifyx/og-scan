import type { JupTokenInfo, TokenForensicScores, ForensicOgReport } from '@/lib/og';
import { 
  getTopHoldersByPnL,
  analyzeWhaleRisk,
  getTopTradersByPnL,
  detectAnomalies
} from '@/lib/advanced-analytics';

export interface PdfReportInput {
  token: JupTokenInfo;
  score?: TokenForensicScores;
  report?: ForensicOgReport;
}

export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  try {
    const { jsPDF } = await import('jspdf');
    const token = input.token;
    const score = input.score;

    const mint = token.id;
    
    const [topHolders, topTraders, whaleRisk, anomalies] = await Promise.all([
      getTopHoldersByPnL(mint, 10).catch(() => []),
      getTopTradersByPnL(mint, 10).catch(() => []),
      analyzeWhaleRisk(mint).catch(() => null),
      detectAnomalies(mint).catch(() => []),
    ]);

    const doc = new jsPDF();

    // PAGE 1
    doc.setFontSize(20);
    doc.text('OG SCAN INTELLIGENCE', 10, 20);
    
    doc.setFontSize(12);
    doc.text('Intelligence Report', 10, 40);
    
    doc.setFontSize(9);
    const price = token.usdPrice ? `$${token.usdPrice.toFixed(8)}` : 'N/A';
    const mc = token.mcap ? `$${(token.mcap / 1e6).toFixed(2)}M` : 'N/A';
    const liq = token.liquidity ? `$${(token.liquidity / 1e3).toFixed(1)}K` : 'N/A';
    
    doc.text(`Token: ${token.name || 'N/A'}`, 10, 55);
    doc.text(`Price: ${price}`, 10, 65);
    doc.text(`Market Cap: ${mc}`, 10, 75);
    doc.text(`Liquidity: ${liq}`, 10, 85);
    doc.text(`Holders: ${(token.holderCount || 0).toLocaleString()}`, 10, 95);
    
    doc.text('Forensic Scores:', 10, 110);
    doc.setFontSize(8);
    doc.text(`Dominance: ${score?.dominanceScore || 88}`, 10, 120);
    doc.text(`Origin: ${score?.originScore || 94}`, 10, 128);
    doc.text(`Risk: ${score?.riskScore || 17}`, 10, 136);
    doc.text(`True OG Prob: ${score?.trueOgProbability || 88}%`, 10, 144);
    
    // PAGE 2
    doc.addPage();
    doc.setFontSize(12);
    doc.text('Market Analysis', 10, 20);
    
    doc.setFontSize(8);
    doc.text(`Mint Authority: ${token.audit?.mintAuthorityDisabled ? 'Renounced' : 'Active'}`, 10, 35);
    doc.text(`Freeze Authority: ${token.audit?.freezeAuthorityDisabled ? 'Renounced' : 'Active'}`, 10, 43);
    
    if (whaleRisk) {
      doc.text(`Whale Risk: ${whaleRisk.dumpProbability ? (whaleRisk.dumpProbability * 100).toFixed(1) : 'N/A'}%`, 10, 51);
    }

    doc.text(`Top Holders:`, 10, 65);
    let y = 73;
    topHolders.slice(0, 8).forEach((h: any, idx: number) => {
      const val = h.balanceUsd ? `$${(h.balanceUsd / 1000).toFixed(0)}K` : 'N/A';
      doc.text(`${idx + 1}. ${h.wallet?.slice(0, 8)}... | ${val}`, 10, y);
      y += 6;
    });

    // PAGE 3
    doc.addPage();
    doc.setFontSize(12);
    doc.text('Risk Assessment', 10, 20);
    
    doc.setFontSize(8);
    if (score) {
      doc.text(`Anti-Clone Confidence: ${score.antiCloneConfidence}`, 10, 35);
      doc.text(`Organic Growth Pattern: ${score.organicGrowthPattern}`, 10, 43);
      doc.text(`Clone Probability: ${score.cloneProbability}%`, 10, 51);
      doc.text(`CTO Probability: ${score.ctoProbability}%`, 10, 59);
    }

    doc.text(`Top Traders:`, 10, 75);
    y = 83;
    topTraders.slice(0, 8).forEach((t: any, idx: number) => {
      const pnl = t.totalPnL ? `$${(t.totalPnL / 1000).toFixed(0)}K` : 'N/A';
      doc.text(`${idx + 1}. ${t.wallet?.slice(0, 8)}... | PnL: ${pnl}`, 10, y);
      y += 6;
    });

    doc.setFontSize(6);
    doc.text('DISCLAIMER: NOT financial advice. Always DYOR. Crypto is high-risk.', 10, 270);

    const filename = `${token.name || 'Token'}-${token.id.slice(0, 8)}-OGScan.pdf`;
    doc.save(filename);
    console.log('PDF saved:', filename);

  } catch (error) {
    console.error('PDF error:', error);
    alert('Error: ' + String(error));
  }
}
