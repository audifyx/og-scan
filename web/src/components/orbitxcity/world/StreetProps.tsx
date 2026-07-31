import { useMemo } from "react";
import { Clone, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { collidesAt } from "@/lib/orbitxcity/collision";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { CITY_STREET_MODELS } from "@/lib/orbitxcity/assets/catalog";
import { getWorldStreets } from "@/lib/orbitxcity/worlds";

const BENCH_PATH = CITY_STREET_MODELS.bench;
useGLTF.preload(BENCH_PATH);

const LAMP_SPACING = 16;

/** Instanced street lamps generated along every street segment. */
function LampField({ block }: { block: WorldBlockConfig }) {
  const streets = getWorldStreets(block.cityId);
  const { poles, heads } = useMemo(() => {
    const spots: Array<[number, number]> = [];
    for (const s of streets) {
      const off = s.w / 2 + 1;
      for (let t = s.from + 6; t <= s.to - 4; t += LAMP_SPACING) {
        const a: [number, number] = s.o === "h" ? [t, s.at + off] : [s.at + off, t];
        const b: [number, number] = s.o === "h" ? [t + LAMP_SPACING / 2, s.at - off] : [s.at - off, t + LAMP_SPACING / 2];
        for (const p of [a, b]) {
          if (!collidesAt(p[0], p[1], 0.4, block)) spots.push(p);
        }
      }
    }

    if (!spots.length) return { poles: null, heads: null };

    const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 4.8, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: "#1a2232", metalness: 0.75, roughness: 0.3 });
    const polesMesh = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);

    const headGeo = new THREE.BoxGeometry(0.55, 0.14, 0.28);
    const headMat = new THREE.MeshStandardMaterial({
      color: "#d8d2c0",
      emissive: "#c4b896",
      emissiveIntensity: 0.45,
      metalness: 0.35,
      roughness: 0.4,
    });
    const headsMesh = new THREE.InstancedMesh(headGeo, headMat, spots.length);

    const m = new THREE.Matrix4();
    spots.forEach(([x, z], i) => {
      m.setPosition(x, 2.4, z);
      polesMesh.setMatrixAt(i, m);
      m.setPosition(x, 4.85, z);
      headsMesh.setMatrixAt(i, m);
    });
    polesMesh.instanceMatrix.needsUpdate = true;
    headsMesh.instanceMatrix.needsUpdate = true;
    return { poles: polesMesh, heads: headsMesh };
  }, [block, streets]);

  if (!poles || !heads) return null;

  return (
    <group>
      <primitive object={poles} />
      <primitive object={heads} />
    </group>
  );
}

function ZoneMarker({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.18, 24]} />
        <meshStandardMaterial color="#5a6168" metalness={0.2} roughness={0.75} />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 2.6, 8]} />
        <meshStandardMaterial color="#3a4046" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.85, 0]}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#e8e2d2" emissive="#cfc6b0" emissiveIntensity={0.35} metalness={0.15} roughness={0.35} />
      </mesh>
    </group>
  );
}

function Crosswalks({ block }: { block: WorldBlockConfig }) {
  const streets = getWorldStreets(block.cityId);
  const crossings = useMemo(() => {
    const horizontal = streets.filter((s) => s.o === "h");
    const vertical = streets.filter((s) => s.o === "v");
    return horizontal.flatMap((h) =>
      vertical
        .filter((v) => v.at >= h.from && v.at <= h.to && h.at >= v.from && h.at <= v.to)
        .map((v) => ({ x: v.at, z: h.at, hw: h.w, vw: v.w })),
    );
  }, [streets]);

  return (
    <group>
      {crossings.map((crossing, i) => (
        <group key={`${crossing.x}-${crossing.z}`}>
          {[-1, 1].flatMap((direction) =>
            [-1.2, -0.4, 0.4, 1.2].map((offset) => (
              <mesh
                key={`${direction}-${offset}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[
                  direction * (crossing.vw / 2 - 0.5),
                  0.072 + i * 0.001,
                  crossing.z + offset,
                ]}
              >
                <planeGeometry args={[0.42, 0.48]} />
                <meshStandardMaterial color="#d8d0b8" transparent opacity={0.42} roughness={0.92} />
              </mesh>
            )),
          )}
          {[-1, 1].flatMap((direction) =>
            [-1.2, -0.4, 0.4, 1.2].map((offset) => (
              <mesh
                key={`h-${direction}-${offset}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[
                  crossing.x + offset,
                  0.073 + i * 0.001,
                  direction * (crossing.hw / 2 - 0.5) + crossing.z,
                ]}
              >
                <planeGeometry args={[0.48, 0.42]} />
                <meshStandardMaterial color="#d8d0b8" transparent opacity={0.42} roughness={0.92} />
              </mesh>
            )),
          )}
        </group>
      ))}
    </group>
  );
}

function StreetFurniture({ block }: { block: WorldBlockConfig }) {
  const { scene } = useGLTF(BENCH_PATH);
  return (
    <group>
      {block.zones.slice(0, 10).map((zone, i) => {
        const x = zone.position.x + (i % 2 === 0 ? 2.1 : -2.1);
        const z = zone.position.z + (i % 3 === 0 ? 1.2 : -1.2);
        if (collidesAt(x, z, 0.5, block)) return null;
        return (
          <Clone
            key={`street-furniture-${zone.id}`}
            object={scene}
            position={[x, 0, z]}
            rotation={[0, (i % 4) * (Math.PI / 2), 0]}
            scale={1.35}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
}

const CURB_SPACING = 11;

/** Hydrants, trash cans, bollards — sidewalk-bound from the street graph. */
function SidewalkScatter({ block }: { block: WorldBlockConfig }) {
  const streets = getWorldStreets(block.cityId);
  const { hydrants, cans, bollards } = useMemo(() => {
    type Spot = { x: number; z: number; yaw: number };
    const hydrantSpots: Spot[] = [];
    const canSpots: Spot[] = [];
    const bollardSpots: Spot[] = [];

    streets.forEach((s, si) => {
      const curb = s.w / 2 + 0.85;
      for (let t = s.from + 4; t <= s.to - 3; t += CURB_SPACING) {
        const side = ((Math.floor(t / CURB_SPACING) + si) % 2 === 0 ? 1 : -1);
        const x = s.o === "h" ? t : s.at + side * curb;
        const z = s.o === "h" ? s.at + side * curb : t;
        if (collidesAt(x, z, 0.35, block)) continue;
        const yaw = s.o === "h" ? 0 : Math.PI / 2;
        const kind = (Math.floor(t * 3 + si * 7) % 5);
        if (kind === 0) hydrantSpots.push({ x, z, yaw });
        else if (kind === 1 || kind === 2) canSpots.push({ x, z, yaw });
        else bollardSpots.push({ x, z, yaw });
      }
    });

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    const pack = (
      spots: Spot[],
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      y: number,
    ) => {
      if (!spots.length) return null;
      const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
      spots.forEach((p, i) => {
        q.setFromEuler(new THREE.Euler(0, p.yaw, 0));
        m.compose(new THREE.Vector3(p.x, y, p.z), q, scale);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      return mesh;
    };

    return {
      hydrants: pack(
        hydrantSpots,
        new THREE.CylinderGeometry(0.16, 0.2, 0.72, 8),
        new THREE.MeshStandardMaterial({ color: "#b23a3a", metalness: 0.45, roughness: 0.48 }),
        0.36,
      ),
      cans: pack(
        canSpots,
        new THREE.CylinderGeometry(0.22, 0.24, 0.85, 10),
        new THREE.MeshStandardMaterial({ color: "#3a424c", metalness: 0.55, roughness: 0.42 }),
        0.42,
      ),
      bollards: pack(
        bollardSpots,
        new THREE.CylinderGeometry(0.09, 0.11, 0.95, 8),
        new THREE.MeshStandardMaterial({
          color: "#c5a26f",
          metalness: 0.5,
          roughness: 0.4,
          emissive: "#c5a26f",
          emissiveIntensity: 0.12,
        }),
        0.48,
      ),
    };
  }, [block, streets]);

  return (
    <group>
      {hydrants && <primitive object={hydrants} />}
      {cans && <primitive object={cans} />}
      {bollards && <primitive object={bollards} />}
    </group>
  );
}

/** Street furniture: lamps, crossings, benches, curb scatter, zone markers. */
export function StreetProps({ block = NYC_DEMO_BLOCK }: { block?: WorldBlockConfig }) {
  return (
    <group>
      <LampField block={block} />
      <Crosswalks block={block} />
      <SidewalkScatter block={block} />
      <StreetFurniture block={block} />
      {block.zones.slice(0, 6).map((zone) => (
        <ZoneMarker key={zone.id} x={zone.position.x} z={zone.position.z} />
      ))}
    </group>
  );
}
