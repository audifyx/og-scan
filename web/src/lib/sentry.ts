/**
 * Sentry error tracking initialisation.
 * Import this at the very top of main.tsx (before React renders).
 *
 * Set VITE_SENTRY_DSN in Vercel env vars (and Supabase secrets if used server-side).
 * To get your DSN: https://sentry.io → Project Settings → Client Keys (DSN)
 *
 * To verify it's working, open the browser console and run:
 *   import('/src/lib/sentry').then(s => s.testSentryError())
 * or add ?sentry_test=1 to any URL in development.
 */

import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!DSN) {
    if (import.meta.env.DEV) {
      console.info("[Sentry] VITE_SENTRY_DSN not set — error tracking disabled.");
    }
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE, // "production" | "development"
    release: import.meta.env.VITE_APP_VERSION ?? "ogscan@unknown",

    // Capture 10% of sessions for performance monitoring (adjust as needed)
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    // Attach stack traces to pure message events (non-Error exceptions)
    attachStacktrace: true,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Only capture replays on error (0% normal sessions, 100% on error)
        sessionSampleRate: 0,
        errorSampleRate: 1.0,
      }),
    ],

    // Filter noisy third-party errors that we can't fix
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
      /^Loading chunk \d+ failed/,
      /^Network Error$/,
    ],

    beforeSend(event) {
      // Strip any accidental auth tokens from breadcrumb URLs
      if (event.breadcrumbs?.values) {
        event.breadcrumbs.values = event.breadcrumbs.values.map((b) => ({
          ...b,
          data: b.data
            ? Object.fromEntries(
                Object.entries(b.data).map(([k, v]) =>
                  k.toLowerCase().includes("token") || k.toLowerCase().includes("key")
                    ? [k, "[Filtered]"]
                    : [k, v]
                )
              )
            : b.data,
        }));
      }
      return event;
    },
  });
}

/** Attach the logged-in user to all future Sentry events */
export function setSentryUser(id: string, username?: string) {
  Sentry.setUser({ id, username });
}

/** Clear user on logout */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/** Manually capture an error (use in catch blocks) */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

/**
 * Trigger a test error to verify Sentry is receiving events.
 * Run from the browser console: window.__testSentry?.()
 */
export function testSentryError() {
  throw new Error("[OGScan] Sentry test error — if you see this in your Sentry dashboard, it's working!");
}

// Expose test helper on window in dev
if (import.meta.env.DEV) {
  (window as any).__testSentry = testSentryError;
}
