import { useNavigate } from "react-router-dom";
import { StatusBar } from "./StatusBar";
import {
  Wallet, Coins, LineChart, Wrench, Crown, Cpu, Rocket,
  Bell, MessageSquare, Webhook, Trophy, Settings,
  Search, Shield, BarChart3, Zap, Globe, Radio, Headphones,
  Globe2, ArrowLeftRight, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

interface AppItem {
  icon: React.ElementType;
  label: string;
  path: string;
  gradient: string;
  badge?: string;
}

const apps: AppItem[] = [
  { icon: Wallet, label: "Wallets", path: "/wallets", gradient: "from-primary to-amber-700" },
  { icon: Coins, label: "Tokens", path: "/tokens", gradient: "from-amber-600 to-yellow-700" },
  { icon: LineChart, label: "Charts", path: "/charts", gradient: "from-emerald-500 to-green-700" },
  { icon: Wrench, label: "Tools", path: "/tools", gradient: "from-slate-500 to-slate-700" },
  { icon: Cpu, label: "Advanced", path: "/advanced-tools", gradient: "from-violet-500 to-purple-700" },
  { icon: Rocket, label: "Launch Pad", path: "/pump-v5", gradient: "from-primary to-accent", badge: "NEW" },

  { icon: Bell, label: "Alerts", path: "/notifications", gradient: "from-rose-500 to-red-700" },
  { icon: MessageSquare, label: "Alpha Chat", path: "/alpha-chat", gradient: "from-cyan-500 to-blue-700" },
  { icon: Radio, label: "Live Feed", path: "/live-feed", gradient: "from-orange-500 to-red-600" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard", gradient: "from-amber-400 to-yellow-600" },
  { icon: Search, label: "Discover", path: "/discover", gradient: "from-teal-500 to-emerald-700" },
  { icon: Shield, label: "Callouts", path: "/callouts", gradient: "from-indigo-500 to-blue-700" },
  { icon: Globe, label: "Token Info", path: "/official-token", gradient: "from-sky-500 to-blue-700" },
  { icon: Headphones, label: "Lobbies", path: "/lobbies", gradient: "from-pink-500 to-rose-700", badge: "NEW" },
  { icon: Globe2, label: "Communities", path: "/communities", gradient: "from-emerald-400 to-teal-700", badge: "NEW" },
  { icon: ArrowLeftRight, label: "Trading", path: "/live-trading", gradient: "from-purple-400 to-indigo-700", badge: "SOON" },
  { icon: BarChart3, label: "Credits", path: "/credits", gradient: "from-lime-500 to-green-700" },
  { icon: Settings, label: "Settings", path: "/settings", gradient: "from-zinc-500 to-zinc-700" },
];

const dockApps: AppItem[] = [
  { icon: Wallet, label: "Wallets", path: "/wallets", gradient: "from-primary to-amber-700" },
  { icon: Coins, label: "Tokens", path: "/tokens", gradient: "from-amber-600 to-yellow-700" },
  { icon: Rocket, label: "Launch Pad", path: "/pump-v5", gradient: "from-primary to-accent" },

];

export const HomeScreen = () => {
  const navigate = useNavigate();

  const handleAppTap = (path: string) => {
    if (navigator.vibrate) navigator.vibrate(6);
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-[180] flex flex-col bg-background/90 overflow-hidden">
      <StatusBar />
      <div className="flex items-center justify-center pt-3 pb-1">
        <img src={logo} alt="Sol Tools" width={36} height={36} className="rounded-xl" />
        <span className="ml-2 text-lg font-bold font-display gradient-text">Sol Tools</span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-3 pb-24 relative z-10">
        <div className="grid grid-cols-4 gap-y-5 gap-x-4">
          {apps.map((app) => (
            <button key={app.path} onClick={() => handleAppTap(app.path)} className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform duration-150 group">
              <div className="relative">
                <div className={cn(
                  "w-[58px] h-[58px] rounded-[18px] bg-gradient-to-br flex items-center justify-center",
                  "shadow-lg shadow-black/50 group-active:shadow-md transition-shadow",
                  "border border-white/10",
                  app.gradient
                )}>
                  <app.icon className="h-6 w-6 text-white" strokeWidth={1.8} />
                </div>
                {app.badge && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[8px] font-bold bg-primary text-primary-foreground rounded-full">
                    {app.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-foreground/80 font-medium leading-tight text-center line-clamp-1">{app.label}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-center gap-1.5 mt-5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/15" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-2">
        <div className="mx-auto rounded-[28px] bg-foreground/6 backdrop-blur-2xl border border-foreground/8 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-around">
            {dockApps.map((app) => (
              <button key={`dock-${app.path}`} onClick={() => handleAppTap(app.path)} className="active:scale-90 transition-transform duration-150">
                <div className={cn(
                  "w-[54px] h-[54px] rounded-[16px] bg-gradient-to-br flex items-center justify-center",
                  "shadow-lg shadow-black/50 border border-white/10",
                  app.gradient
                )}>
                  <app.icon className="h-5 w-5 text-white" strokeWidth={1.8} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
