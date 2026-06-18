import { Token } from '@/lib/og';
import { generateOgScanReport } from './generateOgScanReport';
import { fetchCompleteTokenData } from './fetchCompleteTokenData';

export interface PdfReportInput {
  token: Token;
  score?: any;
  report?: any;
}

export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  try {
    console.log('📄 Fetching complete token data & generating PDF...');
    
    // Fetch ALL comprehensive data
    const completeData = await fetchCompleteTokenData(input.token);

    const pdfBlob = await generateOgScanReport({
      token: input.token,
      score: input.score,
      report: input.report,
      ...completeData,
    });

    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${input.token.name}-${input.token.mint.slice(0, 8)}-OGScan.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('✅ PDF with complete data downloaded');
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error generating report');
  }
}
