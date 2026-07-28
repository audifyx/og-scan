// ============================================================
// Sports results oracle (TheSportsDB, free tier key "3").
// Resolves match markets once an event has a final score.
// Docs: https://www.thesportsdb.com/api.php  (lookupevent.php?id=)
// ============================================================
import type { OracleResult } from './crypto';

export interface SportsResolutionConfig {
  provider?: 'thesportsdb';
  event_id: string;                 // TheSportsDB idEvent
  market?: 'winner' | 'total';      // default 'winner'
  // winner market mapping (outcome indexes):
  home_index?: number;
  away_index?: number;
  draw_index?: number;
  // total (over/under) market mapping:
  line?: number;                    // total goals/points line
  over_index?: number;
  under_index?: number;
}

const KEY = process.env.SPORTSDB_API_KEY || '3';

interface EventRow {
  strStatus?: string;
  strHomeTeam?: string;
  strAwayTeam?: string;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  dateEvent?: string;
  strTimestamp?: string | null;
}

const FINISHED = ['match finished', 'finished', 'ft', 'aet', 'pen', 'full time'];

export async function lookupEvent(eventId: string): Promise<EventRow | null> {
  try {
    const r = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${KEY}/lookupevent.php?id=${encodeURIComponent(eventId)}`,
      { cache: 'no-store' } as any,
    );
    const j = await r.json();
    return j?.events?.[0] || null;
  } catch {
    return null;
  }
}

export async function resolveSportsMatch(cfg: SportsResolutionConfig): Promise<OracleResult> {
  if (!cfg?.event_id) return { decided: false, note: 'Invalid sports_match config (no event_id)' };
  const ev = await lookupEvent(cfg.event_id);
  if (!ev) return { decided: false, note: 'Event not found, will retry' };

  const home = ev.intHomeScore == null || ev.intHomeScore === '' ? null : Number(ev.intHomeScore);
  const away = ev.intAwayScore == null || ev.intAwayScore === '' ? null : Number(ev.intAwayScore);
  const status = (ev.strStatus || '').toLowerCase().trim();
  const looksFinished = FINISHED.includes(status) || (home != null && away != null && status !== 'ns' && status !== 'not started');

  if (home == null || away == null || !looksFinished) {
    return { decided: false, note: `Not final yet (status="${ev.strStatus || 'unknown'}")` };
  }

  const market = cfg.market || 'winner';
  if (market === 'total') {
    if (typeof cfg.line !== 'number' || cfg.over_index == null || cfg.under_index == null) {
      return { decided: false, note: 'Invalid total market config' };
    }
    const total = home + away;
    const over = total > cfg.line;
    return {
      decided: true,
      winningOutcomeIndex: over ? cfg.over_index : cfg.under_index,
      note: `${ev.strHomeTeam} ${home}-${away} ${ev.strAwayTeam}, total ${total} ${over ? '>' : '<='} ${cfg.line} -> ${over ? 'OVER' : 'UNDER'} (TheSportsDB)`,
    };
  }

  // winner market
  let winner: number | undefined;
  let label: string;
  if (home > away) { winner = cfg.home_index; label = ev.strHomeTeam || 'home'; }
  else if (away > home) { winner = cfg.away_index; label = ev.strAwayTeam || 'away'; }
  else { winner = cfg.draw_index; label = 'draw'; }

  if (winner == null) {
    return { decided: false, note: `Outcome "${label}" has no mapped index in config` };
  }
  return {
    decided: true,
    winningOutcomeIndex: winner,
    note: `${ev.strHomeTeam} ${home}-${away} ${ev.strAwayTeam} -> ${label} wins (TheSportsDB)`,
  };
}
