// FILE: web/src/lib/reportPdf.ts
// UPDATED to use Ultimate PDF with Advanced Intelligence Data

import jsPDF from 'jspdf';
import { Token } from '@/lib/og';
import { OgClassification } from '@/lib/classification';
import { generateUltimateReport } from './ultimate-reportPdf';
import { supabase } from '@/lib/supabase';
import { analyzeWhaleRisk } from '@/lib/advanced-analytics/holder-analytics';
import { predictTokenPrice, assessRugRisk } from '@/lib/ml-models';

export interface PdfReportInput {
  token: Token;
  score?: OgClassification;
  report?: string;
}

/**
 * Download PDF report with COMPLETE advanced intelligence data
 */
export async function downloadReportPdf(input: PdfReportInput): Promise<void> {
  const { token } = input;

  try {
    console.log('🔄 Generating comprehensive PDF with all advanced intelligence data...');
    
    // Try to use ultimate PDF first (has everything)
    let doc: jsPDF;
    try {
      doc = await generateUltimateReport(token);
    } catch (error) {
      console.warn('Ultimate PDF failed, using enhanced PDF', error);
      const { generateEnhancedTokenReport } = await import('./enhanced-reportPdf');
      doc = await generateEnhancedTokenReport(token);
    }

    // Download the PDF
    const filename = `${token.name}-${token.mint.slice(0, 8)}-OGScan.pdf`;
    doc.save(filename);
    console.log('✅ PDF downloaded:', filename);
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw error;
  }
}

/**
 * Generate and get PDF without downloading (for preview)
 */
export async function generateTokenReportPdf(token: Token): Promise<jsPDF> {
  try {
    return await generateUltimateReport(token);
  } catch (error) {
    console.warn('Falling back to enhanced PDF', error);
    const { generateEnhancedTokenReport } = await import('./enhanced-reportPdf');
    return await generateEnhancedTokenReport(token);
  }
}

/**
 * Generate quick summary with top data
 */
export async function generateQuickSummary(token: Token): Promise<{
  holders: any[];
  whaleRisk: any;
  prediction: any;
  rugRisk: any;
  anomalies: any[];
}> {
  try {
    const [holders, whaleRisk, prediction, rugRisk, anomalies] = await Promise.allSettled([
      supabase
        .from('holder_snapshots')
        .select('*')
        .eq('mint_address', token.mint)
        .order('balance_usd', { ascending: false })
        .limit(20),
      analyzeWhaleRisk(token.mint),
      predictTokenPrice(token.mint),
      assessRugRisk(token.mint),
      supabase
        .from('real_time_alerts')
        .select('*')
        .eq('mint_address', token.mint)
        .order('triggered_timestamp', { ascending: false })
        .limit(10),
    ]);

    return {
      holders: holders.status === 'fulfilled' ? holders.value.data || [] : [],
      whaleRisk: whaleRisk.status === 'fulfilled' ? whaleRisk.value : null,
      prediction: prediction.status === 'fulfilled' ? prediction.value : null,
      rugRisk: rugRisk.status === 'fulfilled' ? rugRisk.value : null,
      anomalies: anomalies.status === 'fulfilled' ? anomalies.value.data || [] : [],
    };
  } catch (error) {
    console.error('Error generating quick summary:', error);
    return {
      holders: [],
      whaleRisk: null,
      prediction: null,
      rugRisk: null,
      anomalies: [],
    };
  }
}
