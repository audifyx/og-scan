import { Loader2 } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminPassGate } from "@/components/AdminPassGate";
import NotFound from "@/pages/NotFound";
import { useAuth } from "@/hooks/useAuth";
import type { ReactNode } from "react";

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Hidden owner desk gate.
 * Non-owners get a normal 404 — never reveal the owner email or wallet list.
 * Owner (email or allowlisted wallet) still enters the code, then the desk.
 * Not a substitute for server ADMIN_PASS / JWT on APIs.
 */
export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isAdmin, isOwnerIdentity, loading } = useAdmin();
  const { loading: authLoading } = useAuth();

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (!isOwnerIdentity) {
    return <NotFound />;
  }

  if (!isAdmin) {
    return <AdminPassGate>{children}</AdminPassGate>;
  }

  return <>{children}</>;
};
