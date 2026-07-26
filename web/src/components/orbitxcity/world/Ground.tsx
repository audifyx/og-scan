import { useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { getWorldSize, getWorldStreets } from "@/lib/orbitxcity/worlds";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { collidesAt, mulberry32 } from "@/lib/orbitxcity/collision";

function GrassTufts({ block, dense }: { block: WorldBlockConfig; dense: boolean }) {
  const grass = useMemo(() => {
    const rand = mulberry32(0x6a551 ^ block.cityId.length);
    const count = dense ? 950 : 220;
    const geo = new THREE.PlaneGeometry(0.075, 0.48);
    const mat = new THREE.MeshStandardMaterial({
      color: block.cityId === "miami" ? "#557d4f" : block.cityId === "la" ? "#718352" : "#4d6945",
      roughness: 0.96,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let placed = 0;
    for (let attempt = 0; placed < count && attempt < count * 16; attempt++) {
      const x = block.bounds.minX + 2 + rand() * (block.bounds.maxX - block.bounds.minX - 4);
      const z = block.bounds.minZ + 2 + rand() * (block.bounds.maxZ - block.bounds.minZ - 4);
      if (collidesAt(x, z, 0.3, block)) continue;
      const edgeBias = Math.max(Math.abs(x) / Math.max(Math.abs(block.bounds.minX), Math.abs(block.bounds.maxX)), Math.abs(z) / Math.max(Math.abs(block.bounds.minZ), Math.abs(block.bounds.maxZ)));
      if (edgeBias < 0.46 && rand() > 0.16) continue;
      const height = 0.55 + rand() * 0.85;
      q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, (rand() - 0.5) * 0.25));
      s.set(0.65 + rand() * 0.9, height, 0.65 + rand() * 0.9);
      m.compose(new THREE.Vector3(x, 0.19 * height, z), q, s);
      mesh.setMatrixAt(placed++, m);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = dense;
    mesh.receiveShadow = true;
    return mesh;
  }, [block, dense]);
  return <primitive object={grass} />;
}

function makeGrassTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#3a5a38";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = Math.random() > 0.5 ? "#456846" : "#2f4a2e";
    ctx.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAsphaltTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2a2e32";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    const g = 28 + Math.floor(Math.random() * 28);
    ctx.fillStyle = `rgb(${g},${g + 2},${g + 4})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  // faint cracks
  ctx.strokeStyle = "rgba(12,14,16,0.35)";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    ctx.lineTo(Math.random() * 256, Math.random() * 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCementTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#6a7178";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(40,44,48,0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 32, 0);
    ctx.lineTo(i * 32, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * 32);
    ctx.lineTo(128, i * 32);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Street network + weathered asphalt + soft grass shoulders. */
export function Ground({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  const { quality } = useCity();
  const streets = getWorldStreets(block.cityId);
  const worldSize = getWorldSize(block);
  const grassMap = useMemo(() => makeGrassTexture(), []);
  const asphaltMap = useMemo(() => makeAsphaltTexture(), []);
  const cementMap = useMemo(() => makeCementTexture(), []);

  const grassPatches = useMemo(() => {
    const rand = mulberry32(0x61a55);
    const patches: Array<{ x: number; z: number; r: number; rot: number }> = [];
    const n = quality === "high" ? 22 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.2;
      const dist = worldSize * 0.26 + rand() * worldSize * 0.14;
      patches.push({
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        r: 4 + rand() * 7,
        rot: rand() * Math.PI,
      });
    }
    return patches;
  }, [worldSize, quality]);

  return (
    <group>
      {/* Base earth / soil under the city pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[worldSize * 1.2, worldSize * 1.2]} />
        <meshStandardMaterial color="#3d4538" roughness={0.97} metalness={0.02} />
      </mesh>

      {/* City pad asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[worldSize, worldSize]} />
        {quality === "high" ? (
          <MeshReflectorMaterial
            blur={[320, 120]}
            resolution={512}
            mixBlur={1}
            mixStrength={0.45}
            roughness={0.94}
            depthScale={0.35}
            minDepthThreshold={0.6}
            maxDepthThreshold={1.6}
            color="#2a2e32"
            metalness={0.14}
            mirror={0.06}
          />
        ) : (
          <meshStandardMaterial map={asphaltMap} color="#2c3034" metalness={0.1} roughness={0.92} />
        )}
      </mesh>

      {/* Real grass clearings */}
      {grassPatches.map((p, i) => (
        <mesh
          key={`grass-${i}`}
          rotation={[-Math.PI / 2, 0, p.rot]}
          position={[p.x, 0.03, p.z]}
          receiveShadow
        >
          <circleGeometry args={[p.r, quality === "high" ? 28 : 16]} />
          <meshStandardMaterial map={grassMap} color={i % 2 === 0 ? "#3d5c3a" : "#456846"} roughness={0.98} metalness={0} />
        </mesh>
      ))}
      <GrassTufts block={block} dense={quality === "high"} />

      {streets.map((s, i) => {
        const len = s.to - s.from;
        const mid = (s.from + s.to) / 2;
        const horizontal = s.o === "h";
        const pos: [number, number, number] = horizontal ? [mid, 0.03 + i * 0.002, s.at] : [s.at, 0.03 + i * 0.002, mid];
        const planeSize: [number, number] = horizontal ? [len, s.w] : [s.w, len];
        return (
          <group key={`street-${i}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={pos} receiveShadow>
              <planeGeometry args={planeSize} />
              <meshStandardMaterial map={asphaltMap} color="#1e2226" metalness={0.12} roughness={0.9} />
            </mesh>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={horizontal ? [mid, 0.045 + i * 0.002, s.at] : [s.at, 0.045 + i * 0.002, mid]}
            >
              <planeGeometry args={horizontal ? [len - 2, 0.08] : [0.08, len - 2]} />
              <meshStandardMaterial color="#c9c3a8" transparent opacity={0.35} roughness={0.8} />
            </mesh>
            {/* Cement sidewalks flanking the curb */}
            {[-1, 1].map((side) => {
              const off = s.at + side * (s.w / 2 + 0.95);
              return (
                <mesh
                  key={`walk-${side}`}
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={horizontal ? [mid, 0.035 + i * 0.002, off] : [off, 0.035 + i * 0.002, mid]}
                  receiveShadow
                >
                  <planeGeometry args={horizontal ? [len, 1.4] : [1.4, len]} />
                  <meshStandardMaterial map={cementMap} color="#6a7178" roughness={0.9} metalness={0.04} />
                </mesh>
              );
            })}
            {/* Weathered stone curbs */}
            {[-1, 1].map((side) => {
              const off = s.at + side * (s.w / 2 + 0.22);
              return (
                <mesh
                  key={side}
                  position={horizontal ? [mid, 0.05, off] : [off, 0.05, mid]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={horizontal ? [len, 0.1, 0.28] : [0.28, 0.1, len]} />
                  <meshStandardMaterial color="#6a7178" metalness={0.08} roughness={0.86} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
