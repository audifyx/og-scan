/**
 * CoinCommunitiesPage — Cross-coin community feed powered by CoinCommunities API.
 * Shows: top communities grid + live cross-community public feed.
 * Route: /coin-communities
 */
import { useState, useCallback, lazy, Suspense, useEffect } from "react";
const CoinCommunityFull = lazy(() => import("@/components/CoinCommunityFull").then(m => ({ default: m.CoinCommunityFull })));
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  MessageCircle,
  Heart,
  ExternalLink,
  RefreshCw,
  Globe,
  TrendingUp,
  Flame,
  Clock,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ccGetStoredUser,
  type CCUser,
} from "@/lib/ccAuth";
import {
  ccGetTopCommunities,
  ccGetPublicFeed,
  ccGetMessages,
  ccTimeAgo,
  ccFmtCount,
  type CCTopCommunity,
  type CCFeedItem,
  type CCMessage,
} from "@/lib/coincommunities";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "feed" | "top" | "token";

// ─── Sub-components ───────────────────────────────────────────────────────────

const FeedCard = ({ item }: { item: CCFeedItem }) => (
  <div className="flex gap-3 px-4 py-4 border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
    {/* Author avatar */}
    <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/10">
      {item.profileImageUrl ? (
        <img src={item.profileImageUrl} alt={item.username} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-[#0e1e33] grid place-items-center font-bold text-xs text-og-cyan">
          {item.username?.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-0.5">
        <span className="font-semibold text-white/90 text-[12px]">{item.displayName || item.username}</span>
        {item.followerCount > 1000 && (
          <span className="text-og-lime font-mono text-[8px] uppercase tracking-wider">
            {ccFmtCount(item.followerCount)} followers
          </span>
        )}
        <span className="text-white/30 font-mono text-[9px]">{ccTimeAgo(item.createdAt)}</span>
      </div>

      {/* Token badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {item.tokenImageUrl && (
          <img src={item.tokenImageUrl} alt={item.tokenSymbol} className="w-3.5 h-3.5 rounded-full" loading="lazy" />
        )}
        <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">
          ${item.tokenSymbol}
        </span>
      </div>

      <p className="text-white/70 text-[13px] leading-relaxed break-words">{item.content}</p>

      {item.mediaUrl && (
        <div className="mt-2 rounded-xl overflow-hidden max-h-52 border border-white/[0.07]">
          <img src={item.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1 text-white/30 text-[10px]">
          <Heart className="h-3 w-3" />{ccFmtCount(item.likeCount)}
        </span>
        {item.replyCount > 0 && (
          <span className="flex items-center gap-1 text-white/30 text-[10px]">
            <MessageCircle className="h-3 w-3" />{ccFmtCount(item.replyCount)}
          </span>
        )}
        {item.userTwitterUrl && (
          <a
            href={item.userTwitterUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-white/25 hover:text-og-cyan transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  </div>
);

const CommunityCard = ({ community, onClick }: { community: CCTopCommunity; onClick: (ca: string) => void }) => (
  <button
    type="button"
    onClick={() => onClick(community.tokenAddress)}
    className="flex items-center gap-3 p-3.5 rounded-xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-og-lime/20 transition-all text-left w-full"
  >
    {/* Token image */}
    <div className="shrink-0 w-11 h-11 rounded-xl overflow-hidden ring-1 ring-white/10">
      {community.tokenImageUrl ? (
        <img src={community.tokenImageUrl} alt={community.tokenSymbol} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-[#0e1e33] grid place-items-center font-bold text-sm text-og-cyan">
          {community.tokenSymbol?.slice(0, 1)}
        </div>
      )}
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <div className="font-bold text-white text-[13px] truncate">${community.tokenSymbol}</div>
      <div className="flex items-center gap-3 mt-0.5">
        <span className="flex items-center gap-0.5 text-white/35 text-[9px] font-mono">
          <MessageCircle className="h-2.5 w-2.5" />{ccFmtCount(community.postCount)}
        </span>
        <span className="flex items-center gap-0.5 text-white/35 text-[9px] font-mono">
          <Users className="h-2.5 w-2.5" />{ccFmtCount(community.memberCount)}
        </span>
        <span className="flex items-center gap-0.5 text-white/35 text-[9px] font-mono">
          <Heart className="h-2.5 w-2.5" />{ccFmtCount(community.totalLikes)}
        </span>
      </div>
    </div>

    {/* Latest activity */}
    <div className="shrink-0 text-white/25 text-[9px] font-mono">
      {ccTimeAgo(new Date(community.latestPostAt).toISOString())}
    </div>
  </button>
);

const TokenFeed = ({ tokenAddress, tokenSymbol, onBack }: { tokenAddress: string; tokenSymbol: string; onBack: () => void }) => {
  const { data: messages = [], isFetching, refetch } = useQuery({
    queryKey: ["cc-token-feed", tokenAddress],
    queryFn: () => ccGetMessages(tokenAddress, 50),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07]">
        <button
          onClick={onBack}
          className="text-white/40 hover:text-white/80 font-mono text-[10px] uppercase tracking-widest transition-colors"
        >
          ← Back
        </button>
        <span className="font-bold text-white text-sm">${tokenSymbol} Community</span>
        <button
          onClick={() => refetch()}
          className={cn("ml-auto text-white/30 hover:text-white/70 transition-colors", isFetching && "animate-spin")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <a
          href={`https://coincommunities.org/community/${tokenAddress}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white/50 transition hover:border-og-cyan/40 hover:text-og-cyan"
        >
          Open <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {isFetching && messages.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-white/30 text-sm">Loading...</div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MessageCircle className="h-8 w-8 text-white/15" />
          <p className="text-white/30 text-sm">No posts yet in this community</p>
          <a
            href={`https://coincommunities.org/community/${tokenAddress}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-og-lime/30 bg-og-lime/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-og-lime transition hover:bg-og-lime/20"
          >
            Be the first to post <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : (
        messages.map((msg: CCMessage) => <FeedCard key={msg.id} item={msg} />)
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "feed" as View, label: "Live Feed", icon: Flame },
  { id: "top" as View, label: "Top Communities", icon: TrendingUp },
] as const;



export const CoinCommunitiesPage = () => {
  const [activeView, setActiveView] = useState<View>("feed");
  const [selectedToken, setSelectedToken] = useState<{ address: string; symbol: string } | null>(null);
  const [ccUser, setCcUser] = useState<CCUser | null>(() => ccGetStoredUser());

  // Listen for global X auth state changes (from Settings → Connections tab)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ user: CCUser | null }>).detail;
      setCcUser(detail.user);
    };
    window.addEventListener("cc-auth-changed", handler);
    return () => window.removeEventListener("cc-auth-changed", handler);
  }, []);

  const {
    data: feed = [],
    isFetching: fetchingFeed,
    refetch: refetchFeed,
  } = useQuery({
    queryKey: ["cc-public-feed"],
    queryFn: () => ccGetPublicFeed(50),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const {
    data: top = [],
    isFetching: fetchingTop,
    refetch: refetchTop,
  } = useQuery({
    queryKey: ["cc-top-communities"],
    queryFn: () => ccGetTopCommunities(30),
    staleTime: 60_000,
  });

  const handleSelectToken = useCallback((ca: string, symbol?: string) => {
    const community = top.find((c) => c.tokenAddress === ca);
    setSelectedToken({ address: ca, symbol: symbol ?? community?.tokenSymbol ?? "?" });
    setActiveView("token");
  }, [top]);

  const handleBack = useCallback(() => {
    setSelectedToken(null);
    setActiveView("feed");
  }, []);

  const isFetching = fetchingFeed || fetchingTop;

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 bg-background/95 backdrop-blur-xl border-b border-white/[0.07]">
        <div className="flex items-center gap-2 px-4 py-3">
          {/* Back button when viewing a token */}
          {selectedToken ? (
            <button
              onClick={handleBack}
              className="text-white/40 hover:text-white/80 font-mono text-[10px] uppercase tracking-widest transition-colors shrink-0"
            >
              ← Back
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-og-lime shrink-0" />
              <span className="font-display font-black text-white text-sm uppercase tracking-tight">CC Feed</span>
              <span className="rounded-full bg-og-lime/10 border border-og-lime/20 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-og-lime">Live</span>
            </div>
          )}

          {selectedToken && (
            <span className="font-bold text-white text-sm truncate">${selectedToken.symbol}</span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Refresh */}
          <button
            onClick={() => { refetchFeed(); refetchTop(); }}
            className={cn("text-white/30 hover:text-white/70 transition-colors p-1 shrink-0", isFetching && "animate-spin")}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* X connected pill — read from global state */}
          {ccUser ? (
            <div className="flex items-center gap-1.5 rounded-full bg-og-lime/10 border border-og-lime/20 pl-1 pr-2 py-1 shrink-0">
              {ccUser.profileImageUrl && (
                <img src={ccUser.profileImageUrl} alt={ccUser.displayName} className="w-5 h-5 rounded-full" />
              )}
              <span className="font-mono text-[9px] text-og-lime max-w-[70px] truncate">@{ccUser.username}</span>
            </div>
          ) : (
            <button
              onClick={() => { window.location.href = "/settings?tab=connections"; }}
              className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/10 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-white/40 hover:border-og-lime/30 hover:text-og-lime transition-colors shrink-0"
            >
              <Settings className="h-3 w-3" />
              Connect X
            </button>
          )}
        </div>

        {/* Tab bar — only on main feed/top views */}
        {!selectedToken && (
          <div className="flex px-4 gap-1 pb-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all",
                  activeView === id
                    ? "bg-og-lime/15 text-og-lime border border-og-lime/20"
                    : "text-white/35 hover:text-white/60",
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Token-specific community */}
        {selectedToken && (
          <Suspense fallback={<div className="flex items-center justify-center h-48 text-white/30 text-sm">Loading...</div>}>
            <CoinCommunityFull
              tokenAddress={selectedToken.address}
              tokenSymbol={selectedToken.symbol}
            />
          </Suspense>
        )}

        {/* Live cross-community feed */}
        {!selectedToken && activeView === "feed" && (
          fetchingFeed && feed.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-white/30 text-sm">Loading live feed...</div>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Globe className="h-8 w-8 text-white/15" />
              <p className="text-white/30 text-sm">No feed posts yet</p>
            </div>
          ) : (
            <>
              {feed.map((item) => (
                <div
                  key={item.id}
                  onClick={() => item.tokenAddress && handleSelectToken(item.tokenAddress, item.tokenSymbol)}
                  className="cursor-pointer"
                >
                  <FeedCard item={item} />
                </div>
              ))}
              <div className="h-6" />
            </>
          )
        )}

        {/* Top communities grid */}
        {!selectedToken && activeView === "top" && (
          <div className="p-4">
            {fetchingTop && top.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-white/30 text-sm">Loading communities...</div>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {top.map((community) => (
                    <CommunityCard
                      key={community.tokenAddress}
                      community={community}
                      onClick={(ca) => handleSelectToken(ca, community.tokenSymbol)}
                    />
                  ))}
                </div>
                <div className="h-6" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoinCommunitiesPage;
