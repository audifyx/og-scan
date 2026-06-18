import type { JupTokenInfo, TokenForensicScores, ForensicOgReport } from '@/lib/og';

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
    console.log('📄 Generating PDF...');
    const { jsPDF } = await import('jspdf');
    
    const token = input.token;
    const score = input.score;
    const report = input.report;

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

    // PAGE 1: HEADER & TOKEN INFO
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
    text(`Created: ${safe(token.onChainCreatedAt || token.firstMintAt || 'Unknown')}`, margin + 2, 9);
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
      text(`Clone Prob: ${score.cloneProbability}% | Rug Risk: ${score.riskScore} | CTO Prob: ${score.ctoProbability}%`, margin + 2, 8);
      text(`True OG Prob: ${score.trueOgProbability}% | Migration Prob: ${score.migrationProbability}%`, margin + 2, 8);
      text(`Deployer Trust: ${score.deployerTrustScore} | Liquidity Auth: ${score.liquidityAuthenticityScore}`, margin + 2, 8);
      text(`Holder Distribution: ${score.holderDistributionScore} | On-Chain Activity: ${score.onChainActivityScore}`, margin + 2, 8);
      text(`Chain Origin: ${score.chainOriginScore} | Earliest Liquidity: ${score.earliestLiquidityScore}`, margin + 2, 8);
      text(`Social Narrative: ${score.socialNarrativeAdoptionScore} | Creator Strength: ${score.creatorTeamStrengthScore}`, margin + 2, 8);
    }
    y += 3;

    if (y > pageHeight - 40) addNewPage();

    // PAGE 2: HOLDER & AUTHORITY DATA
    setColor(244, 162, 97);
    text('AUTHORITY & CONTRACT STATUS', margin, 12, true);
    
    setColor(255, 255, 255);
    const mintAuth = token.audit?.mintAuthorityDisabled ? 'RENOUNCED (Permanent)' : 'ACTIVE';
    const freezeAuth = token.audit?.freezeAuthorityDisabled ? 'RENOUNCED (Permanent)' : 'ACTIVE';
    text(`Mint Authority: ${mintAuth}`, margin + 2, 9);
    text(`Freeze Authority: ${freezeAuth}`, margin + 2, 9);
    text(`Top Holders %: ${safe(token.audit?.topHoldersPercentage ? token.audit.topHoldersPercentage.toFixed(1) + '%' : 'N/A')}`, margin + 2, 9);
    text(`First Pool Created: ${safe(token.firstPool?.createdAt || 'Unknown')}`, margin + 2, 9);
    text(`First Mint Source: ${safe(token.firstMintSource || 'Unknown')}`, margin + 2, 9);
    y += 3;

    // CLASSIFICATION & ANALYSIS
    setColor(244, 162, 97);
    text('CLASSIFICATION & ANALYSIS', margin, 12, true);
    
    setColor(255, 255, 255);
    if (score?.classification) {
      text(`Primary Label: ${safe(score.classification.primary_label)}`, margin + 2, 9);
      text(`Secondary Labels: ${safe((score.classification.secondary_labels || []).join(', '))}`, margin + 2, 9);
    }
    if (report?.summary) {
      text(`Narrative Cluster: ${safe(report.narrativeFingerprintId)}`, margin + 2, 9);
      text(`Candidates in Cluster: ${safe(report.summary.candidateCount)}`, margin + 2, 9);
      text(`Clone Count: ${safe(report.summary.cloneCount)}`, margin + 2, 9);
      text(`Migration Count: ${safe(report.summary.migrationCount)}`, margin + 2, 9);
      text(`High Risk Count in Cluster: ${safe(report.summary.highRiskCount)}`, margin + 2, 9);
      text(`Primary Dominance Score: ${safe(report.summary.primaryDominanceScore)}`, margin + 2, 9);
    }
    y += 3;

    if (y > pageHeight - 40) addNewPage();

    // PAGE 3: BEHAVIORAL ANALYSIS
    setColor(244, 162, 97);
    text('BEHAVIORAL & AUTHENTICITY ANALYSIS', margin, 12, true);
    
    setColor(255, 255, 255);
    if (score) {
      text(`Wallet Behavior Score: ${score.walletBehaviorScore}`, margin + 2, 8);
      text(`Anti-Clone Confidence: ${score.antiCloneConfidence}`, margin + 2, 8);
      text(`Metadata Stability: ${score.metadataStability}`, margin + 2, 8);
      text(`Social Origin Alignment: ${score.socialOriginAlignment}`, margin + 2, 8);
      text(`Organic Growth Pattern: ${score.organicGrowthPattern}`, margin + 2, 8);
      text(`First Transaction Score: ${score.firstTransactionScore}`, margin + 2, 8);
      text(`First Holder Distribution: ${score.firstHolderDistribution}`, margin + 2, 8);
      text(`Deployer Authenticity: ${score.deployerAuthenticity}`, margin + 2, 8);
      text(`Liquidity Survival Score: ${score.liquiditySurvivalScore}`, margin + 2, 8);
      text(`Narrative Continuity: ${score.narrativeContinuityScore}`, margin + 2, 8);
      text(`Artificial Trend Probability: ${score.artificialTrendProbability}%`, margin + 2, 8);
      text(`Manipulated Relaunch Probability: ${score.manipulatedRelaunchProbability}%`, margin + 2, 8);
    }
    y += 3;

    // RISK ASSESSMENT
    setColor(244, 162, 97);
    text('RISK ASSESSMENT', margin, 12, true);
    
    setColor(255, 255, 255);
    if (score) {
      text(`Overall Risk Score: ${score.riskScore}/100`, margin + 2, 10, true);
      text(`Clone Probability: ${score.cloneProbability}%`, margin + 2, 9);
      text(`CTO/Relaunch Probability: ${score.ctoProbability}%`, margin + 2, 9);
      text(`Migration Probability: ${score.migrationProbability}%`, margin + 2, 9);
      text(`Revival Probability: ${score.revivalScore}`, margin + 2, 9);
    }
    y += 5;

    if (y > pageHeight - 40) addNewPage();

    // PAGE 4: LIQUIDITY & FAMILY
    setColor(244, 162, 97);
    text('LIQUIDITY & MARKET POSITION', margin, 12, true);
    
    setColor(255, 255, 255);
    if (score) {
      text(`Liquidity Depth & Pool Age Score: ${score.liquidityDepthPoolAgeScore}`, margin + 2, 9);
      text(`Liquidity Authenticity Score: ${score.liquidityAuthenticityScore}`, margin + 2, 9);
      text(`Liquidity Survival Score: ${score.liquiditySurvivalScore}`, margin + 2, 9);
      text(`Market Cap Rank Score: ${score.marketCapRankScore}`, margin + 2, 9);
    }
    y += 3;

    // NARRATIVE & FAMILY TREE
    setColor(244, 162, 97);
    text('NARRATIVE & TOKEN FAMILY', margin, 12, true);
    
    setColor(255, 255, 255);
    if (report) {
      text(`Primary Token: ${safe(report.primaryToken?.name || 'N/A')} (${safe(report.primaryToken?.symbol)})`, margin + 2, 9);
      text(`First Mint Token: ${safe(report.firstMintToken?.name || 'N/A')} (${safe(report.firstMintToken?.symbol)})`, margin + 2, 9);
      text(`OG Token: ${safe(report.og?.name || 'Unknown')}`, margin + 2, 9);
      if (report.contestedTokens && report.contestedTokens.length > 0) {
        text(`Contested Tokens: ${report.contestedTokens.length}`, margin + 2, 9);
      }
      if (report.copycats && report.copycats.length > 0) {
        text(`Known Copycats/Clones: ${report.copycats.length}`, margin + 2, 9);
      }
      if (report.clusterAliases && report.clusterAliases.length > 0) {
        text(`Cluster Aliases: ${safe(report.clusterAliases.join(', '))}`, margin + 2, 9);
      }
    }
    y += 3;

    if (y > pageHeight - 40) addNewPage();

    // PAGE 5: TIMELINE
    setColor(244, 162, 97);
    text('FORENSIC TIMELINE', margin, 12, true);
    
    setColor(255, 255, 255);
    if (report?.timeline && report.timeline.length > 0) {
      const events = report.timeline.slice(0, 15);
      events.forEach((evt: any) => {
        if (y > pageHeight - 20) addNewPage();
        text(`${safe(evt.timestamp)}: ${safe(evt.eventType)} - ${safe(evt.description)}`, margin + 2, 7);
      });
    }

    // FINAL DISCLAIMER
    y += 5;
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
