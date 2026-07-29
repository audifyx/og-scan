# OrbitX City — Asset Plan



Source of truth for characters, buildings, worlds, and props. Palette follows [orbitx-city-art/AGENT_PROMPT.md](../orbitx-city-art/AGENT_PROMPT.md): matte black, neon green `#00ff9f`, gold `#c5a26f`, glass panels.



Export rules: [GLTF_EXPORT_SPEC.md](./GLTF_EXPORT_SPEC.md).



## Pipeline tiers



| Tier | What | Where | Status |

|------|------|-------|--------|

| **A — Procedural** | Facades, graffiti, ads, avatars, lamps, landmark placeholders | `textures.ts`, `CharacterMesh.tsx`, `BuildingMesh.tsx`, `LandmarkMesh.tsx` | Live |

| **B — GLTF kits** | Kenney A–D / furniture fallback + OrbitX preferred GLBs | `web/public/orbitxcity/models/` | Live (Kenney) + OrbitX pending art |

| **C — World data** | Districts, zones, OSM footprints, landmarks | `worlds/*.ts`, `demoBlock.ts` | Live (NYC/Miami/LA/Boston) |

| **D — Runtime screens** | Live token boards, mega-screen | `BillboardMesh`, `MegaScreen` | Live |



Code registry: `web/src/lib/orbitxcity/assets/catalog.ts`  

Resolver: `resolveModelPath()` + HEAD probe in `preload.ts`  

Binary inventory: `web/public/orbitxcity/models/manifest.json`



---



## 1. Characters (5 operatives)



Each class = silhouette + palette + accessory + outfit (see `characterKits.ts`).



| Class | Silhouette | Outfit | Accessory | Neon |

|-------|------------|--------|-----------|------|

| Trader | Balanced | Suit | Briefcase | Gold |

| Builder | Wide | Street + tool belt | Hard hat | Blue |

| Gamer | Lean | Sport | Headset | Magenta |

| Creator | Tall | Neon trim | Hand mic | Purple |

| Explorer | Tall | Street + pack | Compass chest | Green |



Mesh: `CharacterMesh.tsx` (procedural fallback) → `CharacterGltf.tsx` when OrbitX GLB is available (high quality only).  

UI pods: `CharacterSelect.tsx` CSS holograms + `/orbitxcity/ui/pod-frame.svg`.



---



## 2. Buildings (district kits)



District `BuildingKind` maps to visual kit (`buildingKits.ts`):



| Kind | Kit | Roof | GLTF shell | Interior theme |

|------|-----|------|------------|----------------|

| hq | `hq-tower` | Beacon | OrbitX → C | hq |

| trading_floor | `trade-glass` | AC units | OrbitX → B | trade |

| launch_arena | `launch-stage` | Marquee | OrbitX → D | launch |

| market / shop | `retail-neon` | Flat | OrbitX → A | market |

| social_hub | `lounge-glass` | Soft glow | OrbitX → B | lounge |

| ad_tower | `ad-spire` | Beacon | OrbitX → D | lobby |

| plaza / generic | `midrise-block` | Mixed | OrbitX → A | lobby |



Mesh: tiered extrusion + kit GLTF when available / hash sample + procedural facade.



---



## 3. Worlds (4 cities)



| City | Theme id | Mood | Landmark |

|------|----------|------|----------|

| NYC | `nyc-midtown` | Cool dusk, blue/cyan | Midtown screen |

| Miami | `miami-coast` | Teal/gold coastal | Boardwalk |

| LA | `la-creator` | Purple/magenta strip | Creator stage |

| Boston | `boston-lab` | Navy/gold innovation | Lab dome |



Themes: `assets/worldThemes.ts` → fog, sun, accent colors (`neon: #00ff9f`).  

Blocks: `worlds/*Block.ts` + NYC OSM + `landmarks[]`.



---



## 4. Props & furniture



**Street (citybits):** bench, car_sedan, building shells A–D  

**Interior:** Kenney furniture placed via `furnitureSlots` + `GltfProp` in `InteriorRoom`  

**Procedural scatter:** neon signs/blades, palms, hydrants, kiosks, lab pylons, stage lights (`PropScatter.tsx`)



---



## 5. Audio (theme playlist)



22 MP3s in `web/public/orbitxcity/music/` — registered in `themeTracks.ts`.



---



## 6. Build order



1. ✅ Asset catalog + manifest + preload  

2. ✅ Class accessories on `CharacterMesh`  

3. ✅ World prop scatter per city  

4. ✅ Building kits wired to `BuildingMesh`  

5. ✅ Interior furniture placement from catalog  

6. ✅ OrbitX catalog / resolver / GltfProp / CharacterGltf / LandmarkMesh  

7. ✅ UI icon pack (`web/public/orbitxcity/ui/`)  

8. ⏳ Hero / building / landmark GLBs when art drops (drop-in via export spec)



## Agent workflow



```

- [ ] Read catalog.ts + GLTF_EXPORT_SPEC.md before adding meshes

- [ ] New GLTF → public/orbitxcity/models/orbitx/ + manifest.json + ORBITX_MODELS

- [ ] New city → *Block.ts + worldThemes entry + propRules + landmarks

- [ ] Match accent to city theme primary / neon #00ff9f

```

