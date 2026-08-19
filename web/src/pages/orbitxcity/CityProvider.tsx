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
import {
  CityRealtimeClient,
  MAIN_LOBBY,
  districtLobby,
  isDistrictLobby,
  type LobbyDescriptor,
} from "@/lib/orbitxcity/realtime";
import { cityAudio } from "@/lib/orbitxcity/cityAudio";
import { resetVirtualInput } from "@/lib/orbitxcity/input";
import { missionClaimCooldownMs } from "@/lib/orbitxcity/characterClasses";
import { applyShopAppearance, loadPurchases, purchasesToInventory, type ShopPurchase } from "@/lib/orbitxcity/cityShop";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

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
  refreshShop: () => void;
  shopPurchases: ShopPurchase[];
  collectShard: () => void;
  claimedMissionIds: string[];
  /** Epoch ms when the next city-board claim is allowed. */
  missionClaimReadyAt: number;
  claimMission: (missionId: string, reward: number) => boolean;
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
  /** Recovery: snap back to the city spawn and clear any interior / menu. */
  resetPlayer: () => void;
  touchControls: boolean;
  setTouchControls: (v: boolean) => void;
  quality: "high" | "lite";
  setQuality: (q: "high" | "lite") => void;
  emoteAt: number;
  triggerEmote: () => void;
  /** When set, player is inside this building (collision ignored + interior room). */
  interiorBuildingId: string | null;
  enterBuilding: (buildingId: string, opts?: { soft?: boolean }) => void;
  exitBuilding: (opts?: { soft?: boolean }) => void;
  /** Open a building's branded venue tools menu (E only — never teleports). */
  openVenue: (buildingId: string) => void;
  /** Nearby interior vendor — InteriorRoom reports proximity; E opens their panel. */
  interiorVendor: { label: string; hint: string; panel: HudPanel } | null;
  setInteriorVendor: (v: { label: string; hint: string; panel: HudPanel } | null) => void;
  /** Nearby street local — NPCs report proximity; E triggers a talk toast. */
  streetNpc: { name: string; line: string } | null;
  setStreetNpc: (v: { name: string; line: string } | null) => void;
}

/** Exported so the R3F canvas can bridge this context across renderers. */
export const CityContext = createContext<CityContextValue | null>(null);

const DEFAULT_AVATAR: AvatarAppearance = {
  bodyColor: "#12181f",
  accentColor: "#00ff9f",
  skinColor: "#e8d5c0",
  name: "Traveler",
  classId: "pepe",
  hairStyle: "short",
  hairColor: "#151018",
  outfit: "suit",
  faceStyle: "cool",
  beardStyle: "none",
  bodyType: "standard",
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

/** Map a building's structural kind to a venue interaction when it has none set. */
function kindToInteraction(kind: string): InteractionKind {
  switch (kind) {
    case "market":
    case "shop":
      return "marketplace";
    case "trading_floor":
      return "trading";
    case "launch_arena":
      return "launch";
    case "social_hub":
      return "community";
    case "ad_tower":
      return "billboard";
    case "hq":
    default:
      return "hq";
  }
}

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
      return "shop";
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
  const enteredRef = useRef(false);
  const [lobby, setLobbyState] = useState<LobbyDescriptor>(MAIN_LOBBY);
  const [selectedCityId, setSelectedCityIdState] = useState<CityId>("nyc");
  const selectedCityIdRef = useRef<CityId>("nyc");
  const interiorRef = useRef<string | null>(null);
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
  const [missionClaimReadyAt, setMissionClaimReadyAt] = useState(0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [realtime, setRealtime] = useState<CityRealtimeClient | null>(null);
  const [teleportTarget, setTeleportTarget] = useState<{ x: number; z: number; seq: number } | null>(null);
  const [touchControls, setTouchControls] = useState(IS_COARSE_POINTER);
  const [quality, setQuality] = useState<"high" | "lite">(IS_COARSE_POINTER ? "lite" : "high");
  const [emoteAt, setEmoteAt] = useState(0);
  const [interiorBuildingId, setInteriorBuildingId] = useState<string | null>(null);
  const [interiorVendor, setInteriorVendor] = useState<{
    label: string;
    hint: string;
    panel: HudPanel;
  } | null>(null);
  const [streetNpc, setStreetNpc] = useState<{ name: string; line: string } | null>(null);
  const [shopTick, setShopTick] = useState(0);
  const walletKey = publicKey?.toBase58() ?? "";
  const shopPurchases = useMemo(() => loadPurchases(walletKey), [walletKey, shopTick]);
  const inventory = useMemo(
    () => [...STARTER_INVENTORY, ...purchasesToInventory(shopPurchases)],
    [shopPurchases],
  );
  const refreshShop = useCallback(() => setShopTick((n) => n + 1), []);

  useEffect(() => {
    if (!shopPurchases.length) return;
    setAvatar((current) => {
      const next = applyShopAppearance(current, shopPurchases);
      if (
        next.outfit === current.outfit &&
        next.bodyColor === current.bodyColor &&
        next.accentColor === current.accentColor &&
        next.classId === current.classId &&
        next.hairStyle === current.hairStyle
      ) {
        return current;
      }
      return next;
    });
  }, [shopPurchases]);

  // The public lobby follows the selected district. Custom/private lobbies
  // remain untouched so friends can keep their room while changing views.
  useEffect(() => {
    setLobbyState((current) => {
      if (!isDistrictLobby(current.id)) return current;
      const next = districtLobby(selectedCityId);
      return current.id === next.id ? current : next;
    });
  }, [selectedCityId]);

  useEffect(() => {
    if (!interiorBuildingId) return;
    const exists = getWorldBlock(selectedCityId).buildings.some((b) => b.id === interiorBuildingId);
    if (!exists) {
      interiorRef.current = null;
      setInteriorBuildingId(null);
      setInteriorVendor(null);
    }
  }, [interiorBuildingId, selectedCityId]);

  const setLobby = useCallback((next: LobbyDescriptor) => {
    if (!next?.id) return;
    setLobbyState((current) => (current.id === next.id && current.label === next.label ? current : next));
  }, []);

  const setSelectedCityId = useCallback((cityId: CityId) => {
    if (!cityId || cityId === selectedCityIdRef.current) return;
    selectedCityIdRef.current = cityId;
    setSelectedCityIdState(cityId);
    interiorRef.current = null;
    setInteriorBuildingId(null);
    setInteriorVendor(null);
    if (enteredRef.current) {
      const spawn = getWorldBlock(cityId).spawn;
      setPlayerPos(spawn);
      setTeleportTarget((prev) => ({ x: spawn.x, z: spawn.z, seq: (prev?.seq ?? 0) + 1 }));
    }
  }, []);

  const setGate = useCallback((g: CityGate) => {
    setGateState(g);
    if (g !== "world") {
      enteredRef.current = false;
      setEnteredState(false);
    }
  }, []);

  const setEntered = useCallback((v: boolean) => {
    if (v) {
      if (enteredRef.current) {
        setGateState("world");
        return;
      }
      const spawn = getWorldBlock(selectedCityIdRef.current).spawn;
      enteredRef.current = true;
      setPlayerPos(spawn);
      setPlayerYaw(0);
      setPanel("none");
      interiorRef.current = null;
      setInteriorBuildingId(null);
      setInteriorVendor(null);
      setStreetNpc(null);
      resetVirtualInput();
      setGateState("world");
      setEnteredState(true);
      return;
    }
    if (!enteredRef.current) {
      setGateState((prev) => (prev === "world" ? "menu" : prev));
      return;
    }
    enteredRef.current = false;
    setEnteredState(false);
    setGateState((prev) => (prev === "world" ? "menu" : prev));
  }, []);

  const exitToMenu = useCallback(() => {
    resetVirtualInput();
    setRealtime((prev) => {
      prev?.disconnect();
      return null;
    });
    setPanel("none");
    setActiveZone(null);
    interiorRef.current = null;
    setInteriorBuildingId(null);
    setInteriorVendor(null);
    setStreetNpc(null);
    enteredRef.current = false;
    setEnteredState(false);
    setGateState("menu");
  }, []);

  const exitBuilding = useCallback((opts?: { soft?: boolean }) => {
    const currentId = interiorRef.current;
    if (!currentId) return;
    const block = getWorldBlock(selectedCityIdRef.current);
    const b = block.buildings.find((x) => x.id === currentId) ?? null;
    interiorRef.current = null;
    setInteriorBuildingId(null);
    setInteriorVendor(null);
    cityAudio.play("whoosh");
    if (opts?.soft || !b) return;
    const x = b.position.x;
    const z = b.position.z + b.size.depth / 2 + 1.6;
    setPlayerPos({ x, y: 0, z });
    setTeleportTarget((prev) => ({ x, z, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const enterBuilding = useCallback((buildingId: string, opts?: { soft?: boolean }) => {
    if (!buildingId) return;
    if (interiorRef.current === buildingId) return;
    const block = getWorldBlock(selectedCityIdRef.current);
    const b = block.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    interiorRef.current = buildingId;
    setInteriorBuildingId(buildingId);
    setInteriorVendor(null);
    setPanel("none");
    cityAudio.play("enter");
    if (opts?.soft) return;
    const interiorDepth = Math.max(5.4, Math.min(14, b.size.depth - 0.8));
    const x = b.position.x;
    const z = b.position.z + interiorDepth / 2 - 1.35;
    setPlayerPos({ x, y: 0, z });
    setTeleportTarget((prev) => ({ x, z, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const playerId = useMemo(
    () => makePlayerId(user?.id, publicKey?.toBase58() ?? null),
    [user?.id, publicKey],
  );

  const openPanel = useCallback((p: HudPanel) => {
    resetVirtualInput();
    setPanel(p);
  }, []);
  const closePanel = useCallback(() => {
    resetVirtualInput();
    setPanel("none");
  }, []);
  const collectShard = useCallback(() => {
    cityAudio.play("coin");
    setShards((s) => s + 1);
  }, []);
  const claimMission = useCallback(
    (missionId: string, reward: number) => {
      const now = Date.now();
      if (now < missionClaimReadyAt) {
        const secs = Math.ceil((missionClaimReadyAt - now) / 1000);
        toast.message("Mission cooldown", { description: `Ready in ${secs}s` });
        return false;
      }
      let claimed = false;
      setClaimedMissionIds((current) => {
        if (current.includes(missionId)) return current;
        claimed = true;
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
      if (!claimed) return false;
      const block = getWorldBlock(selectedCityId);
      const interior = interiorBuildingId
        ? block.buildings.find((b) => b.id === interiorBuildingId)
        : null;
      const atHq =
        interior?.kind === "hq" ||
        interior?.interaction === "hq" ||
        activeZone?.kind === "hq";
      const cd = missionClaimCooldownMs(avatar.classId, atHq);
      setMissionClaimReadyAt(now + cd);
      return true;
    },
    [missionClaimReadyAt, selectedCityId, interiorBuildingId, activeZone, avatar.classId],
  );
  const teleport = useCallback((x: number, z: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const block = getWorldBlock(selectedCityIdRef.current);
    const nx = Math.min(block.bounds.maxX - 0.6, Math.max(block.bounds.minX + 0.6, x));
    const nz = Math.min(block.bounds.maxZ - 0.6, Math.max(block.bounds.minZ + 0.6, z));
    setTeleportTarget((prev) => ({ x: nx, z: nz, seq: (prev?.seq ?? 0) + 1 }));
    setPlayerPos({ x: nx, y: 0, z: nz });
    setPanel("none");
  }, []);

  const resetPlayer = useCallback(() => {
    const spawn = getWorldBlock(selectedCityIdRef.current).spawn;
    interiorRef.current = null;
    setInteriorBuildingId(null);
    setInteriorVendor(null);
    setPanel("none");
    resetVirtualInput();
    setPlayerPos(spawn);
    setTeleportTarget((prev) => ({ x: spawn.x, z: spawn.z, seq: (prev?.seq ?? 0) + 1 }));
    cityAudio.play("confirm");
  }, []);

  const triggerEmote = useCallback(() => {
    setEmoteAt(Date.now());
    realtime?.sendEmote();
  }, [realtime]);

  const openToken = useCallback((mint: string) => {
    setSelectedMint(mint);
    setPanel("token");
  }, []);

  /**
   * Open a building's branded venue tools menu. Never teleports —
   * physical entry is the doorway crossing in the movement loop.
   */
  const openVenue = useCallback(
    (buildingId: string) => {
      const block = getWorldBlock(selectedCityId);
      const b = block.buildings.find((x) => x.id === buildingId);
      if (!b) return;
      cityAudio.play("interact");
      const kind = b.interaction ?? kindToInteraction(b.kind);
      setPanel(zoneToPanel(kind));
    },
    [selectedCityId],
  );

  const interact = useCallback(() => {
    // Inside a building: E opens nearby vendor panel or venue tools (exit is walk-out).
    if (interiorBuildingId) {
      if (interiorVendor) {
        cityAudio.play("interact");
        if (interiorVendor.panel === "voice") setVoiceOpen(true);
        openPanel(interiorVendor.panel);
        return;
      }
      openVenue(interiorBuildingId);
      return;
    }
    if (activeZone) {
      if (activeZone.tokenMint) {
        openToken(activeZone.tokenMint);
        return;
      }
      if (activeZone.kind === "voice") {
        setVoiceOpen(true);
        openPanel("voice");
        return;
      }
      if (activeZone.buildingId) {
        openVenue(activeZone.buildingId);
        return;
      }
      openPanel(zoneToPanel(activeZone.kind));
      return;
    }
    if (streetNpc) {
      cityAudio.play("interact");
      toast.message(`@${streetNpc.name}`, {
        description: streetNpc.line,
        duration: 3800,
        className: "oxc-chat-toast",
      });
    }
  }, [activeZone, openPanel, openToken, interiorBuildingId, interiorVendor, openVenue, streetNpc]);

  const prompt = useMemo(() => {
    if (interiorBuildingId && panel === "none") {
      if (interiorVendor) {
        return { label: interiorVendor.label, hint: interiorVendor.hint };
      }
      return {
        label: "Inside · venue floor",
        hint: "Walk out the open door to leave · E opens venue tools",
      };
    }
    if (panel !== "none") return null;
    if (activeZone) {
      if (activeZone.buildingId) {
        return {
          label: activeZone.label,
          hint: "Walk through the open door · E for venue tools",
        };
      }
      return {
        label: activeZone.label,
        hint: activeZone.hint || "E · interact",
      };
    }
    if (streetNpc) {
      return {
        label: `@${streetNpc.name}`,
        hint: "E · talk",
      };
    }
    return null;
  }, [activeZone, panel, interiorBuildingId, interiorVendor, streetNpc]);

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
        classId: avatar.classId,
        beardStyle: avatar.beardStyle,
        bodyType: avatar.bodyType,
      },
      lobby,
    );
    client.sendPosition(playerPos.x, playerPos.z, playerYaw, true);
    client.connect();
    setRealtime(client);
    return () => {
      client.disconnect();
      setRealtime(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, playerId, lobby.id]);

  useEffect(() => {
    realtime?.setCosmetics({
      name: avatar.name,
      accentColor: avatar.accentColor,
      bodyColor: avatar.bodyColor,
      skinColor: avatar.skinColor,
      hairStyle: avatar.hairStyle,
      hairColor: avatar.hairColor,
      outfit: avatar.outfit,
      faceStyle: avatar.faceStyle,
      classId: avatar.classId,
      beardStyle: avatar.beardStyle,
      bodyType: avatar.bodyType,
    });
  }, [realtime, avatar]);

  useEffect(() => {
    if (!realtime || !entered) return;
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
      refreshShop,
      shopPurchases,
      collectShard,
      claimedMissionIds,
      missionClaimReadyAt,
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
      resetPlayer,
      touchControls,
      setTouchControls,
      quality,
      setQuality,
      emoteAt,
      triggerEmote,
      interiorBuildingId,
      enterBuilding,
      exitBuilding,
      openVenue,
      interiorVendor,
      setInteriorVendor,
      streetNpc,
      setStreetNpc,
    }),
    [
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
      interact,
      playerPos,
      playerYaw,
      avatar,
      inventory,
      shards,
      refreshShop,
      shopPurchases,
      collectShard,
      claimedMissionIds,
      missionClaimReadyAt,
      claimMission,
      selectedMint,
      openToken,
      prompt,
      realtime,
      playerId,
      voiceOpen,
      teleportTarget,
      resetPlayer,
      openVenue,
      interiorVendor,
      streetNpc,
      teleport,
      touchControls,
      quality,
      emoteAt,
      triggerEmote,
      interiorBuildingId,
      enterBuilding,
      exitBuilding,
    ],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used within CityProvider");
  return ctx;
}
