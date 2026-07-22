// OrbitX NFT Marketplace — wallet-native social layer client (Phase 2).
// Follows/likes/comments/notifications keyed on wallet addresses, matching the
// NFT registry's wallet-native trust model. All calls fail soft: until the v4
// migration is applied the UI still renders (zero counts, no crashes).
import { supabase } from "@/lib/supabase";

export interface FollowCounts { followers: number; following: number }

export async function getFollowCounts(wallet: string): Promise<FollowCounts> {
  try {
    const { data } = await supabase.rpc("orbitx_nft_follow_counts", { p_wallet: wallet });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) return { followers: Number(row.followers ?? 0), following: Number(row.following ?? 0) };
  } catch { /* migration pending */ }
  return { followers: 0, following: 0 };
}

export async function isFollowing(follower: string, creator: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("orbitx_nft_follows")
      .select("follower_wallet")
      .eq("follower_wallet", follower).eq("creator_wallet", creator).maybeSingle();
    return !!data;
  } catch { return false; }
}

export async function toggleFollow(follower: string, creator: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("orbitx_nft_toggle_follow", { p_follower: follower, p_creator: creator });
  if (error) throw error;
  return !!data;
}

export async function getLikeState(nftId: string, wallet?: string): Promise<{ count: number; liked: boolean }> {
  try {
    const { count } = await supabase
      .from("orbitx_nft_likes").select("*", { count: "exact", head: true }).eq("nft_id", nftId);
    let liked = false;
    if (wallet) {
      const { data } = await supabase.from("orbitx_nft_likes").select("wallet").eq("nft_id", nftId).eq("wallet", wallet).maybeSingle();
      liked = !!data;
    }
    return { count: count ?? 0, liked };
  } catch { return { count: 0, liked: false }; }
}

export async function toggleLike(nftId: string, wallet: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("orbitx_nft_toggle_like", { p_nft_id: nftId, p_wallet: wallet });
  if (error) throw error;
  return !!data;
}

export interface NftComment { id: string; nft_id: string; wallet: string; body: string; created_at: string }

export async function listComments(nftId: string): Promise<NftComment[]> {
  try {
    const { data } = await supabase.from("orbitx_nft_comments").select("*").eq("nft_id", nftId).order("created_at", { ascending: false }).limit(100);
    return (data ?? []) as NftComment[];
  } catch { return []; }
}

export async function addComment(nftId: string, wallet: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("orbitx_nft_add_comment", { p_nft_id: nftId, p_wallet: wallet, p_body: body });
  if (error) throw error;
}

export interface NftNotification { id: string; wallet: string; kind: string; body: string; link: string | null; read: boolean; created_at: string }

export async function listNotifications(wallet: string): Promise<NftNotification[]> {
  try {
    const { data } = await supabase.from("orbitx_nft_notifications").select("*").eq("wallet", wallet).order("created_at", { ascending: false }).limit(50);
    return (data ?? []) as NftNotification[];
  } catch { return []; }
}
