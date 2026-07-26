import { lazy, Suspense } from "react";
import SocialFeatureEmbed from "./SocialFeatureEmbed";

const DirectMessages = lazy(() => import("@/pages/DirectMessages"));

export default function SocialMessagesPage() {
  return (
    <SocialFeatureEmbed title="Messages" subtitle="Private chats — Telegram-style direct messages." wide>
      <Suspense fallback={<div className="oxs-panel oxs-muted">Loading messages…</div>}>
        <DirectMessages />
      </Suspense>
    </SocialFeatureEmbed>
  );
}
