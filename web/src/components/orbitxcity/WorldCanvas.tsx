import { Suspense, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import type { Vec3 } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { CityEnvironment } from "./world/CityEnvironment";
import { PlayerAvatar } from "./world/PlayerAvatar";
import { InteractionMarkers } from "./world/InteractionMarkers";
import { Collectibles } from "./world/Collectibles";

function WorldScene() {
  const { avatar, setPlayerPos, setActiveZone, activeZone, playerPos } = useCity();

  const onMove = useCallback(
    (p: Vec3) => {
      setPlayerPos(p);
    },
    [setPlayerPos],
  );

  return (
    <>
      <CityEnvironment />
      <Collectibles />
      <PlayerAvatar appearance={avatar} onMove={onMove} />
      <InteractionMarkers
        zones={NYC_DEMO_BLOCK.zones}
        playerPos={playerPos}
        activeZoneId={activeZone?.id ?? null}
        onNearest={setActiveZone}
      />
    </>
  );
}

export function WorldCanvas() {
  return (
    <div className="oxc-canvas">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 6, 14], fov: 55, near: 0.1, far: 120 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <WorldScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
