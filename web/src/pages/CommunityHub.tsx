/**
 * CommunityHub — Unified social experience combining Social, Spaces, Communities, and Discover.
 * Internal sub-tabs let users switch between modes without navigating away.
 */
import React, { useState, useEffect, lazy, Suspense } from "react";
import { Hash, MessageSquare, Radio, Users, Compass, Activity, Search, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import SocialHub from "./SocialHub";
import SpacesPage from "./Spaces";
import CommunitiesPage from "./Communities";
import DiscoverPage from "./Discover";

const LiveFeedPage = lazy(() => import("./LiveFeed"));
const CommunityRoomsPage = lazy(() => import("./CommunityRooms"));
const TokenExplorer = lazy(() => import("@/components/discover-20x/TokenExplorer").then(m => ({ default: m.TokenExplorer })));

type SubTab = "social" | "rooms" | "spaces" | "communities" | "discover";
type DiscoverSub = "launchpad" | "live-feed" | "explore";

const SUB_TABS: { id: SubTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "social", label: "Chat", Icon: MessageSquare },
  { id: "rooms", label: "Rooms", Icon: Hash },
  { id: "spaces", label: "Spaces", Icon: Radio },
  { id: "communities", label: "Groups", Icon: Users },
  { id: "discover", label: "Discover", Icon: Compass },
];

const DISCOVER_SUBS: { id: DiscoverSub; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "launchpad", label: "🚀 LaunchPad", Icon: Rocket },
  { id: "live-feed", label: "⚡ Live Feed", Icon: Activity },
  { id: "explore", label: "🔥 Explore", Icon: Search },
];

const STORAGE_KEY = "og_community_sub_tab";
const DISCOVER_STORAGE_KEY = "og_discover_sub";

const isSubTab = (value: string | null): value is SubTab =>
  SUB_TABS.some((tab) => tab.id === value);

const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-6 w-6 border-2 border-og-lime border-t-transparent rounded-full animate-spin" />
  </div>
);

const CommunityHub: React.FC = () => {
  const [sub, setSub] = useState<SubTab>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return isSubTab(saved) ? saved : "social";
    } catch { return "social"; }
  });
  const [discoverSub, setDiscoverSub] = useState<DiscoverSub>(() => {
    try { return (localStorage.getItem(DISCOVER_STORAGE_KEY) as DiscoverSub) || "launchpad"; } catch { return "launchpad"; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, sub); } catch {}
  }, [sub]);

  useEffect(() => {
    const syncSavedTab = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (isSubTab(saved)) setSub(saved);
      } catch {}
    };

    window.addEventListener("storage", syncSavedTab);
    window.addEventListener("og:community-sub-tab", syncSavedTab);
    return () => {
      window.removeEventListener("storage", syncSavedTab);
      window.removeEventListener("og:community-sub-tab", syncSavedTab);
    };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(DISCOVER_STORAGE_KEY, discoverSub); } catch {}
  }, [discoverSub]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sub-tab bar */}
      <div
        className="ios-scroll flex shrink-0 snap-x items-center gap-2 overflow-x-auto border-b border-white/[0.07] bg-card/80 px-3 py-2 backdrop-blur-lg"
        role="tablist"
        aria-label="Community sections"
      >
        {SUB_TABS.map((t) => {
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSub(t.id)}
              className={cn(
                "flex shrink-0 snap-start items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold transition-all active:scale-[0.98]",
                active
                  ? "bg-og-lime/10 text-og-lime border border-og-lime/20"
                  : "text-white/35 hover:text-white/55 hover:bg-white/[0.04] border border-transparent",
              )}
            >
              <t.Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {sub === "social" && <SocialHub />}
        {sub === "rooms" && (
          <Suspense fallback={<Spinner />}>
            <CommunityRoomsPage />
          </Suspense>
        )}
        {sub === "spaces" && (
          <div className="h-full overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
            <SpacesPage />
          </div>
        )}
        {sub === "communities" && (
          <div className="h-full overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
            <CommunitiesPage />
          </div>
        )}
        {sub === "discover" && (
          <div className="flex h-full flex-col overflow-hidden">
            {/* Discover sub-nav */}
            <div
              className="ios-scroll flex shrink-0 snap-x items-center gap-1.5 overflow-x-auto border-b border-white/[0.05] bg-white/[0.01] px-3 py-2"
              role="tablist"
              aria-label="Discover sections"
            >
              {DISCOVER_SUBS.map((ds) => {
                const active = discoverSub === ds.id;
                return (
                  <button
                    key={ds.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setDiscoverSub(ds.id)}
                    className={cn(
                      "flex shrink-0 snap-start items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all whitespace-nowrap active:scale-[0.98]",
                      active
                        ? "bg-og-cyan/10 text-og-cyan border border-og-cyan/20"
                        : "text-white/25 hover:text-white/45 border border-transparent",
                    )}
                  >
                    {ds.label}
                  </button>
                );
              })}
            </div>

            {/* Discover content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
              <Suspense fallback={<Spinner />}>
                {discoverSub === "launchpad" && <DiscoverPage inline />}
                {discoverSub === "live-feed" && <LiveFeedPage />}
                {discoverSub === "explore" && <TokenExplorer />}
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityHub;
