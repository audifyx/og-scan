import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getXConnection } from '@/api/lib/x-integration';
import { getUserFromSession } from '@/api/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await getUserFromSession(sessionToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const connection = await getXConnection(user.id);

    return NextResponse.json({
      connected: !!connection,
      connection: connection ? {
        id: connection.id,
        username: connection.xUsername,
        createdAt: connection.createdAt,
      } : null,
    });
  } catch (error) {
    console.error('[v0] X connection check error:', error);
    return NextResponse.json(
      { error: 'Failed to check X connection' },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect X account
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await getUserFromSession(sessionToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const { disconnectX } = await import('@/api/lib/x-integration');
    await disconnectX(user.id);

    return NextResponse.json({
      success: true,
      message: 'X account disconnected',
    });
  } catch (error) {
    console.error('[v0] X disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect X' },
      { status: 500 }
    );
  }
}
