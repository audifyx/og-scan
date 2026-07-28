import { NextResponse } from 'next/server';
import { getSessionUser, getBalance } from '@/lib/games/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Please sign in.' }, { status: 401 });
  const balance = await getBalance(user.id);
  return NextResponse.json({ ok: true, balance });
}
