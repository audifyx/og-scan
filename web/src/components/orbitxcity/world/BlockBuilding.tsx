/**
 * OrbitX City — Roblox-style blocky building kit.
 *
 * Chunky boxes, flat bright "plastic" materials, visible studs on roofs and
 * ledges, hard shadows. Deliberately low-poly: every building is a handful of
 * boxes so a full district stays cheap on mobile.
 */
import { useMemo } from "react";
import * as THREE from "three";

export type BlockKind =
  | "tower"
  | "midrise"
  | "shop"
  | "plaza"
  | "warehouse"
  | "stage";

export interface BlockBuildingProps {
  position: [number, number, number];
  /** Footprint in studs (1 stud = 1 world unit). */
  width?: number;
  depth?: number;
  /** Storeys, each STOREY_H tall. */
  floors?: number;
  kind?: BlockKind;
  color?: string;
  trim?: string;
  /** Emissive window colour. */
  glass?: string;
  rotationY?: number;
  /** Render roof studs. Disable on distant LOD. */
  studs?: boolean;
  /** Signage text rendered on the facade band. */
  sign?: string;
  signColor?: string;
}

const STOREY_H = 3.2;

/** Flat plastic look: no metalness, high roughness, slight sheen. */
function plastic(color: string, opts: { rough?: number; emissive?: string; emissiveIntensity?: number } = {}) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={opts.rough ?? 0.72}
      metalness={0.02}
      emissive={opts.emissive ?? "#000000"}
      emissiveIntensity={opts.emissiveIntensity ?? 0}
      flatShading
    />
  );
}

/**
 * Roof studs, instanced. Classic blocky-world cylinders on top of the slab.
 */
function Studs({
  width,
  depth,
  y,
  color,
  spacing = 2,
}: {
  width: number;
  depth: number;
  y: number;
  color: string;
  spacing?: number;
}) {
  const positions = useMemo(() => {
    const out: [number, number, number][] = [];
    const cols = Math.max(1, Math.floor(width / spacing));
    const rows = Math.max(1, Math.floor(depth / spacing));
    const ox = ((cols - 1) * spacing) / 2;
    const oz = ((rows - 1) * spacing) / 2;
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        out.push([i * spacing - ox, y, j * spacing - oz]);
      }
    }
    return out;
  }, [width, depth, y, spacing]);

  // Cap stud count so a dense skyline never explodes draw calls.
  if (positions.length > 160) return null;

  return (
    <group>
      {positions.map((p, i) => (
        <mesh key={i} position={p} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.22, 12]} />
          {plastic(color, { rough: 0.62 })}
        </mesh>
      ))}
    </group>
  );
}

/** Window band: a single emissive box per storey rather than per-window meshes. */
function WindowBand({
  width,
  depth,
  y,
  glass,
}: {
  width: number;
  depth: number;
  y: number;
  glass: string;
}) {
  return (
    <mesh position={[0, y, 0]} castShadow={false} receiveShadow={false}>
      <boxGeometry args={[width + 0.06, STOREY_H * 0.46, depth + 0.06]} />
      <meshStandardMaterial
        color={glass}
        emissive={glass}
        emissiveIntensity={0.55}
        roughness={0.28}
        metalness={0.05}
        flatShading
      />
    </mesh>
  );
}

export function BlockBuilding({
  position,
  width = 8,
  depth = 8,
  floors = 4,
  kind = "midrise",
  color = "#c8ccd4",
  trim = "#8f96a3",
  glass = "#7fd4ff",
  rotationY = 0,
  studs = true,
  sign,
  signColor = "#ffb427",
}: BlockBuildingProps) {
  const h = floors * STOREY_H;

  const bands = useMemo(() => {
    const out: number[] = [];
    for (let f = 0; f < floors; f += 1) {
      out.push(f * STOREY_H + STOREY_H * 0.62);
    }
    return out;
  }, [floors]);

  const signTexture = useMemo(() => {
    if (!sign || typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0d0f14";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = signColor;
    ctx.font = "bold 68px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sign.toUpperCase().slice(0, 16), 256, 68);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [sign, signColor]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Base slab — every building sits on a slightly wider plinth. */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 1.2, 0.7, depth + 1.2]} />
        {plastic(trim, { rough: 0.85 })}
      </mesh>

      {/* Main mass */}
      <mesh position={[0, h / 2 + 0.7, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, h, depth]} />
        {plastic(color)}
      </mesh>

      {/* Emissive storey bands */}
      {bands.map((y, i) => (
        <WindowBand key={i} width={width} depth={depth} y={y + 0.7} glass={glass} />
      ))}

      {/* Roof cap */}
      <mesh position={[0, h + 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.8, 0.5, depth + 0.8]} />
        {plastic(trim, { rough: 0.8 })}
      </mesh>

      {studs && (
        <Studs width={width - 1} depth={depth - 1} y={h + 1.3} color={trim} />
      )}

      {/* Kind-specific silhouette toppers */}
      {kind === "tower" && (
        <>
          <mesh position={[0, h + 3.2, 0]} castShadow>
            <boxGeometry args={[width * 0.42, 4.4, depth * 0.42]} />
            {plastic(color)}
          </mesh>
          <mesh position={[0, h + 6.4, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 2.4, 8]} />
            {plastic(trim)}
          </mesh>
          <mesh position={[0, h + 7.7, 0]}>
            <sphereGeometry args={[0.34, 12, 12]} />
            <meshStandardMaterial
              color="#ff4d4d"
              emissive="#ff2b2b"
              emissiveIntensity={1.6}
              flatShading
            />
          </mesh>
        </>
      )}

      {kind === "stage" && (
        <mesh position={[0, h + 1.9, 0]} castShadow>
          <boxGeometry args={[width * 1.15, 0.5, depth * 1.15]} />
          {plastic(signColor, { emissive: signColor, emissiveIntensity: 0.4 })}
        </mesh>
      )}

      {kind === "shop" && (
        <mesh position={[0, 2.1, depth / 2 + 0.75]} castShadow>
          <boxGeometry args={[width * 0.94, 0.9, 1.5]} />
          {plastic(signColor, { rough: 0.6 })}
        </mesh>
      )}

      {/* Facade signage band */}
      {signTexture && (
        <mesh position={[0, h * 0.72, depth / 2 + 0.09]}>
          <planeGeometry args={[width * 0.82, width * 0.2]} />
          <meshBasicMaterial map={signTexture} toneMapped={false} transparent />
        </mesh>
      )}

      {/* Doorway — recessed dark box at street level */}
      <mesh position={[0, 1.55, depth / 2 + 0.05]}>
        <boxGeometry args={[2.6, 2.9, 0.22]} />
        <meshStandardMaterial color="#14171f" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

/** Bright baseplate ground with a stud grid — the classic blocky-world floor. */
export function Baseplate({
  size = 240,
  color = "#7fbf6a",
  grid = "#6aa858",
}: {
  size?: number;
  color?: string;
  grid?: string;
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(size / 4, size / 4);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [size, color, grid]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        map={texture ?? undefined}
        color={texture ? "#ffffff" : color}
        roughness={0.94}
        metalness={0}
      />
    </mesh>
  );
}

/** Sidewalk / road strip helper — flat boxes, no textures. */
export function BlockRoad({
  from,
  to,
  width = 8,
  color = "#3c4048",
  line = "#e8d98a",
}: {
  from: [number, number];
  to: [number, number];
  width?: number;
  color?: string;
  line?: string;
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;

  return (
    <group position={[cx, 0.04, cz]} rotation={[0, -angle, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[len, width]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len * 0.94, 0.28]} />
        <meshBasicMaterial color={line} toneMapped={false} />
      </mesh>
      {/* Kerbs */}
      <mesh position={[0, 0.14, width / 2 + 0.35]} castShadow receiveShadow>
        <boxGeometry args={[len, 0.28, 0.7]} />
        <meshStandardMaterial color="#b9bfc9" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 0.14, -width / 2 - 0.35]} castShadow receiveShadow>
        <boxGeometry args={[len, 0.28, 0.7]} />
        <meshStandardMaterial color="#b9bfc9" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}
