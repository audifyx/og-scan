/**
 * OrbitX City — Real Estate public API.
 *
 * Mount <PropertyPanel /> inside the city HUD when the wallet hub is present.
 * District/world code can call setPropertyOwnerLabel() and attachPropertySign()
 * to show owner plaques above building doors.
 */

export {
  ORBITX_MINT,
  CITY_TAX_BPS,
  RENT_CITY_PER_HOUR,
  PROPERTY_REGISTRY,
  listProperties,
  getProperty,
  shortWallet,
  cityDb,
  fetchProperties,
  fetchProperty,
  buyProperty,
  listForSale,
  unlistProperty,
} from "./RealEstate";
export type { PropertyDef, PropertyRow, ChainWallet, BuyResult } from "./RealEstate";

export { PropertyPanel } from "./PropertyPanel";

export { ReceiptModal } from "./ReceiptModal";
export type { ReceiptLine, ReceiptModalProps } from "./ReceiptModal";

export {
  setPropertyOwnerLabel,
  getPropertyOwnerLabel,
  attachPropertySign,
  removePropertySign,
  PROPERTY_OWNER_EVENT,
} from "./PropertySign";
