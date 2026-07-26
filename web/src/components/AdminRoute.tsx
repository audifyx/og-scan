import { Loader2 } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminPassGate } from "@/components/AdminPassGate";
import { OWNER_EMAIL } from "@/lib/ownerDesk";
import { useAuth } from "@/hooks/useAuth";
import type { ReactNode } from "react";

interface AdminRouteProps {
  children: ReactNode;
}

/**
 * Hidden owner desk gate:
 * 1) Manual code unlock (session)
 * 2) Signed in as OWNER_EMAIL
 *
 * Not a substitute for server ADMIN_PASS / JWT on APIs.
 */
export const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isAdmin, deskUnlocked, loading } = useAdmin();
  const { user, loading: authLoading } = useAuth();

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#020915] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (!deskUnlocked) {
    return <AdminPassGate>{children}</AdminPassGate>;
  }

  if (isAdmin) return <>{children}</>;

  const email = (user?.email || "").toLowerCase();
  return (
    <div className="min-h-screen bg-[#020915] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <h1 className="mb-2 text-lg font-bold text-white">Unavailable</h1>
        <p className="text-sm text-white/45">
          {email
            ? "This surface is limited to the owner account."
            : `Sign in as ${OWNER_EMAIL}, then reopen this page.`}
        </p>
      </div>
    </div>
  );
};
