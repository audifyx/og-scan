// Quick script to check Supabase tables
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  console.log('Checking Supabase tables...\n');

  const tables = [
    'holder_snapshots',
    'transactions_extended',
    'real_time_alerts',
    'price_candles_extended',
    'wallet_profiles_extended',
    'liquidity_pools_extended',
    'alert_rules',
    'user_alert_configs',
    'wallet_clusters',
    'dex_paid_campaigns',
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count} records`);
      }
    } catch (error) {
      console.log(`⚠️ ${table}: Error - ${error.message}`);
    }
  }
}

checkTables().catch(console.error);
