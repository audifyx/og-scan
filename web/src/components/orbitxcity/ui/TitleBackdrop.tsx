/**
 * Cinematic 3D title backdrop — midnight skyline + gold/ice lighting.
 * Replaces missing /orbitxcity/bg/*.png photos and the old lime wash.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "@/lib/orbitxcity/collision";
import { resolveTitleTheme, type TitleDistrictTheme } from "@/lib/orbitxcity/titleTheme";
import { CosmicBackdrop } from "./CosmicBackdrop";

interface TitleBackdropProps {
  cityId?: string;
  intensity?: "title" | "chamber";
  lite?: boolean;
}

function detectWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function makeWindowMaps(windowHex: string, seed: number) {
  const rand = mulberry32(seed);
  const width = 64;
  const height = 128;
  const color = document.createElement("canvas");
  const emit = document.createElement("canvas");
  color.width = emit.width = width;
  color.height = emit.height = height;
  const cctx = color.getContext("2d");
  const ectx = emit.getContext("2d");
  if (!cctx || !ectx) return null;
  cctx.fillStyle = "#10151e";
  cctx.fillRect(0, 0, width, height);
  ectx.fillStyle = "#000000";
  ectx.fillRect(0, 0, width, height);
  for (let y = 4; y < height - 4; y += 7) {
    for (let x = 3; x < width - 3; x += 6) {
      if (rand() < 0.72) {
        const lit = rand() > 0.18;
        cctx.fillStyle = lit ? windowHex : "#1c2430";
        cctx.fillRect(x, y, 3, 4);
        if (lit) {
          ectx.fillStyle = windowHex;
          ectx.fillRect(x, y, 3, 4);
        }
      }
    }
  }
  const map = new THREE.CanvasTexture(color);
  const emissiveMap = new THREE.CanvasTexture(emit);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 3);
  emissiveMap.repeat.set(1, 3);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 2;
  return { map, emissiveMap };
}

function CameraDrift({ intensity, reduced }: { intensity: "title" | "chamber"; reduced: boolean }) {
  const base = intensity === "chamber" ? new THREE.Vector3(6.8, 6.2, 16.4) : new THREE.Vector3(9.6, 6.8, 19.2);
  const look = intensity === "chamber" ? new THREE.Vector3(1.4, 3.4, -8) : new THREE.Vector3(1.8, 3.8, -10);

  useFrame(({ camera, clock }) => {
    if (reduced) {
      camera.position.copy(base);
      camera.lookAt(look);
      return;
    }
    const t = clock.elapsedTime * 0.12;
    camera.position.set(base.x + Math.sin(t) * 1.4, base.y + Math.sin(t * 0.7) * 0.35, base.z + Math.cos(t * 0.8) * 0.8);
    camera.lookAt(look.x + Math.sin(t * 0.5) * 0.3, look.y, look.z);
  });

  return null;
}

function TitleSkyline({ theme, lite }: { theme: TitleDistrictTheme; lite: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = lite ? 36 : 64;
  const maps = useMemo(() => makeWindowMaps(theme.window, 0x51c17 ^ theme.id.length * 13), [theme.id, theme.window]);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8a93a3",
        map: maps?.map ?? null,
        emissive: theme.window,
        emissiveMap: maps?.emissiveMap ?? null,
        emissiveIntensity: 1.35,
        metalness: 0.42,
        roughness: 0.48,
        envMapIntensity: 0.45,
      }),
    [maps, theme.window],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const rand = mulberry32(0xc17c ^ theme.id.charCodeAt(0) * 97);
    const m = new THREE.Matrix4();
    const cols = lite ? 8 : 10;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * (1.85 + rand() * 0.28) + (rand() - 0.5) * 0.4;
      const z = -6.2 - row * (2.05 + rand() * 0.45) + (rand() - 0.5) * 0.45;
      const w = 0.7 + rand() * 1.15;
      const d = 0.7 + rand() * 1.05;
      const hero = i % 9 === 0;
      const needle = i % 17 === 0;
      const h = (needle ? 20 : hero ? 13 : 4.2) + rand() * (needle ? 14 : hero ? 10 : 8);
      m.compose(new THREE.Vector3(x + 2.4, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, lite, theme.id]);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      maps?.map.dispose();
      maps?.emissiveMap.dispose();
    },
    [geo, mat, maps],
  );

  return (
    <group>
      <instancedMesh ref={meshRef} args={[geo, mat, count]} frustumCulled={false} />
      <mesh position={[4.2, 16.4, -11.2]} material={mat}>
        <boxGeometry args={[1.1, 32.8, 1.1]} />
      </mesh>
      <mesh position={[4.2, 33.4, -11.2]}>
        <cylinderGeometry args={[0.08, 0.12, 3.4, 8]} />
        <meshStandardMaterial color={theme.rim} emissive={theme.key} emissiveIntensity={0.7} metalness={0.8} roughness={0.22} />
      </mesh>
      <mesh position={[-1.1, 11.8, -8.6]} material={mat}>
        <boxGeometry args={[2.2, 23.6, 1.6]} />
      </mesh>
      <mesh position={[7.8, 9.6, -7.4]} material={mat}>
        <boxGeometry args={[1.6, 19.2, 1.4]} />
      </mesh>
    </group>
  );
}

function StarField({ lite }: { lite: boolean }) {
  const count = lite ? 80 : 160;
  const positions = useMemo(() => {
    const rand = mulberry32(0x5a17);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rand() - 0.5) * 90;
      arr[i * 3 + 1] = 8 + rand() * 36;
      arr[i * 3 + 2] = -12 - rand() * 50;
    }
    return arr;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#e8eef8" size={0.08} sizeAttenuation transparent opacity={0.72} depthWrite={false} />
    </points>
  );
}

function OrbitRing({ theme, reduced }: { theme: TitleDistrictTheme; reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (reduced || !ref.current) return;
    ref.current.rotation.z += dt * 0.08;
    ref.current.rotation.y += dt * 0.03;
  });
  return (
    <mesh ref={ref} position={[1.6, 9.4, -10]} rotation={[0.7, 0.2, 0.15]}>
      <torusGeometry args={[11.5, 0.035, 12, 96]} />
      <meshStandardMaterial
        color={theme.rim}
        emissive={theme.rim}
        emissiveIntensity={0.55}
        metalness={0.9}
        roughness={0.18}
      />
    </mesh>
  );
}

function TitleLights({ theme }: { theme: TitleDistrictTheme }) {
  return (
    <>
      <color attach="background" args={[theme.sky]} />
      <fog attach="fog" args={[theme.fog, 28, 88]} />
      <ambientLight color={theme.fill} intensity={0.28} />
      <hemisphereLight args={[theme.fill, "#0c1016", 0.42]} />
      <directionalLight position={[-12, 18, 10]} color={theme.key} intensity={1.05} />
      <directionalLight position={[14, 8, 6]} color={theme.fill} intensity={0.48} />
      <pointLight position={[3.2, 10, -8]} color={theme.window} intensity={16} distance={48} decay={2} />
      <pointLight position={[-4, 8, -6]} color="#00ff9f" intensity={6} distance={28} decay={2} />
    </>
  );
}

function TitleGround({ theme }: { theme: TitleDistrictTheme }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.5, -0.02, -10]} receiveShadow={false}>
        <planeGeometry args={[110, 80]} />
        <meshStandardMaterial
          color="#07090f"
          metalness={0.68}
          roughness={0.32}
          emissive={theme.fog}
          emissiveIntensity={0.06}
        />
      </mesh>
      <mesh position={[3, 4.2, -22]} rotation={[0, 0, 0]}>
        <planeGeometry args={[48, 10]} />
        <meshBasicMaterial color={theme.key} transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </>
  );
}

function TitleMoon({ theme }: { theme: TitleDistrictTheme }) {
  return (
    <mesh position={[-16, 14, -28]}>
      <sphereGeometry args={[1.8, 24, 24]} />
      <meshStandardMaterial color="#f4efe4" emissive={theme.key} emissiveIntensity={0.35} roughness={0.7} metalness={0.1} />
    </mesh>
  );
}

function TitleScene({
  theme,
  intensity,
  lite,
  reduced,
}: {
  theme: TitleDistrictTheme;
  intensity: "title" | "chamber";
  lite: boolean;
  reduced: boolean;
}) {
  return (
    <>
      <TitleLights theme={theme} />
      <CameraDrift intensity={intensity} reduced={reduced} />
      <TitleGround theme={theme} />
      <TitleSkyline theme={theme} lite={lite} />
      <StarField lite={lite} />
      <OrbitRing theme={theme} reduced={reduced} />
      <TitleMoon theme={theme} />
    </>
  );
}

export function TitleBackdrop({ cityId = "nyc", intensity = "title", lite }: TitleBackdropProps) {
  const theme = resolveTitleTheme(cityId);
  const [webgl, setWebgl] = useState(detectWebGL);
  const [reduced, setReduced] = useState(false);
  const autoLite =
    lite ??
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 800));

  useEffect(() => {
    setWebgl(detectWebGL());
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(Boolean(mq?.matches));
    sync();
    mq?.addEventListener?.("change", sync);
    return () => mq?.removeEventListener?.("change", sync);
  }, []);

  return (
    <div className={`oxc-titlebg oxc-titlebg--${intensity}`} aria-hidden style={{ ["--title-accent" as string]: theme.uiAccent }}>
      {!webgl && <CosmicBackdrop variant={intensity === "chamber" ? "chamber" : "cosmos"} />}
      {webgl && (
        <div className="oxc-titlebg-canvas">
          <Canvas
            dpr={autoLite ? [1, 1] : [1, 1.35]}
            camera={{ position: [9.6, 6.8, 19.2], fov: 42, near: 0.1, far: 140 }}
            gl={{
              antialias: !autoLite,
              powerPreference: autoLite ? "low-power" : "high-performance",
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.05,
              stencil: false,
              alpha: false,
            }}
          >
            <Suspense fallback={null}>
              <TitleScene
                key={theme.id}
                theme={theme}
                intensity={intensity}
                lite={Boolean(autoLite)}
                reduced={reduced}
              />
            </Suspense>
          </Canvas>
        </div>
      )}
      <div className="oxc-titlebg-haze" />
      <div className="oxc-titlebg-vignette" />
      <div className="oxc-titlebg-grade" />
      <div className="oxc-titlebg-grain" />
    </div>
  );
}
