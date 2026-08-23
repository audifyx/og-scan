-- Additive columns for Launchpad V2 cards, campaign counters, and admin rules.
alter table public.ox_lp_launches add column if not exists image_url text;
alter table public.ox_lp_launches add column if not exists website text;
alter table public.ox_lp_launches add column if not exists twitter text;
alter table public.ox_lp_launches add column if not exists telegram text;

alter table public.ox_lp_campaigns add column if not exists required_url text;
alter table public.ox_lp_campaigns add column if not exists posts_count int not null default 0;
alter table public.ox_lp_campaigns add column if not exists participants_count int not null default 0;

alter table public.ox_lp_balances add column if not exists lifetime_usd numeric not null default 0;
alter table public.ox_lp_balances add column if not exists lifetime_posts int not null default 0;

alter table public.ox_lp_bagworking_rules add column if not exists min_short_chars int not null default 20;
alter table public.ox_lp_bagworking_rules add column if not exists require_url boolean not null default false;
alter table public.ox_lp_bagworking_rules add column if not exists fee_threshold_usd numeric not null default 25;

alter table public.ox_lp_abuse_flags add column if not exists status text not null default 'open';
alter table public.ox_lp_abuse_flags add column if not exists detail jsonb not null default '{}'::jsonb;
