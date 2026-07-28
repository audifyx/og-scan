import { NextResponse } from 'next/server';
import { getSessionUser, getProfile } from '@/lib/games/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyDeposit } from '@/lib/solana-verify';
import { randomSeed, hashSeed } from '@/lib/games/provably-fair';
import { MATCH_GAMES, MatchGame } from '@/lib/games/match';
import { MIN_WAGER } from '@/lib/games/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || process.env.TREASURY_WALLET || '';
const RESERVE_TTL_SEC = 120;
const PUBLIC = 'id, game, wager, rake_bps, status, creator_username, creator_wallet, creator_side, creator_score, opponent_username, opponent_wallet, opponent_score, pot, result, winner_username, winner_wallet, winner_side, server_seed_hash, server_seed, created_at, resolved_at';
const clampScore = (v: any) => Math.max(0, Math.min(1000, Math.floor(Number(v) || 0)));

async function txUsed(sig: string) {
  const [{ data: a }, { data: b }, { data: c }] = await Promise.all([
    supabaseAdmin.from('game_matches').select('id').eq('creator_tx', sig).maybeSingle(),
    supabaseAdmin.from('game_matches').select('id').eq('opponent_tx', sig).maybeSingle(),
    supabaseAdmin.from('user_bets').select('id').eq('tx_signature', sig).maybeSingle(),
  ]);
  return !!(a || b || c);
}

async function notify(userId: string | null | undefined, title: string, body: string, data: any) {
  if (!userId) return;
  try {
    const { data: prof } = await supabaseAdmin.from('profiles').select('id').eq('user_id', userId).maybeSingle();
    if (prof) await supabaseAdmin.from('notifications').insert({ user_id: prof.id, type: 'match', title, body, data });
  } catch {}
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get('tab') || 'open';

  // Single match (the play/detail screen).
  const id = searchParams.get('id');
  if (id) {
    const { data } = await supabaseAdmin.from('game_matches').select(PUBLIC).eq('id', id).maybeSingle();
    if (!data) return NextResponse.json({ ok: false, error: 'Match not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, match: data, me: user?.id || null });
  }
  if (tab === 'mine' && user) {
    const { data } = await supabaseAdmin.from('game_matches').select(PUBLIC)
      .or(`creator_user_id.eq.${user.id},opponent_user_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(50);
    return NextResponse.json({ ok: true, matches: data || [], me: user.id });
  }
  if (tab === 'history') {
    const { data } = await supabaseAdmin.from('game_matches').select(PUBLIC).eq('status', 'resolved').order('resolved_at', { ascending: false }).limit(30);
    return NextResponse.json({ ok: true, matches: data || [], me: user?.id || null });
  }
  const { data } = await supabaseAdmin.from('game_matches').select(PUBLIC).eq('status', 'open').is('opponent_user_id', null).order('created_at', { ascending: false }).limit(50);
  return NextResponse.json({ ok: true, matches: data || [], me: user?.id || null });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  if (!TREASURY) return NextResponse.json({ ok: false, error: 'Treasury wallet not configured.' }, { status: 500 });
  const body = (await req.json().catch(() => ({}))) || {};
  const action = body.action;

  if (action === 'create') {
    const game = String(body.game) as MatchGame;
    const wager = Math.floor(Number(body.wager));
    const score = clampScore(body.score);
    const wallet = String(body.wallet || '');
    const tx = String(body.txSignature || '');
    if (!MATCH_GAMES.includes(game)) return NextResponse.json({ ok: false, error: 'Unknown game.' }, { status: 400 });
    if (!wager || wager < MIN_WAGER) return NextResponse.json({ ok: false, error: `Minimum stake is ${(MIN_WAGER / 1e9).toFixed(3)} SOL.` }, { status: 400 });
    if (!wallet || !tx) return NextResponse.json({ ok: false, error: 'Missing wallet or deposit signature.' }, { status: 400 });
    if (await txUsed(tx)) return NextResponse.json({ ok: false, error: 'This transaction was already used.' }, { status: 409 });
    const check = await verifyDeposit(tx, wallet, TREASURY, wager);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.error || 'Deposit could not be verified.' }, { status: 400 });
    const serverSeed = randomSeed();
    const prof = await getProfile(user.id);
    const { data: m, error } = await supabaseAdmin.from('game_matches').insert({
      game, wager, status: 'open', creator_user_id: user.id, creator_username: prof.username, creator_wallet: wallet,
      creator_side: null, creator_score: score, creator_tx: tx, pot: wager, server_seed_hash: hashSeed(serverSeed),
    }).select(PUBLIC).single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    await supabaseAdmin.from('game_match_seeds').insert({ match_id: m.id, server_seed: serverSeed });
    return NextResponse.json({ ok: true, match: m });
  }

  const matchId = body.matchId;
  if (!matchId) return NextResponse.json({ ok: false, error: 'Missing matchId.' }, { status: 400 });

  if (action === 'reserve') {
    const cutoff = new Date(Date.now() - RESERVE_TTL_SEC * 1000).toISOString();
    const { data: m } = await supabaseAdmin.from('game_matches').select('id, wager, status, creator_user_id').eq('id', matchId).maybeSingle();
    if (!m) return NextResponse.json({ ok: false, error: 'Match not found.' }, { status: 404 });
    if (m.status !== 'open') return NextResponse.json({ ok: false, error: 'This match is no longer open.' }, { status: 409 });
    if (m.creator_user_id === user.id) return NextResponse.json({ ok: false, error: "You can't join your own match." }, { status: 400 });
    const { data: reserved } = await supabaseAdmin.from('game_matches')
      .update({ reserved_by: user.id, reserved_at: new Date().toISOString() })
      .eq('id', matchId).eq('status', 'open').is('opponent_user_id', null)
      .or(`reserved_by.is.null,reserved_at.lt.${cutoff},reserved_by.eq.${user.id}`)
      .select('id, wager').single();
    if (!reserved) return NextResponse.json({ ok: false, error: 'Someone is already joining this match. Try another.' }, { status: 409 });
    return NextResponse.json({ ok: true, wager: Number(reserved.wager), treasury: TREASURY, reserveTtl: RESERVE_TTL_SEC });
  }

  if (action === 'confirm') {
    const wallet = String(body.wallet || '');
    const tx = String(body.txSignature || '');
    if (!wallet || !tx) return NextResponse.json({ ok: false, error: 'Missing wallet or deposit signature.' }, { status: 400 });
    const { data: m } = await supabaseAdmin.from('game_matches').select('*').eq('id', matchId).maybeSingle();
    if (!m) return NextResponse.json({ ok: false, error: 'Match not found.' }, { status: 404 });
    if (m.status !== 'open') return NextResponse.json({ ok: false, error: 'This match is no longer open.' }, { status: 409 });
    if (m.reserved_by !== user.id) return NextResponse.json({ ok: false, error: 'Your reservation expired. Reserve again before paying.' }, { status: 409 });
    if (m.creator_user_id === user.id) return NextResponse.json({ ok: false, error: "You can't join your own match." }, { status: 400 });
    if (await txUsed(tx)) return NextResponse.json({ ok: false, error: 'This transaction was already used.' }, { status: 409 });
    const check = await verifyDeposit(tx, wallet, TREASURY, m.wager);
    if (!check.ok) return NextResponse.json({ ok: false, error: check.error || 'Deposit could not be verified.' }, { status: 400 });

    const { data: secret } = await supabaseAdmin.from('game_match_seeds').select('server_seed').eq('match_id', matchId).maybeSingle();
    const serverSeed = secret?.server_seed || '';
    const oppScore = clampScore(body.score);
    const creScore = Number(m.creator_score || 0);
    const winIsCreatorScore = creScore >= oppScore;
    const winner: 'creator' | 'opponent' = winIsCreatorScore ? 'creator' : 'opponent';
    const result: any = { game: m.game, creatorScore: creScore, opponentScore: oppScore };
    const prof = await getProfile(user.id);
    const pot = m.wager * 2;
    const rake = Math.floor(pot * (Number(m.rake_bps) / 10000));
    const payout = pot - rake;
    const winIsCreator = winner === 'creator';
    const winUser = winIsCreator ? m.creator_user_id : user.id;
    const winWallet = winIsCreator ? m.creator_wallet : wallet;
    const winName = winIsCreator ? m.creator_username : prof.username;
    const winSide = null;

    const { data: done } = await supabaseAdmin.from('game_matches').update({
      status: 'resolved', opponent_user_id: user.id, opponent_username: prof.username, opponent_wallet: wallet, opponent_tx: tx, opponent_score: oppScore,
      pot, result, winner_user_id: winUser, winner_username: winName, winner_wallet: winWallet, winner_side: winSide,
      server_seed: serverSeed, resolved_at: new Date().toISOString(),
    }).eq('id', matchId).eq('status', 'open').select(PUBLIC).single();
    if (!done) return NextResponse.json({ ok: false, error: 'This match just closed. Your deposit will be credited/refunded by the team.' }, { status: 409 });

    if (winUser) await supabaseAdmin.rpc('game_credit', { p_user: winUser, p_amount: payout, p_kind: 'win', p_ref: 'match:' + matchId });
    const mult = m.wager > 0 ? Number((payout / m.wager).toFixed(4)) : 0;
    await supabaseAdmin.from('game_rounds').insert([
      { user_id: m.creator_user_id, username: m.creator_username, game: m.game, wager: m.wager, multiplier: winIsCreator ? mult : 0, payout: winIsCreator ? payout : 0, win: winIsCreator, params: { side: m.creator_side }, result, server_seed_hash: m.server_seed_hash, client_seed: matchId, nonce: 0 },
      { user_id: user.id, username: prof.username, game: m.game, wager: m.wager, multiplier: winIsCreator ? 0 : mult, payout: winIsCreator ? 0 : payout, win: !winIsCreator, params: {}, result, server_seed_hash: m.server_seed_hash, client_seed: matchId, nonce: 0 },
    ]);
    const solPay = (payout / 1e9).toFixed(4);
    await notify(winUser, 'You won your game', `\u25ce ${solPay} SOL was added to your balance. Request a withdrawal anytime \u2014 most are paid within 5 hours (always under 24h).`, { matchId, payout });
    await notify(winIsCreator ? user.id : m.creator_user_id, 'Game result', `Your ${m.game} game was settled and you lost this one. Run it back?`, { matchId });

    return NextResponse.json({ ok: true, match: done, youWon: winUser === user.id, winner, result, payout });
  }

  if (action === 'cancel') {
    const { data: m } = await supabaseAdmin.from('game_matches').select('*').eq('id', matchId).maybeSingle();
    if (!m) return NextResponse.json({ ok: false, error: 'Match not found.' }, { status: 404 });
    if (m.creator_user_id !== user.id) return NextResponse.json({ ok: false, error: 'Only the creator can cancel.' }, { status: 403 });
    if (m.status !== 'open') return NextResponse.json({ ok: false, error: 'Only open matches can be cancelled.' }, { status: 400 });
    const cutoff = new Date(Date.now() - RESERVE_TTL_SEC * 1000).toISOString();
    if (m.reserved_by && m.reserved_at && m.reserved_at > cutoff) return NextResponse.json({ ok: false, error: 'Someone is currently joining. Try again in a moment.' }, { status: 409 });
    const { data: done } = await supabaseAdmin.from('game_matches').update({ status: 'cancelled' }).eq('id', matchId).eq('status', 'open').is('opponent_user_id', null).select('id').single();
    if (!done) return NextResponse.json({ ok: false, error: 'Could not cancel \u2014 it may have just been joined.' }, { status: 409 });
    if (m.creator_user_id) await supabaseAdmin.rpc('game_credit', { p_user: m.creator_user_id, p_amount: m.wager, p_kind: 'refund', p_ref: 'match_cancel:' + matchId });
    await notify(m.creator_user_id, 'Match cancelled', `Your stake of \u25ce ${(m.wager / 1e9).toFixed(4)} SOL was credited back to your balance.`, { matchId });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
}
