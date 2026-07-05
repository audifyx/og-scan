import { Home, Users, Wrench, User, Globe, Rocket, MessageCircle, Gamepad2, Sparkles,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Canonical bottom nav — used on EVERY page (Index + external pages).
 * 4 items: Home, Community, Messages, Profile.
 */

const navItems = [
  { to: "/app", icon: Home, label: "Home" },
  { to: "/community", icon: Users, label: "Community" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
  { to: "/profile", icon: User, label: "Profile" },
];

/* ── Map every known route to a bottom nav item ── */
const routeToNav: Record<string, string> = {
  /* Home */
  "/app": "/app",
  "/home": "/app",
  "/command": "/app",

  /* Community — social, voice, discovery */
  "/community": "/community",
  "/communities": "/community",
  "/social": "/community",
  "/social-hub": "/community",
  "/socialhub": "/community",
  "/discover": "/community",
  "/spaces": "/community",
  "/voice-rooms": "/community",
  "/live-rooms": "/community",
  "/trading-lobbies": "/community",
  "/leaderboard": "/community",

  "/intelligence": "/intelligence",
  /* Tools — scanners, feeds, charts, trading, all instruments */
  "/tools": "/tools",
  "/scanner": "/tools",
  "/og-finder": "/tools",
  "/orbitx-scanner": "/tools",
  "/ogscan-scanner": "/tools",
  "/snipe-feed": "/tools",
  "/dev-wallet": "/tools",
  "/dev-wallet-radar": "/tools",
  "/feed": "/tools",
  "/live-feed": "/tools",
  "/market": "/tools",
  "/market-pulse": "/tools",
  "/market-command": "/tools",
  "/trending": "/tools",
  "/pairs": "/tools",
  "/whales": "/tools",
  "/tx-feed": "/tools",
  "/tape": "/tools",
  "/transactions": "/tools",
  "/transaction-feed": "/tools",
  "/swap": "/tools",
  "/news-signal": "/tools",
  "/migrations": "/tools",
  "/migration-tool": "/tools",
  "/migration-tracker": "/tools",
  "/memes": "/tools",
  "/art": "/tools",
  "/art-feed": "/tools",
  "/our-coin": "/tools",
  "/roadmap": "/tools",
  "/tech": "/tools",
  "/charts": "/tools",
  "/live-trading": "/tools",
  "/live-feed-page": "/tools",
  "/wallets": "/tools",
  "/games": "/games",
  "/tokens": "/tools",
  "/alpha-chat": "/tools",
  "/ai-chat": "/tools",
  "/kol-tracker": "/tools",
  "/app/kol-tracker": "/tools",
  "/koltelebot": "/tools",

  "/callouts": "/tools",
  "/listings": "/tools",
  "/messages": "/community",

  "/pumpv5": "/tools",

  /* Coin Communities */
  "/coin-communities": "/coin-communities",

  /* Launch (sidebar only — no bottom nav item) */
  "/launch": "/app",

  /* Invite (sidebar only — no bottom nav highlight) */
  "/invite": "/app",

  /* Profile — account, settings, premium */
  "/profile": "/profile",
  "/settings": "/profile",
  // "/support": "/support", // hidden

  "/notifications": "/profile",

  "/admin": "/profile",
};

const triggerHaptic = () => {
  if (navigator.vibrate) {
    navigator.vibrate(8);
  }
};

export const BottomNav = () => {
  const location = useLocation();

  const getActiveItem = (): string => {
    const path = location.pathname;

    /* Exact match */
    if (routeToNav[path]) return routeToNav[path];

    /* Prefix match — find the longest matching route */
    let best = "";
    let bestLen = 0;
    for (const [route, nav] of Object.entries(routeToNav)) {
      if (path.startsWith(route + "/") && route.length > bestLen) {
        best = nav;
        bestLen = route.length;
      }
    }
    if (best) return best;

    /* Catch-all — default to Home */
    return "/app";
  };

  const activeTo = getActiveItem();

  return (
    <nav className="lg:hidden fixed left-1/2 -translate-x-1/2 z-50 select-none bottom-[calc(env(safe-area-inset-bottom,0px)+12px)]">
      <div className="flex items-center gap-1 rounded-[28px] border border-white/[0.12] bg-[#0a0f1c]/70 px-2 py-2 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        {/* subtle top sheen */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        {navItems.map((item) => {
          const isActive = activeTo === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={triggerHaptic}
              className={cn(
                "relative flex min-w-[60px] flex-col items-center justify-center gap-1 rounded-[22px] px-3.5 py-2 transition-all duration-200 active:scale-[0.9]",
                isActive ? "bg-og-lime/15 text-og-lime" : "text-white/45 hover:text-white/75",
              )}
            >
              <item.icon
                className={cn("h-[22px] w-[22px] transition-all duration-200", isActive && "drop-shadow-[0_0_8px_rgba(190,242,100,0.5)]")}
                strokeWidth={isActive ? 2.4 : 1.8}
              />
              <span className={cn("text-[9px] font-bold uppercase tracking-wider leading-none", isActive ? "opacity-100" : "opacity-70")}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
