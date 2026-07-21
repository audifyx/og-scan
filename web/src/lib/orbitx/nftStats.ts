// OrbitX NFT Creator inventory stats — aggregated live from the marketplace
// tables (orbitx_nfts / _transactions / _listings / _collections). No mock data.
import { supabase } from "@/lib/supabase";

export interface CreatorNftStats {
  totalMinted: number;
  listed: number;
  sold: number;
  ownedNow: number;
  activeListings: number;
  collections: number;
  draftCollections: number;
  floorSol: number | null;
  revenueSol: number;    // gross received as seller
  royaltiesSol: number;  // resale royalties earned as original creator
  volumeSol: number;     // total volume across creator's collections
  salesCount: number;
  avgSaleSol: number | null;
  highSaleSol: number | null;
  lowSaleSol: number | null;
}

export async function getCreatorNftStats(wallet: string): Promise<CreatorNftStats> {
  const [nftsRes, sellRes, royRes, listRes, colRes] = await Promise.all([
    supabase.from("orbitx_nfts").select("status,current_owner").eq("creator_wallet", wallet),
    supabase.from("orbitx_nft_transactions").select("amount_sol").eq("seller_wallet", wallet),
    supabase.from("orbitx_nft_transactions").select("amount_sol,nft:orbitx_nfts(royalty_bps)").eq("creator_wallet", wallet),
    supabase.from("orbitx_nft_listings").select("price_sol").eq("seller_wallet", wallet).eq("status", "active"),
    supabase.from("orbitx_nft_collections").select("mint_address,volume_sol,floor_price_sol").eq("creator_wallet", wallet),
  ]);

  const nfts = nftsRes.data ?? [];
  const totalMinted = nfts.length;
  const listed = nfts.filter((n) => n.status === "listed").length;
  const sold = nfts.filter((n) => n.status === "sold").length;
  const ownedNow = nfts.filter((n) => n.current_owner === wallet).length;

  const sells = (sellRes.data ?? []).map((r) => Number(r.amount_sol) || 0);
  const revenueSol = sells.reduce((a, b) => a + b, 0);
  const salesCount = sells.length;
  const avgSaleSol = salesCount ? revenueSol / salesCount : null;
  const highSaleSol = salesCount ? Math.max(...sells) : null;
  const lowSaleSol = salesCount ? Math.min(...sells) : null;

  const royaltiesSol = (royRes.data ?? []).reduce((a, r) => {
    const bps = ((r as { nft?: { royalty_bps?: number } }).nft?.royalty_bps) ?? 0;
    return a + (Number(r.amount_sol) || 0) * (bps / 10000);
  }, 0);

  const listPrices = (listRes.data ?? []).map((r) => Number(r.price_sol) || 0);
  const activeListings = listPrices.length;

  const cols = colRes.data ?? [];
  const collections = cols.length;
  const draftCollections = cols.filter((c) => !c.mint_address).length;
  const volumeSol = cols.reduce((a, c) => a + (Number(c.volume_sol) || 0), 0);
  const colFloors = cols.map((c) => Number(c.floor_price_sol)).filter((n) => n > 0);
  const floorCandidates = [...listPrices, ...colFloors].filter((n) => n > 0);
  const floorSol = floorCandidates.length ? Math.min(...floorCandidates) : null;

  return {
    totalMinted, listed, sold, ownedNow, activeListings, collections, draftCollections,
    floorSol, revenueSol, royaltiesSol, volumeSol, salesCount, avgSaleSol, highSaleSol, lowSaleSol,
  };
}
