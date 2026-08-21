import type { AdminSection } from "./types";

export type DeskNavItem = {
  id: AdminSection;
  label: string;
  icon: string;
  short?: string;
};

export type DeskNavGroup = {
  group: string;
  items: DeskNavItem[];
};

export const DESK_NAV: DeskNavGroup[] = [
  {
    group: "Command",
    items: [
      { id: "overview", label: "Overview", icon: "LayoutDashboard", short: "Home" },
      { id: "live_users", label: "Live Users", icon: "Radio", short: "Live" },
      { id: "user_activity", label: "User Activity", icon: "Activity", short: "Activity" },
      { id: "users", label: "Users", icon: "Users", short: "Users" },
      { id: "analytics", label: "Analytics", icon: "TrendingUp" },
    ],
  },
  {
    group: "Money",
    items: [
      { id: "revenue", label: "Platform Revenue", icon: "BarChart3", short: "Rev" },
      { id: "fees", label: "Fees", icon: "Wallet" },
      { id: "burns", label: "OrbitX Burns", icon: "Flame", short: "Burns" },
      { id: "transactions", label: "Transactions", icon: "Activity", short: "Tx" },
      { id: "jupiter", label: "Jupiter Transactions", icon: "Rocket" },
    ],
  },
  {
    group: "Apps",
    items: [
      { id: "trading", label: "Trading", icon: "TrendingUp" },
      { id: "launches", label: "Token Launches", icon: "Rocket" },
      { id: "apps", label: "Platform Apps", icon: "PanelTop" },
      { id: "communities", label: "Communities", icon: "Globe2" },
      { id: "games", label: "Games", icon: "Gamepad2" },
      { id: "referrals", label: "Referrals", icon: "UserCheck" },
    ],
  },
  {
    group: "System",
    items: [
      { id: "health", label: "System Health", icon: "HeartPulse", short: "Health" },
      { id: "security", label: "Security", icon: "Shield" },
      { id: "audit", label: "Audit Logs", icon: "FileText" },
      { id: "settings", label: "Admin Settings", icon: "Settings" },
    ],
  },
  {
    group: "Operations",
    items: [
      { id: "moderation", label: "Moderation", icon: "Shield" },
      { id: "support", label: "Support", icon: "Headset" },
      { id: "spaces", label: "Spaces", icon: "Mic" },
      { id: "lobbies", label: "Trading Lobbies", icon: "Headphones" },
      { id: "announcements", label: "Announcements", icon: "Megaphone" },
      { id: "api", label: "API Settings", icon: "KeyRound" },
      { id: "admin_apps", label: "Admin Apps", icon: "PanelTop" },
    ],
  },
];

export const DESK_MOBILE_TABS: DeskNavItem[] = [
  { id: "overview", label: "Home", icon: "LayoutDashboard", short: "Home" },
  { id: "live_users", label: "Live", icon: "Radio", short: "Live" },
  { id: "users", label: "Users", icon: "Users", short: "Users" },
  { id: "transactions", label: "Tx", icon: "Activity", short: "Tx" },
  { id: "health", label: "Health", icon: "HeartPulse", short: "Health" },
];

export function flattenDeskNav(): DeskNavItem[] {
  return DESK_NAV.flatMap((g) => g.items);
}
