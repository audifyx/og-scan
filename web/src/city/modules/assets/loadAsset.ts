/**
 * CITY ASSET PIPELINE — cached GLTF loading for real 3D assets (Kenney CC0 packs).
 *
 * Models live under `web/public/assets/city/`:
 *   buildings/commercial | buildings/suburban | vehicles | props/street | props/nature
 * Each kit dir keeps its own `Textures/colormap.png` (palettes differ per kit).
 *
 * Usage in (sync) exterior builders:
 *   import { mountAsset } from "@/city/modules/assets/loadAsset";
 *   const g = new THREE.Group();
 *   const body = buildProceduralBody();      // old code
 *   body.userData.proceduralBody = true;    // tagged for swap-out
 *   g.add(body, signMesh, doorGlow);
 *   mountAsset(g, "buildings/commercial/shop-a", { scale: 10 });
 *   // -> when the GLB is cached it replaces the procedural body immediately;
 *   //    otherwise it loads async and swaps when ready. On load failure the
 *    //   procedural body stays, so the world never shows an empty lot.
 *
 * Perf: templates are cached once; `clone(true)` shares geometries/materials
 * across instances (do NOT dispose shared geometries per-instance).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const CITY_ASSET_BASE = "/assets/city";

const loader = new GLTFLoader();
const templateCache = new Map<string, THREE.Group>();
const pendingLoads = new Map<string, Promise<THREE.Group | null>>();

function keyToUrl(key: string): string {
  return `${CITY_ASSET_BASE}/${key}.glb`;
}

function loadTemplate(key: string): Promise<THREE.Group | null> {
  const hit = templateCache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = pendingLoads.get(key);
  if (pending) return pending;
  const p = loader
    .loadAsync(keyToUrl(key))
    .then((gltf) => {
      const scene = gltf.scene;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      templateCache.set(key, scene);
      pendingLoads.delete(key);
      return scene;
    })
    .catch((err: unknown) => {
      // Non-fatal: callers keep their procedural fallback.
      console.warn(`[city-assets] failed to load "${key}"`, err);
      pendingLoads.delete(key);
      return null;
    });
  pendingLoads.set(key, p);
  return p;
}

/** Preload a set of asset keys. Idempotent; failures resolve as null. */
export async function preloadCityAssets(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => loadTemplate(k)));
}

/** Asset keys used by the district integration (buildings, cars, props). */
export const PILOT_ASSET_KEYS = [
  "buildings/commercial/shop-a",
  "buildings/commercial/shop-b",
  "buildings/commercial/shop-c",
  "buildings/commercial/shop-d",
  "buildings/commercial/shop-e",
  "buildings/commercial/shop-f",
  "buildings/commercial/shop-g",
  "buildings/commercial/shop-h",
  "buildings/commercial/shop-n",
  "buildings/commercial/tower-a",
  "buildings/commercial/tower-b",
  "vehicles/sedan",
  "vehicles/suv",
  "vehicles/taxi",
  "vehicles/van",
  "vehicles/police",
  "vehicles/truck",
  "props/street/lamp-curved",
  "props/street/lamp-square",
  "props/street/cone",
  "props/street/barrier",
  "props/street/dumpster",
  "props/nature/tree-large",
  "props/nature/tree-small",
  "props/nature/planter",
] as const;

/** Fire-and-forget preload of the pilot set. Call once at world boot. */
export function preloadPilotAssets(): void {
  void preloadCityAssets([...PILOT_ASSET_KEYS]);
}

/** Synchronous deep clone of a cached template, or null if not loaded yet. */
export function instantiateAsset(key: string): THREE.Group | null {
  const t = templateCache.get(key);
  return t ? t.clone(true) : null;
}

export interface MountOpts {
  position?: [number, number, number];
  rotationY?: number;
  /** Uniform scale, or per-axis [x, y, z]. */
  scale?: number | [number, number, number];
}

/**
 * Mount a GLB into `parent`, removing children tagged `userData.proceduralBody`.
 * Sync-safe: uses the cache when warm, otherwise swaps in when the load lands.
 */
export function mountAsset(parent: THREE.Group, key: string, opts: MountOpts = {}): void {
  const place = (template: THREE.Group) => {
    for (let i = parent.children.length - 1; i >= 0; i--) {
      const c = parent.children[i];
      if (c.userData.proceduralBody) parent.remove(c);
    }
    const inst = template.clone(true);
    if (opts.position) inst.position.set(...opts.position);
    if (opts.rotationY) inst.rotation.y = opts.rotationY;
    if (typeof opts.scale === "number") inst.scale.setScalar(opts.scale);
    else if (opts.scale) inst.scale.set(...opts.scale);
    parent.add(inst);
  };
  const cached = templateCache.get(key);
  if (cached) {
    place(cached);
    return;
  }
  void loadTemplate(key).then((t) => {
    if (t) place(t);
  });
}
