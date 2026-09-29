/**
 * MEDIA MODULE — public barrel.
 *
 * Import surface for the OrbitXCity integrator. No imports from other city
 * modules; no `@/tokenomics/*` (breaks the build until the directory exists).
 */

export type {
  MediaBillingProvider,
  MediaWorldAdapter,
  PhotoFilterId,
  PhotoFilter,
  PhotoView,
  GalleryShot,
  RadioStationId,
  RadioStation,
  MarketQuoteLite,
  MovieClip,
  DriveInSpot,
  MediaSettings,
} from "./types";

export {
  getMediaSettings,
  updateMediaSettings,
  useMediaSettings,
  MediaRuntime,
  SETTINGS_KEY,
} from "./store";
export type { MediaEvent } from "./store";

export {
  PHOTO_FILTERS,
  PREMIUM_FILTER_PACK,
  EXPORT_MAX_W,
  getFilter,
  defaultView,
  clampView,
  exportPhoto,
  downscaleImage,
  viewToCssTransform,
  buildShotCaption,
  makeShot,
} from "./photo";
export { PhotoMode } from "./PhotoMode";

export {
  GALLERY_KEY,
  MAX_SHOTS,
  listShots,
  getShot,
  addShot,
  removeShot,
  clearGallery,
  galleryCount,
} from "./gallery";
export { Gallery } from "./Gallery";

export {
  X_INTENT_URL,
  buildShareText,
  xIntentUrl,
  downloadPhoto,
  shotFilename,
} from "./share";
export { ShareToX } from "./ShareToX";

export {
  RADIO_STATIONS,
  getStation,
  marketChatterLines,
  RadioController,
} from "./radio";
export { RadioHud } from "./RadioHud";

export {
  DEFAULT_PLAYLIST,
  FALLBACK_DRIVE_IN,
  setPlaylist,
  getPlaylist,
  addCommunityClip,
  onPlaylistChange,
  buildDriveIn,
  setNowShowing,
} from "./drivein";
export type { DriveInBuild } from "./drivein";
export { DriveInHud } from "./DriveInHud";
