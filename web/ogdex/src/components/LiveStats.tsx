import { useEffect, useState } from "react";
import { Users, MessageCircle, Share2, TrendingUp, Zap, Calendar } from "lucide-react";

interface PlatformStats {
  activeUsers: number;
  telegram: number;
  xFollowers: number;
  tokenCount: number;
  volume: string;
  daysLive: number;
}

const FALLBACK: PlatformStats = {
  activeUsers: 55,
  telegram: 185,
  xFollowers: 182,
  tokenCount: 847,
  volume: "$2.4M",
  daysLive: 47,
};

// Shared fetch — called by both the strip below the header and the
// inline nav pills on desktop.
let _cache: PlatformStats | null = null;
let _cacheAt = 0;
const TTL = 120_000; // 2 min

export async function fetchPlatformStats(): Promise<PlatformStats> {
  if (_cache && Date.now() - _cacheAt < TTL) return _cache;
  try {
    const r = await fetch("/api/ogdex/platform-stats");
    if (!r.ok) throw new Error(`${r.status}`);
    const d = await r.json();
    if (d.ok) {
      _cache = { activeUsers: d.activeUsers, telegram: d.telegram, xFollowers: d.xFollowers, tokenCount: d.tokenCount, volume: d.volume, daysLive: d.daysLive };
      _cacheAt = Date.now();
      return _cache;
    }
  } catch { /* use fallback */ }
  return FALLBACK;
}

export default function LiveStats() {
  const [stats, setStats] = useState<PlatformStats>(FALLBACK);

  useEffect(() => {
    fetchPlatformStats().then(setStats).catch(() => {});
  }, []);

  const items = [
    { icon: Users,         label: "Active Users", value: String(stats.activeUsers), color: "text-accent" },
    { icon: MessageCircle, label: "Telegram",      value: String(stats.telegram),   color: "text-white" },
    { icon: Share2,        label: "X Followers",   value: String(stats.xFollowers), color: "text-white" },
    { icon: TrendingUp,    label: "Tokens Listed", value: String(stats.tokenCount), color: "text-accent" },
    { icon: Zap,           label: "Volume",        value: stats.volume,             color: "text-white" },
    { icon: Calendar,      label: "Days Live",     value: String(stats.daysLive),   color: "text-accent" },
  ];

  return (
    // md:hidden — on desktop the stats live inline in the nav; this bar is mobile-only
    <div className="md:hidden border-b border-line bg-panel/30">
      <div className="max-w-[1500px] mx-auto px-4 py-1.5 overflow-x-auto">
        <div className="flex items-center gap-4 min-w-max">
          {items.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-1.5 text-xs shrink-0">
                <Icon className={`w-3 h-3 ${stat.color}`} />
                <span className="text-muted">{stat.label}:</span>
                <span className={`font-semibold ${stat.color}`}>{stat.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
