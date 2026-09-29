# Gadgets Module — OrbitXCity

**Team:** Gadgets module team · **Area:** `web/src/city/modules/gadgets/**` (exclusive)
**Status:** 3/3 approved ideas BUILT. ~18 further ideas pending enumeration.

GTA-style traversal + intel gadgets for the open world. Realistic three.js (not blocky),
mobile-friendly, self-contained — **no imports from other modules, no `@/tokenomics/*`
imports** (that directory does not exist yet; importing it breaks the production build).

---

## 1. What was built

| # | Idea | Status | Entry points |
|---|------|--------|--------------|
| 1 | **Gadget shop UI** — browse + buy gadgets | ✅ BUILT | `GadgetShop.tsx` |
| 2 | **Grappling hook** — traversal gadget with physics | ✅ BUILT | `GrapplingHook.ts` + HUD wiring |
| 3 | **Token scanner** — overlays LIVE token data on buildings as you aim/scan | ✅ BUILT | `TokenScanner.ts` + `GadgetHud.tsx` |

**File map**

| File | What it is |
|------|------------|
| `index.ts` | Public API — the integrator imports ONLY from here |
| `types.ts` | Shared types (`GadgetId`, `GadgetBillingProvider`, runtime snapshot, …) |
| `catalog.ts` | Gadget catalog (prices in ORBITX, burned), scan mints/symbols |
| `store.ts` | localStorage inventory + `useGadgetInventory` hook + `GadgetRuntime` pub/sub singleton |
| `GrapplingHook.ts` | Framework-free three.js grapple controller (rope physics, pull force) |
| `TokenScanner.ts` | Framework-free three.js scanner (raycast buildings → token overlay data) |
| `GadgetShop.tsx` | Shop modal — buy flow burns real ORBITX via injected billing provider |
| `GadgetHud.tsx` | In-world HUD — equip bar, grapple button, scanner toggle + live data panel |
| `gadgets.test.ts` | Vitest unit tests (catalog + inventory reducers) |

---

## 2. Billing (locked rules honored)

- Every gadget purchase **burns real ORBITX** via a backend-signed spend — the game never
  custodies keys, never shows wallet popups (per `web/src/city/BILLING_CONTRACT.md`).
- This module defines `GadgetBillingProvider` in `types.ts` — the exact shape the
  tokenomics team promised (`useOrbitxBilling`: `{ ready, balance, spend, beginAuth }`).
- **Nothing here imports `@/tokenomics/*`.** The integrator injects the provider as a prop:
  ```tsx
  import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling"; // tokenomics team ships this
  const billing = useOrbitxBilling();
  {shopOpen && <GadgetShop billing={billing} onClose={() => setShopOpen(false)} />}
  ```
- Until the primitives land, pass `billing={null}` — the shop renders an honest
  "wallet auth required / coming soon" state instead of a broken buy button.
- Burn receipts (signature + ref) are stored in the inventory and shown in the shop.

---

## 3. Integration recipe (for the merge agent)

### 3a. Construct the controllers (once the world exists)

```ts
import { GrapplingHook, TokenScanner, GadgetRuntime } from "@/city/modules/gadgets";

const world = api.getWorld();           // from useGtaGame()
if (!world) return;

// Latchable surfaces: building meshes. billboards already carry live quotes.
const buildings: THREE.Object3D[] = [];
world.sceneRef.traverse(o => { if (o.userData.isBuilding) buildings.push(o); });
// (fallback: filter CityData group children by height — see §5)

const grapple = new GrapplingHook({ scene: world.sceneRef, collidables: buildings });
const scanner = new TokenScanner({ scene: world.sceneRef, camera, scannables: buildings });
scanner.autoAssign(buildings);          // tags towers with SOL/ORBITX/BONK/JUP/WIF
```

### 3b. Per-frame updates (inside the game loop / rAF)

```ts
const st = world.getPlayerState();      // { onFoot, pos, heading, speed, … }
const g = grapple.update(dt, st.pos);
// ⚠️ OPEN: apply pull to the player — see §5 (needs core velocity API)
if (g.pull.lengthSq() > 0) world.addPlayerVelocity(g.pull.clone().multiplyScalar(dt));
scanner.update(performance.now());
```

### 3c. Mount the React UI

```tsx
import { GadgetHud, GadgetShop, useSyncRuntimeEquipped } from "@/city/modules/gadgets";

useSyncRuntimeEquipped(); // once — mirrors inventory equips into GadgetRuntime

<div className="relative"> {/* same overlay container as the core HUD */}
  <GadgetHud
    grapple={grapple}
    scanner={scanner}
    getAim={() => {
      // camera-space aim; needs camera access — see §5
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      return { origin: camera.position.clone(), dir };
    }}
    onOpenShop={() => setShopOpen(true)}
  />
  {shopOpen && <GadgetShop billing={billingOrNull} onClose={() => setShopOpen(false)} />}
</div>
```

### 3d. UI mount points

| Component | Positioning | Notes |
|-----------|-------------|-------|
| `GadgetHud` | `absolute inset-0 z-[40]`, `pointer-events-none` (only buttons capture) | Mount inside the same relative overlay container as the core HUD. Bottom-left equip bar, bottom-right action button, top-right shop button, top-left scan panel. |
| `GadgetShop` | `fixed inset-0 z-[80]` modal | Bottom-sheet on mobile, centered dialog on desktop. Closes on backdrop tap. |

### 3e. Input

Wired automatically by `GadgetHud`: **G** = fire/release grapple, **V** = toggle scanner,
plus 64px touch buttons (mobile). No core input changes needed.

---

## 4. Props

**`GadgetShopProps`** — `{ billing: GadgetBillingProvider | null; onClose: () => void }`

**`GadgetHudProps`**
| Prop | Type | Notes |
|------|------|-------|
| `grapple` | `GrapplingHook \| null` | Null until constructed / gadget not owned |
| `scanner` | `TokenScanner \| null` | Null until constructed / gadget not owned |
| `getAim` | `() => { origin: THREE.Vector3; dir: THREE.Vector3 } \| null` | Camera-space aim for grapple fire |
| `onOpenShop` | `() => void` | Opens the shop modal |

**`GrappleOptions`** — `{ scene, collidables: THREE.Object3D[], maxRange? = 65, fireSpeed? = 110, pullAccel? = 34, cooldownMs? = 1200 }`
**`ScannerOptions`** — `{ scene, camera, scannables?: THREE.Object3D[], scanIntervalMs? = 300, maxDistance? = 260 }`

**Runtime sync (no prop drilling):** controllers push `{ grapple, grappleAnchor, scannerActive,
scanHit, pricesConnected }` into the `GadgetRuntime` singleton; the HUD subscribes via
`useGadgetRuntime()`. `useSyncRuntimeEquipped()` mirrors inventory equips into it.

---

## 5. What we need from core / integrator (explicit)

1. ✅ **Have:** `world.getPlayerState().pos` (player position), `world.sceneRef` (additive
   scene work), `useGtaGame().getWorld()`. Used as designed.
2. ⚠️ **NEED — grapple velocity:** `GrapplingHook.update()` returns a pull acceleration
   vector; the integrator must add `pull * dt` to the player's velocity each frame.
   `World` keeps `pVel` private, so **core should expose something like
   `world.addPlayerVelocity(v: THREE.Vector3)`** (additive, no control fight). Without this
   the hook renders rope + anchor but cannot move the player.
3. ⚠️ **NEED — camera:** `TokenScanner` and `getAim` need the world camera.
   `GTAWorld` doesn't expose one — **core should expose a `cameraRef` getter**
   (same pattern as `sceneRef`), or the integrator passes its own reference.
4. ⚠️ **NEED — building meshes:** `CityBuilder.buildCity()` returns `group` but doesn't
   flag building meshes. For `collidables`/`scannables`, either tag buildings with
   `userData.isBuilding = true` in `CityBuilder`, or let the integrator collect meshes
   (e.g. children of `group` with height > 12m). Billboards (`CityData.billboards[].mesh`)
   already exist and are ideal scan targets. The scanner also honors manually-tagged
   objects via `TokenScanner.tag(obj, mint, name)` (walks up parents).
5. **Assumption:** core's frame loop calls our `update()`s; we never fight it for
   player/vehicle control. Grapple auto-releases within 2.5 m of the anchor or on
   `release()` / re-fire / jump (integrator may call `grapple.release()` on jump).

## 6. Live data

- The scanner HUD uses the existing `useLivePrices(mints, 10s)` hook
  (`web/src/hooks/useLivePrices.ts` → DexScreener). Real data only — no mocks.
- Overlay shows price, 24h change, 24h volume, liquidity, market cap + LIVE/SYNC
  connectivity badge. `quote: null` renders "Fetching live quote…".

## 7. Conventions kept

- localStorage key: `orbitxcity.gadgets.inventory.v1` (owned/equipped/burns).
- Spend reason strings: `city:gadget:<id>` (matches billing contract namespacing).
- Clean TypeScript, no unused imports, no cross-module imports, no `@/tokenomics/*`.
- Mobile: 56–64px touch targets, bottom-sheet shop, `dvh` sizing.

## 8. Open / pending

- ~18 further approved gadget ideas pending enumeration from the parent orchestrator —
  catalog is designed to extend (`GadgetCatalogItem` + `GadgetId` union).
- Shop currently sells the 2 functional gadgets only; no locked/placeholder items.
