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
  CityId,
  HudPanel,
  InteractionKind,
  InteractionZone,
  InventoryItem,
  Vec3,
} from "@/lib/orbitxcity/types";
import { NYC_DEMO_BLOCK } from "@/lib/orbitxcity/demoBlock";
import { getWorldBlock } from "@/lib/orbitxcity/worlds";
import { CityRealtimeClient, MAIN_LOBBY, type LobbyDescriptor } from "@/lib/orbitxcity/realtime";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@solana/wallet-adapter-react";

interface CityContextValue {
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
}

/** Exported so the R3F canvas can bridge this context across renderers. */
export const CityContext = createContext<CityContextValue | null>(null);

const DEFAULT_AVATAR: AvatarAppearance = {
  bodyColor: "#1a2438",
  accentColor: "#17ff4d",
  skinColor: "#e8d5c0",
  name: "Traveler",
  hairStyle: "short",
  hairColor: "#1a1a1a",
  outfit: "street",
  faceStyle: "cool",
};

const STARTER_INVENTORY: InventoryItem[] = [
  { id: "badge-pioneer", kind: "badge", label: "City Pioneer", detail: "OrbitX City Phase 1 access" },
  { id: "key-nyc", kind: "key", label: "NYC Block Key", detail: "Midtown demo district" },
  { id: "ad-slot", kind: "ad_slot", label: "Billboard Slot", detail: "1 SOL · 7 days · Advertising District" },
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
      return "map";
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
  const [entered, setEntered] = useState(false);
  const [lobby, setLobby] = useState<LobbyDescriptor>(MAIN_LOBBY);
  const [selectedCityId, setSelectedCityId] = useState<CityId>("nyc");
  const [panel, setPanel] = useState<HudPanel>("none");
  const [activeZone, setActiveZone] = useState<InteractionZone | null>(null);
  const [playerPos, setPlayerPos] = useState<Vec3>(NYC_DEMO_BLOCK.spawn);
  const [playerYaw, setPlayerYaw] = useState(0);
  const [avatar, setAvatar] = useState<AvatarAppearance>(DEFAULT_AVATAR);
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [shards, setShards] = useState(0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [realtime, setRealtime] = useState<CityRealtimeClient | null>(null);
  const [teleportTarget, setTeleportTarget] = useState<{ x: number; z: number; seq: number } | null>(null);
  const [touchControls, setTouchControls] = useState(IS_COARSE_POINTER);
  const [quality, setQuality] = useState<"high" | "lite">(IS_COARSE_POINTER ? "lite" : "high");
  const [emoteAt, setEmoteAt] = useState(0);
  const inventory = STARTER_INVENTORY;

  const playerId = useMemo(
    () => makePlayerId(user?.id, publicKey?.toBase58() ?? null),
    [user?.id, publicKey],
  );

  const openPanel = useCallback((p: HudPanel) => setPanel(p), []);
  const closePanel = useCallback(() => setPanel("none"), []);
  const collectShard = useCallback(() => setShards((s) => s + 1), []);
  const exitToMenu = useCallback(() => {
    setRealtime((prev) => {
      prev?.disconnect();
      return null;
    });
    setPanel("none");
    setActiveZone(null);
    setEntered(false);
  }, []);

  const enterWorld = useCallback(
    (v: boolean) => {
      if (v) {
        const spawn = getWorldBlock(selectedCityId).spawn;
        setPlayerPos(spawn);
        setPlayerYaw(0);
        setPanel("none");
      }
      setEntered(v);
    },
    [selectedCityId],
  );
  const teleport = useCallback((x: number, z: number) => {
    setTeleportTarget((prev) => ({ x, z, seq: (prev?.seq ?? 0) + 1 }));
    setPanel("none");
  }, []);

  const triggerEmote = useCallback(() => {
    setEmoteAt(Date.now());
    realtime?.sendEmote();
  }, [realtime]);

  const openToken = useCallback(
    (mint: string) => {
      setSelectedMint(mint);
      setPanel("token");
    },
    [],
  );

  const interact = useCallback(() => {
    if (!activeZone) return;
    if (activeZone.tokenMint) {
      openToken(activeZone.tokenMint);
      return;
    }
    if (activeZone.kind === "voice") {
      setVoiceOpen(true);
      openPanel("voice");
      return;
    }
    openPanel(zoneToPanel(activeZone.kind));
  }, [activeZone, openPanel, openToken]);

  const prompt = useMemo(() => {
    if (!activeZone || panel !== "none") return null;
    return { label: activeZone.label, hint: activeZone.hint };
  }, [activeZone, panel]);

  // Connect realtime when entering the world
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
    // Reconnect only when identity/session or lobby changes — not every avatar keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered, playerId, lobby.id]);

  // Broadcast position at ~6Hz while in world
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
      entered,
      setEntered: enterWorld,
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
    }),
    [
      entered,
      enterWorld,
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
    ],
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useCity() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used within CityProvider");
  return ctx;
}
