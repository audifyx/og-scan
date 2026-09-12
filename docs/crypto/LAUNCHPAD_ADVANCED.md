# Launchpad Advanced Systems (Spec v2)

Delta on the existing `/orbitxlaunch` router. Does **not** replace Spec v1 (vanity, X+wallet, Pump collect, SOL create).

## What shipped

- Orthogonal fields: `launch_style × quote_mint × rewards_policy × market_spec`
- Mode rail adds **Predict**. Style accordion: curve / delay / dutch / batch / ido_then_curve
- Track A `holderReward` on SOL create. Track B epoch vault **flagged off** until audit
- Yes/No market UI + indexer (`orbitx_pad_markets`). On-chain pm-core is **not** live — unsigned bet/redeem = 501
- Geo/self-attest gate; US predict blocked until counsel
- Claim page explains Track A auto-pay vs disabled Track B button
- Token page market ticket + resolver card
- Board Predict tab
- Agent API `/api/v1/*` + `/llms.txt` + `/orbitxlaunch/params`
- Resolve keeper `/api/pad-resolve` (metric graduation → yes/no, else void at T+grace)

## Honest refusals (required)

| Path | Status |
|---|---|
| SOL `create` + `holderReward` | Live (`/api/pump-create`) |
| Non-SOL QuoteControl `create_v2` | 400 — awaiting allowlist |
| Delay/Dutch/Batch/IDO on-chain | Indexed only |
| Track B vault claim ix | Disabled / 501 |
| pm-core split/merge/bet/redeem | Indexed UI, 501 unsigned tx |
| Pyth on-chain resolve | Keeper uses metric now; Pyth HTTP later |

## Env (Vercel project `rork-og-meme-coin-tracker`)

```
PAD_PREDICT_MARKETS=true
PAD_STOCKS=true
PAD_BAGWORK=true
PAD_TRACK_B_VAULT=false
PAD_KILL_CREATE=false
PAD_KILL_TRADE=false
# optional client mirrors
VITE_PAD_PREDICT_MARKETS=true
VITE_PAD_TRACK_B_VAULT=false
```

Existing: `PINATA_JWT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`. Apply `supabase/migrations/20260912200000_orbitx_launchpad_advanced.sql`.

## Apply SQL

```
supabase db push
# or paste the migration in the SQL editor
```
