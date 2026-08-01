/**
 * GET /api/verify-access - Check if user has token access to MCP
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyUserAccess,
  getTokenRequirement,
  isTokenGateExemptWallet,
} from '@/api/lib/token-gating';
import { requireApiKey } from '@/api/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const walletAddress =
      req.headers.get('x-wallet-address') ||
      req.nextUrl.searchParams.get('wallet') ||
      null;

    // DEF wallet can pass without API key / holdings
    if (isTokenGateExemptWallet(walletAddress)) {
      const tokenRequirement = await getTokenRequirement().catch(() => ({
        ca: '13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9',
        symbol: 'ORBITX',
        minValueUsd: 10,
      }));
      return NextResponse.json({
        hasAccess: true,
        exempt: true,
        currentHoldingUsd: 0,
        cumulativeBuyValueUsd: 0,
        requiredTokenCa: tokenRequirement.ca,
        requiredTokenSymbol: tokenRequirement.symbol,
        requiredValueUsd: tokenRequirement.minValueUsd,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    const auth = await requireApiKey(req, {
      status: (code) => ({ json: (data: any) => new Response(JSON.stringify(data), { status: code }) }),
      json: (data: any) => new Response(JSON.stringify(data)),
    } as any);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verification = await verifyUserAccess(auth.userId, walletAddress);
    const tokenRequirement = await getTokenRequirement();

    return NextResponse.json({
      hasAccess: verification.meetsRequirement,
      exempt: Boolean(verification.exempt),
      currentHoldingUsd: verification.currentHoldingUsd,
      cumulativeBuyValueUsd: verification.cumulativeBuyValueUsd,
      requiredTokenCa: tokenRequirement.ca,
      requiredTokenSymbol: tokenRequirement.symbol,
      requiredValueUsd: tokenRequirement.minValueUsd,
      verifiedAt: verification.verifiedAt,
      expiresAt: verification.expiresAt,
    });
  } catch (error) {
    console.error('[v0] GET /api/verify-access error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
