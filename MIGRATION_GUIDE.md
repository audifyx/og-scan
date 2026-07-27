# Bagwork Platform Migrations

This guide explains how to apply the bagwork platform migrations to your Supabase project.

## Prerequisites

- Supabase project ID: `sbp_4c2a8f6ecf5da31ffa9cede4744424ef03287dc1`
- Environment variables set:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

## Migrations to Apply

There are 3 migrations that must be applied **in order**:

### 1. `20260727130000_bagwork_platform.sql` (Main Setup)
Creates the core bagwork tables:
- `bagwork_tasks` - Task definitions with rewards
- `bagwork_submissions` - User submissions for tasks
- `bagwork_payouts` - Payout ledger
- Sets up Row Level Security (RLS) policies
- Creates storage bucket for proof uploads

### 2. `20260727131000_bagwork_v2.sql` (Enhanced Features)
Adds new columns to tasks:
- `category`, `difficulty`, `slots`, `deadline_at`, `tags`
- Creates `bagwork_payouts` table
- Inserts seed tasks

### 3. `20260727132000_bagwork_is_owner_fix.sql` (Security Fix)
Updates the `bagwork_is_owner()` function to properly check admin status via `auth.users` table.

## Apply via Supabase Dashboard

1. Go to https://app.supabase.com/projects
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of `supabase/migrations/20260727130000_bagwork_platform.sql`
6. Click **Run** and wait for success
7. Repeat steps 4-6 for the other two migration files in order

## Apply via CLI (if available)

```bash
npx supabase link --project-ref sbp_4c2a8f6ecf5da31ffa9cede4744424ef03287dc1
npx supabase db push
```

## Verify Success

After applying all migrations, check that:

1. ✅ `bagwork_tasks` table exists with ~4 seed tasks
2. ✅ `bagwork_submissions` table exists
3. ✅ `bagwork_payouts` table exists
4. ✅ RLS policies are enabled
5. ✅ `bagwork-proofs` storage bucket exists

You can verify in the Supabase dashboard:
- **Table Editor** → Look for `bagwork_*` tables
- **Storage** → Look for `bagwork-proofs` bucket
