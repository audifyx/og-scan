import { useMemo } from "react";
import * as THREE from "three";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";
import { GRAFFITI_TAGS, createGraffitiTexture } from "@/lib/orbitxcity/textures";

interface DecalSpec {
  id: string;
  text: string;
  seed: number;
  position: [number, number, number];
  rotationY: number;
  width: number;
}

function GraffitiDecal({ spec }: { spec: DecalSpec }) {
  const texture = useMemo(() => createGraffitiTexture(spec.text, spec.seed), [spec.text, spec.seed]);
  return (
    <mesh position={spec.position} rotation-y={spec.rotationY} renderOrder={2}>
      <planeGeometry args={[spec.width, spec.width / 2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        toneMapped={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

/** Free-standing concrete tag walls for the back alleys. */
const ALLEY_WALLS: Array<{ x: number; z: number; rotY: number; len: number }> = [
  { x: -25, z: -8, rotY: Math.PI / 2, len: 10 },
  { x: 25, z: -12, rotY: -Math.PI / 2, len: 9 },
  { x: -6, z: 25, rotY: Math.PI, len: 11 },
  { x: 9, z: -25, rotY: 0, len: 11 },
  { x: 34, z: 40, rotY: Math.PI / 2, len: 9 },
  { x: -34, z: 44, rotY: -Math.PI / 2, len: 9 },
  { x: 34, z: -40, rotY: Math.PI / 2, len: 8 },
  { x: -20, z: -50, rotY: 0, len: 10 },
];

export function GraffitiLayer() {
  const { buildingDecals, wallDecals } = useMemo(() => {
    const bDecals: DecalSpec[] = [];

    for (const b of NYC_DEMO_BLOCK.buildings) {
      const rand = mulberry32(hashSeed(`graffiti-${b.id}`));
      const faces: Array<"left" | "right" | "back"> = [];
      if (rand() > 0.35) faces.push(rand() > 0.5 ? "left" : "right");
      if (rand() > 0.45) faces.push("back");
      let fi = 0;
      for (const face of faces) {
        const tag = GRAFFITI_TAGS[Math.floor(rand() * GRAFFITI_TAGS.length)];
        const width = Math.min(Math.max(b.size.depth * 0.7, 3), 5.5);
        const y = 1.4 + rand() * 1.6;
        let position: [number, number, number];
        let rotationY: number;
        if (face === "left") {
          position = [b.position.x - b.size.width / 2 - 0.08, y, b.position.z + (rand() - 0.5) * b.size.depth * 0.4];
          rotationY = -Math.PI / 2;
        } else if (face === "right") {
          position = [b.position.x + b.size.width / 2 + 0.08, y, b.position.z + (rand() - 0.5) * b.size.depth * 0.4];
          rotationY = Math.PI / 2;
        } else {
          position = [b.position.x + (rand() - 0.5) * b.size.width * 0.4, y, b.position.z - b.size.depth / 2 - 0.08];
          rotationY = Math.PI;
        }
        bDecals.push({ id: `${b.id}-${face}-${fi++}`, text: tag, seed: hashSeed(`${b.id}${face}${tag}`), position, rotationY, width });
      }
    }

    const wDecals: Array<{ wall: (typeof ALLEY_WALLS)[number]; decals: DecalSpec[] }> = ALLEY_WALLS.map((wall, wi) => {
      const rand = mulberry32(hashSeed(`wall-${wi}`));
      const decals: DecalSpec[] = [0, 1].map((di) => {
        const tag = GRAFFITI_TAGS[Math.floor(rand() * GRAFFITI_TAGS.length)];
        return {
          id: `wall-${wi}-${di}`,
          text: tag,
          seed: hashSeed(`wall${wi}${di}${tag}`),
          position: [(di === 0 ? -1 : 1) * wall.len * 0.22, 1.7 + rand() * 0.6, 0.24] as [number, number, number],
          rotationY: 0,
          width: Math.min(wall.len * 0.46, 4.6),
        };
      });
      return { wall, decals };
    });

    return { buildingDecals: bDecals, wallDecals: wDecals };
  }, []);

  return (
    <group>
      {buildingDecals.map((d) => (
        <GraffitiDecal key={d.id} spec={d} />
      ))}

      {wallDecals.map(({ wall, decals }, wi) => (
        <group key={`aw-${wi}`} position={[wall.x, 0, wall.z]} rotation-y={wall.rotY}>
          <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
            <boxGeometry args={[wall.len, 3.4, 0.35]} />
            <meshStandardMaterial color="#1c2432" emissive="#1c2432" emissiveIntensity={0.4} roughness={0.9} metalness={0.1} />
          </mesh>
          {/* cap */}
          <mesh position={[0, 3.45, 0]}>
            <boxGeometry args={[wall.len + 0.2, 0.14, 0.5]} />
            <meshStandardMaterial color="#0c1018" roughness={0.8} />
          </mesh>
          {decals.map((d) => (
            <GraffitiDecal key={d.id} spec={d} />
          ))}
        </group>
      ))}
    </group>
  );
}
