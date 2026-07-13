import { useState } from "react";
import { Rocket, Zap, Sparkles, ShieldCheck, ChevronDown } from "lucide-react";
import Launch from "./Launch";
import LaunchpadFeed from "../components/LaunchpadFeed";
import { VANITY_SUFFIX } from "../lib/vanity-mint";

/**
 * OrbitX Launchpad — a full public, pump.fun-style route.
 *
 * Combines the token launcher (moved here from the standalone /launch page)
 * with a live feed of ONLY the coins launched through the Launchpad. Every
 * coin gets a custom contract address ending in "…orb". Reuses the OrbitX DEX
 * shell (Layout, wallet provider, styling) so the look matches the dex.
 */
export default function Launchpad() {
  // On mobile the launcher is collapsed by default so the feed leads; on
  // desktop both panes are always visible side by side.
  const [showLauncher, setShowLauncher] = useState(false);

  return (
    <div className="max-w-[1500px] mx-auto px-4 py-6 space-y-6">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-panel2 to-panel p-6 sm:p-8">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(600px circle at 15% 0%, #00FFA3, transparent 45%), radial-gradient(500px circle at 90% 100%, #00D1FF, transparent 45%)" }}
        />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <div className="term text-[11px]" style={{ color: "#66707E" }}>
              <span style={{ color: "#00FFA3" }}>orbitx@launchpad</span>:~$ deploy --free --vanity {VANITY_SUFFIX}
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2">
            <Rocket className="w-8 h-8 text-accent" /> OrbitX Launchpad
          </h1>
          <p className="text-muted max-w-2xl text-sm sm:text-base">
            Launch a coin on pump.fun in seconds — <span className="text-up font-semibold">completely free</span> — with a
            custom contract address ending in <span className="text-accent font-bold">…{VANITY_SUFFIX}</span>. Every coin
            launched here shows up in the live feed below.
          </p>
          <div className="flex flex-wrap gap-4 pt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted"><Zap className="w-4 h-4 text-accent" /> Free launches</span>
            <span className="inline-flex items-center gap-1.5 text-muted"><Sparkles className="w-4 h-4 text-accent" /> Custom …{VANITY_SUFFIX} CA</span>
            <span className="inline-flex items-center gap-1.5 text-muted"><ShieldCheck className="w-4 h-4 text-accent" /> Instant listing</span>
          </div>
        </div>
      </div>

      {/* Mobile-only: toggle the launcher (feed leads on small screens) */}
      <button
        onClick={() => setShowLauncher((s) => !s)}
        className="lg:hidden w-full btn bg-accent text-black font-bold inline-flex items-center justify-center gap-2 py-2.5"
      >
        <Rocket className="w-4 h-4" />
        {showLauncher ? "Hide launcher" : "Launch a coin"}
        <ChevronDown className={`w-4 h-4 transition-transform ${showLauncher ? "rotate-180" : ""}`} />
      </button>

      {/* ── Main: launcher (left, sticky on desktop) + live feed (right) ── */}
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <aside className={`${showLauncher ? "block" : "hidden"} lg:block`}>
          <div className="lg:sticky lg:top-24">
            <div className="card p-1 sm:p-2">
              <Launch />
            </div>
          </div>
        </aside>

        <section>
          <LaunchpadFeed />
        </section>
      </div>
    </div>
  );
}
