/**
 * useSocialFeed — LifeInvasion feed state.
 * Player posts persist to localStorage; NPC posts regenerate from live
 * drama via buildFeed. Likes persist per device.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildFeed } from "../engine/feedEngine";
import type { FeedPost, TokenDrama } from "../types";

const POSTS_KEY = "orbitxcity.social.player-posts.v1";
const LIKES_KEY = "orbitxcity.social.liked.v1";

function loadPosts(): FeedPost[] {
  try {
    const raw = localStorage.getItem(POSTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as FeedPost[];
      if (Array.isArray(arr)) return arr.slice(0, 50);
    }
  } catch {
    /* fresh */
  }
  return [];
}
function loadLikes(): string[] {
  try {
    const raw = localStorage.getItem(LIKES_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* none */
  }
  return [];
}

export function useSocialFeed(drama: TokenDrama[], playerName: string, playerHandle: string) {
  const [playerPosts, setPlayerPosts] = useState<FeedPost[]>(loadPosts);
  const [liked, setLiked] = useState<Set<string>>(() => new Set(loadLikes()));

  useEffect(() => {
    try {
      localStorage.setItem(POSTS_KEY, JSON.stringify(playerPosts));
    } catch {
      /* blocked */
    }
  }, [playerPosts]);
  useEffect(() => {
    try {
      localStorage.setItem(LIKES_KEY, JSON.stringify([...liked]));
    } catch {
      /* blocked */
    }
  }, [liked]);

  const feed = useMemo(
    () => buildFeed({ drama, playerPosts, likedIds: liked }),
    [drama, playerPosts, liked]
  );

  const post = useCallback(
    (text: string) => {
      const t = text.trim().slice(0, 280);
      if (!t) return null;
      const p: FeedPost = {
        id: `player-${Date.now()}`,
        authorId: "player",
        authorName: playerName,
        authorHandle: playerHandle,
        authorInitials: playerName.slice(0, 2).toUpperCase(),
        authorHue: 265,
        npc: false,
        verified: false,
        text: t,
        tokens: [],
        kind: "player",
        likes: 0,
        reposts: 0,
        ts: Date.now(),
      };
      setPlayerPosts((prev) => [p, ...prev].slice(0, 50));
      return p;
    },
    [playerName, playerHandle]
  );

  const toggleLike = useCallback((id: string) => {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deletePost = useCallback((id: string) => {
    setPlayerPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { feed, post, toggleLike, deletePost, liked };
}
