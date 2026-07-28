import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, Building2, DoorOpen, MapPin, RotateCcw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getWorldBlock } from "@/lib/orbitxcity/worlds";
import { getVenueDefinition } from "@/lib/orbitxcity/venueRegistry";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { useCity } from "@/pages/orbitxcity/CityProvider";

export function BuildingVenueMenu() {
  const navigate = useNavigate();
  const closeRef = useRef<HTMLButtonElement>(null);
  const {
    venueBuildingId,
    closeVenue,
    enterBuilding,
    selectedCityId,
    recoverPlayer,
  } = useCity();

  const building = useMemo(() => {
    if (!venueBuildingId) return null;
    return getWorldBlock(selectedCityId).buildings.find((item) => item.id === venueBuildingId) ?? null;
  }, [selectedCityId, venueBuildingId]);
  const venue = building ? getVenueDefinition(building) : null;

  useEffect(() => {
    if (!venue) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [venue]);

  if (!building || !venue) return null;

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
          <span><MapPin /> {getWorldBlock(selectedCityId).name}</span>
          <span>{venue.actions.length} live destinations</span>
          <span>OrbitX systems</span>
        </div>

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
              <span className="oxc-venue-open">Open system <ArrowRight /></span>
            </button>
          ))}
        </div>

        <footer className="oxc-venue-footer">
          <button
            type="button"
            className="oxc-venue-secondary"
            onClick={() => {
              closeVenue();
              enterBuilding(building.id);
            }}
          >
            <DoorOpen /> Walk inside
          </button>
          <button type="button" className="oxc-venue-secondary" onClick={recoverPlayer}>
            <RotateCcw /> Return to safe street
          </button>
          <span>Esc closes this menu · movement pauses while open</span>
        </footer>
      </div>
    </section>
  );
}
