import { Navigate, useLocation } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import type { ReactNode } from "react";
import { isPreview } from "@/lib/preview";

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Wraps any route that requires owner/admin access.
 * - Unauthenticated → redirect to /auth
 * - Authenticated but not admin → hard "Access Denied" block
 * - Admin → render children
 *
 * Use this instead of ProtectedRoute for any admin/owner-only pages.
 */
export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const location = useLocation();

  if (isPreview()) return <>{children}</>;

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-og-lime" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#020915] flex flex-col items-center justify-center gap-4 text-white">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Shield className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="text-white/50 text-sm text-center max-w-xs">
          This page is restricted to platform administrators only.
        </p>
        <a
          href="/"
          className="mt-2 px-5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-sm font-medium transition-colors border border-white/[0.08]"
        >
          Go Home
        </a>
      </div>
    );
  }

  return <>{children}</>;
};
