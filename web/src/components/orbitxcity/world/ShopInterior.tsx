/**
 * OrbitX City — visible shop interiors.
 *
 * Every low-rise lot gets a real furnished room behind its glass: floor, back
 * wall, counter, shelving, seating, a lit screen and a standing occupant. The
 * room is cut into the building footprint rather than pasted on, so looking
 * through the window reads as an actual space with depth.
 *
 * Decorative only — no collision, no interaction. Landmark venues keep using
 * the authored interior system.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { hashSeed, mulberry32 } from "@/lib/orbitxcity/collision";

export type ShopKind =
  | "deli"
  | "coffee"
  | "arcade"
  | "barber"
  | "office"
  | "gallery";

export interface ShopInteriorProps {
  /** Room footprint. */
  width: number;
  depth: number;
  kind: ShopKind;
  seed: string;
  /** Skip occupants and small props on low quality. */
  lite?: boolean;
}

const ROOM_H = 3.4;

const PALETTE: Record<
  ShopKind,
  { floor: string; wall: string; accent: string; glow: string }
> = {
  deli: { floor: "#c9b898", wall: "#e6ddc8", accent: "#c9463f", glow: "#ffe9a8" },
  coffee: { floor: "#8a6644", wall: "#d8c9b4", accent: "#6b4630", glow: "#ffd79a" },
  arcade: { floor: "#241d38", wall: "#2f2650", accent: "#b76cff", glow: "#8fdcff" },
  barber: { floor: "#dfe3e8", wall: "#eef1f5", accent: "#2b5d99", glow: "#ffffff" },
  office: { floor: "#5a6270", wall: "#c3ccd9", accent: "#2f7d5c", glow: "#a8f0d0" },
  gallery: { floor: "#e8e6e1", wall: "#f4f3f0", accent: "#1d222b", glow: "#fff3c4" },
};

function mat(color: string, emissive?: string, intensity = 0) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={emissive ?? "#000000"}
      emissiveIntensity={intensity}
      roughness={0.85}
      metalness={0.02}
      flatShading
    />
  );
}

/** Wall-mounted screen with a simple painted UI, used across shop kinds. */
function WallScreen({
  position,
  width = 1.6,
  height = 1.0,
  tint,
}: {
  position: [number, number, number];
  width?: number;
  height?: number;
  tint: string;
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 80;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0b0e14";
    ctx.fillRect(0, 0, 128, 80);
    ctx.fillStyle = tint;
    // A few bars — reads as a chart or menu board at distance.
    for (let i = 0; i < 5; i += 1) {
      const h = 10 + ((i * 37) % 34);
      ctx.fillRect(14 + i * 21, 62 - h, 13, h);
    }
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(12, 12, 52, 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [tint]);

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      {texture ? (
        <meshBasicMaterial map={texture} toneMapped={false} />
      ) : (
        <meshBasicMaterial color={tint} toneMapped={false} />
      )}
    </mesh>
  );
}

/** Blocky standing occupant — a simplified NPC silhouette, no animation. */
function Occupant({
  position,
  color,
  skin,
}: {
  position: [number, number, number];
  color: string;
  skin: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.34, 0.84, 0.24]} />
        {mat("#2c3240")}
      </mesh>
      <mesh position={[0, 1.14, 0]} castShadow>
        <boxGeometry args={[0.46, 0.6, 0.28]} />
        {mat(color)}
      </mesh>
      <mesh position={[0, 1.64, 0]} castShadow>
        <boxGeometry args={[0.34, 0.36, 0.32]} />
        {mat(skin)}
      </mesh>
    </group>
  );
}

export function ShopInterior({
  width,
  depth,
  kind,
  seed,
  lite = false,
}: ShopInteriorProps) {
  const rand = useMemo(() => mulberry32(hashSeed(seed)), [seed]);
  const p = PALETTE[kind];

  // Room is inset from the facade so the glass sits in front of it.
  const w = width * 0.88;
  const d = Math.min(depth * 0.8, 7);

  const shelves = useMemo(() => {
    const out: number[] = [];
    const n = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i += 1) out.push(0.7 + i * 0.85);
    return out;
  }, [rand]);

  const occupants = useMemo(() => {
    if (lite) return [];
    const out: { x: number; z: number; color: string; skin: string }[] = [];
    const skins = ["#e7c9a8", "#c08d5f", "#8a5a3b", "#f0d2bd"];
    const shirts = ["#3d6fb5", "#c9463f", "#2f7d5c", "#c98a2b", "#7a4a8c"];
    const n = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i += 1) {
      out.push({
        x: (rand() - 0.5) * w * 0.6,
        z: -d * 0.15 - rand() * d * 0.3,
        color: shirts[Math.floor(rand() * shirts.length)]!,
        skin: skins[Math.floor(rand() * skins.length)]!,
      });
    }
    return out;
  }, [rand, lite, w, d]);

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, 0.02, -d / 2]} receiveShadow>
        <boxGeometry args={[w, 0.06, d]} />
        {mat(p.floor)}
      </mesh>

      {/* Back wall + side walls */}
      <mesh position={[0, ROOM_H / 2, -d]} receiveShadow>
        <boxGeometry args={[w, ROOM_H, 0.16]} />
        {mat(p.wall)}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * w) / 2, ROOM_H / 2, -d / 2]} receiveShadow>
          <boxGeometry args={[0.16, ROOM_H, d]} />
          {mat(p.wall)}
        </mesh>
      ))}

      {/* Ceiling strip light — makes the room read from outside at night */}
      <mesh position={[0, ROOM_H - 0.16, -d / 2]}>
        <boxGeometry args={[w * 0.6, 0.1, 0.5]} />
        {mat(p.glow, p.glow, 1.4)}
      </mesh>

      {/* Counter across the front third */}
      <mesh position={[0, 0.55, -d * 0.32]} castShadow receiveShadow>
        <boxGeometry args={[w * 0.72, 1.1, 0.7]} />
        {mat(p.accent)}
      </mesh>
      <mesh position={[0, 1.14, -d * 0.32]} castShadow>
        <boxGeometry args={[w * 0.76, 0.1, 0.84]} />
        {mat("#e8e2d6")}
      </mesh>

      {/* Back shelving */}
      {shelves.map((y, i) => (
        <group key={i}>
          <mesh position={[0, y + 0.6, -d + 0.35]} castShadow>
            <boxGeometry args={[w * 0.78, 0.09, 0.42]} />
            {mat(p.accent)}
          </mesh>
          {/* Stock blocks on the shelf */}
          {[-2, -1, 0, 1, 2].map((k) => (
            <mesh
              key={k}
              position={[k * (w * 0.14), y + 0.78, -d + 0.35]}
              castShadow
            >
              <boxGeometry args={[0.24, 0.28, 0.22]} />
              {mat(
                ["#c9463f", "#2f7d5c", "#c98a2b", "#3d6fb5", "#7a4a8c"][
                  (i + k + 5) % 5
                ]!,
              )}
            </mesh>
          ))}
        </group>
      ))}

      {/* Menu / chart screen on the back wall */}
      <WallScreen
        position={[w * 0.26, 2.2, -d + 0.1]}
        width={Math.min(w * 0.34, 1.8)}
        height={1.05}
        tint={p.glow}
      />

      {/* Kind-specific fitout */}
      {kind === "arcade" &&
        [-1, 1].map((s) => (
          <group key={s} position={[(s * w) / 3.2, 0, -d * 0.62]}>
            <mesh position={[0, 0.85, 0]} castShadow>
              <boxGeometry args={[0.8, 1.7, 0.7]} />
              {mat("#1c1730")}
            </mesh>
            <mesh position={[0, 1.35, 0.36]}>
              <planeGeometry args={[0.6, 0.5]} />
              <meshBasicMaterial color={p.glow} toneMapped={false} />
            </mesh>
          </group>
        ))}

      {(kind === "coffee" || kind === "deli") &&
        [-1, 1].map((s) => (
          <group key={s} position={[(s * w) / 3.4, 0, -d * 0.72]}>
            <mesh position={[0, 0.38, 0]} castShadow>
              <boxGeometry args={[0.9, 0.1, 0.9]} />
              {mat("#8a6644")}
            </mesh>
            <mesh position={[0, 0.18, 0]} castShadow>
              <boxGeometry args={[0.14, 0.36, 0.14]} />
              {mat("#4a4038")}
            </mesh>
          </group>
        ))}

      {kind === "gallery" &&
        [-1, 0, 1].map((s) => (
          <mesh key={s} position={[s * (w / 3.4), 2.0, -d + 0.12]}>
            <planeGeometry args={[0.9, 1.1]} />
            <meshBasicMaterial
              color={["#c9463f", "#3d6fb5", "#2f7d5c"][s + 1]}
              toneMapped={false}
            />
          </mesh>
        ))}

      {occupants.map((o, i) => (
        <Occupant key={i} position={[o.x, 0.05, o.z]} color={o.color} skin={o.skin} />
      ))}
    </group>
  );
}
