import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Building2, DoorOpen, Grid2X2, MapPin, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getWorldBlock } from "@/lib/orbitxcity/worlds";
import { getVenueDefinition } from "@/lib/orbitxcity/venueRegistry";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import type { InteractionKind } from "@/lib/orbitxcity/types";
import { useCity } from "@/pages/orbitxcity/CityProvider";
import { MemeStorePanel } from "./MemeStorePanel";
import { ChatPanel } from "./ChatPanel";
import { SocialFeedPanel } from "./SocialFeedPanel";
import { VoicePanel } from "./VoicePanel";
import {
  CommunityPanel,
  GamesPanel,
  LaunchPanel,
  NftPanel,
  ProfilePanel,
  TradingPanel,
} from "./CityPanels";

function VenueWorkspace({ kind }: { kind: InteractionKind }) {
  switch (kind) {
    case "marketplace":
      return <MemeStorePanel />;
    case "trading":
    case "token":
    case "billboard":
      return <TradingPanel />;
    case "launch":
      return <LaunchPanel />;
    case "community":
      return <CommunityPanel />;
    case "voice":
      return <VoicePanel />;
    case "games":
      return <GamesPanel />;
    case "nft":
      return <NftPanel />;
    case "hq":
      return (
        <div className="oxc-stack">
          <ProfilePanel />
          <SocialFeedPanel />
          <ChatPanel />
        </div>
      );
    default:
      return null;
  }
}

export function BuildingVenueMenu() {
  const navigate = useNavigate();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<"workspace" | "services">("workspace");
  const { venueBuildingId, closeVenue, enterBuilding, selectedCityId, recoverPlayer } = useCity();

  const block = useMemo(() => getWorldBlock(selectedCityId), [selectedCityId]);
  const building = useMemo(() => {
    if (!venueBuildingId) return null;
    return block.buildings.find((item) => item.id === venueBuildingId) ?? null;
  }, [block, venueBuildingId]);
  const venue = useMemo(() => (building ? getVenueDefinition(building) : null), [building]);

  useEffect(() => {
    if (!venue) return;
    setView("workspace");
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [venueBuildingId, venue]);

  if (!building || !venue || !building.interaction) return null;

  return (
    <section className="oxc-venue" role="dialog" aria-modal="true" aria-labelledby="oxc-venue-title">
      <div className="oxc-venue-shell">
        <header className="oxc-venue-header">
          <div className="oxc-venue-mark" aria-hidden="true"><Building2 /></div>
          <div className="oxc-venue-heading">
            <span>{venue.eyebrow}</span>
            <h2 id="oxc-venue-title">{venue.title}</h2>
            <p>{venue.description}</p>
          </div>
          <button ref={closeRef} type="button" className="oxc-venue-close" onClick={closeVenue} aria-label="Close venue menu">
            <X />
          </button>
        </header>

        <div className="oxc-venue-context">
          <span><MapPin /> {block.name}</span>
          <span>Interactive venue</span>
          <span>Live OrbitX systems</span>
        </div>

        <nav className="oxc-venue-tabs" aria-label="Venue screen">
          <button type="button" className={view === "workspace" ? "active" : ""} onClick={() => setView("workspace")}>
            <SlidersHorizontal /> Interact
          </button>
          <button type="button" className={view === "services" ? "active" : ""} onClick={() => setView("services")}>
            <Grid2X2 /> All services
          </button>
        </nav>

        <div className="oxc-venue-workspace">
          {view === "workspace" ? (
            <VenueWorkspace kind={building.interaction} />
          ) : (
            <div className="oxc-venue-grid">
              {venue.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="oxc-venue-card"
                  onClick={() => {
                    cityAudio.play("confirm");
                    closeVenue();
                    navigate(action.route);
                  }}
                >
                  <span className="oxc-venue-tag">{action.tag}</span>
                  <strong>{action.label}</strong>
                  <p>{action.description}</p>
                  <span className="oxc-venue-open">Open full system <ArrowRight /></span>
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="oxc-venue-footer">
          <button type="button" className="oxc-venue-secondary" onClick={() => { closeVenue(); enterBuilding(building.id); }}>
            <DoorOpen /> Walk inside
          </button>
          <button type="button" className="oxc-venue-secondary" onClick={recoverPlayer}>
            <RotateCcw /> Return to safe street
          </button>
          <span>Esc closes · movement pauses while this venue is open</span>
        </footer>
      </div>
    </section>
  );
}
