/**
 * ORBITXCITY integration — non-UI systems host.
 *
 * Instantiates the module systems that need the live world and ticks them:
 *
 *  - ambient `AmbientSystem` (crowds, fire/EMS, performers, radio host…)
 *  - events `EventsSystem` (airdrops, quakes, fireworks, parades…; fed with
 *    live DexScreener quotes via `useLivePrices`)
 *  - heists `HeistDirector` (engine events → police `reportCrime`)
 *  - police `PursuitDirector` (cop visuals spawned vs `sceneRef`, siren audio,
 *    brief input freeze on `bust_imminent`)
 *  - factions war clocks (5s interval)
 *  - districts doors: proximity prompt + interior enter/exit (scene add/remove
 *    + teleport per the door table)
 *
 * Mounted next to <GtaHud/> while in-world. Renders only the door
 * prompt chips; everything else is headless.
 */
import { useEffect, useRef, useState, createContext, useContext } from "react";
import * as THREE from "three";
import { useLivePrices } from "@/hooks/useLivePrices";
import type { GtaApi } from "@/city/core/useGtaGame";
import { createHumanoid } from "@/city/core/Humanoid";
import { createCarMesh } from "@/city/core/Vehicle";
import { useSharedBilling } from "./CityBillingHost";
import { burnWith } from "./cityPorts";

// ambient
import { AmbientSystem, chaosBus } from "@/city/modules/ambient";
import { AmbientAudio } from "@/city/modules/ambient/audio";
import type { AmbientCtx, UiState } from "@/city/modules/ambient";
import type { MarketQuote } from "@/city/modules/ambient/types";
// events
import { createEventsSystem, type EventsSystem } from "@/city/modules/events";
import type { EventsContext, MarketSnapshot } from "@/city/modules/events";
// heists + police
import { HeistDirector } from "@/city/modules/heists";
import { getPoliceStore } from "@/city/modules/police";
import { PursuitDirector } from "@/city/modules/police";
import type { PursuitEvent, PursuitWorldPort, CopKind } from "@/city/modules/police";
// factions
import { getFactionsStore } from "@/city/modules/factions";
// districts
import {
  registerDistrictDoors,
  buildAllExteriors,
  nearestDoor,
  doorPromptLabel,
  type DoorTrigger,
  type DoorHit,
  buildExchangeInterior,
  buildHospitalInterior,
  buildMuseumInterior,
  buildLibraryInterior,
  buildObservatoryInterior,
  buildCityHallInterior,
  buildLighthouse,
} from "@/city/modules/districts";
import { preloadPilotAssets } from "@/city/modules/assets/loadAsset";

const MARKET_MINTS = [
  "So11111111111111111111111111111111111111112",
  "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPBAA7",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "EKpQGSJtjMFqKZ9KQanSqYXRcwiUd5R8ZEWHz5MCFG4rq",
];

/** Door id → interior builder (lighthouse is a deck teleport, no interior). */
const INTERIOR_BUILDERS: Record<string, () => { group: THREE.Group }> = {
  "door:exchange": () => buildExchangeInterior(),
  "door:hospital": () => buildHospitalInterior(),
  "door:museum": () => buildMuseumInterior(),
  "door:library": () => buildLibraryInterior(),
  "door:observatory": () => buildObservatoryInterior(),
  "door:cityhall": () => buildCityHallInterior(),
};

const _v3 = new THREE.Vector3();

/** Systems the apps shell can consume (EventHud, heist launcher…). Null until booted. */
export interface CitySystems {
  events: EventsSystem;
  heists: HeistDirector;
}
const CitySystemsContext = createContext<CitySystems | null>(null);
export function useCitySystems(): CitySystems | null {
  return useContext(CitySystemsContext);
}

export function CitySystemsHost({ api }: { api: GtaApi }) {
  const billing = useSharedBilling();
  const { prices } = useLivePrices(MARKET_MINTS, 30_000);
  const [doorHit, setDoorHit] = useState<DoorHit | null>(null);
  const [insideDoor, setInsideDoor] = useState<DoorTrigger | null>(null);
  const [ambientUi, setAmbientUi] = useState<UiState | null>(null);
  const sysRef = useRef<{
    ambient: AmbientSystem;
    events: EventsSystem;
    heists: HeistDirector;
    pursuit: PursuitDirector;
    dispose: () => void;
  } | null>(null);
  const [systems, setSystems] = useState<CitySystems | null>(null);
  const interiorsRef = useRef(new Map<string, THREE.Group>());
  const freezeUntilRef = useRef(0);

  // ---- main lifecycle: build systems once the world exists ----
  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let warTimer: ReturnType<typeof setInterval> | null = null;
    const copMeshes = new Map<string, THREE.Group>();
    let copSeq = 0;

    const boot = () => {
      if (disposed) return;
      const world = api.getWorld();
      if (!world) {
        // world spawns a tick after the in-world render; retry shortly
        setTimeout(boot, 400);
        return;
      }
      const scene = world.sceneRef;

      // Warm the real-asset GLB cache before exteriors mount (non-blocking).
      preloadPilotAssets();
      registerDistrictDoors();

      // ---- district exteriors: real GLB buildings, street props, parked cars ----
      const exteriors = buildAllExteriors();
      scene.add(exteriors.group);

      // ---- ambient ----
      const ambientCtx: AmbientCtx = {
        scene,
        colliders: world.collidersRef,
        audio: new AmbientAudio(api.audio),
        bus: chaosBus,
        playerPos: () => {
          const p = world.getPlayerState().pos;
          return _v3.set(p.x, p.y, p.z);
        },
        playerOnFoot: () => world.getPlayerState().onFoot,
        isNight: () => world.getPlayerState().isNight,
        getQuotes: (): Record<string, MarketQuote> => {
          const q: Record<string, MarketQuote> = {};
          for (const [sym, quote] of Object.entries(api.quotes)) {
            q[sym] = { price: quote.price, change24h: quote.change24h };
          }
          return q;
        },
        onUi: (ui) => setAmbientUi(ui),
        bounds: 200,
      };
      const ambient = new AmbientSystem(ambientCtx);
      ambient.activate();

      // ---- events ----
      const eventsCtx: EventsContext = {
        host: {
          scene,
          camera: world.cameraRef,
          getPlayerPosition: (out) => {
            const p = world.getPlayerState().pos;
            return out.set(p.x, p.y, p.z);
          },
          shakeCamera: () => { /* core owns the camera; shake is decorative-only for now */ },
          playSound: (name) => {
            const a = api.audio as unknown as Record<string, (() => void) | undefined>;
            a[name]?.();
          },
          isNight: world.getPlayerState().isNight,
          worldHalfSpan: 200,
        },
        wallet: null, // paper rewards credit through the economy wallet in onReward
        billing,
        weatherFirmId:
          getFactionsStore().getState().districts.find((d) => d.controller)?.controller ?? null,
        playerInWeatherFirm: false,
        communityVolume24h: 0, // integrator TODO: wire real platform volume
        ruggedHqs: [], // integrator TODO: rugged-HQ registry
        onReward: (reward) => {
          if (reward.kind === "city") {
            // paper CITY rewards land in the shared wallet
            void import("@/city/modules/economy/store/paperWallet").then(({ paperWallet }) =>
              paperWallet.earn(reward.amount ?? 0, "Event reward", "city-events"),
            );
          }
        },
      };
      const events = createEventsSystem(eventsCtx);

      // ---- heists (+ crime reporting into the police store) ----
      const heists = new HeistDirector();
      let lastStage: string | null = null;
      const unsubHeist = heists.engine.subscribe((session) => {
        const stage = session?.stage ?? null;
        if (stage !== lastStage) {
          lastStage = stage;
          if (stage === "execution" || stage === "getaway") {
            getPoliceStore().reportCrime({
              kind: "heist_offense",
              witnessed: true,
              label: `Heist ${stage} — ${session?.plan.templateId ?? "unknown"}`,
            });
          }
        }
      });

      // ---- police pursuit (cop visuals vs sceneRef) ----
      const police = getPoliceStore();
      const pursuitPort: PursuitWorldPort = {
        player: () => {
          const s = world.getPlayerState();
          return {
            pos: { x: s.pos.x, z: s.pos.z },
            onFoot: s.onFoot,
            speed: s.speed,
            heading: s.heading,
          };
        },
        spawnCop: (kind: CopKind) => {
          const id = `cop-${++copSeq}`;
          const g =
            kind === "cruiser"
              ? createCarMesh(0x1c4fd6).group
              : createHumanoid({ shirt: 0x1c4fd6, pants: 0x101318 }).group;
          const p = world.getPlayerState().pos;
          g.position.set(p.x + 18, 0, p.z + 18);
          scene.add(g);
          copMeshes.set(id, g);
          return id;
        },
        moveCop: (id, pos, heading) => {
          const g = copMeshes.get(id);
          if (!g) return;
          g.position.set(pos.x, 0, pos.z);
          g.rotation.y = heading;
        },
        despawnCop: (id) => {
          const g = copMeshes.get(id);
          if (g) {
            scene.remove(g);
            copMeshes.delete(id);
          }
        },
        onEvent: (ev: PursuitEvent) => {
          if (ev.type === "spotted") api.audio.siren(2);
          if (ev.type === "bust_imminent") {
            // brief input freeze so the bust lands
            freezeUntilRef.current = performance.now() + 1200;
          }
        },
      };
      const pursuit = new PursuitDirector(pursuitPort);
      const unsubPolice = police.subscribe(() => {
        pursuit.setStars(police.stars);
      });
      pursuit.setStars(police.stars);

      // ---- factions war clocks (5s) ----
      const factions = getFactionsStore();
      warTimer = setInterval(() => {
        try {
          factions.tickWarClocks();
        } catch { /* defensive */ }
      }, 5000);

      // ---- per-frame tick ----
      let last = performance.now();
      let doorT = 0;
      const loop = () => {
        if (disposed) return;
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        try {
          ambient.update(dt);
        } catch { /* decorative */ }
        try {
          events.update(dt, Date.now());
        } catch { /* decorative */ }
        try {
          pursuit.update(dt, police.stars);
        } catch { /* decorative */ }
        // input freeze window (bust_imminent)
        if (now < freezeUntilRef.current) {
          api.input.moveX = 0;
          api.input.moveY = 0;
        }
        // door proximity prompt (4Hz)
        doorT += dt;
        if (doorT > 0.25) {
          doorT = 0;
          const s = world.getPlayerState();
          const hit = s.onFoot ? nearestDoor([s.pos.x, s.pos.y, s.pos.z]) : null;
          setDoorHit((prev) => (prev?.door.id === hit?.door.id ? prev : hit));
        }
      };
      raf = requestAnimationFrame(loop);

      sysRef.current = {
        ambient,
        events,
        heists,
        pursuit,
        dispose: () => {
          unsubHeist();
          unsubPolice();
          ambient.dispose();
          events.dispose();
          scene.remove(exteriors.group);
          exteriors.dispose();
          for (const [, g] of copMeshes) scene.remove(g);
          copMeshes.clear();
        },
      };
      setSystems({ events, heists });
    };

    boot();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (warTimer) clearInterval(warTimer);
      sysRef.current?.dispose();
      sysRef.current = null;
      setSystems(null);
      // remove any interior groups we added
      const world = api.getWorld();
      for (const [, g] of interiorsRef.current) world?.sceneRef.remove(g);
      interiorsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  // ---- feed live market data into the events system ----
  useEffect(() => {
    const sys = sysRef.current;
    if (!sys) return;
    const snap: MarketSnapshot = {};
    for (const [mint, q] of Object.entries(prices)) {
      snap[mint] = {
        price: q.price,
        priceChange24h: q.priceChange24h,
        volume24h: q.volume24h,
        liquidity: q.liquidity,
        marketCap: q.marketCap,
        lastUpdated: q.lastUpdated,
      };
    }
    try {
      sys.events.pollMarket(snap);
    } catch { /* decorative */ }
  }, [prices]);

  // ---- district door enter/exit ----
  const enterDoor = (door: DoorTrigger) => {
    const world = api.getWorld();
    if (!world) return;
    if (door.id === "door:lighthouse") {
      // deck teleport (panoramic screenshot spot), no interior group
      world.teleport(door.interiorSpawn[0], door.interiorSpawn[2]);
      setInsideDoor(door);
      return;
    }
    const build = INTERIOR_BUILDERS[door.id];
    if (!build) return;
    let g = interiorsRef.current.get(door.id);
    if (!g) {
      try {
        g = build().group;
      } catch {
        return;
      }
      interiorsRef.current.set(door.id, g);
      world.sceneRef.add(g);
    }
    g.visible = true;
    world.teleport(door.interiorSpawn[0], door.interiorSpawn[2]);
    setInsideDoor(door);
    api.audio.door();
  };

  const exitDoor = () => {
    const world = api.getWorld();
    const door = insideDoor;
    setInsideDoor(null);
    if (!world || !door) return;
    const g = interiorsRef.current.get(door.id);
    if (g) g.visible = false;
    world.teleport(door.exitPosition[0], door.exitPosition[2]);
    api.audio.door();
  };

  const isMobile = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

  return (
    <CitySystemsContext.Provider value={systems}>
      {doorHit && !insideDoor && (
        <button
          data-hud
          className="ocg-door-prompt"
          onClick={() => enterDoor(doorHit.door)}
        >
          <span className="ocg-prompt-key">{isMobile ? "TAP" : "E"}</span>
          <div>
            <strong>{doorHit.door.label}</strong>
            <span>{doorPromptLabel(doorHit.door, isMobile)}</span>
          </div>
        </button>
      )}
      {insideDoor && (
        <button data-hud className="ocg-door-prompt" onClick={exitDoor}>
          <span className="ocg-prompt-key">{isMobile ? "TAP" : "E"}</span>
          <div>
            <strong>Exit {insideDoor.label}</strong>
            <span>Back to the street</span>
          </div>
        </button>
      )}
      {ambientUi && ambientUi.toasts.length > 0 && (
        <div data-hud className="ocg-ambient-toast">
          {ambientUi.toasts[ambientUi.toasts.length - 1].text}
        </div>
      )}
    </CitySystemsContext.Provider>
  );
}

/** Re-export for the apps shell: settle pending mayoral votes with real billing. */
export async function settlePendingVotes(billing: NonNullable<ReturnType<typeof useSharedBilling>>) {
  const store = getFactionsStore();
  if (!billing.ready) throw new Error("Billing not authed yet");
  return store.settlePendingVotes(burnWith(billing));
}
