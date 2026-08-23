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
 * Anyone not signed in with the owner email account gets a normal 404.
 * Wallet connect is not admin. Never reveal the owner email or PIN.
 * Owner still enters the Vercel-locked code, then the desk.
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
