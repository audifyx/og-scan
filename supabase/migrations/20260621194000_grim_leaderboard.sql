-- Caller/group leaderboard from realized scan performance.
create or replace function public.grim_leaderboard()
returns json language sql stable as $$
  with scans as (
    select * from public.scan_log
    where peak_multiple is not null and coalesce(market_cap,0) >= 5000
  ),
  grp as (
    select s.chat_id,
      coalesce(max(c.chat_title), 'Group ' || right(s.chat_id, 5)) as title,
      count(*) as calls,
      round(avg(s.peak_multiple)::numeric,2) as avg_peak,
      round(100.0*avg((s.peak_multiple>=2)::int)::numeric,1) as win_rate,
      round(max(s.peak_multiple)::numeric,1) as best
    from scans s
    left join public.telegram_alert_chats c on c.chat_id::text = s.chat_id
    where s.chat_id is not null
    group by s.chat_id
    having count(*) >= 3
  ),
  callers as (
    select s.scanned_by,
      count(*) as calls,
      round(avg(s.peak_multiple)::numeric,2) as avg_peak,
      round(100.0*avg((s.peak_multiple>=2)::int)::numeric,1) as win_rate,
      round(max(s.peak_multiple)::numeric,1) as best
    from scans s where s.scanned_by is not null
    group by s.scanned_by having count(*) >= 3
  )
  select json_build_object(
    'groups',  coalesce((select json_agg(g) from (select title, calls, avg_peak, win_rate, best from grp order by avg_peak desc limit 25) g), '[]'::json),
    'callers', coalesce((select json_agg(x) from (select scanned_by, calls, avg_peak, win_rate, best from callers order by avg_peak desc limit 25) x), '[]'::json)
  );
$$;
grant execute on function public.grim_leaderboard() to anon, authenticated;
