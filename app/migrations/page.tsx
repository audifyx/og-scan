'use client';

import { useState } from 'react';

const MIGRATIONS = [
  {
    name: 'bagwork_platform',
    description: 'Create main bagwork tables',
    sql: `-- Bagwork — task marketplace
CREATE TABLE IF NOT EXISTS public.bagwork_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  budget DECIMAL,
  category TEXT,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bagwork_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE public.bagwork_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bagwork_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.bagwork_tasks
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.bagwork_tasks
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Enable update for task owners" ON public.bagwork_tasks
  FOR UPDATE USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Enable read access for categories" ON public.bagwork_categories
  FOR SELECT USING (true);`
  },
  {
    name: 'bagwork_v2',
    description: 'Add enhanced features',
    sql: `-- Bagwork v2 — categories and enhancements
ALTER TABLE public.bagwork_tasks 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.bagwork_categories(id);

CREATE INDEX IF NOT EXISTS idx_bagwork_tasks_owner ON public.bagwork_tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_bagwork_tasks_category ON public.bagwork_tasks(category_id);`
  },
  {
    name: 'bagwork_is_owner_fix',
    description: 'Security fix for is_owner',
    sql: `-- Fix bagwork_is_owner
ALTER TABLE public.bagwork_tasks
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN GENERATED ALWAYS AS (auth.uid() = owner_id) STORED;`
  }
];

export default function MigrationsPage() {
  const [host, setHost] = useState('db.ffjipnkhcebjvttliptb.supabase.co');
  const [user, setUser] = useState('postgres');
  const [password, setPassword] = useState('Janescra127!');
  const [database, setDatabase] = useState('postgres');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ [key: string]: string }>({});

  const applyMigration = async (migration: typeof MIGRATIONS[0]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/apply-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host,
          user,
          password,
          database,
          sql: migration.sql,
          name: migration.name
        })
      });

      const data = await response.json();
      setResults(prev => ({
        ...prev,
        [migration.name]: data.success ? '✓ Applied successfully' : `✗ Error: ${data.error}`
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [migration.name]: `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }));
    } finally {
      setLoading(false);
    }
  };

  const applyAll = async () => {
    for (const migration of MIGRATIONS) {
      await applyMigration(migration);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Bagwork Migrations</h1>
        <p className="text-slate-300 mb-8">Apply database migrations to fix the missing bagwork_tasks table</p>

        <div className="bg-slate-800 rounded-lg p-6 mb-8 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">Database Connection</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Host</label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">User</label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">Database</label>
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white mb-4">Migrations</h2>
          
          {MIGRATIONS.map((migration) => (
            <div key={migration.name} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-white">{migration.name}</h3>
                  <p className="text-sm text-slate-400">{migration.description}</p>
                </div>
                {results[migration.name] && (
                  <div className={`text-sm font-medium ${results[migration.name].includes('✓') ? 'text-green-400' : 'text-red-400'}`}>
                    {results[migration.name]}
                  </div>
                )}
              </div>
              <button
                onClick={() => applyMigration(migration)}
                disabled={loading}
                className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded font-medium transition"
              >
                {loading ? 'Applying...' : 'Apply'}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={applyAll}
          disabled={loading}
          className="w-full mt-8 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg font-semibold transition"
        >
          {loading ? 'Applying...' : 'Apply All Migrations'}
        </button>
      </div>
    </div>
  );
}
