import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeXCode, storeXConnection } from '@/api/lib/x-integration';
import { getUserFromSession } from '@/api/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/agent?error=X authentication failed: ${error}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/agent?error=No authorization code received', request.url)
      );
    }

    // Get user from session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (!sessionToken) {
      return NextResponse.redirect(
        new URL('/agent?error=Session expired, please login again', request.url)
      );
    }

    const user = await getUserFromSession(sessionToken);
    if (!user) {
      return NextResponse.redirect(
        new URL('/agent?error=Invalid session', request.url)
      );
    }

    // Get code verifier from session storage (stored in cookie during auth initiation)
    const codeVerifier = cookieStore.get('x_code_verifier')?.value;
    if (!codeVerifier) {
      return NextResponse.redirect(
        new URL('/agent?error=Code verifier not found', request.url)
      );
    }

    // Exchange code for tokens
    const credentials = await exchangeXCode(code, codeVerifier);

    // Store connection in database
    const connection = await storeXConnection(user.id, credentials);

    // Clear the code verifier cookie
    const response = NextResponse.redirect(
      new URL('/agent?success=X connected successfully', request.url)
    );
    response.cookies.delete('x_code_verifier');

    return response;
  } catch (error) {
    console.error('[v0] X callback error:', error);
    return NextResponse.redirect(
      new URL(
        `/agent?error=Failed to connect X: ${error instanceof Error ? error.message : 'Unknown error'}`,
        request.url
      )
    );
  }
}
