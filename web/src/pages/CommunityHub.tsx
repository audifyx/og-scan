/**
 * CommunityHub — Unified social experience combining Social, Spaces, and Communities.
 * Internal sub-tabs let users switch between modes without navigating away.
 */
import React, { useState, useEffect } from "react";
import { MessageSquare, Radio, Users, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import SocialHub from "./SocialHub";
import SpacesPage from "./Spaces";
import CommunitiesPage from "./Communities";
import DiscoverPage from "./Discover";

type SubTab = "social" | "spaces" | "communities" | "discover";

const SUB_TABS: { id: SubTab; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "social", label: "Chat", Icon: MessageSquare },
  { id: "spaces", label: "Spaces", Icon: Radio },
  { id: "communities", label: "Groups", Icon: Users },
  { id: "discover", label: "Discover", Icon: Compass },
];

const STORAGE_KEY = "og_community_sub_tab";

const CommunityHub: React.FC = () => {
  const [sub, setSub] = useState<SubTab>(() => {
    try { return (localStorage.getItem(STORAGE_KEY) as SubTab) || "social"; } catch { return "social"; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, sub); } catch {}
  }, [sub]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sub-tab bar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.07] bg-[#060c13]/80 px-2 py-1.5 backdrop-blur-lg">
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
          <div className="h-full overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
            <DiscoverPage inline />
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityHub;
