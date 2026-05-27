/* ══════════════════════════════════════════════════════════════
   OG Scan · Admin Dashboard (v2 — 17 sections)
   ══════════════════════════════════════════════════════════════
   Modular admin panel with sidebar navigation.
   Each section lives in components/admin/sections/*
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2, PanelLeft } from "lucide-react";
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
const OrgAffiliates = lazy(() => import("@/components/admin/sections/OrgAffiliates").then((m) => ({ default: m.OrgAffiliates })));
const AffiliateManagement = lazy(() => import("@/components/admin/sections/AffiliateManagement").then((m) => ({ default: m.AffiliateManagement })));

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
  org_affiliates: OrgAffiliates,
  affiliates: AffiliateManagement,
};

const Fallback = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" />
  </div>
);

const SECTION_LABELS: Record<AdminSection, string> = {
  overview: "Dashboard Overview",
  users: "User Management",
  communities: "Community Management",
  moderation: "Content Moderation",
  lobbies: "Lobby Management",
  tokens: "Token Submissions",
  spaces: "Spaces Management",
  support: "Support Center",
  chat: "Chat Management",
  notifications: "Notifications",
  alerts: "Price Alerts",
  wallets: "Wallet Trade Management",
  media: "Media Management",
  settings: "Platform Settings",
  audit: "Audit Log",
  analytics: "Analytics",
  tools: "Tools",
  org_affiliates: "Org Affiliates",
  affiliates: "Affiliates",
};

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [section, setSection] = useState<AdminSection>("overview");
  const [badges, setBadges] = useState<Partial<Record<AdminSection, number>>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 767px)");
    const syncLayout = (matches: boolean) => {
      setIsMobile(matches);
      setSidebarOpen(!matches);
    };

    syncLayout(media.matches);

    const handleChange = (event: MediaQueryListEvent) => syncLayout(event.matches);

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

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
  const activeSectionLabel = SECTION_LABELS[section];

  return (
    <AppLayout>
      <div className="relative flex h-[calc(100vh-60px)] overflow-hidden">
        {isMobile && sidebarOpen && (
          <button
            type="button"
            aria-label="Close admin navigation"
            className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={[
            "transition-all duration-300 flex-shrink-0",
            isMobile
              ? `fixed inset-y-0 left-0 z-40 w-[240px] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
              : "w-[240px]",
          ].join(" ")}
        >
          <AdminSidebar
            active={section}
            onChange={(next) => {
              setSection(next);
              if (isMobile) setSidebarOpen(false);
            }}
            badges={badges}
            onBack={() => navigate("/")}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 pt-16 sm:p-6 md:pt-6">
            {isMobile && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 md:hidden">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#0b1420] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                  aria-label="Open admin navigation"
                >
                  <PanelLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Admin navigation</p>
                  <p className="truncate text-sm font-semibold text-white/85">{activeSectionLabel}</p>
                </div>
              </div>
            )}

            <Suspense fallback={<Fallback />}>
              <ActiveSection />
            </Suspense>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
