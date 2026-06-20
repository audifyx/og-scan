/**
 * SECURITY HARDENING — QUICK REFERENCE
 * 
 * This app now has enterprise-grade auth security. Here's what changed:
 */

// ============================================================================
// 1. HTTPONLYCOOKIE AUTH (from localStorage)
// ============================================================================

/*
BEFORE (VULNERABLE):
  - Auth token stored in localStorage
  - Any XSS attack can steal: localStorage.getItem('sol-tools-auth')
  - Token sent in every API call (JavaScript sends Authorization header)

AFTER (SECURE):
  - Auth token stored in httpOnly cookie
  - JavaScript CANNOT read the token (not in localStorage, not in document.cookie)
  - Browser automatically sends cookie with every request
  - XSS attack can't steal the token

VERIFICATION:
  1. Open DevTools → Console
  2. Type: localStorage.getItem('sol-tools-auth')
  3. Should return: null
  
  4. Open DevTools → Application → Cookies
  5. Look for: sb-[project-id]-auth-token
  6. Check: HttpOnly ✓, Secure ✓, SameSite=Lax ✓
*/

// ============================================================================
// 2. SERVER-SIDE AUTH VERIFICATION
// ============================================================================

/*
BEFORE:
  - Trusted browser's JWT claim (could be forged)
  - API routes didn't verify token signature
  - User could manipulate JWT in browser and claim different user ID

AFTER:
  - Every API route verifies JWT signature with Supabase
  - Server checks user.id matches token.sub
  - Server checks user.email_confirmed_at for writes
  - RLS policies double-check at database layer

USAGE:
  import { requireAuth, requireVerifiedEmail } from '@/api/auth-middleware';
  
  export default async function handler(req, res) {
    const user = await requireAuth(req);      // ← verified server-side
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    const verifiedUser = await requireVerifiedEmail(req);
    if (!verifiedUser) return res.status(403).json({ error: "Verify email first" });
  }
*/

// ============================================================================
// 3. EMAIL VERIFICATION (REQUIRED)
// ============================================================================

/*
BEFORE:
  - Users could sign up and immediately write data
  - No email verification step

AFTER:
  - Users sign up → receive verification email
  - User clicks link in email
  - Only THEN can they write data
  - Server-side gate: middleware checks email_confirmed_at
  - Database-side gate: RLS policy checks email_confirmed_at

VERIFICATION FLOW:
  1. User: POST /signup (email, password)
  2. Server: Create account, send verification email
  3. User: Click link in email
  4. Supabase: Set email_confirmed_at
  5. User: Now can write data

GUARD IN API ROUTE:
  const verifiedUser = await requireVerifiedEmail(req);
  if (!verifiedUser) return res.status(403).json({ error: "Verify email" });
*/

// ============================================================================
// 4. STRONG PASSWORD ENFORCEMENT
// ============================================================================

/*
RULES:
  ✓ Minimum 12 characters (NIST 800-63B standard)
  ✓ No common patterns (password, qwerty, 123456, etc.)
  ✓ Check against HaveIBeenPwned (leaked password database)
  ✓ Real-time feedback: Shows password strength + suggestions

EXAMPLE:
  User types: "weak123"
  Error: "Password must be at least 12 characters"
  
  User types: "password123456"
  Error: "Password contains a common pattern (password)"
  
  User types: "DontUse123456!@#"
  Error: "This password has been found in known data breaches"
  
  User types: "MySecurePass123!@#"
  Success: ✓ Strong password!

HOW HIBP CHECK WORKS:
  1. Client takes SHA1(password)
  2. Sends only first 5 chars to HIBP API
  3. HIBP returns all hashes with that prefix
  4. Client checks if full hash is in the list
  5. Your password is NEVER sent to HIBP unencrypted
  
USAGE:
  import { validatePassword } from '@/lib/password-validation';
  
  const result = await validatePassword(userPassword);
  if (!result.valid) {
    // Show: result.error
  }
*/

// ============================================================================
// 5. RATE LIMITING
// ============================================================================

/*
LIMITS:
  - Login:     5 attempts per 15 minutes (per IP + email)
  - Signup:    3 attempts per hour (per IP + email)
  - Password Reset: 3 attempts per hour (per IP + email)
  - API calls: 100 per minute (per user)

BACKEND:
  Using Upstash Redis (distributed rate limiting)
  Survives server restarts
  Works across multiple instances

USAGE:
  import { rateLimiters } from '@/api/rate-limit';
  
  const isLimited = await rateLimiters.login(email, ip);
  if (isLimited) {
    return res.status(429).json({
      error: "Too many login attempts. Try again in 15 minutes.",
      retryAfter: 900,
    });
  }

TESTING:
  1. Try logging in with wrong password 5 times
  2. 6th attempt: 429 "Too many login attempts"
  3. Wait 15 minutes (or use admin reset in Redis)
  4. Try again: Should work
*/

// ============================================================================
// 6. ROW-LEVEL SECURITY (RLS) POLICIES
// ============================================================================

/*
DATABASE-LEVEL ACCESS CONTROL
  Even if API is exploited, database enforces access control

EXAMPLE POLICIES:
  - Users can read own profile:
    CREATE POLICY "read_own" ON profiles
    FOR SELECT USING (auth.uid() = id);
  
  - Users can update own profile (verified email only):
    CREATE POLICY "update_own_verified" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND email_confirmed_at IS NOT NULL);
  
  - Admins can delete any profile:
    CREATE POLICY "admin_delete" ON profiles
    FOR DELETE USING (auth.jwt() ->> 'app_metadata' ->> 'role' = 'admin');

DEFENSE IN DEPTH:
  Layer 1: API route checks (requireAuth, requireVerifiedEmail)
  Layer 2: RLS policy at database (RETURNING NULL if not allowed)
  Both must pass for data to be returned
*/

// ============================================================================
// 7. DEPLOYMENT CHECKLIST
// ============================================================================

const DEPLOYMENT_CHECKLIST = [
  { step: 1, task: "Set environment variables in Vercel" },
  { step: 2, task: "Create Upstash Redis database + get URL + token" },
  { step: 3, task: "Enable email verification in Supabase Auth" },
  { step: 4, task: "Set up SMTP (Supabase email or custom)" },
  { step: 5, task: "Create RLS policies in Supabase database" },
  { step: 6, task: "Test signup → email verification → write data flow" },
  { step: 7, task: "Test rate limiting (try 6 login attempts)" },
  { step: 8, task: "Verify httpOnly cookies (DevTools → Cookies)" },
  { step: 9, task: "Test that unverified users can't write" },
  { step: 10, task: "Deploy!" },
];

// ============================================================================
// 8. TROUBLESHOOTING
// ============================================================================

const TROUBLESHOOTING = {
  "Users can't sign up": {
    check1: "Is Supabase SMTP configured? (Auth → Email Templates)",
    check2: "Is VITE_SUPABASE_ANON_KEY set in Vercel env?",
    check3: "Is Upstash rate limiting rejecting? Check UPSTASH_REDIS_REST_URL",
  },

  "Password validation not working": {
    check1: "Did you import from @/lib/password-validation.ts?",
    check2: "Is HaveIBeenPwned API accessible? (check network tab)",
    check3: "Is password validation running client-side? (not on server)",
  },

  "Users still can't write after email verification": {
    check1: "Did you enable RLS on the table?",
    check2: "Does RLS policy check email_confirmed_at?",
    check3: "Is user's email_confirmed_at actually set? (check DB)",
  },

  "httpOnly cookies not appearing": {
    check1: "Is VITE_SUPABASE_URL HTTPS only?",
    check2: "Is CookieAuthStorageAdapter imported?",
    check3: "Check Network tab → login request → Response Headers (Set-Cookie)",
  },
};

// ============================================================================
// 9. TESTING COMMANDS
// ============================================================================

const TESTING_COMMANDS = {
  "Check rate limiting": `
    curl -X POST https://yourapp.com/api/auth/login \\
      -H "Content-Type: application/json" \\
      -d '{"email":"test@example.com","password":"wrong"}' \\
      -v
    (Do this 6 times, 6th should return 429)
  `,

  "Check server-side auth": `
    curl -X GET https://yourapp.com/api/protected/my-profile \\
      -H "Authorization: Bearer INVALID_TOKEN"
    (Should return 401)
  `,

  "Check RLS policy": `
    As user A, try to read user B's profile via Supabase client:
    > const { data } = await supabase
        .from('profiles')
        .select()
        .eq('id', USER_B_ID);
    (Should return empty or null due to RLS)
  `,

  "Check password validation": `
    Try POST /api/auth/signup with password: "short123"
    Expected: 400 "Password must be at least 12 characters"
  `,
};

// ============================================================================
// 10. SECURITY SUMMARY
// ============================================================================

const SECURITY_SUMMARY = `
BEFORE MIGRATION:
  ❌ Auth tokens in localStorage (XSS = game over)
  ❌ No server-side auth verification
  ❌ Unverified users can write data
  ❌ No password strength requirements
  ❌ No rate limiting (brute force attacks)

AFTER MIGRATION:
  ✅ Auth tokens in httpOnly cookies (XSS safe)
  ✅ Server-side JWT verification on every request
  ✅ Email verification REQUIRED before writes
  ✅ Strong password enforcement + HIBP check
  ✅ Rate limiting on auth endpoints
  ✅ RLS policies for defense-in-depth
  
OWASP TOP 10 COVERAGE:
  ✅ A01: Broken Access Control (server-side auth)
  ✅ A02: Cryptographic Failures (HTTPS only, secure cookies)
  ✅ A04: Insecure Design (email verification, rate limiting)
  ✅ A06: Vulnerable Components (password strength)
  ✅ A07: Identification & Authentication Failures (email verification)
`;

export {
  DEPLOYMENT_CHECKLIST,
  TROUBLESHOOTING,
  TESTING_COMMANDS,
  SECURITY_SUMMARY,
};
