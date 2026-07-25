import { useEffect } from "react";
import { CityProvider, useCity } from "./CityProvider";
import { WorldCanvas } from "@/components/orbitxcity/WorldCanvas";
import { EnterScreen } from "@/components/orbitxcity/ui/EnterScreen";
import { CityHUD } from "@/components/orbitxcity/ui/CityHUD";
import "./city.css";

function CityShell() {
  const { entered } = useCity();

  useEffect(() => {
    document.body.classList.add("oxc-lock");
    return () => document.body.classList.remove("oxc-lock");
  }, []);

  return (
    <div className="oxc-root">
      {!entered ? (
        <EnterScreen />
      ) : (
        <>
          <WorldCanvas />
          <CityHUD />
        </>
      )}
    </div>
  );
}

/** Immersive OrbitX City demo — mounted at /Orbitxcity */
export default function OrbitxCityPage() {
  return (
    <CityProvider>
      <CityShell />
    </CityProvider>
  );
}
