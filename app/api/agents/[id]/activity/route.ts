/**
 * GET /api/agents/[id]/activity - Get agent activity history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/api/lib/agents';
import { getAgentActivity, getAgentTrades } from '@/api/lib/activity';
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

    // Verify agent exists and belongs to user
    const agent = await getAgent(params.id, auth.userId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const type = url.searchParams.get('type'); // Optional filter: 'trade', 'nft', 'token_launch', 'social', 'query'

    const activities = await getAgentActivity(params.id, limit, offset);

    // Filter by type if specified
    const filtered = type
      ? activities.filter((a) => a.activityType === type)
      : activities;

    return NextResponse.json({
      activities: filtered,
      total: filtered.length,
      hasMore: filtered.length === limit,
    });
  } catch (error) {
    console.error('[v0] GET /api/agents/[id]/activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
