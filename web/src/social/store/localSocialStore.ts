/**
 * Client-side OrbitX social graph store.
 * Seeds a demo graph and persists to localStorage so HQ works without waiting on migrations.
 * When Supabase tables are available, pages may overlay live data.
 */

import { applyXp, type XpAction } from "../growth/xp";
import { generateReferralCode } from "../growth/referrals";

const STORAGE_KEY = "orbitx-social-hq-v1";

export type SocialProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  followers: string[];
  following: string[];
  xp: number;
  reputation: number;
  createdAt: number;
  isCreator?: boolean;
  isMod?: boolean;
  muted?: boolean;
  banned?: boolean;
};

export type SocialPost = {
  id: string;
  authorId: string;
  content: string;
  createdAt: number;
  likes: string[];
  comments: SocialComment[];
  communityId?: string | null;
  pinned?: boolean;
  flagged?: boolean;
  reportCount?: number;
};

export type SocialComment = {
  id: string;
  authorId: string;
  content: string;
  createdAt: number;
  likes: string[];
};

export type SocialCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string;
  kind: "public" | "token" | "holder" | "alpha" | "gaming" | "trading";
  mint?: string | null;
  memberIds: string[];
  ownerId: string;
  holderOnly: boolean;
  memberCount: number;
  avatarEmoji: string;
};

export type VoiceSpace = {
  id: string;
  title: string;
  kind: "trading" | "gaming" | "creator" | "general";
  hostId: string;
  listeners: number;
  live: boolean;
  communityId?: string | null;
  moderated: boolean;
};

export type SocialNotification = {
  id: string;
  userId: string;
  type: "like" | "follow" | "comment" | "mention" | "referral" | "xp" | "mod" | "voice";
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  href?: string;
};

export type ModReport = {
  id: string;
  targetType: "post" | "user" | "community" | "voice";
  targetId: string;
  reason: string;
  reporterId: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: number;
};

export type SocialState = {
  profiles: SocialProfile[];
  posts: SocialPost[];
  communities: SocialCommunity[];
  voice: VoiceSpace[];
  notifications: SocialNotification[];
  reports: ModReport[];
  referralCodes: Record<string, string>;
  currentUserId: string;
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function seed(): SocialState {
  const now = Date.now();
  const me: SocialProfile = {
    id: "u_orbit_me",
    username: "you",
    displayName: "You",
    bio: "OrbitX trader · builder · community",
    followers: ["u_alpha", "u_whale"],
    following: ["u_alpha", "u_mod"],
    xp: 420,
    reputation: 62,
    createdAt: now - 86400_000 * 40,
    isCreator: false,
  };
  const alpha: SocialProfile = {
    id: "u_alpha",
    username: "alphacall",
    displayName: "Alpha Call",
    bio: "Early Solana calls. DYOR.",
    followers: ["u_orbit_me", "u_whale", "u_gamer"],
    following: ["u_mod"],
    xp: 8200,
    reputation: 88,
    createdAt: now - 86400_000 * 200,
    isCreator: true,
  };
  const whale: SocialProfile = {
    id: "u_whale",
    username: "solwhale",
    displayName: "Sol Whale",
    bio: "Size talks.",
    followers: ["u_orbit_me"],
    following: ["u_alpha"],
    xp: 5100,
    reputation: 79,
    createdAt: now - 86400_000 * 120,
  };
  const gamer: SocialProfile = {
    id: "u_gamer",
    username: "orbitplay",
    displayName: "Orbit Play",
    bio: "City raids + voice lobbies",
    followers: [],
    following: ["u_alpha"],
    xp: 2100,
    reputation: 55,
    createdAt: now - 86400_000 * 60,
  };
  const mod: SocialProfile = {
    id: "u_mod",
    username: "orbitmod",
    displayName: "Orbit Mod",
    bio: "Keeps the rooms clean.",
    followers: ["u_alpha", "u_orbit_me"],
    following: [],
    xp: 12000,
    reputation: 95,
    createdAt: now - 86400_000 * 300,
    isMod: true,
    isCreator: true,
  };

  const communities: SocialCommunity[] = [
    {
      id: "c_obx",
      name: "OBX Holders",
      slug: "obx-holders",
      description: "Holder-only alpha for OrbitX token community.",
      kind: "holder",
      mint: null,
      memberIds: [me.id, alpha.id, mod.id],
      ownerId: mod.id,
      holderOnly: true,
      memberCount: 3,
      avatarEmoji: "◈",
    },
    {
      id: "c_sol_traders",
      name: "Sol Traders",
      slug: "sol-traders",
      description: "Charts, rankings, and live discussion rooms.",
      kind: "trading",
      memberIds: [me.id, alpha.id, whale.id],
      ownerId: alpha.id,
      holderOnly: false,
      memberCount: 3,
      avatarEmoji: "📈",
    },
    {
      id: "c_alpha",
      name: "Alpha Desk",
      slug: "alpha-desk",
      description: "Invite-gated alpha channel for high-signal calls.",
      kind: "alpha",
      memberIds: [alpha.id, whale.id, mod.id],
      ownerId: alpha.id,
      holderOnly: false,
      memberCount: 3,
      avatarEmoji: "⚡",
    },
    {
      id: "c_city",
      name: "City Squad",
      slug: "city-squad",
      description: "Gaming lobbies bridging City players and traders.",
      kind: "gaming",
      memberIds: [gamer.id, me.id],
      ownerId: gamer.id,
      holderOnly: false,
      memberCount: 2,
      avatarEmoji: "🎮",
    },
  ];

  const posts: SocialPost[] = [
    {
      id: "p1",
      authorId: alpha.id,
      content: "Watching liquidity rotate into meme majors. $OBX community voice space in 10 — join Alpha Desk.",
      createdAt: now - 3_600_000,
      likes: [me.id, whale.id],
      comments: [
        { id: "cm1", authorId: me.id, content: "In — bringing the desk online.", createdAt: now - 3_000_000, likes: [alpha.id] },
      ],
      communityId: "c_alpha",
      pinned: true,
    },
    {
      id: "p2",
      authorId: whale.id,
      content: "Holder-only rooms keep the signal high. If you're not holding, you're listening.",
      createdAt: now - 7_200_000,
      likes: [alpha.id],
      comments: [],
      communityId: "c_obx",
    },
    {
      id: "p3",
      authorId: gamer.id,
      content: "City lobby + trading room tonight. Voice first, then we sync positions.",
      createdAt: now - 10_800_000,
      likes: [me.id],
      comments: [],
      communityId: "c_city",
    },
    {
      id: "p4",
      authorId: me.id,
      content: "Shipped my first OrbitX social check-in. Referrals + XP are live in Growth.",
      createdAt: now - 1_800_000,
      likes: [],
      comments: [],
    },
  ];

  const voice: VoiceSpace[] = [
    { id: "v1", title: "Alpha Desk — Live", kind: "trading", hostId: alpha.id, listeners: 28, live: true, communityId: "c_alpha", moderated: true },
    { id: "v2", title: "OBX Holder Room", kind: "trading", hostId: mod.id, listeners: 12, live: true, communityId: "c_obx", moderated: true },
    { id: "v3", title: "City Raid Prep", kind: "gaming", hostId: gamer.id, listeners: 9, live: true, communityId: "c_city", moderated: false },
    { id: "v4", title: "Creator AMA", kind: "creator", hostId: alpha.id, listeners: 0, live: false, communityId: null, moderated: true },
  ];

  return {
    profiles: [me, alpha, whale, gamer, mod],
    posts,
    communities,
    voice,
    notifications: [
      {
        id: "n1",
        userId: me.id,
        type: "follow",
        title: "New follower",
        body: "@alphacall followed you",
        read: false,
        createdAt: now - 900_000,
        href: "/hq/profile/u_alpha",
      },
      {
        id: "n2",
        userId: me.id,
        type: "xp",
        title: "+20 XP",
        body: "Daily check-in claimed",
        read: false,
        createdAt: now - 600_000,
        href: "/hq/growth",
      },
      {
        id: "n3",
        userId: me.id,
        type: "voice",
        title: "Voice space live",
        body: "Alpha Desk is live — 28 listening",
        read: true,
        createdAt: now - 3_600_000,
        href: "/hq/voice",
      },
    ],
    reports: [
      {
        id: "r1",
        targetType: "post",
        targetId: "p2",
        reason: "Possible spam / shill",
        reporterId: me.id,
        status: "open",
        createdAt: now - 2_000_000,
      },
    ],
    referralCodes: {
      [me.id]: generateReferralCode(me.id),
      [alpha.id]: generateReferralCode(alpha.id),
    },
    currentUserId: me.id,
  };
}

function load(): SocialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SocialState;
  } catch {
    /* ignore */
  }
  const s = seed();
  save(s);
  return s;
}

function save(state: SocialState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

let state: SocialState | null = null;
const listeners = new Set<() => void>();

export function getSocialState(): SocialState {
  if (!state) state = typeof window === "undefined" ? seed() : load();
  return state;
}

export function subscribeSocial(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit(next: SocialState) {
  state = next;
  save(next);
  listeners.forEach((fn) => fn());
}

function bumpXp(s: SocialState, userId: string, action: XpAction): SocialState {
  return {
    ...s,
    profiles: s.profiles.map((p) => (p.id === userId ? { ...p, xp: applyXp(p.xp, action), reputation: Math.min(99, p.reputation + (action === "referral_signup" ? 3 : 1)) } : p)),
  };
}

function notify(s: SocialState, n: Omit<SocialNotification, "id" | "createdAt" | "read">): SocialState {
  return {
    ...s,
    notifications: [{ ...n, id: uid("n"), createdAt: Date.now(), read: false }, ...s.notifications].slice(0, 80),
  };
}

export function createPost(content: string, communityId?: string | null): SocialPost {
  let s = getSocialState();
  const post: SocialPost = {
    id: uid("p"),
    authorId: s.currentUserId,
    content: content.trim(),
    createdAt: Date.now(),
    likes: [],
    comments: [],
    communityId: communityId || null,
  };
  s = bumpXp({ ...s, posts: [post, ...s.posts] }, s.currentUserId, "post_create");
  commit(s);
  return post;
}

export function likePost(postId: string) {
  let s = getSocialState();
  const uidMe = s.currentUserId;
  const before = s.posts.find((p) => p.id === postId);
  const wasLiked = !!before?.likes.includes(uidMe);
  s = {
    ...s,
    posts: s.posts.map((p) => {
      if (p.id !== postId) return p;
      return { ...p, likes: wasLiked ? p.likes.filter((id) => id !== uidMe) : [...p.likes, uidMe] };
    }),
  };
  const post = s.posts.find((p) => p.id === postId);
  if (!wasLiked && post && post.authorId !== uidMe) {
    s = bumpXp(s, post.authorId, "like_received");
    s = notify(s, {
      userId: post.authorId,
      type: "like",
      title: "New like",
      body: "Someone liked your post",
      href: "/hq/feed",
    });
  }
  commit(s);
}

export function commentOnPost(postId: string, content: string) {
  let s = getSocialState();
  const c: SocialComment = {
    id: uid("cm"),
    authorId: s.currentUserId,
    content: content.trim(),
    createdAt: Date.now(),
    likes: [],
  };
  s = {
    ...s,
    posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, c] } : p)),
  };
  s = bumpXp(s, s.currentUserId, "comment");
  const post = s.posts.find((p) => p.id === postId);
  if (post && post.authorId !== s.currentUserId) {
    s = notify(s, {
      userId: post.authorId,
      type: "comment",
      title: "New comment",
      body: content.slice(0, 80),
      href: "/hq/feed",
    });
  }
  commit(s);
}

export function toggleFollow(targetId: string) {
  let s = getSocialState();
  const me = s.currentUserId;
  if (me === targetId) return;
  const following = s.profiles.find((p) => p.id === me)?.following.includes(targetId);
  s = {
    ...s,
    profiles: s.profiles.map((p) => {
      if (p.id === me) {
        return {
          ...p,
          following: following ? p.following.filter((id) => id !== targetId) : [...p.following, targetId],
        };
      }
      if (p.id === targetId) {
        return {
          ...p,
          followers: following ? p.followers.filter((id) => id !== me) : [...p.followers, me],
        };
      }
      return p;
    }),
  };
  if (!following) {
    s = bumpXp(s, targetId, "follow_gained");
    s = notify(s, {
      userId: targetId,
      type: "follow",
      title: "New follower",
      body: "Someone followed you on OrbitX",
      href: `/hq/profile/${me}`,
    });
  }
  commit(s);
}

export function joinCommunity(communityId: string) {
  let s = getSocialState();
  s = {
    ...s,
    communities: s.communities.map((c) => {
      if (c.id !== communityId || c.memberIds.includes(s.currentUserId)) return c;
      return { ...c, memberIds: [...c.memberIds, s.currentUserId], memberCount: c.memberCount + 1 };
    }),
  };
  commit(s);
}

export function claimDailyCheckin() {
  let s = getSocialState();
  s = bumpXp(s, s.currentUserId, "daily_checkin");
  s = notify(s, {
    userId: s.currentUserId,
    type: "xp",
    title: "+20 XP",
    body: "Daily check-in claimed",
    href: "/hq/growth",
  });
  commit(s);
}

export function markNotificationsRead() {
  const s = getSocialState();
  commit({
    ...s,
    notifications: s.notifications.map((n) => (n.userId === s.currentUserId ? { ...n, read: true } : n)),
  });
}

export function fileReport(input: Omit<ModReport, "id" | "createdAt" | "status" | "reporterId">) {
  const s = getSocialState();
  const report: ModReport = {
    ...input,
    id: uid("r"),
    reporterId: s.currentUserId,
    status: "open",
    createdAt: Date.now(),
  };
  let next = { ...s, reports: [report, ...s.reports] };
  if (input.targetType === "post") {
    next = {
      ...next,
      posts: next.posts.map((p) =>
        p.id === input.targetId ? { ...p, flagged: true, reportCount: (p.reportCount || 0) + 1 } : p,
      ),
    };
  }
  commit(next);
}

export function resolveReport(reportId: string, status: "resolved" | "dismissed", action?: "remove_post" | "mute_user" | "ban_user") {
  let s = getSocialState();
  const report = s.reports.find((r) => r.id === reportId);
  s = {
    ...s,
    reports: s.reports.map((r) => (r.id === reportId ? { ...r, status } : r)),
  };
  if (report && action === "remove_post" && report.targetType === "post") {
    s = { ...s, posts: s.posts.filter((p) => p.id !== report.targetId) };
  }
  if (report && (action === "mute_user" || action === "ban_user") && report.targetType === "user") {
    s = {
      ...s,
      profiles: s.profiles.map((p) =>
        p.id === report.targetId
          ? { ...p, muted: action === "mute_user" || p.muted, banned: action === "ban_user" || p.banned }
          : p,
      ),
    };
  }
  if (s.profiles.find((p) => p.id === s.currentUserId)?.isMod) {
    s = bumpXp(s, s.currentUserId, "mod_action");
  }
  commit(s);
}

export function joinVoice(spaceId: string) {
  let s = getSocialState();
  s = {
    ...s,
    voice: s.voice.map((v) => (v.id === spaceId ? { ...v, listeners: v.listeners + 1, live: true } : v)),
  };
  s = bumpXp(s, s.currentUserId, "voice_join");
  commit(s);
}

export function setUserRestriction(userId: string, action: "mute" | "ban" | "clear") {
  const s = getSocialState();
  commit({
    ...s,
    profiles: s.profiles.map((p) => {
      if (p.id !== userId) return p;
      if (action === "clear") return { ...p, muted: false, banned: false };
      if (action === "mute") return { ...p, muted: true };
      return { ...p, banned: true, muted: true };
    }),
  });
}

export function resetSocialDemo() {
  const s = seed();
  commit(s);
}

/** Simple anti-spam: rate + duplicate detection. */
export function isSpammy(content: string, recentContents: string[], now = Date.now(), recentTimes: number[] = []): string | null {
  const text = content.trim();
  if (text.length < 2) return "Too short";
  if (text.length > 2000) return "Too long";
  if (/(https?:\/\/\S+\s*){4,}/i.test(text)) return "Too many links";
  if (/(.)\1{12,}/.test(text)) return "Repeated characters";
  if (recentContents.some((c) => c.trim().toLowerCase() === text.toLowerCase())) return "Duplicate post";
  const lastMinute = recentTimes.filter((t) => now - t < 60_000).length;
  if (lastMinute >= 5) return "Slow down — rate limit";
  return null;
}
