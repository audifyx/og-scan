# solana-betting environment variables

## Required (production)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server routes (bypass RLS) |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_RPC_ENDPOINT` | Public Solana RPC |
| `NEXT_PUBLIC_TREASURY_WALLET` | **All bet deposits** sent here |
| `TREASURY_WALLET` | Server fallback for treasury address |

## Server-only

| Variable | Purpose |
|----------|---------|
| `SOLANA_RPC_ENDPOINT` | Server RPC (fallback: `NEXT_PUBLIC_RPC_ENDPOINT`) |
| `ADMIN_AUTH` | Admin panel PIN (required; no default). `ADMIN_PANEL_SECRET` is a legacy alias. |
| `CRON_SECRET` | Auth header for `/api/cron/resolve` |
| `SPORTSDB_API_KEY` | TheSportsDB oracle (default `3`) |

## Optional / legacy

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PROGRAM_ID` | Anchor program ID (not used for main bet flow) |

## Hardcoded in repo (`app/src/utils/constants.ts`)

- Treasury pubkey: `9ZygxJ8AsvQLK9368uyuxQ4uTkmSj2EsjwAy3UdSQWgY`
- Global pool: `45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE`
- Program ID: `Btr98movTV3jHYy1kNX8L2zYVEk7m33QTr2YtU96hLqM`

Override with `NEXT_PUBLIC_TREASURY_WALLET` in Vercel for production treasury.

## og-scan parity

If sharing Supabase with og-scan, use the **same** `NEXT_PUBLIC_SUPABASE_URL` and keys. Run solana-betting migrations **after** reviewing conflicts with og-scan `profiles` / `auth.users`.
