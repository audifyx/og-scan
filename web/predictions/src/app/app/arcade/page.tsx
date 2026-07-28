'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Swords, Loader2, Gamepad2, Users } from 'lucide-react';

type Game = {
  slug: string; name: string; mode: string; engine: string;
  live: boolean; min_stake: number; max_stake: number;
  description: string; how_to_play: string; resolution: string; why_manual: string; sort: number;
};

export default function ArcadePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/games/catalog', { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) setGames(d.games);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-1">
        <Gamepad2 className="text-cyan" />
        <h1 className="text-2xl font-black text-white">Arcade</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        {games.length} head-to-head games. Every game is 2-player, manual-deposit, and provably fair. Create a game or join an open one.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading games…</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {games.map(g => (
            <div key={g.slug} className="bg-card border border-white/10 rounded-2xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-white">{g.name}</h3>
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-cyan/15 text-cyan border-cyan/30">
                  <Users size={11} /> 1v1
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1.5">{g.description}</p>
              <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                <p><span className="text-gray-400 font-semibold">How:</span> {g.how_to_play}</p>
                <p><span className="text-gray-400 font-semibold">Resolves:</span> {g.resolution}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[11px] text-gray-600">◎ {g.min_stake} – {g.max_stake} SOL</span>
                <Link href="/app/games" className="inline-flex items-center gap-1.5 text-xs font-bold bg-cyan text-black px-3 py-1.5 rounded-lg hover:opacity-90">
                  <Swords size={13} /> Play
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
