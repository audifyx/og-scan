/**
 * useRecruits — beach-party firm recruiting (paper CITY gameplay).
 * Hiring costs a signing bonus; each recruit earns a daily wage claim.
 */

import { useCallback, useState } from "react";
import { RECRUIT_POOL } from "../data/socialData";
import { paperLedger } from "../engine/paperLedger";

const KEY = "orbitxcity.social.recruits.v1";
const SIGNING_BONUS = 200;

interface Persist {
  hired: string[]; // npcIds
  lastClaim: number;
}

function load(): Persist {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Persist;
      if (Array.isArray(s.hired)) return { hired: s.hired, lastClaim: s.lastClaim ?? 0 };
    }
  } catch {
    /* fresh */
  }
  return { hired: [], lastClaim: 0 };
}

function save(p: Persist) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* blocked */
  }
}

export function useRecruits() {
  const [persist, setPersist] = useState<Persist>(load);

  const hire = useCallback(
    (npcId: string): boolean => {
      if (persist.hired.includes(npcId)) return false;
      if (!paperLedger.spend(SIGNING_BONUS, `Firm recruit signing bonus — ${npcId}`)) return false;
      const next = { ...persist, hired: [...persist.hired, npcId] };
      setPersist(next);
      save(next);
      return true;
    },
    [persist]
  );

  const recruits = RECRUIT_POOL.map((r) => ({ ...r, hired: persist.hired.includes(r.npcId) }));
  const dailyWage = recruits.filter((r) => r.hired).reduce((a, r) => a + r.wageCity, 0);
  const canClaim = dailyWage > 0 && Date.now() - persist.lastClaim > 20 * 3600_000;

  const claimWages = useCallback((): number => {
    if (!canClaim) return 0;
    paperLedger.earn(dailyWage, `Firm crew daily wages (${persist.hired.length} recruits)`);
    const next = { ...persist, lastClaim: Date.now() };
    setPersist(next);
    save(next);
    return dailyWage;
  }, [canClaim, dailyWage, persist]);

  return { recruits, hire, signingBonus: SIGNING_BONUS, dailyWage, canClaim, claimWages };
}
