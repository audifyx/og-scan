# KOL Tracker — Setup & Architecture

New Hub app: **KOL Tracker** (`/app/kol-tracker`). Tracks buys/sells of KOL wallets
or any custom wallet list and sends Telegram alerts through a user-branded bot.

## Components
- **UI**: `web/src/pages/KOLTracker.tsx` (Hub card + route + BottomNav wired)
- **Client data layer**: `web/src/lib/kol-tracker.ts` (Supabase + localStorage hybrid)
- **API routes** (Vercel, `web/api/kol/`):
  - `GET  /api/kol/transactions?wallet=` — parsed buy/sell events via Helius
  - `POST /api/kol/chat-id` — resolve Telegram chat_id via getUpdates (server-side)
  - `POST /api/kol/send-alert` — Telegram alert dispatcher (+ kol_alert_log)
  - `POST /api/kol/bot-setup` — verify token, apply setMyName/setMyDescription
  - `POST /api/kol/webhook` — **Helius webhook receiver** (real-time detection)
  - `GET/POST /api/kol/sync-webhook` — register tracked wallets on the Helius webhook
- **Edge function** (optional alternative dispatcher): `supabase/functions/send-kol-alert`
  - Deploy: `supabase functions deploy send-kol-alert --no-verify-jwt`
- **Migration**: `supabase/migrations/20260705022500_kol_tracker.sql`

## Required environment (Vercel project)
| Var | Purpose | Status |
|---|---|---|
| `HELIUS_SECRET` | Helius API key (txs + webhook management) | added by user |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side config lookup for 24/7 webhook alerts + alert log | **must be added** |
| `SUPABASE_URL` | defaults to ffjipnkhcebjvttliptb.supabase.co if unset | optional |
| `HELIUS_WEBHOOK_SECRET` | optional shared secret; also set as authHeader on the Helius webhook | optional |

## Setup checklist
1. Apply the migration in the Supabase SQL editor (or `supabase db push`).
2. Point the Helius webhook URL at `https://www.ogscan.fun/api/kol/webhook` (type: enhanced).
3. Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel env (Production).
4. In the app: add wallets -> "Sync Wallets" (pushes addresses to the Helius webhook).
5. Bot setup: paste token from @BotFather, message the bot once, "Fetch" chat id, "Send Test Alert".

## Security notes
- `bot_token` is write-only from the client: column-level GRANTs exclude it from
  SELECT for `authenticated`; the client never reads it back. Server-side code reads
  it via the service role only.
- Detection has two paths: real-time Helius webhook (server, preferred) and in-app
  polling fallback (works before the migration/service key are configured; caps at
  20 wallets per tick).
- Bot profile photos cannot be set via the Bot API (BotFather-only); the uploaded
  image is attached to every alert instead.
