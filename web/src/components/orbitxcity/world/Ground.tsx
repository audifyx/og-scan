/**
 * City ground — asphalt roads, raised sidewalks, curbs, grass shoulders.
 * No mirror-pad void: night lighting must read on real materials.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { getWorldSize, getWorldStreets } from "@/lib/orbitxcity/worlds";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { collidesAt, mulberry32 } from "@/lib/orbitxcity/collision";

function makeCanvasTexture(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeat: number,
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  paint(c.getContext("2d")!, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeGrassTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    (ctx, n) => {
      ctx.fillStyle = "#3f5a38";
      ctx.fillRect(0, 0, n, n);
      for (let i = 0; i < 2200; i++) {
        ctx.fillStyle = i % 3 === 0 ? "#4d6e44" : i % 3 === 1 ? "#2f4a2c" : "#5a6e3e";
        ctx.fillRect(Math.random() * n, Math.random() * n, 1 + Math.random() * 2, 2 + Math.random() * 5);
      }
      ctx.fillStyle = "rgba(70, 52, 32, 0.18)";
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * n, Math.random() * n, 8 + Math.random() * 18, 4 + Math.random() * 8, Math.random(), 0, Math.PI * 2);
        ctx.fill();
      }
    },
    5,
  );
}

function makeAsphaltTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    (ctx, n) => {
      ctx.fillStyle = "#2c3238";
      ctx.fillRect(0, 0, n, n);
      for (let i = 0; i < 3200; i++) {
        const g = 36 + Math.floor(Math.random() * 40);
        ctx.fillStyle = `rgb(${g},${g + 2},${g + 6})`;
        ctx.fillRect(Math.random() * n, Math.random() * n, 1, 1);
      }
      ctx.strokeStyle = "rgba(10,12,14,0.5)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 22; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * n, Math.random() * n);
        ctx.lineTo(Math.random() * n, Math.random() * n);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(18, 16, 14, 0.22)";
      for (let i = 0; i < 16; i++) {
        ctx.fillRect(Math.random() * n, Math.random() * n, 6 + Math.random() * 18, 2);
      }
    },
    6,
  );
}

function makeCementTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    128,
    (ctx, n) => {
      ctx.fillStyle = "#7a8188";
      ctx.fillRect(0, 0, n, n);
      for (let i = 0; i < 400; i++) {
        const g = 110 + Math.floor(Math.random() * 28);
        ctx.fillStyle = `rgb(${g},${g + 2},${g + 4})`;
        ctx.fillRect(Math.random() * n, Math.random() * n, 1, 1);
      }
      ctx.strokeStyle = "rgba(40,44,48,0.4)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 32, 0);
        ctx.lineTo(i * 32, n);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * 32);
        ctx.lineTo(n, i * 32);
        ctx.stroke();
      }
    },
    10,
  );
}

function GrassTufts({ block, dense }: { block: WorldBlockConfig; dense: boolean }) {
  const grass = useMemo(() => {
    const rand = mulberry32(0x6a551 ^ block.cityId.length);
    const count = dense ? 520 : 160;
    const geo = new THREE.PlaneGeometry(0.08, 0.42);
    const mat = new THREE.MeshStandardMaterial({
      color: block.cityId === "miami" ? "#5a8a52" : block.cityId === "la" ? "#7a9258" : "#4d6945",
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
        Math.abs(x) / Math.max(Math.abs(block.bounds.minX), Math.abs(block.bounds.maxX), 1),
        Math.abs(z) / Math.max(Math.abs(block.bounds.minZ), Math.abs(block.bounds.maxZ), 1),
      );
      if (edgeBias < 0.42 && rand() > 0.14) continue;
      const height = 0.55 + rand() * 0.85;
      q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, (rand() - 0.5) * 0.25));
      s.set(0.65 + rand() * 0.9, height, 0.65 + rand() * 0.9);
      m.compose(new THREE.Vector3(x, 0.16 * height, z), q, s);
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

function RoadWear({ block, dense }: { block: WorldBlockConfig; dense: boolean }) {
  const cracks = useMemo(() => {
    const rand = mulberry32(0xc2a44 ^ block.cityId.charCodeAt(0));
    const count = dense ? 48 : 20;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: "#1a1c20", roughness: 0.96, metalness: 0.04 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let placed = 0;
    for (let i = 0; placed < count && i < count * 8; i++) {
      const x = block.bounds.minX + 4 + rand() * (block.bounds.maxX - block.bounds.minX - 8);
      const z = block.bounds.minZ + 4 + rand() * (block.bounds.maxZ - block.bounds.minZ - 8);
      if (collidesAt(x, z, 0.6, block)) continue;
      q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0));
      s.set(1.1 + rand() * 3.2, 0.03, 0.05 + rand() * 0.06);
      m.compose(new THREE.Vector3(x, 0.045, z), q, s);
      mesh.setMatrixAt(placed++, m);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [block, dense]);
  return <primitive object={cracks} />;
}

/** Street network + sidewalks + grass — readable at night without reflector voids. */
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
    const n = high ? 20 : 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.2;
      const dist = worldSize * 0.28 + rand() * worldSize * 0.12;
      patches.push({
        x: Math.cos(a) * dist,
        z: Math.sin(a) * dist,
        r: 4.2 + rand() * 6.5,
        rot: rand() * Math.PI,
      });
    }
    return patches;
  }, [worldSize, high]);

  return (
    <group>
      {/* Dirt / park shoulder — not a black void */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[worldSize * 1.35, worldSize * 1.35]} />
        <meshStandardMaterial color="#3a4238" roughness={0.97} metalness={0.02} />
      </mesh>

      {/* City slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[worldSize, worldSize]} />
            <meshStandardMaterial map={asphaltMap} color="#3a424c" metalness={0.12} roughness={0.82} emissive="#1a222c" emissiveIntensity={0.08} />
      </mesh>

      <RoadWear block={block} dense={high} />

      {grassPatches.map((p, i) => (
        <group key={`grass-${i}`}>
          <mesh rotation={[-Math.PI / 2, 0, p.rot]} position={[p.x, 0.025, p.z]} receiveShadow>
            <circleGeometry args={[p.r + 0.55, high ? 24 : 14]} />
            <meshStandardMaterial color="#5a4a38" roughness={0.96} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, p.rot]} position={[p.x, 0.04, p.z]} receiveShadow>
            <circleGeometry args={[p.r, high ? 28 : 16]} />
            <meshStandardMaterial map={grassMap} color={i % 2 === 0 ? "#4a6a42" : "#547848"} roughness={0.97} metalness={0} />
          </mesh>
        </group>
      ))}
      <GrassTufts block={block} dense={high} />

      {streets.map((s, i) => {
        const len = s.to - s.from;
        const mid = (s.from + s.to) / 2;
        const horizontal = s.o === "h";
        const yRoad = 0.035 + i * 0.001;
        const pos: [number, number, number] = horizontal ? [mid, yRoad, s.at] : [s.at, yRoad, mid];
        const planeSize: [number, number] = horizontal ? [Math.abs(len), s.w] : [s.w, Math.abs(len)];
        const dashCount = Math.max(2, Math.floor(Math.abs(len) / 4.6));
        return (
          <group key={`street-${i}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={pos} receiveShadow>
              <planeGeometry args={planeSize} />
              <meshStandardMaterial map={asphaltMap} color="#343a42" metalness={0.16} roughness={0.78} emissive="#1c242c" emissiveIntensity={0.1} />
            </mesh>
            {Array.from({ length: dashCount }).map((_, di) => {
              const t = (di + 0.5) / dashCount;
              const along = s.from + (s.to - s.from) * t;
              return (
                <mesh
                  key={`dash-${di}`}
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={horizontal ? [along, yRoad + 0.012, s.at] : [s.at, yRoad + 0.012, along]}
                >
                  <planeGeometry args={horizontal ? [1.55, 0.14] : [0.14, 1.55]} />
                  <meshStandardMaterial color="#f2ecd0" emissive="#cfc6a0" emissiveIntensity={0.22} roughness={0.55} />
                </mesh>
              );
            })}
            {[0.1, 0.9].map((t) => {
              const along = s.from + (s.to - s.from) * t;
              return (
                <group key={`xw-${t}`}>
                  {Array.from({ length: 6 }).map((_, bi) => {
                    const lat = (bi - 2.5) * 0.4;
                    return (
                      <mesh
                        key={bi}
                        rotation={[-Math.PI / 2, 0, 0]}
                        position={
                          horizontal
                            ? [along, yRoad + 0.014, s.at + lat]
                            : [s.at + lat, yRoad + 0.014, along]
                        }
                      >
                        <planeGeometry args={horizontal ? [0.62, 0.3] : [0.3, 0.62]} />
                        <meshStandardMaterial color="#efeae0" roughness={0.7} />
                      </mesh>
                    );
                  })}
                </group>
              );
            })}
            {[-1, 1].map((side) => {
              const walkOff = s.at + side * (s.w / 2 + 1.05);
              const curbOff = s.at + side * (s.w / 2 + 0.22);
              const walkPos: [number, number, number] = horizontal
                ? [mid, 0.07, walkOff]
                : [walkOff, 0.07, mid];
              const curbPos: [number, number, number] = horizontal
                ? [mid, 0.08, curbOff]
                : [curbOff, 0.08, mid];
              return (
                <group key={`edge-${side}`}>
                  <mesh position={walkPos} receiveShadow>
                    <boxGeometry args={horizontal ? [Math.abs(len), 0.12, 1.7] : [1.7, 0.12, Math.abs(len)]} />
                    <meshStandardMaterial map={cementMap} color="#8a9198" roughness={0.88} metalness={0.05} />
                  </mesh>
                  <mesh position={curbPos} castShadow receiveShadow>
                    <boxGeometry args={horizontal ? [Math.abs(len), 0.18, 0.28] : [0.28, 0.18, Math.abs(len)]} />
                    <meshStandardMaterial color="#9aa0a6" metalness={0.08} roughness={0.82} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
