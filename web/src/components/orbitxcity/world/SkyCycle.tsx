import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldBlockConfig } from "@/lib/orbitxcity/types";

const DAY_SECONDS = 360;

function skyPalette(cityId: WorldBlockConfig["cityId"]) {
  switch (cityId) {
    case "miami":
      return { day: new THREE.Color("#8fc6d0"), dusk: new THREE.Color("#b98087"), night: new THREE.Color("#17263c") };
    case "la":
      return { day: new THREE.Color("#abb2b7"), dusk: new THREE.Color("#c08d73"), night: new THREE.Color("#202536") };
    case "boston":
      return { day: new THREE.Color("#a6b6bf"), dusk: new THREE.Color("#897d8c"), night: new THREE.Color("#1d2732") };
    default:
      return { day: new THREE.Color("#9eafb8"), dusk: new THREE.Color("#9b7780"), night: new THREE.Color("#182330") };
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
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(sky).lerp(new THREE.Color("#7b8790"), 0.25);

    if (sun.current) {
      sun.current.position.set(Math.cos(arc) * 46, 10 + daylight * 48, Math.sin(arc) * 34);
      sun.current.intensity = 0.12 + daylight * 1.25 + twilight * 0.3;
      sun.current.color.set(daylight > 0.35 ? "#fff0d2" : "#d7b6aa");
    }
    if (fill.current) fill.current.intensity = 0.25 + daylight * 0.7;
    if (moon.current) {
      moon.current.position.set(-Math.cos(arc) * 58, 12 + (1 - daylight) * 36, -Math.sin(arc) * 46);
      moon.current.visible = daylight < 0.42;
    }
  });

  return (
    <>
      <hemisphereLight ref={fill} args={["#c7d6df", "#344033", 0.9]} />
      <directionalLight ref={sun} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} shadow-bias={-0.0002} />
      <mesh ref={moon}>
        <sphereGeometry args={[2.1, 20, 16]} />
        <meshBasicMaterial color="#e8edf0" toneMapped={false} />
      </mesh>
    </>
  );
}
