import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getXOAuthUrl } from '@/api/lib/x-integration';
import { getUserFromSession } from '@/api/lib/auth';

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE() {
  const codeVerifier = crypto
    .randomBytes(32)
    .toString('base64url')
    .slice(0, 128);

  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
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

    // Generate PKCE
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Get OAuth URL
    const authUrl = getXOAuthUrl(state, codeChallenge);

    // Store code verifier and state in cookies (httpOnly)
    const response = NextResponse.json({
      authUrl,
    });

    response.cookies.set('x_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    response.cookies.set('x_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('[v0] X auth route error:', error);
    return NextResponse.json(
      { error: `Failed to initiate X authentication: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
