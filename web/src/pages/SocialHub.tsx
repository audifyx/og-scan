/**
 * SocialHub — Discord-style community hub for OG Scan.
 * Channels: activity-feed, general-chat, voice-rooms, live-stream
 * Branded with OG Scan design tokens (og-ink, og-lime, og-gold, og-cyan).
 * Rendered inline inside Index.tsx — do NOT wrap in AppLayout.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap, Hash, Volume2, Radio, Users, Send, Phone,
  Plus, Mic, MicOff, Video, VideoOff, Monitor,
  MessageSquare, ChevronRight, Headphones, Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { safeAvatarUrl } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type ChannelId = "activity-feed" | "general-chat" | "voice-rooms" | "live-stream";
type VoiceSubTab = "lobby" | "people" | "rooms";

interface ChatMessage {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
}

interface CommunityMember {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean;
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
   Constants
   ═══════════════════════════════════════════════════════════════ */

const CHANNELS: { id: ChannelId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "activity-feed", label: "activity-feed", Icon: Zap },
  { id: "general-chat", label: "general-chat", Icon: Hash },
  { id: "voice-rooms", label: "voice-rooms", Icon: Volume2 },
  { id: "live-stream", label: "live-stream", Icon: Radio },
];

const SOCIAL_CHAT_CHANNEL = "social-general";

const dicebear = (seed: string) =>
  `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

const SocialHub = () => {
  const { user, profile } = useAuth();
  const [activeChannel, setActiveChannel] = useState<ChannelId>("activity-feed");
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  /* Fetch community members */
  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .order("created_at", { ascending: true })
        .limit(50);
      if (data) {
        const mapped: CommunityMember[] = data.map((p: any) => ({
          user_id: p.user_id,
          username: p.username,
          avatar_url: p.avatar_url,
          is_online: Math.random() > 0.5, // Simulated — replace with presence
        }));
        setMembers(mapped);
        setOnlineCount(mapped.filter((m) => m.is_online).length + 1); // +1 for current user
      }
    };
    fetchMembers();
  }, []);

  /* Track Supabase presence for online count */
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("social-presence", {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
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

  const onlineMembers = members.filter((m) => m.is_online);
  // Always include current user
  const activeMembersList = [
    ...(user ? [{
      user_id: user.id,
      username: profile?.username || "You",
      avatar_url: profile?.avatar_url,
      is_online: true,
    }] : []),
    ...onlineMembers.filter((m) => m.user_id !== user?.id),
  ].slice(0, 8);

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[500px] gap-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a1018]">
      {/* ── Left: Channel sidebar ── */}
      <div className="hidden w-[220px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0c1420] md:flex">
        {/* Hub header */}
        <div className="border-b border-white/[0.07] px-4 py-4">
          <h3 className="text-sm font-black tracking-wide text-white">
            SOCIAL<span className="text-og-lime">HUB</span>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-og-lime/80">
            <span className="h-1.5 w-1.5 rounded-full bg-og-lime shadow-[0_0_6px_hsl(var(--og-lime))]" />
            {onlineCount} online
          </p>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto px-2 py-3" style={{ scrollbarWidth: "none" }}>
          <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Channels</p>
          {CHANNELS.map((ch) => {
            const isActive = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all",
                  isActive
                    ? "bg-og-lime/15 text-og-lime shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80",
                )}
              >
                <ch.Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{ch.label}</span>
              </button>
            );
          })}

          {/* Active members */}
          <p className="mb-2 mt-5 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
            Active — {activeMembersList.length}
          </p>
          <div className="space-y-1">
            {activeMembersList.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2.5 rounded-lg px-3 py-1.5">
                <div className="relative">
                  <img
                    src={safeAvatarUrl(m.avatar_url) || dicebear(m.username || m.user_id)}
                    alt=""
                    className="h-6 w-6 rounded-full border border-white/10 object-cover"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#0c1420] bg-og-lime" />
                </div>
                <span className="truncate text-[11px] font-medium text-white/70">
                  {m.username || "Anon"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Current user footer */}
        {user && (
          <div className="border-t border-white/[0.07] px-3 py-3">
            <div className="flex items-center gap-2.5">
              <img
                src={safeAvatarUrl(profile?.avatar_url) || dicebear(profile?.username || "me")}
                alt=""
                className="h-7 w-7 rounded-full border border-white/10 object-cover"
              />
              <span className="truncate text-[11px] font-semibold text-white/80">
                {profile?.username || user.email?.split("@")[0] || "You"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile channel pills (visible on small screens) ── */}
      <div className="flex w-full flex-col">
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/[0.07] bg-[#0c1420] px-3 py-2 md:hidden"
          style={{ scrollbarWidth: "none" }}>
          {CHANNELS.map((ch) => {
            const isActive = activeChannel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition",
                  isActive
                    ? "bg-og-lime/15 text-og-lime"
                    : "text-white/40 hover:text-white/60",
                )}
              >
                <ch.Icon className="h-3 w-3" />
                {ch.label}
              </button>
            );
          })}
        </div>

        {/* ── Content area ── */}
        <div className="flex-1 overflow-y-auto">
          {activeChannel === "activity-feed" && (
            <ActivityFeed
              members={members}
              activeMembersList={activeMembersList}
              onlineCount={onlineCount}
              onSwitchChannel={setActiveChannel}
            />
          )}
          {activeChannel === "general-chat" && <GeneralChat />}
          {activeChannel === "voice-rooms" && <VoiceRooms members={members} />}
          {activeChannel === "live-stream" && <LiveStream />}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Activity Feed (Dashboard / Overview)
   ═══════════════════════════════════════════════════════════════ */

const ActivityFeed = ({
  members,
  activeMembersList,
  onlineCount,
  onSwitchChannel,
}: {
  members: CommunityMember[];
  activeMembersList: CommunityMember[];
  onlineCount: number;
  onSwitchChannel: (ch: ChannelId) => void;
}) => {
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from("social_messages")
        .select("*")
        .eq("channel", SOCIAL_CHAT_CHANNEL)
        .order("created_at", { ascending: false })
        .limit(3);
      if (data) setRecentMessages(data.reverse());
    };
    fetchRecent();
  }, []);

  return (
    <div className="p-4 sm:p-5">
      {/* Channel header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Zap className="h-4 w-4 text-og-gold" />
          <span className="text-sm font-black tracking-wide text-white">activity-feed</span>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-og-lime/10 px-2.5 py-1 text-[10px] font-bold text-og-lime">
          <span className="h-1.5 w-1.5 rounded-full bg-og-lime shadow-[0_0_6px_hsl(var(--og-lime))]" />
          {onlineCount} online
        </span>
      </div>

      {/* Active now */}
      <div className="mb-5">
        <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-og-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-og-gold" />
          Active Now
        </h4>
        <div className="flex flex-wrap gap-3">
          {activeMembersList.map((m) => (
            <div key={m.user_id} className="flex flex-col items-center gap-1.5">
              <div className="relative">
                <img
                  src={safeAvatarUrl(m.avatar_url) || dicebear(m.username || m.user_id)}
                  alt=""
                  className="h-11 w-11 rounded-full border-2 border-og-lime/30 object-cover"
                />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0a1018] bg-og-lime" />
              </div>
              <span className="max-w-[56px] truncate text-[9px] font-semibold text-white/60">
                {m.username || "Anon"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-5">
        <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
          ✨ Quick Actions
        </h4>
        <div className="grid grid-cols-2 gap-2.5">
          <QuickActionCard
            icon={<Volume2 className="h-5 w-5" />}
            title="Voice Lobby"
            subtitle="Join & talk live"
            color="lime"
            onClick={() => onSwitchChannel("voice-rooms")}
          />
          <QuickActionCard
            icon={<MessageSquare className="h-5 w-5" />}
            title="Chat Room"
            subtitle="Message everyone"
            color="cyan"
            onClick={() => onSwitchChannel("general-chat")}
          />
          <QuickActionCard
            icon={<Radio className="h-5 w-5" />}
            title="Go Live"
            subtitle="Stream to everyone"
            color="gold"
            onClick={() => onSwitchChannel("live-stream")}
          />
          <QuickActionCard
            icon={<Headphones className="h-5 w-5" />}
            title="Voice Rooms"
            subtitle="Create or join"
            color="lime"
            onClick={() => onSwitchChannel("voice-rooms")}
          />
        </div>
      </div>

      {/* Recent Chat */}
      <div className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
            <Hash className="h-3 w-3" /> Recent Chat
          </h4>
          <button
            onClick={() => onSwitchChannel("general-chat")}
            className="text-[10px] font-bold text-og-cyan hover:text-og-cyan/80 transition"
          >
            View All →
          </button>
        </div>
        <div className="space-y-2">
          {recentMessages.length === 0 ? (
            <p className="text-xs text-white/30 italic">No messages yet. Be the first to chat!</p>
          ) : (
            recentMessages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2">
                <img
                  src={safeAvatarUrl(msg.avatar_url) || dicebear(msg.username || "anon")}
                  alt=""
                  className="mt-0.5 h-5 w-5 rounded-full border border-white/10 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-og-cyan">{msg.username || "Anon"}</span>
                  <span className="ml-2 text-[10px] text-white/25">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                  <p className="mt-0.5 text-xs text-white/60 break-words">{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Community stats */}
      <div>
        <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
          📈 Community
        </h4>
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard value={members.length} label="Members" />
          <StatCard value={onlineCount} label="Online" color="lime" />
          <StatCard value={0} label="Live" />
        </div>
      </div>
    </div>
  );
};

const QuickActionCard = ({
  icon,
  title,
  subtitle,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: "lime" | "cyan" | "gold";
  onClick: () => void;
}) => {
  const colors = {
    lime: "bg-og-lime/10 text-og-lime hover:bg-og-lime/15 border-og-lime/20",
    cyan: "bg-og-cyan/10 text-og-cyan hover:bg-og-cyan/15 border-og-cyan/20",
    gold: "bg-og-gold/10 text-og-gold hover:bg-og-gold/15 border-og-gold/20",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
        colors[color],
      )}
    >
      {icon}
      <div>
        <p className="text-xs font-bold">{title}</p>
        <p className="text-[10px] opacity-60">{subtitle}</p>
      </div>
    </button>
  );
};

const StatCard = ({ value, label, color }: { value: number; label: string; color?: string }) => (
  <div className="flex flex-col items-center rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
    <span className={cn("text-xl font-black", color === "lime" ? "text-og-lime" : "text-og-gold")}>
      {value}
    </span>
    <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">{label}</span>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   General Chat
   ═══════════════════════════════════════════════════════════════ */

const GeneralChat = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("social_messages")
        .select("*")
        .eq("channel", SOCIAL_CHAT_CHANNEL)
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) setMessages(data);
    };
    fetchMessages();

    const channel = supabase
      .channel("social-chat-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "social_messages",
        filter: `channel=eq.${SOCIAL_CHAT_CHANNEL}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("social_messages").insert({
      channel: SOCIAL_CHAT_CHANNEL,
      user_id: user.id,
      username: profile?.username || user.email?.split("@")[0] || "Anon",
      avatar_url: profile?.avatar_url,
      content: input.trim(),
    });
    if (error) toast.error("Failed to send message");
    setInput("");
    setSending(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Hash className="h-4 w-4 text-white/40" />
          <span className="text-sm font-black tracking-wide text-white">general-chat</span>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-og-lime/10 px-2.5 py-1 text-[10px] font-bold text-og-lime">
          <span className="h-1.5 w-1.5 rounded-full bg-og-lime" />
          online
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: "thin" }}>
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 text-white/10" />
              <p className="text-xs text-white/25">No messages yet. Start the conversation!</p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="group flex items-start gap-3">
            <img
              src={safeAvatarUrl(msg.avatar_url) || dicebear(msg.username || "anon")}
              alt=""
              className="mt-0.5 h-8 w-8 rounded-full border border-white/10 object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-og-cyan">@{msg.username || "Anon"}</span>
                <span className="text-[10px] text-white/20">
                  {new Date(msg.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-white/75 break-words">{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-white/[0.07] p-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message #general-chat"
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-og-lime/20 text-og-lime transition hover:bg-og-lime/30 disabled:opacity-30"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Voice Rooms
   ═══════════════════════════════════════════════════════════════ */

const VoiceRooms = ({ members }: { members: CommunityMember[] }) => {
  const { user, profile } = useAuth();
  const [subTab, setSubTab] = useState<VoiceSubTab>("lobby");
  const [inLobby, setInLobby] = useState(false);
  const [rooms, setRooms] = useState<VoiceRoom[]>([]);
  const [lobbyUsers, setLobbyUsers] = useState<CommunityMember[]>([]);

  /* Presence-based lobby */
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("voice-lobby-presence", {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: CommunityMember[] = Object.values(state).flat().map((p: any) => ({
          user_id: p.user_id,
          username: p.username,
          avatar_url: p.avatar_url,
          is_online: true,
        }));
        setLobbyUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && inLobby) {
          await channel.track({
            user_id: user.id,
            username: profile?.username || "Anon",
            avatar_url: profile?.avatar_url,
          });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [user, profile, inLobby]);

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
  }, []);

  const joinLobby = async () => {
    setInLobby(true);
    toast.success("Joined Voice Lobby");
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
    else {
      toast.success("Room created!");
      // Re-fetch
      const { data } = await supabase
        .from("social_voice_rooms")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setRooms(data);
    }
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
          <span className="flex items-center gap-1.5 rounded-full bg-og-lime/10 px-2.5 py-1 text-[10px] font-bold text-og-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-og-lime" />
            online
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

      {/* Sub-tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {subTab === "lobby" && (
          <div>
            {/* Lobby card */}
            <div className="rounded-xl border border-og-lime/20 bg-og-lime/5 p-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-og-lime shadow-[0_0_8px_hsl(var(--og-lime))]" />
                  <h3 className="text-sm font-black text-white">VOICE LOBBY</h3>
                </div>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-bold text-white/40">
                  {lobbyUsers.length} here
                </span>
              </div>
              <p className="mb-4 text-[11px] text-white/40">
                Community voice channel with camera & soundboard support.
              </p>
              <button
                onClick={joinLobby}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold uppercase tracking-wide transition",
                  inLobby
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-gradient-to-r from-og-lime/80 to-og-gold/60 text-black hover:shadow-[0_0_20px_hsl(var(--og-lime)/0.3)]",
                )}
              >
                <Volume2 className="h-4 w-4" />
                {inLobby ? "Leave Voice Lobby" : "Join Voice Lobby"}
              </button>
            </div>

            {/* People in lobby */}
            {lobbyUsers.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  <Users className="h-3 w-3" /> People Here
                </h4>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {lobbyUsers.map((u) => (
                    <div key={u.user_id} className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                      <div className="relative">
                        <img
                          src={safeAvatarUrl(u.avatar_url) || dicebear(u.username || u.user_id)}
                          alt=""
                          className="h-12 w-12 rounded-full border-2 border-og-lime/20 object-cover"
                        />
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0a1018] bg-og-lime" />
                      </div>
                      <span className="max-w-[80px] truncate text-[10px] font-semibold text-white/60">
                        {u.username || "Anon"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {subTab === "people" && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
              <Users className="h-3 w-3" /> Community Members
            </h4>
            <div className="space-y-1.5">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={safeAvatarUrl(m.avatar_url) || dicebear(m.username || m.user_id)}
                      alt=""
                      className="h-9 w-9 rounded-full border border-white/10 object-cover"
                    />
                    <span className="text-xs font-bold text-og-cyan">@{m.username || "Anon"}</span>
                  </div>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full border border-og-lime/20 bg-og-lime/10 text-og-lime transition hover:bg-og-lime/20">
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
                <p className="mt-0.5 text-[10px] text-white/25">{rooms.length} active rooms</p>
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
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition hover:bg-white/[0.05]"
                  >
                    <div>
                      <p className="text-xs font-bold text-white">{room.name}</p>
                      <p className="mt-0.5 text-[10px] text-white/30">
                        by @{room.creator_username || "Anon"} · {room.participant_count} participants
                      </p>
                    </div>
                    <button className="rounded-lg bg-og-lime/15 px-3 py-1.5 text-[10px] font-bold text-og-lime transition hover:bg-og-lime/25">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   Live Stream
   ═══════════════════════════════════════════════════════════════ */

const LiveStream = () => {
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
  }, []);

  const goLive = () => {
    toast.info("Live streaming coming soon!");
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
          <span className="flex items-center gap-1.5 rounded-full bg-og-lime/10 px-2.5 py-1 text-[10px] font-bold text-og-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-og-lime" />
            online
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-white">LIVE STREAMS</h3>
            <p className="text-[10px] text-white/30">{streams.length} active</p>
          </div>
          <button
            onClick={goLive}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-og-lime/80 to-og-gold/60 px-3.5 py-1.5 text-[10px] font-bold text-black transition hover:shadow-[0_0_16px_hsl(var(--og-lime)/0.3)]"
          >
            <Plus className="h-3 w-3" />
            Go Live
          </button>
        </div>

        {streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Radio className="mb-3 h-12 w-12 text-white/[0.07]" />
            <p className="text-sm font-bold text-white/20">NO LIVE STREAMS</p>
            <p className="mt-1 text-[11px] text-white/12">Be the first to go live!</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {streams.map((s: any) => (
              <div
                key={s.id}
                className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 transition hover:bg-red-500/10"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  <span className="text-[10px] font-bold uppercase text-red-400">Live</span>
                </div>
                <p className="text-sm font-bold text-white">{s.title || "Untitled Stream"}</p>
                <p className="mt-1 text-[10px] text-white/30">by @{s.host_username || "Anon"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialHub;
