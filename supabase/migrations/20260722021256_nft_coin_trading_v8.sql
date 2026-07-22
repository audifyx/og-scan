-- OrbitX v8 — tradeable NFT meme-coin market (DB-tracked bonding curve).
-- Every NFT can auto-launch a coin market; buy/sell run a constant-product
-- curve on virtual reserves, accruing pump.fun-style creator fees (0.50%).
alter table public.orbitx_nft_coin_markets add column if not exists virtual_sol    numeric not null default 30;
alter table public.orbitx_nft_coin_markets add column if not exists virtual_tokens numeric not null default 1000000000;

create table if not exists public.orbitx_nft_coin_holdings (
  nft_id uuid not null references public.orbitx_nfts(id) on delete cascade,
  wallet text not null,
  tokens numeric not null default 0,
  primary key (nft_id, wallet)
);
alter table public.orbitx_nft_coin_holdings enable row level security;
drop policy if exists orbitx_nft_coin_holdings_read on public.orbitx_nft_coin_holdings;
create policy orbitx_nft_coin_holdings_read on public.orbitx_nft_coin_holdings for select using (true);

-- Enable (auto-launch) a coin market for an NFT — creator only.
create or replace function public.orbitx_nft_enable_coin(p_nft_id uuid, p_wallet text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_creator text; v_mint text;
begin
  select creator_wallet, mint_address into v_creator, v_mint from public.orbitx_nfts where id = p_nft_id;
  if v_creator is null then raise exception 'nft not found'; end if;
  if v_creator is distinct from p_wallet then raise exception 'only the creator can enable a coin market'; end if;
  insert into public.orbitx_nft_coin_markets (nft_id, mint_address, creator_wallet, enabled, last_price_sol, market_cap_sol)
  values (p_nft_id, coalesce(v_mint,''), v_creator, true,
          (30::numeric / 1000000000::numeric), (30::numeric))
  on conflict (nft_id) do update set enabled = true;
  return true;
end $$;

-- Buy (p_side='buy', p_amount = SOL in) / Sell (p_side='sell', p_amount = tokens in).
create or replace function public.orbitx_nft_coin_trade(p_nft_id uuid, p_wallet text, p_side text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m public.orbitx_nft_coin_markets%rowtype;
  x numeric; y numeric; k numeric; new_x numeric; new_y numeric;
  tokens_out numeric; sol_gross numeric; fee_total numeric; creator_fee numeric; platform_fee numeric; net numeric;
  held numeric;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select * into m from public.orbitx_nft_coin_markets where nft_id = p_nft_id for update;
  if not found or not m.enabled then raise exception 'no coin market for this NFT'; end if;
  if m.graduated then raise exception 'market graduated'; end if;

  x := m.virtual_sol + m.sol_reserves;
  y := m.virtual_tokens - m.curve_supply;
  k := x * y;

  if p_side = 'buy' then
    fee_total := p_amount * 0.01; creator_fee := p_amount * 0.005; platform_fee := p_amount * 0.005;
    net := p_amount - fee_total;
    new_x := x + net; new_y := k / new_x; tokens_out := y - new_y;
    update public.orbitx_nft_coin_markets set
      sol_reserves = sol_reserves + net, curve_supply = curve_supply + tokens_out,
      last_price_sol = new_x / new_y, market_cap_sol = (new_x / new_y) * virtual_tokens
      where nft_id = p_nft_id;
    insert into public.orbitx_nft_coin_holdings (nft_id, wallet, tokens) values (p_nft_id, p_wallet, tokens_out)
      on conflict (nft_id, wallet) do update set tokens = orbitx_nft_coin_holdings.tokens + tokens_out;
    insert into public.orbitx_nft_coin_trades (nft_id, trader_wallet, side, sol_amount, token_amount, price_sol, creator_fee_sol, platform_fee_sol)
      values (p_nft_id, p_wallet, 'buy', p_amount, tokens_out, new_x / new_y, creator_fee, platform_fee);
    insert into public.orbitx_nft_creator_fee_ledger (creator_wallet, nft_id, kind, amount_sol) values (m.creator_wallet, p_nft_id, 'accrual', creator_fee);
    return jsonb_build_object('ok', true, 'side','buy','tokens', tokens_out, 'price', new_x/new_y, 'market_cap', (new_x/new_y)*m.virtual_tokens);

  elsif p_side = 'sell' then
    select tokens into held from public.orbitx_nft_coin_holdings where nft_id = p_nft_id and wallet = p_wallet;
    if held is null or held < p_amount then raise exception 'insufficient token balance'; end if;
    new_y := y + p_amount; new_x := k / new_y; sol_gross := x - new_x;
    fee_total := sol_gross * 0.01; creator_fee := sol_gross * 0.005; platform_fee := sol_gross * 0.005;
    net := sol_gross - fee_total;
    update public.orbitx_nft_coin_markets set
      sol_reserves = greatest(0, sol_reserves - sol_gross), curve_supply = greatest(0, curve_supply - p_amount),
      last_price_sol = new_x / new_y, market_cap_sol = (new_x / new_y) * virtual_tokens
      where nft_id = p_nft_id;
    update public.orbitx_nft_coin_holdings set tokens = tokens - p_amount where nft_id = p_nft_id and wallet = p_wallet;
    insert into public.orbitx_nft_coin_trades (nft_id, trader_wallet, side, sol_amount, token_amount, price_sol, creator_fee_sol, platform_fee_sol)
      values (p_nft_id, p_wallet, 'sell', net, p_amount, new_x / new_y, creator_fee, platform_fee);
    insert into public.orbitx_nft_creator_fee_ledger (creator_wallet, nft_id, kind, amount_sol) values (m.creator_wallet, p_nft_id, 'accrual', creator_fee);
    return jsonb_build_object('ok', true, 'side','sell','sol', net, 'price', new_x/new_y, 'market_cap', (new_x/new_y)*m.virtual_tokens);
  else
    raise exception 'invalid side';
  end if;
end $$;

grant execute on function public.orbitx_nft_enable_coin(uuid, text) to anon, authenticated;
grant execute on function public.orbitx_nft_coin_trade(uuid, text, text, numeric) to anon, authenticated;
