import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { settleBet } from '@/lib/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { betId, winningOutcomeIndex } = body || {};
  if (!betId || winningOutcomeIndex === undefined || winningOutcomeIndex === null) {
    return NextResponse.json({ ok: false, error: 'Missing betId or winningOutcomeIndex' }, { status: 400 });
  }
  const res = await settleBet(betId, Number(winningOutcomeIndex), 'Manually resolved by admin');
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json(res);
}
