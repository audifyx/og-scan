/**
 * SpaceBadges — Achievement badges earned from Space participation.
 * Tracks milestones like first space hosted, 10 spaces attended, etc.
 */
import React, { useState, useMemo } from "react";
import { Award, Crown, Mic, Headphones, Clock, Star, Flame, Zap, Shield, Heart, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  earned: boolean;
  progress?: number;
  target?: number;
}

interface SpaceBadgesProps {
  spacesHosted: number;
  spacesAttended: number;
  totalSpeakingMin: number;
  compact?: boolean;
}

const SpaceBadges: React.FC<SpaceBadgesProps> = ({ spacesHosted, spacesAttended, totalSpeakingMin, compact }) => {
  const [expanded, setExpanded] = useState(!compact);

  const badges = useMemo<Badge[]>(() => [
    { id: "first_host", name: "First Host", description: "Host your first space", emoji: "🎤", color: "from-blue-500/20 to-blue-600/10 border-blue-500/20", earned: spacesHosted >= 1, progress: spacesHosted, target: 1 },
    { id: "5_hosted", name: "Room Master", description: "Host 5 spaces", emoji: "🏠", color: "from-purple-500/20 to-purple-600/10 border-purple-500/20", earned: spacesHosted >= 5, progress: spacesHosted, target: 5 },
    { id: "10_hosted", name: "Space Legend", description: "Host 10 spaces", emoji: "👑", color: "from-amber-500/20 to-amber-600/10 border-amber-500/20", earned: spacesHosted >= 10, progress: spacesHosted, target: 10 },
    { id: "first_listen", name: "First Listen", description: "Join your first space", emoji: "👂", color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20", earned: spacesAttended >= 1, progress: spacesAttended, target: 1 },
    { id: "10_attended", name: "Regular", description: "Attend 10 spaces", emoji: "🎧", color: "from-sky-500/20 to-sky-600/10 border-sky-500/20", earned: spacesAttended >= 10, progress: spacesAttended, target: 10 },
    { id: "50_attended", name: "Superfan", description: "Attend 50 spaces", emoji: "⭐", color: "from-pink-500/20 to-pink-600/10 border-pink-500/20", earned: spacesAttended >= 50, progress: spacesAttended, target: 50 },
    { id: "1hr_speaking", name: "Chatty", description: "Speak for 60+ minutes total", emoji: "💬", color: "from-teal-500/20 to-teal-600/10 border-teal-500/20", earned: totalSpeakingMin >= 60, progress: totalSpeakingMin, target: 60 },
    { id: "5hr_speaking", name: "Motor Mouth", description: "Speak for 5+ hours total", emoji: "🔥", color: "from-orange-500/20 to-orange-600/10 border-orange-500/20", earned: totalSpeakingMin >= 300, progress: totalSpeakingMin, target: 300 },
  ], [spacesHosted, spacesAttended, totalSpeakingMin]);

  const earned = badges.filter(b => b.earned);

  return (
    <div className="space-y-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full px-1">
        <div className="flex items-center gap-2">
          <Award className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[11px] font-bold text-white/50">Badges</span>
          {earned.length > 0 && <span className="text-[9px] font-bold text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-500/10">{earned.length}/{badges.length}</span>}
        </div>
        <ChevronUp className={cn("h-3 w-3 text-white/20 transition-transform", !expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {badges.map(b => (
            <div key={b.id}
              className={cn(
                "rounded-xl border p-3 text-center transition-all relative overflow-hidden",
                b.earned
                  ? `bg-gradient-to-br ${b.color}`
                  : "border-white/[0.04] bg-white/[0.01] opacity-40"
              )}>
              <span className="text-2xl block mb-1">{b.emoji}</span>
              <p className={cn("text-[10px] font-bold", b.earned ? "text-white" : "text-white/30")}>{b.name}</p>
              <p className="text-[8px] text-white/20 mt-0.5">{b.description}</p>

              {/* Progress bar for unearned */}
              {!b.earned && b.progress !== undefined && b.target !== undefined && (
                <div className="mt-1.5">
                  <div className="h-0.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-white/20" style={{ width: `${Math.min(100, (b.progress / b.target) * 100)}%` }} />
                  </div>
                  <p className="text-[7px] text-white/15 mt-0.5">{b.progress}/{b.target}</p>
                </div>
              )}

              {b.earned && (
                <div className="absolute top-1 right-1">
                  <div className="w-3 h-3 rounded-full bg-emerald-400/20 flex items-center justify-center">
                    <Star className="h-2 w-2 text-emerald-400" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SpaceBadges;
