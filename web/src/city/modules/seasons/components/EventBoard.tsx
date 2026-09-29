/**
 * OrbitXCity — Seasons module: Event Board UI.
 *
 * Lists the seasonal event cards contributed by registered plugins
 * (`SeasonalEventPlugin.eventCard`). Pure read — plugins are registered via
 * `registerSeasonalPlugin`, not here.
 */

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { SeasonalEventCard } from "../types";
import { formatCountdown } from "../data/seasons";
import { getSeasonalContext, listSeasonalPlugins } from "../eventFramework";

export function EventBoard() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cards: SeasonalEventCard[] = [];
  const ctx = getSeasonalContext();
  if (ctx) {
    for (const plugin of listSeasonalPlugins()) {
      try {
        const card = plugin.eventCard?.(ctx, now);
        if (card) cards.push(card);
      } catch {
        /* a bad plugin must never break the board */
      }
    }
  }

  if (cards.length === 0) {
    return (
      <div className="ox-sea-events">
        <div className="ox-sea-events-title">Seasonal Events</div>
        <div className="ox-sea-events-empty">No seasonal events running right now.</div>
      </div>
    );
  }

  return (
    <div className="ox-sea-events">
      <div className="ox-sea-events-title">Seasonal Events</div>
      <div className="ox-sea-events-grid">
        {cards.map((card) => (
          <div
            key={card.pluginId}
            className={`ox-sea-event-card${card.active ? " is-active" : ""}`}
            style={card.accent ? ({ "--ox-sea-accent": card.accent } as CSSProperties) : undefined}
          >
            <div className="ox-sea-event-head">
              <span className="ox-sea-event-name">{card.title}</span>
              <span className={`ox-sea-event-badge${card.active ? " is-live" : ""}`}>
                {card.active ? "LIVE" : "SOON"}
              </span>
            </div>
            <div className="ox-sea-event-desc">{card.description}</div>
            {card.active && card.endsAt && (
              <div className="ox-sea-event-countdown">
                Ends in {formatCountdown(card.endsAt - now)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
