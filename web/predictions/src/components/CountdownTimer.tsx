'use client';
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface Props {
  expiry: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function CountdownTimer({ expiry, className = '', size = 'sm' }: Props) {
  const [diff, setDiff] = useState(Math.max(0, new Date(expiry).getTime() - Date.now()));

  useEffect(() => {
    const t = setInterval(() => setDiff(Math.max(0, new Date(expiry).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiry]);

  if (diff <= 0) return (
    <span className={['text-loss font-medium', className].join(' ')}>Expired</span>
  );

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  const urgent = diff < 3600000; // less than 1 hour
  const color = urgent ? 'text-loss' : diff < 86400000 ? 'text-yellow-400' : 'text-cyan';

  if (size === 'sm') return (
    <span className={['flex items-center gap-1', color, className].join(' ')}>
      <Clock size={11} />
      <span className="text-xs font-mono font-medium tabular-nums">
        {d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2,'0')}s`}
      </span>
    </span>
  );

  if (size === 'lg') return (
    <div className={['flex items-center gap-3', className].join(' ')}>
      {[
        { v: d, u: 'd' }, { v: h, u: 'h' }, { v: m, u: 'm' }, { v: s, u: 's' }
      ].map(({ v, u }) => (
        <div key={u} className="text-center">
          <div className={['text-2xl font-black font-mono tabular-nums', color].join(' ')}>
            {String(v).padStart(2,'0')}
          </div>
          <div className="text-xs text-gray-600 uppercase tracking-widest">{u}</div>
        </div>
      ))}
    </div>
  );

  return (
    <span className={['font-mono font-bold tabular-nums text-sm', color, className].join(' ')}>
      {d > 0 ? `${d}d ${h}h ${m}m` : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
    </span>
  );
}
