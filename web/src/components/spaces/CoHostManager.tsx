/**
 * CoHostManager — Manage co-hosts with granular permissions.
 * Host can promote listeners/speakers to co-host with specific permissions.
 */
import React, { useState } from "react";
import { Shield, Crown, X, Check, UserPlus, Settings, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CoHostPermissions {
  canMuteSpeakers: boolean;
  canPromoteSpeakers: boolean;
  canRemoveUsers: boolean;
  canPinMessages: boolean;
  canCreatePolls: boolean;
  canEndSpace: boolean;
}

export interface CoHost {
  userId: string;
  username: string;
  avatarUrl: string | null;
  permissions: CoHostPermissions;
}

const DEFAULT_PERMISSIONS: CoHostPermissions = {
  canMuteSpeakers: true,
  canPromoteSpeakers: true,
  canRemoveUsers: false,
  canPinMessages: true,
  canCreatePolls: true,
  canEndSpace: false,
};

const PERMISSION_LABELS: { key: keyof CoHostPermissions; label: string; icon: string }[] = [
  { key: "canMuteSpeakers", label: "Mute speakers", icon: "🔇" },
  { key: "canPromoteSpeakers", label: "Promote to speaker", icon: "🎤" },
  { key: "canRemoveUsers", label: "Remove users", icon: "🚫" },
  { key: "canPinMessages", label: "Pin messages", icon: "📌" },
  { key: "canCreatePolls", label: "Create polls", icon: "📊" },
  { key: "canEndSpace", label: "End space", icon: "⛔" },
];

interface CoHostManagerProps {
  isHost: boolean;
  coHosts: CoHost[];
  participants: { userId: string; username: string; avatarUrl: string | null }[];
  onAddCoHost: (userId: string, permissions: CoHostPermissions) => void;
  onRemoveCoHost: (userId: string) => void;
  onUpdatePermissions: (userId: string, permissions: CoHostPermissions) => void;
}

const CoHostManager: React.FC<CoHostManagerProps> = ({
  isHost, coHosts, participants, onAddCoHost, onRemoveCoHost, onUpdatePermissions,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<CoHostPermissions>(DEFAULT_PERMISSIONS);
  const [editingCoHost, setEditingCoHost] = useState<string | null>(null);

  if (!isHost) return null;

  const nonCoHosts = participants.filter(p => !coHosts.find(ch => ch.userId === p.userId));

  const handleAdd = () => {
    if (!selectedUser) return;
    onAddCoHost(selectedUser, editPerms);
    setShowAdd(false);
    setSelectedUser(null);
    setEditPerms(DEFAULT_PERMISSIONS);
  };

  return (
    <div className="space-y-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full px-1">
        <div className="flex items-center gap-2">
          <Crown className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[11px] font-bold text-white/50">Co-Hosts</span>
          {coHosts.length > 0 && (
            <span className="text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-500/10">{coHosts.length}</span>
          )}
        </div>
        <ChevronUp className={cn("h-3 w-3 text-white/20 transition-transform", !expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="space-y-2">
          {/* Current co-hosts */}
          {coHosts.map(ch => (
            <div key={ch.userId} className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center overflow-hidden">
                  {ch.avatarUrl ? <img src={ch.avatarUrl} alt="" className="w-full h-full object-cover" /> :
                    <span className="text-[9px] font-bold text-white/30">{ch.username?.[0]?.toUpperCase() || "?"}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-white/70">{ch.username}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Crown className="h-2.5 w-2.5 text-amber-400" />
                    <span className="text-[9px] text-amber-400/60 font-bold">Co-Host</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => {
                    setEditingCoHost(editingCoHost === ch.userId ? null : ch.userId);
                    setEditPerms(ch.permissions);
                  }} className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/20 hover:text-white/50 transition-all">
                    <Settings className="h-3 w-3" />
                  </button>
                  <button onClick={() => onRemoveCoHost(ch.userId)}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Edit permissions */}
              {editingCoHost === ch.userId && (
                <div className="space-y-1 pt-2 border-t border-white/[0.04]">
                  {PERMISSION_LABELS.map(p => (
                    <button key={p.key} onClick={() => {
                      const updated = { ...editPerms, [p.key]: !editPerms[p.key] };
                      setEditPerms(updated);
                      onUpdatePermissions(ch.userId, updated);
                    }}
                      className={cn(
                        "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-[10px] transition-all",
                        editPerms[p.key] ? "bg-emerald-500/[0.05] text-emerald-400/70" : "bg-white/[0.02] text-white/25"
                      )}>
                      <span>{p.icon}</span>
                      <span className="flex-1 text-left font-medium">{p.label}</span>
                      {editPerms[p.key] && <Check className="h-2.5 w-2.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Add co-host */}
          {showAdd ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#0c1219] p-3 space-y-3">
              <p className="text-[10px] text-white/30 font-bold">Select user to promote</p>
              <div className="max-h-28 overflow-y-auto space-y-1" style={{ scrollbarWidth: "none" }}>
                {nonCoHosts.map(p => (
                  <button key={p.userId} onClick={() => setSelectedUser(p.userId)}
                    className={cn(
                      "flex items-center gap-2 w-full px-2.5 py-2 rounded-lg transition-all",
                      selectedUser === p.userId ? "bg-amber-500/10 border border-amber-500/20" : "bg-white/[0.03] border border-transparent hover:bg-white/[0.05]"
                    )}>
                    <div className="w-5 h-5 rounded-full bg-white/[0.05] flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white/30">{p.username?.[0]?.toUpperCase() || "?"}</span>
                    </div>
                    <span className="text-[10px] text-white/50 font-medium">{p.username}</span>
                  </button>
                ))}
                {nonCoHosts.length === 0 && <p className="text-[10px] text-white/15 text-center py-2">No eligible users</p>}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] font-bold text-white/30 hover:bg-white/[0.08] transition-all">Cancel</button>
                <button onClick={handleAdd} disabled={!selectedUser}
                  className="flex-1 py-2 rounded-lg bg-amber-400 text-black text-[10px] font-black transition-all disabled:opacity-30 flex items-center justify-center gap-1">
                  <Crown className="h-3 w-3" /> Make Co-Host
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] font-bold text-white/25 hover:text-amber-400 hover:border-amber-500/20 transition-all w-full justify-center">
              <UserPlus className="h-3 w-3" /> Add Co-Host
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CoHostManager;
