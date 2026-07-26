import { lazy, Suspense } from "react";
import SocialFeatureEmbed from "./SocialFeatureEmbed";

const CommunityRooms = lazy(() => import("@/pages/CommunityRooms"));

export default function SocialRoomsPage() {
  return (
    <SocialFeatureEmbed title="Rooms" subtitle="Group rooms for trading, gaming, and community hangouts." wide>
      <Suspense fallback={<div className="oxs-panel oxs-muted">Loading rooms…</div>}>
        <CommunityRooms />
      </Suspense>
    </SocialFeatureEmbed>
  );
}
