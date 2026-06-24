import { Users, MessageCircle, Share2, TrendingUp, Zap, Calendar } from "lucide-react";

export default function LiveStats() {
  const stats = [
    { icon: Users, label: "Active Users", value: "55", color: "text-accent" },
    { icon: MessageCircle, label: "Telegram", value: "185", color: "text-white" },
    { icon: Share2, label: "X Followers", value: "182", color: "text-white" },
    { icon: TrendingUp, label: "Tokens Listed", value: "847", color: "text-accent" },
    { icon: Zap, label: "Volume", value: "$2.4M", color: "text-white" },
    { icon: Calendar, label: "Days Live", value: "47", color: "text-accent" },
  ];

  return (
    <div className="border-b border-line bg-panel/30">
      <div className="max-w-[1500px] mx-auto px-4 py-1.5 overflow-x-auto">
        <div className="flex items-center gap-4 min-w-max">
          {stats.map((stat) => {
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
