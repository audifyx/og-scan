-- Per-bot AI model selection. NULL = use platform default.
alter table public.telegram_bots
  add column if not exists ai_model text;
