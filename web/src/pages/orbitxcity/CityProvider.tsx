import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AvatarAppearance,
  HudPanel,
  InteractionKind,
  InteractionZone,
  InventoryItem,
  Vec3,
} from "@/lib/orbitxcity/types";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { citySound } from "@/lib/orbitxcity/sound";

interface CityContextValue {
  entered: boolean;
  setEntered: (v: boolean) => void;
  panel: HudPanel;
  openPanel: (p: HudPanel) => void;
  closePanel: () => void;
  activeZone: InteractionZone | null;
  setActiveZone: (z: InteractionZone | null) => void;
  interact: () => void;
  playerPos: Vec3;
  setPlayerPos: (p: Vec3) => void;
  avatar: AvatarAppearance;
  setAvatar: (a: AvatarAppearance) => void;
  inventory: InventoryItem[];
  selectedMint: string | null;
  setSelectedMint: (mint: string | null) => void;
  prompt: { label: string; hint: string } | null;
  soundEnabled: boolean;
  toggleSound: () => void;
  shardTotal: number;
  shardsCollected: number;
  collectedShards: Set<string>;
  collectShard: (id: string) => void;
}

const CityContext = createContext<CityContextValue | null>(null);

const DEFAULT_AVATAR: AvatarAppearance = {
  bodyColor: "#1a2438",
  accentColor: "#17ff4d",
  name: "Traveler",
};

const STARTER_INVENTORY: InventoryItem[] = [
  { id: "badge-pioneer", kind: "badge", label: "City Pioneer", detail: "OrbitX City demo access" },
  { id: "key-nyc", kind: "key", label: "NYC Block Key", detail: "Midtown demo district" },
  { id: "ad-slot", kind: "ad_slot", label: "Billboard Slot", detail: "Advertising District (coming soon)" },
];

function zoneToPanel(kind: InteractionKind): HudPanel {
  switch (kind) {
    case "marketplace":
    case "token":
      return "marketplace";
    case "trading":
      return "trading";
    case "launch":
      return "launch";
    case "community":
      return "community";
    case "hq":
      return "map";
    case "billboard":
      return "live";
    default:
      return "live";
  }
}

export function CityProvider({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useState(false);
  const [panel, setPanel] = useState<HudPanel>("none");
  const [activeZone, setActiveZone] = useState<InteractionZone | null>(null);
  const [playerPos, setPlayerPos] = useState<Vec3>(NYC_DEMO_BLOCK.spawn);
  const [avatar, setAvatar] = useState<AvatarAppearance>(DEFAULT_AVATAR);
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(citySound.enabled);
  const [collectedShards, setCollectedShards] = useState<Set<string>>(() => new Set());
  const inventory = STARTER_INVENTORY;
  const shardTotal = NYC_DEMO_BLOCK.shards?.length ?? 0;

  const openPanel = useCallback((p: HudPanel) => {
    citySound.play("open");
    setPanel(p);
  }, []);
  const closePanel = useCallback(() => setPanel("none"), []);

  const toggleSound = useCallback(() => {
    const next = citySound.toggle();
    setSoundEnabled(next);
    if (next) {
      citySound.play("click");
      citySound.startAmbient();
    }
  }, []);

  // Keep the state updater pure (React requirement). The pickup chime is played
  // as a side effect in the effect below, once per newly collected shard.
  const collectShard = useCallback((id: string) => {
    setCollectedShards((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const prevShardCount = useRef(0);
  useEffect(() => {
    if (collectedShards.size > prevShardCount.current) citySound.play("pickup");
    prevShardCount.current = collectedShards.size;
  }, [collectedShards]);

  const interact = useCallback(() => {
    if (!activeZone) {
      citySound.play("deny");
      return;
    }
    openPanel(zoneToPanel(activeZone.kind));
  }, [activeZone, openPanel]);

  const prompt = useMemo(() => {
    if (!activeZone || panel !== "none") return null;
    return { label: activeZone.label, hint: activeZone.hint };
  }, [activeZone, panel]);

  const value = useMemo<CityContextValue>(
    () => ({
      entered,
      setEntered,
      panel,
      openPanel,
      closePanel,
      activeZone,
      setActiveZone,
      interact,
      playerPos,
      setPlayerPos,
      avatar,
      setAvatar,
      inventory,
      selectedMint,
      setSelectedMint,
      prompt,
      soundEnabled,
      toggleSound,
      shardTotal,
      shardsCollected: collectedShards.size,
      collectedShards,
      collectShard,
    }),
    [
      entered,
      panel,
      openPanel,
      closePanel,
      activeZone,
      interact,
      playerPos,
      avatar,
      inventory,
      selectedMint,
      prompt,
      soundEnabled,
      toggleSound,
      shardTotal,
      collectedShards,
      collectShard,
    ],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used within CityProvider");
  return ctx;
}
