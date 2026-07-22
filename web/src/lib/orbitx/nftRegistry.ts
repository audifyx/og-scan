// OrbitX NFT Hub — registry client (orbitx_nft_collections / orbitx_nfts /
// orbitx_nft_listings / orbitx_nft_transactions). Same wallet-native trust
// model as the token registry: reads are public, writes go through
// SECURITY DEFINER RPCs.
import { supabase } from "@/lib/supabase";

export interface OrbitxNftCollection {
  id: string;
  creator_wallet: string;
  name: string;
  symbol: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  royalty_bps: number;
  mint_price_sol: number;
  mint_limit: number | null;
  mint_address: string | null;
  verified: boolean;
  is_official: boolean;
  floor_price_sol: number | null;
  volume_sol: number;
  category: string | null;
  coin_mint?: string | null;
  created_at: string;
}

export interface OrbitxNft {
  id: string;
  collection_id: string | null;
  mint_address: string;
  creator_wallet: string;
  current_owner: string;
  name: string;
  symbol: string | null;
  image_url: string | null;
  metadata_uri: string | null;
  royalty_bps: number;
  status: "unlisted" | "listed" | "sold";
  cluster: string;
  created_at: string;
  attributes: { trait_type: string; value: string }[];
  content_hash: string | null;
  rarity_rank: number | null;
  rarity_score: number | null;
  rarity_tier: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | null;
  is_flagged_duplicate: boolean;
  delegate_approved: boolean;
  view_count?: number;
  favorite_count?: number;
}

export interface OrbitxNftListing {
  id: string;
  nft_id: string;
  seller_wallet: string;
  price_sol: number;
  currency?: string;
  status: "active" | "cancelled" | "sold";
  created_at: string;
}

export async function listNftCollections(limit = 60): Promise<OrbitxNftCollection[]> {
  const { data, error } = await supabase.from("orbitx_nft_collections").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as OrbitxNftCollection[];
}

export async function listNfts(limit = 100): Promise<OrbitxNft[]> {
  const { data, error } = await supabase.from("orbitx_nfts").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as OrbitxNft[];
}

export async function listNftsByCreator(wallet: string): Promise<OrbitxNft[]> {
  const { data, error } = await supabase.from("orbitx_nfts").select("*").eq("creator_wallet", wallet).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrbitxNft[];
}

export async function listCollectionsByCreator(wallet: string): Promise<OrbitxNftCollection[]> {
  const { data, error } = await supabase.from("orbitx_nft_collections").select("*").eq("creator_wallet", wallet).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrbitxNftCollection[];
}

export async function listActiveListings(): Promise<(OrbitxNftListing & { nft: OrbitxNft })[]> {
  const { data, error } = await supabase.from("orbitx_nft_listings").select("*, nft:orbitx_nfts(*)").eq("status", "active").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (OrbitxNftListing & { nft: OrbitxNft })[];
}

export interface RegisterNftCollectionInput {
  creator_wallet: string; name: string; symbol: string; description?: string;
  banner_url?: string; logo_url?: string; royalty_bps?: number; mint_price_sol?: number; mint_limit?: number | null;
  mint_address: string;
}
export async function registerNftCollection(input: RegisterNftCollectionInput): Promise<string> {
  const { data, error } = await supabase.rpc("orbitx_register_nft_collection", {
    p_creator_wallet: input.creator_wallet, p_name: input.name, p_symbol: input.symbol,
    p_description: input.description ?? null, p_banner_url: input.banner_url ?? null, p_logo_url: input.logo_url ?? null,
    p_royalty_bps: input.royalty_bps ?? 500, p_mint_price_sol: input.mint_price_sol ?? 0, p_mint_limit: input.mint_limit ?? null,
    p_mint_address: input.mint_address,
  });
  if (error) throw error;
  return data as string;
}

export interface RegisterNftInput {
  collection_id?: string | null; mint_address: string; creator_wallet: string; name: string;
  symbol?: string; image_url?: string; metadata_uri?: string; royalty_bps?: number;
  attributes?: { trait_type: string; value: string }[]; content_hash?: string;
}
export async function registerNft(input: RegisterNftInput): Promise<string> {
  const { data, error } = await supabase.rpc("orbitx_register_nft", {
    p_collection_id: input.collection_id ?? null, p_mint_address: input.mint_address, p_creator_wallet: input.creator_wallet,
    p_name: input.name, p_symbol: input.symbol ?? null, p_image_url: input.image_url ?? null,
    p_metadata_uri: input.metadata_uri ?? null, p_royalty_bps: input.royalty_bps ?? 0,
    p_attributes: input.attributes ?? [], p_content_hash: input.content_hash ?? null,
  });
  if (error) throw error;
  return data as string;
}

/* ─────────────────────── fraud / originality checks ─────────────────────── */

export interface NftCollectionMatch { id: string; name: string; symbol: string; sim: number }
export async function checkNftCollectionOriginality(name: string, symbol: string): Promise<NftCollectionMatch[]> {
  const { data, error } = await supabase.rpc("orbitx_nft_collection_check", { p_name: name, p_symbol: symbol });
  if (error) return [];
  return (data ?? []) as NftCollectionMatch[];
}

export interface NftContentMatch { id: string; name: string; mint_address: string; creator_wallet: string }
export async function checkNftContentDuplicate(contentHash: string): Promise<NftContentMatch[]> {
  const { data, error } = await supabase.rpc("orbitx_nft_content_check", { p_content_hash: contentHash });
  if (error) return [];
  return (data ?? []) as NftContentMatch[];
}

export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ─────────────────────── delegate approval (marketplace) ─────────────────────── */

export async function setNftDelegateApproved(nftId: string, wallet: string): Promise<void> {
  const { error } = await supabase.rpc("orbitx_nft_set_delegate_approved", { p_nft_id: nftId, p_wallet: wallet });
  if (error) throw error;
}

/* ─────────────────────── offers ─────────────────────── */

export interface NftOffer { id: string; nft_id: string; buyer_wallet: string; price_sol: number; status: string; created_at: string; expires_at: string | null }
export async function makeNftOffer(nftId: string, buyerWallet: string, priceSol: number, expiresHours = 72): Promise<string> {
  const { data, error } = await supabase.rpc("orbitx_nft_make_offer", { p_nft_id: nftId, p_buyer_wallet: buyerWallet, p_price_sol: priceSol, p_expires_hours: expiresHours });
  if (error) throw error;
  return data as string;
}
export async function cancelNftOffer(offerId: string, buyerWallet: string): Promise<void> {
  const { error } = await supabase.rpc("orbitx_nft_cancel_offer", { p_offer_id: offerId, p_buyer_wallet: buyerWallet });
  if (error) throw error;
}
export async function respondNftOffer(offerId: string, sellerWallet: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("orbitx_nft_respond_offer", { p_offer_id: offerId, p_seller_wallet: sellerWallet, p_accept: accept });
  if (error) throw error;
}
export async function listOffersForNft(nftId: string): Promise<NftOffer[]> {
  const { data, error } = await supabase.from("orbitx_nft_offers").select("*").eq("nft_id", nftId).order("price_sol", { ascending: false });
  if (error) return [];
  return (data ?? []) as NftOffer[];
}
export async function listMyOffers(buyerWallet: string): Promise<(NftOffer & { nft: OrbitxNft })[]> {
  const { data, error } = await supabase.from("orbitx_nft_offers").select("*, nft:orbitx_nfts(*)").eq("buyer_wallet", buyerWallet).order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as unknown as (NftOffer & { nft: OrbitxNft })[];
}

/* ─────────────────────── auctions ─────────────────────── */

export interface NftAuction {
  id: string; nft_id: string; seller_wallet: string; start_price_sol: number; min_increment_sol: number;
  highest_bid_sol: number | null; highest_bidder: string | null; ends_at: string; status: string; created_at: string;
}
export async function createNftAuction(nftId: string, sellerWallet: string, startPriceSol: number, minIncrementSol: number, durationHours: number): Promise<string> {
  const { data, error } = await supabase.rpc("orbitx_nft_create_auction", {
    p_nft_id: nftId, p_seller_wallet: sellerWallet, p_start_price_sol: startPriceSol, p_min_increment_sol: minIncrementSol, p_duration_hours: durationHours,
  });
  if (error) throw error;
  return data as string;
}
export async function placeNftBid(auctionId: string, bidderWallet: string, amountSol: number): Promise<void> {
  const { error } = await supabase.rpc("orbitx_nft_place_bid", { p_auction_id: auctionId, p_bidder_wallet: bidderWallet, p_amount_sol: amountSol });
  if (error) throw error;
}
export async function listActiveAuctions(): Promise<(NftAuction & { nft: OrbitxNft })[]> {
  await supabase.rpc("orbitx_nft_close_ended_auctions");
  const { data, error } = await supabase.from("orbitx_nft_auctions").select("*, nft:orbitx_nfts(*)").in("status", ["active", "ended"]).order("ends_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as (NftAuction & { nft: OrbitxNft })[];
}
export async function listAuctionBids(auctionId: string): Promise<{ bidder_wallet: string; amount_sol: number; created_at: string }[]> {
  const { data, error } = await supabase.from("orbitx_nft_auction_bids").select("bidder_wallet,amount_sol,created_at").eq("auction_id", auctionId).order("amount_sol", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function listNft(nftId: string, sellerWallet: string, priceSol: number, currency: "SOL" | "USDC" = "SOL"): Promise<string> {
  const { data, error } = await supabase.rpc("orbitx_nft_list", { p_nft_id: nftId, p_seller_wallet: sellerWallet, p_price_sol: priceSol, p_currency: currency });
  if (error) throw error;
  return data as string;
}

export async function setCollectionCoin(collectionId: string, coinMint: string, creator: string): Promise<void> {
  const { error } = await supabase.rpc("orbitx_set_collection_coin", { p_collection_id: collectionId, p_coin_mint: coinMint, p_creator: creator });
  if (error) throw error;
}

export async function cancelNftListing(nftId: string, sellerWallet: string): Promise<void> {
  const { error } = await supabase.rpc("orbitx_nft_cancel_listing", { p_nft_id: nftId, p_seller_wallet: sellerWallet });
  if (error) throw error;
}


/* ─────────────────────── discovery + social (Phase 1) ─────────────────────── */

/** Set a collection's category (creator-only, via SECURITY DEFINER RPC). */
export async function setCollectionCategory(collectionId: string, category: string, creator: string): Promise<void> {
  const { error } = await supabase.rpc("orbitx_set_collection_category", {
    p_collection_id: collectionId, p_category: category, p_creator: creator,
  });
  if (error) throw error;
}

/** Toggle a favorite (like) on an NFT for a wallet; returns the new favorited state. */
export async function toggleNftFavorite(nftId: string, wallet: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("orbitx_nft_toggle_favorite", { p_nft: nftId, p_wallet: wallet });
  if (error) throw error;
  return !!data;
}

/** Best-effort view increment (fire-and-forget). */
export async function incrementNftView(nftId: string): Promise<void> {
  await supabase.rpc("orbitx_nft_increment_view", { p_nft: nftId }).then(() => undefined, () => undefined);
}

/** The set of NFT ids this wallet has favorited (for filling hearts). */
export async function listMyFavoriteIds(wallet: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("orbitx_nft_favorites").select("nft_id").eq("wallet", wallet);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.nft_id as string));
}

export interface NftSale {
  id: string; amount_sol: number; buyer_wallet: string; seller_wallet: string; created_at: string; tx_signature: string;
}
/** Full sale history for one NFT (newest first) — powers per-NFT analytics. */
export async function listSalesForNft(nftId: string): Promise<NftSale[]> {
  const { data, error } = await supabase
    .from("orbitx_nft_transactions").select("id,amount_sol,buyer_wallet,seller_wallet,created_at,tx_signature")
    .eq("nft_id", nftId).order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as NftSale[];
}

/** Recently sold NFTs across the marketplace (newest first). */
export async function listRecentSales(limit = 12): Promise<(NftSale & { nft: OrbitxNft })[]> {
  const { data, error } = await supabase
    .from("orbitx_nft_transactions")
    .select("id,amount_sol,buyer_wallet,seller_wallet,created_at,tx_signature,nft:orbitx_nfts(*)")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) return [];
  return ((data ?? []) as unknown) as (NftSale & { nft: OrbitxNft })[];
}
