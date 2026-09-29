/**
 * OrbitXCity — Events module: EventHud (the `hud` mount point).
 *
 * Self-contained React component with inline styles (no global CSS
 * dependency). Renders, above the 3D canvas and below modal dialogs:
 *
 *  - the active-event banner queue (auto-dismissing, tap to dismiss)
 *  - the weather chip + event ticker feed
 *  - contextual action prompts:
 *      · claim airdrop crate  · join / counter-protest
 *      · open night market / dock black market panels
 *
 * Mobile-first: 48px+ touch targets, bottom-sheet-safe positioning,
 * `dvh` units. Mount inside the game HUD layer:
 *   <div className="absolute inset-0 z-[40] pointer-events-none">
 *     <EventHud system={eventsSystem} onOpenMarket={…} onOpenWeather={…} />
 *   </div>
 */

import { useState } from "react";
import type { EventsSystem } from "../system";
import { useEventsSnapshot } from "./useEventsSnapshot";

export interface EventHudProps {
  system: EventsSystem;
  /** Open a market panel modal (`marketPanels` mount point). */
  onOpenMarket?: (mode: "night" | "black") => void;
  /** Open the weather control panel (`weatherPanel` mount point). */
  onOpenWeather?: () => void;
}

export function EventHud({ system, onOpenMarket, onOpenWeather }: EventHudProps) {
  const snap = useEventsSnapshot(system);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [protestMsg, setProtestMsg] = useState<string | null>(null);

  const banners = snap.banners.filter((e) => !dismissed.has(e.id));

  function claim() {
    const reward = system.claimNearbyCrate(6);
    setClaimMsg(
      reward ? `🎁 Claimed: ${reward.label}` : "No landed crate close enough — follow the beacon glow."
    );
  }

  function join() {
    const reward = system.joinProtest();
    setProtestMsg(reward ? `✊ ${reward.label}` : "You joined the protest.");
  }

  function counter() {
    const reward = system.counterProtest();
    setProtestMsg(reward ? `📣 ${reward.label}` : "Your counter-protest fizzled — the crowd out-shouted you.");
  }

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>
      {/* ---------- banner queue (top-center) ---------- */}
      <div
        style={{
          position: "absolute",
          top: "max(12px, env(safe-area-inset-top))",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "min(92vw, 480px)",
        }}
      >
        {banners.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setDismissed((d) => new Set(d).add(e.id))}
            style={{
              pointerEvents: "auto",
              background: "rgba(10,12,20,0.88)",
              border: "1px solid rgba(124,58,237,0.6)",
              borderRadius: 14,
              padding: "10px 14px",
              color: "#fff",
              textAlign: "center",
              cursor: "pointer",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>{e.title}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{e.subtitle}</div>
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 6 }}>tap to dismiss</div>
          </button>
        ))}
      </div>

      {/* ---------- weather chip + ticker (top-right) ---------- */}
      <div
        style={{
          position: "absolute",
          top: "max(12px, env(safe-area-inset-top))",
          right: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          maxWidth: "min(44vw, 300px)",
        }}
      >
        <button
          type="button"
          onClick={() => onOpenWeather?.()}
          style={{
            pointerEvents: "auto",
            background: "rgba(10,12,20,0.8)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 999,
            padding: "8px 14px",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {snap.weather.info.icon} {snap.weather.info.label}
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          {snap.ticker.slice(0, 3).map((t) => (
            <div
              key={t.id}
              style={{
                background: "rgba(10,12,20,0.7)",
                borderRadius: 10,
                padding: "6px 10px",
                color: "#e5e7eb",
                fontSize: 11,
                textAlign: "right",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {t.text}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- contextual action prompts (bottom-center) ---------- */}
      <div
        style={{
          position: "absolute",
          bottom: "max(96px, calc(env(safe-area-inset-bottom) + 84px))",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          width: "min(92vw, 440px)",
        }}
      >
        {snap.airdrop.active && snap.airdrop.landed > 0 && (
          <div style={promptBox}>
            <div style={promptText}>
              🎁 {snap.airdrop.landed} crate{snap.airdrop.landed === 1 ? "" : "s"} landed
              {snap.airdrop.claimed > 0 ? ` · ${snap.airdrop.claimed} claimed` : ""} — get close to one
            </div>
            <button type="button" onClick={claim} style={promptBtn}>
              CLAIM CRATE
            </button>
            {claimMsg && <div style={promptMsg}>{claimMsg}</div>}
          </div>
        )}

        {snap.protest.active && !snap.protest.chosen && (
          <div style={promptBox}>
            <div style={promptText}>📢 Protest outside HQ — pick a side</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={join} style={promptBtn}>
                ✊ JOIN
              </button>
              <button type="button" onClick={counter} style={{ ...promptBtn, background: "#1d4ed8" }}>
                📣 COUNTER
              </button>
            </div>
          </div>
        )}
        {snap.protest.active && snap.protest.chosen && protestMsg && (
          <div style={promptBox}>
            <div style={promptMsg}>{protestMsg}</div>
          </div>
        )}

        {snap.nightMarket.open && (
          <button type="button" onClick={() => onOpenMarket?.("night")} style={promptBtn}>
            🌙 NIGHT MARKET OPEN{snap.nightMarket.spot ? ` — ${snap.nightMarket.spot.label}` : ""}
          </button>
        )}
        {snap.blackMarket.open && (
          <button
            type="button"
            onClick={() => onOpenMarket?.("black")}
            style={{ ...promptBtn, background: "#7f1d1d" }}
          >
            🕶️ DOCK BLACK MARKET — CODE REQUIRED
          </button>
        )}
      </div>
    </div>
  );
}

const promptBox: React.CSSProperties = {
  pointerEvents: "auto",
  background: "rgba(10,12,20,0.88)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 14,
  padding: "10px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  alignItems: "center",
  width: "100%",
  fontFamily: "system-ui, sans-serif",
};

const promptText: React.CSSProperties = {
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "center",
};

const promptMsg: React.CSSProperties = {
  color: "#d1d5db",
  fontSize: 12,
  textAlign: "center",
};

const promptBtn: React.CSSProperties = {
  pointerEvents: "auto",
  background: "#7c3aed",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "12px 20px",
  fontSize: 14,
  fontWeight: 800,
  minHeight: 48,
  cursor: "pointer",
  fontFamily: "system-ui, sans-serif",
};
