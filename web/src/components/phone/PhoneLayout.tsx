import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SplashScreen } from "./SplashScreen";
import { LockScreen } from "./LockScreen";
import { HomeScreen } from "./HomeScreen";
import { AppView } from "./AppView";
import { useIsMobile } from "@/hooks/use-mobile";
import { ReactNode } from "react";

type PhoneState = "splash" | "lock" | "home" | "app";

// Routes that are "apps" inside the phone
const appRoutes = [
  "/wallets", "/tokens", "/charts", "/tools", "/advanced-tools",
  "/pump-v5", "/premium", "/notifications", "/alpha-chat",
  "/webhooks", "/leaderboard", "/settings", "/discover",
  "/callouts", "/official-token", "/credits", "/profile",
  "/live-feed", "/lobbies", "/communities", "/live-trading",
  "/support", "/admin",
];

const routeTitles: Record<string, string> = {
  "/wallets": "Wallets",
  "/tokens": "Tokens",
  "/charts": "Charts",
  "/tools": "Tools",
  "/advanced-tools": "Advanced",
  "/pump-v5": "Launch Pad",
  "/premium": "Premium",
  "/notifications": "Alerts",
  "/alpha-chat": "Alpha Chat",
  "/webhooks": "Webhooks",
  "/leaderboard": "Leaderboard",
  "/settings": "Settings",
  "/discover": "Discover",
  "/callouts": "Callouts",
  "/official-token": "Token Info",
  "/credits": "Credits",
  "/profile": "Profile",
  "/live-feed": "Live Feed",
  "/lobbies": "Lobbies",
  "/communities": "Communities",
  "/live-trading": "Live Trading",
  "/support": "Support",
  "/admin": "Admin",
};

interface PhoneLayoutProps {
  children: ReactNode;
}

export const PhoneLayout = ({ children }: PhoneLayoutProps) => {
  const isMobile = useIsMobile();
  const location = useLocation();

  const [state, setState] = useState<PhoneState>(() => {
    const hasBooted = sessionStorage.getItem("soltools-booted");
    if (hasBooted) return "home";
    return "splash";
  });

  const handleSplashComplete = useCallback(() => {
    setState("lock");
  }, []);

  const handleUnlock = useCallback(() => {
    sessionStorage.setItem("soltools-booted", "true");
    setState("home");
  }, []);

  // Determine if we're on an app route
  const isAppRoute = appRoutes.some((r) => location.pathname.startsWith(r));
  const isHome = location.pathname === "/" || location.pathname === "/setup";

  // If not mobile, don't render phone UI
  if (!isMobile) return <>{children}</>;

  // Splash screen
  if (state === "splash") {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Lock screen
  if (state === "lock") {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  // Home screen (shown on / route or when no app is open)
  if (isHome && state === "home") {
    return <HomeScreen />;
  }

  // App view (wraps existing page content)
  if (isAppRoute) {
    const title = routeTitles[location.pathname] || "";
    return (
      <AppView title={title}>
        {children}
      </AppView>
    );
  }

  // Fallback: show content directly (e.g. auth pages)
  return <>{children}</>;
};
