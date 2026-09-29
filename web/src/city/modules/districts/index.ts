/**
 * ORBITXCITY — Districts module public surface.
 *
 * Enterable interiors + district features for the GTA-style open world:
 * stock exchange, hospital, construction sites, Museum of Rugs, library,
 * observatory, lighthouse, city hall, and the second island across the bridge.
 *
 * Self-contained: no imports from sibling city modules, no `@/tokenomics/*`
 * (per BILLING_CONTRACT.md). Integrators import from here.
 *
 * Quick start:
 *   import { registerDistrictDoors, buildAllExteriors } from "@/city/modules/districts";
 *   registerDistrictDoors(); // outdoor world door triggers
 *   const { group } = buildAllExteriors(); // add to the world scene
 */
import * as THREE from "three";

/* ---------------------------------- types ----------------------------------- */
export type {
  Vec3T, DoorTrigger, TokenQuote, PaperTradeResult, WantedProvider,
  RespawnConfig, ConstructionSpec, RugExhibit, ArchiveEntry, Constellation,
  FirmRecord, MayorCandidate, FineRecord, IslandZoneSpec,
} from "./types";

/* ---------------------------------- billing --------------------------------- */
export type { DistrictsBilling } from "./billing";
export {
  NoopBilling, billingFromTokenomicsHook, premiumPriceLabel,
} from "./billing";

/* ------------------------------- paper wallet -------------------------------- */
export {
  paperWallet, PaperWallet, STARTING_CITY,
} from "./paper/PaperWallet";
export type {
  PaperPosition, PaperTrade, PaperWalletSnapshot,
} from "./paper/PaperWallet";

/* ----------------------------------- doors ----------------------------------- */
export {
  registerDoor, registerDoors, unregisterDoor, getDoor, allDoors,
  nearestDoor, doorPromptLabel,
} from "./doors/DoorSystem";
export type { DoorHit } from "./doors/DoorSystem";

import { registerDoors } from "./doors/DoorSystem";
import { EXCHANGE_DOOR } from "./exchange/Exchange";
import { HOSPITAL_DOOR } from "./hospital/Hospital";
import { MUSEUM_DOOR } from "./museum/Museum";
import { LIBRARY_DOOR } from "./library/Library";
import { OBSERVATORY_DOOR } from "./observatory/Observatory";
import { LIGHTHOUSE_DOOR } from "./lighthouse/Lighthouse";
import { CITYHALL_DOOR } from "./cityhall/CityHall";

/** All outdoor door triggers shipped by this module (climb included). */
export const DISTRICT_DOORS = [
  EXCHANGE_DOOR, HOSPITAL_DOOR, MUSEUM_DOOR, LIBRARY_DOOR,
  OBSERVATORY_DOOR, LIGHTHOUSE_DOOR, CITYHALL_DOOR,
] as const;

/** Register every district door with the DoorSystem. Call once at world boot. */
export function registerDistrictDoors(): void {
  registerDoors([...DISTRICT_DOORS]);
}

/* ----------------------------- 1. stock exchange ----------------------------- */
export {
  EXCHANGE_INTERIOR_ID, EXCHANGE_DOOR,
  buildExchangeExterior, buildExchangeInterior, executePaperTrade,
} from "./exchange/Exchange";
export type { ExchangeInterior } from "./exchange/Exchange";
export { default as ExchangeTerminal } from "./exchange/ExchangeTerminal";

/* -------------------------------- 2. hospital -------------------------------- */
export {
  HOSPITAL_INTERIOR_ID, HOSPITAL_DOOR, HOSPITAL_RESPAWN,
  WANTED_CLEAR_COST_PER_STAR, EXPEDITED_WIPE_COST_ORBITX,
  buildHospitalExterior, buildHospitalInterior,
  clearWantedPaper, clearWantedPremium, chargeTreatmentBill,
} from "./hospital/Hospital";
export type { HospitalInterior, ClearWantedResult } from "./hospital/Hospital";
export { default as HospitalBilling } from "./hospital/HospitalBilling";

/* ---------------------------- 3. construction sites --------------------------- */
export {
  CONSTRUCTION_SITES, setConstructionProgress,
  buildConstructionSite, constructionMarkers,
} from "./construction/Construction";
export type { ConstructionSiteScene } from "./construction/Construction";

/* ------------------------------ 4. museum of rugs ----------------------------- */
export {
  MUSEUM_INTERIOR_ID, MUSEUM_DOOR, PERMANENT_EXHIBITS,
  loadCustomExhibits, saveCustomExhibit, curateExhibits,
  buildMuseumInterior, buildMuseumExterior, epitaphCard,
} from "./museum/Museum";
export type { MuseumInterior } from "./museum/Museum";

/* --------------------------------- 5. library --------------------------------- */
export {
  LIBRARY_INTERIOR_ID, LIBRARY_DOOR, ARCHIVE,
  addArchiveEntry, searchArchive,
  buildLibraryInterior, buildLibraryExterior,
} from "./library/Library";
export type { LibraryInterior } from "./library/Library";
export { default as LibraryReader } from "./library/LibraryReader";

/* ------------------------------- 6. observatory ------------------------------- */
export {
  OBSERVATORY_INTERIOR_ID, OBSERVATORY_DOOR, STAR_FIELD, CONSTELLATIONS,
  generateStarField, loadDiscovered, trackGaze, discoveryProgress,
  buildObservatoryInterior, buildObservatoryExterior,
} from "./observatory/Observatory";
export type { ObservatoryInterior } from "./observatory/Observatory";

/* -------------------------------- 7. lighthouse ------------------------------- */
export {
  LIGHTHOUSE_INTERIOR_ID, LIGHTHOUSE_DOOR, LIGHTHOUSE_DECK, LIGHTHOUSE_DECK_HEADING,
  buildLighthouse, updateLighthouseBeacon,
  capturePanorama, downloadPanorama, PANORAMA_SPOTS,
} from "./lighthouse/Lighthouse";
export type { PanoramaSpot } from "./lighthouse/Lighthouse";

/* --------------------------------- 8. city hall ------------------------------- */
export {
  CITYHALL_INTERIOR_ID, CITYHALL_DOOR,
  FIRM_COST_CITY, FIRM_COST_PREMIUM_ORBITX, VOTE_COST_CITY, CANDIDACY_COST_CITY,
  issueFine, listFines, unpaidFinesTotal, payFine, payAllFines,
  listFirms, registerFirm, registerFirmPremium,
  listCandidates, registerCandidacy, voteForMayor, currentMayor, mayorTermEnds,
  buildCityHallInterior, buildCityHallExterior,
} from "./cityhall/CityHall";
export type { CityHallInterior } from "./cityhall/CityHall";
export { default as CityHallUI } from "./cityhall/CityHallUI";

/* ------------------------------- 9. second island ------------------------------ */
export {
  BRIDGE, ISLAND_ZONES,
  registerIslandBuilder, buildBridge, bridgeCollider,
  buildIslandScene, buildAllIslands,
} from "./second-island/SecondIsland";
export type { BridgeSeamSpec, IslandBuilder, IslandScene } from "./second-island/SecondIsland";

/* ------------------------------ bulk scene helpers --------------------------- */
import { buildExchangeExterior } from "./exchange/Exchange";
import { buildHospitalExterior } from "./hospital/Hospital";
import { buildMuseumExterior } from "./museum/Museum";
import { buildLibraryExterior } from "./library/Library";
import { buildObservatoryExterior } from "./observatory/Observatory";
import { buildLighthouse } from "./lighthouse/Lighthouse";
import { buildCityHallExterior } from "./cityhall/CityHall";
import { buildBridge, buildAllIslands, ISLAND_ZONES as ZONES } from "./second-island/SecondIsland";
import { CONSTRUCTION_SITES as SITES, buildConstructionSite } from "./construction/Construction";

/** Build every outdoor structure (facades, lighthouse, bridge, islands, sites). */
export function buildAllExteriors(): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const built: THREE.Group[] = [
    buildExchangeExterior(),
    buildHospitalExterior(),
    buildMuseumExterior(),
    buildLibraryExterior(),
    buildObservatoryExterior(),
    buildLighthouse(),
    buildCityHallExterior(),
    buildBridge(),
    ...buildAllIslands().map((s) => s.group),
    ...SITES.map((spec) => buildConstructionSite(spec).group),
  ];
  built.forEach((b) => group.add(b));
  return {
    group,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
