/* ══════════════════════════════════════════════════════════════
   OrbitX · Admin Dashboard
   Cleaner admin shell with grouped sections and a single admin apps hub.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, lazy, Suspense } from "react";
import {
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAdmin } from "@/hooks/useAdmin";
import { OwnerDeskShell } from "@/components/admin/OwnerDeskShell";
import { AdminPassGate } from "@/components/AdminPassGate";
import NotFound from "@/pages/NotFound";
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
const OnChainCostSection = lazy(() => import("@/components/admin/sections/OnChainCostSection").then((m) => ({ default: m.OnChainCostSection })));

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
  onchain: {
    eyebrow: "Protocol",
    title: "On-chain costs",
    description: "Real Solana meta.fee from indexed signatures. Memo-only target is under 0.00001 SOL. Swaps and new accounts will exceed it.",
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
  const { isAdmin, isOwnerIdentity, deskUnlocked, loading: adminLoading } = useAdmin();
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
  if (adminLoading) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-og-lime" />
      </div>
    );
  }
  if (!isOwnerIdentity) {
    return <NotFound />;
  }
  if (!deskUnlocked || !isAdmin) {
    return <AdminPassGate />;
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
      case "onchain":
        return <OnChainCostSection />;
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
    <OwnerDeskShell
      active={section}
      onChange={(next) => {
        if (next === "users") setHubOpen(true);
        setSection(next);
      }}
      badges={badges}
      title={activeMeta.title}
      eyebrow={activeMeta.eyebrow}
      description={activeMeta.description}
      ownerLabel="Owner session"
      pulse={pulse}
    >
      <Suspense fallback={<Fallback />}>
        {renderActiveSection()}
      </Suspense>
    </OwnerDeskShell>
  );
}
