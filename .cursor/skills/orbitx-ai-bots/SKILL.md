---
name: orbitx-ai-bots
description: Use when building or modifying AI features (per-coin chat, intelligence functions, streaming, model selection, vibe-code HTML generation) or bot integrations (Telegram webhooks, Discord interactions, X/Twitter posting) in this repo. Covers the NVIDIA-first provider fallback chain, grounding answers in live on-chain data, SSE streaming, multi-tenant bot webhooks, and the MCP agent API.
---

# OrbitX AI Functions & Bots

All AI runs server-side in Supabase Edge Functions. The house pattern: **ground the model in freshly-fetched on-chain JSON, use an OpenAI-compatible provider chain with NVIDIA first, and degrade gracefully to deterministic text** if every provider fails.

## Provider chain & models

- Primary: **NVIDIA-hosted models** via OpenAI-compatible `chat/completions` (`NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `NVIDIA_MODEL`).
- Fallback order in `ogdex-chat`: NVIDIA → Groq → Gemini → OpenRouter → deterministic on-chain snapshot text (never a hard failure).
- Model catalog for bots: `supabase/functions/_shared/models.ts` — `BOT_MODELS`, `DEFAULT_MODEL = "meta/llama-3.3-70b-instruct"`, fast slot `meta/llama-3.2-3b-instruct` (Llama 3.1 8B reached NVIDIA EOL 2026-08-26). Always run user-requested models through `resolveModel()`.
- Persona: `_shared/grim_base.ts` exports `GRIM_BASE` (base64-decoded Grim persona/methodology), prefixed into `enhanced-intelligence` system prompts. New shared personas/prompts go in `_shared/`.
- Code generation uses `qwen/qwen3-coder-480b-a35b-instruct` (see `vibe-code`).

## The four reference AI functions

| Function | Pattern to copy |
|---|---|
| `supabase/functions/ogdex-chat` | Per-coin Q&A. Context (token + forensics + ATH) is assembled by the caller (`web/api/ogdex/_routes/chat.js` via `callFn`), plus DuckDuckGo HTML search. Non-streaming `{ok, answer, sources, provider}`. Timed `tfetch` on every upstream |
| `supabase/functions/unified-intelligence` | **Tool-calling loop**: NVIDIA function-tools (`lookupToken`, `getHolderData`, `getContractAnalysis`, ...) reading Supabase tables with service role; max 5 tool iterations then a final text call. Returns `{content, model, toolsUsed}` |
| `supabase/functions/enhanced-intelligence` | Production Grim for bots. Prefetches DexScreener/Helius/Rugcheck/news, injects `GRIM_BASE` + live data, supports **SSE streaming** (`stream: true` → `text/event-stream`, meta event then deltas) |
| `supabase/functions/vibe-code` | Streaming codegen worker: generates HTML, uploads to Storage `reports/vibe/{uuid}.html`, delivers link via Telegram. Triggered from `telegram-webhook` with `EdgeRuntime.waitUntil` |

Rules: stream only when the consumer needs it (Telegram live-edit, vibe-code); web/API consumers get plain JSON. Ground every answer — fetch the on-chain data *before* the model call and put real numbers in the prompt; never let the model invent stats.

## Frontend access

Browsers call AI functions through the same-origin proxy `/ai-fn/<fn>` (Vercel rewrite to Supabase, dodges ad blockers) with `Authorization: Bearer <session token>` + `apikey: <anon key>` headers — see `web/src/pages/AlphaChat.tsx`. `supabase.functions.invoke` is the fallback style.

## Telegram bots

- Production is **multi-tenant**: `supabase/functions/telegram-webhook` (deploy `--no-verify-jwt`). Webhook URL carries `?bot=<uuid>`; the row in `telegram_bots` holds the token + `webhook_secret`, validated against the `X-Telegram-Bot-Api-Secret-Token` header → 403 on mismatch. (`telegram-bot` is the legacy single-bot function.)
- **Always return 200 "ok"** even on errors — Telegram retry storms otherwise. ACK fast, do heavy work in `EdgeRuntime.waitUntil`.
- Group etiquette: only respond when @mentioned or replying to the bot.
- Commands + free-chat route to `enhanced-intelligence` (streaming, message-edit updates); `/vibecodeanything` → `vibe-code`; scans/migrations have dedicated handlers.

## Discord

`supabase/functions/discord-interactions`: verify **Ed25519** signature from `X-Signature-Ed25519` + `X-Signature-Timestamp` + raw body before parsing. Multi-tenant: resolve `application_id` → `discord_bots.public_key`, falling back to env `DISCORD_PUBLIC_KEY`/`DISCORD_APP_ID`. PING → PONG; slash commands ACK with deferred type 5, then `waitUntil` + PATCH the original message. `/chat` → `enhanced-intelligence`, `/migrations` → `pumpfun-migrations`.

## X / Twitter

`supabase/functions/x-poster`: user-JWT actions (`connect`/`status`/`settings`/`test`/`disconnect`) manage per-user OAuth 1.0a creds in `x_accounts`; service-role `action: "post"` for automations. Signing is manual OAuth 1.0a HMAC-SHA1; tweets via API v2, media via v1.1 upload.

## MCP agent API

- Working endpoint: `web/api/mcp.js` → **`GET/POST /api/mcp`**. GET returns the tool manifest (`schema_version`, `tools[]` with JSON Schema `inputSchema`); POST `{tool, params}` validates then fans out to internal `/api/ogdex/*` routes, returning `{ok, tool, result}`.
- Tools: `ogdex_get_token`, `ogdex_screen_tokens`, `ogdex_get_forensics`, `ogdex_get_ath`, `ogdex_get_wallet`, `ogdex_get_chart`, `ogdex_get_kols`, `ogdex_search`.
- Known gap: `web/api/ogdex/_routes/mcp.js` exists but was never registered in the `ROUTES` map in `web/api/ogdex.js`, so the README's `/api/ogdex/mcp` 404s. If you touch MCP, either register it or keep docs pointing at `/api/mcp`.
- New MCP tools: add to the manifest + the `ROUTE_MAP` in `web/api/mcp.js`, backed by an ogdex route.
