/* ══════════════════════════════════════════════════════════════
   OrbitX · Admin Dashboard
   Cleaner admin shell with grouped sections and a single admin apps hub.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  PanelLeft,
  Shield,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminPassGate } from "@/components/AdminPassGate";
import type { AdminSection } from "@/components/admin/types";
import {
  CommandApps,
  CommandFees,
  CommandHealth,
  CommandLiveUsers,
  CommandOverview,
  CommandTable,
  OwnerUserHub,
} from "@/components/admin/sections/OwnerCommand";
import { ownerCommand } from "@/lib/orbitx/ownerCommand";

const AdminAppsSection = lazy(() => import("@/components/admin/sections/AdminAppsSection").then((m) => ({ default: m.AdminAppsSection })));
const UserManagement = lazy(() => import("@/components/admin/sections/UserManagement").then((m) => ({ default: m.UserManagement })));
const CommunityManagement = lazy(() => import("@/components/admin/sections/CommunityManagement").then((m) => ({ default: m.CommunityManagement })));
const ContentModeration = lazy(() => import("@/components/admin/sections/ContentModeration").then((m) => ({ default: m.ContentModeration })));
const LobbyManagement = lazy(() => import("@/components/admin/sections/LobbyManagement").then((m) => ({ default: m.LobbyManagement })));
const TokenSubmissions = lazy(() => import("@/components/admin/sections/TokenSubmissions").then((m) => ({ default: m.TokenSubmissions })));
const SpacesManagement = lazy(() => import("@/components/admin/sections/SpacesManagement").then((m) => ({ default: m.SpacesManagement })));
const SupportCenter = lazy(() => import("@/components/admin/sections/SupportCenter").then((m) => ({ default: m.SupportCenter })));
const ChatManagement = lazy(() => import("@/components/admin/sections/ChatManagement").then((m) => ({ default: m.ChatManagement })));
const NotificationsManager = lazy(() => import("@/components/admin/sections/NotificationsManager").then((m) => ({ default: m.NotificationsManager })));
const AnnouncementManager = lazy(() => import("@/components/admin/sections/AnnouncementManager").then((m) => ({ default: m.AnnouncementManager })));
const AdvancedAnalytics = lazy(() => import("@/components/admin/sections/AdvancedAnalytics").then((m) => ({ default: m.AdvancedAnalytics })));
const ApiSettings = lazy(() => import("@/components/admin/sections/ApiSettings").then((m) => ({ default: m.ApiSettings })));
const PriceAlerts = lazy(() => import("@/components/admin/sections/PriceAlerts").then((m) => ({ default: m.PriceAlerts })));
const WalletTradeManagement = lazy(() => import("@/components/admin/sections/WalletTradeManagement").then((m) => ({ default: m.WalletTradeManagement })));
const MediaManagement = lazy(() => import("@/components/admin/sections/MediaManagement").then((m) => ({ default: m.MediaManagement })));
const PlatformSettings = lazy(() => import("@/components/admin/sections/PlatformSettings").then((m) => ({ default: m.PlatformSettings })));
const AuditLog = lazy(() => import("@/components/admin/sections/AuditLog").then((m) => ({ default: m.AuditLog })));
const Analytics = lazy(() => import("@/components/admin/sections/Analytics").then((m) => ({ default: m.Analytics })));
const ToolsSection = lazy(() => import("@/components/admin/sections/ToolsSection").then((m) => ({ default: m.ToolsSection })));
const OrgAffiliates = lazy(() => import("@/components/admin/sections/OrgAffiliates").then((m) => ({ default: m.OrgAffiliates })));
const AffiliateManagement = lazy(() => import("@/components/admin/sections/AffiliateManagement").then((m) => ({ default: m.AffiliateManagement })));

const Fallback = () => (
  <div className="flex h-64 items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-[#22d3ee]" />
  </div>
);

const SECTION_META: Record<AdminSection, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "Command center",
    title: "OrbitX owner dashboard",
    description: "Live users, verified volume, platform fees, and OrbitX burns — one owner console.",
  },
  live_users: {
    eyebrow: "Presence",
    title: "Live users",
    description: "Who is on OrbitX right now, which app they are in, and on which device.",
  },
  user_activity: {
    eyebrow: "Live ops",
    title: "User activity",
    description: "Platform event stream. Filter by event type. Nothing here is estimated.",
  },
  revenue: {
    eyebrow: "Revenue",
    title: "Platform revenue",
    description: "Fees from verified ledger rows only. Formula: min(1.2% of USD, $10).",
  },
  burns: {
    eyebrow: "Token",
    title: "OrbitX burns",
    description: "Counted only after on-chain verification (ox_admin_burns + mcp_burn_ledger).",
  },
  transactions: {
    eyebrow: "Ledger",
    title: "Transactions",
    description: "Completed requires verified_onchain. Search by signature, user, or status.",
  },
  jupiter: {
    eyebrow: "Jupiter",
    title: "Jupiter transactions",
    description: "Swaps that flowed through the centralized OrbitX transaction service.",
  },
  trading: {
    eyebrow: "Trading",
    title: "Trading",
    description: "Wallets, trades, and DEX activity for owner inspection.",
  },
  launches: {
    eyebrow: "Launch",
    title: "Token launches",
    description: "OrbitX launch queue, listings, and launch-day counts from live registry data.",
  },
  apps: {
    eyebrow: "Apps",
    title: "Platform apps",
    description: "Presence and fees broken down by OrbitX application.",
  },
  games: {
    eyebrow: "Play",
    title: "Games",
    description: "Sessions and activity attributed to /play.",
  },
  referrals: {
    eyebrow: "Growth",
    title: "Referrals",
    description: "Affiliate and referral programs.",
  },
  fees: {
    eyebrow: "Fees",
    title: "Fee engine",
    description: "1.2% capped at $10, enforced in the backend fee module — not the client.",
  },
  health: {
    eyebrow: "Reliability",
    title: "System health",
    description: "Database, Jupiter, RPC, failed txs, fee and burn processors.",
  },
  security: {
    eyebrow: "Safety",
    title: "Security",
    description: "Moderation, enforcement, and owner security events.",
  },
  admin_apps: {
    eyebrow: "Owner workflows",
    title: "Admin apps",
    description: "All owner-only app surfaces in one hub instead of scattered through the sidebar.",
  },
  users: {
    eyebrow: "People",
    title: "User management",
    description: "Search, review, and manage account-level user data and profile operations.",
  },
  communities: {
    eyebrow: "Community",
    title: "Community management",
    description: "Oversee communities, activity, and engagement surfaces across the platform.",
  },
  moderation: {
    eyebrow: "Safety",
    title: "Content moderation",
    description: "Review and control flagged content, enforcement actions, and moderation flow.",
  },
  lobbies: {
    eyebrow: "Voice + trading",
    title: "Trading lobbies",
    description: "Monitor lobby activity, access, and live interaction quality.",
  },
  tokens: {
    eyebrow: "OGS Token",
    title: "Token listings",
    description: "Review pending token submissions, manage featured listings, and keep the OGS token queue clean.",
  },
  spaces: {
    eyebrow: "Audio",
    title: "Spaces management",
    description: "Manage live and scheduled spaces, recordings, and platform voice activity.",
  },
  support: {
    eyebrow: "Tickets",
    title: "Support center",
    description: "Handle open support workload and keep response queues under control.",
  },
  chat: {
    eyebrow: "Messaging",
    title: "Chat management",
    description: "Monitor chat systems, AI surfaces, and conversation activity.",
  },
  notifications: {
    eyebrow: "Messaging ops",
    title: "Notifications",
    description: "Control outbound announcements, alerts, and notification delivery tools.",
  },
  announcements: {
    eyebrow: "Broadcast",
    title: "Announcements",
    description: "Publish, schedule, and retire platform-wide announcements by severity and audience.",
  },
  advanced_analytics: {
    eyebrow: "Deep metrics",
    title: "Deep Analytics",
    description: "Trading, token, launchpad, and scanner analytics from live platform data.",
  },
  activity: {
    eyebrow: "Live ops",
    title: "Activity Feed",
    description: "Unified chronological feed of platform, user, and on-chain live events.",
  },
  api: {
    eyebrow: "Developer platform",
    title: "API Settings",
    description: "Manage platform API secrets, developer API keys, and rate-limit activity.",
  },
  alerts: {
    eyebrow: "Market monitoring",
    title: "Price alerts",
    description: "Review active alerts and maintain trading notification quality.",
  },
  wallets: {
    eyebrow: "Trading data",
    title: "Wallets & trades",
    description: "Inspect wallet tracking, trade history, and related admin actions.",
  },
  media: {
    eyebrow: "Assets",
    title: "Media management",
    description: "Manage media assets and keep platform visuals organized.",
  },
  settings: {
    eyebrow: "Platform",
    title: "Platform settings",
    description: "Adjust configuration, operational settings, and admin controls.",
  },
  audit: {
    eyebrow: "Logs",
    title: "Audit log",
    description: "Track admin actions and review historical system changes.",
  },
  analytics: {
    eyebrow: "Reporting",
    title: "Analytics",
    description: "Review platform-level performance and admin-facing operational metrics.",
  },
  tools: {
    eyebrow: "Advanced",
    title: "Admin tools",
    description: "Owner-only advanced tools for Spaces, AI, enterprise, and developer workflows.",
  },
  org_affiliates: {
    eyebrow: "Growth",
    title: "Org affiliates",
    description: "Manage official org-level affiliate relationships and related status assignments.",
  },
  affiliates: {
    eyebrow: "Growth",
    title: "Affiliates",
    description: "Review and manage affiliate accounts, approvals, and network activity.",
  },
};

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, deskUnlocked, loading: adminLoading } = useAdmin();
  const [section, setSection] = useState<AdminSection>("overview");
  const [badges, setBadges] = useState<Partial<Record<AdminSection, number>>>({});
  const [pulse, setPulse] = useState<{ users: number; posts24: number; liveSpaces: number; online: number } | null>(null);
  const [hubUserId, setHubUserId] = useState<string | null>(null);
  const [hubOpen, setHubOpen] = useState(false);

  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const json = await ownerCommand<{ data: { users: { total: number; onlineNow: number; dau: number }; activity: { txToday: number } } }>("overview");
        const d = json.data;
        if (on && d) {
          setPulse({
            users: d.users.total || 0,
            posts24: d.activity.txToday || 0,
            liveSpaces: d.users.dau || 0,
            online: d.users.onlineNow || 0,
          });
        }
      } catch {
        /* owner API requires JWT + owner allowlist */
      }
    };
    void load();
    const id = setInterval(load, 8000);
    return () => {
      on = false;
      clearInterval(id);
    };
  }, []);
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

  // ── Owner-only gate ─────────────────────────────────────────────────────────
  // ProtectedRoute only checks auth. We enforce owner-only here server-side style.
  if (adminLoading) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-og-lime" />
      </div>
    );
  }
  if (!deskUnlocked) {
    return <AdminPassGate />;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <h1 className="mb-2 text-lg font-bold text-white">Unavailable</h1>
          <p className="text-sm text-white/45">
            {user?.email
              ? "This surface is limited to the owner account."
              : "Sign in as the owner account, then reopen this page."}
          </p>
        </div>
      </div>
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  const activeMeta = SECTION_META[section] || SECTION_META.overview;

  const renderActiveSection = () => {
    switch (section) {
      case "overview":
        return <CommandOverview onNavigate={setSection} />;
      case "live_users":
        return (
          <CommandLiveUsers
            onOpenUser={(id) => {
              setHubUserId(id);
              setHubOpen(true);
              setSection("users");
            }}
          />
        );
      case "user_activity":
      case "activity":
        return <CommandTable action="events" title="Live activity" hint="Owner event stream. Filter by event type (USER_LOGIN, SWAP_COMPLETED, ORBITX_BURNED…)." />;
      case "revenue":
        return <CommandFees />;
      case "fees":
        return <CommandFees />;
      case "burns":
        return <CommandTable action="burns" title="OrbitX burns" hint="Verified on-chain burns only. MCP access burns merge in after confirmation." />;
      case "transactions":
        return <CommandTable action="ledger" title="Transaction ledger" hint="Completed = status completed AND verified_onchain. Search a signature." />;
      case "jupiter":
        return <CommandTable action="jupiter" title="Jupiter transactions" hint="Swap/buy/sell rows from the centralized ledger." />;
      case "health":
        return <CommandHealth />;
      case "apps":
      case "games":
        return <CommandApps onNavigate={setSection} />;
      case "users":
        return hubOpen ? (
          <OwnerUserHub openUserId={hubUserId} onClose={() => { setHubOpen(false); setHubUserId(null); }} />
        ) : (
          <UserManagement />
        );
      case "admin_apps":
        return <AdminAppsSection />;
      case "communities":
        return <CommunityManagement />;
      case "moderation":
      case "security":
        return <ContentModeration />;
      case "lobbies":
        return <LobbyManagement />;
      case "tokens":
      case "launches":
        return <TokenSubmissions />;
      case "spaces":
        return <SpacesManagement />;
      case "support":
        return <SupportCenter />;
      case "chat":
        return <ChatManagement />;
      case "notifications":
        return <NotificationsManager />;
      case "announcements":
        return <AnnouncementManager />;
      case "advanced_analytics":
        return <AdvancedAnalytics />;
      case "api":
        return <ApiSettings />;
      case "alerts":
        return <PriceAlerts />;
      case "wallets":
      case "trading":
        return <WalletTradeManagement />;
      case "media":
        return <MediaManagement />;
      case "settings":
        return <PlatformSettings />;
      case "audit":
        return (
          <div className="space-y-6">
            <CommandTable action="audit" title="Owner audit" hint="Immutable ox_admin_audit rows. Lookups and config changes from this console." />
            <AuditLog />
          </div>
        );
      case "analytics":
        return (
          <div className="space-y-6">
            <CommandOverview onNavigate={setSection} />
            <Analytics />
          </div>
        );
      case "tools":
        return <ToolsSection />;
      case "org_affiliates":
        return <OrgAffiliates />;
      case "affiliates":
      case "referrals":
        return <AffiliateManagement />;
      default:
        return <CommandOverview onNavigate={setSection} />;
    }
  };

  return (
    <AppLayout>
      <div className="relative flex h-[calc(100vh-60px)] overflow-hidden bg-[#050b12] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.09),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.06),transparent_24%)]" />

        {isMobile && sidebarOpen && (
          <button
            type="button"
            aria-label="Close admin navigation"
            className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={[
            "transition-all duration-300 flex-shrink-0",
            isMobile
              ? `fixed inset-y-0 left-0 z-40 w-[280px] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
              : "w-[300px]",
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

        <div className="relative z-10 flex-1 overflow-auto">
          <div className="mx-auto max-w-[1500px] p-4 pt-16 sm:p-6 md:pt-6">
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
                  <p className="truncate text-sm font-semibold text-white/85">{activeMeta.title}</p>
                </div>
              </div>
            )}

            <div className="mb-6 rounded-[32px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(8,16,27,0.95),rgba(14,27,41,0.96)_46%,rgba(34,211,238,0.10))] p-5 shadow-[0_30px_120px_-70px_rgba(34,211,238,0.75)] sm:p-7">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/75">
                    <Shield className="h-3.5 w-3.5" /> {activeMeta.eyebrow}
                  </div>
                  <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">{activeMeta.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-[15px]">{activeMeta.description}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Owner mode</p>
                    <p className="mt-2 text-sm font-semibold text-white/85">{user?.email || "Admin session"}</p>
                    <p className="mt-1 text-xs text-white/40">Live control access enabled</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Open queue</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                        Tickets {badges.support || 0}
                      </span>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                        Token reviews {badges.tokens || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {pulse && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Total users", value: pulse.users, tone: "text-cyan-200", ring: "border-cyan-300/15 bg-cyan-300/[0.06]" },
                    { label: "Online now", value: pulse.online, tone: "text-emerald-300", ring: "border-emerald-400/15 bg-emerald-400/[0.06]" },
                    { label: "Txs today", value: pulse.posts24, tone: "text-violet-300", ring: "border-violet-400/15 bg-violet-400/[0.06]" },
                    { label: "DAU", value: pulse.liveSpaces, tone: "text-rose-300", ring: "border-rose-400/15 bg-rose-400/[0.06]" },
                  ].map((c) => (
                    <div key={c.label} className={`rounded-2xl border px-4 py-3 ${c.ring}`}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{c.label}</p>
                      <p className={`mt-1 text-2xl font-black tabular-nums ${c.tone}`}>{c.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHubOpen(true);
                    setSection("users");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                >
                  User hub
                </button>
                {[
                  { label: "Live", section: "live_users" as AdminSection },
                  { label: "Ledger", section: "transactions" as AdminSection },
                  { label: "Burns", section: "burns" as AdminSection },
                  { label: "Health", section: "health" as AdminSection },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => setSection(chip.section)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/65 transition hover:border-cyan-300/20 hover:bg-cyan-300/10 hover:text-white"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-white/[0.08] bg-[#07101a]/88 p-4 shadow-[0_30px_100px_-70px_rgba(0,0,0,0.95)] sm:p-6 mb-20 md:mb-0">
              <Suspense fallback={<Fallback />}>
                {renderActiveSection()}
              </Suspense>
            </div>
          </div>
        </div>

        {isMobile && (
          <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#08101b]/95 pb-[env(safe-area-inset-bottom)] md:hidden">
            <div className="grid grid-cols-5">
              {(
                [
                  ["overview", "Home"],
                  ["live_users", "Live"],
                  ["users", "Users"],
                  ["transactions", "Tx"],
                  ["health", "Health"],
                ] as [AdminSection, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (id === "users") setHubOpen(true);
                    setSection(id);
                  }}
                  className={`py-3 text-[10px] font-bold uppercase tracking-wider ${
                    section === id ? "text-cyan-300" : "text-white/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </nav>
        )}
      </div>
    </AppLayout>
  );
}
