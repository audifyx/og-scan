'use client';

interface Props {
  yes: number; no: number;
  yesLabel?: string; noLabel?: string;
  size?: 'sm' | 'md';
}

export function BetPoolBar({ yes, no, yesLabel = 'Yes', noLabel = 'No', size = 'sm' }: Props) {
  const total = yes + no;
  const yp = total > 0 ? (yes / total * 100) : 50;
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';
  return (
    <div className="space-y-1.5">
      <div className={`${h} rounded-full overflow-hidden bg-white/5 flex`}>
        <div className="bg-emerald-500 transition-all" style={{ width: `${yp}%` }} />
        <div className="bg-red-500 flex-1" />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span className="text-emerald-600 font-medium">{yesLabel} {yp.toFixed(0)}%</span>
        <span className="text-red-600 font-medium">{noLabel} {(100 - yp).toFixed(0)}%</span>
      </div>
    </div>
  );
}
