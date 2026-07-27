import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bell,
  Hash,
  Headphones,
  Home,
  Mail,
  MessageSquare,
  Radio,
  Search,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  Gift,
  LayoutGrid,
} from "lucide-react";
import "../social.css";
import { useSocialStore, useCurrentProfile } from "../hooks/useSocialStore";
import { SocialRightRail } from "../components/SocialRightRail";

type NavItem = { to: string; end?: boolean; label: string; icon: typeof Home };

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Home",
    items: [
      { to: "/hq", end: true, label: "Home", icon: Home },
      { to: "/hq/feed", label: "For you", icon: Search },
      { to: "/hq/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Connect",
    items: [
      { to: "/hq/messages", label: "Messages", icon: Mail },
      { to: "/hq/chat", label: "Channels", icon: Hash },
      { to: "/hq/rooms", label: "Rooms", icon: MessageSquare },
    ],
  },
  {
    label: "Communities",
    items: [
      { to: "/hq/communities", label: "Discover", icon: Users },
      { to: "/hq/trading", label: "Trading", icon: LayoutGrid },
      { to: "/hq/voice", label: "Voice", icon: Headphones },
      { to: "/hq/spaces", label: "Spaces", icon: Radio },
    ],
  },
  {
    label: "Growth",
    items: [
      { to: "/hq/growth", label: "XP & invites", icon: Sparkles },
      { to: "/hq/leaderboards", label: "Leaderboards", icon: Trophy },
      { to: "/hq/creators", label: "Creators", icon: Gift },
    ],
  },
];

const MOBILE = [
  { to: "/hq", end: true, label: "Home", icon: Home },
  { to: "/hq/feed", label: "Feed", icon: Search },
  { to: "/hq/communities", label: "Groups", icon: Users },
  { to: "/hq/messages", label: "DMs", icon: Mail },
  { to: "/hq/profile", label: "Profile", icon: UserRound },
];

export default function SocialLayout() {
  const { notifications, currentUserId } = useSocialStore();
  const me = useCurrentProfile();
  const loc = useLocation();
  const unread = notifications.filter((n) => n.userId === currentUserId && !n.read).length;
  const embed = ["/hq/messages", "/hq/chat", "/hq/rooms", "/hq/spaces"].some((p) => loc.pathname.startsWith(p));

  return (
    <div className="oxs-root">
      <div className="oxs-shell">
        {/* Discord server rail */}
        <aside className="oxs-icon-rail" aria-label="Servers">
          <NavLink to="/hq" end className={({ isActive }) => `oxs-server${isActive ? " active" : ""}`} title="OrbitX">
            OX
          </NavLink>
          <div className="oxs-server-divider" />
          <NavLink to="/hq/communities" className={({ isActive }) => `oxs-server${isActive ? " active" : ""}`} title="Communities">
            <Users size={20} />
          </NavLink>
          <NavLink to="/hq/chat" className={({ isActive }) => `oxs-server${isActive ? " active" : ""}`} title="Channels">
            <Hash size={20} />
          </NavLink>
          <NavLink to="/hq/voice" className={({ isActive }) => `oxs-server${isActive ? " active" : ""}`} title="Voice">
            <Headphones size={20} />
          </NavLink>
          <NavLink to="/hq/trading" className={({ isActive }) => `oxs-server${isActive ? " active" : ""}`} title="Trading">
            <LayoutGrid size={20} />
          </NavLink>
        </aside>

        {/* Discord channel list */}
        <nav className="oxs-nav" aria-label="Social navigation">
          <div className="oxs-nav-head">
            <div className="oxs-brand">
              OrbitX Social
              <span>X · Telegram · Discord</span>
            </div>
          </div>
          {GROUPS.map((g) => (
            <div key={g.label} className="oxs-nav-group">
              <div className="oxs-nav-label">{g.label}</div>
              {g.items.map(({ to, end, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : undefined)}>
                  <Icon size={18} />
                  {label}
                  {label === "Notifications" && unread > 0 ? (
                    <span className="oxs-badge" style={{ marginLeft: "auto", fontSize: "0.62rem" }}>
                      {unread}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
          <NavLink to="/hq/profile" className={({ isActive }) => (isActive ? "active" : undefined)} style={{ marginTop: "0.25rem" }}>
            <UserRound size={18} />
            Profile
          </NavLink>
          <div className="oxs-nav-foot">
            <a href="/intel">Crypto intel →</a>
            <a href="/ORBITX_DEX">DEX →</a>
          </div>
          {me ? (
            <div className="oxs-user-pill">
              <div className="oxs-avatar">{me.displayName.slice(0, 2).toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="name">{me.displayName}</div>
                <div className="handle">@{me.username}</div>
              </div>
            </div>
          ) : null}
        </nav>

        {/* Center — X feed column */}
        <main className={`oxs-main${embed ? " oxs-main--wide" : ""}`}>
          <div className="oxs-main-inner">
            <Outlet />
          </div>
        </main>

        {/* Right — X trends rail */}
        {!embed ? <SocialRightRail /> : null}
      </div>

      {/* Mobile bottom nav */}
      <nav className="oxs-mobile-bar" aria-label="Mobile">
        {MOBILE.map(({ to, end, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : undefined)}>
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
