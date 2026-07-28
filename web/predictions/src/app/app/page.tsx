'use client';
export const dynamic = 'force-dynamic';
import { useState, Suspense } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSearchParams } from 'next/navigation';
import { BetCard } from '@/components/BetCard';
import { PlaceBetModal } from '@/components/PlaceBetModal';
import { CreateBetModal } from '@/components/CreateBetModal';
import { Bet } from '@/utils/types';
import { useBets } from '@/hooks/useBets';
import { supabase } from '@/lib/supabase';
import { Plus, Search, SlidersHorizontal, LayoutGrid, Bitcoin, Trophy, Landmark, Laugh, Film, Cpu, TrendingUp, Sparkles, Flame, Globe } from 'lucide-react';
import clsx from 'clsx';

const CATEGORIES = [
  { key: 'All', icon: LayoutGrid }, { key: 'Crypto', icon: Bitcoin }, { key: 'Trenches', icon: Flame },
  { key: 'Sports', icon: Trophy }, { key: 'Politics', icon: Landmark }, { key: 'Stocks', icon: TrendingUp },
  { key: 'Memes', icon: Laugh }, { key: 'Pop Culture', icon: Sparkles }, { key: 'Entertainment', icon: Film },
  { key: 'Tech', icon: Cpu }, { key: 'Custom', icon: Globe },
];

function BrowseContent() {
  const { publicKey } = useWallet();
  const params = useSearchParams();
  const initCat = params?.get('category') || 'All';

  const [category, setCategory] = useState(initCat);
  const [status, setStatus] = useState('open');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Bet | null>(null);
  const [pickOutcome, setPickOutcome] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { bets, loading, refetch } = useBets({
    status: status === 'all' ? undefined : status,
    category: category === 'All' ? undefined : category.toLowerCase(),
  });

  const sorted = [...bets]
    .filter(b => !search || (b.title + b.description).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'volume') return (b.total_pool || 0) - (a.total_pool || 0);
      if (sort === 'ending-soon') return new Date(a.expiry).getTime() - new Date(b.expiry).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const openBets = bets.filter(b => b.status === 'open').length;
  const totalVol = bets.reduce((s, b) => s + (b.total_pool || 0), 0);

  const handleCreate = async (d: any) => {
    if (!publicKey) throw new Error('Connect your wallet to create a market.');
    const { data: { user } } = await (supabase as any).auth.getUser();
    let creator_id: string | null = null;
    if (user) {
      const { data: prof } = await (supabase as any).from('profiles').select('id').eq('user_id', user.id).maybeSingle();
      creator_id = prof?.id ?? null;
    }
    const outcomes = (d.outcomes && d.outcomes.length >= 2) ? d.outcomes : ['Yes', 'No'];
    const { error } = await (supabase as any).from('bets').insert({
      title: d.title || (d.description || '').slice(0, 60),
      description: d.description || d.title,
      creator_id, creator_wallet: publicKey?.toBase58() || '', creator_type: 'user',
      category: (d.category || 'custom'),
      yes_label: outcomes[0], no_label: outcomes[1] || 'No',
      outcomes, outcome_pools: outcomes.map(() => 0),
      min_stake: 0, amount_sol: 0, status: 'open', total_pool: 0, bet_count: 0,
      max_participants: 15, featured: false, creator_fee_pct: 0, image_url: d.image_url || null,
      expiry: new Date(Date.now() + (d.expiryMinutes || 1440) * 60000).toISOString(),
      on_chain_pubkey: '', bet_id: 0, amount_lamports: 0,
    });
    if (error) throw new Error(error.message);
    refetch();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white">Markets</h1>
          <p className="text-gray-500 text-sm mt-0.5">{openBets} open · ◎ {(totalVol / 1e9).toFixed(2)} in pools · pick a side and win the pool</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan to-purple text-black font-black rounded-xl text-sm">
          <Plus size={15} /> Create market
        </button>
      </div>

      {/* Category rail */}
      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map(({ key, icon: Icon }) => (
          <button key={key} onClick={() => setCategory(key)} className={clsx(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-all',
            category === key ? 'bg-cyan text-black border-cyan' : 'text-gray-300 bg-white/[0.03] border-white/10 hover:text-white hover:border-white/25')}>
            <Icon size={14} /> {key}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {['open', 'locked', 'resolved'].map(s => (
            <button key={s} onClick={() => setStatus(s)} className={clsx('px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all',
              status === s ? 'bg-white text-black' : 'text-gray-400 hover:text-white')}>{s}</button>
          ))}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-cyan/30">
          <option value="newest" className="bg-card">Newest</option>
          <option value="volume" className="bg-card">Highest Volume</option>
          <option value="ending-soon" className="bg-card">Ending Soon</option>
        </select>
        <div className="flex-1 min-w-44 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search markets…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan/30" />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="glass-card rounded-2xl h-52 shimmer" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-24 text-gray-600"><SlidersHorizontal size={36} className="mx-auto mb-3 opacity-30" /><p className="font-medium">No markets here yet</p><p className="text-xs mt-1">Try another category or create the first one.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(b => <BetCard key={b.id} bet={b} onClick={(x) => { setPickOutcome(null); setSelected(x); }} onPick={(x, i) => { setPickOutcome(i); setSelected(x); }} />)}
        </div>
      )}

      {selected && <PlaceBetModal bet={selected} initialOutcome={pickOutcome} onClose={() => setSelected(null)} onSuccess={() => { setSelected(null); refetch(); }} />}
      {showCreate && <CreateBetModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}

      <p className="text-center text-xs text-gray-700 pt-4">⚠️ Play responsibly. 18+ only. Pools and payouts are on-chain and verifiable.</p>
    </div>
  );
}

export default function BrowsePage() {
  return <Suspense fallback={null}><BrowseContent /></Suspense>;
}
