# OrbitX City Burn Store

Jupiter-only shop. Users buy USD-priced items ($1–$200) by swapping SOL → ORBITX (`13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9`) then **burning** that amount. Unlock is immediate and applied in-world.

## Flow

1. Quote Jupiter (ExactOut ORBITX, fallback ExactIn).
2. Wallet signs the Jupiter swap.
3. After confirm, burn the purchased ORBITX from the user ATA (reduces supply).
4. Persist purchase (`localStorage` keyed by wallet) and apply:
   - **Wear / characters** → `HumanoidMesh` cosmetics
   - **Ads** → building-face banners (`kind:hq` / `kind:walkin`)
   - **Listings** → Live tape + token buy panel
   - **Perks** → inventory badges

## UI

- HUD **Shop** (desktop dock + phone More)
- Meme Market CTA → Burn Store
- Billboard / ad-tower venues open the shop
- Market interiors have a Burn Store clerk

No other DEX. Clothes that are not owned stay locked in Character Creator.
