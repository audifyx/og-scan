import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const L = 1_000_000_000;
const dayKey = (d: string | number | Date) => new Date(d).toISOString().slice(0, 10);

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const [profilesRes, betsRes, wdRes, matchesRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('user_id, username, wallet, wins, losses, total_wagered_sol, total_won_sol, created_at'),
    supabaseAdmin.from('bets').select('status, total_pool, category, created_at'),
    supabaseAdmin.from('game_withdrawals').select('status, lamports, created_at'),
    supabaseAdmin.from('game_matches').select('status, pot, payout_amount, paid, created_at'),
  ]);

  const profiles = profilesRes.data || [];
  const bets = betsRes.data || [];
  const wds = wdRes.data || [];
  const matches = matchesRes.data || [];

  const now = Date.now();
  const dayMs = 86400000;
  const todayKey = dayKey(now);
  const ago = (n: number) => now - n * dayMs;

  // ---- Users ----
  const usersTotal = profiles.length;
  const newToday = profiles.filter(p => p.created_at && dayKey(p.created_at) === todayKey).length;
  const new7d = profiles.filter(p => p.created_at && new Date(p.created_at).getTime() >= ago(7)).length;

  // 14-day daily signups
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(dayKey(now - i * dayMs));
  const signupsByDay: Record<string, number> = Object.fromEntries(days.map(d => [d, 0]));
  for (const p of profiles) { const k = p.created_at && dayKey(p.created_at); if (k && k in signupsByDay) signupsByDay[k]++; }

  // ---- Withdrawals (payout requests) ----
  const sum = (a: any[], f: (x: any) => number) => a.reduce((s, x) => s + (f(x) || 0), 0);
  const pendingWd = wds.filter(w => w.status === 'pending');
  const paidWd = wds.filter(w => w.status === 'paid');
  const pendingWdLamports = sum(pendingWd, w => Number(w.lamports));
  const paidWdLamports = sum(paidWd, w => Number(w.lamports));

  // ---- Match payouts ----
  const unpaidMatch = matches.filter(m => Number(m.payout_amount) > 0 && !m.paid);
  const paidMatch = matches.filter(m => m.paid && Number(m.payout_amount) > 0);
  const unpaidMatchLamports = sum(unpaidMatch, m => Number(m.payout_amount));
  const paidMatchLamports = sum(paidMatch, m => Number(m.payout_amount));

  // ---- Markets / volume ----
  const openMarkets = bets.filter(b => b.status === 'open').length;
  const resolvedMarkets = bets.filter(b => b.status === 'resolved').length;
  const betVolLamports = sum(bets, b => Number(b.total_pool));
  const matchVolLamports = sum(matches, m => Number(m.pot));
  const totalVolumeLamports = betVolLamports + matchVolLamports;

  const volByDay: Record<string, number> = Object.fromEntries(days.map(d => [d, 0]));
  for (const b of bets) { const k = b.created_at && dayKey(b.created_at); if (k && k in volByDay) volByDay[k] += Number(b.total_pool || 0) / L; }
  for (const m of matches) { const k = m.created_at && dayKey(m.created_at); if (k && k in volByDay) volByDay[k] += Number(m.pot || 0) / L; }

  // ---- Top users ----
  const topUsers = [...profiles]
    .sort((a, b) => Number(b.total_won_sol || 0) - Number(a.total_won_sol || 0))
    .slice(0, 10)
    .map(p => ({ username: p.username, wallet: p.wallet, wins: p.wins, losses: p.losses, wagered: Number(p.total_wagered_sol || 0), won: Number(p.total_won_sol || 0) }));

  return NextResponse.json({
    ok: true,
    stats: {
      usersTotal, newToday, new7d,
      pendingWithdrawals: pendingWd.length, pendingWithdrawalsSol: pendingWdLamports / L,
      paidWithdrawals: paidWd.length, paidWithdrawalsSol: paidWdLamports / L,
      unpaidMatchPayouts: unpaidMatch.length, unpaidMatchSol: unpaidMatchLamports / L,
      totalPayoutsSol: (paidWdLamports + paidMatchLamports) / L,
      pendingPayoutsSol: (pendingWdLamports + unpaidMatchLamports) / L,
      openMarkets, resolvedMarkets, totalMarkets: bets.length,
      matchesTotal: matches.length, matchesResolved: matches.filter(m => m.status === 'resolved').length,
      totalVolumeSol: totalVolumeLamports / L,
      dailySignups: days.map(d => ({ d: d.slice(5), v: signupsByDay[d] })),
      dailyVolume: days.map(d => ({ d: d.slice(5), v: Number(volByDay[d].toFixed(3)) })),
      topUsers,
    },
  });
}
