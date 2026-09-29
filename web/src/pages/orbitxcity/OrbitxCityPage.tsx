import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CityProvider, useCity } from "./CityProvider";
import { WorldCanvas } from "@/components/orbitxcity/WorldCanvas";
import { MainMenu } from "@/components/orbitxcity/ui/MainMenu";
import { CharacterSelect } from "@/components/orbitxcity/ui/CharacterSelect";
import { LobbiesGate } from "@/components/orbitxcity/ui/LobbiesGate";
import { SettingsGate } from "@/components/orbitxcity/ui/SettingsGate";
import { CityHUD } from "@/components/orbitxcity/ui/CityHUD";
import { CityAudioController } from "@/components/orbitxcity/ui/CityAudioController";
import { CitySaveController } from "@/components/orbitxcity/ui/CitySaveController";
import { LoadingScreen } from "@/components/orbitxcity/ui/LoadingScreen";
import { fetchCityMarketSnapshot } from "@/lib/orbitxcity/marketData";
import { preloadCityAssets } from "@/lib/orbitxcity/assets/preload";
import "./city.css";

function CityShell() {
  const { gate, entered } = useCity();
  const [worldReady, setWorldReady] = useState(false);

  const { data: market } = useQuery({
    queryKey: ["orbitxcity-market"],
    queryFn: fetchCityMarketSnapshot,
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: entered,
  });

  useEffect(() => {
    document.body.classList.add("oxc-lock");
    preloadCityAssets();
    return () => document.body.classList.remove("oxc-lock");
  }, []);

  useEffect(() => {
    if (gate !== "world") setWorldReady(false);
  }, [gate]);

  const inWorld = gate === "world" && entered;

  return (
    <div className="oxc-root">
      <CityAudioController />
      <CitySaveController />
      {gate === "menu" && <MainMenu />}
      {gate === "characters" && <CharacterSelect />}
      {gate === "lobbies" && <LobbiesGate />}
      {gate === "settings" && <SettingsGate />}
      {inWorld && !worldReady && (
        <LoadingScreen ready onEnter={() => setWorldReady(true)} />
      )}
      {inWorld && worldReady && (
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
