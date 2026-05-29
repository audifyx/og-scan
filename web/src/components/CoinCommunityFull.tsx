/**
 * CoinCommunityFull — pump.fun-style community page embedded in the coin detail dialog.
 * Layout matches the screenshot exactly:
 *   - Token header (logo, name, MC, Δ%)
 *   - Description
 *   - Tabs: Top | Recent | Media | Members
 *   - Posts feed / empty state
 *   - Green "+" FAB to post (requires X auth + wallet)
 */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Users,
  Image as ImageIcon,
  Star,
  Heart,
  MessageCircle,
  ExternalLink,
  X,
  Send,
  Plus,
  LogOut,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ccGetMessages,
  ccGetCommunity,
  ccTimeAgo,
  ccFmtCount,
  type CCMessage,
} from "@/lib/coincommunities";
import {
  ccStartXLogin,
  ccGetStoredUser,
  ccClearAuth,
  ccPostMessage,
  ccGetCommunityMembers,
  type CCUser,
} from "@/lib/ccAuth";
import { supabase } from "@/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const CC_CALLBACK_URL = `${window.location.origin}/cc-callback`;
const SORT_TABS = [
  { id: "top", label: "Top", Icon: Star },
  { id: "recent", label: "Recent", Icon: MessageSquare },
  { id: "media", label: "Media", Icon: ImageIcon },
  { id: "members", label: "Members", Icon: Users },
] as const;
type SortTab = (typeof SORT_TABS)[number]["id"];

// ─── Sub-components ───────────────────────────────────────────────────────────

const PostCard = ({ msg }: { msg: CCMessage }) => (
  <div className="flex gap-3 px-4 py-4 border-b border-white/[0.06] active:bg-white/[0.02] transition-colors">
    <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden ring-1 ring-white/10">
      {msg.profileImageUrl ? (
        <img src={msg.profileImageUrl} alt={msg.username} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-[#0e2233] grid place-items-center font-bold text-xs text-og-cyan">
          {(msg.username ?? "?").slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="font-semibold text-white text-[13px]">{msg.displayName || msg.username}</span>
        {msg.followerCount > 500 && (
          <span className="text-og-cyan text-[9px] font-mono">{ccFmtCount(msg.followerCount)} followers</span>
        )}
        <span className="text-white/30 text-[10px] font-mono ml-auto">{ccTimeAgo(msg.createdAt)}</span>
      </div>
      <p className="text-white/80 text-[13px] leading-relaxed break-words">{msg.content}</p>
      {msg.mediaUrl && (
        <div className="mt-2 rounded-xl overflow-hidden max-h-52 border border-white/[0.07]">
          <img src={msg.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="flex items-center gap-4 mt-2.5">
        <button className="flex items-center gap-1 text-white/30 hover:text-red-400 transition-colors text-[11px]">
          <Heart className="h-3.5 w-3.5" />{ccFmtCount(msg.likeCount)}
        </button>
        <button className="flex items-center gap-1 text-white/30 hover:text-og-cyan transition-colors text-[11px]">
          <MessageCircle className="h-3.5 w-3.5" />{ccFmtCount(msg.replyCount)}
        </button>
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

const MemberRow = ({ member }: { member: { displayName: string; username: string; profileImageUrl?: string | null; followerCount: number; messageCount: number; twitterUrl: string } }) => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05]">
    <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10">
      {member.profileImageUrl ? (
        <img src={member.profileImageUrl} alt={member.displayName} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full bg-[#0e2233] grid place-items-center text-xs font-bold text-og-cyan">
          {member.displayName?.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-white text-[12px] truncate">{member.displayName}</div>
      <div className="text-white/35 text-[10px] font-mono truncate">@{member.username}</div>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-white/30 font-mono text-[9px]">
        <MessageSquare className="h-2.5 w-2.5 inline mr-0.5" />{ccFmtCount(member.messageCount)}
      </span>
      <a href={member.twitterUrl} target="_blank" rel="noreferrer" className="text-white/20 hover:text-og-cyan transition-colors">
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  </div>
);

// ─── Compose modal ────────────────────────────────────────────────────────────

interface ComposeModalProps {
  tokenAddress: string;
  tokenSymbol: string;
  user: CCUser;
  onClose: () => void;
  onPosted: () => void;
}

const ComposeModal = ({ tokenAddress, tokenSymbol, user, onClose, onPosted }: ComposeModalProps) => {
  const [text, setText] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [step, setStep] = useState<"compose" | "wallet">("compose");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Auto-read wallet address from the user's OG Scan profile
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return;
      supabase
        .from("profiles")
        .select("wallet_address, sol_wallet")
        .eq("user_id", authUser.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const addr = data.wallet_address || data.sol_wallet || "";
            if (addr) setWalletAddress(addr);
          }
        });
    });
  }, []);

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => ccPostMessage(tokenAddress, text.trim(), walletAddress),
    onSuccess: () => { onPosted(); onClose(); },
    onError: (e: Error) => {
      if (e.message?.includes("wallet") || e.message?.includes("linked") || e.message?.includes("balance")) {
        setStep("wallet");
        setError(e.message);
      } else {
        setError(e.message ?? "Post failed");
      }
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0a1628] rounded-2xl border border-white/[0.08] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07]">
          <div className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/10">
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-og-cyan/20 grid place-items-center text-og-cyan font-bold text-xs">
                {user.displayName?.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="text-white font-semibold text-[13px]">{user.displayName}</div>
            <div className="text-white/40 text-[10px] font-mono">@{user.username}</div>
          </div>
          <button onClick={onClose} className="ml-auto text-white/30 hover:text-white/70 transition-colors p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === "compose" ? (
          <>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`What's happening with $${tokenSymbol}?`}
              maxLength={500}
              rows={4}
              className="w-full bg-transparent px-4 py-3 text-white/90 text-[14px] placeholder:text-white/25 resize-none outline-none leading-relaxed"
            />
            {error && (
              <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-red-400 text-[11px]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.07]">
              <span className="text-white/25 font-mono text-[10px]">{text.length}/500</span>
              <button
                onClick={() => submit()}
                disabled={!text.trim() || isPending}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-og-lime text-black font-bold text-[12px] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Post
              </button>
            </div>
          </>
        ) : (
          /* Wallet required step */
          <div className="px-4 py-5">
            <div className="flex items-center gap-2 mb-3 text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-[12px] font-semibold">Wallet required to post</span>
            </div>
            <p className="text-white/50 text-[12px] mb-4 leading-relaxed">
              You must hold <span className="text-og-lime font-bold">${tokenSymbol}</span> tokens to post in this community.
              {walletAddress ? " We detected your linked wallet below." : " Enter your Solana wallet address to verify your balance."}
            </p>
            <div className="relative mb-3">
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value.trim())}
                placeholder="Your Solana wallet address"
                className={cn(
                  "w-full rounded-xl border bg-white/[0.04] px-3 py-2.5 text-white/90 text-[12px] font-mono placeholder:text-white/20 outline-none transition-colors",
                  walletAddress ? "border-og-lime/40 focus:border-og-lime/60" : "border-white/10 focus:border-og-lime/40",
                )}
              />
              {walletAddress && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-og-lime" />
              )}
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-red-400 text-[11px] mb-3">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 font-mono text-[11px] uppercase tracking-widest hover:border-white/20 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => { setError(""); submit(); }}
                disabled={!walletAddress || isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-og-lime text-black font-bold text-[12px] uppercase tracking-wider disabled:opacity-40 transition-all"
              >
                {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Verify & Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface CoinCommunityFullProps {
  tokenAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  tokenImageUrl?: string;
  marketCap?: number;
  priceChange?: number;
  description?: string;
  /** Whether this is embedded in the coin dialog (compact header) vs. standalone page */
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
  const [showCompose, setShowCompose] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [ccUser, setCcUser] = useState<CCUser | null>(() => ccGetStoredUser());

  // Keep in sync with global X auth changes (e.g. user connects in Settings)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ user: CCUser | null }>).detail;
      setCcUser(detail.user);
    };
    window.addEventListener("cc-auth-changed", handler);
    return () => window.removeEventListener("cc-auth-changed", handler);
  }, []);
  const qc = useQueryClient();

  // ── Queries ─────────────────────────────────────────────────────────────────

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
    refetchInterval: 30_000,
    enabled: activeTab !== "members",
  });

  const { data: members = [], isFetching: loadingMembers } = useQuery({
    queryKey: ["cc-members", tokenAddress],
    queryFn: () => ccGetCommunityMembers(tokenAddress, 50),
    staleTime: 60_000,
    enabled: activeTab === "members",
  });

  // ── Auth ─────────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    ccClearAuth();
    setCcUser(null);
    window.dispatchEvent(new CustomEvent("cc-auth-changed", { detail: { user: null } }));
  }, []);

  const handleFabClick = useCallback(() => {
    if (!ccUser) { setShowAuthPrompt(true); return; }
    setShowCompose(true);
  }, [ccUser]);

  const handlePosted = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["cc-messages", tokenAddress] });
    void refetchMsgs();
  }, [qc, tokenAddress, refetchMsgs]);

  // ── Filtered posts ────────────────────────────────────────────────────────────

  const mediaMessages = messages.filter((m) => !!m.mediaUrl);
  const displayMessages = activeTab === "media" ? mediaMessages : messages;

  // ── Render ────────────────────────────────────────────────────────────────────

  const postCount = (community as { postCount?: number } | null)?.postCount ?? messages.length;
  const memberCount = (community as { memberCount?: number } | null)?.memberCount ?? 0;

  return (
    <div className="flex flex-col h-full relative bg-background">
      {/* ── Token header (matches screenshot) ── */}
      {!embedded && (
        <div className="px-4 pt-4 pb-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            {/* Token avatar */}
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
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-white text-base">{tokenName ?? tokenSymbol}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {marketCap != null && (
                  <span className="text-white/60 font-mono text-[11px]">
                    ${marketCap >= 1_000_000
                      ? `${(marketCap / 1_000_000).toFixed(2)}M`
                      : marketCap >= 1_000
                      ? `${(marketCap / 1_000).toFixed(2)}K`
                      : marketCap.toFixed(2)} MC
                  </span>
                )}
                {priceChange != null && (
                  <span className={cn("font-mono text-[11px] font-bold", priceChange >= 0 ? "text-og-lime" : "text-red-400")}>
                    {priceChange >= 0 ? "↑" : "↓"}{Math.abs(priceChange).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            {/* Auth state */}
            {ccUser ? (
              <button onClick={handleLogout} className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/10 px-2.5 py-1.5 text-white/40 hover:text-white/70 transition-colors">
                <img src={ccUser.profileImageUrl ?? ""} alt="" className="w-4 h-4 rounded-full" />
                <LogOut className="h-3 w-3" />
              </button>
            ) : (
              <button
                onClick={() => setShowAuthPrompt(true)}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/50 hover:border-og-lime/30 hover:text-og-lime transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
          {description && (
            <p className="text-white/55 text-[12px] leading-relaxed mt-2.5 line-clamp-2">{description}</p>
          )}
        </div>
      )}

      {/* Compact auth bar when embedded */}
      {embedded && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-white/50 font-mono text-[10px] uppercase tracking-widest">
              ${tokenSymbol} Community
            </span>
            <span className="text-white/25 font-mono text-[9px]">· {ccFmtCount(postCount)} posts</span>
          </div>
          {ccUser ? (
            <button onClick={handleLogout} title="Disconnect X" className="text-white/25 hover:text-white/60 transition-colors">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => setShowAuthPrompt(true)}
              className="flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-white/45 hover:border-og-lime/30 hover:text-og-lime transition-colors"
            >
              Post with X
            </button>
          )}
        </div>
      )}

      {/* ── Tab bar + Post button ── */}
      <div className="flex items-center border-b border-white/[0.07] shrink-0">
        {SORT_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex-1 py-3 font-semibold text-[13px] transition-all border-b-2",
              activeTab === id
                ? "text-white border-og-lime"
                : "text-white/35 border-transparent hover:text-white/60",
            )}
          >
            {label}
          </button>
        ))}
        {/* Post button — top right of tab bar */}
        <button
          onClick={handleFabClick}
          className="shrink-0 flex items-center gap-1.5 mx-3 px-3 py-1.5 rounded-xl bg-og-lime text-black font-bold text-[11px] uppercase tracking-wider hover:bg-og-lime/90 active:scale-95 transition-all shadow-lg shadow-og-lime/20"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />
          Post
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Members tab */}
        {activeTab === "members" && (
          loadingMembers && (members as unknown[]).length === 0 ? (
            <div className="flex items-center justify-center py-12 text-white/30 text-sm">Loading...</div>
          ) : (members as unknown[]).length === 0 ? (
            <EmptyState label="No members yet" sub="Be the first to post to join." />
          ) : (
            (members as { displayName: string; username: string; profileImageUrl?: string | null; followerCount: number; messageCount: number; twitterUrl: string }[]).map((m, i) => <MemberRow key={i} member={m} />)
          )
        )}

        {/* Posts (Top / Recent / Media) */}
        {activeTab !== "members" && (
          loadingMsgs && displayMessages.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-white/30 text-sm">Loading...</div>
          ) : displayMessages.length === 0 ? (
            <EmptyState
              label={activeTab === "media" ? "No media posts yet" : "No posts yet"}
              sub={activeTab === "media" ? "Posts with images will appear here." : "Be the first to start the conversation."}
            />
          ) : (
            displayMessages.map((msg) => <PostCard key={msg.id} msg={msg} />)
          )
        )}
        <div className="h-6" />
      </div>

      {/* ── Auth Prompt modal ── */}
      {showAuthPrompt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0a1628] rounded-2xl border border-white/[0.08] p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/10 grid place-items-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </div>
            <h3 className="font-display font-black text-white text-lg mb-1">Connect X to Post</h3>
            <p className="text-white/45 text-[13px] leading-relaxed mb-5">
              Sign in with X (Twitter) to post in the <span className="text-og-lime font-semibold">${tokenSymbol}</span> community. You must hold tokens to post.
            </p>
            <button
              onClick={() => { window.location.href = "/settings?tab=connections"; }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-bold text-[14px] hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-black"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.213 5.567zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              Connect X in Settings
            </button>
            <button
              onClick={() => setShowAuthPrompt(false)}
              className="mt-3 w-full py-2.5 rounded-xl border border-white/10 text-white/40 font-mono text-[11px] uppercase tracking-widest hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Compose modal ── */}
      {showCompose && ccUser && (
        <ComposeModal
          tokenAddress={tokenAddress}
          tokenSymbol={tokenSymbol}
          user={ccUser}
          onClose={() => setShowCompose(false)}
          onPosted={handlePosted}
        />
      )}
    </div>
  );
};

// ─── Empty state ───────────────────────────────────────────────────────────────
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

export default CoinCommunityFull;
