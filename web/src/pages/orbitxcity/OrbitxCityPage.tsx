import { Suspense, lazy, useEffect } from "react";
import { GtaBootScreen } from "@/city/core/GtaScreens";
import "./city.css";

const OrbitxCityGTA = lazy(() => import("@/city/core/OrbitxCityGTA"));

/**
 * /Orbitxcity — GTA-style open world. Heavy Three.js code is lazy-loaded
 * so it never touches the main bundle. CityProvider.tsx is intentionally
 * left in place: other workstreams (3D metaverse components) import it.
 */
export default function OrbitxCityPage() {
  useEffect(() => {
    document.body.classList.add("oxc-lock");
    return () => document.body.classList.remove("oxc-lock");
  }, []);

  return (
    <div className="ocg-root">
      <Suspense fallback={<GtaBootScreen />}>
        <OrbitxCityGTA />
      </Suspense>
    </div>
  );
}
