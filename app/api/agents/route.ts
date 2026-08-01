/**
 * GET /api/agents - List user's agents
 * POST /api/agents - Create new agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserAgents, createAgent } from '@/api/lib/agents';
import { verifyUserAccess } from '@/api/lib/token-gating';
import { requireApiKey, requireTokenAccess, sendError, sendSuccess } from '@/api/lib/auth';

function walletFromRequest(req: NextRequest): string | null {
  return req.headers.get('x-wallet-address') || req.nextUrl.searchParams.get('wallet') || null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKey(req, {
      status: (code) => ({ json: (data: any) => new Response(JSON.stringify(data), { status: code }) }),
      json: (data: any) => new Response(JSON.stringify(data)),
    } as any);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token access (DEF wallet exempt)
    const verification = await verifyUserAccess(auth.userId, walletFromRequest(req));
    if (!verification.meetsRequirement) {
      return NextResponse.json({
        error: 'Insufficient token holdings. Need $10 worth of ORBITX token.',
        currentHolding: verification.currentHoldingUsd,
        cumulativeBuys: verification.cumulativeBuyValueUsd,
      }, { status: 403 });
    }

    const agents = await getUserAgents(auth.userId);
    return NextResponse.json({ agents });
  } catch (error) {
    console.error('[v0] GET /api/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKey(req, {
      status: (code) => ({ json: (data: any) => new Response(JSON.stringify(data), { status: code }) }),
      json: (data: any) => new Response(JSON.stringify(data)),
    } as any);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify token access (DEF wallet exempt)
    const verification = await verifyUserAccess(auth.userId, walletFromRequest(req));
    if (!verification.meetsRequirement) {
      return NextResponse.json({
        error: 'Insufficient token holdings. Need $10 worth of ORBITX token.',
      }, { status: 403 });
    }

    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
    }

    const agent = await createAgent(auth.userId, name, description);
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('[v0] POST /api/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
