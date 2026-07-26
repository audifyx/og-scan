import { Suspense, useCallback, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useContextBridge } from "@react-three/drei";
import type { Vec3 } from "@/lib/orbitxcity/types";
import type { ScreenerRow } from "@/lib/orbitxcity/marketData";
import { getWorldBlock } from "@/lib/orbitxcity/worlds";
import { CityContext, useCity } from "@/pages/orbitxcity/CityProvider";
import { CityEnvironment } from "./world/CityEnvironment";
import { PlayerAvatar } from "./world/PlayerAvatar";
import { RemoteAvatars } from "./world/RemoteAvatars";
import { InteractionMarkers } from "./world/InteractionMarkers";
import { CoinField } from "./world/CoinField";
import { FXPipeline } from "./world/FXPipeline";
import { InteriorRoom } from "./world/InteriorRoom";

function WorldScene({ tickerRows }: { tickerRows: ScreenerRow[] }) {
  const {
    avatar,
    setPlayerPos,
    setPlayerYaw,
    setActiveZone,
    activeZone,
    playerPos,
    collectShard,
    realtime,
    teleportTarget,
    quality,
    emoteAt,
    selectedCityId,
    interiorBuildingId,
    exitBuilding,
  } = useCity();
  const block = getWorldBlock(selectedCityId);

  const interiorBuilding = useMemo(
    () => (interiorBuildingId ? block.buildings.find((b) => b.id === interiorBuildingId) ?? null : null),
    [block.buildings, interiorBuildingId],
  );

  const onMove = useCallback(
    (p: Vec3, yaw: number) => {
      setPlayerPos(p);
      setPlayerYaw(yaw);
    },
    [setPlayerPos, setPlayerYaw],
  );

  return (
    <>
      <CityEnvironment tickerRows={tickerRows} block={block} />
      {interiorBuilding && (
        <InteriorRoom building={interiorBuilding} onRequestExit={exitBuilding} />
      )}
      <PlayerAvatar
        appearance={avatar}
        onMove={onMove}
        realtime={realtime}
        teleportTarget={teleportTarget}
        emoteAt={emoteAt}
        block={block}
        ignoreBuildingId={interiorBuildingId}
      />
      <RemoteAvatars client={realtime} />
      <InteractionMarkers
        zones={block.zones}
        playerPos={playerPos}
        activeZoneId={activeZone?.id ?? null}
        onNearest={setActiveZone}
      />
      <CoinField playerPos={playerPos} onCollect={collectShard} lite={quality === "lite"} />
      {quality === "high" && <FXPipeline />}
    </>
  );
}

export function WorldCanvas({ tickerRows }: { tickerRows: ScreenerRow[] }) {
  const ContextBridge = useContextBridge(CityContext);
  const { quality } = useCity();
  const high = quality === "high";

  return (
    <div className="oxc-canvas">
      <Canvas
        shadows={high}
        dpr={high ? [1, 1.6] : [1, 1]}
        camera={{ position: [0, 6, 14], fov: 55, near: 0.1, far: high ? 240 : 160 }}
        gl={{
          antialias: high,
          powerPreference: high ? "high-performance" : "low-power",
          // Avoid stencil/depth thrash on mobile GPUs
          stencil: false,
        }}
        performance={{ min: high ? 0.5 : 0.3 }}
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
