-- Grim's track record: price updater RPC + public stats RPC + win flag.
alter table public.scan_log add column if not exists win_posted boolean not null default false;

-- Apply a batch of current prices to scan_log rows, updating peak multiples.
create or replace function public.apply_scan_prices(updates jsonb)
returns void language sql security definer as $$
  update public.scan_log s set
    last_price_usd  = nullif((u->>'price'),'')::double precision,
    last_market_cap = nullif((u->>'mcap'),'')::double precision,
    peak_market_cap = greatest(coalesce(s.peak_market_cap, s.market_cap, 0), coalesce(nullif((u->>'mcap'),'')::double precision, 0)),
    peak_multiple   = case when coalesce(s.market_cap,0) > 0
                        then greatest(coalesce(s.peak_multiple, 1), coalesce(nullif((u->>'mcap'),'')::double precision,0) / s.market_cap)
                        else s.peak_multiple end,
    last_checked_at = now()
  from jsonb_array_elements(updates) as u
  where s.mint = (u->>'mint') and s.created_at > now() - interval '45 days';
$$;

-- Public headline stats for the track-record page.
create or replace function public.grim_track_record_stats()
returns json language sql stable as $$
  with base as (
    select * from public.scan_log
    where peak_multiple is not null and coalesce(market_cap,0) >= 5000
  )
  select json_build_object(
    'total_scans', (select count(*) from public.scan_log),
    'tracked',     (select count(*) from base),
    'overall',     (select json_build_object('avg_peak', round(coalesce(avg(peak_multiple),0)::numeric,2),
                       'win_rate_2x', round(coalesce(100.0*avg((peak_multiple>=2)::int),0)::numeric,1),
                       'count', count(*)) from base),
    'high_score',  (select json_build_object('avg_peak', round(coalesce(avg(peak_multiple),0)::numeric,2),
                       'win_rate_2x', round(coalesce(100.0*avg((peak_multiple>=2)::int),0)::numeric,1),
                       'count', count(*)) from base where og_score >= 80),
    'best',        (select coalesce(json_agg(b),'[]'::json) from (
                       select symbol, name, mint, og_score, market_cap, peak_market_cap,
                         round(peak_multiple::numeric,1) as mult, created_at
                       from base order by peak_multiple desc nulls last limit 25) b)
  );
$$;
grant execute on function public.grim_track_record_stats() to anon, authenticated;
