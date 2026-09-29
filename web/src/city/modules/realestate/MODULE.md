# OrbitXCity — Real Estate Module (MODULE.md)

**Team:** Real Estate module team · **Area:** `web/src/city/modules/realestate/**` (exclusive)

GTA-style property game: NFT deeds on ownable buildings/plots (foot-traffic
rent, upgradeable tiers, tradable), apartments & safehouses (own, decorate,
invite friends), penthouse auctions (bid ORBITX — all bids burned), and a
hotel chain (sleep to save, suite login bonuses). Paper **CITY** for gameplay;
real **ORBITX** (backend-signed, auth-once, no popups, auto-burn) for premium.
The game never custodies keys or funds.

## What was built

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 1 | **NFT deeds — ownable buildings/plots as Metaplex NFTs** | **BUILT (defensive)** | `store/deeds.ts` + `components/DeedsPanel.tsx`. Every deed carries a marketplace-ready payload via `deedToNftMetadata()` (name/symbol/description/traits in the standard attribute format). Actual on-chain mint is deferred to the platform's no-popup backend desk-wallet + authCode flow — see Integration; `deedStore.recordDeedNftMint(deedId, mintAddress, signature)` records the mint on the deed. |
| 2 | **Foot-traffic rent** | **BUILT** | `rentPerHour()` = base rent × district multiplier × tier multiplier × deterministic time-of-day foot-traffic curve (peaks ~20:00 local). Accrues in 5-minute slices via `deedStore.tick()`; collectable to paper CITY. |
| 3 | **Upgradeable tiers** | **BUILT** | 6 tiers (Raw Lot → Landmark, ×1.0 → ×11.0 rent). Each upgrade burns its ORBITX cost (40 → 2,200). |
| 4 | **Tradable deeds** | **BUILT (defensive)** | `listDeed`/`unlistDeed` flag listings with an ORBITX ask; the "NFT deed" toggle shows the exact mint payload. Settlement reuses the existing `/nft` market pages (`web/src/pages/nft/`) read-only — never rebuilt here. |
| 5 | **Apartments & safehouses (own, decorate, invite friends)** | **BUILT** | `store/homes.ts` + `components/HomesPanel.tsx`. 3 apartments (one-time ORBITX burn) + 3 safehouses (paper CITY). 16 furniture items — paper-CITY basics, premium ORBITX pieces burned. Deco-slot limits, guest invites by player-id, one home settable as spawn point. |
| 6 | **Penthouse auctions (FLAGSHIP)** | **BUILT** | `store/auctions.ts` + `components/AuctionsPanel.tsx`. 30-min lots on a deterministic fixed-epoch schedule (no server needed). Every real bid burns ORBITX (win or lose). Anti-snipe (+60s), +5% minimum raise, seeded NPC rivals (tagged, paper-only). Winner gets a tier-5 landmark penthouse NFT deed (rentable). |
| 7 | **Hotel chain (sleep to save, suite login bonuses)** | **BUILT** | `store/hotels.ts` + `components/HotelsPanel.tsx`. 3 hotels; standard rooms cost paper CITY/night; suites are one-time ORBITX burns paying a daily paper-CITY login bonus with a consecutive-day streak multiplier. "Sleep to save" writes a checkpoint for respawn restore. |

All 4 flagship components mount through `RealEstateHub` (Auctions-first tab order).
Every premium spend burns. No mock data anywhere.

## Public API (`index.ts`)

- `RealEstateHub({ billing?, ledger?, onClose, initialTab? })` — single mount point, tabbed overlay (Auctions · Deeds · Homes · Hotels). `REALESTATE_PANEL_ID = "realestate"`.
- `useRealEstateBilling(provider?)` — defensive billing adapter (`billing.ts`); records every burn in a shared localStorage burn log (`orbitxcity:burn-log:v1`, shared with the economy bank).
- Stores: `deedStore` / `useDeeds()`, `auctionStore` / `useAuctions()` / `getAuctionBoard()`, `homeStore` / `useHomes()`, `hotelStore` / `useHotels()`, `createLocalPaperLedger()` / `noopLedger`, `PLAYER_ID`.
- Data + helpers: districts/tiers/`PROPERTIES`/`FURNITURE`/`HOTELS`/`HOMES`/auction schedule, `rentPerHour`, `footTrafficAt`, `deedToNftMetadata`.

Only external dep: `react`. Self-contained styles in `realestate.css` (`ox-re-*`
namespace). Mobile-friendly (44px touch targets, overlay fits small screens).

## Integration points — exact needs from core

1. **Mount:** when the core HUD panel `"realestate"` opens, render
   `<RealEstateHub billing={billing} ledger={ledger} onClose={closePanel} />`.
   Suggested wiring in the page shell / `GtaHud`:
   ```tsx
   import { RealEstateHub, REALESTATE_PANEL_ID } from "@/city/modules/realestate";
   // add REALESTATE_PANEL_ID to the HudPanel set; when active:
   {panel === REALESTATE_PANEL_ID && <RealEstateHub billing={billing} ledger={ledger} onClose={() => openPanel(null)} />}
   ```
2. **Billing injection:** `billing` is `useOrbitxBilling()` cast to `OrbitxBillingProvider`
   (see `web/src/city/BILLING_CONTRACT.md`). Omit until the primitive lands —
   premium UI renders the auth-required state; everything paper keeps working.
3. **Ledger injection:** `ledger` should wrap the economy module's shared paper
   wallet to the `PaperLedger` interface (`credit`/`debit`/`balance`) so rent
   payouts, hotel rooms and safehouses hit the one true paper balance. Until
   then a standalone localStorage ledger is used.
4. **Spawn point:** `homeStore.getSpawnHome()` returns the player's chosen
   home — wire it to core's teleport/respawn once core exposes it. Sleep
   checkpoints (`hotelStore.lastCheckpoint()`) are the other respawn source.
5. **NFT deed mint (backend desk-wallet + authCode):** when the player (or the
   platform) mints the deed's Metaplex NFT through the no-popup backend flow,
   call `deedStore.recordDeedNftMint(deedId, mintAddress, signature)` with the
   payload from `deedToNftMetadata(deed)`. Do NOT call
   `web/src/lib/orbitx/nftMint.ts` from the game — it requires a wallet-adapter
   wallet (Phantom popup), which the game's billing rules forbid.
6. **World triggers (optional):** walking into a realty office / hotel /
   apartment building could open the panel with `initialTab="deeds"` /
   `"hotels"` / `"homes"`. The module needs no scene/3D hooks — pure HUD overlay.

## Assumptions about not-yet-existing shared code (marked per instructions)

- **`@/tokenomics/useOrbitxBilling` DOES NOT EXIST YET — HARD RULE honored:**
  nothing in this module imports `@/tokenomics/*` (it would break the
  production build). Verified: `web/src/tokenomics/` holds only `constants.ts`,
  no hook. The expected interface is documented as `OrbitxBillingProvider` in
  `types.ts` (mirrors `web/src/city/BILLING_CONTRACT.md` exactly) and the
  integrator injects it via props.
- **NFT minting path:** `web/src/lib/orbitx/nftMint.ts` was read (read-only)
  and deliberately NOT imported — it signs via the connected wallet-adapter
  wallet, i.e. a popup per mint. Deed NFT mints must go through the
  backend-signed desk-wallet + authCode flow (integrator/backend side), using
  the module's `DeedNftMetadata` payload; `recordDeedNftMint` closes the loop.
- **/nft pages** (`web/src/pages/nft/`: MarketplaceHome, CollectionPage,
  TransferBurnModal, …) exist and are reused read-only for deed settlement;
  the module only flags listings, it never builds marketplace UI.

## Assumptions / caveats

- All stores are external stores persisted to localStorage per device; no
  server-side deed registry. Two devices = two separate portfolios.
- Rent accrual ticks while a deeds/auction panel is open (30s / 5s intervals);
  `deedStore.tick(Date.now())` also runs on collect, so offline accrual is
  caught up on next visit.
- Auction lots follow a fixed-epoch deterministic schedule anchored at
  2026-09-29 12:00 UTC — every client agrees on the live lot without a
  server. NPC rival bids are seeded per lot (`wonByPlayer` compares against the
  device's `PLAYER_ID`).
- `wonByPlayer` on the live lot view was fixed this session (previously always
  false — it compared against the template's unset `winningBidderId`).
- Paper-CITY rent, hotel rooms and safehouses are fully playable standalone;
  ORBITX premium (deeds, upgrades, auctions, apartments, suites, premium
  furniture) renders auth-required until the tokenomics primitive lands.
- Local burn history (`orbitxcity:burn-log:v1`) is shared with the economy
  bank by storage-key convention, not by import (no cross-module imports).

## Files

- `index.ts` — public API
- `MODULE.md` — this file
- `types.ts` — `OrbitxBillingProvider`, `Deed`, `DeedNftMetadata`, auctions, homes, hotels, …
- `billing.ts` — `useRealEstateBilling(provider?)` defensive adapter + burn log
- `data/catalog.ts` — 6 districts, 6 tiers, 18 properties, 16 furniture items, 3 hotels, 6 homes, deterministic auction schedule
- `store/identity.ts` — stable device `PLAYER_ID`
- `store/paperLedger.ts` — local paper-CITY fallback + `noopLedger`
- `store/deeds.ts` — deed book, rent accrual, upgrades, listings, `recordDeedNftMint`
- `store/auctions.ts` — deterministic auction engine (NPC sim, anti-snipe, resolution, winner deeds)
- `store/homes.ts` — apartments/safehouses, furniture, guests, spawn
- `store/hotels.ts` — check-in, suite purchases, login-bonus streaks, sleep checkpoints
- `components/RealEstateHub.tsx` — tabbed mount point
- `components/DeedsPanel.tsx`, `AuctionsPanel.tsx`, `HomesPanel.tsx`, `HotelsPanel.tsx`, `ctx.ts`
- `realestate.css` — scoped styles
