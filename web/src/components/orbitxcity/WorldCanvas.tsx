import { Suspense, useCallback } from "react";
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
  } = useCity();
  const block = getWorldBlock(selectedCityId);

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
      <PlayerAvatar
        appearance={avatar}
        onMove={onMove}
        realtime={realtime}
        teleportTarget={teleportTarget}
        emoteAt={emoteAt}
        block={block}
      />
      <RemoteAvatars client={realtime} />
      <InteractionMarkers
        zones={block.zones}
        playerPos={playerPos}
        activeZoneId={activeZone?.id ?? null}
        onNearest={setActiveZone}
      />
      <CoinField playerPos={playerPos} onCollect={collectShard} />
      {quality === "high" && <FXPipeline />}
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
        camera={{ position: [0, 6, 14], fov: 55, near: 0.1, far: 240 }}
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
