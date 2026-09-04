# OrbitX City — Rebuild v2

Rebuild of the City front-of-house and world art direction: FiveM-style
launcher, six-operative roster, and a Roblox-style blocky world.

## What changed

### 1. Launcher (FiveM-style)
`web/src/components/orbitxcity/ui/MainMenu.tsx`

Replaced the title-rail menu with a **server browser**:

- Left rail: Play / Servers / Operatives / Settings / Direct Connect
- Centre: live district list with player counts, ping bars, status and tags
- Right: server detail card with capacity bar and a Connect action
- Search filter, double-click-to-connect, connecting overlay

Backing model: `web/src/lib/orbitxcity/serverBrowser.ts`

Runtime counts are deterministic per 20s bucket so the browser is never empty
while real presence loads. Live presence overrides the simulation:

```ts
buildServerRows({ nyc: { players: 42, status: "online" } });
```

### 2. Operatives — six mascots
`web/src/lib/orbitxcity/characterClasses.ts`

| id | Name | Role | Rarity |
|----|------|------|--------|
| `pepe` | Pip | Trader | Rare |
| `wojak` | Vex | Culture | Common |
| `chad` | Titan | Bruiser | Epic |
| `doge` | Scout | Scout | Rare |
| `anon` | Nul | Operator | Legendary |
| `vitalik` | Proto | Architect | Legendary |

Each class now carries `rarity`, `handle`, `trimColor`, `movement`
(speed/jump/accel multipliers) and a `build` silhouette recipe
(head / torso / headgear / eyes / trail).

Designs are OrbitX-original stylised meshes on crypto-culture archetypes —
not reproductions of third-party meme artwork.

**Back-compat:** legacy ids (`trader`, `builder`, `gamer`, `creator`,
`explorer`) still resolve through `CLASS_ALIASES`. Existing saves are safe.

### 3. Operative select
`web/src/components/orbitxcity/ui/CharacterSelect.tsx`

Roster grid with rarity framing, live 3D preview on a lit podium, animated
stat bars, power index, perk callout and a deploy bar. Keyboard: arrows to
cycle, Esc to back out.

### 4. Roblox-style world
`web/src/components/orbitxcity/world/BlockBuilding.tsx`
`web/src/components/orbitxcity/world/BlockCharacter.tsx`
`web/src/components/orbitxcity/world/BlockyBuildingMesh.tsx`

- **`BlockBuilding`** — chunky box massing, flat plastic materials, roof studs,
  emissive storey bands, canvas signage, kind-specific toppers
- **`Baseplate` / `BlockRoad`** — stud-grid ground and kerbed road strips
- **`BlockCharacter`** — blocky avatar driven entirely by the class `build`
  recipe, with limb swing and bob animation
- **`BlockyBuildingMesh`** — adapter adding the block look to existing
  `BuildingDefinition`s

**Collision is unaffected.** The adapter preserves position and footprint
exactly; only materials and massing changed.

## Feature flag

Both the world and the avatars read one flag:

```
VITE_OXC_BLOCKY=1   # default — blocky Roblox style
VITE_OXC_BLOCKY=0   # legacy Manhattan facade renderer
```

Set it to `0` to A/B the old look without a revert.

## Verification

| Check | Result |
|-------|--------|
| `tsc --noEmit` | clean |
| `vitest run` | 183 passed, 3 skipped, 0 failed |
| `eslint` on changed files | clean |
| `vite build` | 11,482 modules transformed; chunk render OOM'd in a 4GB/1-CPU sandbox — needs verification on normal CI |

**Outstanding:** confirm the production bundle builds and smoke `/Orbitxcity`
on NYC plus one alt district on a real machine.
