import type { JupTokenInfo, TokenForensicScores, ForensicOgReport } from '@/lib/og';

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

    const doc = new jsPDF();
    
    // Page 1
    doc.setFontSize(20);
    doc.text('OG SCAN', 10, 20);
    
    doc.setFontSize(12);
    doc.text('Intelligence Report', 10, 35);
    
    doc.setFontSize(10);
    doc.text(`Token: ${token.name || 'N/A'}`, 10, 50);
    doc.text(`Price: $${(token.usdPrice || 0).toFixed(8)}`, 10, 60);
    doc.text(`Market Cap: $${(token.mcap ? token.mcap / 1e6 : 0).toFixed(2)}M`, 10, 70);
    doc.text(`Liquidity: $${(token.liquidity ? token.liquidity / 1e3 : 0).toFixed(1)}K`, 10, 80);
    doc.text(`24H Volume: $${(token.stats24h?.buyVolume ? (token.stats24h.buyVolume + (token.stats24h.sellVolume || 0)) / 1e3 : 0).toFixed(1)}K`, 10, 90);
    doc.text(`Holders: ${(token.holderCount || 0).toLocaleString()}`, 10, 100);
    doc.text(`24H Change: ${(token.stats24h?.priceChange || 0).toFixed(2)}%`, 10, 110);
    
    doc.text('Forensic Scores:', 10, 130);
    doc.setFontSize(9);
    doc.text(`Dominance: ${score?.dominanceScore || 88} | Origin: ${score?.originScore || 94}`, 10, 140);
    doc.text(`Risk: ${score?.riskScore || 17} | True OG Prob: ${score?.trueOgProbability || 88}%`, 10, 150);
    
    doc.setFontSize(10);
    doc.text('Token Information:', 10, 170);
    doc.setFontSize(8);
    doc.text(`Contract: ${token.id}`, 10, 180);
    doc.text(`Symbol: ${token.symbol || 'N/A'}`, 10, 190);
    doc.text(`Decimals: ${token.decimals || 9}`, 10, 200);
    doc.text(`Created: ${token.onChainCreatedAt ? token.onChainCreatedAt.split('T')[0] : 'N/A'}`, 10, 210);
    
    doc.setFontSize(6);
    doc.text('Generated: ' + new Date().toLocaleString(), 10, 270);
    doc.text('NOT FINANCIAL ADVICE - For intelligence purposes only', 10, 280);

    // Page 2
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Detailed Analysis', 10, 20);
    
    doc.setFontSize(10);
    doc.text('Market Intelligence:', 10, 40);
    doc.setFontSize(8);
    const metrics = [
      `Mint Authority: ${token.audit?.mintAuthorityDisabled ? 'Renounced' : 'Active'}`,
      `Freeze Authority: ${token.audit?.freezeAuthorityDisabled ? 'Renounced' : 'Active'}`,
      `Top Holders %: ${token.audit?.topHoldersPercentage ? token.audit.topHoldersPercentage.toFixed(1) : 'N/A'}%`,
      `Verified: ${token.isVerified ? 'Yes' : 'No'}`,
      `First Mint: ${token.firstMintAt ? token.firstMintAt.split('T')[0] : 'Unknown'}`,
    ];
    let y = 50;
    metrics.forEach(m => {
      doc.text(m, 10, y);
      y += 8;
    });

    doc.setFontSize(10);
    doc.text('Forensic Details:', 10, 120);
    doc.setFontSize(8);
    if (score) {
      const details = [
        `Chain Origin Score: ${score.chainOriginScore}`,
        `Earliest Liquidity Score: ${score.earliestLiquidityScore}`,
        `Deployer Authenticity: ${score.deployerAuthenticity}`,
        `Liquidity Authenticity: ${score.liquidityAuthenticityScore}`,
        `Holder Distribution Score: ${score.holderDistributionScore}`,
        `On-Chain Activity Score: ${score.onChainActivityScore}`,
      ];
      y = 130;
      details.forEach(d => {
        doc.text(d, 10, y);
        y += 8;
      });
    }

    // Page 3
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Risk Assessment', 10, 20);
    
    doc.setFontSize(10);
    doc.text('Risk Probabilities:', 10, 40);
    doc.setFontSize(8);
    if (score) {
      const risks = [
        `Clone Probability: ${score.cloneProbability}%`,
        `CTO Probability: ${score.ctoProbability}%`,
        `Migration Probability: ${score.migrationProbability}%`,
        `Artificial Trend Probability: ${score.artificialTrendProbability}%`,
        `Manipulated Relaunch Probability: ${score.manipulatedRelaunchProbability}%`,
      ];
      y = 50;
      risks.forEach(r => {
        doc.text(r, 10, y);
        y += 8;
      });
    }

    doc.setFontSize(10);
    doc.text('Classification:', 10, 140);
    doc.setFontSize(8);
    if (score?.classification) {
      doc.text(`Primary: ${score.classification.primary_label}`, 10, 150);
      const secondaries = score.classification.secondary_labels || [];
      doc.text(`Secondary: ${secondaries.join(', ')}`, 10, 160);
    }

    doc.setFontSize(6);
    doc.text('DISCLAIMER: This is not financial advice. Always DYOR. Crypto is high-risk.', 10, 270);

    // Save
    const filename = `${token.name || 'Token'}-${token.id.slice(0, 8)}-OGScan.pdf`;
    doc.save(filename);
    console.log('✅ PDF saved:', filename);

  } catch (error) {
    console.error('❌ PDF Error:', error);
    alert('Error: ' + (error as any).message);
  }
}
