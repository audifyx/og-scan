import { NextResponse } from 'next/server';
import { getSessionUser, getProfile } from '@/lib/games/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyDeposit } from '@/lib/solana-verify';
import { getSolUsd } from '@/lib/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || process.env.TREASURY_WALLET || '';
const CREATION_FEE_USD = 12.5;
const SELECT = 'id, creator_username, creator_wallet, recipient_wallet, title, description, target_lamports, deadline, image_url, link, status, raised_lamports, contribution_count, created_at';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const { data: c } = await supabaseAdmin.from('fundraises').select(SELECT).eq('id', id).maybeSingle();
    if (!c) return NextResponse.json({ ok: false, error: 'Campaign not found.' }, { status: 404 });
    const { data: contribs } = await supabaseAdmin.from('fundraise_contributions')
      .select('id, contributor_username, contributor_wallet, lamports, tx_signature, created_at')
      .eq('campaign_id', id).order('created_at', { ascending: false }).limit(200);
    return NextResponse.json({ ok: true, campaign: c, contributions: contribs || [] });
  }
  const status = searchParams.get('status');
  let q = supabaseAdmin.from('fundraises').select(SELECT).order('created_at', { ascending: false }).limit(100);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return NextResponse.json({ ok: true, campaigns: data || [] });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  if (!TREASURY) return NextResponse.json({ ok: false, error: 'Treasury wallet not configured.' }, { status: 500 });
  const body = (await req.json().catch(() => ({}))) || {};

  // Create campaign — verify $25 fee paid to Treasury
  const title = String(body.title || '').trim();
  const recipient = String(body.recipientWallet || '').trim();
  const wallet = String(body.wallet || '').trim();
  const tx = String(body.txSignature || '').trim();
  const target = Math.max(0, Math.floor(Number(body.targetLamports) || 0));
  if (!title) return NextResponse.json({ ok: false, error: 'Title is required.' }, { status: 400 });
  if (!recipient) return NextResponse.json({ ok: false, error: 'Recipient wallet is required.' }, { status: 400 });
  if (!wallet || !tx) return NextResponse.json({ ok: false, error: 'Missing wallet or fee transaction.' }, { status: 400 });

  const { data: dup } = await supabaseAdmin.from('fundraises').select('id').eq('creation_fee_tx', tx).maybeSingle();
  if (dup) return NextResponse.json({ ok: false, error: 'This transaction was already used.' }, { status: 409 });

  const solUsd = await getSolUsd();
  const feeLamports = Math.floor((CREATION_FEE_USD / solUsd) * 1e9);
  const minFee = Math.floor(feeLamports * 0.95); // small tolerance for price drift
  const check = await verifyDeposit(tx, wallet, TREASURY, minFee);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error || `Creation fee (~$${CREATION_FEE_USD}) could not be verified.` }, { status: 400 });

  const prof = await getProfile(user.id);
  const { data: created, error } = await supabaseAdmin.from('fundraises').insert({
    creator_user_id: user.id, creator_username: prof.username, creator_wallet: wallet,
    recipient_wallet: recipient, title, description: String(body.description || ''),
    target_lamports: target, deadline: body.deadline || null,
    image_url: body.imageUrl || null, link: body.link || null,
    status: 'active', creation_fee_tx: tx, creation_fee_lamports: check.lamports,
  }).select('id').single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: created.id });
}
