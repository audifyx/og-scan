import { Loader2 } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminPassGate } from "@/components/AdminPassGate";
import type { ReactNode } from "react";

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Wraps any route that requires admin access.
 * Access = the admin passcode (works without a wallet or login — same
 * pattern as the DEX admin) or automatically for signed-in owner emails.
 */
export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isAdmin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-og-lime" />
      </div>
    );
  }

  if (isAdmin) return <>{children}</>;
  return <AdminPassGate>{children}</AdminPassGate>;
};
