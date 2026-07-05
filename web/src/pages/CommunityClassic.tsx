/**
 * CommunityClassic — the original Discord-style CommunityHub, unchanged,
 * available as a standalone page. The community section now defaults to the
 * X-style shell at /community; this route keeps the classic layout reachable
 * for anyone who prefers it (or as a fallback).
 */
import { lazy, Suspense } from "react";
import { SocialTopBar } from "@/components/layout/SocialTopBar";

const CommunityHub = lazy(() => import("./CommunityHub"));

export default function CommunityClassic() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <SocialTopBar />
      <main className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<div className="flex h-48 items-center justify-center text-sm text-white/30">Loading Community...</div>}>
          <CommunityHub />
        </Suspense>
      </main>
    </div>
  );
}
