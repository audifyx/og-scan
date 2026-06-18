// FILE: web/src/lib/reportPdf.ts
// Download interactive HTML report (replaces PDF)

import { Token } from '@/lib/og';
import { OgClassification } from '@/lib/classification';
import { generateHtmlReport } from './generateHtmlReport';

export interface PdfReportInput {
  token: Token;
  score?: OgClassification;
  report?: string;
}

/**
 * Download HTML report (beautiful interactive version)
 */
export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  const { token } = input;

  try {
    console.log('🔍 Scanning blockchain and generating report...');
    
    // Generate HTML with all blockchain data
    const html = await generateHtmlReport(token);

    // Download as HTML file
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
    console.error('❌ Error generating report:', error);
    // Show error to user
    alert('Error generating report. Check console for details.');
    throw error;
  }
}

/**
 * Open HTML report in new tab
 */
export async function openReportInNewTab(token: Token): Promise<void> {
  try {
    console.log('🌐 Opening report in new tab...');
    
    const html = await generateHtmlReport(token);
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    console.log('✅ Report opened in new tab');
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error opening report. Check console for details.');
    throw error;
  }
}
