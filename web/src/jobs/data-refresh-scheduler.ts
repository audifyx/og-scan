
// FILE: web/src/jobs/data-refresh-scheduler.ts
// Scheduled jobs for data refresh and analysis

import cron from 'node-cron';
import { supabase } from '@/lib/supabase';
import { populateTokenData } from '@/lib/helius-integration';
import { calculateAndStoreHolderSnapshots } from '@/lib/helius-integration';
import { realtimeFeeds } from '@/lib/realtime-feeds';

class DataRefreshScheduler {
  /**
   * Run every hour: Update holder snapshots
   */
  scheduleHourlyHolderUpdate() {
    cron.schedule('0 * * * *', async () => {
      console.log('[SCHEDULER] Running hourly holder snapshot update...');
      try {
        // Get all tracked tokens
        const { data: tokens } = await supabase
          .from('tokens')
          .select('mint')
          .limit(100);

        for (const token of tokens || []) {
          try {
            await calculateAndStoreHolderSnapshots(token.mint);
            console.log(`✅ Updated snapshots for ${token.mint}`);
          } catch (error) {
            console.error(`Error updating ${token.mint}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in hourly holder update:', error);
      }
    });
  }

  /**
   * Run every 6 hours: Fetch new transaction data
   */
  scheduleTransactionUpdate() {
    cron.schedule('0 */6 * * *', async () => {
      console.log('[SCHEDULER] Running transaction data update...');
      try {
        const { data: tokens } = await supabase
          .from('tokens')
          .select('mint')
          .limit(50);

        for (const token of tokens || []) {
          try {
            await populateTokenData(token.mint);
            console.log(`✅ Updated transactions for ${token.mint}`);
          } catch (error) {
            console.error(`Error updating ${token.mint}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in transaction update:', error);
      }
    });
  }

  /**
   * Run every minute: Check and resolve old anomalies
   */
  scheduleAnomalyResolution() {
    cron.schedule('* * * * *', async () => {
      try {
        // Mark anomalies as resolved if they're >1 hour old
        const oneHourAgo = Math.floor((Date.now() - 3600000) / 1000);
        
        await supabase
          .from('real_time_alerts')
          .update({ is_resolved: true })
          .lt('triggered_timestamp', oneHourAgo)
          .eq('is_resolved', false);
      } catch (error) {
        console.error('Error resolving anomalies:', error);
      }
    });
  }

  /**
   * Run daily: Clean up old data
   */
  scheduleDataCleanup() {
    cron.schedule('0 2 * * *', async () => {
      console.log('[SCHEDULER] Running data cleanup...');
      try {
        // Delete price candles older than 90 days
        const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000);
        
        await supabase
          .from('price_candles_extended')
          .delete()
          .lt('created_at', new Date(ninetyDaysAgo * 1000).toISOString());

        console.log('✅ Old data cleaned up');
      } catch (error) {
        console.error('Error cleaning data:', error);
      }
    });
  }

  /**
   * Initialize all schedulers
   */
  initializeAll() {
    console.log('[SCHEDULER] Initializing all scheduled jobs...');
    this.scheduleHourlyHolderUpdate();
    this.scheduleTransactionUpdate();
    this.scheduleAnomalyResolution();
    this.scheduleDataCleanup();
    console.log('✅ All schedulers initialized');
  }
}

export const scheduler = new DataRefreshScheduler();
