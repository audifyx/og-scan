/**
 * POST /api/agents/[id]/execute - Execute MCP command
 * Handles: trade, mint_nft, launch_token, post_social, query_token_data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/api/lib/agents';
import { requireApiKey } from '@/api/lib/auth';
import { executeCommand, McpPayload } from '@/api/lib/mcp-executor';

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

    // Verify agent exists and belongs to user
    const agent = await getAgent(params.id, auth.userId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (!agent.walletAddress || !agent.phantomConnected) {
      return NextResponse.json({
        error: 'Agent wallet not connected. Please connect Phantom wallet first.',
      }, { status: 400 });
    }

    const body = await req.json();
    const command = body as McpPayload;

    if (!command || !command.type) {
      return NextResponse.json(
        { error: 'Invalid command. Must include "type" field.' },
        { status: 400 }
      );
    }

    // Execute the command
    const result = await executeCommand(params.id, agent.walletAddress, command);

    if (!result.success) {
      return NextResponse.json({
        error: result.error,
        activityId: result.activityId,
        executionTimeMs: result.executionTimeMs,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      activityId: result.activityId,
      tradeId: result.tradeId,
      txHash: result.txHash,
      tokenMint: result.tokenMint,
      postUrl: result.postUrl,
      data: result.data,
      executionTimeMs: result.executionTimeMs,
    }, { status: 200 });
  } catch (error) {
    console.error('[v0] POST /api/agents/[id]/execute error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
