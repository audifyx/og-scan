import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { ReactNode } from "react";
import { isPreview } from "@/lib/preview";

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

  if (isPreview()) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-og-lime" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <>{children}</>;
};
