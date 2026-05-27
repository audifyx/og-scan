/* ══════════════════════════════════════════════════════════════
   OG Scan · Admin Dashboard (v3 — mobile-responsive)
   ══════════════════════════════════════════════════════════════
   Modular admin panel with sidebar navigation.
   Each section lives in components/admin/sections/*
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, Menu, X } from "lucide-react";
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
  // Desktop: sidebar open by default; mobile: closed by default
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

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

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const handleSectionChange = (s: AdminSection) => {
    setSection(s);
    // Auto-close sidebar on mobile after selecting a section
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const ActiveSection = SECTION_MAP[section];

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-60px)] overflow-hidden relative">

        {/* ── Mobile overlay backdrop ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ──
            Desktop: static, pushes content.
            Mobile: fixed overlay, slides in from left. */}
        <div
          className={[
            "flex-shrink-0 h-full z-30 transition-all duration-300",
            // Mobile: fixed overlay
            "fixed md:static",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            sidebarOpen ? "w-[240px]" : "md:w-0 w-[240px]",
            !sidebarOpen && "md:overflow-hidden",
          ].join(" ")}
        >
          <AdminSidebar
            active={section}
            onChange={handleSectionChange}
            badges={badges}
            onBack={() => navigate("/")}
          />
        </div>

        {/* ── Main content area ── */}
        <div className="flex-1 overflow-auto min-w-0">
          {/* Mobile top bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] md:hidden">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-white/60 hover:text-white transition"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <span className="text-sm font-semibold capitalize text-white/80">{section}</span>
          </div>

          <div className="max-w-7xl mx-auto p-4 md:p-6">
            <Suspense fallback={<Fallback />}>
              <ActiveSection />
            </Suspense>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
