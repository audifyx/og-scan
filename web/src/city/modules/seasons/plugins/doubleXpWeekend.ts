/**
 * OrbitXCity — Seasons module: built-in sample plugin.
 *
 * "Double-XP Weekend" — grants 2x season XP on Saturdays and Sundays (UTC).
 * Ships registered by default so the event framework demonstrably does
 * something; other modules can unregister it or add their own plugins.
 */

import type { SeasonalEventCard, SeasonalEventContext, SeasonalEventPlugin } from "../types";

const PLUGIN_ID = "double-xp-weekend";

function isWeekendUtc(now: number): boolean {
  const day = new Date(now).getUTCDay();
  return day === 0 || day === 6;
}

function nextMondayUtc(now: number): number {
  const d = new Date(now);
  const daysUntilMonday = ((8 - d.getUTCDay()) % 7) || 7;
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d.getTime();
}

const doubleXpWeekend: SeasonalEventPlugin = {
  id: PLUGIN_ID,
  name: "Double-XP Weekend",
  description: "All season XP earns 2x on Saturdays and Sundays (UTC).",

  xpMultiplier: (ctx: SeasonalEventContext): number => {
    void ctx;
    return isWeekendUtc(Date.now()) ? 2 : 1;
  },

  onXpGain: (ctx: SeasonalEventContext, amount: number, source: string): void => {
    if (!isWeekendUtc(Date.now())) return;
    // Emit a custom event other plugins (or the HUD) can react to.
    ctx.emit("double-xp-weekend:boosted", { amount, source });
  },

  eventCard: (_ctx: SeasonalEventContext, now: number): SeasonalEventCard | null => {
    const active = isWeekendUtc(now);
    return {
      pluginId: PLUGIN_ID,
      title: "2× XP Weekend",
      description: active
        ? "Live now — every XP gain is doubled until Monday 00:00 UTC."
        : "Returns Saturday 00:00 UTC. Plan your grind.",
      active,
      endsAt: active ? nextMondayUtc(now) : undefined,
      accent: "#7c3aed",
    };
  },
};

export default doubleXpWeekend;
