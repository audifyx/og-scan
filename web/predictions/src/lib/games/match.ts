import { fairFloat } from '@/lib/games/provably-fair';
import type { MatchGame } from '@/lib/games/match-meta';
export { GAME_META, MATCH_GAMES, validateMatchParams } from '@/lib/games/match-meta';
export type { MatchGame, GameMeta } from '@/lib/games/match-meta';

const PLINKO = [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6];
const slotScore = (r: number[]) => {
  const [a, b, c] = r;
  if (a === b && b === c) return 9000 + a;
  if (a === b || b === c || a === c) return 1000 + Math.max(a, b, c);
  return a + b + c;
};

export function resolveMatch(game: MatchGame, serverSeed: string, matchId: string, side?: string):
  { winner: 'creator' | 'opponent'; result: any } {
  const F = (cursor: number) => fairFloat(serverSeed, matchId, 0, cursor);

  if (game === 'coinflip') {
    const flip = F(0) < 0.5 ? 'heads' : 'tails';
    return { winner: flip === side ? 'creator' : 'opponent', result: { flip, creatorSide: side, opponentSide: side === 'heads' ? 'tails' : 'heads' } };
  }
  if (game === 'evenodd') {
    const number = Math.floor(F(0) * 100);
    const parity = number % 2 === 0 ? 'even' : 'odd';
    return { winner: parity === side ? 'creator' : 'opponent', result: { number, parity, creatorSide: side } };
  }
  if (game === 'redblack') {
    const color = F(0) < 0.5 ? 'red' : 'black';
    return { winner: color === side ? 'creator' : 'opponent', result: { color, creatorSide: side } };
  }
  if (game === 'wheel') {
    const f = F(0);
    const pick = f < 0.5 ? 'creator' : 'opponent';
    return { winner: pick, result: { pick, angle: Math.floor(f * 360) } };
  }

  if (game === 'rps') {
    const M = ['rock', 'paper', 'scissors'];
    for (let a = 0; a < 25; a++) {
      const c = Math.floor(F(a * 2) * 3), o = Math.floor(F(a * 2 + 1) * 3);
      if (c !== o) {
        const creatorWins = (c - o + 3) % 3 === 1;
        return { winner: creatorWins ? 'creator' : 'opponent', result: { creator: M[c], opponent: M[o] } };
      }
    }
    return { winner: 'creator', result: { creator: 'rock', opponent: 'rock' } };
  }
  if (game === 'war') {
    let cw = 0, ow = 0; const rounds: number[][] = [];
    for (let r = 0; r < 5; r++) {
      const cc = Math.floor(F(r * 2) * 13) + 2, oc = Math.floor(F(r * 2 + 1) * 13) + 2;
      rounds.push([cc, oc]); if (cc > oc) cw++; else if (oc > cc) ow++;
    }
    for (let r = 5; r < 40 && cw === ow; r++) {
      const cc = Math.floor(F(r * 2) * 13) + 2, oc = Math.floor(F(r * 2 + 1) * 13) + 2;
      if (cc > oc) cw++; else if (oc > cc) ow++;
    }
    return { winner: cw >= ow ? 'creator' : 'opponent', result: { rounds, creatorWins: cw, opponentWins: ow } };
  }
  if (game === 'penalty') {
    let cg = 0, og = 0;
    for (let r = 0; r < 5; r++) { if (F(r * 2) < 0.6) cg++; if (F(r * 2 + 1) < 0.6) og++; }
    for (let r = 5; r < 40 && cg === og; r++) { if (F(r * 2) < 0.6) cg++; if (F(r * 2 + 1) < 0.6) og++; }
    return { winner: cg >= og ? 'creator' : 'opponent', result: { creatorGoals: cg, opponentGoals: og } };
  }

  const drawer = (base: number): { value: number; detail: any } => {
    switch (game) {
      case 'dice': { const v = Math.floor(F(base) * 100) + 1; return { value: v, detail: v }; }
      case 'sevens': { const a = Math.floor(F(base) * 6) + 1, b = Math.floor(F(base + 1) * 6) + 1; return { value: a + b, detail: [a, b] }; }
      case 'highcard': { const rank = Math.floor(F(base) * 13) + 2, suit = Math.floor(F(base + 1) * 4); return { value: rank, detail: { rank, suit } }; }
      case 'crash': { const f = Math.min(F(base), 0.9999999); const crash = Math.max(1, Math.floor((0.99 / (1 - f)) * 100) / 100); return { value: Math.round(crash * 100), detail: crash }; }
      case 'plinko': { let rights = 0; for (let i = 0; i < 8; i++) if (F(base + i) >= 0.5) rights++; const mult = PLINKO[rights]; return { value: Math.round(mult * 100), detail: { bucket: rights, mult } }; }
      case 'slots': { const r = [Math.floor(F(base) * 7), Math.floor(F(base + 1) * 7), Math.floor(F(base + 2) * 7)]; return { value: slotScore(r), detail: r }; }
      case 'blackjack': {
        const cards: number[] = []; let total = 0; let i = 0;
        while (total < 17 && i < 6) { const card = Math.floor(F(base + i) * 10) + 2; cards.push(card); total += card; i++; }
        const bust = total > 21; return { value: bust ? 0 : total, detail: { cards, total, bust } };
      }
      case 'darts': { const v = Math.floor(F(base) * 181); return { value: v, detail: v }; }
      case 'race': { const v = Math.floor(F(base) * 1000); return { value: v, detail: v }; }
      default: { const v = Math.floor(F(base) * 1000); return { value: v, detail: v }; }
    }
  };

  let cd: any = null, od: any = null, winner: 'creator' | 'opponent' = 'creator';
  for (let a = 0; a < 25; a++) {
    const c = drawer(a * 64);
    const o = drawer(a * 64 + 32);
    cd = c.detail; od = o.detail;
    if (c.value !== o.value) { winner = c.value > o.value ? 'creator' : 'opponent'; break; }
  }
  return { winner, result: { creator: cd, opponent: od } };
}
