import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { useState } from "react";
import {
  Bell,
  Bookmark,
  Home,
  Mail,
  MoreHorizontal,
  Radio,
  Search,
  Trophy,
  UserRound,
  Users,
  Gift,
  Feather,
  Globe,
} from "lucide-react";
import "../social.css";
import { useSocialStore, useCurrentProfile } from "../hooks/useSocialStore";
import { SocialRightRail } from "../components/SocialRightRail";

const PRIMARY: { to: string; end?: boolean; label: string; icon: typeof Home; match?: string[] }[] = [
  { to: "/hq/feed", label: "Home", icon: Home, match: ["/hq", "/hq/feed"] },
  { to: "/hq/communities", label: "Explore", icon: Search },
  { to: "/hq/notifications", label: "Notifications", icon: Bell },
  { to: "/hq/messages", label: "Messages", icon: Mail },
  { to: "/hq/trading", label: "Communities", icon: Globe },
  { to: "/hq/spaces", label: "Spaces", icon: Radio },
  { to: "/hq/profile", label: "Profile", icon: UserRound },
  { to: "/hq/feed", label: "Bookmarks", icon: Bookmark },
];

const MORE = [
  { to: "/hq/chat", label: "Channels" },
  { to: "/hq/rooms", label: "Rooms" },
  { to: "/hq/voice", label: "Voice" },
  { to: "/hq/trading", label: "Trading" },
  { to: "/hq/growth", label: "Growth & XP" },
  { to: "/hq/leaderboards", label: "Leaderboards" },
  { to: "/hq/creators", label: "Creators" },
];

const MOBILE = [
  { to: "/hq/feed", label: "Home", icon: Home },
  { to: "/hq/communities", label: "Explore", icon: Search },
  { to: "/hq/communities", label: "Communities", icon: Users },
  { to: "/hq/messages", label: "Messages", icon: Mail },
  { to: "/hq/profile", label: "Profile", icon: UserRound },
];

function navActive(pathname: string, to: string, match?: string[]) {
  if (match?.some((m) => (m === "/hq" ? pathname === "/hq" : pathname.startsWith(m)))) return true;
  return pathname === to || pathname.startsWith(to + "/");
}

export default function SocialLayout() {
  const { notifications, currentUserId } = useSocialStore();
  const me = useCurrentProfile();
  const loc = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const unread = notifications.filter((n) => n.userId === currentUserId && !n.read).length;
  const wide = ["/hq/messages", "/hq/chat", "/hq/rooms", "/hq/spaces"].some((p) => loc.pathname.startsWith(p));
  const showRail = !wide;

  return (
    <div className="oxs-root">
      <div className="oxs-mobile-top">
        <Link to="/hq/feed" className="oxs-logo" style={{ padding: 0 }}>
          <span className="oxs-logo-mark">O</span>
          <span className="oxs-logo-text">OrbitX</span>
        </Link>
        <Link to="/hq/notifications" className="oxs-nav-item" style={{ padding: 8, width: "auto" }}>
          <Bell size={22} />
          {unread > 0 ? <span className="oxs-nav-badge">{unread > 9 ? "9+" : unread}</span> : null}
        </Link>
      </div>

      <div className="oxs-shell">
        <header className="oxs-left">
          <div>
            <Link to="/hq/feed" className="oxs-logo">
              <span className="oxs-logo-mark">O</span>
              <span className="oxs-logo-text">OrbitX</span>
            </Link>

            <nav className="oxs-nav-list" aria-label="Primary">
              {PRIMARY.map(({ to, end, label, icon: Icon, match }) => {
                const active = navActive(loc.pathname, to, match);
                return (
                  <NavLink
                    key={`${to}-${label}`}
                    to={to}
                    end={end}
                    className={`oxs-nav-item${active ? " active" : ""}`}
                  >
                    <Icon size={26} strokeWidth={active ? 2.5 : 2} />
                    <span className="oxs-nav-label">{label}</span>
                    {label === "Notifications" && unread > 0 ? (
                      <span className="oxs-nav-badge">{unread > 9 ? "9+" : unread}</span>
                    ) : null}
                  </NavLink>
                );
              })}

              <div className={`oxs-more-wrap${moreOpen ? " open" : ""}`}>
                <button
                  type="button"
                  className="oxs-nav-item"
                  style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", font: "inherit" }}
                  onClick={() => setMoreOpen((v) => !v)}
                >
                  <MoreHorizontal size={26} />
                  <span className="oxs-nav-label">More</span>
                </button>
                <div className="oxs-more-menu">
                  {MORE.map((m) => (
                    <Link key={m.to} to={m.to} onClick={() => setMoreOpen(false)}>
                      {m.label}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            <Link to="/hq/feed" className="oxs-post-btn">
              <Feather size={22} />
              <span>Post</span>
            </Link>
          </div>

          {me ? (
            <Link to="/hq/profile" className="oxs-user-bar">
              <div className="oxs-avatar">{me.displayName.slice(0, 2).toUpperCase()}</div>
              <div className="oxs-user-meta">
                <div className="oxs-user-name">{me.displayName}</div>
                <div className="oxs-user-handle">@{me.username}</div>
              </div>
            </Link>
          ) : null}
        </header>

        <main className={`oxs-main oxs-main--mobile-pad${wide ? " oxs-main--wide" : ""}`}>
          <div className="oxs-main-inner">
            <Outlet />
          </div>
        </main>

        {showRail ? <SocialRightRail /> : null}
      </div>

      <nav className="oxs-mobile-bar" aria-label="Mobile">
        {MOBILE.map(({ to, label, icon: Icon }) => (
          <NavLink key={`${to}-${label}`} to={to} className={({ isActive }) => (isActive ? "active" : undefined)}>
            <Icon />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
