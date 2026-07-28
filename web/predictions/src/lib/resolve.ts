// ============================================================
// Shared market resolution: applies payouts and finalizes a bet.
// Used by the admin manual resolve route and the automated cron.
// ============================================================
import { supabaseAdmin } from '@/lib/supabase-admin';
import { computePayouts } from '@/lib/payout';
import { resolveCryptoPrice, type CryptoResolutionConfig, type OracleResult } from '@/lib/oracles/crypto';
import { resolveSportsMatch, type SportsResolutionConfig } from '@/lib/oracles/sports';

export interface ResolveResult {
  ok: boolean;
  error?: string;
  winners?: number;
  refunded?: boolean;
  grossPool?: number;
  prizePool?: number;
  fee?: number;
  totalPaid?: number;
}

/** Settle a bet on a known winning outcome index. Idempotent-ish: skips already-resolved bets. */
export async function settleBet(betId: string, winningOutcomeIndex: number, note?: string): Promise<ResolveResult> {
  const winning = Number(winningOutcomeIndex);

  const { data: bet } = await supabaseAdmin.from('bets').select('id, status').eq('id', betId).single();
  if (!bet) return { ok: false, error: 'Bet not found' };
  if (bet.status === 'resolved') return { ok: false, error: 'Already resolved' };

  const { data: wagers, error } = await supabaseAdmin
    .from('user_bets')
    .select('id, outcome_index, amount, status')
    .eq('bet_id', betId)
    .eq('status', 'confirmed');
  if (error) return { ok: false, error: error.message };

  const summary = computePayouts(
    (wagers || []).map((w: any) => ({ id: w.id, outcome_index: Number(w.outcome_index), amount: Number(w.amount) })),
    winning,
  );

  for (const r of summary.results) {
    await supabaseAdmin.from('user_bets').update({ status: r.status, payout: r.payout }).eq('id', r.id);
  }

  await supabaseAdmin.from('bets').update({
    status: 'resolved',
    winning_outcome_index: winning,
    platform_fees_collected: summary.fee,
    resolution_status: 'resolved',
    resolution_checked_at: new Date().toISOString(),
    resolution_note: note ?? null,
    resolved_at: new Date().toISOString(),
  }).eq('id', betId);

  return {
    ok: true,
    winners: summary.results.filter((r) => r.status === 'won').length,
    refunded: summary.refunded,
    grossPool: summary.grossPool,
    prizePool: summary.prizePool,
    fee: summary.fee,
    totalPaid: summary.totalPaid,
  };
}

/** Run the configured oracle for a bet. Returns the oracle's decision (does not settle). */
export async function runOracle(kind: string, config: any): Promise<OracleResult> {
  if (kind === 'crypto_price') return resolveCryptoPrice(config as CryptoResolutionConfig);
  if (kind === 'sports_match') return resolveSportsMatch(config as SportsResolutionConfig);
  return { decided: false, note: `Unsupported resolution_kind "${kind}"` };
}

/** Attempt automated resolution for a single bet row. */
export async function attemptAutoResolve(bet: any): Promise<{ betId: string; status: string; note: string }> {
  const result = await runOracle(bet.resolution_kind, bet.resolution_config || {});
  if (!result.decided || result.winningOutcomeIndex == null) {
    await supabaseAdmin.from('bets').update({
      resolution_checked_at: new Date().toISOString(),
      resolution_note: result.note,
    }).eq('id', bet.id);
    return { betId: bet.id, status: 'pending', note: result.note };
  }
  const settled = await settleBet(bet.id, result.winningOutcomeIndex, result.note);
  if (!settled.ok) {
    await supabaseAdmin.from('bets').update({
      resolution_status: 'failed',
      resolution_checked_at: new Date().toISOString(),
      resolution_note: settled.error || result.note,
    }).eq('id', bet.id);
    return { betId: bet.id, status: 'failed', note: settled.error || result.note };
  }
  return { betId: bet.id, status: 'resolved', note: result.note };
}

/** Find and resolve all due auto-resolve bets. */
export async function runDueAutoResolutions(limit = 50) {
  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from('bets')
    .select('id, resolution_kind, resolution_config, resolves_at, status')
    .eq('auto_resolve', true)
    .eq('resolution_status', 'pending')
    .in('status', ['open', 'active', 'locked'])
    .lte('resolves_at', nowIso)
    .limit(limit);
  if (error) return { ok: false, error: error.message, processed: [] as any[] };

  const processed = [];
  for (const bet of due || []) {
    try {
      processed.push(await attemptAutoResolve(bet));
    } catch (e: any) {
      processed.push({ betId: bet.id, status: 'error', note: e?.message || 'error' });
    }
  }
  return { ok: true, checked: (due || []).length, processed };
}
