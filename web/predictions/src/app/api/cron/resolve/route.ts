import { NextResponse } from 'next/server';
import { runDueAutoResolutions } from '@/lib/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Triggered by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set.
// Also accepts `?secret=` for manual/admin triggering.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset => allow (dev). Set CRON_SECRET in prod.
  const auth = req.headers.get('authorization') || '';
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get('secret') === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const result = await runDueAutoResolutions();
  return NextResponse.json({ at: new Date().toISOString(), ...result });
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
