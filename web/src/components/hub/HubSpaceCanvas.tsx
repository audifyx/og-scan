import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { resolveSpaceQuality, type SpaceQuality } from "./hubSpaceQuality";

function hash21(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function makePlanetMaps(size = 512): { color: THREE.CanvasTexture; clouds: THREE.CanvasTexture } {
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = size;
  const ctx = colorCanvas.getContext("2d");
  if (!ctx) {
    const empty = new THREE.CanvasTexture(colorCanvas);
    return { color: empty, clouds: empty };
  }

  const ocean = ctx.createRadialGradient(size * 0.38, size * 0.32, size * 0.08, size * 0.5, size * 0.5, size * 0.72);
  ocean.addColorStop(0, "#2a6f8c");
  ocean.addColorStop(0.42, "#123a52");
  ocean.addColorStop(1, "#061018");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 48; i += 1) {
    const x = hash21(i, 2) * size;
    const y = hash21(i, 9) * size;
    const r = 18 + hash21(i, 17) * 70;
    const land = ctx.createRadialGradient(x, y, 2, x, y, r);
    const lush = hash21(i, 23) > 0.45;
    land.addColorStop(0, lush ? "rgba(46, 140, 110, 0.95)" : "rgba(168, 132, 78, 0.88)");
    land.addColorStop(0.55, lush ? "rgba(22, 86, 72, 0.72)" : "rgba(92, 68, 40, 0.55)");
    land.addColorStop(1, "rgba(8, 20, 28, 0)");
    ctx.fillStyle = land;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const polar = ctx.createLinearGradient(0, 0, 0, size);
  polar.addColorStop(0, "rgba(230, 244, 255, 0.55)");
  polar.addColorStop(0.12, "rgba(230, 244, 255, 0)");
  polar.addColorStop(0.88, "rgba(230, 244, 255, 0)");
  polar.addColorStop(1, "rgba(230, 244, 255, 0.5)");
  ctx.fillStyle = polar;
  ctx.fillRect(0, 0, size, size);

  const color = new THREE.CanvasTexture(colorCanvas);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 4;
  color.needsUpdate = true;

  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = cloudCanvas.height = size;
  const cctx = cloudCanvas.getContext("2d");
  if (!cctx) return { color, clouds: color };
  cctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 36; i += 1) {
    const x = hash21(i, 41) * size;
    const y = hash21(i, 53) * size;
    const r = 20 + hash21(i, 67) * 90;
    const g = cctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.22 + hash21(i, 71) * 0.28})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    cctx.fillStyle = g;
    cctx.beginPath();
    cctx.arc(x, y, r, 0, Math.PI * 2);
    cctx.fill();
  }
  const clouds = new THREE.CanvasTexture(cloudCanvas);
  clouds.colorSpace = THREE.SRGBColorSpace;
  clouds.needsUpdate = true;
  return { color, clouds };
}

function makeRingTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, w, h);
    for (let x = 0; x < w; x += 1) {
      const t = x / w;
      const gap = (t > 0.38 && t < 0.44) || (t > 0.72 && t < 0.76);
      if (gap) continue;
      const a = 0.18 + Math.sin(t * 42) * 0.12 + (t > 0.5 ? 0.08 : 0);
      const gold = Math.sin(t * 18) > 0.35;
      ctx.fillStyle = gold ? `rgba(251, 191, 36, ${a})` : `rgba(186, 214, 255, ${a * 1.15})`;
      ctx.fillRect(x, 8, 1, h - 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function Planet({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const maps = useMemo(() => makePlanetMaps(isTextureLite() ? 256 : 512), []);
  const ringMap = useMemo(() => makeRingTexture(), []);

  useEffect(() => {
    return () => {
      maps.color.dispose();
      maps.clouds.dispose();
      ringMap.dispose();
    };
  }, [maps, ringMap]);

  useFrame((_, dt) => {
    if (reduced || !group.current) return;
    group.current.rotation.y += dt * 0.045;
    if (cloudsRef.current) cloudsRef.current.rotation.y += dt * 0.02;
  });

  return (
    <group ref={group} position={[2.35, -0.55, -1.6]} rotation={[0.18, 0.4, -0.12]}>
      <mesh>
        <sphereGeometry args={[1.55, 64, 64]} />
        <meshStandardMaterial map={maps.color} roughness={0.86} metalness={0.08} />
      </mesh>
      <mesh ref={cloudsRef} scale={1.018}>
        <sphereGeometry args={[1.55, 48, 48]} />
        <meshStandardMaterial map={maps.clouds} transparent opacity={0.42} depthWrite={false} roughness={1} metalness={0} />
      </mesh>
      <mesh scale={1.12}>
        <sphereGeometry args={[1.55, 32, 32]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.11} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[1.32, 0.1, 0.18]}>
        <ringGeometry args={[2.05, 3.15, 96]} />
        <meshBasicMaterial
          map={ringMap}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function isTextureLite(): boolean {
  return typeof window !== "undefined" && window.innerWidth < 900;
}

function Nebulae({ count, reduced }: { count: number; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        position: [
          (hash21(i, 1) - 0.5) * 16,
          (hash21(i, 2) - 0.45) * 8,
          -6 - hash21(i, 3) * 10,
        ] as [number, number, number],
        scale: 3.2 + hash21(i, 4) * 5.5,
        color: ["#67e8f9", "#c084fc", "#38bdf8", "#f472b6", "#5eead4"][i % 5],
        opacity: 0.045 + hash21(i, 5) * 0.04,
      })),
    [count],
  );

  useFrame((_, dt) => {
    if (reduced || !group.current) return;
    group.current.rotation.y += dt * 0.012;
    group.current.rotation.x += dt * 0.004;
  });

  return (
    <group ref={group}>
      {items.map((n) => (
        <mesh key={`${n.color}-${n.scale}`} position={n.position} scale={n.scale}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color={n.color}
            transparent
            opacity={n.opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Dust({ count, reduced }: { count: number; reduced: boolean }) {
  const points = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (hash21(i, 11) - 0.5) * 28;
      positions[i * 3 + 1] = (hash21(i, 13) - 0.5) * 16;
      positions[i * 3 + 2] = (hash21(i, 17) - 0.5) * 22;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((_, dt) => {
    if (reduced || !points.current) return;
    points.current.rotation.y += dt * 0.018;
  });

  return (
    <points ref={points} geometry={geo}>
      <pointsMaterial color="#dbeafe" size={0.028} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

function CameraRig({ reduced }: { reduced: boolean }) {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(({ clock }) => {
    if (reduced) {
      camera.position.set(0, 0.22, 7.2);
      camera.lookAt(0.4, -0.1, -2);
      return;
    }
    const t = clock.elapsedTime;
    const baseX = Math.sin(t * 0.045) * 0.32;
    const baseY = 0.22 + Math.cos(t * 0.038) * 0.16;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, baseX + mouse.current.x * 0.42, 0.035);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, baseY - mouse.current.y * 0.22, 0.035);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 7.15 + Math.sin(t * 0.03) * 0.18, 0.03);
    camera.lookAt(0.35 + mouse.current.x * 0.08, -0.08, -2);
  });

  return null;
}

function VisibilityGate({ reduced }: { reduced: boolean }) {
  const set = useThree((s) => s.set);
  useEffect(() => {
    const sync = () => {
      set({ frameloop: document.hidden || reduced ? "demand" : "always" });
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [reduced, set]);
  return null;
}

function SpaceScene({ quality }: { quality: SpaceQuality }) {
  return (
    <>
      <color attach="background" args={["#02040a"]} />
      <fog attach="fog" args={["#02040a", 12, 38]} />
      <ambientLight intensity={0.18} color="#8b9cff" />
      <directionalLight position={[7.5, 4.2, 6]} intensity={1.55} color="#fff4e0" />
      <pointLight position={[-8, 2, -4]} intensity={8} color="#c084fc" distance={28} />
      <pointLight position={[4, -3, 2]} intensity={5} color="#22d3ee" distance={22} />
      <mesh position={[9.2, 4.6, 7]}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color="#fff6d8" />
      </mesh>
      <Stars radius={90} depth={48} count={quality.starCount} factor={quality.compact ? 3.2 : 4.4} saturation={0.15} fade speed={quality.reduced ? 0 : 0.55} />
      <Nebulae count={quality.nebulaCount} reduced={quality.reduced} />
      <Dust count={quality.dustCount} reduced={quality.reduced} />
      <Planet reduced={quality.reduced} />
      <CameraRig reduced={quality.reduced} />
      <VisibilityGate reduced={quality.reduced} />
    </>
  );
}

export default function HubSpaceCanvas() {
  const quality = useMemo(() => resolveSpaceQuality(), []);

  return (
    <Canvas
      dpr={[1, quality.dprMax]}
      camera={{ position: [0, 0.22, 7.2], fov: 48, near: 0.1, far: 80 }}
      gl={{
        antialias: !quality.compact,
        powerPreference: quality.compact ? "low-power" : "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.12,
        stencil: false,
        alpha: false,
      }}
      frameloop={quality.reduced ? "demand" : "always"}
      style={{ pointerEvents: "none", width: "100%", height: "100%" }}
    >
      <SpaceScene quality={quality} />
    </Canvas>
  );
}
