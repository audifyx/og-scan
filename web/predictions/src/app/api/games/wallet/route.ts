import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/games/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });

  const [{ data: bal }, { data: withdrawals }, { data: recent }, { data: allRounds }] = await Promise.all([
    supabaseAdmin.from('game_balances').select('*').eq('user_id', user.id).maybeSingle(),
    supabaseAdmin.from('game_withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('game_rounds').select('id, game, wager, multiplier, payout, win, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(25),
    supabaseAdmin.from('game_rounds').select('wager, payout, win').eq('user_id', user.id).limit(5000),
  ]);

  const rounds = allRounds || [];
  const totalWagered = rounds.reduce((s, r) => s + Number(r.wager || 0), 0);
  const totalWon = rounds.reduce((s, r) => s + Number(r.payout || 0), 0);
  const wins = rounds.filter(r => r.win).length;
  const losses = rounds.length - wins;

  const stats = {
    balance: Number(bal?.balance ?? 0), totalWagered, totalWon,
    totalWithdrawn: Number(bal?.total_withdrawn ?? 0),
    netProfit: totalWon - totalWagered, wins, losses, games: rounds.length,
  };
  return NextResponse.json({ ok: true, stats, withdrawals: withdrawals || [], rounds: recent || [] });
}
