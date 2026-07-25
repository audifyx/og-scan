import { NavLink, Outlet } from "react-router-dom";
import {
  Bell,
  Headphones,
  Home,
  LayoutDashboard,
  MessageSquare,
  Shield,
  Sparkles,
  Trophy,
  Users,
  UserRound,
  Radio,
  Gift,
} from "lucide-react";
import "../social.css";
import { useSocialStore } from "../hooks/useSocialStore";

const NAV = [
  { to: "/hq", end: true, label: "Home", icon: Home },
  { to: "/hq/feed", end: false, label: "Feed", icon: MessageSquare },
  { to: "/hq/communities", end: false, label: "Communities", icon: Users },
  { to: "/hq/trading", end: false, label: "Trading rooms", icon: Radio },
  { to: "/hq/voice", end: false, label: "Voice", icon: Headphones },
  { to: "/hq/growth", end: false, label: "Growth", icon: Sparkles },
  { to: "/hq/leaderboards", end: false, label: "Leaderboards", icon: Trophy },
  { to: "/hq/creators", end: false, label: "Creators", icon: Gift },
  { to: "/hq/notifications", end: false, label: "Alerts", icon: Bell },
  { to: "/hq/profile", end: false, label: "Profile", icon: UserRound },
  { to: "/hq/admin", end: false, label: "Moderation", icon: Shield },
];

export default function SocialLayout() {
  const { notifications, currentUserId } = useSocialStore();
  const unread = notifications.filter((n) => n.userId === currentUserId && !n.read).length;

  return (
    <div className="oxs-root">
      <div className="oxs-shell">
        <nav className="oxs-nav" aria-label="OrbitX Social">
          <div className="oxs-brand">
            OrbitX
            <span>Social HQ</span>
          </div>
          {NAV.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : undefined)}>
              <Icon size={16} />
              {label}
              {label === "Alerts" && unread > 0 ? (
                <span className="oxs-badge" style={{ marginLeft: "auto" }}>
                  {unread}
                </span>
              ) : null}
            </NavLink>
          ))}
          <div style={{ marginTop: "auto", padding: "1rem 0.55rem 0.2rem", fontSize: "0.72rem" }}>
            <a href="/community" className="oxs-link">
              Full community app →
            </a>
            <br />
            <a href="/intel" className="oxs-link">
              Crypto intel →
            </a>
            <div style={{ marginTop: "0.55rem", display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--oxs-muted)" }}>
              <LayoutDashboard size={12} /> Social · Growth · Voice
            </div>
          </div>
        </nav>
        <main className="oxs-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
