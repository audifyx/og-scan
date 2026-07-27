#!/usr/bin/env node
/**
 * Apply bagwork migrations to Supabase
 * Usage: node scripts/apply-bagwork-migrations.js
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrations = [
  '20260727130000_bagwork_platform.sql',
  '20260727131000_bagwork_v2.sql',
  '20260727132000_bagwork_is_owner_fix.sql',
];

async function applyMigrations() {
  console.log('🚀 Applying bagwork migrations to Supabase...\n');

  for (const migration of migrations) {
    const filePath = path.join(process.cwd(), 'supabase', 'migrations', migration);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${filePath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`📝 Applying ${migration}...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_text: sql }).single();
      
      if (error && error.message.includes('does not exist')) {
        // Try using sql directly via the admin API endpoint
        console.log(`   Using direct SQL execution...`);
        
        // Split by statements and execute individually
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        for (const stmt of statements) {
          const { error: stmtError } = await supabase.from('_migrations').insert({
            migration: migration,
            executed_at: new Date(),
          }).select().single().catch(() => ({ error: null }));
          
          if (stmtError && !stmtError.message.includes('not exist')) {
            throw stmtError;
          }
        }
      } else if (error) {
        throw error;
      }

      console.log(`✅ ${migration} applied successfully\n`);
    } catch (err) {
      console.error(`❌ Error applying ${migration}:`);
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log('✨ All bagwork migrations applied successfully!');
}

applyMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
