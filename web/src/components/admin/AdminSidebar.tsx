/* ══════════════════════════════════════════════════════════════
   Admin Sidebar — cleaner section navigation for admin dashboard
   ══════════════════════════════════════════════════════════════ */
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronLeft,
  Crown,
  FileText,
  Globe2,
  Headphones,
  Headset,
  Image,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Mic,
  PanelTop,
  Rocket,
  Settings,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { AdminSection } from "./types";

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  AlertTriangle,
  BarChart3,
  Bell,
  Crown,
  FileText,
  Globe2,
  Headphones,
  Headset,
  Image,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Mic,
  PanelTop,
  Rocket,
  Settings,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Wrench,
};

interface SectionItem {
  id: AdminSection;
  label: string;
  icon: string;
  badge?: number;
}

const SECTIONS: { group: string; items: SectionItem[] }[] = [
  {
    group: "Dashboard",
    items: [
      { id: "overview",   label: "Overview",    icon: "LayoutDashboard" },
      { id: "admin_apps", label: "Admin Apps",   icon: "PanelTop" },
      { id: "analytics",  label: "Analytics",    icon: "TrendingUp" },
      { id: "tools",      label: "Admin Tools",  icon: "Wrench" },
    ],
  },
  {
    group: "OGS Token",
    items: [
      { id: "tokens",     label: "Token Listings", icon: "Rocket" },
      { id: "wallets",    label: "Wallets & Trades", icon: "Wallet" },
      { id: "alerts",     label: "Price Alerts",   icon: "AlertTriangle" },
    ],
  },
  {
    group: "People & Growth",
    items: [
      { id: "users",         label: "Users",         icon: "Users" },
      { id: "affiliates",    label: "Affiliates",    icon: "UserCheck" },
      { id: "org_affiliates",label: "Org Affiliates",icon: "Crown" },
      { id: "support",       label: "Support",       icon: "Headset" },
    ],
  },
  {
    group: "Content & Community",
    items: [
      { id: "communities",   label: "Communities",      icon: "Globe2" },
      { id: "moderation",    label: "Moderation",       icon: "Shield" },
      { id: "spaces",        label: "Spaces",           icon: "Mic" },
      { id: "lobbies",       label: "Trading Lobbies",  icon: "Headphones" },
      { id: "chat",          label: "Chat & AI",        icon: "MessageSquare" },
      { id: "notifications", label: "Notifications",    icon: "Bell" },
      { id: "announcements", label: "Announcements",   icon: "Megaphone" },
      { id: "media",         label: "Media",            icon: "Image" },
    ],
  },
  {
    group: "System",
    items: [
      { id: "settings", label: "Settings",  icon: "Settings" },
      { id: "audit",    label: "Audit Log", icon: "FileText" },
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
  <div className="flex h-full w-full flex-col border-r border-white/[0.06] bg-[#08101b]/95 text-white shadow-[16px_0_80px_-48px_rgba(0,0,0,0.9)]">
    <div className="border-b border-white/[0.06] px-4 pb-4 pt-5">
      <div className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(34,211,238,0.14),rgba(8,16,27,0.94)_40%,rgba(250,204,21,0.10))] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
            <Shield className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/70">Owner console</p>
            <h2 className="mt-1 text-base font-black tracking-tight text-white">OrbitX Admin</h2>
            <p className="mt-1 text-xs leading-5 text-white/50">Control center for moderation, growth, admin apps, and platform operations.</p>
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mt-3 w-full justify-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs text-white/55 hover:bg-white/[0.06] hover:text-white"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Back to app
      </Button>
    </div>

    <ScrollArea className="sidebar-scrollbar flex-1 px-2 py-3 pr-1">
      {SECTIONS.map((group) => (
        <div key={group.group} className="mb-4">
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/28">{group.group}</p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = ICON_MAP[item.icon] || LayoutDashboard;
              const isActive = active === item.id;
              const badge = badges[item.id] || item.badge;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChange(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200",
                    isActive
                      ? "border-cyan-300/22 bg-cyan-300/[0.10] text-white shadow-[0_12px_36px_-26px_rgba(34,211,238,0.85)]"
                      : "border-transparent bg-white/[0.03] text-white/55 hover:border-white/[0.08] hover:bg-white/[0.05] hover:text-white/88",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition",
                      isActive
                        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-300"
                        : "border-white/10 bg-[#0d1727] text-white/45",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold leading-tight">{item.label}</span>
                    <span className="mt-0.5 block text-[10px] uppercase tracking-[0.18em] text-white/28">
                      {isActive ? "Open now" : "Open section"}
                    </span>
                  </span>

                  {badge && badge > 0 ? (
                    <Badge className="h-5 shrink-0 rounded-full border-yellow-500/30 bg-yellow-500/20 px-1.5 text-[10px] text-yellow-300">
                      {badge}
                    </Badge>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </ScrollArea>
  </div>
);
