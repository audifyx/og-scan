
// FILE: web/src/routes/api-intelligence.ts
// API endpoints for advanced intelligence data export

import { Router } from 'express';
import { supabase } from '@/lib/supabase';
import { predictTokenPrice, assessRugRisk } from '@/lib/ml-models';

const router = Router();

/**
 * GET /api/intelligence/:mint/holders
 * Export holder data with PnL
 */
router.get('/:mint/holders', async (req, res) => {
  try {
    const { mint } = req.params;
    const { limit = 100, offset = 0, sortBy = 'balance_usd' } = req.query;

    const { data, error } = await supabase
      .from('holder_snapshots')
      .select('*')
      .eq('mint_address', mint)
      .order(String(sortBy), { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit));

    if (error) throw error;

    res.json({
      success: true,
      data,
      count: data?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/intelligence/:mint/traders
 * Export top traders leaderboard
 */
router.get('/:mint/traders', async (req, res) => {
  try {
    const { mint } = req.params;
    const { limit = 100 } = req.query;

    const { data, error } = await supabase
      .from('transactions_extended')
      .select('*')
      .eq('mint_address', mint)
      .eq('direction', 'sell')
      .order('profit_loss_usd', { ascending: false })
      .limit(Number(limit) * 2);

    if (error) throw error;

    // Aggregate by trader
    const traderMap = new Map();
    for (const tx of data || []) {
      if (!tx.seller_address) continue;
      if (!traderMap.has(tx.seller_address)) {
        traderMap.set(tx.seller_address, {
          wallet: tx.seller_address,
          trades: [],
          totalPnL: 0,
        });
      }
      const trader = traderMap.get(tx.seller_address);
      trader.trades.push(tx);
      trader.totalPnL += tx.profit_loss_usd || 0;
    }

    const traders = Array.from(traderMap.values())
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .slice(0, limit)
      .map(t => ({
        wallet: t.wallet,
        totalPnL: t.totalPnL,
        tradeCount: t.trades.length,
        winRate: (t.trades.filter((tx: any) => tx.profit_loss_usd > 0).length / t.trades.length) * 100,
      }));

    res.json({
      success: true,
      data: traders,
      count: traders.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/intelligence/:mint/prediction
 * Get ML price prediction
 */
router.get('/:mint/prediction', async (req, res) => {
  try {
    const { mint } = req.params;
    const prediction = await predictTokenPrice(mint);

    if (!prediction) {
      return res.status(404).json({ success: false, error: 'Not enough data' });
    }

    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/intelligence/:mint/rug-risk
 * Get rug pull risk assessment
 */
router.get('/:mint/rug-risk', async (req, res) => {
  try {
    const { mint } = req.params;
    const rugRisk = await assessRugRisk(mint);

    if (!rugRisk) {
      return res.status(404).json({ success: false, error: 'Not enough data' });
    }

    res.json({ success: true, data: rugRisk });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/intelligence/:mint/anomalies
 * Get recent anomalies
 */
router.get('/:mint/anomalies', async (req, res) => {
  try {
    const { mint } = req.params;
    const { limit = 50, severity } = req.query;

    let query = supabase
      .from('real_time_alerts')
      .select('*')
      .eq('mint_address', mint);

    if (severity) {
      query = query.eq('severity', String(severity));
    }

    const { data, error } = await query
      .order('triggered_timestamp', { ascending: false })
      .limit(Number(limit));

    if (error) throw error;

    res.json({ success: true, data, count: data?.length || 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * GET /api/intelligence/:mint/export
 * Export all data as JSON
 */
router.get('/:mint/export', async (req, res) => {
  try {
    const { mint } = req.params;
    const { format = 'json' } = req.query;

    const [holders, traders, anomalies, prediction, rugRisk] = await Promise.all([
      supabase.from('holder_snapshots').select('*').eq('mint_address', mint),
      supabase.from('transactions_extended').select('*').eq('mint_address', mint),
      supabase.from('real_time_alerts').select('*').eq('mint_address', mint),
      predictTokenPrice(mint),
      assessRugRisk(mint),
    ]);

    const exportData = {
      mint,
      timestamp: new Date().toISOString(),
      holders: holders.data,
      transactions: traders.data,
      anomalies: anomalies.data,
      predictions: prediction,
      rugRisk,
    };

    if (format === 'csv') {
      // Convert to CSV
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="intelligence.csv"');
      // CSV conversion logic here
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="intelligence.json"');
    }

    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
