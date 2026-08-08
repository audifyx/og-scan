-- OrbitX X MCP: server-authoritative prepaid usage credits
-- 1 credit = $0.01 USD. Values are stored as microcredits to preserve fractions.
create extension if not exists pgcrypto;

create table if not exists public.user_credit_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  free_credits bigint not null default 100000000 check (free_credits >= 0),
  purchased_credits bigint not null default 0 check (purchased_credits >= 0),
  used_credits bigint not null default 0 check (used_credits >= 0),
  balance bigint generated always as (free_credits + purchased_credits) stored,
  lifetime_purchased bigint not null default 0 check (lifetime_purchased >= 0),
  lifetime_used bigint not null default 0 check (lifetime_used >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.credit_packages (
  id uuid primary key default gen_random_uuid(), name text not null, usd_value numeric(12,6) not null check (usd_value > 0),
  credits bigint not null check (credits > 0), active boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.mcp_action_costs (
  id uuid primary key default gen_random_uuid(), action text not null, provider text not null default 'orbitx', model text,
  cost_usd numeric(12,6) not null check (cost_usd >= 0), cost_microcredits bigint generated always as (round(cost_usd * 100000000)) stored,
  active boolean not null default true, updated_at timestamptz not null default now(), unique(action, provider, model)
);

create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null, package_id uuid not null references public.credit_packages(id), expected_usd numeric(12,6) not null,
  expected_sol numeric(24,9) not null, received_sol numeric(24,9), transaction_signature text unique,
  status text not null default 'pending' check (status in ('pending','submitted','confirmed','failed','expired')),
  created_at timestamptz not null default now(), confirmed_at timestamptz
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('free_grant','purchase','reserve','charge','refund','manual_adjustment')),
  action text, credits bigint not null, usd_value numeric(12,8) not null, balance_before bigint not null, balance_after bigint not null,
  status text not null check (status in ('reserved','completed','refunded','failed')), request_id text unique,
  purchase_id uuid references public.credit_purchases(id), transaction_signature text, provider text, model text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists credit_transactions_user_created_idx on public.credit_transactions(user_id, created_at desc);
create index if not exists credit_transactions_action_idx on public.credit_transactions(action, created_at desc);

insert into public.credit_packages(name, usd_value, credits, sort_order) values
 ('Starter', .50, 50000000, 1), ('Small', 1, 100000000, 2), ('Growth', 5, 500000000, 3), ('Pro', 10, 1000000000, 4), ('Large', 20, 2000000000, 5), ('Power', 50, 5000000000, 6)
on conflict do nothing;
insert into public.mcp_action_costs(action, provider, cost_usd) values
 ('x_post','x',.01), ('x_post_link','x',.20), ('x_dm','x',.015), ('x_read','x',.005), ('text_generation','orbitx',.01), ('image_generation','orbitx',.014), ('video_generation','orbitx',.12)
on conflict (action, provider, model) do nothing;

create or replace function public.credit_reserve(p_user_id uuid, p_request_id text, p_action text, p_provider text default null, p_model text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.user_credit_balances; c public.mcp_action_costs; r public.credit_transactions; spend bigint; free_spend bigint; purchased_spend bigint;
begin
 insert into public.user_credit_balances(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select * into b from public.user_credit_balances where user_id=p_user_id for update;
 select * into c from public.mcp_action_costs where action=p_action and provider=coalesce(p_provider,provider) and (model=p_model or (p_model is null and model is null)) and active limit 1;
 if not found then raise exception 'credit_action_unavailable'; end if;
 select * into r from public.credit_transactions where request_id=p_request_id limit 1;
 if found then return jsonb_build_object('idempotent',true,'status',r.status,'credits',r.credits,'balance',b.balance); end if;
 if b.balance < c.cost_microcredits then raise exception 'insufficient_credits'; end if;
 spend := c.cost_microcredits; free_spend := least(b.free_credits, spend); purchased_spend := spend-free_spend;
 update public.user_credit_balances set free_credits=free_credits-free_spend,purchased_credits=purchased_credits-purchased_spend,updated_at=now() where user_id=p_user_id;
 insert into public.credit_transactions(user_id,type,action,credits,usd_value,balance_before,balance_after,status,request_id,provider,model)
 values(p_user_id,'reserve',p_action,-spend,(-spend::numeric/100000000)*.01,b.balance,b.balance-spend,'reserved',p_request_id,p_provider,p_model) returning * into r;
 return jsonb_build_object('idempotent',false,'transaction_id',r.id,'credits',spend,'balance',r.balance_after);
end $$;

create or replace function public.credit_settle(p_request_id text, p_success boolean, p_metadata jsonb default '{}') returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.credit_transactions; b public.user_credit_balances; nr public.credit_transactions; delta bigint;
begin
 select * into r from public.credit_transactions where request_id=p_request_id for update;
 if not found then raise exception 'credit_reservation_not_found'; end if;
 if r.status <> 'reserved' then return jsonb_build_object('idempotent',true,'status',r.status,'credits',r.credits); end if;
 select * into b from public.user_credit_balances where user_id=r.user_id for update;
 if p_success then update public.credit_transactions set status='completed',metadata=p_metadata where id=r.id; update public.user_credit_balances set used_credits=used_credits+abs(r.credits),lifetime_used=lifetime_used+abs(r.credits),updated_at=now() where user_id=r.user_id; return jsonb_build_object('status','completed','used',abs(r.credits),'balance',b.balance);
 else delta:=abs(r.credits); update public.user_credit_balances set free_credits=free_credits+least(delta,100000000),purchased_credits=purchased_credits+greatest(0,delta-100000000),updated_at=now() where user_id=r.user_id; update public.credit_transactions set status='refunded',metadata=p_metadata where id=r.id; return jsonb_build_object('status','refunded','refunded',delta,'balance',b.balance+delta); end if;
end $$;

create or replace function public.credit_apply_purchase(p_purchase_id uuid,p_signature text,p_received_sol numeric) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.credit_purchases; b public.user_credit_balances; pkg public.credit_packages;
begin
 select * into p from public.credit_purchases where id=p_purchase_id for update; if not found then raise exception 'purchase_not_found'; end if;
 if p.status='confirmed' then return jsonb_build_object('idempotent',true,'status','confirmed'); end if;
 if exists(select 1 from public.credit_purchases where transaction_signature=p_signature) then raise exception 'signature_already_credited'; end if;
 select * into pkg from public.credit_packages where id=p.package_id; update public.credit_purchases set status='confirmed',transaction_signature=p_signature,received_sol=p_received_sol,confirmed_at=now() where id=p.id;
 insert into public.user_credit_balances(user_id) values(p.user_id) on conflict(user_id) do nothing;
 select * into b from public.user_credit_balances where user_id=p.user_id for update;
 update public.user_credit_balances set purchased_credits=purchased_credits+pkg.credits,lifetime_purchased=lifetime_purchased+pkg.credits,updated_at=now() where user_id=p.user_id;
 insert into public.credit_transactions(user_id,type,credits,usd_value,balance_before,balance_after,status,purchase_id,transaction_signature) values(p.user_id,'purchase',pkg.credits,p.expected_usd,b.balance,b.balance+pkg.credits,'completed',p.id,p_signature);
 return jsonb_build_object('status','confirmed','credits',pkg.credits,'balance',b.balance+pkg.credits);
end $$;

create table if not exists public.credit_admin_audit (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users(id), target_user_id uuid references auth.users(id), action text not null, credits bigint not null, reason text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists credit_admin_audit_target_idx on public.credit_admin_audit(target_user_id, created_at desc);

alter table public.user_credit_balances enable row level security; alter table public.credit_transactions enable row level security; alter table public.credit_purchases enable row level security; alter table public.credit_admin_audit enable row level security;
create policy credit_balances_own on public.user_credit_balances for select using (auth.uid()=user_id);
create policy credit_transactions_own on public.credit_transactions for select using (auth.uid()=user_id);
create policy credit_purchases_own on public.credit_purchases for select using (auth.uid()=user_id);
