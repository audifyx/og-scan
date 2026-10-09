# OrbitX City — 3D asset sources

All models below are **CC0 (public domain)** — free for commercial use, no attribution required (credited here anyway).

## Kenney.nl — https://kenney.nl/assets
| Pack | Used for | Contents |
|------|----------|----------|
| City Kit Commercial v2.1 | `buildings/commercial/` | shop-a…h, shop-n, tower-a/b |
| City Kit Suburban v2.0 | `buildings/suburban/`, `props/nature/` | house-p/q/r, trees, planter, fence |
| Car Kit | `vehicles/` | sedan, suv, taxi, van, police, truck |
| City Kit Roads | `props/street/` | lamp-curved, lamp-square, dumpster, cone, barrier |

Each kit ships its own `Textures/colormap.png` palette — kept per-directory because
palettes differ between kits. GLBs reference it relatively, so the file must sit
next to the models that use it.

## Notes
- All models verified loadable via three.js GLTFLoader (node test).
- Tri counts: buildings ~1–3k, cars ~2k, props <300. Well under the 500k/building budget.
- Kenney native units are small (~1 unit buildings); the city scales them ~10x at placement.
