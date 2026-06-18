
// FILE: web/src/pages/IntelligenceAdmin.tsx
// Admin panel for managing advanced intelligence system

import React, { useState } from 'react';
import { Zap, RefreshCw, Database, BarChart3, Settings } from 'lucide-react';
import { populateTokenData } from '@/lib/helius-integration';
import { scheduler } from '@/jobs/data-refresh-scheduler';
import { supabase } from '@/lib/supabase';

export default function IntelligenceAdmin() {
  const [loading, setLoading] = useState(false);
  const [tokenMint, setTokenMint] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [jobsRunning, setJobsRunning] = useState(false);

  const handlePopulateData = async () => {
    setLoading(true);
    try {
      const result = await populateTokenData(tokenMint);
      setStatus({
        type: 'success',
        message: `✅ Populated ${result.transactionCount} transactions, ${result.snapshotCount} snapshots`,
      });
    } catch (error) {
      setStatus({ type: 'error', message: `❌ Error: ${String(error)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleStartJobs = () => {
    setJobsRunning(true);
    scheduler.initializeAll();
    setStatus({
      type: 'success',
      message: 'All scheduled jobs started',
    });
  };

  const handleClearOldData = async () => {
    setLoading(true);
    try {
      const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000);
      await supabase
        .from('price_candles_extended')
        .delete()
        .lt('created_at', new Date(ninetyDaysAgo * 1000).toISOString());

      setStatus({
        type: 'success',
        message: '✅ Old data cleared successfully',
      });
    } catch (error) {
      setStatus({ type: 'error', message: \`❌ Error: \${String(error)}\` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="h-8 w-8 text-og-cyan" />
          <h1 className="text-3xl font-black">Advanced Intelligence Admin</h1>
        </div>

        {status && (
          <div className={\`p-4 rounded-lg mb-6 \${
            status.type === 'success'
              ? 'bg-og-lime/10 border border-og-lime/30 text-og-lime'
              : 'bg-og-red/10 border border-og-red/30 text-og-red'
          }\`}>
            {status.message}
          </div>
        )}

        {/* Data Population */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-6 w-6 text-og-cyan" />
            <h2 className="text-xl font-bold">Data Population</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2">Token Mint</label>
              <input
                type="text"
                value={tokenMint}
                onChange={(e) => setTokenMint(e.target.value)}
                placeholder="Enter token mint address"
                className="w-full px-4 py-2 rounded-lg bg-foreground/10 border border-border"
              />
            </div>

            <button
              onClick={handlePopulateData}
              disabled={loading || !tokenMint}
              className="w-full px-4 py-3 bg-og-cyan text-black rounded-lg font-bold hover:bg-og-cyan/80 disabled:opacity-50"
            >
              {loading ? 'Populating...' : 'Populate Token Data'}
            </button>

            <p className="text-sm text-foreground/60">
              Fetches all transactions, holders, and calculates PnL for the token
            </p>
          </div>
        </div>

        {/* Scheduled Jobs */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <RefreshCw className="h-6 w-6 text-og-gold" />
            <h2 className="text-xl font-bold">Scheduled Jobs</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-foreground/60">Hourly Jobs</p>
                <p className="font-bold">Holder Snapshots</p>
              </div>
              <div>
                <p className="text-foreground/60">Every 6 Hours</p>
                <p className="font-bold">Transaction Sync</p>
              </div>
            </div>

            <button
              onClick={handleStartJobs}
              disabled={jobsRunning}
              className="w-full px-4 py-3 bg-og-gold text-black rounded-lg font-bold hover:bg-og-gold/80 disabled:opacity-50"
            >
              {jobsRunning ? 'Jobs Running' : 'Start All Jobs'}
            </button>
          </div>
        </div>

        {/* Database Maintenance */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="h-6 w-6 text-og-red" />
            <h2 className="text-xl font-bold">Maintenance</h2>
          </div>

          <button
            onClick={handleClearOldData}
            disabled={loading}
            className="w-full px-4 py-3 bg-og-red/20 text-og-red border border-og-red/30 rounded-lg font-bold hover:bg-og-red/30"
          >
            Clear Data Older Than 90 Days
          </button>
        </div>
      </div>
    </div>
  );
}
