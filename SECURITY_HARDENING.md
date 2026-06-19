/**
 * COMPLETE SECURITY HARDENING MIGRATION GUIDE
 * 
 * FROM: localStorage-based auth (XSS-vulnerable)
 * TO: httpOnly cookies + server-side verification (XSS-safe, CSRF-safe)
 * 
 * This document covers:
 *  1. Migration steps
 *  2. Verification checklist
 *  3. DevTools debugging
 *  4. RLS policy setup
 *  5. Testing procedures
 */

// ============================================================================
// PART 1: SETUP (Do this once)
// ============================================================================

/**
 * STEP 1.1: Install dependencies
 * 
 * npm install @upstash/ratelimit @upstash/redis
 */

/**
 * STEP 1.2: Add environment variables to .env.local
 * 
 * # Supabase
 * VITE_SUPABASE_URL=https://xxxxx.supabase.co
 * VITE_SUPABASE_ANON_KEY=eyJxxxxx...
 * SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx...  (server-side only!)
 * 
 * # Upstash Redis (for rate limiting)
 * UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
 * UPSTASH_REDIS_REST_TOKEN=xxxxx
 */

/**
 * STEP 1.3: Update Supabase Auth settings
 * 
 * Dashboard → Auth → Policies
 * 
 * Enable:
 *  ✓ "Require strong password"
 *  ✓ "Disallow compromised passwords"
 *  ✓ "Confirm signup" (email verification required)
 * 
 * SMTP Configuration:
 *  ✓ Set up custom SMTP or use Supabase built-in
 *  ✓ Customize email templates (include {{ .ConfirmationURL }})
 *  ✓ Set VITE_SUPABASE_VERIFY_REDIRECT=https://yourapp.com/verify-email
 */

/**
 * STEP 1.4: Create RLS policies in Supabase
 * 
 * Go to: Database → Policies (or SQL Editor)
 * 
 * Run the following SQL:
 */

const RLS_POLICIES_SQL = `
-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Read: Users can read own profile
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Write: Users can update own profile (verified email only)
CREATE POLICY "Users can update own profile (verified)"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (auth.jwt() ->> 'email_confirmed_at') IS NOT NULL
);

-- Delete: Only admins can delete profiles
CREATE POLICY "Only admins can delete profiles"
ON public.profiles
FOR DELETE
USING (
  (auth.jwt() ->> 'app_metadata' ->> 'role') = 'admin'
);

-- Similar policies for other sensitive tables (posts, submissions, etc.)
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read posts"
ON public.posts
FOR SELECT
USING (true); -- Posts are public

CREATE POLICY "Users can create posts (verified)"
ON public.posts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (auth.jwt() ->> 'email_confirmed_at') IS NOT NULL
);

CREATE POLICY "Users can update own posts"
ON public.posts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
ON public.posts
FOR DELETE
USING (auth.uid() = user_id);
`;

// ============================================================================
// PART 2: MIGRATION CHECKLIST
// ============================================================================

const MIGRATION_STEPS = [
  {
    step: 1,
    title: "Replace old supabase.ts with new supabase-ssr.ts",
    details: [
      "Delete web/src/lib/supabase.ts",
      "Rename web/src/lib/supabase-ssr.ts to web/src/lib/supabase.ts",
      "Update imports across codebase:",
      "  Old: import { supabase } from '@/lib/supabase'",
      "  New: import { supabase } from '@/lib/supabase-ssr'",
    ],
  },
  {
    step: 2,
    title: "Update auth flow components",
    details: [
      "Replace old LoginPage with SecureSignupForm + SecureLoginForm",
      "Add EmailVerification component to route protection",
      "Update auth context to use new SSR client",
    ],
  },
  {
    step: 3,
    title: "Create protected API routes",
    details: [
      "Create /api/auth/signup.ts (with rate limiting)",
      "Create /api/auth/login.ts (with rate limiting)",
      "Create /api/auth/password-reset.ts (with rate limiting)",
      "Create /api/protected/*.ts for sensitive operations",
    ],
  },
  {
    step: 4,
    title: "Add RLS policies to database",
    details: [
      "Run SQL policies in Supabase SQL Editor",
      "Test that unverified users can't write",
      "Test that users can only see their own data",
    ],
  },
  {
    step: 5,
    title: "Test in browser DevTools",
    details: [
      "Open DevTools → Application → Cookies",
      "Verify you see httpOnly, Secure, SameSite=Lax cookies",
      "Verify localStorage is empty (or only has non-auth data)",
      "Try to read token in console: should fail",
    ],
  },
];

// ============================================================================
// PART 3: VERIFICATION CHECKLIST
// ============================================================================

const VERIFICATION_CHECKLIST = [
  {
    category: "LocalStorage",
    checks: [
      {
        name: "No auth tokens in localStorage",
        test: `
          Open DevTools Console:
          > localStorage.getItem('sol-tools-auth')
          null  ✓
        `,
      },
      {
        name: "No Supabase session in localStorage",
        test: `
          > localStorage.getItem('sb-xxxxx-auth-token')
          null  ✓
        `,
      },
    ],
  },
  {
    category: "Cookies",
    checks: [
      {
        name: "Auth cookies are httpOnly",
        test: `
          Open DevTools → Application → Cookies
          Look for cookie name like: sb-xxxxx-auth-token
          Check Properties:
            - "HttpOnly" = ✓ (checked)
            - "Secure" = ✓ (checked)
            - "SameSite" = Lax ✓
        `,
      },
      {
        name: "Cannot read httpOnly cookie from JS",
        test: `
          > document.cookie
          (empty or doesn't contain auth token)  ✓
        `,
      },
    ],
  },
  {
    category: "Password Strength",
    checks: [
      {
        name: "12-character minimum enforced",
        test: `
          Try signing up with password: "short123"
          Expected: Error "Password must be at least 12 characters"  ✓
        `,
      },
      {
        name: "Common passwords rejected",
        test: `
          Try: "password123456" (12 chars but common)
          Expected: Error "Password contains a common pattern"  ✓
        `,
      },
      {
        name: "Breached passwords rejected",
        test: `
          Try: "DontUse123456!@#" (known breach)
          Expected: Error "This password has been found in known data breaches"  ✓
        `,
      },
    ],
  },
  {
    category: "Email Verification",
    checks: [
      {
        name: "Unverified users see warning",
        test: `
          Sign up with a password
          You should see: "Please verify your email"
          Can't see dashboard yet  ✓
        `,
      },
      {
        name: "Can't write data without verification",
        test: `
          Try creating a post without verifying email
          Server returns: 403 "Email not verified"  ✓
        `,
      },
      {
        name: "Verification email sent",
        test: `
          Check email inbox (or spam)
          You should see verification link  ✓
        `,
      },
      {
        name: "Can write after verification",
        test: `
          Click verification link
          Now can create posts/profiles  ✓
        `,
      },
    ],
  },
  {
    category: "Rate Limiting",
    checks: [
      {
        name: "Login rate limit (5 per 15 min)",
        test: `
          Try logging in with wrong password 6 times
          6th attempt: 429 "Too many login attempts"  ✓
        `,
      },
      {
        name: "Signup rate limit (3 per hour)",
        test: `
          Try signing up 4 times with different emails
          4th attempt: 429 "Too many signup attempts"  ✓
        `,
      },
      {
        name: "Password reset rate limit (3 per hour)",
        test: `
          Try resetting password 4 times
          4th attempt: 429 "Too many reset attempts"  ✓
        `,
      },
    ],
  },
  {
    category: "Server-Side Auth",
    checks: [
      {
        name: "Invalid JWT rejected",
        test: `
          curl -X GET https://yourapp.com/api/protected/my-profile \\
            -H "Authorization: Bearer INVALID_TOKEN"
          Expected: 401 Unauthorized  ✓
        `,
      },
      {
        name: "Missing auth rejected",
        test: `
          curl -X GET https://yourapp.com/api/protected/my-profile
          Expected: 401 Unauthorized  ✓
        `,
      },
      {
        name: "RLS prevents cross-user reads",
        test: `
          As user A, try reading user B's profile:
          curl -X GET .../api/protected/get-profile?id=USER_B_ID
          Expected: 403 Forbidden or 404 Not Found  ✓
        `,
      },
    ],
  },
];

// ============================================================================
// PART 4: HOW TO TEST EVERYTHING
// ============================================================================

const TESTING_PROCEDURES = {
  manual: {
    title: "Manual Testing",
    steps: [
      {
        step: 1,
        title: "Test signup flow",
        actions: [
          "Go to /signup",
          "Enter email: test@example.com",
          "Enter weak password: '123456'",
          "See error: 'Password must be at least 12 characters'",
          "Enter strong password: 'MySecure123!@#'",
          "See success: 'Verification email sent'",
        ],
      },
      {
        step: 2,
        title: "Test rate limiting",
        actions: [
          "Try signing up with same email 4 times quickly",
          "4th attempt: 'Too many signup attempts'",
          "Wait 1 minute, try again",
          "Should work again after cooldown",
        ],
      },
      {
        step: 3,
        title: "Test email verification gate",
        actions: [
          "Sign up with new email",
          "Don't verify email yet",
          "Try to create a post",
          "See error: 'Please verify your email'",
          "Click verification link in email",
          "Now can create posts",
        ],
      },
      {
        step: 4,
        title: "Test httpOnly cookies",
        actions: [
          "Open DevTools → Console",
          "Run: localStorage.getItem('sol-tools-auth')",
          "Should return: null",
          "Open DevTools → Application → Cookies",
          "Look for: sb-[project-id]-auth-token",
          "Check: httpOnly ✓, Secure ✓, SameSite=Lax",
        ],
      },
    ],
  },
  
  automated: {
    title: "Automated Testing (with Jest/Vitest)",
    examples: [
      {
        test: "Password validation",
        code: `
          import { validatePassword } from '@/lib/password-validation';
          
          test('rejects weak passwords', async () => {
            const result = await validatePassword('weak123');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('12 characters');
          });
          
          test('rejects common passwords', async () => {
            const result = await validatePassword('password123456');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('common pattern');
          });
          
          test('rejects breached passwords', async () => {
            const result = await validatePassword('DontUse123456!@#');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('data breaches');
          });
        `,
      },
      {
        test: "Rate limiting",
        code: `
          import { rateLimiters } from '@/api/rate-limit';
          
          test('rate limits signup attempts', async () => {
            const email = 'test@example.com';
            const ip = '192.168.1.1';
            
            // First 3 should succeed
            expect(await rateLimiters.signup(email, ip)).toBe(false);
            expect(await rateLimiters.signup(email, ip)).toBe(false);
            expect(await rateLimiters.signup(email, ip)).toBe(false);
            
            // 4th should be rate limited
            expect(await rateLimiters.signup(email, ip)).toBe(true);
          });
        `,
      },
      {
        test: "Email verification gate",
        code: `
          test('blocks writes from unverified users', async () => {
            const unverifiedUser = { id: 'xxx', email_confirmed_at: null };
            const result = await requireVerifiedEmail({ ... });
            
            expect(result).toBeNull(); // Verification failed
          });
          
          test('allows writes from verified users', async () => {
            const verifiedUser = { 
              id: 'xxx', 
              email_confirmed_at: new Date() 
            };
            const result = await requireVerifiedEmail({ ... });
            
            expect(result).toBe(verifiedUser); // Allowed
          });
        `,
      },
    ],
  },
};

// ============================================================================
// PART 5: ROLLBACK PLAN (If something breaks)
// ============================================================================

const ROLLBACK_PLAN = [
  {
    issue: "Users can't log in after migration",
    cause: "Cookies not being set correctly",
    solution: [
      "Check Supabase URL and anon key in .env",
      "Clear browser cookies (DevTools → Application → Clear all)",
      "Restart dev server",
      "Test login again",
    ],
  },
  {
    issue: "RLS policies too restrictive",
    cause: "Policies blocking legitimate access",
    solution: [
      "Temporarily disable RLS: ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;",
      "Test to isolate which policy is wrong",
      "Adjust policy and re-enable RLS",
    ],
  },
  {
    issue: "Rate limiter is rejecting legitimate users",
    cause: "Windows too tight or Upstash misconfigured",
    solution: [
      "Check UPSTASH_REDIS_REST_URL and token",
      "Test Upstash connection: curl $UPSTASH_REDIS_REST_URL",
      "Temporarily increase window sizes for testing",
      "Fine-tune once working",
    ],
  },
];

// ============================================================================
// SUMMARY
// ============================================================================

const SECURITY_SUMMARY = {
  before: {
    auth: "localStorage-based (JWT visible in localStorage)",
    xss_risk: "HIGH (token readable from window.localStorage)",
    csrf_risk: "MEDIUM (no SameSite cookies)",
    auth_check: "Browser only (client-side JWT claim)",
    email_verification: "Not enforced",
    password_strength: "Weak (no length check, no breach check)",
    rate_limiting: "None",
  },

  after: {
    auth: "httpOnly cookies (browser can't read token)",
    xss_risk: "LOW (token in secure httpOnly cookie)",
    csrf_risk: "LOW (SameSite=Lax prevents CSRF)",
    auth_check: "Server-side verification on every request",
    email_verification: "REQUIRED (blocks writes until verified)",
    password_strength: "STRONG (12+ chars, HIBP check, entropy)",
    rate_limiting: "Enabled (5 login / 3 signup per window)",
  },
};

export {
  RLS_POLICIES_SQL,
  MIGRATION_STEPS,
  VERIFICATION_CHECKLIST,
  TESTING_PROCEDURES,
  ROLLBACK_PLAN,
  SECURITY_SUMMARY,
};
