# OG Scan

On-chain intelligence and trading suite for Solana — token scanners, live feeds,
migration & whale tracking, communities/spaces, and an AI analysis agent.

## Structure
- `web/` — Vite + React front end (the ogscan.fun app)
- `supabase/functions/` — Supabase Edge Functions (APIs, AI agent, data sync)
- `api/` — Vercel serverless functions
- `docs/` — internal guides and specs


## Bots (chat with Grim)
- **Telegram** (`telegram-connect` + `telegram-webhook`): users connect their own
  BotFather bot. `/chat <message>` (aliases `/ask`, `/grim`) talks to Grim in DMs
  and groups without needing an @mention; `/migrations` and `/alerts on|off` too.
- **Super Bot identity**: name your bot and give it a persona in OG Scan settings; it responds in character (name + description are also set on Telegram).
- **PDF reports**: `/report <token>` delivers a branded OG Scan PDF (same data + OG score) straight into Telegram via the `og-report-pdf` edge function.
- **Tool parity**: `/scan <mint|$ticker>` returns the same data and OG composite score as ogscan.fun (logic ported to the `og-scan-token` edge function, same Jupiter source). `/trending` lists the top trending tokens.
- **Custom commands**: define your own slash commands in settings (static text with {arg}/{user}, or AI-instruction commands). They appear in the bot's command menu automatically.
- **Discord** (`discord-interactions`): `/chat` and `/migrations` slash commands.
  See `supabase/functions/discord-interactions/README.md` for setup. Alert-only
  webhook delivery still lives in `discord-connect`.

## Local setup
```bash
cd web
npm install
cp ../.env.example .env   # fill in your own keys (see below)
npm run dev
```

## Environment variables
No secrets are committed. Provide your own via env (e.g. Vercel project settings
or `web/.env`). Front-end keys are prefixed `VITE_`:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_HELIUS_API_KEY`, `VITE_JUPITER_API_KEY`, `VITE_ALCHEMY_API_KEY`, `VITE_QUICKNODE_WSS`

Edge function secrets are configured in Supabase (never in source):
`HELIUS_API_KEY`, `BIRDEYE_API_KEY`, `JUPITER_API_KEY`, `NVIDIA_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, etc.

> Note: any `VITE_*` value is shipped in the public browser bundle by design —
> use keys that are safe to expose client-side (or proxy them through an edge
> function), and keep privileged keys server-side only.

## License
Proprietary — © OG Scan. All rights reserved.
