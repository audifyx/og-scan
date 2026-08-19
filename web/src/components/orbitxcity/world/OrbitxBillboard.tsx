/**
 * OrbitX City — OrbitX brand billboards.
 *
 * Three formats: rooftop board on a lattice frame, facade "spectacular", and
 * a double-sided street board on a pole. Artwork is painted to canvas so the
 * copy stays crisp and needs no external assets.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type BrandVariant =
  | "logo"
  | "city"
  | "dex"
  | "launch"
  | "nft"
  | "scan";

export interface OrbitxBillboardProps {
  position: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  variant?: BrandVariant;
  format?: "rooftop" | "wall" | "street";
  /** Disable the sweep animation on low quality. */
  lite?: boolean;
}

const COPY: Record<BrandVariant, { head: string; sub: string; accent: string }> = {
  logo: { head: "OrbitX", sub: "THE CRYPTO METAVERSE", accent: "#c5a26f" },
  city: { head: "OrbitX City", sub: "WALK IN · TRADE LIVE", accent: "#5cd6a0" },
  dex: { head: "OrbitX DEX", sub: "REAL-TIME TOKEN INTEL", accent: "#4aa3ff" },
  launch: { head: "LAUNCHPAD", sub: "SHIP YOUR TOKEN ON SOLANA", accent: "#ffb427" },
  nft: { head: "NFT MARKET", sub: "MINT · LIST · TRADE", accent: "#b76cff" },
  scan: { head: "OG SCAN", sub: "FORENSICS BEFORE YOU APE", accent: "#ff7a5c" },
};

/** Board rotation used by the district ring. */
const BRAND_ROTATION: BrandVariant[] = [
  "city",
  "dex",
  "launch",
  "nft",
  "scan",
  "logo",
];

const W = 768;
const H = 384;

function paint(variant: BrandVariant): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const { head, sub, accent } = COPY[variant];

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  // Backdrop
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0d1119");
  g.addColorStop(1, "#161d2b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Accent frame
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, W - 32, H - 32);

  // Orbit ring motif
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(W - 150, H / 2, 128, 52, -0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(W - 150, H / 2, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Headline
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 76px Inter, system-ui, sans-serif";
  ctx.fillText(head, 52, 176);

  // Accent underline
  ctx.fillStyle = accent;
  ctx.fillRect(52, 198, 190, 7);

  // Subhead
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "600 27px Inter, system-ui, sans-serif";
  ctx.letterSpacing = "3px";
  ctx.fillText(sub, 52, 252);

  // Domain strip
  ctx.fillStyle = accent;
  ctx.fillRect(0, H - 58, W, 58);
  ctx.fillStyle = "#0b0e14";
  ctx.font = "700 30px Inter, system-ui, sans-serif";
  ctx.fillText("orbitx.world", 52, H - 19);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Lattice support frame used behind rooftop boards. */
function Lattice({ width, height }: { width: number; height: number }) {
  const legs = Math.max(2, Math.round(width / 4));
  return (
    <group position={[0, -height / 2, -0.35]}>
      {Array.from({ length: legs }).map((_, i) => {
        const x = (i / (legs - 1) - 0.5) * width * 0.92;
        return (
          <mesh key={i} position={[x, -height * 0.35, 0]} castShadow>
            <boxGeometry args={[0.18, height * 0.7, 0.18]} />
            <meshStandardMaterial color="#3d434e" roughness={0.9} flatShading />
          </mesh>
        );
      })}
      <mesh position={[0, -height * 0.35, 0]} castShadow>
        <boxGeometry args={[width * 0.94, 0.16, 0.16]} />
        <meshStandardMaterial color="#3d434e" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

export function OrbitxBillboard({
  position,
  rotationY = 0,
  width = 12,
  height = 6,
  variant = "city",
  format = "rooftop",
  lite = false,
}: OrbitxBillboardProps) {
  const texture = useMemo(() => paint(variant), [variant]);
  useEffect(() => () => texture?.dispose(), [texture]);

  const sweep = useRef<THREE.Mesh>(null);
  const accent = COPY[variant].accent;

  useFrame((state) => {
    if (lite || !sweep.current) return;
    // Slow light sweep across the face keeps the board feeling powered.
    const t = state.clock.elapsedTime * 0.42;
    const x = (((t % 2) + 2) % 2) - 1;
    sweep.current.position.x = x * width * 0.6;
    const m = sweep.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.1 * (1 - Math.abs(x));
  });

  const face = (
    <>
      {/* Bezel */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width + 0.5, height + 0.5, 0.32]} />
        <meshStandardMaterial color="#171c25" roughness={0.85} flatShading />
      </mesh>

      {/* Artwork */}
      <mesh position={[0, 0, 0.18]}>
        <planeGeometry args={[width, height]} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color={accent} toneMapped={false} />
        )}
      </mesh>

      {/* Light sweep */}
      {!lite && (
        <mesh ref={sweep} position={[0, 0, 0.2]}>
          <planeGeometry args={[width * 0.28, height]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Trough lights along the bottom lip */}
      {Array.from({ length: 3 }).map((_, i) => (
        <mesh
          key={i}
          position={[(i - 1) * width * 0.3, -height / 2 - 0.22, 0.34]}
        >
          <boxGeometry args={[width * 0.16, 0.12, 0.24]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={1.5}
            flatShading
          />
        </mesh>
      ))}
    </>
  );

  if (format === "street") {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        {/* Pole */}
        <mesh position={[0, -height / 2 - 1.6, 0]} castShadow>
          <boxGeometry args={[0.4, 3.4, 0.4]} />
          <meshStandardMaterial color="#3d434e" roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, -height / 2 - 3.2, 0]} receiveShadow>
          <boxGeometry args={[1.5, 0.3, 1.5]} />
          <meshStandardMaterial color="#5b626e" roughness={0.92} flatShading />
        </mesh>
        {face}
        {/* Reverse face so the board reads from both directions */}
        <mesh position={[0, 0, -0.18]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[width, height]} />
          {texture ? (
            <meshBasicMaterial map={texture} toneMapped={false} />
          ) : (
            <meshBasicMaterial color={accent} toneMapped={false} />
          )}
        </mesh>
      </group>
    );
  }

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {face}
      {format === "rooftop" && <Lattice width={width} height={height} />}
    </group>
  );
}

/**
 * Scatter OrbitX boards across the district: rooftop boards on the tallest
 * lots, street boards near the core approach roads.
 */
export function OrbitxBillboardRing({
  radius = 150,
  count = 6,
  lite = false,
}: {
  radius?: number;
  count?: number;
  lite?: boolean;
}) {
  const boards = useMemo(() => {
    const out: {
      pos: [number, number, number];
      rot: number;
      variant: BrandVariant;
      format: "rooftop" | "street";
      w: number;
      h: number;
    }[] = [];

    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + 0.4;
      const r = radius * (0.72 + ((i % 3) * 0.12));
      const rooftop = i % 2 === 0;
      out.push({
        pos: [Math.cos(a) * r, rooftop ? 26 + (i % 4) * 6 : 7.5, Math.sin(a) * r],
        // Face the city centre.
        rot: -a + Math.PI / 2,
        variant: BRAND_ROTATION[i % BRAND_ROTATION.length]!,
        format: rooftop ? "rooftop" : "street",
        w: rooftop ? 16 : 9,
        h: rooftop ? 8 : 4.5,
      });
    }
    return out;
  }, [radius, count]);

  return (
    <group name="oxc-orbitx-boards">
      {boards.map((b, i) => (
        <OrbitxBillboard
          key={i}
          position={b.pos}
          rotationY={b.rot}
          variant={b.variant}
          format={b.format}
          width={b.w}
          height={b.h}
          lite={lite}
        />
      ))}
    </group>
  );
}
