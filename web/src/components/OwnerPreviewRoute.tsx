import { Loader2 } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/NotFound";
import type { ReactNode } from "react";

/**
 * Unfinished / internal product surfaces.
 * Signed-in owner email can open them. Everyone else gets a normal 404.
 */
export function OwnerPreviewRoute({ children }: { children: ReactNode }) {
  const { isOwnerIdentity, loading } = useAdmin();
  const { loading: authLoading } = useAuth();

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020915]">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (!isOwnerIdentity) return <NotFound />;
  return <>{children}</>;
}
