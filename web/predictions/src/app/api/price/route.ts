import { NextResponse } from 'next/server';
import { getSolUsd } from '@/lib/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let cached = { price: 0, at: 0 };

export async function GET() {
  const now = Date.now();
  if (cached.price > 0 && now - cached.at < 60_000) {
    return NextResponse.json({ sol: cached.price, cached: true });
  }
  const price = await getSolUsd();
  cached = { price, at: now };
  return NextResponse.json({ sol: price, cached: false });
}
