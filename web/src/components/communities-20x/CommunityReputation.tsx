/**
 * CommunityReputation — User reputation system with XP, levels, and badges.
 * Earn XP from non-monetary participation: helpful posts, replies, likes, consistency, and events.
 */
import { useState, useMemo } from "react";
import { Star, Shield, Flame, Target, Zap, Crown, MessageSquare, Mic, ChevronDown, ChevronUp, Heart, BadgeCheck, CalendarDays, BookOpen, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ReputationAction {
  type: string;
  label: string;
  xp: number;
  icon: React.ReactNode;
}

interface UserReputation {
  userId: string;
  username: string;
  xp: number;
  level: number;
  title: string;
  badges: Array<{ id: string; name: string; emoji: string; description: string; earnedAt: string }>;
  stats: {
    helpfulPosts: number;
    commentsReceived: number;
    messagesPosted: number;
    likesReceived: number;
    daysActive: number;
    eventsJoined: number;
  };
  rank: number;
  streak: number;
}

interface Props {
  reputation: UserReputation;
  compact?: boolean;
}

const LEVELS: Array<{ level: number; title: string; minXp: number; color: string }> = [
  { level: 1, title: "Newbie", minXp: 0, color: "text-white/30" },
  { level: 2, title: "Explorer", minXp: 100, color: "text-white/40" },
  { level: 3, title: "Scout", minXp: 300, color: "text-primary" },
  { level: 4, title: "Analyst", minXp: 700, color: "text-cyan-400" },
  { level: 5, title: "Researcher", minXp: 1500, color: "text-emerald-400" },
  { level: 6, title: "Community Voice", minXp: 3000, color: "text-lime-400" },
  { level: 7, title: "Trusted Expert", minXp: 6000, color: "text-amber-400" },
  { level: 8, title: "OG Veteran", minXp: 12000, color: "text-orange-400" },
  { level: 9, title: "Diamond Brain", minXp: 25000, color: "text-purple-400" },
  { level: 10, title: "Legendary OG", minXp: 50000, color: "text-primary" },
];

function getLevelInfo(xp: number) {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || LEVELS[i];
    }
  }
  const progress = next.minXp > current.minXp
    ? ((xp - current.minXp) / (next.minXp - current.minXp)) * 100
    : 100;
  return { current, next, progress };
}

const XP_ACTIONS: ReputationAction[] = [
  { type: "post", label: "Quality Post", xp: 8, icon: <MessageSquare className="h-3 w-3" /> },
  { type: "reply", label: "Constructive Reply", xp: 4, icon: <Users className="h-3 w-3" /> },
  { type: "liked", label: "Received Like", xp: 2, icon: <Heart className="h-3 w-3" /> },
  { type: "expert", label: "Helpful Answer", xp: 20, icon: <BadgeCheck className="h-3 w-3" /> },
  { type: "event_host", label: "Host an Event", xp: 25, icon: <Mic className="h-3 w-3" /> },
  { type: "event_join", label: "Join an Event", xp: 5, icon: <CalendarDays className="h-3 w-3" /> },
  { type: "daily_checkin", label: "Daily Check-in", xp: 10, icon: <Flame className="h-3 w-3" /> },
  { type: "resource", label: "Add Resource", xp: 15, icon: <BookOpen className="h-3 w-3" /> },
];

export const CommunityReputation: React.FC<Props> = ({ reputation, compact = false }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { current, next, progress } = useMemo(() => getLevelInfo(reputation.xp), [reputation.xp]);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge className={cn("text-[8px] gap-0.5", current.color, "bg-white/[0.03] border-white/[0.06]")}>
          Lv.{current.level} {current.title}
        </Badge>
        <span className="text-[9px] text-white/20">{reputation.xp.toLocaleString()} XP</span>
        {reputation.streak > 0 && (
          <span className="text-[9px] text-amber-400">🔥{reputation.streak}</span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full p-4 text-left hover:bg-white/[0.015] transition-colors"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-black",
            `bg-${current.color.split("-")[1]}-500/10 border-${current.color.split("-")[1]}-500/20`,
            current.color
          )} style={{ background: `${current.color.includes("primary") ? "rgba(var(--primary-rgb), 0.1)" : ""}` }}>
            {current.level}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{reputation.username}</span>
              <Badge className={cn("text-[9px]", current.color, "bg-white/[0.04] border-white/[0.08]")}>
                {current.title}
              </Badge>
              {reputation.rank <= 10 && (
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[8px]">
                  <Crown className="h-2 w-2 mr-0.5" />#{reputation.rank}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-white/30">{reputation.xp.toLocaleString()} XP</span>
              {reputation.streak > 0 && (
                <span className="text-[10px] text-amber-400">🔥 {reputation.streak} day streak</span>
              )}
            </div>
          </div>
          {showDetails ? <ChevronUp className="h-4 w-4 text-white/15" /> : <ChevronDown className="h-4 w-4 text-white/15" />}
        </div>

        {/* XP Progress bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className={cn("text-[9px] font-bold", current.color)}>Level {current.level}</span>
            <span className="text-[9px] text-white/15">
              {current.level < 10 ? `${reputation.xp - current.minXp} / ${next.minXp - current.minXp} to Level ${next.level}` : "MAX LEVEL"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500",
                current.level >= 8 ? "bg-gradient-to-r from-amber-500 to-orange-500" :
                current.level >= 5 ? "bg-gradient-to-r from-emerald-500 to-lime-500" :
                "bg-primary"
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Badges row */}
        {reputation.badges.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {reputation.badges.slice(0, 6).map(badge => (
              <div key={badge.id} className="w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-sm" title={badge.name}>
                {badge.emoji}
              </div>
            ))}
            {reputation.badges.length > 6 && (
              <span className="text-[9px] text-white/15 self-center">+{reputation.badges.length - 6}</span>
            )}
          </div>
        )}
      </button>

      {showDetails && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-black/20 p-2 text-center">
              <BadgeCheck className="h-3 w-3 text-white/15 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-white">{reputation.stats.helpfulPosts}</p>
              <p className="text-[8px] text-white/15">Helpful</p>
            </div>
            <div className="rounded-lg bg-black/20 p-2 text-center">
              <Mic className="h-3 w-3 text-white/15 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-white">{reputation.stats.eventsJoined}</p>
              <p className="text-[8px] text-white/15">Events</p>
            </div>
            <div className="rounded-lg bg-black/20 p-2 text-center">
              <Heart className="h-3 w-3 text-white/15 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-white">{reputation.stats.likesReceived}</p>
              <p className="text-[8px] text-white/15">Likes</p>
            </div>
            <div className="rounded-lg bg-black/20 p-2 text-center">
              <MessageSquare className="h-3 w-3 text-white/15 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-white">{reputation.stats.messagesPosted}</p>
              <p className="text-[8px] text-white/15">Posts</p>
            </div>
            <div className="rounded-lg bg-black/20 p-2 text-center">
              <Flame className="h-3 w-3 text-white/15 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-white">{reputation.stats.daysActive}</p>
              <p className="text-[8px] text-white/15">Active Days</p>
            </div>
            <div className="rounded-lg bg-black/20 p-2 text-center">
              <Users className="h-3 w-3 text-white/15 mx-auto mb-0.5" />
              <p className="text-xs font-bold text-white">{reputation.stats.commentsReceived}</p>
              <p className="text-[8px] text-white/15">Replies</p>
            </div>
          </div>

          {/* XP earning guide */}
          <div>
            <p className="text-[9px] text-white/20 uppercase tracking-wider mb-1.5">Ways to Earn XP</p>
            <div className="grid grid-cols-2 gap-1">
              {XP_ACTIONS.map(action => (
                <div key={action.type} className="flex items-center gap-1.5 p-1.5 rounded-md bg-white/[0.015] border border-white/[0.04]">
                  <span className="text-white/20">{action.icon}</span>
                  <span className="text-[9px] text-white/30 flex-1">{action.label}</span>
                  <span className="text-[9px] font-bold text-primary">+{action.xp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Badges list */}
          {reputation.badges.length > 0 && (
            <div>
              <p className="text-[9px] text-white/20 uppercase tracking-wider mb-1.5">Badges Earned</p>
              <div className="grid grid-cols-2 gap-1">
                {reputation.badges.map(badge => (
                  <div key={badge.id} className="flex items-center gap-2 p-1.5 rounded-md bg-white/[0.015] border border-white/[0.04]">
                    <span className="text-lg">{badge.emoji}</span>
                    <div>
                      <p className="text-[10px] font-bold text-white">{badge.name}</p>
                      <p className="text-[8px] text-white/20">{badge.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommunityReputation;
