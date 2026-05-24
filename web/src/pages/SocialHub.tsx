/**
 * SocialHub — Premium Discord-style community hub for OG Scan.
 * Channels: activity-feed, general-chat, voice-rooms, live-stream
 * Voice powered by LiveKit (real audio). Chat powered by Supabase Realtime.
 * Presence powered by Supabase Realtime Presence.
 * Branded with OG Scan design tokens (og-ink, og-lime, og-gold, og-cyan).
 * Rendered inline inside Index.tsx — do NOT wrap in AppLayout.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Zap, Hash, Volume2, Radio, Users, Send, Phone,
  Plus, Mic, MicOff, Video, VideoOff, Monitor,
  MessageSquare, ChevronRight, Headphones, Eye, PhoneOff,
  Settings, Shield, Crown, Search, Bell, BellOff,
  UserPlus, X, MoreVertical, Smile, Image as ImageIcon,
  ArrowDown, Pin, Trash2, Copy, Reply, Heart,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useLiveKit } from "@/hooks/useLiveKit";
import { cn } from "@/lib/utils";
import { safeAvatarUrl } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type ChannelId = "activity-feed" | "general-chat" | "voice-rooms" | "live-stream";
type VoiceSubTab = "lobby" | "people" | "rooms";

interface CommunityMember {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean;
}

interface ChatMessage {
  id: string;
  channel: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

interface VoiceRoom {
  id: string;
  name: string;
  created_by: string;
  creator_username: string | null;
  participant_count: number;
  created_at: string;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

const dicebear = (seed: string) =>
  `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

const avatarSrc = (url: string | null | undefined, fallback: string) =>
  safeAvatarUrl(url) || dicebear(fallback);

const CHANNELS: { id: ChannelId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "activity-feed", label: "activity-feed", icon: Zap },
  { id: "general-chat", label: "general-chat", icon: Hash },
  { id: "voice-rooms", label: "voice-rooms", icon: Volume2 },
  { id: "live-stream", label: "live-stream", icon: Radio },
];

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

const SocialHub = () => {
  const { user, profile } = useAuth();
  const [activeChannel, setActiveChannel] = useState<ChannelId>("activity-feed");
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [onlinePresenceMap, setOnlinePresenceMap] = useState<
    Record<string, { user_id: string; username: string; avatar_url: string | null }>
  >({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* Fetch all community members */
  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) {
        setMembers(data.map((p: any) => ({
          user_id: p.user_id,
          username: p.username,
          avatar_url: p.avatar_url,
          is_online: false,
        })));
      }
    };
    fetchMembers();
  }, []);

  /* Real presence tracking */
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("social-presence", {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        const pMap: typeof onlinePresenceMap = {};
        for (const [, entries] of Object.entries(state)) {
          const entry = (entries as any[])[0];
          if (entry?.user_id) {
            ids.add(entry.user_id);
            pMap[entry.user_id] = {
              user_id: entry.user_id,
              username: entry.username || "Anon",
              avatar_url: entry.avatar_url || null,
            };
          }
        }
        setOnlineIds(ids);
        setOnlinePresenceMap(pMap);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            username: profile?.username || "Anon",
            avatar_url: profile?.avatar_url,
            online_at: new Date().toISOString(),
          });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [user, profile]);

  const onlineCount = onlineIds.size;

  const activeMembersList: CommunityMember[] = Object.values(onlinePresenceMap).map((p) => ({
    user_id: p.user_id,
    username: p.username,
    avatar_url: p.avatar_url,
    is_online: true,
  }));

  const enrichedMembers = members.map((m) => ({
    ...m,
    is_online: onlineIds.has(m.user_id),
  }));

  // Sort: online first
  const sortedMembers = useMemo(() =>
    [...enrichedMembers].sort((a, b) => (a.is_online === b.is_online ? 0 : a.is_online ? -1 : 1)),
    [enrichedMembers]
  );

  /* ═══════════════════════════════════════════════════════════════
     Layout: 3-column Discord style
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0a1018]">
      {/* LEFT — Channel Sidebar */}
      <div className={cn(
        "flex flex-col border-r border-white/[0.06] bg-[#0c1320] transition-all duration-200",
        sidebarCollapsed ? "w-0 overflow-hidden md:w-14" : "w-56 min-w-[14rem]",
        "hidden md:flex",
      )}>
        {/* Hub header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-og-lime/30 to-og-gold/20">
              <Zap className="h-3.5 w-3.5 text-og-lime" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h2 className="text-xs font-black tracking-wider text-white">SOCIALHUB</h2>
                <p className="text-[9px] text-og-lime">{onlineCount} online</p>
              </div>
            )}
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <p className="mb-2 px-2 text-[8px] font-bold uppercase tracking-[0.2em] text-white/20">
            Channels
          </p>
          {CHANNELS.map((ch) => {
            const isActive = activeChannel === ch.id;
            const Icon = ch.icon;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={cn(
                  "group mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-white/35 hover:bg-white/[0.04] hover:text-white/60",
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-og-lime" : "")} />
                {!sidebarCollapsed && (
                  <span className="truncate text-[11px] font-semibold">{ch.label}</span>
                )}
                {ch.id === "voice-rooms" && onlineCount > 0 && (
                  <span className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-og-lime/15 px-1 text-[8px] font-bold text-og-lime">
                    {onlineCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Online members in sidebar */}
        {!sidebarCollapsed && (
          <div className="border-t border-white/[0.06] px-3 py-3">
            <p className="mb-2 text-[8px] font-bold uppercase tracking-[0.2em] text-white/20">
              Active — {activeMembersList.length}
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {activeMembersList.slice(0, 12).map((m) => (
                <div key={m.user_id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/[0.03]">
                  <div className="relative flex-shrink-0">
                    <img
                      src={avatarSrc(m.avatar_url, m.username || m.user_id)}
                      alt="" className="h-6 w-6 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = dicebear("fallback"); }}
                    />
                    <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-[#0c1320] bg-og-lime" />
                  </div>
                  <span className="truncate text-[10px] font-medium text-white/50">
                    {m.user_id === user?.id ? "You" : m.username || "Anon"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User footer */}
        <div className="border-t border-white/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <img
                src={avatarSrc(profile?.avatar_url, profile?.username || user?.id || "me")}
                alt="" className="h-8 w-8 rounded-full border border-white/10 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = dicebear("me"); }}
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0c1320] bg-og-lime" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-white">{profile?.username || "You"}</p>
                <p className="text-[9px] text-og-lime">Online</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile channel bar */}
      <div className="flex w-full flex-col md:hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-white/[0.07] bg-[#0c1320] px-3 py-2 scrollbar-none">
          {CHANNELS.map((ch) => {
            const isActive = activeChannel === ch.id;
            const Icon = ch.icon;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={cn(
                  "flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold transition",
                  isActive
                    ? "bg-gradient-to-r from-og-lime/80 to-og-gold/70 text-black"
                    : "bg-white/[0.04] text-white/40",
                )}
              >
                <Icon className="h-3 w-3" />
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTER — Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {activeChannel === "activity-feed" && (
            <ActivityFeed
              members={sortedMembers}
              activeMembersList={activeMembersList}
              onlineCount={onlineCount}
              onSwitchChannel={setActiveChannel}
            />
          )}
          {activeChannel === "general-chat" && <GeneralChat />}
          {activeChannel === "voice-rooms" && <VoiceRooms members={sortedMembers} />}
          {activeChannel === "live-stream" && <LiveStream />}
        </div>
      </div>

      {/* RIGHT — Active Members (desktop) */}
      <div className="hidden w-56 flex-col border-l border-white/[0.06] bg-[#0c1320] lg:flex">
        <div className="border-b border-white/[0.07] px-4 py-3">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
            Members — {enrichedMembers.length}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {/* Online section */}
          {activeMembersList.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-og-lime/60">
                Online — {activeMembersList.length}
              </p>
              {activeMembersList.map((m) => (
                <div key={m.user_id} className="mb-0.5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.03]">
                  <div className="relative flex-shrink-0">
                    <img
                      src={avatarSrc(m.avatar_url, m.username || m.user_id)}
                      alt="" className="h-7 w-7 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = dicebear("fallback"); }}
                    />
                    <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-[#0c1320] bg-og-lime" />
                  </div>
                  <span className="truncate text-[10px] font-semibold text-white/60">
                    {m.user_id === user?.id ? "You" : m.username || "Anon"}
                  </span>
                </div>
              ))}
            </div>
          )}
          {/* Offline section */}
          {sortedMembers.filter((m) => !m.is_online).length > 0 && (
            <div>
              <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.2em] text-white/15">
                Offline — {sortedMembers.filter((m) => !m.is_online).length}
              </p>
              {sortedMembers.filter((m) => !m.is_online).slice(0, 20).map((m) => (
                <div key={m.user_id} className="mb-0.5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 opacity-40">
                  <img
                    src={avatarSrc(m.avatar_url, m.username || m.user_id)}
                    alt="" className="h-7 w-7 rounded-full object-cover grayscale"
                    onError={(e) => { (e.target as HTMLImageElement).src = dicebear("fallback"); }}
                  />
                  <span className="truncate text-[10px] font-semibold text-white/40">
                    {m.username || "Anon"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Activity Feed
   ═══════════════════════════════════════════════════════════════ */

interface ActivityFeedProps {
  members: CommunityMember[];
  activeMembersList: CommunityMember[];
  onlineCount: number;
  onSwitchChannel: (ch: ChannelId) => void;
}

const ActivityFeed = ({ members, activeMembersList, onlineCount, onSwitchChannel }: ActivityFeedProps) => {
  const { user } = useAuth();
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from("social_messages")
        .select("*")
        .eq("channel", "social-general")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setRecentMessages(data.reverse());
    };
    fetchRecent();
  }, []);

  return (
    <div className="p-4 md:p-6">
      {/* Active Now */}
      {activeMembersList.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
            <span className="h-1.5 w-1.5 rounded-full bg-og-lime shadow-[0_0_6px_hsl(var(--og-lime))]" />
            Active Now — {activeMembersList.length}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {activeMembersList.map((m) => (
              <div key={m.user_id} className="flex flex-shrink-0 flex-col items-center gap-1.5">
                <div className="relative">
                  <img
                    src={avatarSrc(m.avatar_url, m.username || m.user_id)}
                    alt="" className="h-11 w-11 rounded-full border-2 border-og-lime/30 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = dicebear("fb"); }}
                  />
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0a1018] bg-og-lime" />
                </div>
                <span className="max-w-[56px] truncate text-[9px] font-semibold text-white/50">
                  {m.user_id === user?.id ? "You" : m.username || "Anon"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-6">
        <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { label: "Voice Lobby", desc: "Join live voice chat", icon: Volume2, color: "og-lime", channel: "voice-rooms" as ChannelId },
            { label: "Chat Room", desc: "Message the community", icon: MessageSquare, color: "og-cyan", channel: "general-chat" as ChannelId },
            { label: "Go Live", desc: "Start streaming", icon: Radio, color: "red-400", channel: "live-stream" as ChannelId },
            { label: "Voice Rooms", desc: "Create private rooms", icon: Headphones, color: "og-gold", channel: "voice-rooms" as ChannelId },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => onSwitchChannel(action.channel)}
              className="group flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.04]"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-${action.color}/10 transition group-hover:bg-${action.color}/20`}>
                <action.icon className={`h-5 w-5 text-${action.color}`} />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-bold text-white">{action.label}</p>
                <p className="text-[9px] text-white/25">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Chat */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">Recent Chat</h3>
          <button
            onClick={() => onSwitchChannel("general-chat")}
            className="flex items-center gap-1 text-[10px] font-bold text-og-lime/70 transition hover:text-og-lime"
          >
            View All <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        {recentMessages.length === 0 ? (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-6 text-center">
            <MessageSquare className="mx-auto mb-2 h-6 w-6 text-white/10" />
            <p className="text-[11px] text-white/25">No messages yet — be the first!</p>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
            {recentMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.02]">
                <img
                  src={avatarSrc(msg.avatar_url, msg.username || msg.user_id)}
                  alt="" className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = dicebear("fb"); }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold text-og-cyan">{msg.username || "Anon"}</span>
                    <span className="text-[8px] text-white/20">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/60">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Community Stats */}
      <div>
        <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">Community</h3>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Members", value: members.length, color: "og-cyan" },
            { label: "Online", value: onlineCount, color: "og-lime" },
            { label: "Messages", value: recentMessages.length, color: "og-gold" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <p className={`text-lg font-black text-${stat.color}`}>{stat.value}</p>
              <p className="text-[9px] font-bold uppercase text-white/25">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   General Chat — Real-time Supabase chat
   ═══════════════════════════════════════════════════════════════ */

const GeneralChat = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
  }, []);

  /* Fetch messages */
  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("social_messages")
        .select("*")
        .eq("channel", "social-general")
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) setMessages(data);
      setLoading(false);
      setTimeout(() => scrollToBottom(false), 50);
    };
    fetchMessages();
  }, [scrollToBottom]);

  /* Real-time subscription */
  useEffect(() => {
    const channel = supabase
      .channel("social-chat-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "social_messages", filter: "channel=eq.social-general" },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Auto-scroll if near bottom
          if (scrollRef.current) {
            const el = scrollRef.current;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            if (nearBottom || msg.user_id === user?.id) {
              setTimeout(() => scrollToBottom(), 50);
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, scrollToBottom]);

  /* Scroll tracking */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      setShowScrollBtn(!nearBottom);
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  /* Send message */
  const sendMessage = async () => {
    if (!input.trim() || !user || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    const { error } = await supabase.from("social_messages").insert({
      channel: "social-general",
      user_id: user.id,
      username: profile?.username || "Anon",
      avatar_url: profile?.avatar_url,
      content,
    });
    if (error) {
      toast.error("Failed to send message");
      setInput(content);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Hash className="h-4 w-4 text-white/40" />
          <span className="text-sm font-black tracking-wide text-white">general-chat</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/25">{messages.length} messages</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-og-lime border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <MessageSquare className="mb-3 h-12 w-12 text-white/[0.06]" />
            <p className="text-sm font-bold text-white/20">No messages yet</p>
            <p className="mt-1 text-[11px] text-white/12">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map((msg, i) => {
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const sameSender = prevMsg?.user_id === msg.user_id;
              const timeDiff = prevMsg
                ? (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) / 60000
                : 999;
              const compact = sameSender && timeDiff < 5;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "group flex items-start gap-3 rounded-lg px-2 py-1 transition hover:bg-white/[0.02]",
                    !compact && i > 0 && "mt-3",
                  )}
                >
                  {compact ? (
                    <div className="w-8 flex-shrink-0" />
                  ) : (
                    <img
                      src={avatarSrc(msg.avatar_url, msg.username || msg.user_id)}
                      alt="" className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = dicebear("fb"); }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {!compact && (
                      <div className="flex items-baseline gap-2">
                        <span className={cn(
                          "text-[11px] font-bold",
                          msg.user_id === user?.id ? "text-og-lime" : "text-og-cyan",
                        )}>
                          {msg.user_id === user?.id ? "You" : msg.username || "Anon"}
                        </span>
                        <span className="text-[9px] text-white/15">
                          {format(new Date(msg.created_at), "h:mm a")}
                        </span>
                      </div>
                    )}
                    <p className="text-[12px] leading-relaxed text-white/70">{msg.content}</p>
                  </div>
                  {/* Hover actions */}
                  <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button className="rounded p-1 text-white/20 hover:bg-white/[0.06] hover:text-white/40">
                      <Heart className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied!"); }}
                      className="rounded p-1 text-white/20 hover:bg-white/[0.06] hover:text-white/40"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Scroll to bottom */}
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-og-lime/20 p-2 text-og-lime shadow-lg transition hover:bg-og-lime/30"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message #general-chat"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 outline-none"
            disabled={!user}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !user || sending}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition",
              input.trim()
                ? "bg-og-lime text-black hover:bg-og-lime/80"
                : "text-white/15",
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {!user && (
          <p className="mt-1.5 text-center text-[10px] text-white/25">Sign in to send messages</p>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Voice Rooms — LiveKit-powered voice chat
   ═══════════════════════════════════════════════════════════════ */

const VoiceRooms = ({ members }: { members: CommunityMember[] }) => {
  const { user, profile } = useAuth();
  const [subTab, setSubTab] = useState<VoiceSubTab>("lobby");
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomName, setActiveRoomName] = useState<string>("social-voice-lobby");

  /* LiveKit for voice (one instance, switches between lobby and rooms) */
  const voice = useLiveKit({
    roomName: activeRoomName,
    identity: user?.id || "",
    displayName: profile?.username || "Anon",
  });

  const isInLobby = voice.connected && activeRoomName === "social-voice-lobby";
  const isInRoom = voice.connected && activeRoomId !== null;

  /* Fetch voice rooms */
  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase
        .from("social_voice_rooms")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setRooms(data);
    };
    fetchRooms();

    // Realtime updates for rooms
    const channel = supabase
      .channel("social-rooms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_voice_rooms" },
        () => fetchRooms(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const joinLobby = async () => {
    if (isInLobby) {
      await voice.leave();
      setActiveRoomId(null);
      return;
    }
    // Switch to lobby
    if (voice.connected) await voice.leave();
    setActiveRoomId(null);
    setActiveRoomName("social-voice-lobby");
    // Small delay for state to settle
    setTimeout(() => voice.join(), 50);
  };

  const joinRoom = async (room: VoiceRoom) => {
    if (voice.connected) await voice.leave();
    setActiveRoomId(room.id);
    setActiveRoomName(`social-room-${room.id}`);
    setTimeout(() => voice.join(), 50);
    toast.success(`Joining "${room.name}"...`);
  };

  const leaveVoice = async () => {
    await voice.leave();
    setActiveRoomId(null);
    setActiveRoomName("social-voice-lobby");
  };

  const createRoom = async () => {
    if (!user) return;
    const name = window.prompt("Room name:");
    if (!name?.trim()) return;
    const { error } = await supabase.from("social_voice_rooms").insert({
      name: name.trim(),
      created_by: user.id,
      creator_username: profile?.username || "Anon",
      participant_count: 0,
    });
    if (error) toast.error("Failed to create room");
    else toast.success("Room created!");
  };

  const VOICE_SUB_TABS: { id: VoiceSubTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "lobby", label: "Lobby", Icon: Volume2 },
    { id: "people", label: "People", Icon: Users },
    { id: "rooms", label: "Rooms", Icon: Headphones },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.07] px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="h-4 w-4 text-white/40" />
            <span className="text-sm font-black tracking-wide text-white">voice-rooms</span>
          </div>
          <span className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
            voice.connected ? "bg-og-lime/15 text-og-lime" : "bg-white/[0.05] text-white/30",
          )}>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              voice.connected ? "bg-og-lime animate-pulse" : "bg-white/20",
            )} />
            {voice.connected ? "connected" : "offline"}
          </span>
        </div>
        <div className="flex gap-1.5">
          {VOICE_SUB_TABS.map((t) => {
            const isActive = subTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide transition",
                  isActive
                    ? "bg-gradient-to-r from-og-lime/80 to-og-gold/70 text-black shadow-lg"
                    : "text-white/40 hover:bg-white/5 hover:text-white/60",
                )}
              >
                <t.Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active voice control bar */}
      {voice.connected && (
        <div className="border-b border-og-lime/20 bg-og-lime/[0.04] px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-lime opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-og-lime" />
              </span>
              <div>
                <p className="text-[10px] font-bold text-og-lime">
                  {isInLobby ? "VOICE LOBBY" : `ROOM: ${rooms.find((r) => r.id === activeRoomId)?.name || "..."}`}
                </p>
                <p className="text-[9px] text-white/30">{voice.participantCount} connected</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={voice.toggleMute}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition",
                  voice.muted
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-og-lime/20 text-og-lime hover:bg-og-lime/30",
                )}
                title={voice.muted ? "Unmute" : "Mute"}
              >
                {voice.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={leaveVoice}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition hover:bg-red-500/30"
                title="Disconnect"
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Participant avatars */}
          {voice.participants.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {voice.participants.map((p) => (
                <div key={p.identity} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "relative h-9 w-9 overflow-hidden rounded-full border-2 transition-all",
                    p.isSpeaking ? "border-og-lime shadow-[0_0_12px_hsl(var(--og-lime)/0.5)]" : "border-white/10",
                  )}>
                    <img src={dicebear(p.name)} alt="" className="h-full w-full object-cover" />
                    {p.isMuted && (
                      <div className="absolute inset-0 flex items-end justify-end">
                        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500">
                          <MicOff className="h-2 w-2 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="max-w-[48px] truncate text-[8px] font-semibold text-white/40">
                    {p.isLocal ? "You" : p.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {voice.error && (
        <div className="mx-4 mt-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5">
          <p className="text-[10px] text-red-400">{voice.error}</p>
          <button onClick={() => voice.join()} className="mt-1 text-[9px] font-bold text-og-lime underline">
            Retry
          </button>
        </div>
      )}

      {/* Sub-tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {subTab === "lobby" && (
          <div>
            {/* Lobby card */}
            <div className={cn(
              "rounded-xl border p-5 transition",
              isInLobby ? "border-og-lime/30 bg-og-lime/[0.06]" : "border-og-lime/15 bg-og-lime/[0.03]",
            )}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={cn(
                    "h-3 w-3 rounded-full",
                    isInLobby ? "bg-og-lime shadow-[0_0_10px_hsl(var(--og-lime))] animate-pulse" : "bg-og-lime/50",
                  )} />
                  <h3 className="text-sm font-black text-white">VOICE LOBBY</h3>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold text-white/40">
                  {isInLobby ? voice.participantCount : 0} here
                </span>
              </div>
              <p className="mb-5 text-[11px] text-white/40">
                Community voice channel powered by LiveKit. Talk live with OG Scan traders.
              </p>

              {!user ? (
                <p className="text-center text-[11px] text-white/25">Sign in to join voice</p>
              ) : (
                <button
                  onClick={joinLobby}
                  disabled={voice.connecting}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-50",
                    isInLobby
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-gradient-to-r from-og-lime/80 to-og-gold/60 text-black hover:shadow-[0_0_20px_hsl(var(--og-lime)/0.3)]",
                  )}
                >
                  {voice.connecting ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Connecting...</>
                  ) : isInLobby ? (
                    <><PhoneOff className="h-4 w-4" /> Leave Voice Lobby</>
                  ) : (
                    <><Phone className="h-4 w-4" /> Join Voice Lobby</>
                  )}
                </button>
              )}
            </div>

            {/* People in lobby */}
            {isInLobby && voice.participants.length > 0 && (
              <div className="mt-5">
                <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  <Users className="h-3 w-3" /> In Lobby — {voice.participantCount}
                </h4>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                  {voice.participants.map((p) => (
                    <div key={p.identity} className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition hover:bg-white/[0.05]">
                      <div className="relative">
                        <div className={cn(
                          "h-14 w-14 overflow-hidden rounded-full border-2 transition-all",
                          p.isSpeaking && !p.isMuted
                            ? "border-og-lime shadow-[0_0_16px_hsl(var(--og-lime)/0.5)]"
                            : p.isMuted ? "border-red-500/30" : "border-white/10",
                        )}>
                          <img src={dicebear(p.name)} alt="" className="h-full w-full object-cover" />
                        </div>
                        <span className={cn(
                          "absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#0a1018]",
                          p.isMuted ? "bg-red-500" : p.isSpeaking ? "bg-og-lime" : "bg-white/20",
                        )}>
                          {p.isMuted ? <MicOff className="h-2 w-2 text-white" /> : <Mic className="h-2 w-2 text-white" />}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block max-w-[80px] truncate text-[10px] font-bold text-white/70">
                          {p.isLocal ? "You" : p.name}
                        </span>
                        <span className={cn(
                          "text-[8px] font-semibold",
                          p.isSpeaking && !p.isMuted ? "text-og-lime" : p.isMuted ? "text-red-400/60" : "text-white/25",
                        )}>
                          {p.isMuted ? "Muted" : p.isSpeaking ? "Speaking" : "Listening"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!voice.connected && (
              <div className="mt-8 flex flex-col items-center py-8">
                <Volume2 className="mb-3 h-10 w-10 text-white/[0.06]" />
                <p className="text-sm font-bold text-white/15">Join the lobby to start talking</p>
                <p className="mt-1 text-[10px] text-white/10">Real-time voice powered by LiveKit</p>
              </div>
            )}
          </div>
        )}

        {subTab === "people" && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              <Users className="h-3 w-3" /> Community Members — {members.length}
            </h4>
            <div className="space-y-1">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={avatarSrc(m.avatar_url, m.username || m.user_id)}
                        alt="" className={cn("h-9 w-9 rounded-full border object-cover", m.is_online ? "border-og-lime/30" : "border-white/10 grayscale-[50%]")}
                        onError={(e) => { (e.target as HTMLImageElement).src = dicebear("fb"); }}
                      />
                      <span className={cn(
                        "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0a1018]",
                        m.is_online ? "bg-og-lime" : "bg-white/15",
                      )} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-og-cyan">@{m.username || "Anon"}</span>
                      <p className={cn("text-[9px]", m.is_online ? "text-og-lime/60" : "text-white/20")}>
                        {m.is_online ? "Online" : "Offline"}
                      </p>
                    </div>
                  </div>
                  <button
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition",
                      m.is_online
                        ? "border border-og-lime/20 bg-og-lime/10 text-og-lime hover:bg-og-lime/20"
                        : "border border-white/[0.06] bg-white/[0.03] text-white/15",
                    )}
                    disabled={!m.is_online}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === "rooms" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  <Headphones className="h-3 w-3" /> Voice Rooms
                </h4>
                <p className="mt-0.5 text-[10px] text-white/25">{rooms.length} rooms</p>
              </div>
              <button
                onClick={createRoom}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-og-lime/80 to-og-gold/60 px-3 py-1.5 text-[10px] font-bold text-black transition hover:shadow-[0_0_16px_hsl(var(--og-lime)/0.3)]"
              >
                <Plus className="h-3 w-3" />
                New Room
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Headphones className="mb-3 h-10 w-10 text-white/10" />
                <p className="text-sm font-bold text-white/25">NO ROOMS YET</p>
                <p className="mt-1 text-[11px] text-white/15">Create a room above to start a conversation</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => {
                  const isInThisRoom = activeRoomId === room.id && voice.connected;
                  return (
                    <div
                      key={room.id}
                      className={cn(
                        "rounded-xl border p-4 transition",
                        isInThisRoom
                          ? "border-og-lime/30 bg-og-lime/[0.06]"
                          : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg",
                            isInThisRoom ? "bg-og-lime/20" : "bg-white/[0.04]",
                          )}>
                            <Headphones className={cn("h-4 w-4", isInThisRoom ? "text-og-lime" : "text-white/25")} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{room.name}</p>
                            <p className="mt-0.5 text-[10px] text-white/30">
                              by @{room.creator_username || "Anon"}
                              {isInThisRoom && ` · ${voice.participantCount} connected`}
                            </p>
                          </div>
                        </div>
                        {isInThisRoom ? (
                          <button
                            onClick={leaveVoice}
                            className="rounded-lg bg-red-500/15 px-3.5 py-1.5 text-[10px] font-bold text-red-400 transition hover:bg-red-500/25"
                          >
                            Leave
                          </button>
                        ) : (
                          <button
                            onClick={() => joinRoom(room)}
                            disabled={voice.connecting}
                            className="rounded-lg bg-og-lime/15 px-3.5 py-1.5 text-[10px] font-bold text-og-lime transition hover:bg-og-lime/25 disabled:opacity-50"
                          >
                            Join
                          </button>
                        )}
                      </div>
                      {/* Show participants when in room */}
                      {isInThisRoom && voice.participants.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                          {voice.participants.map((p) => (
                            <div key={p.identity} className="flex flex-col items-center gap-1">
                              <div className={cn(
                                "h-8 w-8 overflow-hidden rounded-full border",
                                p.isSpeaking ? "border-og-lime shadow-[0_0_8px_hsl(var(--og-lime)/0.4)]" : "border-white/10",
                              )}>
                                <img src={dicebear(p.name)} alt="" className="h-full w-full object-cover" />
                              </div>
                              <span className="text-[8px] text-white/40">{p.isLocal ? "You" : p.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Live Stream — LiveKit streaming
   ═══════════════════════════════════════════════════════════════ */

const LiveStream = () => {
  const { user, profile } = useAuth();
  const [streams, setStreams] = useState<any[]>([]);

  useEffect(() => {
    const fetchStreams = async () => {
      const { data } = await supabase
        .from("social_streams")
        .select("*")
        .eq("is_live", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setStreams(data);
    };
    fetchStreams();

    // Realtime updates
    const channel = supabase
      .channel("social-streams-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_streams" },
        () => fetchStreams(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const goLive = async () => {
    if (!user) return toast.error("Sign in to go live");
    const title = window.prompt("Stream title:");
    if (!title?.trim()) return;

    const { error } = await supabase.from("social_streams").insert({
      host_id: user.id,
      host_username: profile?.username || "Anon",
      title: title.trim(),
      is_live: true,
      viewer_count: 0,
    });
    if (error) toast.error("Failed to start stream");
    else toast.success("You're live! 🔴");
  };

  const endStream = async (streamId: string) => {
    await supabase.from("social_streams").update({ is_live: false }).eq("id", streamId);
    toast.success("Stream ended");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radio className="h-4 w-4 text-white/40" />
            <span className="text-sm font-black tracking-wide text-white">live-stream</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-bold text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            {streams.length} live
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-white">LIVE STREAMS</h3>
            <p className="text-[10px] text-white/30">{streams.length} active</p>
          </div>
          <button
            onClick={goLive}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500/80 to-red-600/80 px-4 py-2 text-[10px] font-bold text-white shadow-lg transition hover:shadow-[0_0_16px_rgba(239,68,68,0.3)]"
          >
            <Radio className="h-3 w-3" />
            Go Live
          </button>
        </div>

        {streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Radio className="mb-3 h-12 w-12 text-white/[0.06]" />
            <p className="text-sm font-bold text-white/20">NO LIVE STREAMS</p>
            <p className="mt-1 text-[11px] text-white/12">Be the first to go live!</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {streams.map((s: any) => {
              const isHost = s.host_id === user?.id;
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 transition hover:bg-red-500/[0.08]"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      <span className="text-[10px] font-bold uppercase text-red-400">Live</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-white/25">
                      <Eye className="h-3 w-3" />
                      {s.viewer_count || 0}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white">{s.title || "Untitled Stream"}</p>
                  <p className="mt-1 text-[10px] text-white/30">by @{s.host_username || "Anon"}</p>
                  {isHost && (
                    <button
                      onClick={() => endStream(s.id)}
                      className="mt-3 w-full rounded-lg bg-red-500/20 py-1.5 text-[10px] font-bold text-red-400 transition hover:bg-red-500/30"
                    >
                      End Stream
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialHub;
