alter table public.communities
  add column if not exists weekly_ama_schedule text,
  add column if not exists research_hub_summary text,
  add column if not exists quality_focus text;
