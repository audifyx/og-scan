/**
 * CoinCommunityFull — interactive community feed for a token.
 * Tabs: Top | Recent | Media
 *
 * Like:    CC auth (X/Twitter login) required — no token holding needed.
 * Comment: CC auth + token holding required (CC API enforces it).
 */
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Image as ImageIcon,
  Star,
  Heart,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Globe,
  X,
  Send,
  ChevronDown,
  ChevronUp,
  Twitter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ccGetMessages,
  ccGetCommunity,
  ccGetReplies,
  ccTimeAgo,
  ccFmtCount,
  type CCMessage,
  type CCReply,
} from "@/lib/coincommunities";
import {
  ccIsLoggedIn,
  ccGetStoredUser,
  ccStartXLogin,
  ccLikeMessage,
  ccUnlikeMessage,
  ccPostReply,
  type CCUser,
} from "@/lib/ccAuth";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const getCallbackUrl = () => `${window.location.origin}/cc-callback`;

const SORT_TABS = [
  { id: "top" as const, label: "Top", Icon: Star },
  { id: "recent" as const, label: "Recent", Icon: MessageSquare },
  { id: "media" as const, label: "Media", Icon: ImageIcon },
] as const;
type SortTab = (typeof SORT_TABS)[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useCCAuth() {
  const [ccUser, setCcUser] = useState<CCUser | null>(() => ccGetStoredUser());
  const [signing, setSigning] = useState(false);

  // Listen for CC auth changes from other components
  useEffect(() => {
    const handler = (e: Event) => {
      setCcUser((e as CustomEvent<{ user: CCUser | null }>).detail.user);
    };
    window.addEventListener("cc-auth-changed", handler);
    return () => window.removeEventListener("cc-auth-changed", handler);
  }, []);

  const signIn = useCallback(async () => {
    if (signing) return;
    setSigning(true);
    await ccStartXLogin(
      getCallbackUrl(),
      (user) => {
        setCcUser(user);
        setSigning(false);
        window.dispatchEvent(new CustomEvent("cc-auth-changed", { detail: { user } }));
        toast.success("X account connected!");
      },
      (msg) => {
        setSigning(false);
        toast.error(msg);
      },
    );
  }, [signing]);

  return { ccUser, isLoggedIn: ccIsLoggedIn(), signing, signIn };
}

// ─── Sign-in banner ───────────────────────────────────────────────────────────

const SignInBanner = ({ onSignIn, signing }: { onSignIn: () => void; signing: boolean }) => (
  <button
    onClick={onSignIn}
    disabled={signing}
    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:border-primary/40 hover:bg-primary/5 transition-all text-white/50 hover:text-primary text-[11px] font-mono uppercase tracking-widest"
  >
    <Twitter className="h-3 w-3" />
    {signing ? "Connecting…" : "Sign in with X to interact"}
  </button>
);

// ─── Reply card ───────────────────────────────────────────────────────────────

const ReplyCard = ({ reply }: { reply: CCReply }) => (
  <div className="flex gap-2.5 px-3 py-2.5 border-b border-white/[0.04] last:border-0 bg-white/[0.01]">
    <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/[0.08]">
      {reply.profileImageUrl ? (
        <img src={reply.profileImageUrl} alt={reply.username} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-[#0e2233] grid place-items-center font-bold text-[10px] text-primary">
          {(reply.username ?? "?").slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="font-semibold text-white/90 text-[12px]">{reply.displayName || reply.username}</span>
        <span className="text-white/25 text-[10px] font-mono ml-auto">{ccTimeAgo(reply.createdAt)}</span>
      </div>
      <p className="text-white/70 text-[12px] leading-relaxed break-words">{reply.content}</p>
    </div>
  </div>
);

// ─── Post card ────────────────────────────────────────────────────────────────

interface PostCardProps {
  msg: CCMessage;
  tokenAddress: string;
  ccUser: CCUser | null;
  isLoggedIn: boolean;
  signing: boolean;
  onSignIn: () => void;
  getUserWallet: () => Promise<string | null>;
}

const PostCard = ({
  msg,
  tokenAddress,
  ccUser,
  isLoggedIn,
  signing,
  onSignIn,
  getUserWallet,
}: PostCardProps) => {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(msg.likeCount);
  const [liking, setLiking] = useState(false);

  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);

  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<CCReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyCount, setReplyCount] = useState(msg.replyCount);

  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  const handleLike = async () => {
    if (liking) return;
    if (!isLoggedIn) { onSignIn(); return; }

    setLiking(true);
    const wasLiked = liked;
    // Optimistic update
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    try {
      if (wasLiked) {
        await ccUnlikeMessage(tokenAddress, msg.id);
      } else {
        await ccLikeMessage(tokenAddress, msg.id);
      }
    } catch (e) {
      // Revert on error
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
      toast.error((e as Error).message ?? "Failed to like");
    } finally {
      setLiking(false);
    }
  };

  const handleToggleReplyBox = () => {
    if (!isLoggedIn) { onSignIn(); return; }
    setShowReplyBox((v) => {
      if (!v) setTimeout(() => replyInputRef.current?.focus(), 50);
      return !v;
    });
  };

  const handleLoadReplies = async () => {
    if (showReplies) { setShowReplies(false); return; }
    setShowReplies(true);
    if (replies.length > 0) return;
    setLoadingReplies(true);
    try {
      const data = await ccGetReplies(tokenAddress, msg.id);
      setReplies(data);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handlePostReply = async () => {
    if (!replyText.trim() || posting) return;
    setPosting(true);
    try {
      const wallet = await getUserWallet();
      if (!wallet) {
        toast.error("Link your Solana wallet in Settings → Profile first.");
        setPosting(false);
        return;
      }
      await ccPostReply(tokenAddress, msg.id, replyText.trim(), wallet);
      toast.success("Reply posted!");
      const newReply: CCReply = {
        id: Date.now().toString(),
        content: replyText.trim(),
        username: ccUser?.username ?? "you",
        displayName: ccUser?.displayName ?? "You",
        profileImageUrl: ccUser?.profileImageUrl ?? null,
        followerCount: ccUser?.followerCount ?? 0,
        likeCount: 0,
        liked: false,
        userTwitterUrl: null,
        createdAt: new Date().toISOString(),
      };
      setReplies((r) => [...r, newReply]);
      setReplyCount((c) => c + 1);
      setShowReplies(true);
      setReplyText("");
      setShowReplyBox(false);
    } catch (e) {
      const msg_ = (e as Error).message ?? "Failed to post reply";
      if (msg_.includes("insufficient token balance") || msg_.includes("403")) {
        toast.error("You need to hold this token to reply.");
      } else {
        toast.error(msg_);
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border-b border-white/[0.06]">
      {/* Main post row */}
      <div className="flex gap-3 px-4 py-4 hover:bg-white/[0.015] transition-colors">
        <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/10">
          {msg.profileImageUrl ? (
            <img src={msg.profileImageUrl} alt={msg.username} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-[#0e2233] grid place-items-center font-bold text-xs text-primary">
              {(msg.username ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-white text-[13px]">
              {msg.displayName || msg.username}
            </span>
            {msg.followerCount > 500 && (
              <span className="text-primary text-[9px] font-mono">
                {ccFmtCount(msg.followerCount)} followers
              </span>
            )}
            <span className="text-white/30 text-[10px] font-mono ml-auto">
              {ccTimeAgo(msg.createdAt)}
            </span>
          </div>

          <p className="text-white/80 text-[13px] leading-relaxed break-words">{msg.content}</p>

          {msg.mediaUrl && (
            <div className="mt-2 rounded-xl overflow-hidden max-h-52 border border-white/[0.07]">
              <img src={msg.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-1 mt-3">
            {/* Like */}
            <button
              onClick={handleLike}
              disabled={liking}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all",
                liked
                  ? "text-rose-400 bg-rose-400/10 hover:bg-rose-400/15"
                  : "text-white/35 hover:text-rose-400 hover:bg-rose-400/10",
                liking && "opacity-50",
              )}
            >
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-rose-400")} />
              {likeCount > 0 && ccFmtCount(likeCount)}
            </button>

            {/* Comment / reply */}
            <button
              onClick={handleToggleReplyBox}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all",
                showReplyBox
                  ? "text-primary bg-primary/10"
                  : "text-white/35 hover:text-primary hover:bg-primary/10",
              )}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Reply
            </button>

            {/* View replies */}
            {replyCount > 0 && (
              <button
                onClick={handleLoadReplies}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
              >
                {showReplies ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {ccFmtCount(replyCount)} {replyCount === 1 ? "reply" : "replies"}
              </button>
            )}

            {/* External link */}
            {msg.userTwitterUrl && (
              <a
                href={msg.userTwitterUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-white/15 hover:text-primary transition-colors p-1"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Inline reply input */}
      {showReplyBox && (
        <div className="px-4 pb-3 flex gap-2.5 items-start">
          <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/[0.08]">
            {ccUser?.profileImageUrl ? (
              <img src={ccUser.profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#0e2233] grid place-items-center font-bold text-[10px] text-primary">
                {(ccUser?.username ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <textarea
              ref={replyInputRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePostReply();
              }}
              placeholder="Write a reply… (Cmd+Enter to send)"
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-primary/40 resize-none"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-white/20 text-[10px] font-mono">
                Requires holding this token
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowReplyBox(false); setReplyText(""); }}
                  className="px-2.5 py-1 rounded-lg text-[10px] text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
                <button
                  onClick={handlePostReply}
                  disabled={!replyText.trim() || posting}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold transition-all",
                    replyText.trim() && !posting
                      ? "bg-primary text-black hover:bg-primary/80"
                      : "bg-white/[0.06] text-white/25 cursor-not-allowed",
                  )}
                >
                  <Send className="h-3 w-3" />
                  {posting ? "Posting…" : "Reply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded replies */}
      {showReplies && (
        <div className="ml-12 border-l border-white/[0.05] bg-white/[0.01]">
          {loadingReplies ? (
            <div className="py-4 text-center text-white/25 text-[11px]">Loading replies…</div>
          ) : replies.length === 0 ? (
            <div className="py-3 text-center text-white/20 text-[11px]">No replies yet</div>
          ) : (
            replies.map((r) => <ReplyCard key={r.id} reply={r} />)
          )}
        </div>
      )}
    </div>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = ({ label, sub }: { label: string; sub: string }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 gap-3">
    <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] grid place-items-center">
      <MessageSquare className="h-6 w-6 text-white/20" />
    </div>
    <div className="text-center">
      <p className="font-bold text-white/70 text-[15px]">{label}</p>
      <p className="text-white/35 text-[12px] mt-1">{sub}</p>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface CoinCommunityFullProps {
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenImageUrl?: string;
  marketCap?: number;
  priceChange?: number;
  description?: string;
  embedded?: boolean;
}

export const CoinCommunityFull = ({
  tokenAddress,
  tokenSymbol = "?",
  tokenName,
  tokenImageUrl,
  marketCap,
  priceChange,
  description,
  embedded = false,
}: CoinCommunityFullProps) => {
  const [activeTab, setActiveTab] = useState<SortTab>("top");
  const { ccUser, isLoggedIn, signing, signIn } = useCCAuth();
  const { user } = useAuth();

  // Lazily fetch wallet address from supabase profile when needed for replies
  const walletCacheRef = useRef<string | null | undefined>(undefined); // undefined = not fetched
  const getUserWallet = useCallback(async (): Promise<string | null> => {
    if (walletCacheRef.current !== undefined) return walletCacheRef.current;
    if (!user?.id) { walletCacheRef.current = null; return null; }
    const { data } = await supabase
      .from("profiles")
      .select("wallet_address, sol_wallet")
      .eq("user_id", user.id)
      .single();
    const wallet = (data as { wallet_address?: string | null; sol_wallet?: string | null } | null)
      ?.wallet_address || (data as { wallet_address?: string | null; sol_wallet?: string | null } | null)?.sol_wallet || null;
    walletCacheRef.current = wallet;
    return wallet;
  }, [user?.id]);

  const { data: community } = useQuery({
    queryKey: ["cc-community", tokenAddress],
    queryFn: () => ccGetCommunity(tokenAddress),
    staleTime: 60_000,
  });

  const {
    data: messages = [],
    isFetching: loadingMsgs,
    refetch: refetchMsgs,
  } = useQuery({
    queryKey: ["cc-messages", tokenAddress, activeTab],
    queryFn: () =>
      ccGetMessages(tokenAddress, 100, {
        order: activeTab === "top" ? "likes" : "time",
      }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const displayMessages = useMemo(
    () => (activeTab === "media" ? messages.filter((m) => !!m.mediaUrl) : messages),
    [messages, activeTab],
  );

  const postCount = (community as { postCount?: number } | null)?.postCount ?? messages.length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Token header (standalone mode) ── */}
      {!embedded && (
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-12 h-12 rounded-xl overflow-hidden ring-1 ring-white/10">
              {tokenImageUrl ? (
                <img src={tokenImageUrl} alt={tokenSymbol} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#0e2233] grid place-items-center font-bold text-lg text-primary">
                  {tokenSymbol.slice(0, 1)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <span className="font-display font-black text-white text-base block truncate">
                {tokenName ?? tokenSymbol}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                {marketCap != null && (
                  <span className="text-white/60 font-mono text-[11px]">
                    $
                    {marketCap >= 1_000_000
                      ? `${(marketCap / 1_000_000).toFixed(2)}M`
                      : marketCap >= 1_000
                      ? `${(marketCap / 1_000).toFixed(2)}K`
                      : marketCap.toFixed(2)}{" "}
                    MC
                  </span>
                )}
                {priceChange != null && (
                  <span
                    className={cn(
                      "font-mono text-[11px] font-bold",
                      priceChange >= 0 ? "text-og-lime" : "text-red-400",
                    )}
                  >
                    {priceChange >= 0 ? "↑" : "↓"}
                    {Math.abs(priceChange).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Refresh + open external */}
            <button
              onClick={() => refetchMsgs()}
              className={cn(
                "shrink-0 text-white/30 hover:text-white/70 transition-colors p-1",
                loadingMsgs && "animate-spin",
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            <a
              href={`https://coincommunities.org/community/${tokenAddress}`}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white/50 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Globe className="h-3 w-3" />
              Open
            </a>
          </div>

          {description && (
            <p className="text-white/55 text-[12px] leading-relaxed mt-2.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Compact header when embedded */}
      {embedded && (
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-white/50 font-mono text-[10px] uppercase tracking-widest">
              ${tokenSymbol} Community
            </span>
            <span className="text-white/25 font-mono text-[9px]">· {ccFmtCount(postCount)} posts</span>
          </div>
          <button
            onClick={() => refetchMsgs()}
            className={cn(
              "text-white/25 hover:text-white/60 transition-colors",
              loadingMsgs && "animate-spin",
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="shrink-0 flex border-b border-white/[0.07]">
        {SORT_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3 font-semibold text-[12px] transition-all border-b-2",
              activeTab === id
                ? "text-white border-og-lime"
                : "text-white/35 border-transparent hover:text-white/60",
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── CC auth strip (only when not logged in) ── */}
      {!isLoggedIn && (
        <div className="shrink-0 flex items-center justify-center gap-3 py-2.5 px-4 border-b border-white/[0.05] bg-white/[0.01]">
          <SignInBanner onSignIn={signIn} signing={signing} />
        </div>
      )}

      {/* ── Scrollable feed ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {loadingMsgs && displayMessages.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-white/30 text-sm">
            Loading...
          </div>
        ) : displayMessages.length === 0 ? (
          <EmptyState
            label={activeTab === "media" ? "No media posts yet" : "No posts yet"}
            sub={
              activeTab === "media"
                ? "Posts with images will appear here."
                : "Be the first to post on coincommunities.org."
            }
          />
        ) : (
          <>
            {displayMessages.map((msg) => (
              <PostCard
                key={msg.id}
                msg={msg}
                tokenAddress={tokenAddress}
                ccUser={ccUser}
                isLoggedIn={isLoggedIn}
                signing={signing}
                onSignIn={signIn}
                getUserWallet={getUserWallet}
              />
            ))}
            <div className="h-6" />
          </>
        )}
      </div>
    </div>
  );
};

export default CoinCommunityFull;
