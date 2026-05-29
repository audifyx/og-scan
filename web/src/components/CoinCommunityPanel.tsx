/**
 * CoinCommunityPanel — embeds the CoinCommunities chat for a token address.
 * Used inside CoinDetailDialog's right sidebar (pump.fun style).
 */
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Heart, MessageCircle, RefreshCw, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ccGetCommunity,
  ccGetMessages,
  ccTimeAgo,
  ccFmtCount,
  type CCMessage,
} from "@/lib/coincommunities";

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  tokenAddress: string;
  tokenSymbol: string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const MessageRow = ({ msg }: { msg: CCMessage }) => (
  <div className="flex gap-2.5 py-2.5 border-b border-white/[0.05] last:border-0">
    {/* Avatar */}
    <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/10">
      {msg.profileImageUrl ? (
        <img src={msg.profileImageUrl} alt={msg.username} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-[#0e1e33] grid place-items-center font-bold text-[10px] text-og-cyan">
          {msg.username?.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="font-semibold text-white/90 text-[11px] truncate">{msg.displayName || msg.username}</span>
        {msg.followerCount > 1000 && (
          <span className="text-og-lime font-mono text-[8px] uppercase tracking-wider shrink-0">
            {ccFmtCount(msg.followerCount)} followers
          </span>
        )}
        <span className="ml-auto text-white/30 font-mono text-[9px] shrink-0">{ccTimeAgo(msg.createdAt)}</span>
      </div>
      <p className="text-white/65 text-[11px] leading-relaxed break-words line-clamp-3">{msg.content}</p>
      {msg.mediaUrl && (
        <div className="mt-1.5 rounded-lg overflow-hidden max-h-32">
          <img src={msg.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="flex items-center gap-3 mt-1.5">
        <span className="flex items-center gap-0.5 text-white/30 text-[9px]">
          <Heart className="h-2.5 w-2.5" />{msg.likeCount}
        </span>
        {msg.replyCount > 0 && (
          <span className="flex items-center gap-0.5 text-white/30 text-[9px]">
            <MessageCircle className="h-2.5 w-2.5" />{msg.replyCount}
          </span>
        )}
      </div>
    </div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const CoinCommunityPanel = ({ tokenAddress, tokenSymbol }: Props) => {
  const { data: community, isFetching: fetchingCommunity } = useQuery({
    queryKey: ["cc-community", tokenAddress],
    queryFn: () => ccGetCommunity(tokenAddress),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const {
    data: messages = [],
    isFetching: fetchingMessages,
    refetch,
  } = useQuery({
    queryKey: ["cc-messages", tokenAddress],
    queryFn: () => ccGetMessages(tokenAddress, 20),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const communityUrl = `https://coincommunities.org/community/${tokenAddress}`;
  const isFetching = fetchingCommunity || fetchingMessages;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-og-lime">
          <Zap className="h-3.5 w-3.5" />
          ${tokenSymbol} Community
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className={cn(
              "text-white/30 hover:text-white/70 transition-colors",
              isFetching && "animate-spin"
            )}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <a
            href={communityUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-white/50 transition hover:border-og-lime/40 hover:text-og-lime"
          >
            Full <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      {/* Stats row */}
      {community && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-white/[0.05] bg-white/[0.02]">
          <span className="flex items-center gap-1 font-mono text-[9px] text-white/40 uppercase tracking-wider">
            <MessageCircle className="h-3 w-3" />
            {ccFmtCount(community.postCount)} posts
          </span>
          <span className="flex items-center gap-1 font-mono text-[9px] text-white/40 uppercase tracking-wider">
            <Users className="h-3 w-3" />
            {ccFmtCount(community.memberCount)} members
          </span>
          <span className="flex items-center gap-1 font-mono text-[9px] text-white/40 uppercase tracking-wider">
            <Heart className="h-3 w-3" />
            {ccFmtCount(community.totalLikes)} likes
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="px-4 py-1 max-h-[340px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        {fetchingMessages && messages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-white/30 text-xs">
            Loading community...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <MessageCircle className="h-7 w-7 text-white/15" />
            <p className="text-white/30 text-xs text-center">
              No posts yet — be the first to post in this community!
            </p>
            <a
              href={communityUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 rounded-lg border border-og-lime/30 bg-og-lime/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-og-lime transition hover:bg-og-lime/20"
            >
              Join community <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <div>
            {messages.map((msg) => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {messages.length > 0 && (
        <div className="px-4 py-3 border-t border-white/[0.05]">
          <a
            href={communityUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-og-lime/30 bg-og-lime/10 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-og-lime transition hover:bg-og-lime/20"
          >
            Visit community → <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
};
