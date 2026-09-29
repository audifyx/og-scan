/**
 * OrbitXCity — Real Estate module public API.
 *
 * Self-contained: no imports from other city modules, no `@/tokenomics/*`
 * (the directory does not exist yet — importing it would break the build).
 * The tokenomics billing primitive is injected by the integrator as
 * `OrbitxBillingProvider` via `RealEstateHub` props. Only external deps:
 * react. Scoped styles in `realestate.css` (`ox-re-*` namespace).
 */

// Mount point
export { RealEstateHub, REALESTATE_PANEL_ID } from "./components/RealEstateHub";
export type { RealEstateTab } from "./components/RealEstateHub";

// Standalone panels (re-mountable separately if the integrator prefers)
export { DeedsPanel } from "./components/DeedsPanel";
export { AuctionsPanel } from "./components/AuctionsPanel";
export { HomesPanel } from "./components/HomesPanel";
export { HotelsPanel } from "./components/HotelsPanel";

// Billing adapter (defensive wrapper around the tokenomics primitive)
export { useRealEstateBilling } from "./billing";
export type { RealEstateBilling } from "./billing";

// Stores + identity
export { deedStore, deedToNftMetadata, deedRentRate, pendingRent, propertyForDeed, useDeeds } from "./store/deeds";
export { auctionStore, getAuctionBoard, useAuctions } from "./store/auctions";
export type { LotView, AuctionBoard } from "./store/auctions";
export { homeStore, useHomes } from "./store/homes";
export { hotelStore, useHotels } from "./store/hotels";
export { PLAYER_ID } from "./store/identity";
export { noopLedger, createLocalPaperLedger } from "./store/paperLedger";

// Catalog data (districts, tiers, properties, furniture, hotels, homes, auction schedule)
export {
  DISTRICTS,
  districtById,
  PROPERTY_TIERS,
  tierByLevel,
  PROPERTIES,
  propertyById,
  footTrafficAt,
  rentPerHour,
  FURNITURE,
  furnitureById,
  HOTELS,
  hotelById,
  suiteById,
  HOMES,
  homeTemplateById,
  penthousePropertyFor,
  lotForSlot,
  currentSlot,
  auctionDurationMs,
  ANTI_SNIPE_MS,
  ANTI_SNIPE_WINDOW_MS,
} from "./data/catalog";

// Types
export type {
  Currency,
  OrbitxBillingProvider,
  BurnRecord,
  PaperLedger,
  District,
  PropertyKind,
  PropertyTier,
  CatalogProperty,
  Deed,
  DeedNftMetadata,
  RentState,
  AuctionStatus,
  AuctionLot,
  Bid,
  HomeKind,
  Home,
  FurnitureItem,
  PlacedFurniture,
  HomeTemplate,
  RoomKind,
  Suite,
  Hotel,
  HotelStay,
  SleepCheckpoint,
  LoginBonus,
} from "./types";
