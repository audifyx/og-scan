/**
 * CommunityHub — Unified social experience combining Social, Spaces, Communities, and Discover.
 * Internal sub-tabs let users switch between modes without navigating away.
 */
import React, { useState, useEffect, lazy, Suspense } from "react";
import { MessageSquare, Radio, Users, Compass, Activity, Search, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import SocialHub from "./SocialHub";
import SpacesPage from "./Spaces";
import CommunitiesPage from "./Communities";
import DiscoverPage from "./Discover";

const LiveFeedPage = lazy(() => import("./LiveFeed"));
const TokenExplorer = lazy(() => import("@/components/discover-20x/TokenExplorer").then(m => ({ default: m.TokenExplorer })));

type SubTab = "social" | "spaces" | "communities" | "discover";
type DiscoverSub = "launchpad" | "live-feed" | "explore";

const SUB_TABS: { id: SubTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "social", label: "Chat", Icon: MessageSquare },
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

const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-6 w-6 border-2 border-og-lime border-t-transparent rounded-full animate-spin" />
  </div>
);

const CommunityHub: React.FC = () => {
  const [sub, setSub] = useState<SubTab>(() => {
    try { return (localStorage.getItem(STORAGE_KEY) as SubTab) || "social"; } catch { return "social"; }
  });
  const [discoverSub, setDiscoverSub] = useState<DiscoverSub>(() => {
    try { return (localStorage.getItem(DISCOVER_STORAGE_KEY) as DiscoverSub) || "launchpad"; } catch { return "launchpad"; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, sub); } catch {}
  }, [sub]);

  useEffect(() => {
    try { localStorage.setItem(DISCOVER_STORAGE_KEY, discoverSub); } catch {}
  }, [discoverSub]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sub-tab bar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.07] bg-card/80 px-2 py-1.5 backdrop-blur-lg">
        {SUB_TABS.map((t) => {
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-all",
                active
                  ? "bg-og-lime/10 text-og-lime border border-og-lime/20"
                  : "text-white/35 hover:text-white/55 hover:bg-white/[0.04] border border-transparent",
              )}
            >
              <t.Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {sub === "social" && <SocialHub />}
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
            <div className="flex shrink-0 items-center gap-1 px-3 py-1.5 border-b border-white/[0.05] bg-white/[0.01]" style={{ scrollbarWidth: "none" }}>
              {DISCOVER_SUBS.map((ds) => {
                const active = discoverSub === ds.id;
                return (
                  <button
                    key={ds.id}
                    onClick={() => setDiscoverSub(ds.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all whitespace-nowrap",
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
