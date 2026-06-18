import { Token } from '@/lib/og';
import { OgClassification } from '@/lib/classification';
import { generateOgScanReport, ReportData } from './generateOgScanReport';

export interface PdfReportInput {
  token: Token;
  score?: any;
  report?: any;
  holders?: any[];
  transactions?: any[];
  anomalies?: any[];
  whaleRisk?: any;
  predictions?: any;
  rugRisk?: any;
}

export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  try {
    console.log('📄 Generating PDF from page data...');
    
    const reportData: ReportData = {
      token: input.token,
      score: input.score,
      report: input.report,
      holders: input.holders,
      transactions: input.transactions,
      anomalies: input.anomalies,
      whaleRisk: input.whaleRisk,
      predictions: input.predictions,
      rugRisk: input.rugRisk
    };

    const pdfBlob = await generateOgScanReport(reportData);

    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${input.token.name}-${input.token.mint.slice(0, 8)}-OGScan.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('✅ PDF downloaded from page data');
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error generating report');
  }
}
