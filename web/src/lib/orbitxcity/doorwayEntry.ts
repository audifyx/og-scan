import { Vector2 } from "three";
import { BuildingDefinition } from "./types";

export interface DoorThreshold {
  buildingId: string;
  position: Vector2;
  radius: number;
  normal: Vector2; // facing direction
}

export interface BuildingEntrance {
  buildingId: string;
  doorPosition: Vector2;
  interiorSpawn: Vector2;
  exitPoint: Vector2;
}

/** Extract door thresholds from buildings marked as walk-in venues */
export function getBuildingEntrances(buildings: BuildingDefinition[]): BuildingEntrance[] {
  return buildings
    .filter((b) => b.interaction) // Only branded interactive buildings
    .map((b) => {
      const cx = b.position.x + b.size.width / 2;
      const cz = b.position.z + b.size.depth / 2;
      // Door at front (positive Z) of building
      const doorZ = b.position.z + b.size.depth / 2 + 0.5; // threshold just outside
      return {
        buildingId: b.id,
        doorPosition: new Vector2(cx, doorZ),
        interiorSpawn: new Vector2(cx, b.position.z + 2),
        exitPoint: new Vector2(cx, doorZ + 1),
      };
    });
}

/** Check if player crosses a doorway threshold and should enter */
export function checkDoorwayCrossing(
  prevPos: Vector2,
  currPos: Vector2,
  entrance: BuildingEntrance,
  thresholdRadius: number = 0.6
): boolean {
  const doorPos = entrance.doorPosition;
  const dx = currPos.x - doorPos.x;
  const dz = currPos.y - doorPos.y; // Vector2.y is Z in world space

  // Player is near the doorway threshold
  const distToDoor = Math.sqrt(dx * dx + dz * dz);
  if (distToDoor > thresholdRadius) return false;

  // Check if player crossed the threshold from outside to inside
  const prevDx = prevPos.x - doorPos.x;
  const prevDz = prevPos.y - doorPos.y;
  const prevDist = Math.sqrt(prevDx * prevDx + prevDz * prevDz);

  // Entering if previous position was outside threshold and current is inside
  return prevDist > thresholdRadius && distToDoor <= thresholdRadius;
}

/** Check if player has exited the interior back through the door */
export function checkDoorwayExit(
  prevPosInterior: Vector2,
  currPosExterior: Vector2,
  entrance: BuildingEntrance,
  exitRadius: number = 1.2
): boolean {
  const doorPos = entrance.doorPosition;
  const dx = currPosExterior.x - doorPos.x;
  const dz = currPosExterior.y - doorPos.y;
  const distToDoor = Math.sqrt(dx * dx + dz * dz);
  return distToDoor < exitRadius;
}
