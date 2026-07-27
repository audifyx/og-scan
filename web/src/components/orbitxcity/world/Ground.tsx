/**
 * City ground — wet reflective pad, asphalt streets, extruded crack shards, sidewalks.
 */
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
      const edgeBias = Math.max(
        Math.abs(x) / Math.max(Math.abs(block.bounds.minX), Math.abs(block.bounds.maxX)),
        Math.abs(z) / Math.max(Math.abs(block.bounds.minZ), Math.abs(block.bounds.maxZ)),
      );
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

/** Extruded asphalt cracks — thin raised boxes that read as fractured road. */
function RoadCracks({ block, dense }: { block: WorldBlockConfig; dense: boolean }) {
  const cracks = useMemo(() => {
    const rand = mulberry32(0xc2a44 ^ block.cityId.charCodeAt(0));
    const count = dense ? 64 : 28;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: "#0e1014",
      roughness: 0.95,
      metalness: 0.05,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let placed = 0;
    for (let i = 0; placed < count && i < count * 8; i++) {
      const x = block.bounds.minX + 4 + rand() * (block.bounds.maxX - block.bounds.minX - 8);
      const z = block.bounds.minZ + 4 + rand() * (block.bounds.maxZ - block.bounds.minZ - 8);
      if (collidesAt(x, z, 0.6, block)) continue;
      const len = 1.2 + rand() * 3.5;
      const thick = 0.04 + rand() * 0.06;
      q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0));
      s.set(len, 0.035, thick);
      m.compose(new THREE.Vector3(x, 0.04, z), q, s);
      mesh.setMatrixAt(placed++, m);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [block, dense]);
  return <primitive object={cracks} />;
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
  ctx.fillStyle = "#24282c";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const g = 24 + Math.floor(Math.random() * 32);
    ctx.fillStyle = `rgb(${g},${g + 2},${g + 4})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  ctx.strokeStyle = "rgba(8,10,12,0.45)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    for (let j = 0; j < 3; j++) {
      ctx.lineTo(Math.random() * 256, Math.random() * 256);
    }
    ctx.stroke();
  }
  // wet sheen streaks
  ctx.strokeStyle = "rgba(160,180,200,0.08)";
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * 256);
    ctx.lineTo(256, Math.random() * 256);
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

/** Street network + wet cracked asphalt + soft grass shoulders. */
export function Ground({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  const { quality } = useCity();
  const streets = getWorldStreets(block.cityId);
  const worldSize = getWorldSize(block);
  const grassMap = useMemo(() => makeGrassTexture(), []);
  const asphaltMap = useMemo(() => makeAsphaltTexture(), []);
  const cementMap = useMemo(() => makeCementTexture(), []);
  const high = quality === "high";

  const grassPatches = useMemo(() => {
    const rand = mulberry32(0x61a55);
    const patches: Array<{ x: number; z: number; r: number; rot: number }> = [];
    const n = high ? 22 : 10;
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
  }, [worldSize, high]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[worldSize * 1.2, worldSize * 1.2]} />
        <meshStandardMaterial color="#3d4538" roughness={0.97} metalness={0.02} />
      </mesh>

      {/* Wet reflective city pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[worldSize, worldSize]} />
        {high ? (
          <MeshReflectorMaterial
            blur={[280, 90]}
            resolution={512}
            mixBlur={0.85}
            mixStrength={0.72}
            roughness={0.55}
            depthScale={0.4}
            minDepthThreshold={0.55}
            maxDepthThreshold={1.5}
            color="#1e242a"
            metalness={0.35}
            mirror={0.18}
          />
        ) : (
          <meshStandardMaterial map={asphaltMap} color="#222830" metalness={0.28} roughness={0.62} />
        )}
      </mesh>

      <RoadCracks block={block} dense={high} />

      {grassPatches.map((p, i) => (
        <mesh key={`grass-${i}`} rotation={[-Math.PI / 2, 0, p.rot]} position={[p.x, 0.03, p.z]} receiveShadow>
          <circleGeometry args={[p.r, high ? 28 : 16]} />
          <meshStandardMaterial map={grassMap} color={i % 2 === 0 ? "#3d5c3a" : "#456846"} roughness={0.98} metalness={0} />
        </mesh>
      ))}
      <GrassTufts block={block} dense={high} />

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
              {high ? (
                <MeshReflectorMaterial
                  blur={[180, 60]}
                  resolution={256}
                  mixBlur={0.7}
                  mixStrength={0.55}
                  roughness={0.48}
                  color="#181c22"
                  metalness={0.32}
                  mirror={0.14}
                />
              ) : (
                <meshStandardMaterial map={asphaltMap} color="#1a1e24" metalness={0.22} roughness={0.7} />
              )}
            </mesh>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={horizontal ? [mid, 0.045 + i * 0.002, s.at] : [s.at, 0.045 + i * 0.002, mid]}
            >
              <planeGeometry args={horizontal ? [len - 2, 0.08] : [0.08, len - 2]} />
              <meshStandardMaterial color="#c9c3a8" transparent opacity={0.4} roughness={0.75} />
            </mesh>
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
