-- Private live-analytics tables + stats function (OrbitX /stats).
--
-- Mirrors the Cloudflare Worker spec (views + live tables, TZ=-5 "today",
-- 45s live window) on Postgres/Supabase. One pair of tables serves all
-- sites; every query is scoped by `site` (same sanitization as the worker:
-- lowercase, [^a-z0-9-] stripped, max 40 chars, default "default").
-- SITE_ID for OrbitX is "orbitx".
--
-- ADVANCED (2026-11-04): the function also returns live visitor trails
-- (what each live visitor is doing, with timestamps), session stats
-- (30-min inactivity gap), hourly views for the last 24h, and entry/exit
-- pages. Visitor IDs stay anonymous random UUIDs; the dashboard shows
-- only the first 8 chars of a vid. No PII, no cookies.
--
-- Safe to run repeatedly (IF NOT EXISTS / CREATE OR REPLACE everywhere).
-- RLS is enabled with NO policies: only the service-role key (used by the
-- server-side web/api/_stats.js module) can read/write; anon gets nothing.
-- PostgREST picks up new tables/functions automatically (schema reload on DDL).

CREATE TABLE IF NOT EXISTS public.site_stats_views (
  ts BIGINT NOT NULL,
  site TEXT NOT NULL,
  vid TEXT NOT NULL,
  path TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '??',
  device TEXT NOT NULL DEFAULT 'desktop'
);

CREATE INDEX IF NOT EXISTS site_stats_views_site_ts_idx
  ON public.site_stats_views (site, ts);

CREATE INDEX IF NOT EXISTS site_stats_views_site_vid_ts_idx
  ON public.site_stats_views (site, vid, ts DESC);

CREATE TABLE IF NOT EXISTS public.site_stats_live (
  site TEXT NOT NULL,
  vid TEXT NOT NULL,
  ts BIGINT NOT NULL,
  path TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '??',
  PRIMARY KEY (site, vid)
);

ALTER TABLE public.site_stats_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_stats_live ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.site_stats_data(p_site TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now BIGINT := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  v_tz BIGINT := -18000000;
  v_day_start BIGINT := ((v_now + v_tz) / 86400000) * 86400000 - v_tz;
  v_live_cut BIGINT := v_now - 45000;
  v_out JSONB;
BEGIN
  DELETE FROM public.site_stats_live WHERE site = p_site AND ts < v_now - 3600000;

  WITH
  today_views AS (
    SELECT vid, ts, path
    FROM public.site_stats_views
    WHERE site = p_site AND ts >= v_day_start
  ),
  flagged AS (
    SELECT vid, ts, path,
      CASE WHEN prev_ts IS NULL OR ts - prev_ts > 1800000 THEN 1 ELSE 0 END AS is_start
    FROM (
      SELECT vid, ts, path, LAG(ts) OVER (PARTITION BY vid ORDER BY ts) AS prev_ts
      FROM today_views
    ) s
  ),
  sessioned AS (
    SELECT vid, ts, path,
      SUM(is_start) OVER (PARTITION BY vid ORDER BY ts ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS sess
    FROM flagged
  ),
  sessions AS (
    SELECT vid, sess,
      MIN(ts) AS first_ts, MAX(ts) AS last_ts, COUNT(*) AS pages,
      (array_agg(path ORDER BY ts ASC))[1] AS entry_path,
      (array_agg(path ORDER BY ts DESC))[1] AS exit_path
    FROM sessioned
    GROUP BY vid, sess
  )
  SELECT jsonb_build_object(
    'asOf', v_now,
    'liveNow', (SELECT count(*) FROM public.site_stats_live WHERE site = p_site AND ts > v_live_cut),
    'livePages', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', path, 'n', n) ORDER BY n DESC) FROM (SELECT path, count(*) AS n FROM public.site_stats_live WHERE site = p_site AND ts > v_live_cut GROUP BY path) s), '[]'::jsonb),
    'liveVisitors', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'vid', LEFT(l.vid, 8),
        'country', l.country,
        'device', COALESCE((SELECT device FROM public.site_stats_views WHERE site = p_site AND vid = l.vid ORDER BY ts DESC LIMIT 1), 'desktop'),
        'path', l.path,
        'firstSeen', COALESCE((SELECT MIN(ts) FROM public.site_stats_views WHERE site = p_site AND vid = l.vid AND ts >= v_day_start), l.ts),
        'lastSeen', COALESCE((SELECT MAX(ts) FROM public.site_stats_views WHERE site = p_site AND vid = l.vid AND ts >= v_day_start), l.ts),
        'pageCount', (SELECT count(*) FROM public.site_stats_views WHERE site = p_site AND vid = l.vid AND ts >= v_day_start),
        'trail', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', path, 'ts', ts) ORDER BY ts) FROM (SELECT path, ts FROM public.site_stats_views WHERE site = p_site AND vid = l.vid AND ts >= v_now - 7200000 ORDER BY ts DESC LIMIT 10) t), '[]'::jsonb)
      ) ORDER BY l.ts DESC) FROM public.site_stats_live l WHERE l.site = p_site AND l.ts > v_live_cut), '[]'::jsonb),
    'sessionsToday', (SELECT count(*) FROM sessions),
    'avgSessionSeconds', COALESCE((SELECT ROUND(AVG(last_ts - first_ts) / 1000.0) FROM sessions), 0),
    'avgPagesPerSession', COALESCE((SELECT ROUND(AVG(pages), 1) FROM sessions), 0),
    'topEntryPages', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', entry_path, 'n', n) ORDER BY n DESC) FROM (SELECT entry_path, count(*) AS n FROM sessions GROUP BY entry_path ORDER BY n DESC LIMIT 10) s), '[]'::jsonb),
    'topExitPages', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', exit_path, 'n', n) ORDER BY n DESC) FROM (SELECT exit_path, count(*) AS n FROM sessions GROUP BY exit_path ORDER BY n DESC LIMIT 10) s), '[]'::jsonb),
    'hourly24', COALESCE((SELECT jsonb_agg(jsonb_build_object('label', label, 'views', v) ORDER BY b) FROM (
      SELECT g.b AS b, to_char(timestamp 'epoch' + g.b * 3600000 * interval '1 millisecond', 'MM-DD HH24:00') AS label, COALESCE(c.v, 0) AS v
      FROM generate_series((v_now + v_tz) / 3600000 - 23, (v_now + v_tz) / 3600000) AS g(b)
      LEFT JOIN (SELECT (ts + v_tz) / 3600000 AS b, count(*) AS v FROM public.site_stats_views WHERE site = p_site AND ts >= v_now - 86400000 GROUP BY b) c ON c.b = g.b
    ) s), '[]'::jsonb),
    'totalViews', (SELECT count(*) FROM public.site_stats_views WHERE site = p_site),
    'uniqueVisitors', (SELECT count(DISTINCT vid) FROM public.site_stats_views WHERE site = p_site),
    'viewsToday', (SELECT count(*) FROM public.site_stats_views WHERE site = p_site AND ts >= v_day_start),
    'visitorsToday', (SELECT count(DISTINCT vid) FROM public.site_stats_views WHERE site = p_site AND ts >= v_day_start),
    'views24h', (SELECT count(*) FROM public.site_stats_views WHERE site = p_site AND ts >= v_now - 86400000),
    'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('day', to_char(timestamp 'epoch' + d * 86400000 * interval '1 millisecond', 'YYYY-MM-DD'), 'views', v, 'visitors', u) ORDER BY d) FROM (SELECT (ts + v_tz) / 86400000 AS d, count(*) AS v, count(DISTINCT vid) AS u FROM public.site_stats_views WHERE site = p_site AND ts >= v_day_start - 13 * 86400000 GROUP BY d) s), '[]'::jsonb),
    'topPages', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', path, 'n', n) ORDER BY n DESC) FROM (SELECT path, count(*) AS n FROM public.site_stats_views WHERE site = p_site GROUP BY path ORDER BY n DESC LIMIT 12) s), '[]'::jsonb),
    'countries', COALESCE((SELECT jsonb_agg(jsonb_build_object('country', country, 'n', n) ORDER BY n DESC) FROM (SELECT country, count(DISTINCT vid) AS n FROM public.site_stats_views WHERE site = p_site GROUP BY country ORDER BY n DESC LIMIT 12) s), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_agg(jsonb_build_object('device', device, 'n', n) ORDER BY n DESC) FROM (SELECT device, count(DISTINCT vid) AS n FROM public.site_stats_views WHERE site = p_site GROUP BY device ORDER BY n DESC) s), '[]'::jsonb),
    'referrers', COALESCE((SELECT jsonb_agg(jsonb_build_object('ref', ref, 'n', n) ORDER BY n DESC) FROM (SELECT CASE WHEN ref = '' THEN 'Direct' ELSE ref END AS ref, count(*) AS n FROM public.site_stats_views WHERE site = p_site GROUP BY ref ORDER BY n DESC LIMIT 10) s), '[]'::jsonb),
    'recent', COALESCE((SELECT jsonb_agg(jsonb_build_object('ts', ts, 'vid', LEFT(vid, 8), 'path', path, 'country', country, 'device', device) ORDER BY ts DESC) FROM (SELECT ts, vid, path, country, device FROM public.site_stats_views WHERE site = p_site ORDER BY ts DESC LIMIT 15) s), '[]'::jsonb)
  ) INTO v_out;

  RETURN v_out;
END;
$$;
