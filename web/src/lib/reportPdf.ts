import type { JupTokenInfo, TokenForensicScores, ForensicOgReport } from '@/lib/og';
import { 
  analyzeHolder,
  getTopHoldersByPnL,
  analyzeWhaleRisk,
  getTopTradersByPnL,
  calculateTokenRiskScore,
  detectAnomalies
} from '@/lib/advanced-analytics';

export interface PdfReportInput {
  token: JupTokenInfo;
  score?: TokenForensicScores;
  report?: ForensicOgReport;
}

function safe(val: any, fallback = 'N/A'): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val.substring(0, 100);
  if (typeof val === 'number') return String(val);
  return fallback;
}

export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  try {
    console.log('📄 Generating comprehensive forensic PDF...');
    const { jsPDF } = await import('jspdf');
    
    const token = input.token;
    const score = input.score;
    const report = input.report;

    // Fetch ALL additional analytics data
    console.log('📊 Fetching analytics data...');
    const mint = token.id;
    const [topHolders, topTraders, whaleRisk, anomalies, riskProfile] = await Promise.all([
      getTopHoldersByPnL(mint, 20).catch(() => []),
      getTopTradersByPnL(mint, 20).catch(() => []),
      analyzeWhaleRisk(mint).catch(() => null),
      detectAnomalies(mint).catch(() => []),
      calculateTokenRiskScore({ token, score, report }).catch(() => null),
    ]);
    console.log('✓ Fetched:', topHolders.length, 'holders,', topTraders.length, 'traders, anomalies:', anomalies.length);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = 15;

    const addNewPage = () => {
      doc.addPage();
      y = 15;
    };

    const setColor = (r: number, g: number, b: number) => {
      doc.setTextColor(r, g, b);
    };

    const text = (str: string, x: number, size: number, bold = false) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(str, pageWidth - 2 * margin);
      doc.text(lines, x, y);
      y += lines.length * (size * 0.35 + 1);
    };

    // ===== PAGE 1: HEADER & TOKEN INFO =====
    setColor(244, 162, 97);
    text('OG SCAN FORENSIC INTELLIGENCE REPORT', margin, 16, true);
    
    setColor(100, 100, 100);
    text(`Generated: ${new Date().toLocaleString()}`, margin, 7);
    y += 5;

    setColor(244, 162, 97);
    text('TOKEN IDENTITY', margin, 12, true);
    
    setColor(255, 255, 255);
    text(`Name: ${safe(token.name)}`, margin + 2, 9);
    text(`Symbol: ${safe(token.symbol)}`, margin + 2, 9);
    text(`Contract: ${safe(token.id)}`, margin + 2, 9);
    text(`Decimals: ${safe(token.decimals, '9')}`, margin + 2, 9);
    text(`Created: ${safe(token.onChainCreatedAt || token.firstMintAt)}`, margin + 2, 9);
    y += 3;

    // KEY METRICS
    setColor(244, 162, 97);
    text('KEY MARKET METRICS', margin, 12, true);
    
    setColor(255, 255, 255);
    const price = safe(token.usdPrice ? '$' + token.usdPrice.toFixed(8) : 'N/A');
    const mcap = safe(token.mcap ? '$' + (token.mcap / 1e6).toFixed(2) + 'M' : 'N/A');
    const fdv = safe(token.fdv ? '$' + (token.fdv / 1e6).toFixed(2) + 'M' : 'N/A');
    const liq = safe(token.liquidity ? '$' + (token.liquidity / 1e3).toFixed(1) + 'K' : 'N/A');
    const vol = safe(token.stats24h?.buyVolume ? '$' + ((token.stats24h.buyVolume + (token.stats24h.sellVolume || 0)) / 1e3).toFixed(1) + 'K' : 'N/A');
    const change = safe(token.stats24h?.priceChange ? (token.stats24h.priceChange >= 0 ? '+' : '') + token.stats24h.priceChange.toFixed(2) + '%' : 'N/A');
    
    text(`Price: ${price} | 24h Change: ${change}`, margin + 2, 9);
    text(`Market Cap: ${mcap} | FDV: ${fdv}`, margin + 2, 9);
    text(`Liquidity: ${liq} | 24h Volume: ${vol}`, margin + 2, 9);
    text(`Holders: ${safe(token.holderCount || 0)} | Verified: ${token.isVerified ? 'Yes' : 'No'}`, margin + 2, 9);
    y += 3;

    // FORENSIC SCORES
    setColor(244, 162, 97);
    text('FORENSIC SCORES (ALGORITHMIC)', margin, 12, true);
    
    setColor(255, 255, 255);
    if (score) {
      text(`Dominance: ${score.dominanceScore} | Origin: ${score.originScore} | Risk: ${score.riskScore}`, margin + 2, 8);
      text(`Clone Prob: ${score.cloneProbability}% | CTO Prob: ${score.ctoProbability}% | Migration Prob: ${score.migrationProbability}%`, margin + 2, 8);
      text(`True OG Prob: ${score.trueOgProbability}% | Deployer Trust: ${score.deployerTrustScore}`, margin + 2, 8);
      text(`Holder Distribution: ${score.holderDistributionScore} | On-Chain Activity: ${score.onChainActivityScore}`, margin + 2, 8);
    }
    y += 3;

    if (y > pageHeight - 40) addNewPage();

    // ===== PAGE 2: AUTHORITY & WHALE ANALYSIS =====
    setColor(244, 162, 97);
    text('AUTHORITY & CONTRACT STATUS', margin, 12, true);
    
    setColor(255, 255, 255);
    const mintAuth = token.audit?.mintAuthorityDisabled ? 'RENOUNCED' : 'ACTIVE';
    const freezeAuth = token.audit?.freezeAuthorityDisabled ? 'RENOUNCED' : 'ACTIVE';
    text(`Mint Authority: ${mintAuth}`, margin + 2, 9);
    text(`Freeze Authority: ${freezeAuth}`, margin + 2, 9);
    text(`Top Holders %: ${safe(token.audit?.topHoldersPercentage ? token.audit.topHoldersPercentage.toFixed(1) + '%' : 'N/A')}`, margin + 2, 9);
    y += 3;

    // WHALE RISK ANALYSIS
    setColor(244, 162, 97);
    text('WHALE RISK ANALYSIS', margin, 12, true);
    
    setColor(255, 255, 255);
    if (whaleRisk) {
      text(`Total Whale Power: ${safe(whaleRisk.totalWhalePower.toFixed(1))}%`, margin + 2, 9);
      text(`Critical Risk Wallets: ${safe(whaleRisk.criticalRiskWallets)}`, margin + 2, 9);
      text(`Dump Probability: ${safe((whaleRisk.dumpProbability * 100).toFixed(1))}%`, margin + 2, 9);
      text(`Price Impact (10% dump): ${safe((whaleRisk.priceImpactPercent || 0).toFixed(2))}%`, margin + 2, 9);
    }
    y += 3;

    // TOP HOLDERS BY PnL
    setColor(244, 162, 97);
    text(`TOP HOLDERS BY PnL (${topHolders.length})`, margin, 11, true);
    
    setColor(255, 255, 255);
    topHolders.slice(0, 8).forEach((h: any) => {
      if (y > pageHeight - 20) addNewPage();
      text(`${h.wallet.slice(0, 8)}... | $${(h.balanceUsd || 0).toFixed(0)} | PnL: ${(h.unrealizedPnL || 0).toFixed(1)}% | Hold: ${h.holdingDays}d`, margin + 2, 7);
    });
    y += 2;

    if (y > pageHeight - 40) addNewPage();

    // ===== PAGE 3: TRADERS & ANOMALIES =====
    setColor(244, 162, 97);
    text(`TOP TRADERS BY PnL (${topTraders.length})`, margin, 11, true);
    
    setColor(255, 255, 255);
    topTraders.slice(0, 10).forEach((t: any) => {
      if (y > pageHeight - 20) addNewPage();
      text(`${t.wallet.slice(0, 8)}... | PnL: $${(t.totalPnL || 0).toFixed(0)} | Volume: $${(t.totalVolume / 1e3).toFixed(1)}K | Trades: ${t.tradeCount} | Win: ${(t.winRate || 0).toFixed(0)}%`, margin + 2, 7);
    });
    y += 3;

    // ANOMALIES & ALERTS
    setColor(244, 162, 97);
    text(`ANOMALIES & ALERTS (${anomalies.length})`, margin, 11, true);
    
    setColor(255, 255, 255);
    if (anomalies.length > 0) {
      anomalies.slice(0, 12).forEach((anom: any) => {
        if (y > pageHeight - 20) addNewPage();
        text(`${safe(anom.type || 'Alert')}: ${safe(anom.description || 'Anomaly detected')} (${safe(anom.severity || 'Medium')})`, margin + 2, 7);
      });
    } else {
      text('No anomalies detected', margin + 2, 9);
    }
    y += 3;

    if (y > pageHeight - 40) addNewPage();

    // ===== PAGE 4: RISK PROFILE & BEHAVIORAL =====
    setColor(244, 162, 97);
    text('RISK PROFILE ASSESSMENT', margin, 12, true);
    
    setColor(255, 255, 255);
    if (riskProfile) {
      text(`Overall Risk Score: ${safe(riskProfile.overallRisk)}/100`, margin + 2, 10, true);
      text(`Security Risk: ${safe(riskProfile.securityRisk || 'N/A')}`, margin + 2, 9);
      text(`Market Risk: ${safe(riskProfile.marketRisk || 'N/A')}`, margin + 2, 9);
      text(`Operational Risk: ${safe(riskProfile.operationalRisk || 'N/A')}`, margin + 2, 9);
    }
    y += 3;

    // BEHAVIORAL ANALYSIS
    setColor(244, 162, 97);
    text('BEHAVIORAL & AUTHENTICITY ANALYSIS', margin, 12, true);
    
    setColor(255, 255, 255);
    if (score) {
      text(`Wallet Behavior: ${score.walletBehaviorScore}`, margin + 2, 8);
      text(`Anti-Clone Confidence: ${score.antiCloneConfidence}`, margin + 2, 8);
      text(`Metadata Stability: ${score.metadataStability}`, margin + 2, 8);
      text(`Organic Growth Pattern: ${score.organicGrowthPattern}`, margin + 2, 8);
      text(`Deployer Authenticity: ${score.deployerAuthenticity}`, margin + 2, 8);
      text(`Liquidity Survival: ${score.liquiditySurvivalScore}`, margin + 2, 8);
      text(`Narrative Continuity: ${score.narrativeContinuityScore}`, margin + 2, 8);
    }
    y += 3;

    // CLASSIFICATION
    setColor(244, 162, 97);
    text('CLASSIFICATION & ANALYSIS', margin, 12, true);
    
    setColor(255, 255, 255);
    if (score?.classification) {
      text(`Primary Label: ${safe(score.classification.primary_label)}`, margin + 2, 9);
      text(`Secondary Labels: ${safe((score.classification.secondary_labels || []).join(', '))}`, margin + 2, 9);
    }
    if (report?.summary) {
      text(`Narrative Cluster: ${safe(report.narrativeFingerprintId)}`, margin + 2, 9);
      text(`Candidates: ${safe(report.summary.candidateCount)} | Clones: ${safe(report.summary.cloneCount)} | Migrations: ${safe(report.summary.migrationCount)}`, margin + 2, 9);
    }
    y += 3;

    if (y > pageHeight - 40) addNewPage();

    // ===== PAGE 5: FORENSIC SCORES DETAIL =====
    setColor(244, 162, 97);
    text('COMPLETE FORENSIC SCORE BREAKDOWN', margin, 12, true);
    
    setColor(255, 255, 255);
    if (score) {
      const allScores = [
        ['Chain Origin', score.chainOriginScore],
        ['Earliest Liquidity', score.earliestLiquidityScore],
        ['First Transaction', score.firstTransactionScore],
        ['First Holder Dist', score.firstHolderDistribution],
        ['Deployer Auth', score.deployerAuthenticity],
        ['Metadata Stability', score.metadataStability],
        ['Social Origin', score.socialOriginAlignment],
        ['Organic Growth', score.organicGrowthPattern],
        ['Anti-Clone', score.antiCloneConfidence],
        ['Liquidity Depth', score.liquidityDepthPoolAgeScore],
        ['Market Cap Rank', score.marketCapRankScore],
        ['Creator Strength', score.creatorTeamStrengthScore],
        ['Earliest Mint Bonus', score.earliestMintBonusScore],
        ['Official Verification', score.officialVerificationScore],
      ];
      allScores.forEach(([label, value]) => {
        if (y > pageHeight - 20) addNewPage();
        text(`${label}: ${value}`, margin + 2, 8);
      });
    }
    y += 3;

    // PROBABILITIES
    setColor(244, 162, 97);
    text('PROBABILITY ANALYSIS', margin, 12, true);
    
    setColor(255, 255, 255);
    if (score) {
      text(`True OG Probability: ${score.trueOgProbability}%`, margin + 2, 9);
      text(`Clone Probability: ${score.cloneProbability}%`, margin + 2, 9);
      text(`CTO/Relaunch Probability: ${score.ctoProbability}%`, margin + 2, 9);
      text(`Migration Probability: ${score.migrationProbability}%`, margin + 2, 9);
      text(`Artificial Trend Probability: ${score.artificialTrendProbability}%`, margin + 2, 9);
      text(`Manipulated Relaunch Probability: ${score.manipulatedRelaunchProbability}%`, margin + 2, 9);
    }
    y += 5;

    // FINAL DISCLAIMER
    setColor(255, 100, 100);
    text('DISCLAIMER: This report is for informational purposes only. Not financial advice. Cryptocurrencies are high-risk.', margin, 7);

    // SAVE
    const filename = `${safe(token.name)}-${safe(token.id).slice(0, 8)}-OGScan.pdf`;
    doc.save(filename);
    console.log('✅ PDF saved:', filename);

  } catch (error) {
    console.error('PDF Error:', error);
    alert('Error: ' + (error as any).message);
  }
}
