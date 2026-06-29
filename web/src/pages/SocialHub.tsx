/**
 * SocialHub — Premium Discord-style community hub for OrbitX.
 * Channels: activity-feed, general-chat, voice-rooms, live-stream
 * Voice powered by LiveKit (real audio). Chat powered by Supabase Realtime.
 * Presence powered by Supabase Realtime Presence.
 * Branded with OrbitX design tokens (og-ink, og-lime, og-gold, og-cyan).
 * Rendered inline inside Index.tsx — do NOT wrap in AppLayout.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Zap, Hash, Volume2, Radio, Users, Send, Phone,
  Plus, Mic, MicOff, Video, VideoOff, Monitor,
  MessageSquare, ChevronRight, Headphones, Eye, PhoneOff,
  Settings, Shield, Crown, Search, Bell, BellOff,
  UserPlus, X, MoreVertical, Smile, Image as ImageIcon,
  ArrowDown, Pin, Trash2, Copy, Reply, Heart, Pencil, Check, Loader2, MonitorOff,
} from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeAvatarUrl } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  ConnectionState,
} from "livekit-client";
import VoiceToolkit from "@/components/lobbies/VoiceToolkit";

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
  likes_count?: number;
  liked_by?: string[];
  edited_at?: string | null;
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
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* LEFT — Channel Sidebar */}
      <div className={cn(
        "flex flex-col border-r border-white/[0.06] bg-card transition-all duration-200",
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
                    <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-card bg-og-lime" />
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
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-og-lime" />
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

      {/* CENTER — Main Content (includes mobile channel bar) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile channel bar */}
        <div className="flex gap-1 overflow-x-auto border-b border-white/[0.07] bg-card px-3 py-2 scrollbar-none md:hidden">
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
        {activeChannel === "activity-feed" ? (
          <div className="flex-1 overflow-y-auto">
            <ActivityFeed
              members={sortedMembers}
              activeMembersList={activeMembersList}
              onlineCount={onlineCount}
              onSwitchChannel={setActiveChannel}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeChannel === "general-chat" && <GeneralChat />}
            {activeChannel === "voice-rooms" && <VoiceRooms members={sortedMembers} />}
            {activeChannel === "live-stream" && <LiveStream />}
          </div>
        )}
      </div>

      {/* RIGHT — Active Members (desktop) */}
      <div className="hidden w-56 flex-col border-l border-white/[0.06] bg-card lg:flex">
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
                    <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-card bg-og-lime" />
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
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-og-lime" />
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
            { label: "Chat Room", desc: "Message the community", icon: MessageSquare, color: "primary", channel: "general-chat" as ChannelId },
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
                    <span className="text-[10px] font-bold text-primary">{msg.username || "Anon"}</span>
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
            { label: "Members", value: members.length, color: "primary" },
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  /* Real-time subscription — listen for INSERT, UPDATE, DELETE */
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
          if (scrollRef.current) {
            const el = scrollRef.current;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            if (nearBottom || msg.user_id === user?.id) {
              setTimeout(() => scrollToBottom(), 50);
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "social_messages", filter: "channel=eq.social-general" },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "social_messages", filter: "channel=eq.social-general" },
        (payload) => {
          const oldId = (payload.old as any)?.id;
          if (oldId) setMessages((prev) => prev.filter((m) => m.id !== oldId));
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

  /* Focus edit input when editing starts */
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

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
      likes_count: 0,
      liked_by: [],
    });
    if (error) {
      toast.error("Failed to send message");
      setInput(content);
    }
    setSending(false);
  };

  /* Edit message */
  const startEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditText(msg.content);
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    const { error } = await supabase
      .from("social_messages")
      .update({ content: editText.trim(), edited_at: new Date().toISOString() })
      .eq("id", editingId)
      .eq("user_id", user?.id);
    if (error) {
      toast.error("Failed to edit message");
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === editingId ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() } : m)),
      );
    }
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  /* Delete message */
  const deleteMessage = async (msgId: string) => {
    const { error } = await supabase
      .from("social_messages")
      .delete()
      .eq("id", msgId)
      .eq("user_id", user?.id);
    if (error) {
      toast.error("Failed to delete message");
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      toast.success("Message deleted");
    }
  };

  /* Like / unlike message */
  const toggleLike = async (msg: ChatMessage) => {
    if (!user) return;
    const likedBy = msg.liked_by || [];
    const alreadyLiked = likedBy.includes(user.id);
    const newLikedBy = alreadyLiked ? likedBy.filter((id) => id !== user.id) : [...likedBy, user.id];
    const newCount = newLikedBy.length;

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, liked_by: newLikedBy, likes_count: newCount } : m)),
    );

    const { error } = await supabase
      .from("social_messages")
      .update({ liked_by: newLikedBy, likes_count: newCount })
      .eq("id", msg.id);
    if (error) {
      // Revert on error
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, liked_by: likedBy, likes_count: likedBy.length } : m)),
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
              const isOwn = msg.user_id === user?.id;
              const isEditing = editingId === msg.id;
              const likedBy = msg.liked_by || [];
              const likesCount = msg.likes_count || likedBy.length;
              const isLiked = user ? likedBy.includes(user.id) : false;

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
                          isOwn ? "text-og-lime" : "text-primary",
                        )}>
                          {isOwn ? "You" : msg.username || "Anon"}
                        </span>
                        <span className="text-[9px] text-white/15">
                          {format(new Date(msg.created_at), "h:mm a")}
                        </span>
                        {msg.edited_at && (
                          <span className="text-[8px] text-white/10 italic">(edited)</span>
                        )}
                      </div>
                    )}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          className="min-w-0 flex-1 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-[12px] text-white/80 outline-none focus:border-primary/50"
                        />
                        <button onClick={saveEdit} className="rounded p-1 text-og-lime hover:bg-og-lime/10">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={cancelEdit} className="rounded p-1 text-white/30 hover:bg-white/[0.06] hover:text-white/50">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[12px] leading-relaxed text-white/70">{msg.content}</p>
                        {/* Like count badge */}
                        {likesCount > 0 && (
                          <button
                            onClick={() => toggleLike(msg)}
                            className={cn(
                              "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold transition-colors",
                              isLiked
                                ? "border-pink-500/30 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20"
                                : "border-white/[0.08] bg-white/[0.03] text-white/30 hover:bg-white/[0.06] hover:text-white/50",
                            )}
                          >
                            <Heart className={cn("h-2.5 w-2.5", isLiked && "fill-pink-400")} />
                            {likesCount}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {/* Hover actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => toggleLike(msg)}
                        className={cn(
                          "rounded p-1 transition",
                          isLiked
                            ? "text-pink-400 hover:bg-pink-500/10"
                            : "text-white/20 hover:bg-white/[0.06] hover:text-white/40",
                        )}
                      >
                        <Heart className={cn("h-3 w-3", isLiked && "fill-pink-400")} />
                      </button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied!"); }}
                        className="rounded p-1 text-white/20 hover:bg-white/[0.06] hover:text-white/40"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {isOwn && (
                        <>
                          <button
                            onClick={() => startEdit(msg)}
                            className="rounded p-1 text-white/20 hover:bg-white/[0.06] hover:text-white/40"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className="rounded p-1 text-white/20 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
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
   Voice Rooms — LiveKit-powered voice chat (direct Room API)
   ═══════════════════════════════════════════════════════════════ */

const LK_URL = "wss://new-7unnd5e1.livekit.cloud";
const COMMUNITY_LIVE_ROOM = "orbitx-community-live";

interface VoiceParticipantInfo {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isLocal: boolean;
}

const VoiceRooms = ({ members }: { members: CommunityMember[] }) => {
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const [subTab, setSubTab] = useState<VoiceSubTab>("lobby");
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);

  /* Connection state */
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<VoiceParticipantInfo[]>([]);
  const [activeRoomLabel, setActiveRoomLabel] = useState<string | null>(null); // "lobby" | room id
  const roomRef = useRef<Room | null>(null);
  const mountedRef = useRef(true);

  /* Room creation state */
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  const isInLobby = connected && activeRoomLabel === "lobby";
  const isInRoom = connected && activeRoomLabel !== null && activeRoomLabel !== "lobby";

  /* ─── Sync participant list from LiveKit Room ─── */
  const syncParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) { setParticipants([]); return; }
    const list: VoiceParticipantInfo[] = [];
    const lp = room.localParticipant;
    if (lp) {
      const hasAudio = Array.from(lp.audioTrackPublications.values()).some(p => p.track && !p.isMuted);
      list.push({ identity: lp.identity, name: lp.name || lp.identity, isSpeaking: lp.isSpeaking, isMuted: !hasAudio, isLocal: true });
    }
    room.remoteParticipants.forEach((rp: RemoteParticipant) => {
      const hasAudio = Array.from(rp.audioTrackPublications.values()).some(p => p.isSubscribed && p.track && !p.isMuted);
      list.push({ identity: rp.identity, name: rp.name || rp.identity, isSpeaking: rp.isSpeaking, isMuted: !hasAudio, isLocal: false });
    });
    setParticipants(list);
  }, []);

  /* ─── Fetch LiveKit token (with retry) ─── */
  const fetchToken = useCallback(async (lkRoomName: string): Promise<string | null> => {
    if (!user) return null;
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setError("Sign in to join voice"); return null; }
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/livekit-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ roomName: lkRoomName, identity: user.id, name: profile?.username || "Anon" }),
        });
        if (!resp.ok) throw new Error(`Server ${resp.status}`);
        const data = await resp.json();
        if (data.token) return data.token;
        throw new Error(data.error || "No token");
      } catch (e: any) {
        if (attempt < MAX_RETRIES) { await new Promise(r => setTimeout(r, 800 * (attempt + 1))); continue; }
        setError(e.message === "Failed to fetch" ? "Unable to reach voice server — retries exhausted. Check your connection or try again." : e.message);
        return null;
      }
    }
    return null;
  }, [user, profile]);

  /* ─── Disconnect current room ─── */
  const disconnect = useCallback(async () => {
    try {
      // Detach all remote audio elements before disconnecting
      const room = roomRef.current;
      if (room) {
        room.remoteParticipants.forEach((rp: RemoteParticipant) => {
          rp.audioTrackPublications.forEach((pub) => {
            if (pub.track) pub.track.detach().forEach((el: HTMLMediaElement) => el.remove());
          });
        });
        room.disconnect(true);
      }
    } catch {}
    roomRef.current = null;
    if (mountedRef.current) { setConnected(false); setMuted(true); setParticipants([]); setActiveRoomLabel(null); }
  }, []);

  /* ─── Connect to a LiveKit room ─── */
  const connectToRoom = useCallback(async (lkRoomName: string, label: string) => {
    if (!user) { toast.error("Sign in to join voice"); return; }
    // If already in this room, leave
    if (connected && activeRoomLabel === label) { await disconnect(); return; }
    // Disconnect old room first
    if (roomRef.current) { try { roomRef.current.disconnect(true); } catch {} roomRef.current = null; }

    setConnecting(true);
    setError(null);
    setActiveRoomLabel(label);

    const token = await fetchToken(lkRoomName);
    if (!token) { setConnecting(false); setActiveRoomLabel(null); return; }

    try {
      const room = new Room({
        adaptiveStream: true, dynacast: true,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      room.on(RoomEvent.Connected, () => { if (mountedRef.current) { setConnected(true); setConnecting(false); syncParticipants(); } });
      room.on(RoomEvent.Disconnected, () => { if (mountedRef.current) { setConnected(false); setParticipants([]); } });
      room.on(RoomEvent.ParticipantConnected, syncParticipants);
      room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
      room.on(RoomEvent.TrackMuted, syncParticipants);
      room.on(RoomEvent.TrackUnmuted, syncParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, syncParticipants);
      room.on(RoomEvent.LocalTrackPublished, syncParticipants);
      room.on(RoomEvent.LocalTrackUnpublished, syncParticipants);

      // Attach remote audio tracks for actual playback
      room.on(RoomEvent.TrackSubscribed, (track: any, _pub: any, _participant: any) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.setAttribute("data-lk-participant", _participant.identity);
          document.body.appendChild(el);
        }
        syncParticipants();
      });
      room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
        track.detach().forEach((el: HTMLElement) => el.remove());
        syncParticipants();
      });

      roomRef.current = room;
      await room.connect(LK_URL, token);

      // Enable audio playback (handles browser autoplay policy)
      try { await room.startAudio(); } catch {}

      // Start with mic off (muted)
      try { await room.localParticipant.setMicrophoneEnabled(false); } catch {}
      setMuted(true);
      syncParticipants();
    } catch (e: any) {
      setError(`Connection failed: ${e.message}`);
      setConnecting(false);
      setActiveRoomLabel(null);
      roomRef.current = null;
    }
  }, [user, fetchToken, connected, activeRoomLabel, disconnect, syncParticipants]);

  /* ─── Toggle mute ─── */
  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;
    const newMuted = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
      setMuted(newMuted);
      syncParticipants();
    } catch (e: any) {
      toast.error("Mic error — check browser permissions");
    }
  }, [muted, syncParticipants]);

  /* ─── Cleanup on unmount ─── */
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; try { roomRef.current?.disconnect(true); } catch {} roomRef.current = null; };
  }, []);

  /* ─── Fetch voice rooms from Supabase ─── */
  useEffect(() => {
    const fetchRooms = async () => {
      const { data } = await supabase.from("social_voice_rooms").select("*").order("created_at", { ascending: false }).limit(20);
      if (data) setRooms(data);
    };
    fetchRooms();
    const channel = supabase.channel("social-rooms-realtime").on("postgres_changes", { event: "*", schema: "public", table: "social_voice_rooms" }, () => fetchRooms()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  /* ─── Room CRUD ─── */
  const createRoom = async () => {
    if (!user || !newRoomName.trim()) return;
    setCreatingRoom(true);
    const { error: err } = await supabase.from("social_voice_rooms").insert({ name: newRoomName.trim(), created_by: user.id, creator_username: profile?.username || "Anon", participant_count: 0 });
    setCreatingRoom(false);
    if (err) toast.error("Failed to create room");
    else { toast.success("Room created!"); setNewRoomName(""); setShowCreateRoom(false); }
  };
  const deleteRoom = async (roomId: string) => {
    const { error: err } = await supabase.from("social_voice_rooms").delete().eq("id", roomId);
    if (err) toast.error("Failed to delete room"); else toast.success("Room deleted");
  };

  /* ─── Shortcut handlers ─── */
  const joinLobby = () => connectToRoom("social-voice-lobby", "lobby");
  const joinRoom = (room: VoiceRoom) => { connectToRoom(`social-room-${room.id}`, room.id); if (!connected || activeRoomLabel !== room.id) toast.success(`Joining "${room.name}"...`); };

  const VOICE_SUB_TABS: { id: VoiceSubTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "lobby", label: "Lobby", Icon: Volume2 },
    { id: "people", label: "People", Icon: Users },
    { id: "rooms", label: "Rooms", Icon: Headphones },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.07] px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="h-4 w-4 text-white/40" />
            <span className="text-sm font-black tracking-wide text-white">voice-rooms</span>
          </div>
          <span className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
            connected ? "bg-og-lime/15 text-og-lime" : "bg-white/[0.05] text-white/30",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-og-lime animate-pulse" : "bg-white/20")} />
            {connected ? "connected" : connecting ? "connecting…" : "offline"}
          </span>
        </div>
        <div className="flex gap-1.5">
          {VOICE_SUB_TABS.map((t) => (
            <button key={t.id} onClick={() => setSubTab(t.id)} className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide transition",
              subTab === t.id ? "bg-gradient-to-r from-og-lime/80 to-og-gold/70 text-black shadow-lg" : "text-white/40 hover:bg-white/5 hover:text-white/60",
            )}>
              <t.Icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active voice control bar */}
      {connected && (
        <div className="border-b border-og-lime/20 bg-og-lime/[0.04] px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-og-lime opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-og-lime" />
              </span>
              <div>
                <p className="text-[10px] font-bold text-og-lime">
                  {isInLobby ? "VOICE LOBBY" : `ROOM: ${rooms.find((r) => r.id === activeRoomLabel)?.name || "Private Room"}`}
                </p>
                <p className="text-[9px] text-white/30">{participants.length} connected</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={toggleMute} className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                muted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-og-lime/20 text-og-lime hover:bg-og-lime/30",
              )} title={muted ? "Unmute" : "Mute"}>
                {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
              <button onClick={disconnect} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 transition hover:bg-red-500/30" title="Disconnect">
                <PhoneOff className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {/* Participant avatars */}
          {participants.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {participants.map((p) => (
                <div key={p.identity} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "relative h-9 w-9 overflow-hidden rounded-full border-2 transition-all",
                    p.isSpeaking ? "border-og-lime shadow-[0_0_12px_hsl(var(--og-lime)/0.5)]" : "border-white/10",
                  )}>
                    <img src={avatarSrc(members.find(m => m.user_id === p.identity)?.avatar_url || (p.isLocal ? profile?.avatar_url : null), p.name)} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = dicebear(p.name); }} />
                    {p.isMuted && (
                      <div className="absolute inset-0 flex items-end justify-end">
                        <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500">
                          <MicOff className="h-2 w-2 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="max-w-[48px] truncate text-[8px] font-semibold text-white/40">{p.isLocal ? "You" : p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/10 p-2.5">
          <p className="text-[10px] text-red-400">{error}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setError(null)} className="text-[9px] text-white/30 underline">Dismiss</button>
            <button onClick={() => { if (activeRoomLabel) connectToRoom(activeRoomLabel === "lobby" ? "social-voice-lobby" : `social-room-${activeRoomLabel}`, activeRoomLabel); }} className="text-[9px] font-bold text-og-lime underline">Retry</button>
          </div>
        </div>
      )}

      {/* Voice Toolkit — shown when connected to any voice room */}
      <VoiceToolkit room={roomRef.current} connected={connected} muted={muted} />

      {/* Sub-tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {subTab === "lobby" && (
          <div>
            {/* Lobby card */}
            <div className={cn("rounded-xl border p-5 transition", isInLobby ? "border-og-lime/30 bg-og-lime/[0.06]" : "border-og-lime/15 bg-og-lime/[0.03]")}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={cn("h-3 w-3 rounded-full", isInLobby ? "bg-og-lime shadow-[0_0_10px_hsl(var(--og-lime))] animate-pulse" : "bg-og-lime/50")} />
                  <h3 className="text-sm font-black text-white">VOICE LOBBY</h3>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold text-white/40">
                  {isInLobby ? participants.length : 0} here
                </span>
              </div>
              <p className="mb-5 text-[11px] text-white/40">Community voice channel powered by LiveKit. Talk live with OrbitX traders.</p>
              {!user ? (
                <p className="text-center text-[11px] text-white/25">Sign in to join voice</p>
              ) : (
                <button onClick={joinLobby} disabled={connecting} className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-50",
                  isInLobby ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-gradient-to-r from-og-lime/80 to-og-gold/60 text-black hover:shadow-[0_0_20px_hsl(var(--og-lime)/0.3)]",
                )}>
                  {connecting && activeRoomLabel === "lobby" ? (
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
            {isInLobby && participants.length > 0 && (
              <div className="mt-5">
                <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  <Users className="h-3 w-3" /> In Lobby — {participants.length}
                </h4>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                  {participants.map((p) => (
                    <div key={p.identity} className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition hover:bg-white/[0.05]">
                      <div className="relative">
                        <div className={cn(
                          "h-14 w-14 overflow-hidden rounded-full border-2 transition-all",
                          p.isSpeaking && !p.isMuted ? "border-og-lime shadow-[0_0_16px_hsl(var(--og-lime)/0.5)]" : p.isMuted ? "border-red-500/30" : "border-white/10",
                        )}>
                          <img src={avatarSrc(members.find(m => m.user_id === p.identity)?.avatar_url || (p.isLocal ? profile?.avatar_url : null), p.name)} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = dicebear(p.name); }} />
                        </div>
                        <span className={cn(
                          "absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background",
                          p.isMuted ? "bg-red-500" : p.isSpeaking ? "bg-og-lime" : "bg-white/20",
                        )}>
                          {p.isMuted ? <MicOff className="h-2 w-2 text-white" /> : <Mic className="h-2 w-2 text-white" />}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block max-w-[80px] truncate text-[10px] font-bold text-white/70">{p.isLocal ? "You" : p.name}</span>
                        <span className={cn("text-[8px] font-semibold", p.isSpeaking && !p.isMuted ? "text-og-lime" : p.isMuted ? "text-red-400/60" : "text-white/25")}>
                          {p.isMuted ? "Muted" : p.isSpeaking ? "Speaking" : "Listening"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!connected && (
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
                <div key={m.user_id} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img src={avatarSrc(m.avatar_url, m.username || m.user_id)} alt="" className={cn("h-9 w-9 rounded-full border object-cover", m.is_online ? "border-og-lime/30" : "border-white/10 grayscale-[50%]")} onError={(e) => { (e.target as HTMLImageElement).src = dicebear("fb"); }} />
                      <span className={cn("absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background", m.is_online ? "bg-og-lime" : "bg-white/15")} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-primary">@{m.username || "Anon"}</span>
                      <p className={cn("text-[9px]", m.is_online ? "text-og-lime/60" : "text-white/20")}>{m.is_online ? "Online" : "Offline"}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-bold", m.is_online ? "bg-og-lime/10 text-og-lime" : "bg-white/[0.03] text-white/20")}>{m.is_online ? "Online" : "Offline"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {subTab === "rooms" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40"><Headphones className="h-3 w-3" /> Voice Rooms</h4>
                <p className="mt-0.5 text-[10px] text-white/25">{rooms.length} rooms</p>
              </div>
              {!showCreateRoom && (
                <button onClick={() => { if (!user) { toast.error("Sign in to create a room"); return; } setShowCreateRoom(true); }} className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-og-lime/80 to-og-gold/60 px-3 py-1.5 text-[10px] font-bold text-black transition hover:shadow-[0_0_16px_hsl(var(--og-lime)/0.3)]">
                  <Plus className="h-3 w-3" /> New Room
                </button>
              )}
            </div>

            {/* Create Room Form */}
            {showCreateRoom && (
              <div className="mb-4 rounded-xl border border-og-lime/20 bg-og-lime/[0.04] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-black text-white">CREATE VOICE ROOM</h4>
                  <button onClick={() => { setShowCreateRoom(false); setNewRoomName(""); }} className="rounded-full p-1 text-white/30 transition hover:bg-white/[0.06] hover:text-white/60"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
                    <Headphones className="h-4 w-4 flex-shrink-0 text-white/20" />
                    <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createRoom(); }} placeholder="Room name (e.g. Trading Talk)" className="min-w-0 flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/20 outline-none" autoFocus maxLength={50} />
                  </div>
                  <button onClick={createRoom} disabled={!newRoomName.trim() || creatingRoom} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-og-lime/80 to-og-gold/60 px-4 py-2.5 text-[11px] font-bold text-black transition hover:shadow-[0_0_16px_hsl(var(--og-lime)/0.3)] disabled:opacity-40">
                    {creatingRoom ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <Plus className="h-3.5 w-3.5" />}
                    Create
                  </button>
                </div>
              </div>
            )}

            {rooms.length === 0 && !showCreateRoom ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Headphones className="mb-3 h-10 w-10 text-white/10" />
                <p className="text-sm font-bold text-white/25">NO ROOMS YET</p>
                <p className="mt-1 text-[11px] text-white/15">Create a room above to start a conversation</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((room) => {
                  const isInThisRoom = connected && activeRoomLabel === room.id;
                  const isOwner = room.created_by === user?.id;
                  return (
                    <div key={room.id} className={cn("rounded-xl border p-4 transition", isInThisRoom ? "border-og-lime/30 bg-og-lime/[0.06]" : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.05]")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", isInThisRoom ? "bg-og-lime/20" : "bg-white/[0.04]")}>
                            <Headphones className={cn("h-4 w-4", isInThisRoom ? "text-og-lime" : "text-white/25")} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">{room.name}</p>
                            <p className="mt-0.5 text-[10px] text-white/30">by @{room.creator_username || "Anon"}{isInThisRoom && ` · ${participants.length} connected`}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(isOwner || isAdmin) && (
                            <button onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 transition hover:bg-red-500/15 hover:text-red-400" title="Delete room">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isInThisRoom ? (
                            <button onClick={disconnect} className="rounded-lg bg-red-500/15 px-3.5 py-1.5 text-[10px] font-bold text-red-400 transition hover:bg-red-500/25">Leave</button>
                          ) : (
                            <button onClick={() => joinRoom(room)} disabled={connecting} className="rounded-lg bg-og-lime/15 px-3.5 py-1.5 text-[10px] font-bold text-og-lime transition hover:bg-og-lime/25 disabled:opacity-50">Join</button>
                          )}
                        </div>
                      </div>
                      {isInThisRoom && participants.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                          {participants.map((p) => (
                            <div key={p.identity} className="flex flex-col items-center gap-1">
                              <div className={cn("h-8 w-8 overflow-hidden rounded-full border", p.isSpeaking ? "border-og-lime shadow-[0_0_8px_hsl(var(--og-lime)/0.4)]" : "border-white/10")}>
                                <img src={avatarSrc(members.find(m => m.user_id === p.identity)?.avatar_url || (p.isLocal ? profile?.avatar_url : null), p.name)} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = dicebear(p.name); }} />
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

interface StreamTile { key: string; identity: string; name: string; isLocal: boolean; screen: boolean; track: any; }

function VideoTile({ tile }: { tile: StreamTile }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && tile.track) { try { tile.track.attach(el); } catch { /* noop */ } }
    return () => { try { tile.track?.detach(); } catch { /* noop */ } };
  }, [tile.track]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
      <video ref={ref} autoPlay playsInline muted={tile.isLocal} className="h-full w-full object-cover" />
      <div className="absolute left-2 top-2 flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[9px] font-black uppercase text-white"><span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Live</span>
        {tile.screen && <span className="rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold text-white/80">Screen</span>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 text-[12px] font-bold text-white">
        {tile.name}{tile.isLocal ? " (You)" : ""}
      </div>
    </div>
  );
}

interface LiveChatMsg { id: string; user_id: string; username: string | null; avatar_url: string | null; content: string; created_at: string; }
function LiveChat() {
  const { user, profile } = useAuth();
  const [msgs, setMsgs] = useState<LiveChatMsg[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let on = true;
    supabase.from("social_messages").select("id,user_id,username,avatar_url,content,created_at").eq("channel", "live-stream-chat").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => { if (on && data) setMsgs((data as LiveChatMsg[]).reverse()); });
    const ch = supabase.channel("livestream-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "social_messages", filter: "channel=eq.live-stream-chat" },
        (p) => { const row = p.new as LiveChatMsg; setMsgs((prev) => prev.some((m) => m.id === row.id) ? prev : [...prev, row]); })
      .subscribe();
    return () => { on = false; supabase.removeChannel(ch); };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  const send = async () => {
    const content = text.trim();
    if (!content || !user) return;
    setText("");
    const optimistic: LiveChatMsg = { id: `tmp-${Date.now()}`, user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url || null, content, created_at: new Date().toISOString() };
    setMsgs((prev) => [...prev, optimistic]);
    const { error } = await supabase.from("social_messages").insert({ channel: "live-stream-chat", user_id: user.id, username: profile?.username || "Anon", avatar_url: profile?.avatar_url, content, likes_count: 0, liked_by: [] });
    if (error) { setMsgs((prev) => prev.filter((m) => m.id !== optimistic.id)); setText(content); }
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
        <MessageSquare className="h-4 w-4 text-og-cyan" />
        <span className="text-[13px] font-bold text-white">Live chat</span>
        <span className="ml-auto text-[10px] text-white/30">{msgs.length}</span>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {msgs.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-[12px] text-white/30">Say hi to the stream 👋</div>
        ) : msgs.map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <img src={safeAvatarUrl(m.avatar_url) || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(m.username || m.user_id)}`} alt="" className="mt-0.5 h-6 w-6 shrink-0 rounded-full object-cover" />
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-white/80">{m.username || "Anon"}</span>
              <span className="ml-1.5 break-words text-[12.5px] text-white/65">{m.content}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-white/[0.07] p-2.5">
        {user ? (
          <div className="flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Chat with the stream…" maxLength={300}
              className="flex-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-og-cyan/40" />
            <button onClick={send} disabled={!text.trim()} className="grid h-9 w-9 place-items-center rounded-full bg-og-cyan text-background transition hover:brightness-110 disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </div>
        ) : <p className="text-center text-[11px] text-white/30">Sign in to chat</p>}
      </div>
    </div>
  );
}

const LiveStream = () => {
  const { user, profile } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const autoRef = useRef(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [liveMode, setLiveMode] = useState<"none" | "camera" | "screen">("none");
  const [micOn, setMicOn] = useState(false);
  const [tiles, setTiles] = useState<StreamTile[]>([]);
  const [viewers, setViewers] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const addTile = useCallback((track: any, participant: any, isLocal: boolean) => {
    if (!track || track.kind !== "video") return;
    const screen = track.source === Track.Source.ScreenShare;
    const key = `${participant.identity}:${track.sid}`;
    setTiles((prev) => prev.some((t) => t.key === key) ? prev : [...prev, {
      key, identity: participant.identity, name: participant.name || participant.identity || "Anon", isLocal, screen, track,
    }]);
  }, []);
  const removeBySid = useCallback((sid?: string) => { if (sid) setTiles((prev) => prev.filter((t) => t.track?.sid !== sid)); }, []);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!user) { setError("Sign in to join the stream"); return null; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/livekit-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ roomName: COMMUNITY_LIVE_ROOM, identity: user.id, name: profile?.username || "Anon" }),
      });
      if (!resp.ok) throw new Error(`Server ${resp.status}`);
      const data = await resp.json();
      if (data.token) return data.token;
      throw new Error(data.error || "No token");
    } catch (e: any) {
      setError(e.message === "Failed to fetch" ? "Unable to reach the stream server" : e.message);
      return null;
    }
  }, [user, profile]);

  const ensureConnected = useCallback(async (): Promise<Room | null> => {
    if (roomRef.current) return roomRef.current;
    setError(null); setConnecting(true);
    try {
      const token = await getToken();
      if (!token) return null;
      const room = new Room({ adaptiveStream: true, dynacast: true });
      room
        .on(RoomEvent.TrackSubscribed, (track, _pub, participant) => addTile(track, participant, false))
        .on(RoomEvent.TrackUnsubscribed, (track) => removeBySid(track.sid))
        .on(RoomEvent.LocalTrackPublished, (pub) => { if (pub.track) addTile(pub.track, room.localParticipant, true); })
        .on(RoomEvent.LocalTrackUnpublished, (pub) => removeBySid(pub.trackSid))
        .on(RoomEvent.ParticipantConnected, () => setViewers(room.numParticipants))
        .on(RoomEvent.ParticipantDisconnected, () => setViewers(room.numParticipants))
        .on(RoomEvent.Disconnected, () => { setConnected(false); setTiles([]); setLiveMode("none"); setMicOn(false); roomRef.current = null; });
      await room.connect(LK_URL, token);
      roomRef.current = room;
      setConnected(true);
      setViewers(room.numParticipants);
      room.remoteParticipants.forEach((p) => p.trackPublications.forEach((pub) => { if (pub.track && pub.isSubscribed) addTile(pub.track, p, false); }));
      return room;
    } catch (e: any) {
      setError(e?.message || "Could not connect");
      return null;
    } finally { setConnecting(false); }
  }, [getToken, addTile, removeBySid]);

  // Auto-join as a viewer so streams from other accounts show up immediately.
  useEffect(() => { if (user && !autoRef.current) { autoRef.current = true; ensureConnected(); } }, [user, ensureConnected]);
  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  const mediaErr = (e: any): string => {
    const n = e?.name || ""; const m = (e?.message || "").toLowerCase();
    if (n === "NotFoundError" || n === "OverconstrainedError" || m.includes("device not found") || m.includes("requested device"))
      return "No camera or microphone found on this device. Use Share Screen to broadcast, or connect a camera and try again.";
    if (n === "NotAllowedError" || m.includes("permission") || m.includes("denied"))
      return "Camera/mic access is blocked. Allow it in your browser site settings, then try again.";
    if (n === "NotReadableError" || m.includes("in use"))
      return "Your camera/mic is in use by another app. Close it and try again.";
    return e?.message || "Could not start your stream.";
  };
  const goLive = useCallback(async (mode: "camera" | "screen") => {
    const room = await ensureConnected();
    if (!room) return;
    setError(null);
    if (mode === "screen") {
      try { await room.localParticipant.setScreenShareEnabled(true); setLiveMode("screen"); }
      catch (e: any) { if (e?.name !== "NotAllowedError") setError(mediaErr(e)); } // ignore user-cancelled picker
      return;
    }
    // Camera mode: enable mic + camera independently so a missing device doesn't kill the whole stream.
    let micOk = false, camOk = false;
    try { await room.localParticipant.setMicrophoneEnabled(true); micOk = true; } catch { /* no mic */ }
    try { await room.localParticipant.setCameraEnabled(true); camOk = true; }
    catch (e: any) {
      setError(micOk
        ? "No camera found — you're live with audio only. Use Share Screen to add video."
        : mediaErr(e));
    }
    setMicOn(micOk);
    if (camOk || micOk) setLiveMode("camera");
  }, [ensureConnected]);

  const stopLive = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    try { await room.localParticipant.setCameraEnabled(false); await room.localParticipant.setScreenShareEnabled(false); await room.localParticipant.setMicrophoneEnabled(false); } catch { /* noop */ }
    setTiles((prev) => prev.filter((t) => !t.isLocal)); setLiveMode("none"); setMicOn(false);
  }, []);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current; if (!room) return;
    const next = !micOn;
    try { await room.localParticipant.setMicrophoneEnabled(next); setMicOn(next); } catch { /* noop */ }
  }, [micOn]);

  const leave = useCallback(() => { roomRef.current?.disconnect(); roomRef.current = null; autoRef.current = false; setConnected(false); setTiles([]); setLiveMode("none"); setMicOn(false); }, []);

  const liveCount = tiles.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Radio className="h-4 w-4 text-red-400" />
            <span className="text-sm font-black tracking-wide text-white">live-stream</span>
            {liveCount > 0 && <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400"><span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" /> {liveCount} live</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-white/40"><Eye className="h-3.5 w-3.5" /> {connected ? viewers : 0} watching</span>
            {connected && <button onClick={leave} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-white/60 hover:text-white">Leave</button>}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        {liveMode === "none" ? (
          <>
            <button onClick={() => goLive("camera")} disabled={connecting || !user}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3.5 py-1.5 text-[12px] font-black text-white transition hover:bg-red-600 disabled:opacity-40">
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />} Go Live
            </button>
            <button onClick={() => goLive("screen")} disabled={connecting || !user}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-bold text-white/80 transition hover:bg-white/[0.1] disabled:opacity-40">
              <Monitor className="h-3.5 w-3.5" /> Share Screen
            </button>
          </>
        ) : (
          <>
            <button onClick={stopLive} className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3.5 py-1.5 text-[12px] font-black text-red-400 transition hover:bg-red-500/20">
              {liveMode === "screen" ? <MonitorOff className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />} Stop streaming
            </button>
            {liveMode === "camera" && (
              <button onClick={toggleMic} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition", micOn ? "border-white/12 bg-white/[0.05] text-white/80 hover:bg-white/[0.1]" : "border-red-500/40 bg-red-500/10 text-red-400")}>
                {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />} {micOn ? "Mic on" : "Muted"}
              </button>
            )}
            <button onClick={() => goLive("screen")} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-bold text-white/80 transition hover:bg-white/[0.1]">
              <Monitor className="h-3.5 w-3.5" /> Add screen
            </button>
          </>
        )}
      </div>

      {error && <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-[12px] text-red-400">{error}</div>}
      {!user && <div className="border-b border-white/[0.06] px-4 py-2 text-[12px] text-white/40">Sign in to go live, watch, and chat.</div>}

      {/* Stage + chat */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex-1 overflow-y-auto p-4">
          {tiles.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {tiles.map((t) => <VideoTile key={t.key} tile={t} />)}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center py-12 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                <Radio className="h-10 w-10 text-white/15" />
              </div>
              <h3 className="mb-1 text-lg font-black text-white">{connecting ? "Connecting…" : connected ? "No one is live right now" : "OrbitX Live"}</h3>
              <p className="max-w-xs text-[12px] leading-relaxed text-white/35">Go live with your camera, share your screen, and broadcast to the OrbitX community in real time. Streams from anyone appear here automatically.</p>
            </div>
          )}
        </div>
        <div className="flex min-h-[280px] flex-col border-t border-white/[0.07] lg:min-h-0 lg:w-80 lg:border-l lg:border-t-0">
          <LiveChat />
        </div>
      </div>
    </div>
  );
};

export default SocialHub;
