import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CityProvider, useCity } from "./CityProvider";
import { WorldCanvas } from "@/components/orbitxcity/WorldCanvas";
import { MainMenu } from "@/components/orbitxcity/ui/MainMenu";
import { CharacterSelect } from "@/components/orbitxcity/ui/CharacterSelect";
import { CityHUD } from "@/components/orbitxcity/ui/CityHUD";
import { fetchCityMarketSnapshot } from "@/lib/orbitxcity/marketData";
import "./city.css";

function CityShell() {
  const { gate, entered } = useCity();

  // Live market feed shared by HUD panels + in-world jumbotrons
  const { data: market } = useQuery({
    queryKey: ["orbitxcity-market"],
    queryFn: fetchCityMarketSnapshot,
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: entered,
  });

  useEffect(() => {
    document.body.classList.add("oxc-lock");
    return () => document.body.classList.remove("oxc-lock");
  }, []);

  return (
    <div className="oxc-root">
      {gate === "menu" && <MainMenu />}
      {gate === "characters" && <CharacterSelect />}
      {gate === "world" && entered && (
        <>
          <WorldCanvas tickerRows={market?.trending ?? []} />
          <CityHUD />
        </>
      )}
    </div>
  );
}

/** Immersive OrbitX City — AAA menu → characters → NYC world. Mounted at /Orbitxcity */
export default function OrbitxCityPage() {
  return (
    <CityProvider>
      <CityShell />
    </CityProvider>
  );
}
