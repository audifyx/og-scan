import { Home, Users, Wrench, User, Globe, Rocket, MessageCircle   Gamepad2,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Canonical bottom nav — used on EVERY page (Index + external pages).
 * 4 items: Home, Community, Tools, Profile.
 */

const navItems = [
  { to: "/app", icon: Home, label: "Home" },
  { to: "/community", icon: Users, label: "Community" },
  { to: "/tools", icon: Wrench, label: "Tools" },
  // { to: "/support", icon: MessageCircle, label: "Support" }, // hidden
  { to: "/games", icon: Gamepad2, label: "Games" },
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

  /* Tools — scanners, feeds, charts, trading, all instruments */
  "/tools": "/tools",
  "/scanner": "/tools",
  "/og-finder": "/tools",
  "/og-scanner": "/tools",
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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 select-none">
      {/* Gradient fade above */}
      <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      <div className="relative overflow-hidden glass-bottom-nav">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-og-lime/30 to-transparent" />

        <div className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom,0px)] pt-1.5">
          {navItems.map((item) => {
            const isActive = activeTo === item.to;
            const inner = (
              <>
                <div className={cn(
                  "flex items-center justify-center w-11 h-8 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-og-lime/15 shadow-[0_0_16px_rgba(190,242,100,0.12)]"
                    : "bg-transparent",
                )}>
                  <item.icon
                    className={cn(
                      "h-5 w-5 transition-all duration-200",
                      isActive && "drop-shadow-[0_0_6px_rgba(190,242,100,0.5)]",
                    )}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                </div>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider leading-none transition-all duration-200",
                  isActive ? "opacity-100" : "opacity-60",
                )}>
                  {item.label}
                </span>
              </>
            );

            const baseClass = cn(
              "flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-all duration-200",
              "active:scale-[0.88] active:opacity-80",
              isActive ? "text-og-lime" : "text-white/35",
            );

            return (
              <NavLink key={item.to} to={item.to} onClick={triggerHaptic} className={baseClass}>
                {inner}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
