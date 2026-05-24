/**
 * Spaces — Live voice rooms and topic spaces. Rendered inline inside Index.tsx.
 * Do NOT wrap in AppLayout.
 */
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Mic, MicOff, Volume2, Users, Plus, Radio, Sparkles, Globe, Lock,
  Hash, Flame, Clock, Crown, X as XIcon, ChevronRight, Headphones,
  MessageSquare, TrendingUp, Zap, Star, PlayCircle, StopCircle,
  ChevronDown, Loader2, Eye
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { VoicePanel } from "@/components/lobbies/VoicePanel";
import { formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Space {
  id: string;
  title: string;
  description: string | null;
  host_id: string;
  host_username: string | null;
  host_avatar: string | null;
  topic: string | null;
  is_live: boolean;
  is_private: boolean;
  listener_count: number;
  speaker_count: number;
  created_at: string;
  scheduled_for: string | null;
  ended_at: string | null;
  tags: string[] | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOPICS = ["Trading", "Alpha", "NFTs", "DeFi", "Memes", "Research", "Tech", "General"];
const TOPIC_COLORS: Record<string, string> = {
  Trading: "text-sky-400 bg-sky-400/10 border-sky-400/20",
  Alpha: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  NFTs: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  DeFi: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Memes: "text-pink-400 bg-pink-400/10 border-pink-400/20",
  Research: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  Tech: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  General: "text-white/40 bg-white/5 border-white/10",
};

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const GRAD_PAIRS = [
  "from-violet-600/30 to-purple-900/10",
  "from-sky-600/30 to-blue-900/10",
  "from-emerald-600/30 to-green-900/10",
  "from-amber-600/30 to-orange-900/10",
  "from-rose-600/30 to-pink-900/10",
  "from-cyan-600/30 to-teal-900/10",
];

function spaceGrad(id: string) {
  return GRAD_PAIRS[strHash(id) % GRAD_PAIRS.length];
}

function safeAvatar(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const s = url.trim();
  if (!s || s === "default" || !s.startsWith("http")) return undefined;
  return s;
}

// ─── Create Space Modal ───────────────────────────────────────────────────────

const CreateSpaceModal = ({ onClose, onCreated, user, profile }: {
  onClose: () => void;
  onCreated: (space: Space) => void;
  user: { id: string } | null;
  profile: { username?: string | null; avatar_url?: string | null } | null;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("General");
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      const insertData: any = {
        title: title.trim(),
        description: description.trim() || null,
        host_id: user.id,
        host_username: profile?.username || null,
        host_avatar: safeAvatar(profile?.avatar_url) ?? null,
        topic,
        is_live: true,
        is_private: isPrivate,
        listener_count: 1,
        speaker_count: 1,
      };
      const { data, error } = await supabase.from("spaces").insert(insertData).select().single();
      if (error) throw error;
      toast.success("Space started! 🎙️");
      onCreated(data as Space);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to start space. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[#0d1117] rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2"><Radio className="h-5 w-5 text-primary" /> Start a Space</h2>
            <p className="text-xs text-white/40 mt-0.5">Go live with voice to your community</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><XIcon className="h-4 w-4 text-white/50" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Space Title *</label>
            <Input
              placeholder="e.g. Solana Alpha Call — New Launches"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="bg-white/[0.04] border-white/10 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1.5 block">Description</label>
            <Textarea
              placeholder="What's this space about?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="bg-white/[0.04] border-white/10 rounded-xl resize-none min-h-[72px] text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2 block">Topic</label>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS.map(t => (
                <button key={t} onClick={() => setTopic(t)} className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${topic === t ? "bg-primary/20 border-primary/50 text-primary" : "border-white/10 text-white/40 hover:border-white/20"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-bold text-white">Private Space</p>
              <p className="text-xs text-white/40">Only invited users can join</p>
            </div>
            <button onClick={() => setIsPrivate(v => !v)} className={`w-11 h-6 rounded-full transition-colors relative ${isPrivate ? "bg-primary" : "bg-white/10"}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isPrivate ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
        <div className="px-5 pb-5">
          <Button onClick={handleCreate} disabled={!title.trim() || creating} className="w-full rounded-full btn-3d font-bold gap-2">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mic className="h-4 w-4" /> Go Live</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Space Card ───────────────────────────────────────────────────────────────

const SpaceCard = ({ space, onJoin }: { space: Space; onJoin: (s: Space) => void }) => {
  const topicColor = TOPIC_COLORS[space.topic || "General"] || TOPIC_COLORS.General;
  const grad = spaceGrad(space.id);
  const totalPeople = (space.listener_count || 0) + (space.speaker_count || 0);

  return (
    <button
      onClick={() => onJoin(space)}
      className={`w-full text-left p-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br ${grad} hover:border-white/20 transition-all group relative overflow-hidden`}
    >
      {/* Live pulse */}
      {space.is_live && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Live</span>
        </div>
      )}

      <div className="pr-16">
        {space.topic && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border mb-2 ${topicColor}`}>
            <Hash className="h-2.5 w-2.5" />{space.topic}
          </span>
        )}
        <h3 className="font-black text-sm text-white leading-tight">{space.title}</h3>
        {space.description && <p className="text-xs text-white/40 mt-1 line-clamp-1">{space.description}</p>}
      </div>

      {/* Host + listeners */}
      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1.5">
          {/* Host avatar */}
          <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden shrink-0">
            {safeAvatar(space.host_avatar) ? (
              <img src={safeAvatar(space.host_avatar)} alt="" className="w-full h-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = "none"} />
            ) : (
              <Crown className="h-3 w-3 text-primary" />
            )}
          </div>
          <span className="text-xs text-white/60">{space.host_username ? `@${space.host_username}` : "Host"}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/30 ml-auto">
          <Headphones className="h-3 w-3" />
          <span>{totalPeople.toLocaleString()} listening</span>
        </div>
        {space.is_private && <Lock className="h-3 w-3 text-white/20" />}
      </div>
    </button>
  );
};

// ─── Active Space Room ────────────────────────────────────────────────────────

const SpaceRoom = ({ space, onLeave }: { space: Space; onLeave: () => void }) => {
  const { user, profile } = useAuth();
  const [muted, setMuted] = useState(true);
  const isHost = user?.id === space.host_id;
  const topicColor = TOPIC_COLORS[space.topic || "General"] || TOPIC_COLORS.General;

  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.07] sticky top-0 bg-[#070d14] z-10">
        <button onClick={onLeave} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <XIcon className="h-4 w-4 text-white/60" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-white truncate">{space.title}</h3>
          {space.topic && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${topicColor}`}>
              <Hash className="h-2 w-2" />{space.topic}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-red-400">
          <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" /></span>
          Live
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Host */}
        <div className="mb-5">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1"><Crown className="h-3 w-3" />Host</p>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/40 to-violet-600/40 border-2 border-primary/30 flex items-center justify-center font-black text-lg overflow-hidden">
              {safeAvatar(space.host_avatar) ? (
                <img src={safeAvatar(space.host_avatar)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{space.host_username?.[0]?.toUpperCase() ?? "H"}</span>
              )}
            </div>
            <div>
              <p className="font-bold text-sm text-white">{space.host_username ? `@${space.host_username}` : "Host"}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Mic className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-bold">Speaking</span>
              </div>
            </div>
            <div className="ml-auto flex gap-1">
              {[1,2,3].map(i => (
                <div key={i} className="w-0.5 rounded-full bg-emerald-400 animate-pulse" style={{ height: `${8 + i * 5}px`, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Voice Panel */}
        <VoicePanel lobbyId={`space-${space.id}`} lobbyName={space.title} autoJoin />

        {/* Listeners section */}
        <div className="mt-4">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Headphones className="h-3 w-3" />Listeners · {space.listener_count}
          </p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: Math.min(space.listener_count || 5, 10) }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center">
                  <Headphones className="h-4 w-4 text-white/30" />
                </div>
                <span className="text-[9px] text-white/20">Listener</span>
              </div>
            ))}
            {user && (
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center font-bold text-sm overflow-hidden">
                  {safeAvatar(profile?.avatar_url) ? (
                    <img src={safeAvatar(profile?.avatar_url)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{profile?.username?.[0]?.toUpperCase() ?? "Y"}</span>
                  )}
                </div>
                <span className="text-[9px] text-primary/70">You</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {space.description && (
          <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
            <p className="text-xs text-white/50 leading-relaxed">{space.description}</p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="px-4 pb-5 pt-3 border-t border-white/[0.07] flex items-center justify-between">
        <button
          onClick={() => { setMuted(v => !v); toast(muted ? "Unmuted 🎙️" : "Muted 🔇"); }}
          className={`flex items-center gap-2 px-5 h-11 rounded-full font-bold text-sm transition-all ${muted ? "bg-white/10 text-white/60 hover:bg-white/15" : "bg-primary text-white shadow-lg shadow-primary/30"}`}
        >
          {muted ? <><MicOff className="h-4 w-4" /> Unmute</> : <><Mic className="h-4 w-4" /> Speaking</>}
        </button>
        <button onClick={onLeave} className="h-11 px-5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors">
          Leave
        </button>
      </div>
    </div>
  );
};

// ─── Main Spaces Component ────────────────────────────────────────────────────

const Spaces = () => {
  const { user, profile } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [tab, setTab] = useState<"live" | "scheduled">("live");

  const fetchSpaces = async () => {
    try {
      const { data } = await supabase
        .from("spaces")
        .select("*")
        .eq("is_live", true)
        .order("listener_count", { ascending: false })
        .limit(30);
      setSpaces((data as Space[]) || []);
    } catch {
      // DB error — show empty list so users can start fresh
      setSpaces([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSpaces(); }, []);

  const handleCreated = (space: Space) => {
    setSpaces(prev => [space, ...prev]);
    setActiveSpace(space);
  };

  const liveSpaces = spaces.filter(s => s.is_live && (!topicFilter || s.topic === topicFilter));
  const scheduledSpaces = spaces.filter(s => !s.is_live && (!topicFilter || s.topic === topicFilter));

  const totalListeners = liveSpaces.reduce((sum, s) => sum + (s.listener_count || 0), 0);

  if (activeSpace) {
    return <SpaceRoom space={activeSpace} onLeave={() => { setActiveSpace(null); fetchSpaces(); }} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Spaces
          </h2>
          {liveSpaces.length > 0 && (
            <p className="text-xs text-white/30 mt-0.5">{liveSpaces.length} live · {totalListeners.toLocaleString()} listening now</p>
          )}
        </div>
        <Button onClick={() => setShowCreate(true)} className="rounded-full btn-3d gap-1.5 text-xs h-8 px-3" size="sm">
          <Mic className="h-3.5 w-3.5" /> Start
        </Button>
      </div>

      {/* Live / Scheduled tabs */}
      <div className="flex border-b border-white/[0.07] mb-4">
        {[{ key: "live", label: "Live Now" }, { key: "scheduled", label: "Scheduled" }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as "live" | "scheduled")}
            className={`px-4 py-2.5 text-[12px] font-bold transition-colors relative ${tab === t.key ? "text-white" : "text-white/35 hover:text-white/60"}`}
          >
            {t.key === "live" && liveSpaces.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
            {t.label}
            {tab === t.key && <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* Topic filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
        <button onClick={() => setTopicFilter(null)} className={`px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 transition-colors ${!topicFilter ? "bg-primary/15 border-primary/50 text-primary" : "border-white/10 text-white/40 hover:border-white/20"}`}>All</button>
        {TOPICS.map(t => (
          <button key={t} onClick={() => setTopicFilter(topicFilter === t ? null : t)} className={`px-3 py-1 rounded-full text-[11px] font-bold border shrink-0 transition-colors ${topicFilter === t ? "bg-primary/15 border-primary/50 text-primary" : "border-white/10 text-white/40 hover:border-white/20"}`}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : tab === "live" ? (
        liveSpaces.length === 0 ? (
          <div className="text-center py-20">
            <Radio className="h-14 w-14 mx-auto mb-3 text-white/10" />
            <p className="font-bold text-white/30">No live spaces right now</p>
            <p className="text-sm text-white/20 mt-1">Be the first to start one!</p>
            <Button onClick={() => setShowCreate(true)} className="mt-4 rounded-full btn-3d gap-2 text-sm">
              <Mic className="h-4 w-4" /> Start a Space
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {/* Featured space */}
            {liveSpaces[0] && (
              <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Flame className="h-3 w-3 text-orange-400" />Featured
                </p>
                <SpaceCard space={liveSpaces[0]} onJoin={setActiveSpace} />
              </div>
            )}
            {liveSpaces.length > 1 && (
              <div>
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">More Spaces</p>
                {liveSpaces.slice(1).map(s => <SpaceCard key={s.id} space={s} onJoin={setActiveSpace} />)}
              </div>
            )}
          </div>
        )
      ) : (
        scheduledSpaces.length === 0 ? (
          <div className="text-center py-20">
            <Clock className="h-14 w-14 mx-auto mb-3 text-white/10" />
            <p className="font-bold text-white/30">No scheduled spaces</p>
            <p className="text-sm text-white/20 mt-1">Schedule a space to notify your followers</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {scheduledSpaces.map(s => (
              <div key={s.id} className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-white">{s.title}</h3>
                    {s.topic && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-1 ${TOPIC_COLORS[s.topic] || TOPIC_COLORS.General}`}>
                        <Hash className="h-2.5 w-2.5" />{s.topic}
                      </span>
                    )}
                    {s.scheduled_for && (
                      <p className="text-xs text-white/40 mt-1">
                        Starts {formatDistanceToNow(new Date(s.scheduled_for), { addSuffix: true })}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-white/40">{s.host_username ? `@${s.host_username}` : "Host"}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-full text-xs h-7 border-white/10 shrink-0">
                    Remind
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showCreate && (
        <CreateSpaceModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          user={user}
          profile={profile}
        />
      )}
    </div>
  );
};

export default Spaces;
