import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/lib/orbitxcity/collision";
import { getDayNight } from "@/lib/orbitxcity/dayNight";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";

const TOWER_COUNT_HIGH = 96;
const TOWER_COUNT_LITE = 36;

function cityPalette(cityId: string): { base: [number, number, number]; lit: [number, number, number] } {
  if (cityId === "miami") return { base: [0.18, 0.26, 0.3], lit: [0.55, 0.75, 0.72] };
  if (cityId === "la") return { base: [0.22, 0.2, 0.24], lit: [0.75, 0.55, 0.4] };
  if (cityId === "boston") return { base: [0.2, 0.22, 0.26], lit: [0.55, 0.62, 0.72] };
  return { base: [0.2, 0.23, 0.27], lit: [0.72, 0.68, 0.55] };
}

/**
 * Shared distant-tower window texture: dark facade with a sparse lit-window
 * grid. The lit cells live in the emissive map so the whole skyline glows
 * warm at night with a single material mutation (see useFrame below).
 */
function makeSkylineTexture(): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture } {
  const W = 128;
  const H = 256;
  const r = mulberry32(0x5c11e);
  const mapC = document.createElement("canvas");
  mapC.width = W;
  mapC.height = H;
  const emC = document.createElement("canvas");
  emC.width = W;
  emC.height = H;
  const ctx = mapC.getContext("2d")!;
  const ectx = emC.getContext("2d")!;
  ctx.fillStyle = "#232a33";
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = "#000000";
  ectx.fillRect(0, 0, W, H);
  const cols = 6;
  const rows = 22;
  const cw = W / cols;
  const ch = H / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw + cw * 0.22;
      const y = row * ch + ch * 0.22;
      const lit = r() < 0.42;
      if (lit) {
        const warm = r() > 0.25;
        const tint = warm ? "#f0d7a0" : "#bcd4e8";
        ctx.fillStyle = tint;
        ctx.fillRect(x, y, cw * 0.56, ch * 0.56);
        ectx.fillStyle = tint;
        ectx.fillRect(x, y, cw * 0.56, ch * 0.56);
      } else {
        ctx.fillStyle = "#141a22";
        ctx.fillRect(x, y, cw * 0.56, ch * 0.56);
      }
    }
  }
  const map = new THREE.CanvasTexture(mapC);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emC);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

/** Distant tower ring — denser Midtown silhouettes with warm window tint. */
export function Skyline({ block = NYC_DEMO_BLOCK, lite = false }: { block?: WorldBlockConfig; lite?: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const { towers, antennas } = useMemo(() => {
    const count = lite ? TOWER_COUNT_LITE : TOWER_COUNT_HIGH;
    const rand = mulberry32(0x0b17c17 ^ block.cityId.length * 17);
    const palette = cityPalette(block.cityId);
    const { map, emissiveMap } = makeSkylineTexture();
    map.repeat.set(1, 1);

    const towerGeo = new THREE.BoxGeometry(1, 1, 1);
    const towerMat = new THREE.MeshStandardMaterial({
      map,
      emissiveMap,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.2,
      metalness: 0.28,
      roughness: 0.72,
    });
    matRef.current = towerMat;
    const towersMesh = new THREE.InstancedMesh(towerGeo, towerMat, count);

    const antennaGeo = new THREE.CylinderGeometry(0.06, 0.1, 4, 6);
    const antennaMat = new THREE.MeshStandardMaterial({ color: "#1a2232", metalness: 0.6, roughness: 0.4 });
    const antennaSpots: Array<{ x: number; z: number; topY: number }> = [];

    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand() * 0.12;
      const ring = i % 3;
      const radius = (ring === 0 ? 68 : ring === 1 ? 88 : 108) + rand() * 18;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const w = 2.4 + rand() * (ring === 0 ? 6 : 4.5);
      const h = (ring === 0 ? 18 : ring === 1 ? 28 : 14) + rand() * (ring === 1 ? 36 : 22);
      const d = 2.4 + rand() * (ring === 0 ? 6 : 4.5);

      m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      towersMesh.setMatrixAt(i, m);

      const lit = rand() > 0.45;
      if (lit) {
        color.setRGB(
          palette.base[0] + palette.lit[0] * 0.35,
          palette.base[1] + palette.lit[1] * 0.35,
          palette.base[2] + palette.lit[2] * 0.35,
        );
      } else {
        color.setRGB(
          palette.base[0] + rand() * 0.06,
          palette.base[1] + rand() * 0.06,
          palette.base[2] + rand() * 0.06,
        );
      }
      towersMesh.setColorAt(i, color);

      if (h > 30 && rand() > 0.5) antennaSpots.push({ x, z, topY: h });
    }
    towersMesh.instanceMatrix.needsUpdate = true;
    if (towersMesh.instanceColor) towersMesh.instanceColor.needsUpdate = true;
    towersMesh.castShadow = false;
    towersMesh.receiveShadow = false;
    towersMesh.frustumCulled = true;

    const antennaMesh = new THREE.InstancedMesh(antennaGeo, antennaMat, Math.max(1, antennaSpots.length));
    antennaSpots.forEach((a, i) => {
      m.compose(new THREE.Vector3(a.x, a.topY + 2, a.z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
      antennaMesh.setMatrixAt(i, m);
    });
    antennaMesh.count = antennaSpots.length;
    antennaMesh.instanceMatrix.needsUpdate = true;
    antennaMesh.frustumCulled = true;

    return { towers: towersMesh, antennas: antennaMesh };
  }, [block.cityId, lite]);

  // Skyline windows brighten at night; fade back by day — one material write.
  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.emissiveIntensity = 0.08 + getDayNight().windowLevel * 1.1;
  });

  return (
    <group>
      <primitive object={towers} />
      <primitive object={antennas} />
    </group>
  );
}
