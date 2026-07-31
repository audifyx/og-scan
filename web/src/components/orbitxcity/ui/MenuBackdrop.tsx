/**
 * Full-bleed cinematic city backdrop for OrbitX City gate screens.
 */
import type { CityId } from "@/lib/orbitxcity/types";

const CITY_BG: Record<CityId, string> = {
  nyc: "/orbitxcity/bg/nyc.png",
  miami: "/orbitxcity/bg/miami.png",
  la: "/orbitxcity/bg/la.png",
  boston: "/orbitxcity/bg/boston.png",
};

interface MenuBackdropProps {
  cityId?: CityId | string;
  /** Extra class for gate-specific intensity. */
  intensity?: "title" | "chamber";
}

export function MenuBackdrop({ cityId = "nyc", intensity = "title" }: MenuBackdropProps) {
  const src = CITY_BG[(cityId as CityId) in CITY_BG ? (cityId as CityId) : "nyc"] ?? CITY_BG.nyc;

  return (
    <div className={`oxc-menubg oxc-menubg--${intensity}`} aria-hidden>
      <div className="oxc-menubg-photo" style={{ backgroundImage: `url(${src})` }} />
      <div className="oxc-menubg-vignette" />
      <div className="oxc-menubg-grade" />
      <div className="oxc-menubg-grain" />
    </div>
  );
}
