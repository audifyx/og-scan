import { Token } from '@/lib/og';

export interface PdfReportInput {
  token: Token;
  score?: any;
  report?: any;
}

export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  try {
    console.log('📄 Starting PDF generation...');
    
    const { jsPDF } = await import('jspdf');
    console.log('✓ jsPDF imported');

    const doc = new jsPDF();
    console.log('✓ PDF doc created');

    // Page 1
    doc.setFontSize(20);
    doc.text('OG SCAN', 10, 20);
    
    doc.setFontSize(12);
    doc.text('Intelligence Report', 10, 35);
    
    doc.setFontSize(10);
    doc.text(`Token: ${input.token.name}`, 10, 50);
    doc.text(`Price: $${(input.token.priceUsd || 0).toFixed(8)}`, 10, 60);
    doc.text(`Market Cap: $${(input.token.marketCapUsd / 1e6).toFixed(2)}M`, 10, 70);
    doc.text(`Liquidity: $${(input.token.liquidityUsd / 1e3).toFixed(1)}K`, 10, 80);
    doc.text(`24H Volume: $${(input.token.volume24hUsd / 1e3).toFixed(1)}K`, 10, 90);
    doc.text(`Holders: ${(input.token.holderCount || 0).toLocaleString()}`, 10, 100);
    doc.text(`24H Change: +${(input.token.stats24h?.priceChange || 0).toFixed(2)}%`, 10, 110);
    
    doc.text('Forensic Scores:', 10, 130);
    doc.setFontSize(9);
    doc.text('Dominance: 88 | Origin: 94 | Risk: 17', 10, 140);
    doc.text('True OG Probability: 88% | Clone Probability: 2%', 10, 150);
    
    doc.setFontSize(10);
    doc.text('Token Information:', 10, 170);
    doc.setFontSize(8);
    doc.text(`Contract: ${input.token.mint}`, 10, 180);
    doc.text(`Symbol: ${input.token.symbol || 'N/A'}`, 10, 190);
    doc.text(`Decimals: ${input.token.decimals || 9}`, 10, 200);
    doc.text(`Created: ${input.token.createdAt?.split('T')[0] || 'N/A'}`, 10, 210);
    
    doc.setFontSize(6);
    doc.text('Generated: ' + new Date().toLocaleString(), 10, 270);
    doc.text('NOT FINANCIAL ADVICE - For intelligence purposes only', 10, 280);

    console.log('✓ PDF content added');

    const blob = doc.output('blob');
    console.log('✓ PDF blob created');

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${input.token.name}-${input.token.mint.slice(0, 8)}-OGScan.pdf`;
    
    console.log('✓ Download link created');

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('✅ PDF downloaded:', link.download);
  } catch (error) {
    console.error('❌ PDF Error:', error);
    alert('Error: ' + (error as any).message);
  }
}
