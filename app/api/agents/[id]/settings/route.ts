/**
 * GET /api/agents/[id]/settings - Get agent settings
 * PUT /api/agents/[id]/settings - Update agent settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSettings, updateSettings } from '@/api/lib/agents';
import { requireApiKey } from '@/api/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiKey(req, {
      status: (code) => ({ json: (data: any) => new Response(JSON.stringify(data), { status: code }) }),
      json: (data: any) => new Response(JSON.stringify(data)),
    } as any);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getOrCreateSettings(params.id, auth.userId);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[v0] GET /api/agents/[id]/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiKey(req, {
      status: (code) => ({ json: (data: any) => new Response(JSON.stringify(data), { status: code }) }),
      json: (data: any) => new Response(JSON.stringify(data)),
    } as any);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const settings = await updateSettings(params.id, auth.userId, body);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[v0] PUT /api/agents/[id]/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
