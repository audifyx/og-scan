import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";

const DAY_SECONDS = 360;

function skyPalette(cityId: WorldBlockConfig["cityId"]) {
  switch (cityId) {
    case "miami":
      return { day: new THREE.Color("#6a98a4"), dusk: new THREE.Color("#3a4a58"), night: new THREE.Color("#0c141c") };
    case "la":
      return { day: new THREE.Color("#7a8090"), dusk: new THREE.Color("#3a3048"), night: new THREE.Color("#100e18") };
    case "boston":
      return { day: new THREE.Color("#748490"), dusk: new THREE.Color("#2e3844"), night: new THREE.Color("#0c1218") };
    default:
      return { day: new THREE.Color("#6e7e8a"), dusk: new THREE.Color("#2a3440"), night: new THREE.Color("#0a0e14") };
  }
}

/** A slow real-time sky cycle with sun/moon lighting and city-specific haze. */
export function SkyCycle({ block }: { block: WorldBlockConfig }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.HemisphereLight>(null);
  const moon = useRef<THREE.Mesh>(null);
  const palette = skyPalette(block.cityId);

  useFrame(({ clock, scene }) => {
    const phase = (clock.elapsedTime % DAY_SECONDS) / DAY_SECONDS;
    const arc = phase * Math.PI * 2 - Math.PI / 2;
    const daylight = Math.max(0, Math.sin(arc));
    const twilight = Math.max(0, 1 - Math.abs(Math.sin(arc)) * 2);
    const sky = palette.night.clone().lerp(palette.dusk, twilight).lerp(palette.day, daylight);
    scene.background = sky;
    // Keep fog cool/dark so neon emissives stay readable.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(sky).lerp(new THREE.Color("#121820"), 0.45);
    }

    if (sun.current) {
      sun.current.position.set(Math.cos(arc) * 46, 10 + daylight * 48, Math.sin(arc) * 34);
      sun.current.intensity = 0.08 + daylight * 0.95 + twilight * 0.35;
      sun.current.color.set(daylight > 0.35 ? "#fff0d2" : "#a8c0d4");
    }
    if (fill.current) fill.current.intensity = 0.2 + daylight * 0.55;
    if (moon.current) {
      moon.current.position.set(-Math.cos(arc) * 58, 12 + (1 - daylight) * 36, -Math.sin(arc) * 46);
      moon.current.visible = daylight < 0.42;
    }
  });

  return (
    <>
      <hemisphereLight ref={fill} args={["#a8c0d0", "#1a2228", 0.75]} />
      <directionalLight ref={sun} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} shadow-bias={-0.0002} />
      <mesh ref={moon}>
        <sphereGeometry args={[2.1, 20, 16]} />
        <meshBasicMaterial color="#e8edf0" toneMapped={false} />
      </mesh>
    </>
  );
}
