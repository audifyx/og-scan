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
  Users,
  Headphones,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

/* ── Lazy-loaded page components ── */
const SocialHub            = lazy(() => import("./SocialHub"));
const SpacesPage           = lazy(() => import("./Spaces"));
const CommunityRoomsPage   = lazy(() => import("./CommunityRooms"));
const CoinCommunitiesPage  = lazy(() => import("./CoinCommunitiesPage"));
const CommunitiesPage      = lazy(() => import("./Communities"));

/* ── Trading Lobbies (text chat + watchlist rooms) ── */
const TradingLobbiesPage = lazy(() => import("./TradingLobbies"));

/* ═══════════════════════════════════════════════════════════════
   Types & Config
   ═══════════════════════════════════════════════════════════════ */

type CommTab = "channels" | "rooms" | "spaces" | "communities";

interface TabDef {
  id: CommTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
}

const TABS: TabDef[] = [
  { id: "channels",    label: "Chat",        Icon: Hash,          eyebrow: "Channels & messages" },
  { id: "rooms",       label: "Rooms",       Icon: MessageSquare, eyebrow: "Group chat & trading lobbies" },
  { id: "spaces",      label: "Spaces",      Icon: Radio,         eyebrow: "Live voice & alpha" },
  { id: "communities", label: "Communities", Icon: Globe,         eyebrow: "Token & OG communities" },
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

const SubToggle = <T extends string,>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) => (
  <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.05] px-3 py-2">
    {options.map(([v, l]) => (
      <button key={v} type="button" onClick={() => onChange(v)}
        className={cn("rounded-lg px-3 py-1.5 text-[11px] font-bold transition", value === v ? "bg-primary/15 text-primary border border-primary/25" : "border border-transparent text-white/40 hover:text-white/70")}>
        {l}
      </button>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   CommunityHub — Main Component
   ═══════════════════════════════════════════════════════════════ */

const CommunityHub: React.FC = () => {
  const [active, setActive] = useState<CommTab>(loadTab);
  const [roomsView, setRoomsView] = useState<"rooms" | "trading">("rooms");
  const [commView, setCommView] = useState<"token" | "og">("token");
  const [stats, setStats] = useState<{ communities: number; liveSpaces: number; activity: number }>({ communities: 0, liveSpaces: 0, activity: 0 });

  useEffect(() => {
    let on = true;
    const since = new Date(Date.now() - 86400000).toISOString();
    Promise.all([
      supabase.from("communities").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("spaces").select("id", { count: "exact", head: true }).eq("is_live", true),
      supabase.from("social_messages").select("id", { count: "exact", head: true }).gte("created_at", since),
    ]).then(([c, sp, act]) => {
      if (on) setStats({ communities: c.count || 0, liveSpaces: sp.count || 0, activity: act.count || 0 });
    }).catch(() => {});
    return () => { on = false; };
  }, []);

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
        else if (old === "voice")    setActive("rooms");
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
      {/* ── Hub header ── */}
      <div className="relative shrink-0 overflow-hidden border-b border-white/[0.07] px-4 py-4 sm:px-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,hsl(var(--primary)/0.14),transparent_55%),radial-gradient(ellipse_at_100%_120%,hsl(var(--secondary)/0.10),transparent_55%)]" />
        <div className="relative flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-[19px] font-black text-white leading-tight">OrbitX Community</h1>
            <p className="text-[12px] text-white/40">Chat, rooms, live Spaces and token communities — all in one place.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {stats.liveSpaces > 0 && (
              <span className="flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" /> {stats.liveSpaces} live now
              </span>
            )}
            <HubStat Icon={Globe} value={stats.communities} label="Communities" />
            <HubStat Icon={Radio} value={stats.liveSpaces} label="Live Spaces" />
            <HubStat Icon={TrendingUp} value={stats.activity} label="Posts 24h" />
          </div>
        </div>
      </div>

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

        {/* CHAT (channels + DMs) */}
        {active === "channels" && (
          <Suspense fallback={<Spinner />}>
            <SocialHub />
          </Suspense>
        )}

        {/* ROOMS — community rooms + trading lobbies */}
        {active === "rooms" && (
          <div className="min-h-0 flex-1 overflow-hidden flex flex-col">
            <SubToggle options={[["rooms", "Community Rooms"], ["trading", "Trading Lobbies"]]} value={roomsView} onChange={setRoomsView} />
            <div className="min-h-0 flex-1 overflow-hidden">
              <Suspense fallback={<Spinner />}>
                {roomsView === "rooms" ? <CommunityRoomsPage /> : <TradingLobbiesPage inline />}
              </Suspense>
            </div>
          </div>
        )}

        {/* SPACES — live voice */}
        {active === "spaces" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
            <Suspense fallback={<Spinner />}>
              <SpacesPage />
            </Suspense>
          </div>
        )}

        {/* COMMUNITIES — token + OG */}
        {active === "communities" && (
          <div className="min-h-0 flex-1 overflow-hidden flex flex-col">
            <SubToggle options={[["token", "Token Communities"], ["og", "OG Communities"]]} value={commView} onChange={setCommView} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Suspense fallback={<Spinner />}>
                {commView === "token" ? <CoinCommunitiesPage /> : <CommunitiesPage />}
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function HubStat({ Icon, value, label }: { Icon: React.ComponentType<{ className?: string }>; value: number; label: string }) {
  const fmt = value >= 1000 ? (value / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(value);
  return (
    <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <div className="leading-none"><div className="text-[13px] font-black text-white">{fmt}</div><div className="text-[9px] uppercase tracking-wider text-white/35">{label}</div></div>
    </div>
  );
}

export default CommunityHub;
