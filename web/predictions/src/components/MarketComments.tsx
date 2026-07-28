'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Heart, Trash2, Send, Loader2 } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

interface CommentRow {
  id: string;
  body: string;
  like_count: number;
  created_at: string;
  user_id: string;
  author?: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; wallet: string | null } | null;
}

const short = (w?: string | null) => (w ? w.slice(0, 4) + '…' + w.slice(-4) : 'anon');
const ago = (d: string) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export function MarketComments({ betId }: { betId: string }) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('bet_comments')
      .select('id, body, like_count, created_at, user_id, author:profiles!bet_comments_profile_id_fkey(id,username,display_name,avatar_url,wallet)')
      .eq('bet_id', betId)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(200);
    setComments(data || []);
    setLoading(false);
    if (user && (data || []).length) {
      const ids = (data as CommentRow[]).map((c) => c.id);
      const { data: likes } = await (supabase as any).from('comment_likes').select('comment_id').eq('user_id', user.id).in('comment_id', ids);
      setLiked(new Set((likes || []).map((l: any) => l.comment_id)));
    }
  }, [betId, user]);

  useEffect(() => { load(); }, [load]);

  // realtime: refresh on any change to this bet's comments
  useEffect(() => {
    const ch = supabase
      .channel(`comments:${betId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_comments', filter: `bet_id=eq.${betId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [betId, load]);

  const post = async () => {
    const text = body.trim();
    if (!text || !user) return;
    setPosting(true); setErr('');
    const { error } = await (supabase as any).from('bet_comments').insert({
      bet_id: betId, user_id: user.id, profile_id: profile?.id ?? null, body: text,
    });
    setPosting(false);
    if (error) { setErr(error.message); return; }
    setBody('');
    load();
  };

  const toggleLike = async (c: CommentRow) => {
    if (!user) return;
    const isLiked = liked.has(c.id);
    // optimistic
    setLiked((prev) => { const n = new Set(prev); isLiked ? n.delete(c.id) : n.add(c.id); return n; });
    setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, like_count: x.like_count + (isLiked ? -1 : 1) } : x));
    if (isLiked) {
      await (supabase as any).from('comment_likes').delete().eq('comment_id', c.id).eq('user_id', user.id);
    } else {
      await (supabase as any).from('comment_likes').insert({ comment_id: c.id, user_id: user.id });
    }
  };

  const remove = async (c: CommentRow) => {
    if (!user || c.user_id !== user.id) return;
    setComments((prev) => prev.filter((x) => x.id !== c.id));
    await (supabase as any).from('bet_comments').update({ deleted: true }).eq('id', c.id);
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-white mb-4">
        <MessageCircle size={15} className="text-cyan" /> Discussion
        <span className="text-gray-500 font-normal">({comments.length})</span>
      </h3>

      {user ? (
        <div className="flex gap-2 mb-5">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); } }}
            maxLength={1000}
            placeholder="Share your take…"
            className="input-field flex-1 !py-2.5"
          />
          <button onClick={post} disabled={posting || !body.trim()} className="btn-primary !py-2 !px-4 shrink-0">
            {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-5">Connect & sign in to join the discussion.</p>
      )}
      {err && <p className="text-loss text-xs mb-3">{err}</p>}

      {loading ? (
        <div className="text-gray-500 text-sm flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</div>
      ) : comments.length === 0 ? (
        <p className="text-gray-500 text-sm">No comments yet. Be the first.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => {
            const name = c.author?.display_name || c.author?.username || short(c.author?.wallet);
            const handle = c.author?.username || c.author?.id;
            return (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple to-cyan flex items-center justify-center text-xs font-black text-black shrink-0">
                  {String(name).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    {handle ? <Link href={`/app/u/${handle}`} className="font-semibold text-white hover:text-cyan truncate">{name}</Link>
                            : <span className="font-semibold text-white truncate">{name}</span>}
                    <span className="text-gray-600">· {ago(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-200 mt-0.5 break-words whitespace-pre-wrap">{c.body}</p>
                  <div className="flex items-center gap-4 mt-1.5">
                    <button onClick={() => toggleLike(c)} disabled={!user}
                      className={clsx('flex items-center gap-1 text-xs transition-colors', liked.has(c.id) ? 'text-loss' : 'text-gray-500 hover:text-loss')}>
                      <Heart size={12} fill={liked.has(c.id) ? 'currentColor' : 'none'} /> {c.like_count || 0}
                    </button>
                    {user && c.user_id === user.id && (
                      <button onClick={() => remove(c)} className="flex items-center gap-1 text-xs text-gray-600 hover:text-loss">
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
