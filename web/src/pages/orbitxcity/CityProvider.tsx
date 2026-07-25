import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
  shards: number;
  collectShard: () => void;
  selectedMint: string | null;
  setSelectedMint: (mint: string | null) => void;
  prompt: { label: string; hint: string } | null;
}

/** Exported so the R3F canvas can bridge this context across renderers. */
export const CityContext = createContext<CityContextValue | null>(null);

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
  const [shards, setShards] = useState(0);
  const inventory = STARTER_INVENTORY;

  const openPanel = useCallback((p: HudPanel) => setPanel(p), []);
  const closePanel = useCallback(() => setPanel("none"), []);
  const collectShard = useCallback(() => setShards((s) => s + 1), []);

  const interact = useCallback(() => {
    if (!activeZone) return;
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
      shards,
      collectShard,
      selectedMint,
      setSelectedMint,
      prompt,
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
      shards,
      collectShard,
      selectedMint,
      prompt,
    ],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used within CityProvider");
  return ctx;
}
