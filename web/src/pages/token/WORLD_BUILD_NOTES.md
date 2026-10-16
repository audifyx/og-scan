# WORLD_BUILD_NOTES — 3D Office Expansion (AgentOffice3D)

> All components below belong to the `AgentOffice3D` react-three-fiber scene in
> `/home/hatch/workspace/og-scan/web/src/pages/token/`.
> File check run 2026-10-16 ~08:25 EDT: **all 23 files exist — every component is built.**
> A parallel worker dropped the final six files (Pizza3D, Plant3D, Poster3D, Rug3D,
> Lamp3D, MemoryBoard3D) in during this check, so there are no remaining "planned" items.

## Component registry

### Music & entertainment

| # | File | Exported component | Status | One-line description | Position in scene |
|---|------|--------------------|--------|----------------------|-------------------|
| 1 | `Consoles3D.tsx` | `GameConsoles` | ✅ built | Media shelf under the wall-mounted BigTV holding four game consoles with glow lights | x = −5.3, shelf top y ≈ 0.49, spans z −0.9 → 0.9 |
| 2 | `Guitars3D.tsx` | `HeroGuitars` | ✅ built | Two Guitar Hero guitars leaning against the wall — pure decor, no audio/interaction | (5.4, 0, −1.6) and (5.5, 0, −2.4), right wall |
| 3 | `Drums3D.tsx` | `RockBandDrums` | ✅ built | Rock Band-style 4-pad drum kit with animated drumsticks and warm point light | (4.2, 0, −2.5), facing into the room (−x) |
| 4 | `MicStand3D.tsx` | `RockBandMic` | ✅ built | Microphone stand completing the band setup (accepts `GroupProps` for placement) | Default (5.0, 0, −1.2), near the guitars |
| 5 | `Arcade3D.tsx` | `ArcadeSection` | ✅ built | Row of neon arcade cabinets with marquee screens, joysticks and buttons | (3.0, 0, −3.6) and (4.2, 0, −3.6), against back wall |

### Kitchen & food

| # | File | Exported component | Status | One-line description | Position in scene |
|---|------|--------------------|--------|----------------------|-------------------|
| 6 | `Kitchen3D.tsx` | `KitchenCorner` | ✅ built | Kitchen counter + cabinets with fridge; countertop kept clear at y ≈ 0.94 for food props | Fridge (4.8, 0, 3.2); counter around (3.9, 0, 3.0) |
| 7 | `Meals3D.tsx` | `ViralMeals` | ✅ built | Food arrangement wrapper that places ramen, pizza, drinks and snacks on the countertop | Parent group on counter (3.55–4.35, 0.94, 2.8–3.3) |
| 8 | `FridgeLight3D.tsx` | `FridgeGlow` | ✅ built | Cool-white point light + glow plane spilling light out of the open fridge doors | Light (4.25, 1.1, 3.2); plane (4.2, 0.02, 3.2) |
| 9 | `Ramen3D.tsx` | `RamenBowl` | ✅ built | Steaming ramen bowl with looping animated steam puffs, chopsticks and toppings (placed by parent via `position` prop) | (3.55, 0.94, 2.85) on counter |
| 10 | `Pizza3D.tsx` | `PizzaBox` | ✅ built | Open pizza box with a whole pepperoni pizza inside, lid tilted open (placed by parent via `position` prop) | (4.25, 0.94, 3.15) on counter |
| 11 | `Drinks3D.tsx` | `EnergyDrinks` | ✅ built | Cluster of energy-drink cans in different colors plus a cup with straw, centered at local origin (placed by parent via `position` prop) | (3.75, 0.94, 3.3) on counter |
| 12 | `Snacks3D.tsx` | `SnackPile` | ✅ built | Snack bags, a chip bowl and candy bars piled as a snack heap (placed by parent via `position` prop) | (4.35, 0.94, 2.8) on counter |

### Decor & atmosphere

| # | File | Exported component | Status | One-line description | Position in scene |
|---|------|--------------------|--------|----------------------|-------------------|
| 13 | `Plant3D.tsx` | `OfficePlant` | ✅ built | Leafy potted office plant with layered colored leaves | (−1.5, 0, −3.4), near back glass wall |
| 14 | `Poster3D.tsx` | `WallPosters` | ✅ built | Two framed posters mounted on the back glass wall (HODL + OrbitX logo textures) | (−3.2, 2.4, −4.1) and (3.2, 2.4, −4.1) |
| 15 | `Rug3D.tsx` | `ArcadeRug` | ✅ built | Neon gaming rug laid flat under the arcade cabinets | (3.6, 0.015, −2.9), floor |
| 16 | `Lamp3D.tsx` | `FloorLamp` | ✅ built | Standing floor lamp with warm point light at the shade | (−4.4, 0, 2.6), near TV lounge corner |
| 17 | `ScreenGlare3D.tsx` | `ScreenGlare` | ✅ built | Animated glare plane that sweeps across the BigTV screen | x = −5.52, y = 2.4, z sweeps across the TV face |

### Agent memory & behavior

| # | File | Exported component | Status | One-line description | Position in scene |
|---|------|--------------------|--------|----------------------|-------------------|
| 18 | `MemoryBoard3D.tsx` | `MemoryBoard` | ✅ built | Mission-style corkboard rendering the agent's latest on-chain memories as amber monospace terminal text (takes `memories` prop) | (0, 2.2, −4.05), centered on back glass wall |
| 19 | `AgentChatter3D.tsx` | `AgentChatter` | ✅ built | Floating speech-bubble group above the couch agents cycling through `lines` with a gentle bob animation | Rotates over head positions (−2.4, 2.3, −0.75 / 0 / 0.75), TV lounge |
| 20 | `AgentMemory.ts` | `useAgentMemory` | ✅ built | Hook storing/reading the agent memory log, plus a `timeAgo` formatting helper — logic only | N/A (no 3D position) |
| 21 | `AgentDiary.tsx` | `AgentDiary` | ✅ built | 2D HUD panel widget listing what the agents remember (takes `memories` prop) — not a 3D object | 2D overlay, placed by parent page layout |
| 22 | `MemoryFeed.ts` | `useBurnMilestones` | ✅ built | Hook surfacing token burn milestone events for the memory feed — logic only | N/A (no 3D position) |
| 23 | `useAgentReactions.ts` | `useAgentReaction` | ✅ built | Hook picking an agent reaction plus a `REACTION_LABEL` map for display text — logic only | N/A (no 3D position) |

## Scene map (approximate coordinates)

The room is centered near the origin with the back glass wall at **z = −4.2**.
Zones:

- **TV lounge** — west side. BigTV wall-mounted at (−5.6, 2.4, 0), facing +x into the
  room. Couch at (−2.4, 0, 0) with WatchingAgents; `GameConsoles` shelf at x = −5.3
  sits under the TV; `ScreenGlare` sweeps the TV face; `AgentChatter` bubbles float
  over the couch heads at (−2.4, 2.3, z); `FloorLamp` warms the corner at (−4.4, 0, 2.6).
- **Music corner** — east/back. `RockBandDrums` kit at (4.2, 0, −2.5) facing −x;
  `HeroGuitars` lean on the right wall at (5.4, 0, −1.6) / (5.5, 0, −2.4);
  `RockBandMic` stand at (5.0, 0, −1.2).
- **Arcade** — north-east against the back wall. `ArcadeSection` cabinets at
  (3.0, 0, −3.6) and (4.2, 0, −3.6); `ArcadeRug` under them at (3.6, 0.015, −2.9).
- **Kitchen** — front-right (south-east). Counter zone around (3.9, 0, 3.0);
  fridge at (4.8, 0, 3.2) with `FridgeGlow` light spill in front of the doors.
  `ViralMeals` props on the countertop at y = 0.94: ramen (3.55, 0.94, 2.85),
  pizza (4.25, 0.94, 3.15), energy drinks (3.75, 0.94, 3.3), snacks (4.35, 0.94, 2.8).
- **Office desk** — desk at x = 1.6 (existing landmark, untouched by this expansion).

Shared decor / center:

- **AI core** — center of room at (0, 0, 0) (existing landmark).
- `MemoryBoard` — corkboard centered on the back glass wall at (0, 2.2, −4.05),
  flanked by `WallPosters` at (−3.2, 2.4, −4.1) and (3.2, 2.4, −4.1).
- `OfficePlant` — (−1.5, 0, −3.4), left of the arcade, near the back wall.

## Notes for the next worker

- `Meals3D.tsx` imports `PizzaBox` from `./Pizza3D` — both files exist now, so the
  import resolves; verify the app compiles before assuming the kitchen zone is wired.
- Food props (`RamenBowl`, `PizzaBox`, `EnergyDrinks`, `SnackPile`) are built around a
  local origin and rely on the parent (`ViralMeals`) for placement — repositioning them
  means editing `Meals3D.tsx`, not the prop files.
- The four logic files (`AgentMemory.ts`, `MemoryFeed.ts`, `useAgentReactions.ts`,
  `AgentDiary.tsx`) have no 3D coordinates; `AgentDiary` is a 2D panel and must be
  positioned by the page layout, not the scene.
