/**
 * SpaceAnalytics — Post-space analytics dashboard for hosts.
 * Shows peak listeners, engagement metrics, poll results summary, etc.
 */
import React, { useState, useEffect } from "react";
import { BarChart3, Users, Clock, TrendingUp, MessageSquare, Hand, Mic, Activity, Eye, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface SpaceAnalyticsProps {
  spaceId: string;
  isHost: boolean;
}

interface Stats {
  peakListeners: number;
  totalMessages: number;
  totalReactions: number;
  totalSpeakers: number;
  durationMinutes: number;
  highlightsCount: number;
  pollsCount: number;
  questionsCount: number;
}

const StatCard = ({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) => (
  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
    <Icon className={cn("h-4 w-4 mx-auto mb-1.5", color)} />
    <p className="text-base font-black text-white">{value}</p>
    <p className="text-[9px] text-white/25 font-bold uppercase tracking-wider mt-0.5">{label}</p>
  </div>
);

const SpaceAnalytics: React.FC<SpaceAnalyticsProps> = ({ spaceId, isHost }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isHost) return;
    const fetch = async () => {
      const [space, msgs, polls, questions, highlights] = await Promise.all([
        supabase.from("spaces").select("peak_listeners, speaker_count, duration_seconds").eq("id", spaceId).single(),
        supabase.from("space_messages").select("id", { count: "exact" }).eq("space_id", spaceId),
        supabase.from("space_polls").select("id", { count: "exact" }).eq("space_id", spaceId),
        supabase.from("space_qa_questions").select("id", { count: "exact" }).eq("space_id", spaceId),
        supabase.from("space_highlights").select("id", { count: "exact" }).eq("space_id", spaceId),
      ]);

      setStats({
        peakListeners: space.data?.peak_listeners || 0,
        totalMessages: msgs.count || 0,
        totalReactions: 0, // Would need a reactions table to track
        totalSpeakers: space.data?.speaker_count || 0,
        durationMinutes: Math.round((space.data?.duration_seconds || 0) / 60),
        highlightsCount: highlights.count || 0,
        pollsCount: polls.count || 0,
        questionsCount: questions.count || 0,
      });
      setLoading(false);
    };
    fetch();
  }, [spaceId, isHost]);

  if (!isHost) return null;

  return (
    <div className="space-y-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full px-1">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[11px] font-bold text-white/50">Analytics</span>
        </div>
        <ChevronUp className={cn("h-3 w-3 text-white/20 transition-transform", !expanded && "rotate-180")} />
      </button>

      {expanded && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard icon={Eye} label="Peak Listeners" value={stats.peakListeners} color="text-blue-400" />
          <StatCard icon={Clock} label="Duration" value={`${stats.durationMinutes}m`} color="text-amber-400" />
          <StatCard icon={MessageSquare} label="Messages" value={stats.totalMessages} color="text-purple-400" />
          <StatCard icon={Mic} label="Speakers" value={stats.totalSpeakers} color="text-emerald-400" />
          <StatCard icon={BarChart3} label="Polls" value={stats.pollsCount} color="text-sky-400" />
          <StatCard icon={Hand} label="Questions" value={stats.questionsCount} color="text-pink-400" />
          <StatCard icon={TrendingUp} label="Highlights" value={stats.highlightsCount} color="text-orange-400" />
          <StatCard icon={Users} label="Engagement" value={stats.totalMessages > 0 ? "High" : "Low"} color="text-teal-400" />
        </div>
      )}

      {expanded && loading && (
        <div className="text-center py-4 text-[10px] text-white/20">Loading analytics...</div>
      )}
    </div>
  );
};

export default SpaceAnalytics;
