# OrbitX City — GLTF Export Spec

Source of truth for custom OrbitX assets dropped into `web/public/orbitxcity/models/orbitx/`.
Art direction: [orbitx-city-art/AGENT_PROMPT.md](../orbitx-city-art/AGENT_PROMPT.md).

## Rules

| Rule | Value |
|------|--------|
| Format | glTF 2.0 binary (`.glb` preferred) or `.gltf` + `.bin` |
| Scale | 1 unit = 1 meter; Y-up |
| Origin | Characters: feet; buildings/landmarks: ground center |
| Tri budget | Characters ≤ 8k; building shells ≤ 15k; props ≤ 2k; landmarks ≤ 25k |
| Materials | PBR metallic-roughness; emissive for neon strips; no baked lighting |
| Textures | 512–1024px; atlased where possible; `{asset}_{map}.png` |
| Palette | Base `#0a0a0a`, neon `#00ff9f`, gold `#c5a26f`, glass `rgba(8,16,12,0.6)` |
| Animation | Characters: `idle`, `walk`, `dance` (loopable, 30fps) |
| LOD | Optional `_lod1` suffix at ~50% tri count for mobile |

## Naming

`orbitx_{category}_{name}.glb`

Examples:

- `orbitx_character_trader.glb`
- `orbitx_building_hq_tower.glb`
- `orbitx_landmark_midtown_screen.glb`
- `orbitx_prop_neon_blade.glb`
- `orbitx_interior_terminal_desk.glb`

## Folder layout

```
web/public/orbitxcity/models/orbitx/
├── characters/   # 5 hero class rigs
├── buildings/    # 7 district kits
├── landmarks/    # 1 hero mesh per city
├── props/        # street / district props
└── interiors/    # branded room props
```

## Character classes

| Class | File | Silhouette | Outfit | Accessory | Accent |
|-------|------|------------|--------|-----------|--------|
| Trader | `orbitx_character_trader.glb` | Balanced | Suit + gold trim | Briefcase | `#c5a26f` |
| Builder | `orbitx_character_builder.glb` | Wide | Street + tool belt | Hard hat | `#5b8def` |
| Gamer | `orbitx_character_gamer.glb` | Lean | Sport jersey | Headset | `#ff4d6a` |
| Creator | `orbitx_character_creator.glb` | Tall | Neon trim jacket | Hand mic | `#b388ff` |
| Explorer | `orbitx_character_explorer.glb` | Tall | Street + pack | Compass | `#00ff9f` |

## Building kits

| Kit | File |
|-----|------|
| hq-tower | `orbitx_building_hq_tower.glb` |
| trade-glass | `orbitx_building_trade_glass.glb` |
| launch-stage | `orbitx_building_launch_stage.glb` |
| retail-neon | `orbitx_building_retail_neon.glb` |
| lounge-glass | `orbitx_building_lounge_glass.glb` |
| ad-spire | `orbitx_building_ad_spire.glb` |
| midrise-block | `orbitx_building_midrise.glb` |

## Landmarks

| City | File |
|------|------|
| NYC | `orbitx_landmark_midtown_screen.glb` |
| Miami | `orbitx_landmark_boardwalk.glb` |
| LA | `orbitx_landmark_creator_stage.glb` |
| Boston | `orbitx_landmark_lab_dome.glb` |

## Agent checklist

```
- [ ] Export GLB per this spec
- [ ] Drop in web/public/orbitxcity/models/orbitx/{category}/
- [ ] Register in manifest.json + catalog.ts ORBITX_MODELS
- [ ] Preload probes availability (HEAD) — Kenney/procedural fallback if missing
- [ ] Wire renderer (CharacterGltf / BuildingMesh / InteriorRoom / PropScatter / LandmarkMesh)
- [ ] Verify lite mode still uses procedural / Kenney fallback
- [ ] Smoke /Orbitxcity on NYC + one alt city
```

## Fallback policy

Until a custom OrbitX GLB is present on disk, the runtime uses:

- Characters → procedural `CharacterMesh`
- Buildings → Kenney citybits A–D or procedural tiers / OSM extrusion
- Furniture → Kenney furniture pack
- Props → procedural PropScatter meshes
