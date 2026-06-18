// FILE: web/src/lib/reportPdf.ts
// PDF Report Generator - WORKING VERSION

import jsPDF from 'jspdf';
import { Token } from '@/lib/og';
import { OgClassification } from '@/lib/classification';
import { generateRealReport } from './real-reportPdf';

export interface PdfReportInput {
  token: Token;
  score?: OgClassification;
  report?: string;
}

/**
 * Download comprehensive PDF report
 */
export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  const { token } = input;

  try {
    console.log('📄 Generating comprehensive PDF report...');
    
    const doc = await generateRealReport(token);

    // Download
    const filename = `${token.name}-${token.mint.slice(0, 8)}-OGScan.pdf`;
    doc.save(filename);
    console.log('✅ PDF saved:', filename);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

/**
 * Generate PDF for preview
 */
export async function generateTokenReportPdf(token: Token): Promise<jsPDF> {
  return await generateRealReport(token);
}
