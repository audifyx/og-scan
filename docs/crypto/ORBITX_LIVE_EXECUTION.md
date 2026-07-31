# OrbitX live execution setup

The dashboard never receives a private key. It only uses `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. Keep every value below in Supabase Edge Function
secrets, not in Git, the browser, or chat.

## Required Edge Function secrets

Set these in **Supabase Dashboard → Project Settings → Edge Functions → Secrets**:

| Secret | Purpose |
| --- | --- |
| `SUPABASE_URL` | Existing project URL |
| `SUPABASE_ANON_KEY` | Used only to validate the caller's JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only ledger updates |
| `JUPITER_API_KEY` | Jupiter Swap API v2 key |
| `ORBITX_BOT_SECRET_KEY` | Dedicated hot-wallet 64-byte JSON keypair array |
| `ORBITX_OPERATOR_USER_ID` | Only Supabase user allowed to operate the bot |
| `ORBITX_DASHBOARD_ORIGIN` | Exact dashboard origin, for example `https://orbitx.example.com` |

Fund the dedicated wallet with only the intended trading balance. Do not reuse a
personal Phantom wallet or a seed phrase.

## Deploy

1. Apply `supabase/migrations/20260726020000_orbitx_live_execution.sql` using
   the SQL editor or `supabase db push`.
2. Deploy `orbitx-execution` with JWT verification enabled.
   Deploy `orbitx-pumpfun` with JWT verification enabled as well; it builds
   Pump.fun transactions through PumpPortal, signs only with the server secret,
   and submits through Helius.
3. Insert one row in `orbitx_trading_settings` for `ORBITX_OPERATOR_USER_ID`.
   Set the signer public key as `wallet_address`, `emergency_stop = true`, a
   $2 `max_trade_usd`, $5 `daily_loss_limit_usd`, two positions, and no more
   than 300 bps slippage.
4. Deploy the dashboard with only the public `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` values.
5. Sign in as `ORBITX_OPERATOR_USER_ID`, verify the displayed signer public
   key, leave auto trading off, and invoke the dashboard emergency stop once
   as a permission check.

## First live order

Only after the status endpoint returns a healthy signer and all limits:

1. Keep `emergency_stop` enabled while verifying the wallet balance and
   operator identity.
2. Disable the stop in the protected settings table, then submit one manually
   approved order below the $2 limit.
3. Verify the transaction on Solana Explorer and confirm the corresponding
   `orbitx_execution_ledger` record is `confirmed`.
4. Re-enable the stop immediately if the signed amount, output mint, or ledger
   record is not exactly what was expected.
