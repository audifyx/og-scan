-- Persist first observed live-desk bank so the UI can show started vs now.
alter table public.ox_live_desk
  add column if not exists starting_sol numeric,
  add column if not exists starting_usd numeric,
  add column if not exists starting_captured_at timestamptz;
