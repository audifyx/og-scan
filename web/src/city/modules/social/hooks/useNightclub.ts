/**
 * useNightclub — ownable nightclub state (paper CITY gameplay + ORBITX
 * premium purchase, defensive). Persists to localStorage.
 */

import { useCallback, useState } from "react";
import { paperLedger } from "../engine/paperLedger";
import {
  CLUB_LEASE_CITY,
  defaultClubState,
  hypeCost,
  simulateNight,
} from "../engine/nightclubEngine";
import { useSocialBilling } from "../billing";
import type { DjBooking, NightclubState } from "../types";

const KEY = "orbitxcity.social.nightclub.v1";

function load(): NightclubState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as NightclubState;
      if (typeof s.popularity === "number") return { ...defaultClubState(), ...s };
    }
  } catch {
    /* fresh */
  }
  return defaultClubState();
}

function save(s: NightclubState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* blocked */
  }
}

export interface NightReport {
  attendees: number;
  grossCity: number;
  netCity: number;
  popularityDelta: number;
  verdict: string;
}

export function useNightclub(playerName: string) {
  const [club, setClub] = useState<NightclubState>(load);
  const [lastReport, setLastReport] = useState<NightReport | null>(null);
  const billing = useSocialBilling();

  const persist = (next: NightclubState) => {
    setClub(next);
    save(next);
  };

  /** Gameplay path: lease-to-own with paper CITY (works before premium lands). */
  const buyWithPaper = useCallback((): boolean => {
    if (club.owned) return false;
    if (!paperLedger.spend(CLUB_LEASE_CITY, "Nightclub lease-to-own — Club Eclipse")) return false;
    persist({ ...club, owned: true });
    return true;
  }, [club]);

  /** Premium path: burn real ORBITX. Defensive — throws until billing ready. */
  const buyWithOrbitx = useCallback(async (): Promise<string> => {
    if (club.owned) throw new Error("Already owned.");
    const { signature } = await billing.burnForPremium({
      amount: 25,
      reason: "city-social:nightclub-purchase",
      ref: crypto.randomUUID(),
    });
    const next = {
      ...club,
      owned: true,
      lifetimeBurnedOrbitx: club.lifetimeBurnedOrbitx + 25,
    };
    persist(next);
    return signature;
  }, [club, billing]);

  const bookDj = useCallback(
    (booking: DjBooking): boolean => {
      if (!club.owned || club.tonight) return false;
      if (!paperLedger.spend(booking.feeCity, `DJ booking — ${booking.name}`)) return false;
      persist({ ...club, tonight: booking });
      return true;
    },
    [club]
  );

  const setCover = useCallback(
    (coverCity: number) => {
      const c = Math.max(0, Math.min(500, Math.floor(coverCity)));
      persist({ ...club, coverCity: c });
    },
    [club]
  );

  const rename = useCallback(
    (name: string) => {
      const n = name.trim().slice(0, 32);
      if (n) persist({ ...club, name: n });
    },
    [club]
  );

  const runNight = useCallback((): NightReport | null => {
    if (!club.owned || !club.tonight) return null;
    const nightId = new Date().toISOString().slice(0, 10);
    const r = simulateNight(club, club.tonight, nightId);
    if (r.netCity > 0) paperLedger.earn(r.netCity, `Club night — ${club.name} (${r.attendees} heads)`);
    persist({
      ...club,
      popularity: r.newPopularity,
      tonight: null,
      lifetimeEarningsCity: club.lifetimeEarningsCity + r.netCity,
    });
    const report: NightReport = {
      attendees: r.attendees,
      grossCity: r.grossCity,
      netCity: r.netCity,
      popularityDelta: r.popularityDelta,
      verdict: r.verdict,
    };
    setLastReport(report);
    return report;
  }, [club]);

  const hypeFloor = useCallback((): boolean => {
    if (!club.owned) return false;
    const cost = hypeCost(club.popularity);
    if (!paperLedger.spend(cost, `Floor hype promo — ${club.name}`)) return false;
    persist({ ...club, popularity: Math.min(100, club.popularity + 6) });
    return true;
  }, [club]);

  return {
    club,
    lastReport,
    billing,
    leasePrice: CLUB_LEASE_CITY,
    buyWithPaper,
    buyWithOrbitx,
    bookDj,
    setCover,
    rename,
    runNight,
    hypeFloor,
    hypePrice: hypeCost(club.popularity),
    playerName,
  };
}
