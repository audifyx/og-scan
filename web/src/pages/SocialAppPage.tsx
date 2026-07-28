/**
 * Production social — X-style shell wired to live Supabase social_messages feed.
 * This is the canonical social surface (not the /hq demo store).
 */
import { lazy, Suspense } from "react";

const XSocialApp = lazy(() => import("@/components/social-x/XSocialApp"));

export default function SocialAppPage() {
  return (
    <div className="h-[100dvh] overflow-hidden bg-black text-white">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-white/40">
            Loading social…
          </div>
        }
      >
        <XSocialApp />
      </Suspense>
    </div>
  );
}
