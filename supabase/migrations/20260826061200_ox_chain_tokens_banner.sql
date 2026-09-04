-- Official token banner/header. Never invented; filled from DexScreener/profiles.
alter table public.ox_chain_tokens
  add column if not exists banner text;

comment on column public.ox_chain_tokens.banner is
  'Official token banner/header from DexScreener or profiles. Never invented.';
