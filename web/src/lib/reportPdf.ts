// FILE: web/src/lib/reportPdf.ts
// Download OG Scan themed interactive HTML report

import { Token } from '@/lib/og';
import { OgClassification } from '@/lib/classification';
import { generateOgScanReport } from './generateOgScanReport';

export interface PdfReportInput {
  token: Token;
  score?: OgClassification;
  report?: string;
}

/**
 * Download OG Scan themed HTML report with images & banners
 */
export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  const { token } = input;

  try {
    console.log('🔍 Scanning blockchain and generating OG Scan report...');
    
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

    console.log('✅ Report downloaded:', link.download);
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error generating report. Try again!');
  }
}

/**
 * Open in new tab
 */
export async function openReportInNewTab(token: Token): Promise<void> {
  try {
    const html = await generateOgScanReport(token);
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (error) {
    console.error('Error:', error);
    alert('Error opening report!');
  }
}
