/**
 * Hangout scheduling engine — recurring weekly events (rooftop parties,
 * beach bonfires, camping weekends, open mic, docks car meets).
 *
 * Pure date math, no dependencies. Handles overnight spans (e.g. Friday
 * 21:00 → Saturday 02:00). Times are the PLAYER's local timezone — the
 * whole city runs on local time, same as the day/night cycle.
 */

import type { HangoutEvent, HangoutKind } from "../types";

interface Schedule {
  id: string;
  kind: HangoutKind;
  venueId: string;
  title: string;
  weekday: number; // 0=Sun..6=Sat, day the event STARTS
  startHour: number; // 0-23.99
  endHour: number; // may be < startHour (overnight)
  baseAttendees: number;
  blurb: string;
}

export const SCHEDULES: Schedule[] = [
  {
    id: "rooftop-friday",
    kind: "rooftop",
    venueId: "rooftop-neon",
    title: "Neon Nights — Rooftop Party",
    weekday: 5, startHour: 21, endHour: 26, // 21:00 → 02:00
    baseAttendees: 85,
    blurb: "Fridays on the 42nd floor. Synth sets, skyline views, zero cover.",
  },
  {
    id: "beach-saturday",
    kind: "beach",
    venueId: "beach-bonfire",
    title: "Bonfire Saturdays",
    weekday: 6, startHour: 19, endHour: 23,
    baseAttendees: 60,
    blurb: "Driftwood fires at Bonfire Point. Recruiters welcome — build your firm.",
  },
  {
    id: "camp-weekend",
    kind: "camp",
    venueId: "camp-pines",
    title: "Whisper Pines Weekend",
    weekday: 6, startHour: 10, endHour: 42, // Sat 10:00 → Sun 18:00
    baseAttendees: 24,
    blurb: "No signal, no charts. Campfire voice chat with whoever shows up.",
  },
  {
    id: "camp-lake-weekend",
    kind: "camp",
    venueId: "camp-lake",
    title: "Stillwater Lake Campout",
    weekday: 6, startHour: 12, endHour: 40,
    baseAttendees: 16,
    blurb: "Lakeside tents, night fishing, rumor-grade gossip.",
  },
];

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Next Date (in the future, strictly after `from`) matching weekday+hour. */
function nextOccurrence(weekday: number, hour: number, from: Date): Date {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const c = new Date(from);
  c.setHours(h, m, 0, 0);
  let delta = (weekday - c.getDay() + 7) % 7;
  if (delta === 0 && c.getTime() <= from.getTime()) delta = 7;
  c.setDate(c.getDate() + delta);
  return c;
}

function toEvent(s: Schedule, startsAt: Date): HangoutEvent {
  const durHrs = s.endHour - s.startHour;
  const endsAt = new Date(startsAt.getTime() + durHrs * 3600_000);
  const now = Date.now();
  const live = now >= startsAt.getTime() && now < endsAt.getTime();
  // attendees swell mid-event: deterministic wobble so re-renders are stable
  const progress = live
    ? (now - startsAt.getTime()) / (endsAt.getTime() - startsAt.getTime())
    : 0;
  const swell = 1 + 0.6 * Math.sin(Math.min(1, progress) * Math.PI);
  const wobble = 1 + 0.12 * Math.sin(startsAt.getTime() / 3_600_000);
  return {
    id: `${s.id}-${startsAt.getTime()}`,
    kind: s.kind,
    venueId: s.venueId,
    title: s.title,
    startsAt: startsAt.getTime(),
    endsAt: endsAt.getTime(),
    recurring: "weekly",
    live,
    attendees: Math.max(4, Math.round(s.baseAttendees * swell * wobble)),
  };
}

export interface HangoutStatus {
  live: HangoutEvent[];
  upcoming: { event: HangoutEvent; startsInMs: number }[];
}

/** Live events right now + the next occurrence of each schedule. */
export function getHangoutStatus(now = new Date()): HangoutStatus {
  const live: HangoutEvent[] = [];
  const upcoming: { event: HangoutEvent; startsInMs: number }[] = [];
  const sod = startOfDay(now);

  for (const s of SCHEDULES) {
    // candidate: the occurrence that started most recently (may still be live)
    const h = Math.floor(s.startHour);
    const m = Math.round((s.startHour - h) * 60);
    const todayStart = new Date(sod);
    todayStart.setHours(h, m, 0, 0);
    let delta = (now.getDay() - s.weekday + 7) % 7;
    const lastStart = new Date(todayStart);
    lastStart.setDate(lastStart.getDate() - delta);
    // if today's start is in the future but a previous-day overnight
    // schedule could still be live, also check yesterday's slot
    const candidates = [lastStart];
    if (delta === 0 && lastStart.getTime() > now.getTime()) {
      // today's start hasn't happened yet; the live one (if any) started last week
      const prev = new Date(lastStart);
      prev.setDate(prev.getDate() - 7);
      candidates.push(prev);
    }
    let matched = false;
    for (const c of candidates) {
      const ev = toEvent(s, c);
      if (ev.live) {
        live.push(ev);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const next = nextOccurrence(s.weekday, s.startHour, now);
      const ev = toEvent(s, next);
      upcoming.push({ event: ev, startsInMs: next.getTime() - now.getTime() });
    }
  }

  upcoming.sort((a, b) => a.startsInMs - b.startsInMs);
  return { live, upcoming };
}

/** Car-meet weekly schedule (docks). Kept here because it shares the weekly math. */
export function getCarMeetWindow(now = new Date()): { startsAt: number; endsAt: number; live: boolean } {
  const startsAt = nextOccurrence(6, 21, new Date(now.getTime() - 7 * 24 * 3600_000)); // last Sat 21:00 or earlier
  // find the occurrence that is live or the next one
  const sod = startOfDay(now);
  const thisSat = new Date(sod);
  const delta = (6 - now.getDay() + 7) % 7;
  thisSat.setDate(thisSat.getDate() + delta);
  thisSat.setHours(21, 0, 0, 0);
  let start = thisSat;
  if (start.getTime() > now.getTime()) {
    const prev = new Date(start);
    prev.setDate(prev.getDate() - 7);
    start = prev;
  }
  const end = new Date(start.getTime() + 4 * 3600_000); // 21:00 → 01:00
  const live = now.getTime() >= start.getTime() && now.getTime() < end.getTime();
  const nextStart = live ? start.getTime() : nextOccurrence(6, 21, now).getTime();
  void startsAt;
  return {
    startsAt: live ? start.getTime() : nextStart,
    endsAt: live ? end.getTime() : nextStart + 4 * 3600_000,
    live,
  };
}

/** Comedy open-mic weekly schedule (Tuesdays 20:00–23:00). */
export function getOpenMicWindow(now = new Date()): { startsAt: number; endsAt: number; live: boolean } {
  const sod = startOfDay(now);
  const tue = new Date(sod);
  const delta = (2 - now.getDay() + 7) % 7;
  tue.setDate(tue.getDate() + delta);
  tue.setHours(20, 0, 0, 0);
  let start = tue;
  if (start.getTime() > now.getTime()) {
    const prev = new Date(start);
    prev.setDate(prev.getDate() - 7);
    start = prev;
  }
  const end = new Date(start.getTime() + 3 * 3600_000);
  const live = now.getTime() >= start.getTime() && now.getTime() < end.getTime();
  const nextStart = live ? start.getTime() : nextOccurrence(2, 20, now).getTime();
  return {
    startsAt: live ? start.getTime() : nextStart,
    endsAt: live ? end.getTime() : nextStart + 3 * 3600_000,
    live,
  };
}

export function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
