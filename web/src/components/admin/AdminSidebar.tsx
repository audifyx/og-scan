/* ══════════════════════════════════════════════════════════════
   Admin Sidebar — Section navigation for admin dashboard
   ══════════════════════════════════════════════════════════════ */
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart3, Users, Globe2, Shield, Headphones, Rocket, Mic,
  Headset, MessageSquare, Bell, AlertTriangle, Wallet,
  Image, Settings, FileText, TrendingUp, ChevronLeft,
  LayoutDashboard, Wrench, Crown, UserCheck,
} from "lucide-react";
import type { AdminSection } from "./types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3, Users, Globe2, Shield, Headphones, Rocket, Mic,
  Headset, MessageSquare, Bell, AlertTriangle, Wallet,
  Image, Settings, FileText, TrendingUp, LayoutDashboard, Wrench, Crown, UserCheck,
};

interface SectionItem {
  id: AdminSection;
  label: string;
  icon: string;
  badge?: number;
}

const SECTIONS: { group: string; items: SectionItem[] }[] = [
  {
    group: "Core",
    items: [
      { id: "overview", label: "Overview", icon: "BarChart3" },
      { id: "users", label: "Users", icon: "Users" },
      { id: "analytics", label: "Analytics", icon: "TrendingUp" },
      { id: "tools", label: "Admin Tools", icon: "Wrench" },
    ],
  },
  {
    group: "Content",
    items: [
      { id: "communities", label: "Communities", icon: "Globe2" },
      { id: "moderation", label: "Moderation", icon: "Shield" },
      { id: "tokens", label: "Token Listings", icon: "Rocket" },
      { id: "media", label: "Media", icon: "Image" },
    ],
  },
  {
    group: "Engagement",
    items: [
      { id: "lobbies", label: "Trading Lobbies", icon: "Headphones" },
      { id: "spaces", label: "Spaces (Audio)", icon: "Mic" },
      { id: "chat", label: "Chat & AI", icon: "MessageSquare" },
      { id: "support", label: "Support", icon: "Headset" },
      { id: "notifications", label: "Notifications", icon: "Bell" },
      { id: "alerts", label: "Price Alerts", icon: "AlertTriangle" },
      { id: "wallets", label: "Wallets & Trades", icon: "Wallet" },
    ],
  },
  {
    group: "Growth",
    items: [
      { id: "affiliates", label: "Affiliates", icon: "UserCheck" },
      { id: "org_affiliates", label: "Org Affiliates", icon: "Crown" },
    ],
  },
  {
    group: "System",
    items: [
      { id: "settings", label: "Settings", icon: "Settings" },
      { id: "audit", label: "Audit Log", icon: "FileText" },
    ],
  },
];

interface Props {
  active: AdminSection;
  onChange: (s: AdminSection) => void;
  badges?: Partial<Record<AdminSection, number>>;
  onBack: () => void;
}

export const AdminSidebar = ({ active, onChange, badges = {}, onBack }: Props) => (
  <div className="w-full h-full flex flex-col bg-[#0a1118]/80 border-r border-white/[0.06]">
    {/* Header */}
    <div className="p-4 border-b border-white/[0.06]">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-[#22d3ee]/20 to-red-500/20">
          <Shield className="h-5 w-5 text-[#22d3ee]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold tracking-tight">Admin Panel</h2>
          <p className="text-[10px] text-white/40">OGScan Management</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="w-full mt-3 gap-2 text-xs text-white/50 hover:text-white justify-start"
      >
        <ChevronLeft className="h-3 w-3" /> Back to App
      </Button>
    </div>

    {/* Nav sections */}
    <ScrollArea className="flex-1 px-2 py-3">
      {SECTIONS.map((group) => (
        <div key={group.group} className="mb-4">
          <p className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
            {group.group}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICON_MAP[item.icon] || LayoutDashboard;
              const isActive = active === item.id;
              const badge = badges[item.id] || item.badge;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all text-[13px]",
                    isActive
                      ? "bg-white/[0.09] text-white font-medium"
                      : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md border transition",
                      isActive
                        ? "border-[#22d3ee]/30 bg-[#22d3ee]/10 text-[#22d3ee]"
                        : "border-white/10 bg-white/[0.03]"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {badge && badge > 0 ? (
                    <Badge className="h-5 px-1.5 text-[10px] bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                      {badge}
                    </Badge>
                  ) : null}
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </ScrollArea>
  </div>
);
