#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL environment variable is required');
  process.exit(1);
}

const apiKey = supabaseServiceKey || supabaseAnonKey;

if (!apiKey) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

console.log('🚀 Applying bagwork migrations to Supabase...');
console.log(`📍 Project URL: ${supabaseUrl}`);

// Migration files in order
const migrations = [
  '20260727130000_bagwork_platform.sql',
  '20260727131000_bagwork_v2.sql',
  '20260727132000_bagwork_is_owner_fix.sql',
];

// Extract host from Supabase URL (e.g., https://PROJECT.supabase.co -> PROJECT.supabase.co)
const projectHost = new URL(supabaseUrl).hostname;

async function executeSQL(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql_exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'apikey': apiKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to execute SQL: ${error.message}`);
  }
}

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
      await executeSQL(sql);
      console.log(`✅ Successfully applied: ${migrationFile}`);
    } catch (error) {
      console.error(`❌ Error applying ${migrationFile}:`);
      console.error(`   ${error.message}`);
      
      console.error('\n💡 Alternative: Apply migrations manually via Supabase Dashboard');
      console.error('   1. Go to https://app.supabase.com');
      console.error('   2. Select project: sbp_4c2a8f6ecf5da31ffa9cede4744424ef03287dc1');
      console.error('   3. Go to SQL Editor');
      console.error('   4. Create a new query and paste each migration file');
      console.error('   5. Execute in order');
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
