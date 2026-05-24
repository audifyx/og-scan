import { Home, Search, Users, Radio, Palette } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/app", icon: Home, label: "Home" },
  { to: "/scanner", icon: Search, label: "Scan" },
  { to: "/communities", icon: Users, label: "Social" },
  { to: "/spaces", icon: Radio, label: "Spaces" },
  { to: "/art", icon: Palette, label: "Memes" },
];

// Aliases: routes that should highlight a specific bottom nav item
const routeAliases: Record<string, string> = {
  "/home": "/app",
  "/command": "/app",
  "/snipe-feed": "/app",
  "/feed": "/app",
  "/swap": "/app",
  "/discover": "/app",
  "/trending": "/app",
  "/og-finder": "/scanner",
  "/og-scanner": "/scanner",
  "/ogscan-scanner": "/scanner",
  "/communities": "/communities",
  "/spaces": "/spaces",
  "/voice-rooms": "/spaces",
  "/art": "/art",
  "/memes": "/art",
  "/art-feed": "/art",
};

const triggerHaptic = () => {
  if (navigator.vibrate) {
    navigator.vibrate(8);
  }
};

export const BottomNav = () => {
  const location = useLocation();

  const getActiveItem = () => {
    const path = location.pathname;
    // Direct match
    const directMatch = navItems.find((item) => path === item.to || path.startsWith(item.to + "/"));
    if (directMatch) return directMatch.to;
    // Alias match
    const alias = Object.entries(routeAliases).find(([key]) => path === key || path.startsWith(key + "/"));
    if (alias) return alias[1];
    // Default to Home
    return "/app";
  };

  const activeTo = getActiveItem();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 select-none">
      {/* Gradient fade above */}
      <div className="absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-[#060c13] to-transparent pointer-events-none" />

      <div className="relative border-t border-white/[0.07] bg-[#060c13]/95 backdrop-blur-xl overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-og-lime/30 to-transparent" />

        <div className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom,0px)] pt-1.5">
          {navItems.map((item) => {
            const isActive = activeTo === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={triggerHaptic}
                className={cn(
                  "flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-all duration-200",
                  "active:scale-[0.88] active:opacity-80",
                  isActive ? "text-og-lime" : "text-white/35",
                )}
              >
                {/* Icon container */}
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

                {/* Label */}
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider leading-none transition-all duration-200",
                  isActive ? "opacity-100" : "opacity-60",
                )}>
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
