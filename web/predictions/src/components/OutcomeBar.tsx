'use client';

const OUTCOME_COLORS = [
  { bar: '#00F5FF', text: 'text-cyan',   bg: 'bg-cyan/10',   border: 'border-cyan/30' },
  { bar: '#A855F7', text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  { bar: '#22C55E', text: 'text-win',    bg: 'bg-win/10',    border: 'border-win/30' },
  { bar: '#F59E0B', text: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  { bar: '#EF4444', text: 'text-loss',   bg: 'bg-loss/10',   border: 'border-loss/30' },
  { bar: '#EC4899', text: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-400/30' },
  { bar: '#14B8A6', text: 'text-teal-400', bg: 'bg-teal-400/10', border: 'border-teal-400/30' },
  { bar: '#F97316', text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
];

const LAMPORTS = 1_000_000_000;

interface Props {
  outcomes: string[];
  pools: number[];
  winningIndex?: number | null;
  size?: 'sm' | 'md' | 'lg';
  onSelect?: (i: number) => void;
  selectedIndex?: number;
}

export function OutcomeBar({ outcomes, pools, winningIndex, size = 'sm', onSelect, selectedIndex }: Props) {
  const total = pools.reduce((s, p) => s + p, 0);

  if (size === 'sm') return (
    <div className="space-y-1">
      <div className="h-2 rounded-full overflow-hidden bg-white/5 flex gap-px">
        {outcomes.map((_, i) => {
          const pct = total > 0 ? (pools[i] / total) * 100 : 100 / outcomes.length;
          const c = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
          return (
            <div key={i} className="outcome-bar h-full rounded-sm"
              style={{ width: `${pct}%`, backgroundColor: c.bar }} />
          );
        })}
      </div>
      <div className="flex gap-3 flex-wrap">
        {outcomes.map((o, i) => {
          const pct = total > 0 ? (pools[i] / total * 100).toFixed(0) : Math.floor(100/outcomes.length);
          const c = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
          return (
            <span key={i} className={['text-xs font-medium', c.text].join(' ')}>
              {o}: {pct}%
            </span>
          );
        })}
      </div>
    </div>
  );

  // Large / selectable outcomes
  return (
    <div className="space-y-3">
      {outcomes.map((o, i) => {
        const pct = total > 0 ? (pools[i] / total) * 100 : 100 / outcomes.length;
        const c = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
        const isWinner = winningIndex === i;
        const isSelected = selectedIndex === i;
        return (
          <button
            key={i}
            onClick={() => onSelect?.(i)}
            disabled={winningIndex !== undefined && winningIndex !== null}
            className={[
              'w-full text-left rounded-xl border p-4 transition-all',
              isSelected ? [c.bg, c.border, 'ring-2', 'ring-offset-0'].join(' ') : 'bg-white/3 border-white/8 hover:border-white/20',
              isWinner ? [c.bg, c.border].join(' ') : '',
              onSelect && !winningIndex ? 'cursor-pointer' : 'cursor-default',
            ].join(' ')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white">{o}</span>
              <div className="text-right">
                <span className={['font-bold', c.text].join(' ')}>{pct.toFixed(1)}%</span>
                {isWinner && <span className="ml-2 text-xs bg-win/20 text-win px-2 py-0.5 rounded-full">Winner</span>}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="outcome-bar h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.bar }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>◎ {(pools[i] / LAMPORTS).toFixed(3)} SOL</span>
              {isSelected && <span className={c.text}>Selected ✓</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export { OUTCOME_COLORS };
