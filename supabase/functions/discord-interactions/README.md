# discord-interactions

Two-way Discord slash commands for Grim (`/chat`, `/migrations`). The existing
`discord-connect` integration only pushes one-way alerts via a channel webhook;
this function adds an interactive bot.

## Commands
- `/chat message:<text>` — ask Grim anything (routes to `enhanced-intelligence`)
- `/migrations` — pump.fun graduations in the last 24h

## One-time setup
1. Create an application at https://discord.com/developers/applications
2. Copy **Application ID** and **Public Key** (General Information).
3. Reset/copy the **Bot Token** (Bot tab).
4. Set Supabase secrets:
   ```bash
   supabase secrets set DISCORD_PUBLIC_KEY=... DISCORD_APP_ID=...
   ```
5. Deploy the function (no JWT — Discord signs requests itself):
   ```bash
   supabase functions deploy discord-interactions --no-verify-jwt
   ```
6. In the Discord portal, set **Interactions Endpoint URL** to:
   `https://<project-ref>.supabase.co/functions/v1/discord-interactions`
   Discord sends a signed PING; the function verifies it and replies PONG.
7. Register the slash commands once:
   ```bash
   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... deno run -A register-commands.ts
   ```
8. Invite the bot with the `applications.commands` scope.

## How replies work
Grim can take longer than Discord's 3s limit, so the function ACKs with a
**deferred** response (type 5), then edits the original message via the
interaction token once Grim answers. The background edit is kept alive with
`EdgeRuntime.waitUntil`.
