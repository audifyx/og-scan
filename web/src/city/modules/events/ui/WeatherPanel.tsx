/**
 * OrbitXCity — Events module: WeatherPanel (the `weatherPanel` mount point).
 *
 * The turf-war winner's firm controls the city's weather machine. This
 * panel shows the current weather to EVERYONE, and the weather buttons
 * ONLY to members of the controlling firm (`EventsContext.playerInWeatherFirm`
 * — enforced again inside `system.trySetWeather`, never trust the UI).
 *
 * Cooldown + duration rules live in `scenes/weatherMachine.ts`
 * (30-min change cooldown, 10-min hold before skies drift back to clear).
 */

import { useState } from "react";
import type { EventsSystem } from "../system";
import { useEventsSnapshot } from "./useEventsSnapshot";
import { WEATHER_INFO, type WeatherState } from "../scenes/weatherMachine";

export interface WeatherPanelProps {
  system: EventsSystem;
  onClose?: () => void;
}

const STATES: WeatherState[] = ["clear", "rain", "storm", "fog", "heat", "neon"];

export function WeatherPanel({ system, onClose }: WeatherPanelProps) {
  const snap = useEventsSnapshot(system);
  const [result, setResult] = useState<string | null>(null);
  const w = snap.weather;

  function set(state: WeatherState) {
    const res = system.trySetWeather(state);
    setResult(res.ok ? `🌦️ Weather set: ${WEATHER_INFO[state].label}` : res.reason);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={() => onClose?.()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100vw, 480px)",
          maxHeight: "80dvh",
          overflowY: "auto",
          background: "#0d0f16",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.15)",
          padding: "18px 18px max(18px, env(safe-area-inset-bottom))",
          fontFamily: "system-ui, sans-serif",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>🌦️ Weather Machine</div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "none",
                borderRadius: 12,
                width: 44,
                height: 44,
                color: "#fff",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div
          style={{
            marginTop: 12,
            background: "#151824",
            borderRadius: 14,
            padding: 14,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>{w.info.icon}</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{w.info.label}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{w.info.description}</div>
          <div style={{ fontSize: 12, color: "#d1d5db", marginTop: 8, fontStyle: "italic" }}>
            {w.info.gameplayNote}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 12, textAlign: "center" }}>
          {w.firmId
            ? `Controlled by ${w.firmId} — win the turf war to seize the machine.`
            : "No firm holds the weather machine — win a turf war to claim it."}
        </div>

        {w.canControl ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginTop: 12,
            }}
          >
            {STATES.map((s) => {
              const info = WEATHER_INFO[s];
              const active = w.target === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => set(s)}
                  style={{
                    background: active ? "#7c3aed" : "#1b1f2c",
                    border: active ? "2px solid #a78bfa" : "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    padding: "12px 6px",
                    color: "#fff",
                    cursor: "pointer",
                    minHeight: 64,
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  <div style={{ fontSize: 22 }}>{info.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{info.label}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              background: "rgba(127,29,29,0.4)",
              border: "1px solid rgba(248,113,113,0.4)",
              borderRadius: 12,
              padding: 12,
              fontSize: 13,
              color: "#fecaca",
              textAlign: "center",
            }}
          >
            {w.controlReason}
          </div>
        )}

        {result && (
          <div style={{ fontSize: 13, color: "#d1d5db", textAlign: "center", marginTop: 10 }}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
