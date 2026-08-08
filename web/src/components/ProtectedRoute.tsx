import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Wraps any route that requires authentication.
 * - While auth is resolving → show a centered spinner (avoids flash-redirect).
 * - Unauthenticated → redirect to /auth, preserving the intended path in `?next=`.
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
    return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <>{children}</>;
};
