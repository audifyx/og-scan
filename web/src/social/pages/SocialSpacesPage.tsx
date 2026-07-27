import { lazy, Suspense } from "react";
import SocialFeatureEmbed from "./SocialFeatureEmbed";

const Spaces = lazy(() => import("@/pages/Spaces"));

export default function SocialSpacesPage() {
  return (
    <SocialFeatureEmbed title="Spaces" subtitle="Live audio spaces — host, listen, and discover." wide>
      <Suspense fallback={<div className="oxs-panel oxs-muted">Loading spaces…</div>}>
        <Spaces />
      </Suspense>
    </SocialFeatureEmbed>
  );
}
