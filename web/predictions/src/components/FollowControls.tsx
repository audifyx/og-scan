'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export function FollowControls({ targetProfileId }: { targetProfileId: string }) {
  const { profile } = useAuth();
  const myId = profile?.id || null;
  const isSelf = myId === targetProfileId;

  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ count: fc }, { count: gc }] = await Promise.all([
      (supabase as any).from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetProfileId),
      (supabase as any).from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetProfileId),
    ]);
    setFollowers(fc || 0);
    setFollowing(gc || 0);
    if (myId && !isSelf) {
      const { data } = await (supabase as any).from('follows').select('follower_id').eq('follower_id', myId).eq('following_id', targetProfileId).maybeSingle();
      setIsFollowing(!!data);
    }
  }, [targetProfileId, myId, isSelf]);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    if (!myId || isSelf || busy) return;
    setBusy(true);
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowers((c) => c + (next ? 1 : -1));
    if (next) {
      await (supabase as any).from('follows').insert({ follower_id: myId, following_id: targetProfileId });
    } else {
      await (supabase as any).from('follows').delete().eq('follower_id', myId).eq('following_id', targetProfileId);
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-4 mt-4">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-white font-bold">{followers}<span className="text-gray-500 font-normal"> followers</span></span>
        <span className="text-white font-bold">{following}<span className="text-gray-500 font-normal"> following</span></span>
      </div>
      {myId && !isSelf && (
        <button onClick={toggle} disabled={busy}
          className={clsx('ml-auto inline-flex items-center gap-1.5 text-sm font-bold rounded-xl px-4 py-2 transition-all',
            isFollowing ? 'bg-white/5 border border-white/15 text-white hover:border-loss hover:text-loss' : 'btn-primary !py-2')}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}
