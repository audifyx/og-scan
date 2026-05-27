/* ══════════════════════════════════════════════════════════════
   OG Scan · Admin Dashboard (v2 — 17 sections)
   ══════════════════════════════════════════════════════════════
   Modular admin panel with sidebar navigation.
   Each section lives in components/admin/sections/*
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { AdminSection } from "@/components/admin/types";

// Lazy-load each section for fast initial load
const OverviewSection = lazy(() => import("@/components/admin/sections/OverviewSection").then((m) => ({ default: m.OverviewSection })));
const UserManagement = lazy(() => import("@/components/admin/sections/UserManagement").then((m) => ({ default: m.UserManagement })));
const CommunityManagement = lazy(() => import("@/components/admin/sections/CommunityManagement").then((m) => ({ default: m.CommunityManagement })));
const ContentModeration = lazy(() => import("@/components/admin/sections/ContentModeration").then((m) => ({ default: m.ContentModeration })));
const LobbyManagement = lazy(() => import("@/components/admin/sections/LobbyManagement").then((m) => ({ default: m.LobbyManagement })));
const TokenSubmissions = lazy(() => import("@/components/admin/sections/TokenSubmissions").then((m) => ({ default: m.TokenSubmissions })));
const SpacesManagement = lazy(() => import("@/components/admin/sections/SpacesManagement").then((m) => ({ default: m.SpacesManagement })));
const SupportCenter = lazy(() => import("@/components/admin/sections/SupportCenter").then((m) => ({ default: m.SupportCenter })));
const ChatManagement = lazy(() => import("@/components/admin/sections/ChatManagement").then((m) => ({ default: m.ChatManagement })));
const NotificationsManager = lazy(() => import("@/components/admin/sections/NotificationsManager").then((m) => ({ default: m.NotificationsManager })));
const PriceAlerts = lazy(() => import("@/components/admin/sections/PriceAlerts").then((m) => ({ default: m.PriceAlerts })));
const WalletTradeManagement = lazy(() => import("@/components/admin/sections/WalletTradeManagement").then((m) => ({ default: m.WalletTradeManagement })));
const MediaManagement = lazy(() => import("@/components/admin/sections/MediaManagement").then((m) => ({ default: m.MediaManagement })));
const PlatformSettings = lazy(() => import("@/components/admin/sections/PlatformSettings").then((m) => ({ default: m.PlatformSettings })));
const AuditLog = lazy(() => import("@/components/admin/sections/AuditLog").then((m) => ({ default: m.AuditLog })));
const Analytics = lazy(() => import("@/components/admin/sections/Analytics").then((m) => ({ default: m.Analytics })));
const ToolsSection = lazy(() => import("@/components/admin/sections/ToolsSection").then((m) => ({ default: m.ToolsSection })));

const SECTION_MAP: Record<AdminSection, React.LazyExoticComponent<React.FC>> = {
  overview: OverviewSection,
  users: UserManagement,
  communities: CommunityManagement,
  moderation: ContentModeration,
  lobbies: LobbyManagement,
  tokens: TokenSubmissions,
  spaces: SpacesManagement,
  support: SupportCenter,
  chat: ChatManagement,
  notifications: NotificationsManager,
  alerts: PriceAlerts,
  wallets: WalletTradeManagement,
  media: MediaManagement,
  settings: PlatformSettings,
  audit: AuditLog,
  analytics: Analytics,
  tools: ToolsSection,
};

const Fallback = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" />
  </div>
);

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [section, setSection] = useState<AdminSection>("overview");
  const [badges, setBadges] = useState<Partial<Record<AdminSection, number>>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Quick badge counts for sidebar
  useEffect(() => {
    (async () => {
      const [openTickets, pendingSubs] = await Promise.all([
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("pump_v5_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setBadges({
        support: openTickets.count || 0,
        tokens: pendingSubs.count || 0,
      });
    })();
  }, [section]);

  const ActiveSection = SECTION_MAP[section];

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-60px)] overflow-hidden">
        {/* Sidebar */}
        <div
          className={`transition-all duration-300 flex-shrink-0 ${
            sidebarOpen ? "w-[240px]" : "w-0 overflow-hidden"
          }`}
        >
          <AdminSidebar
            active={section}
            onChange={setSection}
            badges={badges}
            onBack={() => navigate("/")}
          />
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-0 top-1/2 z-30 -translate-y-1/2 p-1 rounded-r-lg bg-white/[0.04] border border-white/10 border-l-0 text-white/40 hover:text-white/80 transition md:hidden"
          style={{ left: sidebarOpen ? "240px" : "0px" }}
        >
          {sidebarOpen ? "‹" : "›"}
        </button>

        {/* Main content area */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">
            <Suspense fallback={<Fallback />}>
              <ActiveSection />
            </Suspense>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
