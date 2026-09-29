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
export type { DistrictsBilling, BurnPurchaseLike } from "./billing";
export {
  NoopBilling, billingFromTokenomicsHook, billingFromBurnPurchase, premiumPriceLabel,
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
import { BANK_DOOR } from "./bank/Bank";
import { DEALERSHIP_DOOR } from "./dealership/Dealership";
import { SHOPS_DOOR } from "./shops/Shops";

/** All outdoor door triggers shipped by this module (climb included). */
export const DISTRICT_DOORS = [
  EXCHANGE_DOOR, HOSPITAL_DOOR, MUSEUM_DOOR, LIBRARY_DOOR,
  OBSERVATORY_DOOR, LIGHTHOUSE_DOOR, CITYHALL_DOOR,
  BANK_DOOR, DEALERSHIP_DOOR, SHOPS_DOOR,
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
  BRIDGE, BRIDGE_RAMP_MAIN, BRIDGE_RAMP_ISLAND, ISLAND_SURFACE_Y, ISLAND_ZONES,
  registerIslandBuilder, buildBridge, bridgeCollider, bridgeDriveBoxes,
  buildIslandScene, buildAllIslands, islandColliders,
} from "./second-island/SecondIsland";
export type { BridgeSeamSpec, IslandBuilder, IslandScene, DriveBox } from "./second-island/SecondIsland";

/* ------------------------------ 10. orbitx bank ------------------------------ */
export {
  BANK_INTERIOR_ID, BANK_DOOR, BANK_FACADE_CENTER,
  VAULT_COST_ORBITX, VAULT_BURN_REASON, SAFE_BOX_COST_CITY,
  getBankState, buySafeBox, markVaultMember,
  buildBankExterior, buildBankInterior,
} from "./bank/Bank";
export type { BankInterior, BankState } from "./bank/Bank";
export { default as BankUI } from "./bank/BankUI";

/* ------------------------------ 11. car dealership ---------------------------- */
export {
  DEALERSHIP_INTERIOR_ID, DEALERSHIP_DOOR, DEALERSHIP_FACADE_CENTER,
  SHOWROOM, vehicleBurnReason, ownedVehicles, ownsVehicle,
  buyVehiclePaper, buyVehiclePremium,
  buildDealershipExterior, buildDealershipInterior, buildDemoCar,
} from "./dealership/Dealership";
export type { DealershipInterior, ShowroomVehicle } from "./dealership/Dealership";
export { default as DealershipUI } from "./dealership/DealershipUI";

/* --------------------------------- 12. shops --------------------------------- */
export {
  SHOPS_INTERIOR_ID, SHOPS_DOOR, SHOPS_FACADE_CENTER,
  SHOP_CATALOG, shopBurnReason, shopInventory,
  buyShopItemPaper, buyShopItemPremium,
  buildShopsExterior, buildShopsInterior,
} from "./shops/Shops";
export type { ShopsInterior, ShopItem } from "./shops/Shops";
export { default as ShopsUI } from "./shops/ShopsUI";

/* ------------------------------ bulk scene helpers --------------------------- */
import { buildExchangeExterior, EXCHANGE_FACADE_CENTER } from "./exchange/Exchange";
import { buildHospitalExterior, HOSPITAL_FACADE_CENTER } from "./hospital/Hospital";
import { buildMuseumExterior, MUSEUM_FACADE_CENTER } from "./museum/Museum";
import { buildLibraryExterior, LIBRARY_FACADE_CENTER } from "./library/Library";
import { buildObservatoryExterior, OBSERVATORY_FACADE_CENTER } from "./observatory/Observatory";
import { buildLighthouse } from "./lighthouse/Lighthouse";
import { buildCityHallExterior, CITYHALL_FACADE_CENTER } from "./cityhall/CityHall";
import { buildBankExterior, BANK_FACADE_CENTER } from "./bank/Bank";
import { buildDealershipExterior, DEALERSHIP_FACADE_CENTER } from "./dealership/Dealership";
import { buildShopsExterior, SHOPS_FACADE_CENTER } from "./shops/Shops";
import { buildBridge, buildAllIslands, ISLAND_ZONES as ZONES } from "./second-island/SecondIsland";
import { CONSTRUCTION_SITES as SITES, buildConstructionSite } from "./construction/Construction";

/**
 * Reserved city lots for the district facades (center + half extents).
 * Core's CityBuilder reads this to keep random generation off these plots —
 * the single source of truth for door/facade placement.
 */
export interface FacadePlot {
  /** Door id this plot belongs to (e.g. "door:exchange"). */
  id: string;
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
}

export const FACADE_PLOTS: FacadePlot[] = [
  { id: "door:exchange", cx: EXCHANGE_FACADE_CENTER[0], cz: EXCHANGE_FACADE_CENTER[2], halfW: 25, halfD: 16 },
  { id: "door:hospital", cx: HOSPITAL_FACADE_CENTER[0], cz: HOSPITAL_FACADE_CENTER[2], halfW: 23, halfD: 15 },
  { id: "door:museum", cx: MUSEUM_FACADE_CENTER[0], cz: MUSEUM_FACADE_CENTER[2], halfW: 23, halfD: 15 },
  { id: "door:library", cx: LIBRARY_FACADE_CENTER[0], cz: LIBRARY_FACADE_CENTER[2], halfW: 21, halfD: 14 },
  { id: "door:observatory", cx: OBSERVATORY_FACADE_CENTER[0], cz: OBSERVATORY_FACADE_CENTER[2], halfW: 13, halfD: 13 },
  { id: "door:cityhall", cx: CITYHALL_FACADE_CENTER[0], cz: CITYHALL_FACADE_CENTER[2], halfW: 24, halfD: 16 },
  { id: "door:bank", cx: BANK_FACADE_CENTER[0], cz: BANK_FACADE_CENTER[2], halfW: 21, halfD: 15 },
  { id: "door:dealership", cx: DEALERSHIP_FACADE_CENTER[0], cz: DEALERSHIP_FACADE_CENTER[2], halfW: 27, halfD: 18 },
  { id: "door:shops", cx: SHOPS_FACADE_CENTER[0], cz: SHOPS_FACADE_CENTER[2], halfW: 23, halfD: 13 },
];

/** Outdoor AABB colliders for the district facades — the integrator adds these to its collision set. */
export function facadeColliders(): { minX: number; maxX: number; minZ: number; maxZ: number }[] {
  return FACADE_PLOTS.map((p) => ({
    minX: p.cx - p.halfW,
    maxX: p.cx + p.halfW,
    minZ: p.cz - p.halfD,
    maxZ: p.cz + p.halfD,
  }));
}

/**
 * Door id → interior builder. The integrator can replace its hand-rolled
 * INTERIOR_BUILDERS map with this one call (`"door:lighthouse"` returns
 * null — it's a deck teleport, not a scene).
 */
import { buildExchangeInterior } from "./exchange/Exchange";
import { buildHospitalInterior } from "./hospital/Hospital";
import { buildMuseumInterior } from "./museum/Museum";
import { buildLibraryInterior } from "./library/Library";
import { buildObservatoryInterior } from "./observatory/Observatory";
import { buildCityHallInterior } from "./cityhall/CityHall";
import { buildBankInterior } from "./bank/Bank";
import { buildDealershipInterior } from "./dealership/Dealership";
import { buildShopsInterior } from "./shops/Shops";

export function buildInteriorForDoor(doorId: string): { group: THREE.Group; dispose(): void } | null {
  switch (doorId) {
    case "door:exchange": return buildExchangeInterior();
    case "door:hospital": return buildHospitalInterior();
    case "door:museum": return buildMuseumInterior();
    case "door:library": return buildLibraryInterior();
    case "door:observatory": return buildObservatoryInterior();
    case "door:cityhall": return buildCityHallInterior();
    case "door:bank": return buildBankInterior();
    case "door:dealership": return buildDealershipInterior();
    case "door:shops": return buildShopsInterior();
    default: return null;
  }
}

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
    buildBankExterior(),
    buildDealershipExterior(),
    buildShopsExterior(),
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
