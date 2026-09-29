/**
 * SocialHub — the social module's single mount.
 *
 * Tabbed shell over every social surface: Feed (LifeInvasion), Channel 6
 * news, rooftop parties, beach bonfires, camping, comedy club, the ownable
 * nightclub, and the weekly docks car meet. The in-game phone (PhoneUi) is
 * a separate overlay — the integrator opens it from the HUD.
 *
 * The hub wires each UI to its hook ONCE so state (feed posts, nightclub,
 * car-meet entries…) is shared if the hub re-renders.
 */

import { useState } from "react";
import type { TokenDrama } from "../types";
import { useSocialFeed } from "../hooks/useSocialFeed";
import { useNews } from "../hooks/useNews";
import { FeedUi } from "./FeedUi";
import { NewsUi } from "./NewsUi";
import { PartyUi } from "./PartyUi";
import { BeachUi } from "./BeachUi";
import { CampUi } from "./CampUi";
import { ComedyUi } from "./ComedyUi";
import { NightclubUi } from "./NightclubUi";
import { CarMeetUi } from "./CarMeetUi";

export interface SocialHubProps {
  playerName: string;
  playerHandle: string;
  /** live token drama, fed by the integrator from useLivePrices */
  drama: TokenDrama[];
  /** default tab */
  initialTab?: SocialTab;
}

export type SocialTab = "feed" | "news" | "party" | "beach" | "camp" | "comedy" | "club" | "cars";

const TABS: { id: SocialTab; icon: string; label: string }[] = [
  { id: "feed", icon: "🌀", label: "Feed" },
  { id: "news", icon: "📺", label: "News" },
  { id: "party", icon: "🌃", label: "Party" },
  { id: "beach", icon: "🔥", label: "Beach" },
  { id: "camp", icon: "🏕", label: "Camp" },
  { id: "comedy", icon: "🎤", label: "Comedy" },
  { id: "club", icon: "🌙", label: "Club" },
  { id: "cars", icon: "🏁", label: "Cars" },
];

export function SocialHub({ playerName, playerHandle, drama, initialTab = "feed" }: SocialHubProps) {
  const [tab, setTab] = useState<SocialTab>(initialTab);
  const feed = useSocialFeed(drama, playerName, playerHandle);
  const news = useNews(drama);

  return (
    <div className="oxs-hub">
      <nav className="oxs-hub-tabs" aria-label="Social">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`oxs-hub-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="oxs-hub-tab-icon">{t.icon}</span>
            <span className="oxs-hub-tab-label">{t.label}</span>
            {t.id === "news" && news.unread > 0 && <span className="oxs-badge">{news.unread}</span>}
          </button>
        ))}
      </nav>
      <div className="oxs-hub-body">
        {tab === "feed" && <FeedUi feed={feed} drama={drama} />}
        {tab === "news" && <NewsUi news={news} />}
        {tab === "party" && <PartyUi />}
        {tab === "beach" && <BeachUi />}
        {tab === "camp" && <CampUi playerHandle={playerHandle} />}
        {tab === "comedy" && <ComedyUi playerName={playerName} playerHandle={playerHandle} />}
        {tab === "club" && <NightclubUi playerName={playerName} />}
        {tab === "cars" && <CarMeetUi playerName={playerName} playerHandle={playerHandle} />}
      </div>
    </div>
  );
}
