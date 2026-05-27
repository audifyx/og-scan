/**
 * CoHostingManager — Full co-host management page for Space hosts.
 * Invite co-hosts, set permissions, manage live speaker queue,
 * view analytics per co-host, and handle co-host requests.
 */
import React, { useState, useEffect } from "react";
import {
  Mic, MicOff, Crown, Users, Plus, Search, X, ChevronLeft,
  Shield, Settings, Check, Clock, Ban, Star, Send, ChevronDown,
  BarChart3, Eye, MessageSquare, Volume2, UserPlus, AlertCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useParams } from "react-router-dom";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface CoHost {
  user_id: string;
  space_id: string;
  role: "co_host" | "speaker" | "moderator";
  permissions: CoHostPermissions;
  joined_at: string;
  status: "active" | "invited" | "removed";
  speak_time_seconds: number;
  profiles?: {
    username: string;
    avatar_url: string | null;
    is_verified?: boolean;
  };
}

interface CoHostPermissions {
  can_invite_speakers: boolean;
  can_mute_others: boolean;
  can_remove_speakers: boolean;
  can_pin_content: boolean;
  can_manage_qa: boolean;
}

interface SpeakerRequest {
  id: string;
  space_id: string;
  user_id: string;
  created_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

const DEFAULT_PERMS: CoHostPermissions = {
  can_invite_speakers: true,
  can_mute_others: false,
  can_remove_speakers: false,
  can_pin_content: true,
  can_manage_qa: true,
};

const ROLE_COLORS: Record<string, string> = {
  co_host: "text-violet-400 bg-violet-500/10",
  speaker: "text-emerald-400 bg-emerald-500/10",
  moderator: "text-amber-400 bg-amber-500/10",
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  co_host: Crown,
  speaker: Mic,
  moderator: Shield,
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const Avatar = ({ url, username, size = 9 }: { url: string | null; username?: string; size?: number }) => (
  <div className={cn(`w-${size} h-${size} rounded-full bg-violet-500/20 flex items-center justify-center text-sm font-black text-violet-400 shrink-0 overflow-hidden`)}>
    {url ? <img src={url} alt={username} className="w-full h-full object-cover" /> : username?.[0]?.toUpperCase() || "?"}
  </div>
);

const PermToggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
    <span className="text-sm text-white/60">{label}</span>
    <button onClick={() => onChange(!value)}
      className={cn("relative w-9 h-5 rounded-full transition-colors", value ? "bg-violet-600" : "bg-white/[0.1]")}>
      <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all", value ? "left-4" : "left-0.5")} />
    </button>
  </div>
);

const CoHostCard = ({
  cohost,
  isOwner,
  onRemove,
  onEditPerms,
  onMute,
}: {
  cohost: CoHost;
  isOwner: boolean;
  onRemove: () => void;
  onEditPerms: () => void;
  onMute: () => void;
}) => {
  const RoleIcon = ROLE_ICONS[cohost.role] || Mic;
  const speakMin = Math.floor(cohost.speak_time_seconds / 60);
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.1] transition-all">
      <Avatar url={cohost.profiles?.avatar_url || null} username={cohost.profiles?.username} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-bold text-white truncate">{cohost.profiles?.username || "Unknown"}</p>
          {cohost.profiles?.is_verified && <span className="text-[10px] text-violet-400">✓</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full", ROLE_COLORS[cohost.role])}>
            <RoleIcon className="h-2.5 w-2.5" />
            {cohost.role.replace("_", "-")}
          </span>
          {speakMin > 0 && <span className="text-[10px] text-white/20">{speakMin}m spoken</span>}
          {cohost.status === "invited" && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">Pending</span>}
        </div>
      </div>
      {isOwner && (
        <div className="flex items-center gap-1">
          <button onClick={onMute} className="p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors" title="Mute">
            <MicOff className="h-3.5 w-3.5 text-white/25 hover:text-white/60" />
          </button>
          <button onClick={onEditPerms} className="p-1.5 rounded-xl hover:bg-white/[0.06] transition-colors" title="Permissions">
            <Settings className="h-3.5 w-3.5 text-white/25 hover:text-white/60" />
          </button>
          <button onClick={onRemove} className="p-1.5 rounded-xl hover:bg-red-500/10 transition-colors" title="Remove">
            <X className="h-3.5 w-3.5 text-white/25 hover:text-red-400" />
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const CoHostingManager: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { spaceId } = useParams<{ spaceId: string }>();
  const [cohosts, setCohosts] = useState<CoHost[]>([]);
  const [speakerReqs, setSpeakerReqs] = useState<SpeakerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"cohosts" | "requests" | "invite">("cohosts");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteRole, setInviteRole] = useState<"co_host" | "speaker" | "moderator">("co_host");
  const [editingPerms, setEditingPerms] = useState<CoHost | null>(null);
  const [editPerms, setEditPerms] = useState<CoHostPermissions>(DEFAULT_PERMS);
  const [spaceInfo, setSpaceInfo] = useState<{ title: string; host_id: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [spaceId]);

  const loadData = async () => {
    if (!spaceId) return;
    setLoading(true);
    const [{ data: space }, { data: ch }, { data: reqs }] = await Promise.all([
      supabase.from("spaces").select("title, host_id").eq("id", spaceId).single(),
      supabase.from("space_invites")
        .select("*, profiles!space_invites_invitee_id_fkey(username, avatar_url)")
        .eq("space_id", spaceId)
        .in("status", ["accepted", "pending"]),
      supabase.from("speaker_requests")
        .select("*, profiles(username, avatar_url)")
        .eq("space_id", spaceId)
        .eq("status", "pending"),
    ]);
    setSpaceInfo(space as any);
    setCohosts(((ch || []) as any[]).map(c => ({
      user_id: c.invitee_id,
      space_id: spaceId,
      role: c.role || "co_host",
      permissions: c.permissions || DEFAULT_PERMS,
      joined_at: c.created_at,
      status: c.status === "accepted" ? "active" : "invited",
      speak_time_seconds: c.speak_time_seconds || 0,
      profiles: c.profiles,
    })));
    setSpeakerReqs((reqs || []) as SpeakerRequest[]);
    setLoading(false);
  };

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", `%${q}%`)
      .not("id", "eq", user?.id || "")
      .limit(10);
    setSearchResults(data || []);
    setSearching(false);
  };

  const inviteUser = async (targetUser: any) => {
    if (!spaceId || !user) return;
    const { error } = await supabase.from("space_invites").insert({
      space_id: spaceId,
      inviter_id: user.id,
      invitee_id: targetUser.id,
      role: inviteRole,
      permissions: DEFAULT_PERMS,
      status: "pending",
    });
    if (!error) {
      setCohosts(prev => [...prev, {
        user_id: targetUser.id,
        space_id: spaceId,
        role: inviteRole,
        permissions: DEFAULT_PERMS,
        joined_at: new Date().toISOString(),
        status: "invited",
        speak_time_seconds: 0,
        profiles: targetUser,
      }]);
      setSearchResults(prev => prev.filter(u => u.id !== targetUser.id));
    }
  };

  const removeCoHost = async (userId: string) => {
    if (!spaceId) return;
    await supabase.from("space_invites").delete().eq("space_id", spaceId).eq("invitee_id", userId);
    setCohosts(prev => prev.filter(c => c.user_id !== userId));
  };

  const approveRequest = async (req: SpeakerRequest) => {
    await supabase.from("speaker_requests").update({ status: "approved" }).eq("id", req.id);
    await supabase.from("space_invites").insert({
      space_id: req.space_id,
      inviter_id: user?.id,
      invitee_id: req.user_id,
      role: "speaker",
      permissions: DEFAULT_PERMS,
      status: "accepted",
    });
    setSpeakerReqs(prev => prev.filter(r => r.id !== req.id));
    setCohosts(prev => [...prev, {
      user_id: req.user_id,
      space_id: req.space_id,
      role: "speaker",
      permissions: DEFAULT_PERMS,
      joined_at: new Date().toISOString(),
      status: "active",
      speak_time_seconds: 0,
      profiles: req.profiles,
    }]);
  };

  const denyRequest = async (id: string) => {
    await supabase.from("speaker_requests").update({ status: "denied" }).eq("id", id);
    setSpeakerReqs(prev => prev.filter(r => r.id !== id));
  };

  const savePerms = async () => {
    if (!editingPerms || !spaceId) return;
    await supabase.from("space_invites")
      .update({ permissions: editPerms })
      .eq("space_id", spaceId)
      .eq("invitee_id", editingPerms.user_id);
    setCohosts(prev => prev.map(c => c.user_id === editingPerms.user_id ? { ...c, permissions: editPerms } : c));
    setEditingPerms(null);
  };

  const isOwner = spaceInfo?.host_id === user?.id;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-white/[0.06]">
          <ChevronLeft className="h-5 w-5 text-white/40" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-black text-white">Co-hosting</h1>
          {spaceInfo && <p className="text-xs text-white/30 truncate">{spaceInfo.title}</p>}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          <Users className="h-3.5 w-3.5" />
          <span>{cohosts.filter(c => c.status === "active").length} active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3">
        {([
          { id: "cohosts", label: `Co-hosts (${cohosts.length})` },
          { id: "requests", label: `Requests ${speakerReqs.length > 0 ? `(${speakerReqs.length})` : ""}` },
          { id: "invite", label: "Invite" },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold transition-all",
              activeTab === tab.id ? "bg-violet-600/20 text-violet-400 border border-violet-500/20" : "text-white/30 hover:text-white/60"
            )}
          >{tab.label}</button>
        ))}
      </div>

      <div className="px-4 py-4 space-y-3">
        {/* Co-hosts tab */}
        {activeTab === "cohosts" && (
          <>
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.03] animate-pulse" />)
            ) : cohosts.length === 0 ? (
              <div className="text-center py-12">
                <Crown className="h-10 w-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 font-bold">No co-hosts yet</p>
                <button onClick={() => setActiveTab("invite")} className="mt-3 px-4 py-2 rounded-xl bg-violet-600/20 text-violet-400 text-sm font-bold hover:bg-violet-600/40 transition-colors">
                  Invite Someone
                </button>
              </div>
            ) : (
              cohosts.map(c => (
                <CoHostCard
                  key={c.user_id}
                  cohost={c}
                  isOwner={isOwner}
                  onRemove={() => removeCoHost(c.user_id)}
                  onEditPerms={() => { setEditingPerms(c); setEditPerms(c.permissions); }}
                  onMute={() => {}}
                />
              ))
            )}
          </>
        )}

        {/* Requests tab */}
        {activeTab === "requests" && (
          <>
            {speakerReqs.length === 0 ? (
              <div className="text-center py-12">
                <Mic className="h-10 w-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 font-bold">No speaker requests</p>
              </div>
            ) : (
              speakerReqs.map(req => (
                <div key={req.id} className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <Avatar url={req.profiles?.avatar_url || null} username={req.profiles?.username} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{req.profiles?.username || "Unknown"}</p>
                    <p className="text-xs text-white/30">Wants to speak</p>
                  </div>
                  {isOwner && (
                    <div className="flex gap-1.5">
                      <button onClick={() => approveRequest(req)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors">
                        ✓ Allow
                      </button>
                      <button onClick={() => denyRequest(req.id)}
                        className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors">
                        Deny
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* Invite tab */}
        {activeTab === "invite" && (
          <div className="space-y-4">
            {/* Role selector */}
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wide mb-2">Invite as</p>
              <div className="flex gap-2">
                {(["co_host", "speaker", "moderator"] as const).map(r => (
                  <button key={r} onClick={() => setInviteRole(r)}
                    className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all",
                      inviteRole === r ? "bg-violet-600/20 text-violet-400 border border-violet-500/20" : "bg-white/[0.04] text-white/40 hover:text-white/70"
                    )}>
                    {r.replace("_", "-")}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/25 mt-2">
                {inviteRole === "co_host" ? "Full control over the space" : inviteRole === "moderator" ? "Can mute/remove speakers" : "Can speak, limited controls"}
              </p>
            </div>
            {/* Search */}
            <div>
              <div className="flex items-center gap-2 bg-white/[0.05] rounded-xl px-3 py-2.5 border border-white/[0.06] focus-within:border-violet-500/40 transition-colors">
                <Search className="h-4 w-4 text-white/25 shrink-0" />
                <input
                  value={searchQ}
                  onChange={e => { setSearchQ(e.target.value); searchUsers(e.target.value); }}
                  placeholder="Search by username…"
                  className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/20 outline-none"
                />
              </div>
            </div>
            {/* Results */}
            {searchResults.length > 0 && (
              <div className="space-y-1.5">
                {searchResults.map(u => {
                  const alreadyInvited = cohosts.some(c => c.user_id === u.id);
                  return (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                      <Avatar url={u.avatar_url} username={u.username} />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{u.username}</p>
                      </div>
                      <button
                        onClick={() => !alreadyInvited && inviteUser(u)}
                        disabled={alreadyInvited}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                          alreadyInvited ? "bg-white/[0.04] text-white/20" : "bg-violet-600/20 text-violet-400 hover:bg-violet-600/40 border border-violet-500/20"
                        )}
                      >
                        {alreadyInvited ? "Invited" : "Invite"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Permissions modal */}
      {editingPerms && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#13131f] border border-white/[0.1] rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black text-white">Permissions</h2>
              <button onClick={() => setEditingPerms(null)} className="p-1 rounded-lg hover:bg-white/[0.06]">
                <X className="h-4 w-4 text-white/40" />
              </button>
            </div>
            <p className="text-xs text-white/30 mb-4">{editingPerms.profiles?.username}</p>
            <PermToggle label="Can invite speakers" value={editPerms.can_invite_speakers} onChange={v => setEditPerms(p => ({ ...p, can_invite_speakers: v }))} />
            <PermToggle label="Can mute others" value={editPerms.can_mute_others} onChange={v => setEditPerms(p => ({ ...p, can_mute_others: v }))} />
            <PermToggle label="Can remove speakers" value={editPerms.can_remove_speakers} onChange={v => setEditPerms(p => ({ ...p, can_remove_speakers: v }))} />
            <PermToggle label="Can pin content" value={editPerms.can_pin_content} onChange={v => setEditPerms(p => ({ ...p, can_pin_content: v }))} />
            <PermToggle label="Can manage Q&A" value={editPerms.can_manage_qa} onChange={v => setEditPerms(p => ({ ...p, can_manage_qa: v }))} />
            <button onClick={savePerms} className="w-full mt-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 font-bold text-sm transition-colors">
              Save Permissions
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoHostingManager;
