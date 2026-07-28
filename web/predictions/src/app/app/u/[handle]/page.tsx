'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Loader2, Trophy, Target, Coins, Award, Copy, CheckCheck } from 'lucide-react';
import { FollowControls } from '@/components/FollowControls';
import { ProfilePayouts } from '@/components/ProfilePayouts';

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const short = (w?: string | null) => (w ? w.slice(0, 4) + '…' + w.slice(-4) : '—');

export default function PublicProfile() {
  const { handle } = useParams<{ handle: string }>();
  const router = useRouter();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const h = decodeURIComponent(handle);
      let row: any = null;
      // username first
      const byName = await (supabase as any).from('profiles').select('*').eq('username', h).maybeSingle();
      row = byName.data;
      if (!row && isUuid(h)) { const byId = await (supabase as any).from('profiles').select('*').or(`id.eq.${h},user_id.eq.${h}`).maybeSingle(); row = byId.data; }
      setP(row); setLoading(false);
    })();
  }, [handle]);

  if (loading) return <div className="max-w-2xl mx-auto py-20 flex items-center justify-center text-gray-500"><Loader2 className="animate-spin mr-2" /> Loading profile…</div>;
  if (!p) return (
    <div className="max-w-2xl mx-auto py-20 text-center text-gray-500">
      <p>Profile not found.</p>
      <button onClick={() => router.push('/app/leaderboard')} className="mt-4 text-cyan font-bold">Back to leaderboard</button>
    </div>
  );

  const name = p.display_name || p.username || short(p.wallet);
  const wins = p.wins ?? 0, losses = p.losses ?? 0, games = wins + losses;
  const winRate = games ? Math.round((wins / games) * 100) : 0;
  const tw = p.twitter ? String(p.twitter).replace(/^@/, '') : null;
  const copyWallet = () => { if (!p.wallet) return; navigator.clipboard.writeText(p.wallet); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const Stat = ({ icon: Icon, label, value, c }: any) => (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-center">
      <Icon size={16} className={`mx-auto mb-1.5 ${c}`} />
      <p className="text-xl font-black text-white">{value}</p>
      <p className="text-[11px] text-gray-500">{label}</p>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-2">
      <button onClick={() => router.push('/app/leaderboard')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white"><ArrowLeft size={15} /> Leaderboard</button>

      <div className="bg-card border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple to-cyan flex items-center justify-center text-2xl font-black text-black shrink-0">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-white truncate">{name}</h1>
            {p.username && <p className="text-sm text-gray-500">@{p.username}</p>}
            {tw && <a href={`https://x.com/${tw}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan hover:underline">@{tw} on X</a>}
          </div>
        </div>
        {p.bio && <p className="text-sm text-gray-300 mt-4">{p.bio}</p>}
        {p.wallet && (
          <div className="mt-4 flex items-center gap-2 bg-black/30 rounded-xl p-2.5 w-fit">
            <span className="font-mono text-xs text-gray-400">{short(p.wallet)}</span>
            <button onClick={copyWallet} className="text-gray-500 hover:text-cyan">{copied ? <CheckCheck size={13} className="text-win" /> : <Copy size={13} />}</button>
          </div>
        )}

        <FollowControls targetProfileId={p.id} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={Trophy} label="Wins" value={wins} c="text-win" />
        <Stat icon={Target} label="Losses" value={losses} c="text-loss" />
        <Stat icon={Award} label="Win rate" value={`${winRate}%`} c="text-cyan" />
        <Stat icon={Coins} label="Won (SOL)" value={`◎ ${Number(p.total_won_sol || 0).toFixed(2)}`} c="text-gold" />
      </div>

      <ProfilePayouts wallet={p.wallet} />
    </div>
  );
}
