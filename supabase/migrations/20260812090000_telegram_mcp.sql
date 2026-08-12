-- Telegram MCP: dashboard-auth bridge flags (Agent + X)
alter table public.telegram_bots
  add column if not exists mcp_agent_enabled boolean not null default false,
  add column if not exists mcp_x_enabled boolean not null default false;

comment on column public.telegram_bots.mcp_agent_enabled is
  'When true, Telegram bot exposes Agent MCP /cmds (no auth tools, no trading); auth = dashboard owner.';
comment on column public.telegram_bots.mcp_x_enabled is
  'When true, Telegram bot exposes X MCP image/video only; Claude/ChatGPT/Grok stay on /x.';
