import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { Connection, PublicKey } from '@solana/web3.js';
import { getSolUsd } from '@/lib/fees';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RPC = process.env.SOLANA_RPC_ENDPOINT || process.env.NEXT_PUBLIC_RPC_ENDPOINT || '';
const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET || process.env.TREASURY_WALLET || '';

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const conn = new Connection(RPC, 'confirmed');
    const lamports = await conn.getBalance(new PublicKey(TREASURY));
    const sol = lamports / 1e9;
    const price = await getSolUsd();
    return NextResponse.json({ ok: true, treasury: TREASURY, sol, usd: sol * price });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'RPC error' }, { status: 500 });
  }
}
