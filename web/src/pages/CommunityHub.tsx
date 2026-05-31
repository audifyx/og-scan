/**
 * CommunityHub — Unified social experience for OG Scan.
 *
 * Three clean tabs:
 *   1. Chat      — Channels (general chat) + Rooms (group chat & raids) + DMs
 *   2. Live      — Spaces (voice rooms) + Streams (live wallet/tx feed)
 *   3. Community — Groups (social feed, posts, threads) + Discover (launchpad, explore)
 */
import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  MessageSquare,
  Radio,
  Users,
  Hash,
  Compass,
  Activity,
  Search,
  Rocket,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Lazy-loaded page components ── */
const SocialHub        = lazy(() => import("./SocialHub"));
const SpacesPage       = lazy(() => import("./Spaces"));
const CommunitiesPage  = lazy(() => import("./Communities"));
const DiscoverPage     = lazy(() => import("./Discover"));
const LiveFeedPage     = lazy(() => import("./LiveFeed"));
const CommunityRoomsPage = lazy(() => import("./CommunityRooms"));
// DirectMessages removed from CommunityHub — accessible via dedicated DM tab
const TokenExplorer    = lazy(
  () => import("@/components/discover-20x/TokenExplorer").then((m) => ({ default: m.TokenExplorer })),
);

/* ═══════════════════════════════════════════════════════════════
   Types & Config
   ═══════════════════════════════════════════════════════════════ */

type MainTab      = "chat" | "live" | "community";
type ChatSub      = "channels" | "rooms";
type LiveSub      = "spaces" | "streams";
type CommunitySub = "groups" | "discover";
type DiscoverSub  = "launchpad" | "live-feed" | "explore";

const MAIN_TABS: TabDef<MainTab>[] = [
  { id: "chat",      label: "Chat",      Icon: MessageSquare },
  { id: "live",      label: "Live",      Icon: Radio },
  { id: "community", label: "Community", Icon: Users },
];

const CHAT_SUBS: TabDef<ChatSub>[] = [
  { id: "channels", label: "Channels", Icon: Hash },
  { id: "rooms",    label: "Rooms",    Icon: MessageSquare },
];

const LIVE_SUBS: TabDef<LiveSub>[] = [
  { id: "spaces",  label: "Spaces",  Icon: Mic },
  { id: "streams", label: "Streams", Icon: Activity },
];

const COMMUNITY_SUBS: TabDef<CommunitySub>[] = [
  { id: "groups",   label: "Groups",   Icon: Users },
  { id: "discover", label: "Discover", Icon: Compass },
];

const DISCOVER_SUBS: TabDef<DiscoverSub>[] = [
  { id: "launchpad", label: "🚀 LaunchPad", Icon: Rocket },
  { id: "live-feed", label: "⚡ Live Feed",  Icon: Activity },
  { id: "explore",   label: "🔥 Explore",   Icon: Search },
];

type TabDef<T extends string> = {
  id: T;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

/* ── Storage ── */
const KEYS = {
  main:      "og_hub_main",
  chat:      "og_hub_chat",
  live:      "og_hub_live",
  community: "og_hub_comm",
  discover:  "og_hub_disc",
} as const;

function load<T extends string>(key: string, defs: readonly TabDef<T>[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return defs.some((d) => d.id === v) ? (v as T) : fallback;
  } catch { return fallback; }
}

function save(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch {}
}

/* ── Spinner ── */
const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-6 w-6 border-2 border-og-lime border-t-transparent rounded-full animate-spin" />
  </div>
);

/* ── Sub-nav pills ── */
function Pills<T extends string>({
  items,
  active,
  onChange,
  color = "--og-lime",
}: {
  items: readonly TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  color?: string;
}) {
  return (
    <div className="ios-scroll flex shrink-0 snap-x items-center gap-1.5 overflow-x-auto border-b border-white/[0.05] bg-white/[0.015] px-3 py-1.5">
      {items.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex shrink-0 snap-start items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold tracking-wide transition-all whitespace-nowrap active:scale-[0.97]",
              on
                ? "border"
                : "text-white/30 hover:text-white/50 border border-transparent",
            )}
            style={
              on
                ? {
                    backgroundColor: `hsl(var(${color}) / 0.10)`,
                    color: `hsl(var(${color}))`,
                    borderColor: `hsl(var(${color}) / 0.20)`,
                  }
                : undefined
            }
          >
            <t.Icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CommunityHub — Main Component
   ═══════════════════════════════════════════════════════════════ */

const CommunityHub: React.FC = () => {
  const [main, setMain]               = useState<MainTab>(() => load(KEYS.main, MAIN_TABS, "chat"));
  const [chatSub, setChatSub]         = useState<ChatSub>(() => load(KEYS.chat, CHAT_SUBS, "channels"));
  const [liveSub, setLiveSub]         = useState<LiveSub>(() => load(KEYS.live, LIVE_SUBS, "spaces"));
  const [commSub, setCommSub]         = useState<CommunitySub>(() => load(KEYS.community, COMMUNITY_SUBS, "groups"));
  const [discSub, setDiscSub]         = useState<DiscoverSub>(() => load(KEYS.discover, DISCOVER_SUBS, "launchpad"));

  /* Persist */
  useEffect(() => save(KEYS.main, main), [main]);
  useEffect(() => save(KEYS.chat, chatSub), [chatSub]);
  useEffect(() => save(KEYS.live, liveSub), [liveSub]);
  useEffect(() => save(KEYS.community, commSub), [commSub]);
  useEffect(() => save(KEYS.discover, discSub), [discSub]);

  /* Legacy compatibility — old sidebar quick-links set og_community_sub_tab */
  useEffect(() => {
    const sync = () => {
      try {
        const old = localStorage.getItem("og_community_sub_tab");
        if (!old) return;
        if (old === "social")       { setMain("chat"); setChatSub("channels"); }
        else if (old === "rooms")   { setMain("chat"); setChatSub("rooms"); }
        else if (old === "spaces")  { setMain("live"); setLiveSub("spaces"); }
        else if (old === "communities") { setMain("community"); setCommSub("groups"); }
        else if (old === "discover")    { setMain("community"); setCommSub("discover"); }
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
      {/* ── Primary tab bar ── */}
      <div
        className="ios-scroll flex shrink-0 snap-x items-center gap-2 overflow-x-auto border-b border-white/[0.07] bg-card/80 px-3 py-2 backdrop-blur-lg"
        role="tablist"
        aria-label="Community sections"
      >
        {MAIN_TABS.map((t) => {
          const on = main === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setMain(t.id)}
              className={cn(
                "flex shrink-0 snap-start items-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold tracking-wide transition-all active:scale-[0.97]",
                on
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

      {/* ── Tab content ── */}
      <div className="min-h-0 flex-1 overflow-hidden flex flex-col">

        {/* ═══ CHAT ═══ */}
        {main === "chat" && (
          <>
            <Pills items={CHAT_SUBS} active={chatSub} onChange={setChatSub} color="--og-cyan" />
            <div className="min-h-0 flex-1 overflow-hidden">
              {chatSub === "channels" && (
                <Suspense fallback={<Spinner />}><SocialHub /></Suspense>
              )}
              {chatSub === "rooms" && (
                <Suspense fallback={<Spinner />}><CommunityRoomsPage /></Suspense>
              )}

            </div>
          </>
        )}

        {/* ═══ LIVE ═══ */}
        {main === "live" && (
          <>
            <Pills items={LIVE_SUBS} active={liveSub} onChange={setLiveSub} color="--og-gold" />
            <div className="min-h-0 flex-1 overflow-hidden">
              {liveSub === "spaces" && (
                <Suspense fallback={<Spinner />}>
                  <div className="h-full overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
                    <SpacesPage />
                  </div>
                </Suspense>
              )}
              {liveSub === "streams" && (
                <Suspense fallback={<Spinner />}>
                  <LiveFeedPage />
                </Suspense>
              )}
            </div>
          </>
        )}

        {/* ═══ COMMUNITY ═══ */}
        {main === "community" && (
          <>
            <Pills items={COMMUNITY_SUBS} active={commSub} onChange={setCommSub} color="--og-lime" />

            {commSub === "groups" && (
              <div className="min-h-0 flex-1 overflow-hidden">
                <Suspense fallback={<Spinner />}>
                  <div className="h-full overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
                    <CommunitiesPage />
                  </div>
                </Suspense>
              </div>
            )}

            {commSub === "discover" && (
              <>
                <Pills items={DISCOVER_SUBS} active={discSub} onChange={setDiscSub} color="--og-cyan" />
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
                  <Suspense fallback={<Spinner />}>
                    {discSub === "launchpad" && <DiscoverPage inline />}
                    {discSub === "live-feed" && <LiveFeedPage />}
                    {discSub === "explore" && <TokenExplorer />}
                  </Suspense>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CommunityHub;
