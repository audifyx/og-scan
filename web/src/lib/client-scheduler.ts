// FILE: web/src/lib/client-scheduler.ts
// Client-side scheduler for data refresh and updates

import { supabase } from '@/lib/supabase';
import { calculateAndStoreHolderSnapshots, populateTokenData } from '@/lib/helius-integration';

class ClientScheduler {
  private intervals: { [key: string]: NodeJS.Timeout } = {};

  /**
   * Start hourly holder snapshot updates
   */
  startHourlyHolderUpdates() {
    if (this.intervals['hourly']) return;

    this.intervals['hourly'] = setInterval(async () => {
      console.log('[SCHEDULER] Running hourly holder updates...');
      try {
        const { data: tokens } = await supabase
          .from('tokens')
          .select('mint')
          .limit(10);

        for (const token of tokens || []) {
          try {
            await calculateAndStoreHolderSnapshots(token.mint);
            console.log(`✅ Updated snapshots for ${token.mint}`);
          } catch (error) {
            console.error(`Error updating ${token.mint}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in hourly updates:', error);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Start transaction updates (every 6 hours)
   */
  startTransactionUpdates() {
    if (this.intervals['transactions']) return;

    this.intervals['transactions'] = setInterval(async () => {
      console.log('[SCHEDULER] Running transaction data update...');
      try {
        const { data: tokens } = await supabase
          .from('tokens')
          .select('mint')
          .limit(5);

        for (const token of tokens || []) {
          try {
            await populateTokenData(token.mint);
            console.log(`✅ Updated transactions for ${token.mint}`);
          } catch (error) {
            console.error(`Error updating ${token.mint}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in transaction updates:', error);
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours
  }

  /**
   * Start anomaly resolution (every minute)
   */
  startAnomalyResolution() {
    if (this.intervals['anomaly']) return;

    this.intervals['anomaly'] = setInterval(async () => {
      try {
        const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

        await supabase
          .from('real_time_alerts')
          .update({ is_resolved: true })
          .lt('triggered_at', oneHourAgo)
          .eq('is_resolved', false);
      } catch (error) {
        console.error('Error resolving anomalies:', error);
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Initialize all schedulers
   */
  initializeAll() {
    console.log('[SCHEDULER] Initializing all scheduled jobs...');
    this.startHourlyHolderUpdates();
    this.startTransactionUpdates();
    this.startAnomalyResolution();
    console.log('✅ All schedulers initialized');
  }

  /**
   * Stop all schedulers
   */
  stopAll() {
    Object.values(this.intervals).forEach(interval => clearInterval(interval));
    this.intervals = {};
    console.log('✅ All schedulers stopped');
  }
}

export const clientScheduler = new ClientScheduler();
