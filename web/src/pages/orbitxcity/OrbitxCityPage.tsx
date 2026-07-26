import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CityProvider, useCity } from "./CityProvider";
import { WorldCanvas } from "@/components/orbitxcity/WorldCanvas";
import { MainMenu } from "@/components/orbitxcity/ui/MainMenu";
import { CharacterSelect } from "@/components/orbitxcity/ui/CharacterSelect";
import { LobbiesGate } from "@/components/orbitxcity/ui/LobbiesGate";
import { CityHUD } from "@/components/orbitxcity/ui/CityHUD";
import { CityAudioController } from "@/components/orbitxcity/ui/CityAudioController";
import { fetchCityMarketSnapshot } from "@/lib/orbitxcity/marketData";
import "./city.css";

function CityShell() {
  const { gate, entered } = useCity();

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
      <CityAudioController />
      {gate === "menu" && <MainMenu />}
      {gate === "characters" && <CharacterSelect />}
      {gate === "lobbies" && <LobbiesGate />}
      {gate === "world" && entered && (
        <>
          <WorldCanvas tickerRows={market?.trending ?? []} />
          <CityHUD />
        </>
      )}
    </div>
  );
}

/** Immersive OrbitX City — AAA menu → characters/lobbies → multi-city world. */
export default function OrbitxCityPage() {
  return (
    <CityProvider>
      <CityShell />
    </CityProvider>
  );
}
