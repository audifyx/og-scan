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
}

export interface OrbitxNftListing {
  id: string;
  nft_id: string;
  seller_wallet: string;
  price_sol: number;
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
}
export async function registerNft(input: RegisterNftInput): Promise<string> {
  const { data, error } = await supabase.rpc("orbitx_register_nft", {
    p_collection_id: input.collection_id ?? null, p_mint_address: input.mint_address, p_creator_wallet: input.creator_wallet,
    p_name: input.name, p_symbol: input.symbol ?? null, p_image_url: input.image_url ?? null,
    p_metadata_uri: input.metadata_uri ?? null, p_royalty_bps: input.royalty_bps ?? 0,
  });
  if (error) throw error;
  return data as string;
}

export async function listNft(nftId: string, sellerWallet: string, priceSol: number): Promise<string> {
  const { data, error } = await supabase.rpc("orbitx_nft_list", { p_nft_id: nftId, p_seller_wallet: sellerWallet, p_price_sol: priceSol });
  if (error) throw error;
  return data as string;
}

export async function cancelNftListing(nftId: string, sellerWallet: string): Promise<void> {
  const { error } = await supabase.rpc("orbitx_nft_cancel_listing", { p_nft_id: nftId, p_seller_wallet: sellerWallet });
  if (error) throw error;
}
