/**
 * CommunityHub — Unified community tab with 5 sections:
 *   1. Channels     — Discord-style chat (SocialHub)
 *   2. Rooms        — Group chat & raids (CommunityRooms)
 *   3. Spaces       — Voice rooms / alpha calls
 *   4. Voice        — Voice lobbies
 *   5. Communities  — X/token communities (CoinCommunities)
 *
 * Responds to `og_comm_entry` localStorage key set by AppSidebar nav items.
 */
import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  Hash,
  MessageSquare,
  Radio,
  Mic,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Lazy-loaded page components ── */
const SocialHub            = lazy(() => import("./SocialHub"));
const SpacesPage           = lazy(() => import("./Spaces"));
const CommunityRoomsPage   = lazy(() => import("./CommunityRooms"));
const CoinCommunitiesPage  = lazy(() => import("./CoinCommunitiesPage"));

/* ── Voice Lobbies (trading lobby list) ── */
const VoiceLobbiesPage = lazy(() => import("./TradingLobbies"));

/* ═══════════════════════════════════════════════════════════════
   Types & Config
   ═══════════════════════════════════════════════════════════════ */

type CommTab = "channels" | "rooms" | "spaces" | "voice" | "communities";

interface TabDef {
  id: CommTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
}

const TABS: TabDef[] = [
  { id: "channels",    label: "Channels",     Icon: Hash,          eyebrow: "Chat rooms" },
  { id: "rooms",       label: "Rooms",        Icon: MessageSquare, eyebrow: "Group chat & raids" },
  { id: "spaces",      label: "Spaces",       Icon: Radio,         eyebrow: "Voice rooms & alpha" },
  { id: "voice",       label: "Voice Lobbies",Icon: Mic,           eyebrow: "Live voice hangouts" },
  { id: "communities", label: "Communities",  Icon: Globe,         eyebrow: "X & token communities" },
];

const STORAGE_KEY = "og_comm_tab";

function loadTab(): CommTab {
  try {
    // Priority: sidebar click entry > persisted tab
    const entry = localStorage.getItem("og_comm_entry") as CommTab | null;
    if (entry && TABS.some((t) => t.id === entry)) {
      localStorage.removeItem("og_comm_entry");
      return entry;
    }
    const v = localStorage.getItem(STORAGE_KEY) as CommTab | null;
    if (v && TABS.some((t) => t.id === v)) return v;
  } catch {}
  return "channels";
}

/* ── Spinner ── */
const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   CommunityHub — Main Component
   ═══════════════════════════════════════════════════════════════ */

const CommunityHub: React.FC = () => {
  const [active, setActive] = useState<CommTab>(loadTab);

  /* Persist active tab */
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, active); } catch {}
  }, [active]);

  /* Listen for sidebar navigation events */
  useEffect(() => {
    const handler = (e: Event) => {
      const entry = (e as CustomEvent<string>).detail as CommTab;
      if (TABS.some((t) => t.id === entry)) setActive(entry);
    };
    window.addEventListener("og:comm-entry", handler);
    return () => window.removeEventListener("og:comm-entry", handler);
  }, []);

  /* Legacy: old "og_community_sub_tab" key from overview quick-links */
  useEffect(() => {
    const sync = () => {
      try {
        const old = localStorage.getItem("og_community_sub_tab");
        if (!old) return;
        if (old === "social" || old === "channels") setActive("channels");
        else if (old === "rooms")    setActive("rooms");
        else if (old === "spaces")   setActive("spaces");
        else if (old === "voice")    setActive("voice");
        localStorage.removeItem("og_community_sub_tab");
      } catch {}
    };
    window.addEventListener("storage", sync);
    window.addEventListener("og:community-sub-tab", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("og:community-sub-tab", sync);
    };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Tab bar ── */}
      <div
        className="ios-scroll flex shrink-0 snap-x items-center gap-1 overflow-x-auto border-b border-white/[0.07] bg-card/80 px-3 py-2 backdrop-blur-lg"
        role="tablist"
        aria-label="Community sections"
      >
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={cn(
                "flex shrink-0 snap-start items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-bold tracking-wide transition-all active:scale-[0.97] whitespace-nowrap",
                on
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-white/35 hover:text-white/55 hover:bg-white/[0.04] border border-transparent",
              )}
            >
              <t.Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="min-h-0 flex-1 overflow-hidden flex flex-col">

        {/* ═══ CHANNELS (social chat) ═══ */}
        {active === "channels" && (
          <Suspense fallback={<Spinner />}>
            <SocialHub />
          </Suspense>
        )}

        {/* ═══ ROOMS ═══ */}
        {active === "rooms" && (
          <Suspense fallback={<Spinner />}>
            <CommunityRoomsPage />
          </Suspense>
        )}

        {/* ═══ SPACES (voice rooms) ═══ */}
        {active === "spaces" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
            <Suspense fallback={<Spinner />}>
              <SpacesPage />
            </Suspense>
          </div>
        )}

        {/* ═══ VOICE LOBBIES ═══ */}
        {active === "voice" && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<Spinner />}>
              <VoiceLobbiesPage />
            </Suspense>
          </div>
        )}

        {/* ═══ COMMUNITIES (X & token communities) ═══ */}
        {active === "communities" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Suspense fallback={<Spinner />}>
              <CoinCommunitiesPage />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityHub;
