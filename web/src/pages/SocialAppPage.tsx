/**
 * Production social — X-style shell wired to live Supabase social_messages feed.
 * Canonical social surface; chrome owned by XSocialApp (oxs-shell).
 */
import { lazy, Suspense } from "react";
import { PlatformThemeButton } from "@/components/theme/PlatformThemeButton";
import "@/components/social-x/x-social.css";

const XSocialApp = lazy(() => import("@/components/social-x/XSocialApp"));

export default function SocialAppPage() {
  return (
    <div className="ox-platform-surface relative h-[100dvh] overflow-hidden bg-transparent text-white">
      <div className="pointer-events-none absolute right-3 top-[max(0.65rem,env(safe-area-inset-top))] z-40 hidden sm:block">
        <div className="pointer-events-auto">
          <PlatformThemeButton compact />
        </div>
      </div>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm font-medium text-white/70">
            Loading social…
          </div>
        }
      >
        <XSocialApp />
      </Suspense>
    </div>
  );
}
