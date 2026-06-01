/**
 * DiscoverHub — Tabbed discovery section.
 *
 * Sub-tabs:
 *   🚀 LaunchPad  — Token launches & featured listings
 *   ⚡ Live Feed  — Real-time coin stream
 *   🔥 Explore    — Token explorer / multi-chain
 *   📡 Streams    — Live feed of coins (LiveFeedPage)
 */
import React, { useState, useEffect, lazy, Suspense } from "react";
import { Rocket, Activity, Search, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Lazy page imports ── */
const DiscoverPage    = lazy(() => import("./Discover"));
const LiveFeedPage    = lazy(() => import("./LiveFeed"));
const TokenExplorerLazy = lazy(() =>
  import("@/components/discover-20x/TokenExplorer").then((m) => ({ default: m.TokenExplorer }))
);

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type SubTab = "launchpad" | "live-feed" | "explore" | "streams";

interface TabDef {
  id: SubTab;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "launchpad", label: "LaunchPad", Icon: Rocket },
  { id: "live-feed", label: "Live Feed",  Icon: Activity },
  { id: "explore",   label: "Explore",    Icon: Search },
  { id: "streams",   label: "Streams",    Icon: Radio },
];

const STORAGE_KEY = "og_discover_tab";

function loadTab(): SubTab {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as SubTab | null;
    if (v && TABS.some((t) => t.id === v)) return v;
  } catch {}
  return "launchpad";
}

const Spinner = () => (
  <div className="flex items-center justify-center py-20">
    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   DiscoverHub
   ═══════════════════════════════════════════════════════════════ */

const DiscoverHub: React.FC = () => {
  const [active, setActive] = useState<SubTab>(loadTab);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, active); } catch {}
  }, [active]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Sub-tab bar ── */}
      <div
        className="ios-scroll flex shrink-0 snap-x items-center gap-1 overflow-x-auto border-b border-white/[0.07] bg-card/80 px-3 py-2 backdrop-blur-lg"
        role="tablist"
        aria-label="Discover sections"
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

        {/* LaunchPad */}
        {active === "launchpad" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Suspense fallback={<Spinner />}>
              <DiscoverPage inline />
            </Suspense>
          </div>
        )}

        {/* Live Feed */}
        {active === "live-feed" && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<Spinner />}>
              <LiveFeedPage />
            </Suspense>
          </div>
        )}

        {/* Explore — multi-chain token explorer */}
        {active === "explore" && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5 lg:px-6 pb-4">
            <Suspense fallback={<Spinner />}>
              <TokenExplorerLazy />
            </Suspense>
          </div>
        )}

        {/* Streams — same as LiveFeedPage but labelled Streams */}
        {active === "streams" && (
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense fallback={<Spinner />}>
              <LiveFeedPage />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverHub;
