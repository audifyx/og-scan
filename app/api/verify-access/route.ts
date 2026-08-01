/**
 * GET /api/verify-access - Check if user has token access to MCP
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyUserAccess, getTokenRequirement } from '@/api/lib/token-gating';
import { requireApiKey } from '@/api/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKey(req, {
      status: (code) => ({ json: (data: any) => new Response(JSON.stringify(data), { status: code }) }),
      json: (data: any) => new Response(JSON.stringify(data)),
    } as any);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verification = await verifyUserAccess(auth.userId);
    const tokenRequirement = await getTokenRequirement();

    return NextResponse.json({
      hasAccess: verification.meetsRequirement,
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
