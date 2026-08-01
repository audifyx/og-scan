/**
 * GET /api/agents/[id] - Get agent details
 * PUT /api/agents/[id] - Update agent
 * DELETE /api/agents/[id] - Delete agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgent, updateAgent, deleteAgent } from '@/api/lib/agents';
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

    const agent = await getAgent(params.id, auth.userId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('[v0] GET /api/agents/[id] error:', error);
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
    const agent = await updateAgent(params.id, auth.userId, body);

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('[v0] PUT /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    await deleteAgent(params.id, auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] DELETE /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
