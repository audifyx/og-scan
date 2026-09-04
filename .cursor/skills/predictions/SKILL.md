---
name: predictions
description: Builds and integrates OrbitX Prediction Markets from the audifyx/solana-betting repo (Next.js 14, Supabase, Solana treasury, parimutuel pools, arcade duels). Use when working on /predictions, prediction markets, Polymarket-style betting, solana-betting, orbitx-prediction.fun, solno.fun, market resolution, treasury payouts, or replacing the og-scan predictions stub.
---

# OrbitX Predictions (`/predictions`)

## Source of truth

The **real** prediction product lives in **[audifyx/solana-betting](https://github.com/audifyx/solana-betting)** — branded **OrbitX Prediction Market** (formerly SOLNO).

| Item | Value |
|------|--------|
| Repo | `https://github.com/audifyx/solana-betting` |
| App root | `app/` (Next.js 14 — **Vercel root directory**) |
| Production | `https://solana-betting-two.vercel.app` / `orbitx-prediction.fun` |
| Stack | Next.js 14, Supabase, Solana wallet adapter, manual-treasury deposits |
| On-chain | Anchor program exists (`programs/betting`); **production uses treasury verify**, not program calls |

**Do not reinvent** markets with virtual USDC stubs when this skill applies — wire the real app or port its API/schema.

Local clone (agent): `git clone https://github.com/audifyx/solana-betting.git .tmp/solana-betting`

---

## What it does (Polymarket-like)

1. **Browse** multi-outcome markets (2–10 outcomes), categories, search, featured
2. **Stake SOL** — user sends to treasury wallet, pastes tx sig; server verifies on-chain
3. **Parimutuel pools** — winners split losers proportionally (`lib/payout.ts`)
4. **Resolve** — admin manual or cron auto-resolve (CoinGecko crypto, TheSportsDB sports)
5. **Payout** — admin sends SOL treasury → winner; tx recorded in `payout_proofs`
6. **Social** — comments, likes, follows, leaderboard, public profiles `/app/u/[handle]`

**Also includes:** arcade 1v1 duels, game balance ledger, fundraises, support chat, PWA, admin PIN panel.

---

## og-scan today vs target

| Location | Status |
|----------|--------|
| `web/src/pages/predictions/*` | **Stub** — virtual USDC AMM, not production |
| `supabase/migrations/20260728130000_prediction_markets.sql` | **Stub schema** (`pred_*`) — superseded by solana-betting migrations |
| Hub / OS links | Point to `/predictions` on orbitx.world |

**Target:** `/predictions` serves the solana-betting product (embed, rewrite, or monorepo mount).

---

## Integration options (pick one)

### A — Separate Vercel project (fastest)

1. Deploy `solana-betting/app` as its own Vercel project
2. Set env (see [env.md](env.md))
3. Run all 14 Supabase migrations from `solana-betting/supabase/migrations/`
4. In og-scan `web/vercel.json`: rewrite `/predictions` → deployed URL **or** DNS `predictions.orbitx.world`
5. Update Hub links if subdomain

### B — Monorepo vendoring

1. Copy `solana-betting/app` → `web/predictions-app/` (or git subtree)
2. Vercel: second project with root `web/predictions-app`, or multi-project monorepo config
3. Share Supabase project with og-scan **or** dedicated predictions DB

### C — Iframe (interim)

Already used in `web/src/pages/Games.tsx` for `orbitx-prediction.fun`. Replace stub `PredictionsLayout` with full-viewport iframe to production URL until native mount.

---

## Auth bridge (Phantom / Jupiter + unified @username)

solana-betting uses **Supabase email/password** + wallet for **deposits only**.

og-scan uses **SIWS** (`supabase/functions/wallet-auth`) + `profiles.username`.

When unifying:

1. **Preferred:** After og-scan `signInWithWallet`, create/link Supabase session in predictions app via shared `auth.users` + `profiles` (same Supabase project)
2. Map `profiles.wallet` to connected Phantom/Jupiter pubkey on first `/predictions` visit
3. Keep treasury deposit flow unchanged (wallet sends SOL, paste sig)
4. Do **not** duplicate username tables — read `profiles` from og-scan schema or merge migrations carefully

Jupiter: not in solana-betting today; add `@solana/wallet-adapter` Jupiter adapter from og-scan `web/src/lib/wallets/jupiterWalletAdapter.ts` if extending the Next app.

---

## Agent workflow

When user asks to build/fix `/predictions`:

```
Task Progress:
- [ ] Confirm using solana-betting (this skill), not pred_* stub
- [ ] Clone/pull audifyx/solana-betting if missing locally
- [ ] Check Supabase migrations 001–014 applied
- [ ] Verify env: treasury wallet, RPC, service role, CRON_SECRET
- [ ] Choose integration A/B/C above
- [ ] Replace stub UI in web/src/pages/predictions if mounting real app
- [ ] Test: browse → place bet (devnet treasury) → admin resolve → payout
```

### Run locally

```bash
cd app   # inside solana-betting clone
cp .env.example .env.local
# Fill Supabase + NEXT_PUBLIC_TREASURY_WALLET + RPC
npm install && npm run dev
# http://localhost:3000
```

### Admin

- Route: `/admin` (PIN from `ADMIN_AUTH` on Vercel project `rork-og-meme-coin-tracker` — no default)
- Create/resolve markets, payout queue, withdrawals, maintenance toggle

### Cron

- `GET /api/cron/resolve` daily 08:00 UTC — requires `CRON_SECRET` header in production

---

## Key paths in solana-betting

| Path | Purpose |
|------|---------|
| `app/src/app/app/page.tsx` | Market browse |
| `app/src/app/app/bet/[id]/page.tsx` | Market detail + bet |
| `app/src/components/PlaceBetModal.tsx` | Treasury deposit flow |
| `app/src/app/api/bets/place/route.ts` | Verify deposit + record wager |
| `app/src/lib/solana-verify.ts` | RPC tx verification |
| `app/src/lib/resolve.ts` | Settlement + oracles |
| `supabase/migrations/` | 14 SQL files — run in order |

Full API + schema: [reference.md](reference.md) · Env vars: [env.md](env.md)

---

## og-scan files to touch when integrating

| File | Action |
|------|--------|
| `web/src/App.tsx` | Route `/predictions` → iframe, redirect, or remove stub |
| `web/src/pages/predictions/*` | Remove or replace with proxy component |
| `web/src/pages/Hub.tsx` | Link target |
| `web/vercel.json` | Rewrites to predictions app |
| `supabase/migrations/20260728130000_prediction_markets.sql` | Deprecate/remove if using solana-betting schema |

---

## Anti-patterns

- Do not use `pred_trade` / virtual USDC for production predictions
- Do not skip treasury tx verification on bet placement
- Do not run solana-betting migrations out of order
- Do not commit `.tmp/solana-betting` — clone locally or subtree vendor
