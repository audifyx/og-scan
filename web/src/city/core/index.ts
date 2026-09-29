/**
 * ORBITXCITY core — public surface for module teams.
 *
 * Core owns ONLY: procedural realistic city, third-person character
 * controller, enter/exit + arcade car driving, camera, day/night cycle,
 * collision, mobile touch controls. GTA-style, realistic, not blocky.
 *
 * Module teams (`web/src/city/modules/*`): import what you need from here.
 * Document your needs in your MODULE.md. Additive scene work only — never
 * fight the core loop for player/vehicle control.
 */

export { GTAWorld } from "./World";
export type { HudState, Quote, WorldOpts } from "./World";

export {
  createInput,
  KeyboardInput,
  OrbitDrag,
  setTouchMove,
  setTouchSprint,
} from "./input";
export type { InputState } from "./input";

export {
  buildCity,
  BLOCKS,
  BLOCK,
  ROAD_W,
  SIDEWALK_W,
  PITCH,
  CITY_SPAN,
  HALF,
} from "./CityBuilder";
export type { CityData, Collider, RoadNode, ParkedCar, Billboard } from "./CityBuilder";

export { createHumanoid, PED_COLORS } from "./Humanoid";
export type { Humanoid, HumanoidOpts } from "./Humanoid";

export {
  createCarMesh,
  resolveCircleColliders,
  CarPhysics,
  createTrafficCar,
  updateTrafficCar,
} from "./Vehicle";
export type { CarMesh, DriveInput, TrafficCar } from "./Vehicle";

export { GameAudio } from "./audio";

export { useGtaGame } from "./useGtaGame";
export type { GtaApi, GtaPhase } from "./useGtaGame";

export { default as OrbitxCityGTA } from "./OrbitxCityGTA";
export { GtaHud } from "./GtaHud";
export { GtaTitleScreen, GtaHowToScreen, GtaPauseOverlay } from "./GtaScreens";
