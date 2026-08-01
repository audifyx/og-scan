/**
 * GET /api/agents/[id]/api-keys - List API keys for agent
 * POST /api/agents/[id]/api-keys - Create new API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiKeys, createApiKey, getAgent } from '@/api/lib/agents';
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

    const apiKeys = await getApiKeys(params.id, auth.userId);
    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error('[v0] GET /api/agents/[id]/api-keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
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

    // Verify agent exists
    const agent = await getAgent(params.id, auth.userId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'API key name is required' }, { status: 400 });
    }

    const apiKey = await createApiKey(params.id, auth.userId, name);
    
    // Only return the actual key once on creation
    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key, // Return this ONLY on creation
      message: 'Save this key securely. You will not be able to see it again.',
    }, { status: 201 });
  } catch (error) {
    console.error('[v0] POST /api/agents/[id]/api-keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
