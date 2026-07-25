-- OMEGA hardening: oxw_record_trade must not return another user's trade by signature.
create or replace function public.oxw_record_trade(
  p_wallet text,
  p_side text,
  p_input_mint text,
  p_output_mint text,
  p_input_amount numeric,
  p_output_amount numeric,
  p_signature text,
  p_venue text default 'jupiter',
  p_price_usd numeric default null,
  p_value_usd numeric default null,
  p_meta jsonb default '{}'::jsonb
)
returns public.oxw_trade_history
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.oxw_trade_history;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  if p_signature is not null and length(trim(p_signature)) > 0 then
    select * into row from public.oxw_trade_history where signature = p_signature;
    if row.id is not null then
      if row.user_id <> uid then
        raise exception 'trade signature already recorded for another user';
      end if;
      return row;
    end if;
  end if;

  insert into public.oxw_trade_history (
    user_id, wallet, side, input_mint, output_mint, input_amount, output_amount,
    signature, venue, price_usd, value_usd, meta, status
  ) values (
    uid, p_wallet, p_side, p_input_mint, p_output_mint, p_input_amount, p_output_amount,
    p_signature, coalesce(p_venue, 'jupiter'), p_price_usd, p_value_usd, coalesce(p_meta, '{}'::jsonb), 'confirmed'
  )
  returning * into row;

  return row;
end;
$$;

grant execute on function public.oxw_record_trade(text, text, text, text, numeric, numeric, text, text, numeric, numeric, jsonb) to authenticated, service_role;
