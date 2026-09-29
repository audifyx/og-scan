/**
 * OrbitX City — realistic outer-district fill building.
 *
 * Replaces the toy-like BlockBuilding for the generated district ring.
 * Procedural canvas textures: window grid with varied lit windows (emissive at
 * night), concrete panel joints, painted ground-floor storefront band.
 * 2–3 draw calls per building; textures cached by palette key.
 */
import { useMemo } from "react";
import * as THREE from "three";

export interface FillBuildingProps {
  position: [number, number, number];
  width?: number;
  depth?: number;
  floors?: number;
  color?: string;
  trim?: string;
  /** Warm emissive tint for lit windows. */
  glass?: string;
  rotationY?: number;
  sign?: string;
}

const STOREY_H = 3.2;

function mute(hex: string, amt = 0.35): string {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color("#8f8f8f"), amt);
  return `#${c.getHexString()}`;
}

interface FillTex {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

const texCache = new Map<string, FillTex>();

function getFillTextures(color: string, glass: string, floors: number): FillTex {
  const key = `${color}|${glass}|${Math.min(floors, 24)}`;
  const hit = texCache.get(key);
  if (hit) return hit;

  const W = 256;
  const H = 256;
  const mapC = document.createElement("canvas");
  mapC.width = W;
  mapC.height = H;
  const emC = document.createElement("canvas");
  emC.width = W;
  emC.height = H;
  const g = mapC.getContext("2d")!;
  const e = emC.getContext("2d")!;

  const wall = mute(color, 0.4);
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
  e.fillStyle = "#000000";
  e.fillRect(0, 0, W, H);

  // Subtle concrete panel joints.
  g.strokeStyle = "rgba(0,0,0,0.14)";
  g.lineWidth = 1;
  for (let y = 0; y < H; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }

  const rows = Math.max(2, Math.min(24, floors));
  const cols = 8;
  const cellW = W / cols;
  const cellH = (H * 0.82) / rows; // top 82% = tower windows; bottom = storefront
  let seed = 1234;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = c * cellW + cellW * 0.22;
      const y = r * cellH + cellH * 0.2;
      const w = cellW * 0.56;
      const h = cellH * 0.6;
      const lit = rnd() < 0.42;
      // Daytime pane.
      g.fillStyle = lit ? "#3d4a58" : "#20262e";
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(255,255,255,0.10)";
      g.fillRect(x, y, w, h * 0.3);
      // Night emissive: lit windows glow warm.
      if (lit) {
        e.fillStyle = glass || "#ffca7a";
        e.fillRect(x, y, w, h);
      }
    }
  }

  // Ground-floor storefront band (painted into texture — no extra geometry).
  const bandY = H * 0.84;
  g.fillStyle = "#14181d";
  g.fillRect(0, bandY, W, H - bandY);
  g.fillStyle = "rgba(140,180,210,0.25)";
  const panes = 6;
  for (let i = 0; i < panes; i += 1) {
    g.fillRect((i * W) / panes + 4, bandY + 6, W / panes - 8, H - bandY - 18);
  }
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.fillRect(W * 0.44, bandY, W * 0.12, H - bandY); // doorway
  e.fillStyle = glass || "#ffca7a";
  e.fillRect(0, bandY + 6, W, 10); // storefront glow strip

  const map = new THREE.CanvasTexture(mapC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  const emissiveMap = new THREE.CanvasTexture(emC);
  emissiveMap.wrapS = THREE.RepeatWrapping;
  const out = { map, emissiveMap };
  texCache.set(key, out);
  return out;
}

const signTexCache = new Map<string, THREE.CanvasTexture>();
function getSignTexture(text: string): THREE.CanvasTexture {
  const hit = signTexCache.get(text);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#101318";
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = "#2a3340";
  g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 60);
  g.fillStyle = "#ffd98a";
  g.font = "bold 30px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text.slice(0, 10), 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  signTexCache.set(text, t);
  return t;
}

export function FillBuilding({
  position,
  width = 20,
  depth = 20,
  floors = 6,
  color = "#c6cfdc",
  glass = "#ffca7a",
  rotationY = 0,
  sign,
}: FillBuildingProps) {
  const h = Math.max(1, floors) * STOREY_H;
  const tex = useMemo(
    () => getFillTextures(color, glass, floors),
    [color, glass, floors],
  );
  const signTex = useMemo(() => (sign ? getSignTexture(sign) : null), [sign]);

  const mats = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({
      map: tex.map,
      emissiveMap: tex.emissiveMap,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.9,
      roughness: 0.85,
      metalness: 0.05,
    });
    const roof = new THREE.MeshStandardMaterial({
      color: "#2b2f36",
      roughness: 0.95,
    });
    return [side, side, roof, roof, side, side];
  }, [tex]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh material={mats} castShadow receiveShadow>
        <boxGeometry args={[width, h, depth]} />
      </mesh>
      {/* Parapet lip */}
      <mesh position={[0, h + 0.25, 0]} castShadow>
        <boxGeometry args={[width + 0.5, 0.5, depth + 0.5]} />
        <meshStandardMaterial color="#23272e" roughness={0.95} />
      </mesh>
      {/* Rooftop AC box */}
      <mesh position={[width * 0.2, h + 0.9, -depth * 0.15]} castShadow>
        <boxGeometry args={[2.2, 1.2, 1.6]} />
        <meshStandardMaterial color="#6b7280" roughness={0.9} />
      </mesh>
      {signTex && (
        <mesh position={[width / 2 + 0.15, 4.6, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[5, 1.25]} />
          <meshBasicMaterial map={signTex} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
