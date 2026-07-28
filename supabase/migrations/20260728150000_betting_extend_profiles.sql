-- Extend og-scan profiles for OrbitX Prediction Markets (solana-betting).
-- Safe to run when betting 001_init profiles block was skipped (table already exists).

alter table public.profiles add column if not exists wallet text;
alter table public.profiles add column if not exists twitter text;
alter table public.profiles add column if not exists bio text default '';
alter table public.profiles add column if not exists wins integer not null default 0;
alter table public.profiles add column if not exists losses integer not null default 0;
alter table public.profiles add column if not exists total_wagered_sol numeric(18,9) not null default 0;
alter table public.profiles add column if not exists total_won_sol numeric(18,9) not null default 0;

create unique index if not exists profiles_wallet_unique on public.profiles (wallet) where wallet is not null;
