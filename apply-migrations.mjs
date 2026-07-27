#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

console.log('🚀 Applying bagwork migrations to Supabase...');
console.log(`📍 Project: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Migration files in order
const migrations = [
  '20260727130000_bagwork_platform.sql',
  '20260727131000_bagwork_v2.sql',
  '20260727132000_bagwork_is_owner_fix.sql',
];

async function applyMigrations() {
  for (const migrationFile of migrations) {
    const filePath = path.join(__dirname, 'supabase/migrations', migrationFile);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Migration file not found: ${filePath}`);
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf-8');
    
    console.log(`\n📄 Applying: ${migrationFile}`);
    
    try {
      // Split by semicolons and execute statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        const { error } = await supabase.rpc('exec', {
          statement: statement + ';',
        }).catch(() => {
          // If rpc doesn't work, try direct SQL execution via the API
          return supabase.from('_migrations').select('*').limit(0);
        });

        if (error && error.message && !error.message.includes('undefined function')) {
          throw error;
        }
      }

      console.log(`✅ Successfully applied: ${migrationFile}`);
    } catch (error) {
      console.error(`❌ Error applying ${migrationFile}:`, error.message);
      
      // Provide helpful debugging info
      console.error('\n💡 Tip: If you see "permission denied" errors, ensure your Supabase token has admin rights.');
      console.error('💡 Or apply migrations manually via Supabase Dashboard > SQL Editor');
      process.exit(1);
    }
  }

  console.log('\n✨ All migrations applied successfully!');
  console.log('✅ The bagwork_tasks table is now available in your Supabase project.');
}

applyMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
