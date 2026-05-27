import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface FollowerRecord {
  id: string;
  user_id: string;
  username: string | null;
  display_name?: string | null;
  avatar_url: string | null;
  bio: string | null;
  badge: string | null;
  verified?: boolean;
  is_official_account?: boolean;
  affiliate_org_id?: string | null;
}

export const useFriends = () => {
  const { user } = useAuth();
  const [followers, setFollowers] = useState<FollowerRecord[]>([]);
  const [following, setFollowing] = useState<FollowerRecord[]>([]);
  const [mutuals, setMutuals] = useState<FollowerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowers = useCallback(async () => {
    if (!user) {
      setFollowers([]);
      setFollowing([]);
      setMutuals([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: followerRows, error: followerError } = await supabase
        .from("followers")
        .select("follower_id")
        .eq("followee_id", user.id);
      if (followerError) throw followerError;

      const followerIds = followerRows?.map(r => r.follower_id) || [];

      const { data: followingRows, error: followingError } = await supabase
        .from("followers")
        .select("followee_id")
        .eq("follower_id", user.id);
      if (followingError) throw followingError;

      const followingIds = followingRows?.map(r => r.followee_id) || [];

      const allIds = [...new Set([...followerIds, ...followingIds])];
      if (allIds.length === 0) {
        setFollowers([]);
        setFollowing([]);
        setMutuals([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, bio, badge, verified, is_official_account, affiliate_org_id")
        .in("user_id", allIds);
      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const mapToRecord = (ids: string[]): FollowerRecord[] =>
        ids.map(id => {
          const p = profileMap.get(id);
          return {
            id,
            user_id: id,
            username: p?.username || null,
            display_name: p?.display_name || null,
            avatar_url: p?.avatar_url || null,
            bio: p?.bio || null,
            badge: p?.badge || null,
            verified: Boolean(p?.verified),
            is_official_account: Boolean(p?.is_official_account),
            affiliate_org_id: p?.affiliate_org_id || null,
          };
        });

      const followerList = mapToRecord(followerIds);
      const followingList = mapToRecord(followingIds);

      const followingSet = new Set(followingIds);
      const mutualIds = followerIds.filter(id => followingSet.has(id));
      const mutualList = mapToRecord(mutualIds);

      setFollowers(followerList);
      setFollowing(followingList);
      setMutuals(mutualList);

      supabase.from("profiles").update({
        followers_count: followerIds.length,
        following_count: followingIds.length,
      }).eq("user_id", user.id).then(() => {});
    } catch (error) {
      console.error("Failed to load followers", error);
      setFollowers([]);
      setFollowing([]);
      setMutuals([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFollowers();
  }, [fetchFollowers]);

  const follow = async (targetUserId: string) => {
    if (!user) return;
    await supabase.from("followers").insert({
      follower_id: user.id,
      followee_id: targetUserId,
    });
    fetchFollowers();
  };

  const unfollow = async (targetUserId: string) => {
    if (!user) return;
    await supabase.from("followers").delete()
      .eq("follower_id", user.id)
      .eq("followee_id", targetUserId);
    fetchFollowers();
  };

  const isFollowing = (targetUserId: string) =>
    following.some(f => f.user_id === targetUserId);

  const isMutual = (targetUserId: string) =>
    mutuals.some(f => f.user_id === targetUserId);

  return {
    followers,
    following,
    mutuals,
    loading,
    follow,
    unfollow,
    isFollowing,
    isMutual,
    refresh: fetchFollowers,
    followerCount: followers.length,
    followingCount: following.length,
    mutualCount: mutuals.length,
  };
};
