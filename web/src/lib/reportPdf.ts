import { Token } from '@/lib/og';
import { OgClassification } from '@/lib/classification';

export interface PdfReportInput {
  token: Token;
  score?: OgClassification;
  report?: string;
}

export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  const { token } = input;

  try {
    console.log('🔍 Generating OG Scan report...');
    
    // Try to generate HTML report
    try {
      const { generateOgScanReport } = await import('./generateOgScanReport');
      const html = await generateOgScanReport(token);
      const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${token.name}-${token.mint.slice(0, 8)}-OGScan.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('✅ HTML Report downloaded');
      return;
    } catch (htmlErr) {
      console.warn('⚠️ HTML generation failed, using PDF fallback:', htmlErr);
    }

    // Fallback: Generate advanced PDF
    const jsPDF = (await import('jspdf')).jsPDF;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    // Colors
    const goldColor = [255, 215, 0];
    const blackColor = [26, 26, 26];
    const whiteColor = [255, 255, 255];
    const greenColor = [100, 255, 0];
    const redColor = [255, 68, 68];

    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // Header background
    doc.setFillColor(...goldColor);
    doc.rect(0, 0, pageWidth, 30, 'F');

    // Title
    doc.setTextColor(...blackColor);
    doc.setFontSize(24);
    doc.text('OG SCAN', margin, 18);
    doc.setFontSize(12);
    doc.text('Intelligence Report', margin, 26);

    yPos = 40;

    // Token Info
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 35, 'F');
    
    doc.setTextColor(...blackColor);
    doc.setFontSize(14);
    doc.text(token.name, margin + 5, yPos + 10);
    
    doc.setFontSize(10);
    const priceStr = token.priceUsd ? `$${token.priceUsd.toFixed(8)}` : 'N/A';
    doc.text(`Price: ${priceStr}`, margin + 5, yPos + 20);
    
    const change24h = token.stats24h?.priceChange || 0;
    const changeColor = change24h >= 0 ? greenColor : redColor;
    doc.setTextColor(...changeColor);
    doc.text(`24H: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`, margin + 5, yPos + 28);

    doc.setTextColor(...blackColor);
    doc.text(`Mint: ${token.mint.slice(0, 20)}...`, pageWidth - margin - 70, yPos + 20);

    yPos += 45;

    // Key Metrics
    doc.setFontSize(12);
    doc.setTextColor(...goldColor);
    doc.text('KEY METRICS', margin, yPos);
    yPos += 8;

    doc.setTextColor(...blackColor);
    doc.setFontSize(10);
    
    const metrics = [
      `Market Cap: $${token.marketCapUsd ? (token.marketCapUsd / 1e6).toFixed(2) : 'N/A'}M`,
      `Liquidity: $${token.liquidityUsd ? (token.liquidityUsd / 1e3).toFixed(1) : 'N/A'}K`,
      `Volume 24H: $${token.volume24hUsd ? (token.volume24hUsd / 1e3).toFixed(1) : 'N/A'}K`,
      `Holders: ${token.holderCount || 'N/A'}`,
      `Age: ${token.createdAt ? Math.floor((Date.now() - new Date(token.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 'N/A'} days`,
    ];

    metrics.forEach((metric, idx) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(metric, margin + 5, yPos);
      yPos += 7;
    });

    yPos += 5;

    // Contract Info
    doc.setTextColor(...goldColor);
    doc.setFontSize(12);
    doc.text('CONTRACT INFO', margin, yPos);
    yPos += 8;

    doc.setTextColor(...blackColor);
    doc.setFontSize(10);

    const contractInfo = [
      `Supply: ${token.totalSupply ? `${(token.totalSupply / 1e9).toFixed(2)}B` : 'N/A'}`,
      `Circulating: ${token.circulatingSupply ? `${(token.circulatingSupply / 1e9).toFixed(2)}B` : 'N/A'}`,
      `Decimals: ${token.decimals || 'N/A'}`,
    ];

    contractInfo.forEach((info, idx) => {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(info, margin + 5, yPos);
      yPos += 7;
    });

    yPos += 5;

    // Classification
    if (input.score) {
      doc.setTextColor(...goldColor);
      doc.setFontSize(12);
      doc.text('CLASSIFICATION', margin, yPos);
      yPos += 8;

      doc.setTextColor(...blackColor);
      doc.setFontSize(10);
      doc.text(`Type: ${input.score}`, margin + 5, yPos);
      yPos += 7;
    }

    // Footer
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, pageHeight - 10);
    doc.text('OG SCAN - Blockchain Intelligence', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Download
    doc.save(`${token.name}-${token.mint.slice(0, 8)}-OGScan.pdf`);
    console.log('✅ PDF Report generated');
  } catch (error) {
    console.error('❌ Report generation error:', error);
    alert('Error generating report. Try again!');
  }
}
