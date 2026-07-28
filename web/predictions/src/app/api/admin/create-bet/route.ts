import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LAMPORTS = 1_000_000_000;

const VALID_KINDS = ['manual', 'crypto_price', 'sports_match'];

export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) || {};

  const title = String(b.title || '').trim();
  const outcomes = Array.isArray(b.outcomes) ? b.outcomes.map((o: any) => String(o).trim()).filter(Boolean) : [];
  if (!title) return NextResponse.json({ ok: false, error: 'Title required' }, { status: 400 });
  if (outcomes.length < 2) return NextResponse.json({ ok: false, error: 'Need at least 2 outcomes' }, { status: 400 });

  const minStakeSol = Math.max(0, parseFloat(b.min_stake) || 0);
  const expiryMinutes = Math.max(5, parseInt(b.expiry_minutes) || 10080);
  const expiry = new Date(Date.now() + expiryMinutes * 60000).toISOString();

  // ── Auto-resolution config (optional) ──────────────────────────────
  const kind = VALID_KINDS.includes(String(b.resolution_kind)) ? String(b.resolution_kind) : 'manual';
  const autoResolve = !!b.auto_resolve && kind !== 'manual';
  let resolutionConfig: any = {};
  let resolvesAt: string | null = null;

  if (autoResolve) {
    const cfg = b.resolution_config || {};
    if (kind === 'crypto_price') {
      const asset = String(cfg.asset || '').trim().toLowerCase();
      const comparator = cfg.comparator === 'lte' ? 'lte' : 'gte';
      const target = Number(cfg.target);
      if (!asset || !(target > 0)) {
        return NextResponse.json({ ok: false, error: 'crypto_price needs asset + target' }, { status: 400 });
      }
      resolutionConfig = {
        asset, comparator, target,
        yes_index: Number.isInteger(cfg.yes_index) ? cfg.yes_index : 0,
        no_index: Number.isInteger(cfg.no_index) ? cfg.no_index : 1,
      };
    } else if (kind === 'sports_match') {
      const eventId = String(cfg.event_id || '').trim();
      if (!eventId) return NextResponse.json({ ok: false, error: 'sports_match needs event_id' }, { status: 400 });
      resolutionConfig = {
        provider: 'thesportsdb',
        event_id: eventId,
        market: cfg.market === 'total' ? 'total' : 'winner',
        home_index: Number.isInteger(cfg.home_index) ? cfg.home_index : 0,
        away_index: Number.isInteger(cfg.away_index) ? cfg.away_index : 1,
        ...(Number.isInteger(cfg.draw_index) ? { draw_index: cfg.draw_index } : {}),
        ...(cfg.market === 'total' ? {
          line: Number(cfg.line) || 0,
          over_index: Number.isInteger(cfg.over_index) ? cfg.over_index : 0,
          under_index: Number.isInteger(cfg.under_index) ? cfg.under_index : 1,
        } : {}),
      };
    }
    // when to start checking: explicit resolves_at, else the bet expiry
    resolvesAt = b.resolves_at ? new Date(b.resolves_at).toISOString() : expiry;
  }

  const { error } = await supabaseAdmin.from('bets').insert({
    title,
    description: String(b.description || title),
    category: String(b.category || 'custom').toLowerCase(),
    creator_id: null,            // admin-created; resolution/payout run server-side
    amount_sol: minStakeSol,
    outcomes,
    outcome_pools: outcomes.map(() => 0),
    yes_label: outcomes[0],
    no_label: outcomes[1],
    min_stake: Math.floor(minStakeSol * LAMPORTS),
    creator_fee_pct: 0,
    creator_type: 'admin',
    creator_wallet: 'admin',
    max_participants: 15,
    image_url: (b.image_url && String(b.image_url).trim()) || null,
    status: 'open',
    featured: !!b.featured,
    total_pool: 0,
    bet_count: 0,
    expiry,
    on_chain_pubkey: '',
    bet_id: 0,
    amount_lamports: 0,
    auto_resolve: autoResolve,
    resolution_kind: kind,
    resolution_config: resolutionConfig,
    resolution_status: 'pending',
    resolves_at: resolvesAt,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
