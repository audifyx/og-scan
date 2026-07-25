import { Suspense, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { useContextBridge } from "@react-three/drei";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import type { Vec3 } from "@/lib/orbitxcity/types";
import type { ScreenerRow } from "@/lib/orbitxcity/marketData";
import { CityContext, useCity } from "@/pages/orbitxcity/CityProvider";
import { CityEnvironment } from "./world/CityEnvironment";
import { PlayerAvatar } from "./world/PlayerAvatar";
import { InteractionMarkers } from "./world/InteractionMarkers";
import { CoinField } from "./world/CoinField";
import { FXPipeline } from "./world/FXPipeline";

function WorldScene({ tickerRows }: { tickerRows: ScreenerRow[] }) {
  const { avatar, setPlayerPos, setActiveZone, activeZone, playerPos, collectShard } = useCity();

  const onMove = useCallback(
    (p: Vec3) => {
      setPlayerPos(p);
    },
    [setPlayerPos],
  );

  return (
    <>
      <CityEnvironment tickerRows={tickerRows} />
      <PlayerAvatar appearance={avatar} onMove={onMove} />
      <InteractionMarkers
        zones={NYC_DEMO_BLOCK.zones}
        playerPos={playerPos}
        activeZoneId={activeZone?.id ?? null}
        onNearest={setActiveZone}
      />
      <CoinField playerPos={playerPos} onCollect={collectShard} />
      <FXPipeline />
    </>
  );
}

export function WorldCanvas({ tickerRows }: { tickerRows: ScreenerRow[] }) {
  const ContextBridge = useContextBridge(CityContext);

  return (
    <div className="oxc-canvas">
      <Canvas
        shadows
        dpr={[1, 1.6]}
        camera={{ position: [0, 6, 14], fov: 55, near: 0.1, far: 160 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <ContextBridge>
          <Suspense fallback={null}>
            <WorldScene tickerRows={tickerRows} />
          </Suspense>
        </ContextBridge>
      </Canvas>
    </div>
  );
}
