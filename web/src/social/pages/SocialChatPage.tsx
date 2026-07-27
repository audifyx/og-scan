import { lazy, Suspense } from "react";
import SocialFeatureEmbed from "./SocialFeatureEmbed";

const SocialHub = lazy(() => import("@/pages/SocialHub"));

export default function SocialChatPage() {
  return (
    <SocialFeatureEmbed title="Channels" subtitle="Discord-style community channels and voice." wide>
      <Suspense fallback={<div className="oxs-panel oxs-muted">Loading channels…</div>}>
        <SocialHub />
      </Suspense>
    </SocialFeatureEmbed>
  );
}
