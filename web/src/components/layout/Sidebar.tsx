import {
  Bell, Headset, LineChart, LogOut, Mail,
  MessageSquare, Settings, Trophy,
  User, Wallet, X, Shield, Menu, Users, Wrench, Home,
} from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { OGSCAN_TOKEN_MINT, shortAddr } from "@/lib/og";

// ── nav sections ────────────────────────────────────────────────────────

type NavItem = { to: string; icon: React.ComponentType<{ className?: string }>; label: string; eyebrow: string };

const mainItems: NavItem[] = [
  { to: "/app",        icon: Home,          label: "Home",      eyebrow: "Command hub" },
  { to: "/community",  icon: Users,         label: "Community", eyebrow: "Social & voice" },
  { to: "/tools",      icon: Wrench,        label: "Tools",     eyebrow: "Scanners & feeds" },
  { to: "/profile",    icon: User,          label: "Profile",   eyebrow: "Your account" },
];

const tradingItems: NavItem[] = [
  { to: "/wallets",         icon: Wallet,        label: "Wallets",         eyebrow: "Tracked wallets" },
  { to: "/charts",          icon: LineChart,     label: "Charts",          eyebrow: "Live charts" },
  { to: "/callouts",        icon: Bell,          label: "Callouts",        eyebrow: "Trade alerts" },
  { to: "/trading-lobbies", icon: MessageSquare, label: "Trading Lobbies", eyebrow: "Voice + charts" },
  { to: "/leaderboard",     icon: Trophy,        label: "Leaderboard",     eyebrow: "Top traders" },
  { to: "/messages",        icon: Mail,          label: "Messages",        eyebrow: "Direct messages" },
  { to: "/support",         icon: Headset,       label: "Support Chat",    eyebrow: "Tickets + live help" },
];

// ── NavRow ────────────────────────────────────────────────────────────────

const NavRow = ({ item, onClick }: { item: NavItem; onClick?: () => void }) => {
  const location = useLocation();
  const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + "/");

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
        isActive
          ? "bg-white/[0.09] text-white"
          : "text-white/55 hover:bg-white/[0.04] hover:text-white/90",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition",
          isActive
            ? "border-og-cyan/40 bg-og-cyan/10 text-og-cyan"
            : "border-white/10 bg-white/[0.04]",
        )}
      >
        <item.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight">{item.label}</span>
        <span className="block truncate text-[10px] text-white/35">{item.eyebrow}</span>
      </span>
      {isActive && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-og-cyan" />
      )}
    </NavLink>
  );
};

// ── Section label ─────────────────────────────────────────────────────────

const SectionLabel = ({ label }: { label: string }) => (
  <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">{label}</p>
);

// ── Sidebar ───────────────────────────────────────────────────────────────

export const Sidebar = () => {
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile hamburger trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-xl bg-background/90 border border-border text-muted-foreground backdrop-blur-xl transition hover:bg-white/[0.08] hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-border bg-card/80 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4">
          <NavLink to="/app" onClick={closeMobile} className="flex items-center gap-3 text-left">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-og-lime/50 bg-og-lime/10">
              <img src="/icon.png" alt="OGScan" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-og-lime shadow-[0_0_6px_hsl(var(--og-lime))]" />
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-wide text-white">OGScan</div>
              <div className="text-[10px] font-semibold tracking-widest text-og-cyan/80">PRO TRADING SUITE</div>
            </div>
          </NavLink>
          <button
            type="button"
            onClick={closeMobile}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-scrollbar flex-1 overflow-y-auto px-2 py-3 pr-1">
          <div className="mb-1 mt-3">
            <SectionLabel label="Main" />
            <div className="space-y-0.5">
              {mainItems.map((item) => <NavRow key={item.to} item={item} onClick={closeMobile} />)}
            </div>
          </div>

          <div className="mb-1 mt-4">
            <SectionLabel label="Trading" />
            <div className="space-y-0.5">
              {tradingItems.map((item) => <NavRow key={item.to} item={item} onClick={closeMobile} />)}
            </div>
          </div>

          {isAdmin && (
            <div className="mb-1 mt-4">
              <SectionLabel label="Admin" />
              <div className="space-y-0.5">
                <NavRow
                  item={{ to: "/admin", icon: Shield, label: "Admin Panel", eyebrow: "Dashboard + apps hub" }}
                  onClick={closeMobile}
                />
              </div>
            </div>
          )}
        </nav>

        {/* Official token */}
        <div className="border-t border-white/[0.07] px-3 pb-4 pt-2">
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">Official Token</div>
          <div className="mt-1 font-mono text-[10px] text-white/50">
            CA {shortAddr(OGSCAN_TOKEN_MINT, 5)}
          </div>
        </div>

        {/* User footer */}
        <div className="border-t border-white/[0.07] p-3">
          {user ? (
            <div className="space-y-2">
              <div
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition hover:border-og-lime/25 hover:bg-white/[0.07]"
                onClick={() => { closeMobile(); navigate("/profile"); }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-og-lime/20 text-sm font-black text-og-lime">
                  {profile?.username?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-white">{profile?.username || "User"}</p>
                  <p className="truncate text-[10px] text-white/40">{user.email}</p>
                </div>
                <User className="h-3.5 w-3.5 text-white/30" />
              </div>
              <div className="flex gap-2">
                <NavLink
                  to="/settings"
                  onClick={closeMobile}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-[11px] text-white/40 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Settings className="h-3.5 w-3.5" /> Settings
                </NavLink>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex-1 justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-[11px] text-white/40 hover:border-red-500/30 hover:bg-red-500/8 hover:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => navigate("/auth")}
              className="w-full rounded-xl bg-og-lime py-2.5 text-sm font-black text-background shadow-[0_0_24px_-8px_#bef264] transition hover:bg-white"
            >
              Sign In
            </Button>
          )}
        </div>
      </aside>
    </>
  );
};
