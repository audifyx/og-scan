import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED = ['/app', '/settings']
const AUTH_PAGES = ['/auth']

// ── Maintenance flag (cached to avoid a DB read on every request) ──
let maintCache = { value: false, at: 0 }
const MAINT_TTL = 10_000 // 10s propagation

async function isMaintenance(): Promise<boolean> {
  const now = Date.now()
  if (now - maintCache.at < MAINT_TTL) return maintCache.value
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/site_settings?select=maintenance&id=eq.1`
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' })
    const rows = await r.json()
    maintCache = { value: !!rows?.[0]?.maintenance, at: now }
  } catch {
    // on failure, keep last known value (fail-open to avoid locking the site by accident)
  }
  return maintCache.value
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Maintenance mode: block the whole site except the admin panel ──
  // Allow: /admin (so you can toggle it off), the /maintenance page itself,
  // and any static asset path (has a file extension).
  if (!pathname.startsWith('/admin') && pathname !== '/maintenance' && !/\.[a-zA-Z0-9]+$/.test(pathname)) {
    if (await isMaintenance()) {
      const url = request.nextUrl.clone()
      url.pathname = '/maintenance'
      url.search = ''
      return NextResponse.rewrite(url)
    }
  }

  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Admin has its own password gate, skip Supabase auth check
  if (pathname.startsWith('/admin')) return response

  // Bet detail pages are public (shareable); placing a bet still needs auth
  if (pathname.startsWith('/app/bet/')) return response

  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isAuthPage = AUTH_PAGES.some(p => pathname.startsWith(p))

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/auth?redirect=' + pathname, request.url))
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
