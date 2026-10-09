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
import { GYM_DOOR } from "./gym/Gym";
import { PHARMACY_DOOR } from "./pharmacy/Pharmacy";
import { COFFEE_DOOR } from "./coffee/Coffee";
import { BARBER_DOOR } from "./barber/Barber";
import { BANK_DOOR } from "./bank/Bank";
import { HOTEL_DOOR } from "./hotel/Hotel";
import { CINEMA_DOOR } from "./cinema/Cinema";
import { POLICE_DOOR } from "./police/Police";
import { MALL_DOOR } from "./mall/Mall";

/** All outdoor door triggers shipped by this module (climb included). */
export const DISTRICT_DOORS = [
  EXCHANGE_DOOR, HOSPITAL_DOOR, MUSEUM_DOOR, LIBRARY_DOOR,
  OBSERVATORY_DOOR, LIGHTHOUSE_DOOR, CITYHALL_DOOR,
  GYM_DOOR, PHARMACY_DOOR, COFFEE_DOOR, BARBER_DOOR,
  BANK_DOOR, HOTEL_DOOR, CINEMA_DOOR, POLICE_DOOR, MALL_DOOR,
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

/* --------------------------- 9. neighborhood shops ---------------------------- */
export {
  GYM_INTERIOR_ID, GYM_FACADE_CENTER, GYM_DOOR,
  buildGymExterior, buildGymInterior,
} from "./gym/Gym";
export type { GymInterior } from "./gym/Gym";
export {
  PHARMACY_INTERIOR_ID, PHARMACY_FACADE_CENTER, PHARMACY_DOOR,
  buildPharmacyExterior, buildPharmacyInterior,
} from "./pharmacy/Pharmacy";
export type { PharmacyInterior } from "./pharmacy/Pharmacy";
export {
  COFFEE_INTERIOR_ID, COFFEE_FACADE_CENTER, COFFEE_DOOR,
  buildCoffeeExterior, buildCoffeeInterior,
} from "./coffee/Coffee";
export type { CoffeeInterior } from "./coffee/Coffee";
export {
  BARBER_INTERIOR_ID, BARBER_FACADE_CENTER, BARBER_DOOR,
  buildBarberExterior, buildBarberInterior,
} from "./barber/Barber";
export type { BarberInterior } from "./barber/Barber";

/* ------------------------------- 10. new builds -------------------------------- */
export {
  BANK_INTERIOR_ID, BANK_FACADE_CENTER, BANK_DOOR,
  buildBankExterior, buildBankInterior,
} from "./bank/Bank";
export type { BankInterior } from "./bank/Bank";
export {
  HOTEL_INTERIOR_ID, HOTEL_FACADE_CENTER, HOTEL_DOOR,
  buildHotelExterior, buildHotelInterior,
} from "./hotel/Hotel";
export type { HotelInterior } from "./hotel/Hotel";
export {
  CINEMA_INTERIOR_ID, CINEMA_FACADE_CENTER, CINEMA_DOOR,
  buildCinemaExterior, buildCinemaInterior,
} from "./cinema/Cinema";
export type { CinemaInterior } from "./cinema/Cinema";
export {
  POLICE_INTERIOR_ID, POLICE_FACADE_CENTER, POLICE_DOOR,
  buildPoliceExterior, buildPoliceInterior,
} from "./police/Police";
export type { PoliceInterior } from "./police/Police";
export {
  MALL_INTERIOR_ID, MALL_FACADE_CENTER, MALL_DOOR,
  buildMallExterior, buildMallInterior,
} from "./mall/Mall";
export type { MallInterior } from "./mall/Mall";

/* -------------------------------- 11. street props ----------------------------- */
export { buildStreetProps } from "./street/StreetProps";
export { buildCityLife } from "./street/CityLife";
export { buildPlazaCenterpiece } from "./street/PlazaCenterpiece";
export { buildCityDetails } from "./street/CityDetails";

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
import { buildGymExterior } from "./gym/Gym";
import { buildPharmacyExterior } from "./pharmacy/Pharmacy";
import { buildCoffeeExterior } from "./coffee/Coffee";
import { buildBarberExterior } from "./barber/Barber";
import { buildBankExterior } from "./bank/Bank";
import { buildHotelExterior } from "./hotel/Hotel";
import { buildCinemaExterior } from "./cinema/Cinema";
import { buildPoliceExterior } from "./police/Police";
import { buildMallExterior } from "./mall/Mall";
import { buildStreetProps } from "./street/StreetProps";
import { buildRealAssetPilot } from "./street/RealAssetPilot";
import { buildCityLife } from "./street/CityLife";
import { buildPlazaCenterpiece } from "./street/PlazaCenterpiece";
import { buildCityDetails } from "./street/CityDetails";

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
    buildGymExterior(),
    buildPharmacyExterior(),
    buildCoffeeExterior(),
    buildBarberExterior(),
    buildBankExterior(),
    buildHotelExterior(),
    buildCinemaExterior(),
    buildPoliceExterior(),
    buildMallExterior(),
    buildStreetProps(),
    buildRealAssetPilot(),
    buildCityLife(),
    buildPlazaCenterpiece(),
    buildCityDetails(),
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
