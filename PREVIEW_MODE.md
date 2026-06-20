# OG Scan — Read-Only UI Preview Mode (for AI / agent review)

Lets an external AI **view the UI of every page/tab** without an account.
It is **read-only** and shows **NO real data** — no DMs, users, settings, messages,
or tables. Every Supabase/edge/realtime call is stubbed locally, and all writes are
blocked. Public 3rd-party market data (e.g. DexScreener) may still load so the UI
looks alive, but it contains no user data.

## How to use
Open any page with the preview key as a query param:

```
https://www.ogscan.fun/<path>?agent=<PREVIEW_KEY>
```

Default key (override with the `VITE_PREVIEW_KEY` env var on Vercel):
```
ogscan_ui_preview_7Qx2v9Lm4Kd8Rn3Tb6Wp1Zc5Hf0Jg2Ss
```
- The key is remembered for the browser tab (sessionStorage), so in-app navigation
  keeps preview mode on. When opening pages in fresh tabs, include `?agent=<KEY>` again.
- Add `?agent=off` to exit preview mode.
- A green "PREVIEW MODE — read-only" banner is shown while active.

## What the key protects
The key only unlocks the **empty UI shell** (no data is ever fetched), so even if the
key is seen it exposes nothing sensitive. For a private value, set `VITE_PREVIEW_KEY`
in Vercel and redeploy.

## Page list (append `?agent=<KEY>`)
/app /scanner /og-finder /pairs /migrations /trending /whales /tx-feed /swap
/feed /live-feed /snipe-feed /news-signal /memes /art-feed /charts /live-trading
/our-coin /roadmap /tech /token-manager /tools /trading-hub /pumpv5 /launch
/communities /coin-communities /community-rooms /discover /discovery /social
/social-hub /spaces /voice-rooms /leaderboard /callouts /trading-lobbies
/messages /notifications /profile /settings /wallets /games /intelligence
/admin /support /tokens /listings /host-analytics
