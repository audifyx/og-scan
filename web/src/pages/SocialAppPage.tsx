/**
 * Production social — OrbitX metal shell wired to live Supabase social_messages feed.
 * Canonical social surface for /orbitx-social and /hq redirects.
 */
import { lazy, Suspense } from "react";
import "@/components/social-x/orbitx-social.css";

const XSocialApp = lazy(() => import("@/components/social-x/XSocialApp"));

export default function SocialAppPage() {
  return (
    <div className="ox-social h-[100dvh] overflow-hidden bg-[#050505] text-white">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            Loading OrbitX Social…
          </div>
        }
      >
        <XSocialApp />
      </Suspense>
    </div>
  );
}
