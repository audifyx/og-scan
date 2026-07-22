# Project TODO

- [x] Anti-vamp protection moved to header
- [ ] Fix meta data issues in Tokens
- [x] Remove Vanity CA generator from homepage (removed section from OrbitxLaunch.tsx)
- [x] Redesign Token pages with DEX platform UI/style
- [x] Add buy/sell functionality to Token pages (placeholder buttons added)
- [ ] Fully build out Profile tab
- [ ] Improve About tab design
- [ ] Ensure platform feels like an actual launchpad
- [x] Implement Trending functionality
- [x] Implement Volume functionality
- [x] Implement Categories functionality (placeholder added)
- [x] Redesign homepage completely for higher quality (Hero section updated)
- [ ] Streamlined wallet connection (connect once, persist across tabs)
- [x] Redesign entire home hub layout (initial structure changes)
- [ ] Use dark mode colors (classic Pump.fun 2023 app style)

## OrbitX NFT Marketplace (v4) — dedicated /nft route
- [x] Move NFT into its own marketplace route (/nft) with Magic-Eden-style home
- [x] Marketplace header: brand, global search, rolling category rail, connect-wallet login
- [x] Marketplace footer (multi-column)
- [x] Home: hero featured, Trending/Top/Watchlist tabs + time-range pills, trending table, recently listed, latest sales, live-sales ticker
- [x] Explore reuses existing hub (buy/sell/list/auction/offer/bid, royalties, rarity, verified, scam flags)
- [x] Creator profile page (avatar/banner/followers/follow) + Created/Owned/Collections/Fees/Activity tabs  (Phase 2)
- [x] Collection page with analytics strip + item grid  (Phase 4 scaffold)
- [x] Launch Drops page with countdown + phases  (Phase 3)
- [x] Notifications page (wallet-scoped)  (Phase 2)
- [x] Creator-fee claim UI (pump.fun-style, in-app)
- [x] v4 migration SQL: follows/likes/comments/notifications/drops/analytics/coin-markets/coin-trades/fee-ledger
- [ ] APPLY v4 migration to Supabase (needs DB access — see chat)
- [ ] Deploy on-chain NFT-coin bonding-curve program (see docs/NFT_COIN_TRADING.md)
- [ ] Phase 4 charts: backfill orbitx_nft_collection_stats_daily + render floor/volume charts
- [ ] Phase 5: USDC pricing option, Transfer/Burn UI, staff-picks/featured curation
