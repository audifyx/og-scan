/**
 * UserProfile — Comprehensive user profile page.
 * Stats, badges, activity history, settings, connected integrations.
 */
import { useState } from "react";
import { User, Star, Trophy, Shield, Flame, Target, Settings, History, Bell, Eye, Moon, Sun, ChevronDown, ChevronUp, Copy, Check, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UserSettings {
  displayName: string;
  bio: string;
  theme: "dark" | "light" | "auto";
  notifications: boolean;
  soundEffects: boolean;
  publicProfile: boolean;
}

interface Props {
  userId?: string;
  username?: string;
}

const STORAGE_KEY = "ogscan_user_profile";

function loadProfile(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    displayName: "OG User",
    bio: "",
    theme: "dark",
    notifications: true,
    soundEffects: true,
    publicProfile: false,
  };
}
function saveProfile(settings: UserSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export const UserProfile: React.FC<Props> = ({ userId = "anon", username = "OG" }) => {
  const [settings, setSettings] = useState<UserSettings>(loadProfile);
  const [activeTab, setActiveTab] = useState<"overview" | "settings" | "activity">("overview");
  const [copied, setCopied] = useState(false);

  const updateSettings = (update: Partial<UserSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...update };
      saveProfile(next);
      return next;
    });
    toast.success("Settings saved!");
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Stats from localStorage
  const scanCount = (() => {
    try {
      return JSON.parse(localStorage.getItem("ogscan_scan_history") || "[]").length;
    } catch { return 0; }
  })();
  const watchlistCount = (() => {
    try {
      return JSON.parse(localStorage.getItem("ogscan_watchlist") || "[]").length;
    } catch { return 0; }
  })();

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* Profile header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-black text-white">{settings.displayName}</p>
            {settings.bio && <p className="text-[10px] text-white/30 mt-0.5">{settings.bio}</p>}
            <button onClick={copyUserId} className="flex items-center gap-1 text-[9px] text-white/20 hover:text-white/40 mt-0.5">
              ID: {userId.slice(0, 12)}...
              {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-sm font-black text-white">{scanCount}</p>
            <p className="text-[8px] text-white/20">Scans</p>
          </div>
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-sm font-black text-white">{watchlistCount}</p>
            <p className="text-[8px] text-white/20">Watchlist</p>
          </div>
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-sm font-black text-white">0</p>
            <p className="text-[8px] text-white/20">Spaces</p>
          </div>
          <div className="rounded-lg bg-black/20 p-2 text-center">
            <p className="text-sm font-black text-white">1</p>
            <p className="text-[8px] text-white/20">Level</p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-white/[0.06]">
        {(["overview", "settings", "activity"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn("flex-1 py-2.5 text-[10px] font-bold transition-all",
              activeTab === tab
                ? "text-primary border-b-2 border-primary"
                : "text-white/20 hover:text-white/40"
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "overview" && (
          <div className="space-y-3">
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
              <p className="text-[9px] text-white/20 uppercase tracking-wider mb-2">Achievements</p>
              <div className="flex gap-2 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg" title="First Scan">
                  🔍
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg" title="Early Adopter">
                  ⭐
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-lg" title="Explorer">
                  🗺️
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-3">
            <div>
              <label className="text-[9px] text-white/20 uppercase tracking-wider">Display Name</label>
              <Input
                value={settings.displayName}
                onChange={e => updateSettings({ displayName: e.target.value })}
                className="mt-1 h-8 text-xs bg-white/[0.03] border-white/[0.08]"
              />
            </div>
            <div>
              <label className="text-[9px] text-white/20 uppercase tracking-wider">Bio</label>
              <Input
                value={settings.bio}
                onChange={e => updateSettings({ bio: e.target.value })}
                placeholder="Tell us about yourself..."
                className="mt-1 h-8 text-xs bg-white/[0.03] border-white/[0.08]"
              />
            </div>

            {/* Toggle settings */}
            {[
              { key: "notifications" as const, label: "Notifications", icon: <Bell className="h-3.5 w-3.5" /> },
              { key: "soundEffects" as const, label: "Sound Effects", icon: <Target className="h-3.5 w-3.5" /> },
              { key: "publicProfile" as const, label: "Public Profile", icon: <Eye className="h-3.5 w-3.5" /> },
            ].map(toggle => (
              <button
                key={toggle.key}
                onClick={() => updateSettings({ [toggle.key]: !settings[toggle.key] })}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-white/[0.06] hover:bg-white/[0.015] transition-colors"
              >
                <span className="text-white/20">{toggle.icon}</span>
                <span className="text-[11px] text-white/50 flex-1 text-left">{toggle.label}</span>
                <div className={cn("w-8 h-4 rounded-full transition-all",
                  settings[toggle.key] ? "bg-primary" : "bg-white/10"
                )}>
                  <div className={cn("w-3 h-3 rounded-full bg-white transition-all mt-0.5",
                    settings[toggle.key] ? "ml-4.5" : "ml-0.5"
                  )} />
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="text-center py-6">
            <History className="h-8 w-8 text-white/[0.06] mx-auto mb-2" />
            <p className="text-xs text-white/20">Activity feed coming soon</p>
            <p className="text-[10px] text-white/10 mt-1">Your scans, trades, and interactions will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
