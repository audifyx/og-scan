# OrbitXCity — Character Module (MODULE.md)

**Team:** Character module · **Area:** `web/src/city/modules/character/**` (exclusive)
**Stack:** React + Three.js (procedural avatar — realistic capsule/sphere proportions, NOT blocky), `ox-ch-*` CSS namespace, mobile-friendly.

GTA-style third-person character system: full creator, clothing with gameplay
buffs, barber + tattoo shops (real ORBITX burns), gym with trainable stats,
and a companion trade-bot drone that follows the player in-world.

## What was built

| # | Idea | Status | Notes |
|---|------|--------|-------|
| 1 | Full character creator — face, fits, tattoos | **BUILT** | `components/CharacterCreator.tsx` + live 3D `AvatarPreview` (drag-to-rotate). Name, 6 skin tones, 8 haircuts, 8 hair colors, 5 facial-hair options. Starter choices are free in the creator; every NEW style/ink/fit bought later burns ORBITX. Profile persists to localStorage (`orbitxcity.character.v1`). |
| 2 | Clothing stores — outfits give small gameplay buffs | **BUILT** | `components/Shops.tsx` → `ClothingStore` (THREADS). 17 pieces across 5 slots, each with small stat buffs (+6 STR tank, +6 SPD runners, etc.). Equipping recomputes `getDerivedEffects()`. |
| 3 | Barber + tattoo shops — cosmetic upgrades, ORBITX burn | **BUILT** | `BarberShop` (FADEZ): 8 cuts + 5 facial-hair options, each visit = one burn. `TattooShop` (INK'D): 8 procedural canvas-drawn tattoo decals in 5 body zones, free laser removal (burn non-refundable). All via `purchaseBurn` → `billing.spend()` (backend-signed burn). |
| 4 | Gym — train strength and stamina; stats affect gameplay | **BUILT** | `components/GymPanel.tsx` (IRON HOUSE). 6 exercises, paper-CITY fees, per-exercise cooldowns with live countdowns, 100 progress pts = +1 stat (cap 100). `getDerivedEffects()` → sprint speed ×, sprint seconds, melee ×, accel × — the stat hook core consumes. |
| 5 | Companion bot — little trade-bot that follows you, named after your favorite agent | **BUILT** | `companion/companionBot.ts` — hovering drone (visor, glowing eye, spinning orbit ring, blinking antenna, under-glow). Smooth pursuit behind the player, banks into turns. `CompanionPanel` renames (8 OrbitX-agent presets), recolors, toggles. Cosmetic only — never trades, never touches funds. |

**Billing (all premium):** BUILT defensive. `billing.ts` mirrors
`BILLING_CONTRACT.md` exactly — provider injected via `<CharacterProvider
billing={...}>`. Until `@/tokenomics/useOrbitxBilling` lands, UI renders the
"connect wallet" auth-once state and everything non-billing (stats, gym,
companion, preview) keeps working. We NEVER import `@/tokenomics/*`.

## Public API (`index.ts`)

- `CharacterHub({ billing?, onClose, initialTab?, onVisitStore? })` — single mount point, `CHARACTER_PANEL_ID = "character"`. Self-contained (wraps its own provider).
- `CharacterCreator`, `Wardrobe`, `ClothingStore`, `BarberShop`, `TattooShop`, `GymPanel`, `CompanionPanel`, `AvatarPreview` — standalone panels (need `<CharacterProvider>` above them if mounted without the hub).
- `CharacterProvider` / `useCharacter()` — profile store: appearance, wardrobe, tattoos, stats/progress, paper CITY wallet, companion config, burn receipts, `train()`, `buyClothing/buyTattoo/buyCut`.
- `getActiveBuffs(profile)` / `getDerivedEffects(profile)` — **the stat hooks core should read** (see Integration §3).
- `getStores()` / `STORES` — 4 shop locations on the city grid.
- `createCompanionBot({ scene, color?, name? })` → `{ update(dt, player), setName, setColor, setEnabled, dispose }`.
- `buildAvatar(appearance, outfit, tattooIds)` → `{ group, update(dt, speed01), dispose }`.
- `purchaseBurn` / `useBilling` / `resolveBilling` — defensive billing adapter.
- Catalogs: `CLOTHING`, `BARBER_STYLES`, `TATTOOS`, `GYM_EXERCISES`, `SKIN_TONES`, `HAIR_COLORS`, `FACIAL_HAIR`, `COMPANION_NAME_PRESETS`, `COMPANION_COLORS`.

Only external deps: `react`, `three`. Self-contained styles in `character.css`. No imports from other modules. No `@/tokenomics/*` imports (build-breaking until the directory exists).

## Integration points — exact needs from core

1. **Mount the hub.** Add `CHARACTER_PANEL_ID` to the HUD panel set (same pattern as economy):
   ```tsx
   import { CharacterHub, CHARACTER_PANEL_ID } from "@/city/modules/character";
   import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling"; // when it lands
   const billing = useOrbitxBilling(); // or undefined until then
   {panel === CHARACTER_PANEL_ID && (
     <CharacterHub billing={billing} onClose={() => openPanel(null)}
                   onVisitStore={(s) => api.getWorld()?.teleport(s.x, s.z)} />
   )}
   ```
2. **Walk-in stores.** `STORES` coords: THREADS (-24,-108), FADEZ (52,44), INK'D (-114,-30), IRON HOUSE (128,122). Place 3D storefront markers there; on "enter", `openPanel(CHARACTER_PANEL_ID)` with the right initial tab. The hub's "Visit" buttons demonstrate the teleport wiring via `onVisitStore`.
3. **Stat hook (character rig/mesh hooks).** The player's movement controller should call `getDerivedEffects(profile)` (or subscribe via `useCharacter().effects`) and apply `sprintSpeedMult`, `sprintStaminaSec`, `meleeDamageMult`, `accelMult` to sprint/regen/melee/accel. Today the core player uses `createHumanoid`; the module's `buildAvatar` is the higher-fidelity rig for the player mesh — if core later exposes a player-mesh swap, drop `buildAvatar(profile.appearance, profile.outfit, profile.tattoos).group` in place of the default humanoid and call `.update(dt, speed01)` per frame.
4. **Companion wiring (per-frame).** One rAF call while in-world:
   ```ts
   import { createCompanionBot } from "@/city/modules/character";
   const bot = createCompanionBot({ scene: api.getWorld()!.sceneRef,
     color: profile.companionColor, name: profile.companionName });
   // each frame: bot.update(dt, api.getWorld()!.getPlayerState());
   // on profile change: bot.setName(p.companionName); bot.setColor(p.companionColor); bot.setEnabled(p.companionEnabled);
   // on world dispose: bot.dispose();
   ```
   `getPlayerState()` fields used: `pos` (Vector3), `heading`, `onFoot` — matched 1:1 against `core/World.ts` (2026-09-29).
5. **Paper CITY ledger.** `characterStore` keeps its own paper CITY wallet (500 starter) until the shared economy ledger lands; gym fees debit it. When economy's shared wallet is final, swap `cityBalance`/`grantCity` to call it (single seam in `characterStore.tsx`).

## Assumptions

- Prices are whole ORBITX (burned). Gym costs paper CITY; `BurnReceipt.kind` includes a reserved `"gym-boost"` for future ORBITX-burned gym boosts.
- `billing.spend` resolves only on a mined burn (per contract); a zero-price "Clean shave" is applied free without calling spend (zero-burn txs would be rejected).
- Receipts kept in-profile (cap 200), newest first — the on-chain source of truth is the wallet; receipts are a local UX log.
- Avatar decals (tattoos) are canvas-drawn textures — offline-safe, no image assets.
- Companion is cosmetic-only: no trading, no fund access, never says anything about keys/custody.

## Files

```
character/
├── index.ts                  # public barrel
├── MODULE.md                 # this file
├── types.ts                  # profile, catalogs, billing provider, derived effects
├── data.ts                   # clothing/barber/tattoo/gym catalogs, STORES
├── avatar.ts                 # procedural realistic avatar rig + tattoo decals
├── billing.ts                # defensive ORBITX-burn adapter (no @/tokenomics import)
├── characterStore.tsx        # CharacterProvider, useCharacter, buffs, effects, gym logic
├── character.css             # ox-ch-* styles, mobile-friendly
├── companion/
│   └── companionBot.ts       # follower drone: update/setName/setColor/setEnabled/dispose
└── components/
    ├── CharacterHub.tsx      # mount point (Creator/Shops/Gym/Bot tabs)
    ├── CharacterCreator.tsx  # creator + wardrobe
    ├── Shops.tsx             # ClothingStore, BarberShop, TattooShop
    ├── GymPanel.tsx          # stats, derived effects, training
    ├── CompanionPanel.tsx    # bot name/color/enable
    ├── AvatarPreview.tsx     # 3D drag-to-rotate preview
    └── bits.tsx              # BurnButton, BillingNotice, BuffLine, ShopLook
```
