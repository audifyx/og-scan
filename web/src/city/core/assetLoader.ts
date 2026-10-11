/**
 * OrbitX City — GLTF asset loader with caching, fallbacks, and LOD.
 *
 * - Caches loaded models; clones for placement (shares geometry/materials)
 * - Falls back to a procedural box building if a GLB fails to load
 * - Exposes load progress for the loading screen
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { AssetEntry } from "./assetManifest";

const loader = new GLTFLoader();
const cache = new Map<string, THREE.Group>();

let loadedCount = 0;
let totalCount = 0;
const progressListeners = new Set<(loaded: number, total: number) => void>();

export function onAssetProgress(fn: (loaded: number, total: number) => void): () => void {
  progressListeners.add(fn);
  return () => { progressListeners.delete(fn); };
}

function emit() {
  for (const fn of progressListeners) fn(loadedCount, totalCount);
}

function proceduralFallback(entry: AssetEntry): THREE.Group {
  // Simple but decent-looking fallback: box with window-ish material
  const g = new THREE.Group();
  const [w, d] = entry.footprint;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, entry.height, d),
    new THREE.MeshStandardMaterial({ color: 0xb8c4d0, roughness: 0.85 })
  );
  body.position.y = entry.height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x8a939e, roughness: 0.95 })
  );
  roof.position.y = entry.height + 0.25;
  g.add(roof);
  return g;
}

/** Preload a list of assets (for the loading screen). */
export async function preloadAssets(entries: AssetEntry[]): Promise<void> {
  totalCount = entries.length;
  loadedCount = 0;
  emit();
  await Promise.all(entries.map(e => loadAsset(e).catch(() => null)));
}

/** Load (or get cached) a model group for an asset entry. */
export function loadAsset(entry: AssetEntry): Promise<THREE.Group> {
  const cached = cache.get(entry.path);
  if (cached) return Promise.resolve(cached.clone());

  return new Promise((resolve) => {
    loader.load(
      `/${entry.path}`,
      (gltf) => {
        const group = gltf.scene;
        group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        // Normalize scale: Kenney models are ~1 unit = 1m already, but
        // ensure the footprint roughly matches by scaling XZ if needed.
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        box.getSize(size);
        if (size.x > 0.01 && size.z > 0.01) {
          const sx = entry.footprint[0] / size.x;
          const sz = entry.footprint[1] / size.z;
          const s = Math.min(sx, sz);
          // Only rescale if wildly off (avoid distorting well-made models)
          if (s < 0.5 || s > 2.0) group.scale.setScalar(s);
        }
        cache.set(entry.path, group);
        loadedCount++;
        emit();
        resolve(group.clone());
      },
      undefined,
      () => {
        // Fallback: procedural box so the city never has holes
        loadedCount++;
        emit();
        resolve(proceduralFallback(entry));
      }
    );
  });
}

/** Clear the cache (e.g. on quality change). */
export function clearAssetCache(): void {
  cache.clear();
}
