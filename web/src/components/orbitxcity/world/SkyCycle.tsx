import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";
import { DAY_SECONDS, updateDayNight } from "@/lib/orbitxcity/dayNight";

function skyPalette(cityId: WorldBlockConfig["cityId"]) {
  switch (cityId) {
    case "miami":
      return { day: new THREE.Color("#7ec8e3"), dusk: new THREE.Color("#3a4a58"), night: new THREE.Color("#0a1118") };
    case "la":
      return { day: new THREE.Color("#8a94a6"), dusk: new THREE.Color("#3a3048"), night: new THREE.Color("#0e0c16") };
    case "boston":
      return { day: new THREE.Color("#86a4c0"), dusk: new THREE.Color("#2e3844"), night: new THREE.Color("#0a1016") };
    default:
      return { day: new THREE.Color("#7ea4c8"), dusk: new THREE.Color("#2a3440"), night: new THREE.Color("#080c12") };
  }
}

/**
 * Slow real-time sky cycle — sun/moon lighting, city-specific haze, fog.
 * Sole writer of the shared day/night snapshot (see lib/orbitxcity/dayNight.ts):
 * streetlights, lit windows, drones and the skyline read lampLevel/windowLevel
 * from getDayNight() in their own useFrame loops.
 */
export function SkyCycle({ block }: { block: WorldBlockConfig }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.HemisphereLight>(null);
  const moon = useRef<THREE.Mesh>(null);
  const palette = skyPalette(block.cityId);
  const scratch = useRef({ sky: new THREE.Color(), cool: new THREE.Color("#121820") });

  useFrame(({ clock, scene }) => {
    const phase = (clock.elapsedTime % DAY_SECONDS) / DAY_SECONDS;
    const arc = phase * Math.PI * 2 - Math.PI / 2;
    const daylight = Math.max(0, Math.sin(arc));
    const twilight = Math.max(0, 1 - Math.abs(Math.sin(arc)) * 2);
    const night = 1 - daylight;
    const sky = scratch.current.sky.copy(palette.night).lerp(palette.dusk, twilight).lerp(palette.day, daylight);
    scene.background = sky;
    // Keep fog cool/dark so neon emissives stay readable.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(sky).lerp(scratch.current.cool, 0.45);
    }

    if (sun.current) {
      sun.current.position.set(Math.cos(arc) * 46, 10 + daylight * 48, Math.sin(arc) * 34);
      sun.current.intensity = 0.28 + daylight * 0.85 + twilight * 0.3;
      sun.current.color.set(daylight > 0.35 ? "#fff0d2" : twilight > 0.3 ? "#ffb36b" : "#8fa8cc");
    }
    if (fill.current) fill.current.intensity = 0.4 + daylight * 0.45;
    if (moon.current) {
      moon.current.position.set(-Math.cos(arc) * 58, 12 + night * 36, -Math.sin(arc) * 46);
      moon.current.visible = daylight < 0.42;
    }

    // Publish for the rest of the scene — no allocation, listeners only fire
    // when the coarse day/dusk/night band changes.
    updateDayNight({
      phase,
      daylight,
      twilight,
      night,
      sunAngle: arc,
      lampLevel: Math.min(1, night * 1.6 + twilight * 0.45),
      windowLevel: Math.min(1, night * 1.5 + twilight * 0.55),
    });
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
