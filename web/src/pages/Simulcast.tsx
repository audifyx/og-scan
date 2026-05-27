/**
 * Simulcast — ogscan.fun/simulcast
 *
 * Feature 17: Multi-Platform Simulcast
 * - Broadcast one space simultaneously to: OG Scan + X Spaces + YouTube Live + LinkedIn Live
 * - Single dashboard to manage all streams
 * - Unified chat that merges comments from all platforms
 * - Platform-specific analytics shown side by side
 * - Stream key management per platform
 * - Live / offline indicators per platform
 */
import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Radio, Tv, Twitter, Linkedin, Youtube, Globe, Users,
  MessageSquare, TrendingUp, Settings, Plus, Trash2, Eye,
  EyeOff, Copy, Check, AlertCircle, Zap, BarChart2,
  Signal, SignalHigh, Wifi, WifiOff, Play, Square,
  ChevronRight, ExternalLink, RefreshCw, Heart, Share2
} from "lucide-react";

interface Platform {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  isConnected: boolean;
  isLive: boolean;
  streamKey: string;
  viewers: number;
  chatMessages: number;
  likes: number;
}

interface UnifiedMessage {
  id: string;
  platform: string;
  platformColor: string;
  platformIcon: string;
  user: string;
  text: string;
  timestamp: string;
  type: "chat" | "like" | "join" | "tip";
}

const MOCK_MESSAGES: UnifiedMessage[] = [
  { id: "1", platform: "OG Scan", platformColor: "text-violet-400", platformIcon: "🔮", user: "drfootcare", text: "Amazing insight on carbon fiber composites!", timestamp: "now", type: "chat" },
  { id: "2", platform: "YouTube", platformColor: "text-red-400", platformIcon: "▶", user: "OrthoTech_Fan", text: "Just found this channel — subscribed!", timestamp: "1s", type: "chat" },
  { id: "3", platform: "X", platformColor: "text-sky-400", platformIcon: "𝕏", user: "@biomech_sarah", text: "Love the point about accessibility 🔥", timestamp: "2s", type: "chat" },
  { id: "4", platform: "LinkedIn", platformColor: "text-blue-400", platformIcon: "in", user: "James Okafor", text: "This should be mandatory viewing for every prosthetist.", timestamp: "5s", type: "chat" },
  { id: "5", platform: "OG Scan", platformColor: "text-violet-400", platformIcon: "🔮", user: "practitioner99", text: "How do I get early access to the new scanning API?", timestamp: "8s", type: "chat" },
  { id: "6", platform: "YouTube", platformColor: "text-red-400", platformIcon: "▶", user: "MedTechWeekly", text: "Sharing this on our channel 👏", timestamp: "12s", type: "chat" },
  { id: "7", platform: "X", platformColor: "text-sky-400", platformIcon: "𝕏", user: "@orthogenix_fan", text: "OG Scan is changing the game fr", timestamp: "15s", type: "chat" },
];

const initialPlatforms: Platform[] = [
  { id: "ogscan", name: "OG Scan", icon: Radio, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", isConnected: true, isLive: false, streamKey: "ogscan_live_●●●●●●●●", viewers: 0, chatMessages: 0, likes: 0 },
  { id: "youtube", name: "YouTube Live", icon: Youtube, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", isConnected: false, isLive: false, streamKey: "", viewers: 0, chatMessages: 0, likes: 0 },
  { id: "x", name: "X (Twitter)", icon: Globe, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", isConnected: false, isLive: false, streamKey: "", viewers: 0, chatMessages: 0, likes: 0 },
  { id: "linkedin", name: "LinkedIn Live", icon: Linkedin, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", isConnected: false, isLive: false, streamKey: "", viewers: 0, chatMessages: 0, likes: 0 },
];

const Simulcast = () => {
  const { user } = useAuth();
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
  const navigate = useNavigate();
  const [isSimulcasting, setIsSimulcasting] = useState(false);
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "analytics">("dashboard");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const msgRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSimulcasting) {
      let msgIdx = 0;
      const msgInterval = setInterval(() => {
        if (msgIdx < MOCK_MESSAGES.length) {
          setMessages(prev => [MOCK_MESSAGES[msgIdx], ...prev].slice(0, 50));
          msgIdx++;
        }
        // Update viewer counts
        setPlatforms(prev => prev.map(p => p.isLive ? {
          ...p,
          viewers: Math.max(0, p.viewers + Math.floor(Math.random() * 8) - 1),
          chatMessages: p.chatMessages + Math.floor(Math.random() * 3),
          likes: p.likes + Math.floor(Math.random() * 5),
        } : p));
      }, 2000);
      return () => clearInterval(msgInterval);
    }
  }, [isSimulcasting]);

  const startSimulcast = () => {
    const connectedPlatforms = platforms.filter(p => p.isConnected);
    if (connectedPlatforms.length === 0) { toast({ title: "Connect at least one platform first", variant: "destructive" }); return; }
    setPlatforms(prev => prev.map(p => p.isConnected ? { ...p, isLive: true, viewers: p.id === "ogscan" ? 48 : Math.floor(Math.random() * 30) + 5 } : p));
    setIsSimulcasting(true);
    toast({ title: `Going live on ${connectedPlatforms.length} platforms 🔴` });
  };

  const stopSimulcast = () => {
    setPlatforms(prev => prev.map(p => ({ ...p, isLive: false })));
    setIsSimulcasting(false);
    toast({ title: "Stream ended" });
  };

  const toggleConnect = (id: string) => {
    if (id === "ogscan") return; // always connected
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, isConnected: !p.isConnected } : p));
  };

  const saveKey = (id: string) => {
    setPlatforms(prev => prev.map(p => p.id === id ? { ...p, streamKey: keyValue, isConnected: true } : p));
    setEditingKey(null);
    setKeyValue("");
    toast({ title: "Stream key saved" });
  };

  const totalViewers = platforms.reduce((sum, p) => sum + p.viewers, 0);
  const totalMessages = platforms.reduce((sum, p) => sum + p.chatMessages, 0);
  const totalLikes = platforms.reduce((sum, p) => sum + p.likes, 0);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#080a0f] text-white">
        {/* Header */}
        <div className="border-b border-white/[0.06] bg-gradient-to-r from-red-900/10 via-[#080a0f] to-blue-900/10">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                Back
              </button>
            </div>
            <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500/15 to-violet-500/10 border border-red-500/20">
                  <Signal className="h-7 w-7 text-red-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Simulcast</h1>
                  <p className="text-sm text-white/40 mt-0.5">Broadcast simultaneously across all platforms from one place</p>
                </div>
              </div>

              {/* Go Live / Stop */}
              {isSimulcasting ? (
                <button onClick={stopSimulcast} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 font-bold text-sm hover:bg-red-500/25 transition-colors">
                  <Square className="h-4 w-4 fill-red-400" />End Simulcast
                </button>
              ) : (
                <button onClick={startSimulcast} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-400 transition-colors">
                  <Play className="h-4 w-4 fill-white" />Go Live on All
                </button>
              )}
            </div>

            {/* Live status */}
            {isSimulcasting && (
              <div className="mt-4 flex items-center gap-6 p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-sm font-bold text-red-300">LIVE on {platforms.filter(p => p.isLive).length} platforms</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-white/60">
                  <Users className="h-4 w-4" />{totalViewers.toLocaleString()} viewers
                </div>
                <div className="flex items-center gap-1 text-sm text-white/60">
                  <MessageSquare className="h-4 w-4" />{totalMessages} messages
                </div>
                <div className="flex items-center gap-1 text-sm text-white/60">
                  <Heart className="h-4 w-4" />{totalLikes} likes
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mt-5 bg-white/[0.03] rounded-xl p-1 w-fit border border-white/[0.06]">
              {(["dashboard", "chat", "analytics"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                    activeTab === tab ? "bg-red-500/20 text-red-300 border border-red-500/30" : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab === "chat" ? "Unified Chat" : tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-6">

          {/* ── DASHBOARD ── */}
          {activeTab === "dashboard" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {platforms.map(platform => {
                  const Icon = platform.icon;
                  return (
                    <div key={platform.id} className={cn("p-5 rounded-2xl border transition-all", platform.isLive ? `${platform.bg} ${platform.border}` : "bg-white/[0.03] border-white/[0.06]")}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-xl", platform.bg, "border", platform.border)}>
                            <Icon className={cn("h-5 w-5", platform.color)} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{platform.name}</p>
                            <p className={cn("text-[11px] font-bold", platform.isLive ? "text-red-400" : platform.isConnected ? "text-emerald-400" : "text-white/30")}>
                              {platform.isLive ? "● LIVE" : platform.isConnected ? "✓ Connected" : "Not connected"}
                            </p>
                          </div>
                        </div>
                        {platform.id !== "ogscan" && (
                          <button
                            onClick={() => toggleConnect(platform.id)}
                            className={cn("text-xs px-3 py-1.5 rounded-lg font-medium border transition-all",
                              platform.isConnected ? "bg-white/[0.06] text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 border-white/[0.08]" : `${platform.bg} ${platform.color} ${platform.border} hover:opacity-80`
                            )}
                          >
                            {platform.isConnected ? "Disconnect" : "Connect"}
                          </button>
                        )}
                      </div>

                      {/* Stream key */}
                      {platform.id !== "ogscan" && (
                        <div className="mb-3">
                          {editingKey === platform.id ? (
                            <div className="flex gap-2">
                              <input
                                value={keyValue}
                                onChange={e => setKeyValue(e.target.value)}
                                placeholder="Paste stream key"
                                className="flex-1 bg-white/[0.05] rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-white/20 outline-none border border-white/[0.08]"
                              />
                              <button onClick={() => saveKey(platform.id)} className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold">Save</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs font-mono text-white/30">
                              <span className="flex-1 truncate">{platform.streamKey || "No stream key set"}</span>
                              <button onClick={() => { setEditingKey(platform.id); setKeyValue(""); }} className="text-white/20 hover:text-white/50">
                                <Settings className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stats */}
                      {platform.isLive && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06]">
                          <div className="text-center">
                            <p className="text-base font-black text-white">{platform.viewers}</p>
                            <p className="text-[10px] text-white/30">Viewers</p>
                          </div>
                          <div className="text-center">
                            <p className="text-base font-black text-white">{platform.chatMessages}</p>
                            <p className="text-[10px] text-white/30">Messages</p>
                          </div>
                          <div className="text-center">
                            <p className="text-base font-black text-white">{platform.likes}</p>
                            <p className="text-[10px] text-white/30">Likes</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── UNIFIED CHAT ── */}
          {activeTab === "chat" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Unified Chat</h2>
                <div className="flex gap-1">
                  {platforms.filter(p => p.isLive).map(p => {
                    const Icon = p.icon;
                    return (
                      <div key={p.id} className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1", p.bg, p.border, "border", p.color)}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />{p.name}
                      </div>
                    );
                  })}
                </div>
              </div>

              {!isSimulcasting ? (
                <div className="text-center py-10 text-white/30 border border-dashed border-white/[0.06] rounded-2xl">
                  <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Start simulcasting to see unified chat</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {messages.map(msg => (
                    <div key={msg.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors animate-in fade-in duration-200">
                      <span className="text-lg w-7 text-center shrink-0">{msg.platformIcon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn("text-[11px] font-bold", msg.platformColor)}>{msg.platform}</span>
                          <span className="text-xs font-semibold text-white/60">{msg.user}</span>
                          <span className="text-[10px] text-white/20 ml-auto">{msg.timestamp}</span>
                        </div>
                        <p className="text-sm text-white/70">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {activeTab === "analytics" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Reach", value: totalViewers.toLocaleString(), icon: Users, color: "text-violet-400" },
                  { label: "Total Messages", value: totalMessages.toLocaleString(), icon: MessageSquare, color: "text-blue-400" },
                  { label: "Total Likes", value: totalLikes.toLocaleString(), icon: Heart, color: "text-red-400" },
                ].map(stat => (
                  <div key={stat.label} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
                    <stat.icon className={cn("h-5 w-5 mx-auto mb-2", stat.color)} />
                    <p className="text-2xl font-black text-white">{stat.value}</p>
                    <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Per-platform breakdown */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-sm font-bold text-white mb-4">Platform Breakdown</p>
                <div className="space-y-3">
                  {platforms.filter(p => p.isConnected).map(p => {
                    const Icon = p.icon;
                    const share = totalViewers > 0 ? Math.round((p.viewers / totalViewers) * 100) : 0;
                    return (
                      <div key={p.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", p.color)} />
                            <span className="text-sm text-white/70">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-white/50">
                            <span>{p.viewers} viewers</span>
                            <span className={cn("font-bold", p.color)}>{share}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-1000", p.bg.replace("10", "40").replace("bg-", "bg-"))} style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Simulcast;
