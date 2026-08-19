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

function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function CameraDrift({ intensity, reduced }: { intensity: "title" | "chamber"; reduced: boolean }) {
  const base = intensity === "chamber" ? new THREE.Vector3(5.4, 5.2, 13.5) : new THREE.Vector3(7.2, 5.8, 16.2);
  const look = intensity === "chamber" ? new THREE.Vector3(-1.2, 2.6, -6) : new THREE.Vector3(-2.4, 2.8, -8);

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
  const count = lite ? 28 : 48;
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a2230",
        metalness: 0.58,
        roughness: 0.42,
        emissive: theme.window,
        emissiveIntensity: 0.14,
        vertexColors: true,
        envMapIntensity: 0.6,
      }),
    [theme.window],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const rand = mulberry32(0xc17c ^ theme.id.charCodeAt(0) * 97);
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    const windowCol = hexToColor(theme.window);
    const stone = new THREE.Color("#161c28");
    const cols = lite ? 7 : 8;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * (2.15 + rand() * 0.35) + (rand() - 0.5) * 0.55;
      const z = -4.5 - row * (2.4 + rand() * 0.5) + (rand() - 0.5) * 0.6;
      const w = 0.95 + rand() * 1.55;
      const d = 0.95 + rand() * 1.45;
      const hero = i % 11 === 0;
      const h = (hero ? 14 : 5) + rand() * (hero ? 16 : 11);
      m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      mesh.setMatrixAt(i, m);
      if (rand() > 0.38) {
        color.copy(windowCol).lerp(stone, 0.35 + rand() * 0.25);
      } else {
        color.copy(stone).offsetHSL(0, 0, (rand() - 0.5) * 0.06);
      }
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, lite, theme.id]);

  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );

  return <instancedMesh ref={meshRef} args={[geo, mat, count]} frustumCulled={false} />;
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
      <fog attach="fog" args={[theme.fog, 16, 72]} />
      <ambientLight color={theme.fill} intensity={0.28} />
      <hemisphereLight args={[theme.fill, "#1a140e", 0.35]} />
      <directionalLight position={[-10, 16, 8]} color={theme.key} intensity={1.35} />
      <directionalLight position={[12, 6, 4]} color={theme.fill} intensity={0.42} />
      <pointLight position={[0, 9, -6]} color={theme.window} intensity={8} distance={36} decay={2} />
    </>
  );
}

function TitleGround({ theme }: { theme: TitleDistrictTheme }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -8]} receiveShadow={false}>
      <planeGeometry args={[90, 70]} />
      <meshStandardMaterial
        color="#07090f"
        metalness={0.72}
        roughness={0.28}
        emissive={theme.fog}
        emissiveIntensity={0.08}
      />
    </mesh>
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
            camera={{ position: [7.2, 5.8, 16.2], fov: 46, near: 0.1, far: 120 }}
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
