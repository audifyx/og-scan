export type MatchGame =
  | 'coinflip' | 'dice' | 'highcard' | 'plinko' | 'crash' | 'wheel'
  | 'evenodd' | 'redblack' | 'sevens' | 'slots'
  | 'rps' | 'war' | 'blackjack' | 'darts' | 'race' | 'penalty' | 'mines';

export interface GameMeta { id: MatchGame; label: string; emoji: string; needsSide: boolean; sides?: [string, string]; blurb: string; desc: string; }

export const GAME_META: GameMeta[] = [
  { id: 'coinflip', label: 'Coinflip',          emoji: '🪙', needsSide: false, blurb: 'Call it. Watch it flip.',        desc: 'Call heads or tails, then watch the coin spin and land. Match the result to score big.' },
  { id: 'dice',     label: 'Dice Roll',         emoji: '🎲', needsSide: false, blurb: 'Roll high to win.',             desc: 'Tap to roll a die from 1 to 100. The higher you roll, the bigger your score.' },
  { id: 'slots',    label: 'Slots',             emoji: '🍒', needsSide: false, blurb: 'Spin for a jackpot line.',      desc: 'Spin three reels. Two matching pays, three matching is the jackpot.' },
  { id: 'crash',    label: 'Crash',             emoji: '🚀', needsSide: false, blurb: 'Cash out before it blows.',     desc: 'The multiplier climbs fast. Cash out before the rocket explodes — greed costs you.' },
  { id: 'plinko',   label: 'Plinko',            emoji: '🔵', needsSide: false, blurb: 'Drop into a multiplier.',       desc: 'Drop the ball through the pegs. The bucket it lands in sets your multiplier.' },
  { id: 'mines',    label: 'Mines',             emoji: '💣', needsSide: false, blurb: 'Reveal gems, dodge mines.',     desc: 'Flip tiles to find gems. Each gem grows your score — but hit a mine and you bust.' },
  { id: 'wheel',    label: 'Wheel of Fortune',  emoji: '🎡', needsSide: false, blurb: 'Spin for the big wedge.',       desc: 'Spin the wheel and land on the highest-value wedge you can.' },
  { id: 'blackjack',label: 'Blackjack 21',      emoji: '🃏', needsSide: false, blurb: 'Hit or stand to 21.',          desc: 'Draw cards and get as close to 21 as you dare without going bust.' },
  { id: 'highcard', label: 'High Card',         emoji: '🂡', needsSide: false, blurb: 'Draw the highest card.',        desc: 'Flip a single card. The higher the rank, the higher your score.' },
  { id: 'war',      label: 'Card War',          emoji: '⚔️', needsSide: false, blurb: 'Win the most rounds.',          desc: 'Five card battles dealt one by one. Win the majority of rounds.' },
  { id: 'darts',    label: 'Darts',             emoji: '🎯', needsSide: false, blurb: 'Aim for the bullseye.',         desc: 'Time the moving crosshair and throw. Closer to the bullseye scores more.' },
  { id: 'race',     label: 'Rocket Race',       emoji: '🏁', needsSide: false, blurb: 'Tap fast to fly far.',          desc: 'Mash the boost for a few seconds. The faster you tap, the further your rocket flies.' },
  { id: 'penalty',  label: 'Penalty Shootout',  emoji: '⚽', needsSide: false, blurb: 'Beat the keeper x5.',           desc: 'Pick a corner for five penalties and try to out-guess the keeper.' },
  { id: 'rps',      label: 'Rock Paper Scissors', emoji: '✊', needsSide: false, blurb: 'Throw to win.',               desc: 'Throw rock, paper or scissors on the count and beat the opposing hand.' },
  { id: 'sevens',   label: 'Lucky 7s',          emoji: '🎰', needsSide: false, blurb: 'Roll a high total.',            desc: 'Roll two dice and chase a high combined total. Sevens are lucky.' },
  { id: 'evenodd',  label: 'Even or Odd',       emoji: '🔢', needsSide: false, blurb: 'Call the parity.',              desc: 'Call even or odd before a random number is drawn.' },
  { id: 'redblack', label: 'Red or Black',      emoji: '🎴', needsSide: false, blurb: 'Pick a color, spin.',           desc: 'Pick red or black, then spin. Match the color the wheel lands on.' },
];

export const MATCH_GAMES: MatchGame[] = GAME_META.map(g => g.id);

export function validateMatchParams(game: string, _side?: string): string | null {
  const meta = GAME_META.find(g => g.id === game);
  if (!meta) return 'Unknown game';
  return null;
}
