import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Wraps any route that requires authentication.
 * - While auth is resolving → show a centered spinner (avoids flash-redirect).
 * - Unauthenticated → 404-style page with a prominent "Log in with X" button
 *   (deep-links /auth?next=<path>). No silent redirects.
 * - Authenticated → render children normally.
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{
          background:
            "radial-gradient(700px 360px at 50% -10%, rgba(94,234,212,.14), transparent 55%), #0b0d12",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
        }}
      >
        <Loader2 className="h-7 w-7 animate-spin text-teal-300" />
        <p className="text-[13px] font-medium tracking-wide text-white/55">Opening OrbitX…</p>
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3 px-8 text-center"
        style={{
          background:
            "radial-gradient(700px 360px at 50% -10%, rgba(94,234,212,.14), transparent 55%), #0b0d12",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
        }}
      >
        <p className="text-[64px] font-extrabold tracking-tight text-white">404</p>
        <p className="text-[17px] font-bold text-white/85">This page doesn't exist or requires login</p>
        <p className="max-w-xs text-[13px] leading-relaxed text-white/45">
          Sign in with X to access this page.
        </p>
        <a
          href={`/auth?next=${next}`}
          className="mt-4 rounded-full bg-white px-8 py-3 text-[15px] font-extrabold text-black transition hover:bg-white/85"
        >
          Log in with X
        </a>
        <a href="/" className="mt-1 text-[13px] font-bold text-white/50 hover:text-white/80 hover:underline">
          Back to home
        </a>
      </div>
    );
  }

  return <>{children}</>;
};
