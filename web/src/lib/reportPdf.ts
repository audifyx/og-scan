import { Token } from '@/lib/og';
import { OgClassification } from '@/lib/classification';
import { generateOgScanReport } from './generateOgScanReport';

export interface PdfReportInput {
  token: Token;
  score?: OgClassification;
  report?: string;
}

export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  const { token } = input;

  try {
    console.log('📄 Scanning blockchain and generating OG Scan PDF...');
    
    const pdfBlob = await generateOgScanReport(token);

    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${token.name}-${token.mint.slice(0, 8)}-OGScan.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('✅ PDF Report downloaded:', link.download);
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error generating report. Try again!');
  }
}
