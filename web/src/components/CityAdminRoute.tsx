import type { ReactNode } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import NotFound from "@/pages/NotFound";

/**
 * OrbitX City is admin-only: everyone else gets the app's 404.
 * "Admin" here matches the platform catalog (owner email), so the City tab
 * and the /Orbitxcity route agree on who gets in.
 */
export function CityAdminRoute({ children }: { children: ReactNode }) {
  const { isOwnerIdentity, loading } = useAdmin();
  if (loading) return null; // auth still resolving — don't flash a 404
  if (!isOwnerIdentity) return <NotFound />;
  return <>{children}</>;
}
