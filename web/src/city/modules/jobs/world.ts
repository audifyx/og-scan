/**
 * World helpers for job gameplay. Additive only — never fights the core loop.
 * Jobs read player state via getPlayer(api) (= world.getPlayerState()) and
 * add props to sceneRef.
 */
import { useEffect, useRef, useState } from "react";
import type { GTAWorld } from "../../core";
import type { GtaApi } from "../../core";
import { BLOCKS, HALF, PITCH, ROAD_W } from "../../core";

/** Player snapshot shape from the core world. */
export type PlayerSnap = ReturnType<GTAWorld["getPlayerState"]>;

/**
 * Null-safe player snapshot. GtaApi does NOT expose getPlayerState directly
 * (verified against core/useGtaGame.ts) — every module team reads it as
 * api.getWorld()?.getPlayerState(). Jobs must go through this helper.
 */
export function getPlayer(api: GtaApi): PlayerSnap | null {
  const w = api.getWorld();
  return w ? w.getPlayerState() : null;
}

/** The live world instance, or null when not in-world. Polled cheaply. */
export function useWorldPresence(api: GtaApi): GTAWorld | null {
  const [world, setWorld] = useState<GTAWorld | null>(() => api.getWorld());
  useEffect(() => {
    const id = window.setInterval(() => {
      const w = api.getWorld();
      setWorld((prev) => (prev === w ? prev : w));
    }, 500);
    return () => window.clearInterval(id);
  }, [api]);
  return world;
}

/**
 * rAF tick for job logic. cb receives (dt seconds, world | null).
 * The loop is independent of the core loop and only reads state / adds props.
 */
export function useWorldTick(api: GtaApi, cb: (dt: number, world: GTAWorld | null) => void): void {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      try {
        cbRef.current(dt, api.getWorld());
      } catch {
        /* job tick must never crash the frame */
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [api]);
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

export function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

/** Random point on a road intersection node. */
export function randomNode(): { x: number; z: number } {
  const i = 1 + Math.floor(Math.random() * (BLOCKS - 1));
  const j = 1 + Math.floor(Math.random() * (BLOCKS - 1));
  return { x: -HALF + ROAD_W / 2 + i * PITCH, z: -HALF + ROAD_W / 2 + j * PITCH };
}

/** Random point on a sidewalk edge near a node (for peds / pickups). */
export function sidewalkNear(x: number, z: number): { x: number; z: number } {
  const off = ROAD_W / 2 + 2.5 + Math.random() * 2;
  const side = Math.floor(Math.random() * 4);
  switch (side) {
    case 0:
      return { x: x + off, z };
    case 1:
      return { x: x - off, z };
    case 2:
      return { x, z: z + off };
    default:
      return { x, z: z - off };
  }
}

/** Random sidewalk point anywhere in the city. */
export function randomSidewalk(): { x: number; z: number } {
  const n = randomNode();
  return sidewalkNear(n.x, n.z);
}

/** Clamp a point inside the city bounds. */
export function clampCity(x: number, z: number, margin = 10): { x: number; z: number } {
  const m = HALF - margin;
  return { x: Math.max(-m, Math.min(m, x)), z: Math.max(-m, Math.min(m, z)) };
}

/** Named districts for flavor text (grid quadrants + center). */
export function districtAt(x: number, z: number): string {
  const cx = x >= 0 ? "East" : "West";
  const cz = z >= 0 ? "South" : "North";
  if (Math.abs(x) < HALF * 0.35 && Math.abs(z) < HALF * 0.35) return "Downtown";
  return `${cx} ${cz}side`;
}
