import { Suspense, lazy, useEffect } from "react";
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
      <Suspense
        fallback={
          <div className="ocg-screen">
            <div className="ocg-screen-bg" />
            <div className="ocg-title-wrap">
              <p className="ocg-kicker">OrbitX presents</p>
              <h1 className="ocg-logo">ORBITX<span>CITY</span></h1>
              <p className="ocg-tagline">Loading the city…</p>
            </div>
          </div>
        }
      >
        <OrbitxCityGTA />
      </Suspense>
    </div>
  );
}
