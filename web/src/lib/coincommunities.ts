/**
 * CoinCommunities API client
 * Docs: https://coincommunities.org/docs/quickstart
 * Base URL: https://api.coin-communities.xyz
 */

export const CC_BASE = "https://api.coin-communities.xyz";
export const CC_API_KEY = import.meta.env.VITE_CC_API_KEY ?? "";

const ccFetch = async (path: string): Promise<unknown> => {
  const res = await fetch(`${CC_BASE}${path}`, {
    headers: { "x-api-key": CC_API_KEY },
  });
  if (!res.ok) throw new Error(`CoinCommunities API ${res.status}: ${path}`);
  return res.json();
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type CCTopCommunity = {
  tokenAddress: string;
  tokenSymbol: string;
  tokenImageUrl: string | null;
  tokenHighResImageUrl: string | null;
  chainId: number;
  postCount: number;
  memberCount: number;
  totalLikes: number;
  latestPostAt: number;
};

export type CCCommunity = {
  id: string;
  tokenAddress: string;
  createdAt: string;
};

export type CCCommunityDetail = {
  community: CCCommunity;
  postCount: number;
  memberCount: number;
  totalLikes: number;
  latestPostAt: number;
  tokenSymbol: string;
  tokenImageUrl: string | null;
  tokenHighResImageUrl: string | null;
  chainId: number;
};

export type CCMessage = {
  id: string;
  communityId: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenImageUrl: string | null;
  content: string;
  mediaUrl: string | null;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  followerCount: number;
  likeCount: number;
  replyCount: number;
  userTwitterUrl: string | null;
  createdAt: string;
  walletAddress: string;
  source: string | null;
};

export type CCFeedItem = CCMessage;

// ─── API calls ────────────────────────────────────────────────────────────────

export async function ccGetTopCommunities(limit = 20): Promise<CCTopCommunity[]> {
  try {
    const data = await ccFetch(`/api/v1/communities/top?limit=${limit}`) as { communities: CCTopCommunity[] };
    return data.communities ?? [];
  } catch {
    return [];
  }
}

export async function ccGetCommunity(tokenAddress: string): Promise<CCCommunityDetail | null> {
  try {
    return await ccFetch(`/api/v1/communities/${encodeURIComponent(tokenAddress)}`) as CCCommunityDetail;
  } catch {
    return null;
  }
}

export async function ccGetMessages(
  tokenAddress: string,
  limit = 50,
  opts?: { order?: "time" | "likes" },
): Promise<CCMessage[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit), order: "desc" });
    // API supports sort=likes for top posts, omit for chronological (default desc)
    if (opts?.order === "likes") params.set("sort", "likes");
    const data = await ccFetch(
      `/api/v1/communities/${encodeURIComponent(tokenAddress)}/messages/public?${params}`
    ) as { messages: CCMessage[] };
    return data.messages ?? [];
  } catch {
    return [];
  }
}

export async function ccGetPublicFeed(limit = 50): Promise<CCFeedItem[]> {
  try {
    const data = await ccFetch(`/api/v1/feed/public?limit=${limit}`) as { items: CCFeedItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

export type CCReply = {
  id: string;
  content: string;
  username: string;
  displayName: string;
  profileImageUrl: string | null;
  followerCount: number;
  likeCount: number;
  liked: boolean;
  userTwitterUrl: string | null;
  createdAt: string;
};

export async function ccGetReplies(
  tokenAddress: string,
  messageId: string,
  limit = 50,
): Promise<CCReply[]> {
  try {
    const data = await ccFetch(
      `/api/v1/communities/${encodeURIComponent(tokenAddress)}/messages/${encodeURIComponent(messageId)}/replies?limit=${limit}&order=asc`
    ) as { replies: CCReply[] };
    return data.replies ?? [];
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function ccTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function ccFmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
