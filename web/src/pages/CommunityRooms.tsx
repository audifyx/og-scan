/**
 * CommunityRooms — Persistent text-based community rooms tied to Spaces.
 * Users can join topic-based rooms, chat in realtime, share clips/links,
 * see who's online, and get pinned announcements from admins.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Hash, Users, Send, Pin, Bell, BellOff, Search, Plus, Lock, Globe,
  Crown, Mic, MicOff, Settings, X, ChevronLeft, Circle, Flame,
  MessageSquare, Bookmark, Image, Link2, Smile, Volume2, VolumeX
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Room {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  member_count: number;
  online_count: number | null;
  cover_url: string | null;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
  host_id: string;
}

interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  reply_to_id: string | null;
  profiles?: {
    username: string;
    avatar_url: string | null;
    is_verified?: boolean;
  };
}

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
    is_online?: boolean;
  };
}

const CATEGORIES = ["General", "Trading", "NFT", "DeFi", "Memes", "News", "Alpha", "Education"];
const EMOJI_QUICK = ["🔥", "💎", "🚀", "💯", "👀", "😂", "❤️", "🎉"];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const Avatar = ({ url, username, size = 8 }: { url: string | null; username?: string; size?: number }) => (
  <div className={cn(
    `w-${size} h-${size} rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0 overflow-hidden`,
  )}>
    {url ? (
      <img src={url} alt={username} className="w-full h-full object-cover" />
    ) : (
      username?.[0]?.toUpperCase() || "?"
    )}
  </div>
);

const OnlineDot = ({ online }: { online?: boolean }) => (
  <span className={cn(
    "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a0f]",
    online ? "bg-emerald-500" : "bg-white/20"
  )} />
);

const MessageBubble = ({
  msg,
  isOwn,
  onPin,
  canPin,
}: {
  msg: Message;
  isOwn: boolean;
  onPin?: (id: string) => void;
  canPin?: boolean;
}) => {
  const [hovering, setHovering] = useState(false);
  const time = new Date(msg.created_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={cn("flex gap-2.5 group", isOwn ? "flex-row-reverse" : "")}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="relative shrink-0">
        <Avatar url={msg.profiles?.avatar_url || null} username={msg.profiles?.username} size={7} />
      </div>
      <div className={cn("max-w-[75%] min-w-0", isOwn ? "items-end" : "items-start", "flex flex-col gap-0.5")}>
        {!isOwn && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs font-bold text-white/70">{msg.profiles?.username || "Unknown"}</span>
            {msg.profiles?.is_verified && <span className="text-[10px] text-violet-400">✓</span>}
            <span className="text-[10px] text-white/20">{time}</span>
          </div>
        )}
        <div className={cn(
          "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isOwn
            ? "bg-violet-600/70 text-white rounded-tr-sm"
            : "bg-white/[0.06] text-white/90 rounded-tl-sm",
          msg.is_pinned && "ring-1 ring-amber-500/40"
        )}>
          {msg.is_pinned && <Pin className="h-3 w-3 text-amber-400 inline mr-1.5 -mt-0.5" />}
          {msg.content}
        </div>
        {isOwn && <span className="text-[10px] text-white/20 px-1">{time}</span>}
      </div>
      {/* Actions */}
      {hovering && canPin && !msg.is_pinned && (
        <button
          onClick={() => onPin?.(msg.id)}
          className="self-center p-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors"
          title="Pin message"
        >
          <Pin className="h-3 w-3 text-white/40" />
        </button>
      )}
    </div>
  );
};

const RoomCard = ({
  room,
  isActive,
  onClick,
}: {
  room: Room;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
      isActive ? "bg-violet-600/20 border border-violet-500/20" : "hover:bg-white/[0.04] border border-transparent"
    )}
  >
    <div className={cn(
      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
      isActive ? "bg-violet-500/20" : "bg-white/[0.05]"
    )}>
      {!room.is_public ? <Lock className="h-3.5 w-3.5 text-white/40" /> : <Hash className="h-3.5 w-3.5 text-white/40" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <p className={cn("text-sm font-semibold truncate", isActive ? "text-white" : "text-white/70")}>{room.name}</p>
      </div>
      {room.description && (
        <p className="text-xs text-white/25 truncate mt-0.5">{room.description}</p>
      )}
    </div>
    {(room.online_count || 0) > 0 && (
      <div className="flex items-center gap-0.5 shrink-0">
        <Circle className="h-1.5 w-1.5 fill-emerald-500 text-emerald-500" />
        <span className="text-[10px] text-emerald-400 font-bold">{room.online_count}</span>
      </div>
    )}
  </button>
);

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const CommunityRooms: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [newRoomCategory, setNewRoomCategory] = useState("General");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => { loadRooms(); }, []);

  useEffect(() => {
    if (activeRoom) {
      loadMessages(activeRoom.id);
      loadMembers(activeRoom.id);
      subscribeToRoom(activeRoom.id);
    }
    return () => { channelRef.current?.unsubscribe(); };
  }, [activeRoom?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadRooms = async () => {
    setLoadingRooms(true);
    const { data } = await supabase
      .from("community_rooms")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);
    setRooms((data || []) as Room[]);
    if (data && data.length > 0 && !activeRoom) setActiveRoom(data[0] as Room);
    setLoadingRooms(false);
  };

  const loadMessages = async (roomId: string) => {
    setLoadingMessages(true);
    const { data } = await supabase
      .from("community_room_messages")
      .select("*, profiles!community_room_messages_sender_id_fkey(username, avatar_url)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(60);
    setMessages(((data || []) as Message[]).reverse());
    setLoadingMessages(false);
  };

  const loadMembers = async (roomId: string) => {
    const { data } = await supabase
      .from("community_room_members")
      .select("*, profiles(username, avatar_url)")
      .eq("room_id", roomId)
      .limit(50);
    setMembers((data || []) as Member[]);
  };

  const subscribeToRoom = (roomId: string) => {
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`community_room_${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_room_messages", filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const { data: msgWithProfile } = await supabase
            .from("community_room_messages")
            .select("*, profiles!community_room_messages_sender_id_fkey(username, avatar_url)")
            .eq("id", payload.new.id)
            .single();
          if (msgWithProfile) setMessages(prev => [...prev, msgWithProfile as Message]);
        })
      .subscribe();
  };

  const sendMessage = async () => {
    if (!input.trim() || !activeRoom || !user || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    await supabase.from("community_room_messages").insert({
      room_id: activeRoom.id,
      sender_id: user.id,
      content,
    });
    // Update room last_message
    await supabase.from("community_rooms").update({
      updated_at: new Date().toISOString(),
    }).eq("id", activeRoom.id);
    setSending(false);
    inputRef.current?.focus();
  };

  const pinMessage = async (msgId: string) => {
    await supabase.from("community_room_messages").update({ is_pinned: true }).eq("id", msgId);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_pinned: true } : m));
  };

  const createRoom = async () => {
    if (!newRoomName.trim() || !user || creatingRoom) return;
    setCreatingRoom(true);
    const { data: room } = await supabase.from("community_rooms").insert({
      name: newRoomName.trim().toLowerCase().replace(/\s+/g, "-"),
      description: newRoomDesc.trim() || null,
      is_public: !newRoomPrivate,
      host_id: user.id,
      member_count: 1,
      is_voice_enabled: false,
    }).select().single();
    if (room) {
      await supabase.from("community_room_members").insert({ room_id: room.id, user_id: user.id, role: "owner" });
      setRooms(prev => [room as Room, ...prev]);
      setActiveRoom(room as Room);
    }
    setNewRoomName("");
    setNewRoomDesc("");
    setShowCreateModal(false);
    setCreatingRoom(false);
  };

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedMessages = messages.filter(m => m.is_pinned);
  const isAdmin = members.find(m => m.user_id === user?.id)?.role === "admin"
    || members.find(m => m.user_id === user?.id)?.role === "owner";

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-white/[0.06] flex flex-col bg-[#0d0d14]">
        {/* Sidebar header */}
        <div className="p-3 border-b border-white/[0.06] flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
            <ChevronLeft className="h-4 w-4 text-white/40" />
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-black text-white">Rooms</h1>
            <p className="text-[10px] text-white/25">{rooms.length} channels</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 transition-colors"
          >
            <Plus className="h-4 w-4 text-violet-400" />
          </button>
        </div>
        {/* Search */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-white/25 shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Find a room…"
              className="flex-1 bg-transparent text-xs text-white/70 placeholder-white/20 outline-none"
            />
          </div>
        </div>
        {/* Room list */}
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {loadingRooms ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse mx-1 mb-1" />
            ))
          ) : filteredRooms.length === 0 ? (
            <p className="text-xs text-white/20 text-center pt-6">No rooms found</p>
          ) : (
            filteredRooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                isActive={activeRoom?.id === room.id}
                onClick={() => setActiveRoom(room)}
              />
            ))
          )}
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeRoom ? (
          <>
            {/* Room header */}
            <div className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 bg-[#0a0a0f]/80 backdrop-blur">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center">
                  {!activeRoom.is_public ? <Lock className="h-3.5 w-3.5 text-white/40" /> : <Hash className="h-3.5 w-3.5 text-white/40" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{activeRoom.name}</p>
                  {activeRoom.description && (
                    <p className="text-xs text-white/30 truncate">{activeRoom.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1.5 text-xs text-white/30 mr-2">
                  <Users className="h-3.5 w-3.5" />
                  <span>{activeRoom.member_count || members.length}</span>
                </div>
                <button onClick={() => setMuted(!muted)} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
                  {muted ? <VolumeX className="h-4 w-4 text-white/30" /> : <Volume2 className="h-4 w-4 text-white/30" />}
                </button>
                <button onClick={() => setShowMembers(!showMembers)} className={cn("p-1.5 rounded-lg transition-colors", showMembers ? "bg-white/[0.08]" : "hover:bg-white/[0.06]")}>
                  <Users className="h-4 w-4 text-white/30" />
                </button>
              </div>
            </div>

            {/* Pinned messages bar */}
            {pinnedMessages.length > 0 && (
              <div className="px-4 py-2 bg-amber-500/[0.05] border-b border-amber-500/10 flex items-center gap-2">
                <Pin className="h-3 w-3 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300/70 truncate">{pinnedMessages[pinnedMessages.length - 1].content}</p>
              </div>
            )}

            <div className="flex flex-1 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-5 h-5 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="h-10 w-10 text-white/10 mb-3" />
                      <p className="text-sm text-white/30 font-semibold">No messages yet</p>
                      <p className="text-xs text-white/20 mt-1">Be the first to say something!</p>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isOwn={msg.sender_id === user?.id}
                        onPin={pinMessage}
                        canPin={isAdmin}
                      />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-white/[0.06] px-4 py-3">
                  <div className="flex items-end gap-2 bg-white/[0.04] rounded-2xl px-3 py-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
                      >
                        <Smile className="h-4 w-4 text-white/30" />
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute bottom-8 left-0 bg-[#1a1a2e] border border-white/[0.1] rounded-xl p-2 flex gap-1 z-20">
                          {EMOJI_QUICK.map(e => (
                            <button key={e} onClick={() => { setInput(prev => prev + e); setShowEmojiPicker(false); }}
                              className="text-lg hover:scale-125 transition-transform">
                              {e}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder={`Message #${activeRoom.name}`}
                      className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 outline-none resize-none"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || sending}
                      className={cn(
                        "p-1.5 rounded-xl transition-all",
                        input.trim() ? "bg-violet-600 hover:bg-violet-500 text-white" : "bg-white/[0.04] text-white/20"
                      )}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Members panel */}
              {showMembers && (
                <div className="w-52 border-l border-white/[0.06] flex flex-col bg-[#0d0d14]">
                  <div className="p-3 border-b border-white/[0.06]">
                    <p className="text-xs font-bold text-white/50 uppercase tracking-wide">Members ({members.length})</p>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                    {members.map(m => (
                      <div key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
                        <div className="relative">
                          <Avatar url={m.profiles?.avatar_url || null} username={m.profiles?.username} size={7} />
                          <OnlineDot online={m.profiles?.is_online} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white/70 truncate">{m.profiles?.username || "Unknown"}</p>
                          {m.role !== "member" && (
                            <p className="text-[10px] text-violet-400/70 capitalize">{m.role}</p>
                          )}
                        </div>
                        {m.role === "owner" && <Crown className="h-3 w-3 text-amber-400 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <Hash className="h-12 w-12 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 font-semibold">Select a room to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Create room modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#13131f] border border-white/[0.1] rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-white">Create a Room</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-white/[0.06]">
                <X className="h-4 w-4 text-white/40" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 font-bold uppercase tracking-wide mb-1.5 block">Room Name</label>
                <div className="flex items-center gap-1.5 bg-white/[0.05] rounded-xl px-3 py-2.5">
                  <Hash className="h-3.5 w-3.5 text-white/30 shrink-0" />
                  <input
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    placeholder="my-room"
                    className="flex-1 bg-transparent text-sm text-white/80 outline-none placeholder-white/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 font-bold uppercase tracking-wide mb-1.5 block">Description (optional)</label>
                <input
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  placeholder="What's this room about?"
                  className="w-full bg-white/[0.05] rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none placeholder-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 font-bold uppercase tracking-wide mb-1.5 block">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setNewRoomCategory(cat)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold transition-all",
                        newRoomCategory === cat ? "bg-violet-600 text-white" : "bg-white/[0.05] text-white/40 hover:text-white/70"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNewRoomPrivate(!newRoomPrivate)}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    newRoomPrivate ? "bg-violet-600" : "bg-white/[0.1]"
                  )}
                >
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", newRoomPrivate ? "left-5" : "left-0.5")} />
                </button>
                <span className="text-sm text-white/60">Private room</span>
              </div>
              <button
                onClick={createRoom}
                disabled={!newRoomName.trim() || creatingRoom}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-bold transition-colors disabled:opacity-40"
              >
                {creatingRoom ? "Creating…" : "Create Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityRooms;
