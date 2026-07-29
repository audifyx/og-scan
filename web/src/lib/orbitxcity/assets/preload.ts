/** Preload all OrbitX City GLTF assets (call once when entering /Orbitxcity). */
import { useGLTF } from "@react-three/drei";
import {
  ALL_GLTF_PATHS,
  ORBITX_PREFERRED_PATHS,
  markModelAvailable,
  probeOrbitxModels,
} from "./catalog";

let preloaded = false;
let probing: Promise<string[]> | null = null;

export function preloadCityAssets(): void {
  if (preloaded || typeof window === "undefined") return;
  preloaded = true;

  for (const path of ALL_GLTF_PATHS) {
    try {
      useGLTF.preload(path);
    } catch {
      /* HMR / SSR — ignore */
    }
  }

  // Probe custom OrbitX GLBs; preload only those that exist.
  probing = probeOrbitxModels().then((found) => {
    for (const path of found) {
      markModelAvailable(path);
      try {
        useGLTF.preload(path);
      } catch {
        /* ignore */
      }
    }
    return found;
  });
}

export function getPreloadPaths(): readonly string[] {
  return ALL_GLTF_PATHS;
}

export function getOrbitxPreferredPaths(): readonly string[] {
  return ORBITX_PREFERRED_PATHS;
}

/** Await OrbitX HEAD probe (optional — renderers fall back until ready). */
export function whenOrbitxProbed(): Promise<string[]> {
  if (probing) return probing;
  preloadCityAssets();
  return probing ?? Promise.resolve([]);
}
