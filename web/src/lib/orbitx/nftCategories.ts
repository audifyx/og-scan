// OrbitX NFT categories — shared across Creator Pad + Hub discovery filters.
export const NFT_CATEGORIES = [
  "Art", "Memes", "Gaming", "Utility", "PFP", "Music", "AI", "Photography", "Sports", "Collectibles",
] as const;
export type NftCategory = (typeof NFT_CATEGORIES)[number];
