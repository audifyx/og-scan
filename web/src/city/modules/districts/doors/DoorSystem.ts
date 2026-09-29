/**
 * Door trigger registry — the mount points where interiors attach to the world.
 *
 * Interiors in OrbitXCity are separate scenes mounted by the integrator:
 * walking into a door trigger swaps the visible scene group (outdoor world
 * ↔ interior) and teleports the player to the interior spawn. This file owns
 * the registry + proximity prompts; the integrator owns the actual
 * scene-swap (see MODULE.md "Integration").
 */
import type { DoorTrigger, Vec3T } from "../types";

const doors = new Map<string, DoorTrigger>();

export function registerDoor(door: DoorTrigger): void {
  doors.set(door.id, door);
}

export function registerDoors(list: DoorTrigger[]): void {
  list.forEach(registerDoor);
}

export function unregisterDoor(id: string): void {
  doors.delete(id);
}

export function getDoor(id: string): DoorTrigger | undefined {
  return doors.get(id);
}

export function allDoors(): DoorTrigger[] {
  return [...doors.values()];
}

export interface DoorHit {
  door: DoorTrigger;
  distance: number;
}

/** Find the nearest door whose prompt radius contains the player (x/z plane). */
export function nearestDoor(playerPos: Vec3T): DoorHit | null {
  let best: DoorHit | null = null;
  for (const door of doors.values()) {
    const dx = playerPos[0] - door.position[0];
    const dz = playerPos[2] - door.position[2];
    const d = Math.hypot(dx, dz);
    if (d <= door.radius && (!best || d < best.distance)) {
      best = { door, distance: d };
    }
  }
  return best;
}

/**
 * Default prompt label, e.g. "Press E · Enter Stock Exchange".
 * The integrator renders this when `nearestDoor` returns a hit.
 */
export function doorPromptLabel(door: DoorTrigger, isMobile: boolean): string {
  const key = isMobile ? "Tap" : "Press E";
  return `${key} · ${door.prompt}`;
}
