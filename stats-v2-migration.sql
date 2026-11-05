-- Private live-analytics v2 (OrbitX /stats) — richer device + location data.
--
-- Adds OS / browser / city / region / timezone / UTM / screen to the views
-- table (and OS / browser / city / region to the live table), and extends
-- site_stats_data() with osBreakdown, browserBreakdown, cities,
-- returningVsNew, topUtm, screens, plus OS/browser/location on live
-- visitors and recent views. All existing fields keep working.
--
-- Privacy: only parsed categories are stored — never raw IPs, never full
-- user-agent strings, never raw user IDs. Rows recorded before this
-- migration show 'unknown' / '' for the new fields.
--
-- Safe to run repeatedly (IF NOT EXISTS / CREATE OR REPLACE everywhere).

ALTER TABLE public.site_stats_views
  ADD COLUMN IF NOT EXISTS os TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS browser TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tz TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS utm_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS screen TEXT NOT NULL DEFAULT '';

ALTER TABLE public.site_stats_live
  ADD COLUMN IF NOT EXISTS os TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS browser TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT '';

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
        'city', l.city,
        'region', l.region,
        'os', l.os,
        'browser', l.browser,
        'device', COALESCE((SELECT device FROM public.site_stats_views WHERE site = p_site AND vid = l.vid ORDER BY ts DESC LIMIT 1), 'desktop'),
        'screen', COALESCE((SELECT screen FROM public.site_stats_views WHERE site = p_site AND vid = l.vid ORDER BY ts DESC LIMIT 1), ''),
        'path', l.path,
        'firstSeen', COALESCE((SELECT MIN(ts) FROM public.site_stats_views WHERE site = p_site AND vid = l.vid AND ts >= v_day_start), l.ts),
        'lastSeen', COALESCE((SELECT MAX(ts) FROM public.site_stats_views WHERE site = p_site AND vid = l.vid AND ts >= v_day_start), l.ts),
        'pageCount', (SELECT count(*) FROM public.site_stats_views WHERE site = p_site AND vid = l.vid AND ts >= v_day_start),
        'trail', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', path, 'ts', ts) ORDER BY ts) FROM (SELECT path, ts FROM public.site_stats_views WHERE site = p_site AND vid = l.vid AND ts >= v_now - 7200000 ORDER BY ts DESC LIMIT 10) t), '[]'::jsonb)
      ) ORDER BY l.ts DESC) FROM public.site_stats_live l WHERE l.site = p_site AND l.ts > v_live_cut), '[]'::jsonb),
    'sessionsToday', (SELECT count(*) FROM sessions),
    'avgSessionSeconds', COALESCE((SELECT ROUND(AVG(last_ts - first_ts) / 1000.0) FROM sessions), 0),
    'avgPagesPerSession', COALESCE((SELECT ROUND(AVG(pages), 1) FROM sessions), 0),
    'returningVsNew', jsonb_build_object(
      'returning', (SELECT count(DISTINCT vid) FROM public.site_stats_views WHERE site = p_site AND ts >= v_day_start AND vid IN (SELECT vid FROM public.site_stats_views WHERE site = p_site AND ts < v_day_start)),
      'new', (SELECT count(DISTINCT vid) FROM public.site_stats_views WHERE site = p_site AND ts >= v_day_start AND vid NOT IN (SELECT vid FROM public.site_stats_views WHERE site = p_site AND ts < v_day_start))
    ),
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
    'cities', COALESCE((SELECT jsonb_agg(jsonb_build_object('city', city, 'country', country, 'n', n) ORDER BY n DESC) FROM (SELECT city, country, count(DISTINCT vid) AS n FROM public.site_stats_views WHERE site = p_site AND city <> '' GROUP BY city, country ORDER BY n DESC LIMIT 12) s), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_agg(jsonb_build_object('device', device, 'n', n) ORDER BY n DESC) FROM (SELECT device, count(DISTINCT vid) AS n FROM public.site_stats_views WHERE site = p_site GROUP BY device ORDER BY n DESC) s), '[]'::jsonb),
    'osBreakdown', COALESCE((SELECT jsonb_agg(jsonb_build_object('os', os, 'n', n) ORDER BY n DESC) FROM (SELECT os, count(DISTINCT vid) AS n FROM public.site_stats_views WHERE site = p_site GROUP BY os ORDER BY n DESC) s), '[]'::jsonb),
    'browserBreakdown', COALESCE((SELECT jsonb_agg(jsonb_build_object('browser', browser, 'n', n) ORDER BY n DESC) FROM (SELECT browser, count(DISTINCT vid) AS n FROM public.site_stats_views WHERE site = p_site GROUP BY browser ORDER BY n DESC) s), '[]'::jsonb),
    'screens', COALESCE((SELECT jsonb_agg(jsonb_build_object('screen', screen, 'n', n) ORDER BY n DESC) FROM (SELECT screen, count(DISTINCT vid) AS n FROM public.site_stats_views WHERE site = p_site AND screen <> '' GROUP BY screen ORDER BY n DESC LIMIT 10) s), '[]'::jsonb),
    'topUtm', COALESCE((SELECT jsonb_agg(jsonb_build_object('utm_source', utm_source, 'n', n) ORDER BY n DESC) FROM (SELECT utm_source, count(*) AS n FROM public.site_stats_views WHERE site = p_site AND utm_source <> '' GROUP BY utm_source ORDER BY n DESC LIMIT 10) s), '[]'::jsonb),
    'referrers', COALESCE((SELECT jsonb_agg(jsonb_build_object('ref', ref, 'n', n) ORDER BY n DESC) FROM (SELECT CASE WHEN ref = '' THEN 'Direct' ELSE ref END AS ref, count(*) AS n FROM public.site_stats_views WHERE site = p_site GROUP BY ref ORDER BY n DESC LIMIT 10) s), '[]'::jsonb),
    'recent', COALESCE((SELECT jsonb_agg(jsonb_build_object('ts', ts, 'vid', LEFT(vid, 8), 'path', path, 'country', country, 'city', city, 'device', device, 'os', os, 'browser', browser) ORDER BY ts DESC) FROM (SELECT ts, vid, path, country, city, device, os, browser FROM public.site_stats_views WHERE site = p_site ORDER BY ts DESC LIMIT 15) s), '[]'::jsonb)
  ) INTO v_out;

  RETURN v_out;
END;
$$;
