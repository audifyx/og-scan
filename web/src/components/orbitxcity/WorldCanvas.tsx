import { Component, Suspense, useCallback, useMemo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { useContextBridge } from "@react-three/drei";
import * as THREE from "three";
import type { CityId, Vec3 } from "@/lib/orbitxcity/types";
import type { ScreenerRow } from "@/lib/orbitxcity/marketData";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { getWorldBlock } from "@/lib/orbitxcity/worlds";
import { CityContext, useCity } from "@/pages/orbitxcity/CityProvider";
import { CityEnvironment } from "./world/CityEnvironment";
import { PlayerAvatar } from "./world/PlayerAvatar";
import { RemoteAvatars } from "./world/RemoteAvatars";
import { InteractionMarkers } from "./world/InteractionMarkers";
import { CoinField } from "./world/CoinField";
import { FXPipeline } from "./world/FXPipeline";
import { InteriorRoom } from "./world/InteriorRoom";

function safeWorldBlock(cityId: string | undefined) {
  try {
    const block = getWorldBlock((cityId as CityId) || "nyc");
    if (block?.buildings && block.bounds && block.spawn) return block;
  } catch {
    /* fall through */
  }
  return NYC_DEMO_BLOCK;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[WorldCanvas] scene error", error.message);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

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
    enterBuilding,
    exitBuilding,
    panel,
  } = useCity();
  const block = safeWorldBlock(selectedCityId);
  const high = quality === "high";
  const locked = panel !== "none";

  const interiorBuilding = useMemo(() => {
    if (!interiorBuildingId || !block.buildings?.length) return null;
    return block.buildings.find((b) => b.id === interiorBuildingId) ?? null;
  }, [block.buildings, interiorBuildingId]);

  const onMove = useCallback(
    (p: Vec3, yaw: number) => {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
      setPlayerPos(p);
      setPlayerYaw(yaw);
    },
    [setPlayerPos, setPlayerYaw],
  );

  return (
    <>
      <CityEnvironment tickerRows={tickerRows} block={block} />
      {interiorBuilding ? <InteriorRoom building={interiorBuilding} onRequestExit={exitBuilding} /> : null}
      <PlayerAvatar
        appearance={avatar}
        onMove={onMove}
        realtime={realtime}
        teleportTarget={teleportTarget}
        emoteAt={emoteAt}
        block={block}
        ignoreBuildingId={interiorBuilding ? interiorBuildingId : null}
        interiorBuilding={interiorBuilding}
        onEnterBuilding={(id) => enterBuilding(id, { soft: true })}
        onExitBuilding={() => exitBuilding({ soft: true })}
        locked={locked}
      />
      <RemoteAvatars client={realtime} />
      {!locked && (
        <InteractionMarkers
          zones={block.zones ?? []}
          playerPos={playerPos}
          activeZoneId={activeZone?.id ?? null}
          onNearest={setActiveZone}
        />
      )}
      <CoinField playerPos={playerPos} onCollect={collectShard} lite={!high} block={block} />
      {high && !locked && <FXPipeline />}
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
        camera={{ position: [0, 6, 14], fov: 55, near: 0.1, far: high ? 240 : 140 }}
        gl={{
          antialias: high,
          powerPreference: high ? "high-performance" : "low-power",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: high ? 1.22 : 1.12,
          stencil: false,
        }}
        performance={{ min: high ? 0.5 : 0.25 }}
      >
        <ContextBridge>
          <SceneBoundary>
            <Suspense fallback={null}>
              <WorldScene tickerRows={tickerRows} />
            </Suspense>
          </SceneBoundary>
        </ContextBridge>
      </Canvas>
    </div>
  );
}
