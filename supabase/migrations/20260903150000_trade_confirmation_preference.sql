-- First-buy preference for the embedded agent trade workflow.
-- NULL means the agent has not selected a default yet.

alter table public.agent_settings
  add column if not exists trade_confirmation_preference text;

alter table public.agent_settings
  drop constraint if exists agent_settings_trade_confirmation_preference_check;

alter table public.agent_settings
  add constraint agent_settings_trade_confirmation_preference_check
  check (trade_confirmation_preference is null or trade_confirmation_preference in ('auto', 'sign'));

comment on column public.agent_settings.trade_confirmation_preference is
  'Per-agent default for trade chat confirmation: auto skips the second chat prompt but still opens the non-custodial wallet signer; sign requires a fresh review each time.';
