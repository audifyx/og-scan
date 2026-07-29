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
  CityGate,
  CityId,
  HudPanel,
  InteractionKind,
  InteractionZone,
  InventoryItem,
  Vec3,
} from "@/lib/orbitxcity/types";
import { getWorldBlock } from "@/lib/orbitxcity/worlds";
import { CityRealtimeClient, MAIN_LOBBY, type LobbyDescriptor } from "@/lib/orbitxcity/realtime";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { getBuildingEntrances, checkDoorwayCrossing } from "@/lib/orbitxcity/doorwayEntry";
import { Vector2 } from "three";

interface CityContextValue {
  /** AAA gate: menu → characters → lobbies → world */
  gate: CityGate;
  setGate: (g: CityGate) => void;
  entered: boolean;
  setEntered: (v: boolean) => void;
  exitToMenu: () => void;
  lobby: LobbyDescriptor;
  setLobby: (lobby: LobbyDescriptor) => void;
  selectedCityId: CityId;
  setSelectedCityId: (cityId: CityId) => void;
  panel: HudPanel;
  openPanel: (p: HudPanel) => void;
  closePanel: () => void;
  activeZone: InteractionZone | null;
  setActiveZone: (z: InteractionZone | null) => void;
  interact: () => void;
  playerPos: Vec3;
  setPlayerPos: (p: Vec3) => void;
  playerYaw: number;
  setPlayerYaw: (y: number) => void;
  avatar: AvatarAppearance;
  setAvatar: (a: AvatarAppearance) => void;
  inventory: InventoryItem[];
  shards: number;
  collectShard: () => void;
  claimedMissionIds: string[];
  claimMission: (missionId: string, reward: number) => void;
  selectedMint: string | null;
  openToken: (mint: string) => void;
  setSelectedMint: (mint: string | null) => void;
  prompt: { label: string; hint: string } | null;
  realtime: CityRealtimeClient | null;
  playerId: string;
  voiceOpen: boolean;
  setVoiceOpen: (v: boolean) => void;
  teleportTarget: { x: number; z: number; seq: number } | null;
  teleport: (x: number, z: number) => void;
  touchControls: boolean;
  setTouchControls: (v: boolean) => void;
  quality: "high" | "lite";
  setQuality: (q: "high" | "lite") => void;
  emoteAt: number;
  triggerEmote: () => void;
  /** When set, player is inside this building (collision ignored + interior room). */
  interiorBuildingId: string | null;
  enterBuilding: (buildingId: string) => void;
  exitBuilding: () => void;
  venueBuildingId: string | null;
  openVenue: (buildingId: string) => void;
  closeVenue: () => void;
  recoverPlayer: () => void;
  worldInputLocked: boolean;
}

/** Exported so the R3F canvas can bridge this context across renderers. */
export const CityContext = createContext<CityContextValue | null>(null);

const DEFAULT_AVATAR: AvatarAppearance = {
  bodyColor: "#12181f",
  accentColor: "#00ff9f",
  skinColor: "#e8d5c0",
  name: "Traveler",
  classId: "trader",
  hairStyle: "short",
  hairColor: "#151018",
  outfit: "suit",
  faceStyle: "cool",
};

const STARTER_INVENTORY: InventoryItem[] = [
  { id: "badge-pioneer", kind: "badge", label: "City Pioneer", detail: "OrbitX City Phase 1 access" },
  { id: "badge-founder", kind: "badge", label: "Founder Badge", detail: "Early OrbitX City operative" },
  { id: "key-nyc", kind: "key", label: "NYC Block Key", detail: "Midtown demo district" },
  { id: "holder-key", kind: "key", label: "Holder Key", detail: "Unlocks VIP building interiors" },
  { id: "ad-slot", kind: "ad_slot", label: "Billboard Slot", detail: "1 SOL · 7 days · Advertising District" },
  { id: "ad-slot-a", kind: "ad_slot", label: "Billboard Slot A", detail: "Rentable Midtown ad face" },
  { id: "token-obx", kind: "token", label: "OBX Watchlist Slot", detail: "Pin a mint on your HUD tape" },
];

function zoneToPanel(kind: InteractionKind): HudPanel {
  switch (kind) {
    case "marketplace":
      return "marketplace";
    case "token":
      return "token";
    case "trading":
      return "trading";
    case "launch":
      return "launch";
    case "community":
      return "social";
    case "hq":
      return "live";
    case "billboard":
      return "live";
    case "voice":
      return "voice";
    case "games":
      return "games";
    case "nft":
      return "nft";
    default:
      return "live";
  }
}

function makePlayerId(userId?: string | null, wallet?: string | null): string {
  if (userId) return `u:${userId}`;
  if (wallet) return `w:${wallet.slice(0, 12)}`;
  const cached = sessionStorage.getItem("oxc_guest_id");
  if (cached) return cached;
  const id = `g:${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
  sessionStorage.setItem("oxc_guest_id", id);
  return id;
}

const IS_COARSE_POINTER =
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function CityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { publicKey } = useWallet();
  const [gate, setGateState] = useState<CityGate>("menu");
  const [entered, setEnteredState] = useState(false);
  const [lobby, setLobby] = useState<LobbyDescriptor>(MAIN_LOBBY);
  const [selectedCityId, setSelectedCityId] = useState<CityId>("nyc");
  const [panel, setPanel] = useState<HudPanel>("none");
  const [activeZone, setActiveZone] = useState<InteractionZone | null>(null);
  const [playerPos, setPlayerPos] = useState<Vec3>(getWorldBlock("nyc").spawn);
  const [playerYaw, setPlayerYaw] = useState(0);
  const [avatar, setAvatar] = useState<AvatarAppearance>(DEFAULT_AVATAR);
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [shards, setShards] = useState(0);
  const [claimedMissionIds, setClaimedMissionIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("oxc_claimed_missions") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [realtime, setRealtime] = useState<CityRealtimeClient | null>(null);
  const [teleportTarget, setTeleportTarget] = useState<{ x: number; z: number; seq: number } | null>(null);
  const [touchControls, setTouchControls] = useState(IS_COARSE_POINTER);
  const [quality, setQuality] = useState<"high" | "lite">(IS_COARSE_POINTER ? "lite" : "high");
  const [emoteAt, setEmoteAt] = useState(0);
  const [interiorBuildingId, setInteriorBuildingId] = useState<string | null>(null);
  const [venueBuildingId, setVenueBuildingId] = useState<string | null>(null);
  const prevPlayerPosRef = useRef<Vector2>(new Vector2(playerPos.x, playerPos.z));
  const inventory = STARTER_INVENTORY;
  const worldInputLocked = panel !== "none" || venueBuildingId !== null;

  // The public lobby follows the selected district. Custom/private lobbies
  // remain untouched so friends can keep their room while changing views.
  useEffect(() => {
    setLobby((current) => {
      if (!current.id.startsWith("oxc-world-")) return current;
      const id = `oxc-world-${selectedCityId}`;
      if (current.id === id) return current;
      return { id, label: `Main Lobby · ${selectedCityId.toUpperCase()}`, isPrivate: false };
    });
  }, [selectedCityId]);

  const setGate = useCallback((g: CityGate) => {
    setGateState(g);
    if (g !== "world") setEnteredState(false);
  }, []);

  const setEntered = useCallback(
    (v: boolean) => {
      if (v) {
        const spawn = getWorldBlock(selectedCityId).spawn;
        setPlayerPos(spawn);
        setPlayerYaw(0);
        setPanel("none");
        setInteriorBuildingId(null);
        setGateState("world");
      }
      setEnteredState(v);
      if (!v) setGateState((prev) => (prev === "world" ? "menu" : prev));
    },
    [selectedCityId],
  );

  const exitToMenu = useCallback(() => {
    setRealtime((prev) => {
      prev?.disconnect();
      return null;
    });
    setPanel("none");
    setActiveZone(null);
    setInteriorBuildingId(null);
    setVenueBuildingId(null);
    setEnteredState(false);
    setGateState("menu");
  }, []);

  const exitBuilding = useCallback(() => {
    if (!interiorBuildingId) return;
    const block = getWorldBlock(selectedCityId);
    const b = block.buildings.find((x) => x.id === interiorBuildingId);
    setInteriorBuildingId(null);
    if (b) {
      const x = b.position.x;
      const z = b.position.z + b.size.depth / 2 + 1.6;
      setPlayerPos({ x, y: 0, z });
      setTeleportTarget((prev) => ({ x, z, seq: (prev?.seq ?? 0) + 1 }));
    }
  }, [interiorBuildingId, selectedCityId]);

  const enterBuilding = useCallback(
    (buildingId: string) => {
      const block = getWorldBlock(selectedCityId);
      const b = block.buildings.find((x) => x.id === buildingId);
      if (!b) return;
      const interiorDepth = Math.max(5.2, Math.min(14, b.size.depth - 0.8));
      // Enter from the south-side doorway, just inside the room — never
      // teleport through a desk or drop the player at the room's center.
      const x = b.position.x;
      const z = b.position.z + interiorDepth / 2 - 1.85;
      setInteriorBuildingId(buildingId);
      setPanel("none");
      setPlayerPos({ x, y: 0, z });
      setTeleportTarget((prev) => ({
        x,
        z,
        seq: (prev?.seq ?? 0) + 1,
      }));
      cityAudio.play("confirm");
    },
    [selectedCityId],
  );

  const playerId = useMemo(
    () => makePlayerId(user?.id, publicKey?.toBase58() ?? null),
    [user?.id, publicKey],
  );

  const openVenue = useCallback((buildingId: string) => {
    setPanel("none");
    setVenueBuildingId(buildingId);
    cityAudio.play("whoosh");
  }, []);
  const closeVenue = useCallback(() => setVenueBuildingId(null), []);
  const recoverPlayer = useCallback(() => {
    const spawn = getWorldBlock(selectedCityId).spawn;
    setInteriorBuildingId(null);
    setVenueBuildingId(null);
    setPanel("none");
    setActiveZone(null);
    setPlayerPos(spawn);
    setPlayerYaw(0);
    setTeleportTarget((prev) => ({ x: spawn.x, z: spawn.z, seq: (prev?.seq ?? 0) + 1 }));
    cityAudio.play("confirm");
  }, [selectedCityId]);

  const openPanel = useCallback((p: HudPanel) => {
    setVenueBuildingId(null);
    setPanel(p);
  }, []);
  const closePanel = useCallback(() => setPanel("none"), []);
  const collectShard = useCallback(() => {
    cityAudio.play("coin");
    setShards((s) => s + 1);
  }, []);
  const claimMission = useCallback((missionId: string, reward: number) => {
    setClaimedMissionIds((current) => {
      if (current.includes(missionId)) return current;
      const next = [...current, missionId];
      try {
        localStorage.setItem("oxc_claimed_missions", JSON.stringify(next));
      } catch {
        /* local persistence is optional */
      }
      setShards((shardCount) => shardCount + reward);
      cityAudio.play("confirm");
      return next;
    });
  }, []);
  const teleport = useCallback((x: number, z: number) => {
    setTeleportTarget((prev) => ({ x, z, seq: (prev?.seq ?? 0) + 1 }));
    setPanel("none");
  }, []);

  const triggerEmote = useCallback(() => {
    setEmoteAt(Date.now());
    realtime?.sendEmote();
  }, [realtime]);

  const openToken = useCallback((mint: string) => {
    setVenueBuildingId(null);
    setSelectedMint(mint);
    setPanel("token");
  }, []);

  // Detect doorway crossings for automatic interior entry
  useEffect(() => {
    if (interiorBuildingId) return; // Already inside
    const block = getWorldBlock(selectedCityId);
    const entrances = getBuildingEntrances(block.buildings);
    const curr = new Vector2(playerPos.x, playerPos.z);

    for (const entrance of entrances) {
      if (checkDoorwayCrossing(prevPlayerPosRef.current, curr, entrance)) {
        // Auto-enter the building when crossing the threshold
        enterBuilding(entrance.buildingId);
        break;
      }
    }
    prevPlayerPosRef.current.copy(curr);
  }, [playerPos, interiorBuildingId, selectedCityId, enterBuilding]);

  const interact = useCallback(() => {
    // Inside a building: E exits (and closes the district panel)
    if (interiorBuildingId) {
      exitBuilding();
      if (panel !== "none") setPanel("none");
      return;
    }
    if (!activeZone) return;
    if (activeZone.tokenMint) {
      openToken(activeZone.tokenMint);
      return;
    }
    if (activeZone.buildingId) {
      const building = getWorldBlock(selectedCityId).buildings.find((item) => item.id === activeZone.buildingId);
      if (building?.interaction) {
        openVenue(building.id);
        return;
      }
    }
    if (activeZone.kind === "voice") {
      setVoiceOpen(true);
      openPanel("voice");
      return;
    }
    openPanel(zoneToPanel(activeZone.kind));
  }, [activeZone, openPanel, openToken, openVenue, interiorBuildingId, exitBuilding, panel, selectedCityId]);

  const prompt = useMemo(() => {
    if (interiorBuildingId && panel === "none") {
      return {
        label: "Inside · tap glowing stations",
        hint: "Click a TAP station for tools · E or green pad to exit",
      };
    }
    if (!activeZone || panel !== "none") return null;
    return {
      label: activeZone.label,
      hint: activeZone.buildingId
        ? "Press E to open this venue · walking inside is optional"
        : activeZone.hint || "Press E to interact",
    };
  }, [activeZone, panel, interiorBuildingId]);

  useEffect(() => {
    if (!entered) {
      setRealtime((prev) => {
        prev?.disconnect();
        return null;
      });
      return;
    }
    const client = new CityRealtimeClient(
      {
        id: playerId,
        name: avatar.name,
        accentColor: avatar.accentColor,
        bodyColor: avatar.bodyColor,
        skinColor: avatar.skinColor,
        hairStyle: avatar.hairStyle,
        hairColor: avatar.hairColor,
        outfit: avatar.outfit,
        faceStyle: avatar.faceStyle,
      },
      lobby,
    );
    client.connect();
    setRealtime(client);
    return () => {
      client.disconnect();
      setRealtime(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, playerId, lobby.id]);

  const lastBroadcast = useRef(0);
  useEffect(() => {
    if (!realtime || !entered) return;
    const now = performance.now();
    if (now - lastBroadcast.current < 160) return;
    lastBroadcast.current = now;
    realtime.sendPosition(playerPos.x, playerPos.z, playerYaw);
  }, [realtime, entered, playerPos, playerYaw]);

  const value = useMemo<CityContextValue>(
    () => ({
      gate,
      setGate,
      entered,
      setEntered,
      exitToMenu,
      lobby,
      setLobby,
      selectedCityId,
      setSelectedCityId,
      panel,
      openPanel,
      closePanel,
      activeZone,
      setActiveZone,
      interact,
      playerPos,
      setPlayerPos,
      playerYaw,
      setPlayerYaw,
      avatar,
      setAvatar,
      inventory,
      shards,
      collectShard,
      claimedMissionIds,
      claimMission,
      selectedMint,
      openToken,
      setSelectedMint,
      prompt,
      realtime,
      playerId,
      voiceOpen,
      setVoiceOpen,
      teleportTarget,
      teleport,
      touchControls,
      setTouchControls,
      quality,
      setQuality,
      emoteAt,
      triggerEmote,
      interiorBuildingId,
      enterBuilding,
      exitBuilding,
      venueBuildingId,
      openVenue,
      closeVenue,
      recoverPlayer,
      worldInputLocked,
    }),
    [
      gate,
      setGate,
      entered,
      setEntered,
      exitToMenu,
      lobby,
      selectedCityId,
      panel,
      openPanel,
      closePanel,
      activeZone,
      interact,
      playerPos,
      playerYaw,
      avatar,
      inventory,
      shards,
      collectShard,
      claimedMissionIds,
      claimMission,
      selectedMint,
      openToken,
      prompt,
      realtime,
      playerId,
      voiceOpen,
      teleportTarget,
      teleport,
      touchControls,
      quality,
      emoteAt,
      triggerEmote,
      interiorBuildingId,
      enterBuilding,
      exitBuilding,
      venueBuildingId,
      openVenue,
      closeVenue,
      recoverPlayer,
      worldInputLocked,
    ],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used within CityProvider");
  return ctx;
}
