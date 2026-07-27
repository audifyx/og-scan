#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SUPABASE_TOKEN = 'sbp_4c2a8f6ecf5da31ffa9cede4744424ef03287dc1';
const PROJECT_ID = 'sbp_4c2a8f6ecf5da31ffa9cede4744424ef03287dc1';

// Migration files in order
const migrations = [
  '20260727130000_bagwork_platform.sql',
  '20260727131000_bagwork_v2.sql',
  '20260727132000_bagwork_is_owner_fix.sql'
];

async function executeSql(sql) {
  const response = await fetch(`https://api.supabase.io/platform/v1/projects/${PROJECT_ID}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  
  return response;
}

async function applyMigrations() {
  try {
    console.log('🔄 Applying bagwork migrations...\n');
    
    for (const migrationFile of migrations) {
      const filepath = join(__dirname, '..', 'supabase', 'migrations', migrationFile);
      const sql = readFileSync(filepath, 'utf-8');
      
      console.log(`📝 Applying ${migrationFile}...`);
      
      const response = await executeSql(sql);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to apply ${migrationFile}:`);
        console.error(`Status: ${response.status}`);
        console.error(`Response: ${errorText}`);
        process.exit(1);
      }
      
      try {
        const data = await response.json();
        console.log(`✅ ${migrationFile} applied successfully\n`);
      } catch {
        console.log(`✅ ${migrationFile} applied successfully\n`);
      }
    }
    
    console.log('🎉 All migrations applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying migrations:', error.message);
    process.exit(1);
  }
}

applyMigrations();
