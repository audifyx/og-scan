/**
 * DELETE /api/agents/[id]/api-keys/[keyId] - Revoke API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { revokeApiKey } from '@/api/lib/agents';
import { requireApiKey } from '@/api/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  try {
    const auth = await requireApiKey(req, {
      status: (code) => ({ json: (data: any) => new Response(JSON.stringify(data), { status: code }) }),
      json: (data: any) => new Response(JSON.stringify(data)),
    } as any);

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await revokeApiKey(params.keyId, auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] DELETE /api/agents/[id]/api-keys/[keyId] error:', error);
    
    if ((error as Error).message === 'API key not found') {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
