/**
 * CoinCommunityFull — read-only community feed for a token.
 * Tabs: Top | Recent | Media
 * No posting, no auth — clean scrollable feed.
 */
import { useState, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ccGetMessages,
  ccGetCommunity,
  ccTimeAgo,
  ccFmtCount,
  type CCMessage,
} from "@/lib/coincommunities";

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_TABS = [
  { id: "top" as const, label: "Top", Icon: Star },
  { id: "recent" as const, label: "Recent", Icon: MessageSquare },
  { id: "media" as const, label: "Media", Icon: ImageIcon },
] as const;
type SortTab = (typeof SORT_TABS)[number]["id"];

// ─── Sub-components ───────────────────────────────────────────────────────────

const PostCard = ({ msg }: { msg: CCMessage }) => (
  <div className="flex gap-3 px-4 py-4 border-b border-white/[0.06] hover:bg-white/[0.015] transition-colors">
    <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/10">
      {msg.profileImageUrl ? (
        <img
          src={msg.profileImageUrl}
          alt={msg.username}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-[#0e2233] grid place-items-center font-bold text-xs text-og-cyan">
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
          <span className="text-og-cyan text-[9px] font-mono">
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

      <div className="flex items-center gap-4 mt-2.5">
        <span className="flex items-center gap-1 text-white/30 text-[11px]">
          <Heart className="h-3.5 w-3.5" />
          {ccFmtCount(msg.likeCount)}
        </span>
        {msg.replyCount > 0 && (
          <span className="flex items-center gap-1 text-white/30 text-[11px]">
            <MessageCircle className="h-3.5 w-3.5" />
            {ccFmtCount(msg.replyCount)}
          </span>
        )}
        {msg.userTwitterUrl && (
          <a
            href={msg.userTwitterUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-white/20 hover:text-og-cyan transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  </div>
);

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
    refetchInterval: 60_000, // less aggressive — 60s instead of 30s
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
                <div className="w-full h-full bg-[#0e2233] grid place-items-center font-bold text-lg text-og-cyan">
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
              className="shrink-0 flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white/50 hover:border-og-cyan/40 hover:text-og-cyan transition-colors"
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
              <PostCard key={msg.id} msg={msg} />
            ))}
            <div className="h-6" />
          </>
        )}
      </div>
    </div>
  );
};

export default CoinCommunityFull;
