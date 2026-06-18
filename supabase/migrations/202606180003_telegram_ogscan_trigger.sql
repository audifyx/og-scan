-- Announce high-signal OG Scan verdicts to the Telegram community.
-- Reuses the existing notify_telegram_announcer() webhook function; the
-- telegram-announcer edge function filters to OG_TOKEN / DANGEROUS_TOKEN.
drop trigger if exists tg_telegram_ogi_scan_log on public.ogi_scan_log;
create trigger tg_telegram_ogi_scan_log
  after insert on public.ogi_scan_log
  for each row execute function notify_telegram_announcer();
