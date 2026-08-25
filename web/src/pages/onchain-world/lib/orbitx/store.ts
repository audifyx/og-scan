import { create } from "zustand";
import { ALL_EVENT_KINDS, EMPTY_SNAPSHOT } from "./constants";
import type {
  BottomTab,
  CameraState,
  CenterView,
  DashboardSnapshot,
  EventKind,
  ViewOptions,
} from "./types";
import type { CamCommand } from "../../WorldCanvas";
import type { ChainEvent, CityDistricts, FlowRow, KolCard } from "../../api";

export type CityLive = {
  live: boolean;
  liveLabel: string;
  liveReason: string | null;
  districts: CityDistricts;
  kols: KolCard[];
  rawEvents: ChainEvent[];
  flows: FlowRow[];
  webglOk: boolean;
  webglLive: boolean;
  worldKey: number;
};

type OrbitxState = {
  snapshot: DashboardSnapshot;
  setSnapshot: (snapshot: DashboardSnapshot) => void;
  patchSnapshot: (patch: Partial<DashboardSnapshot>) => void;

  selectedWallet: string | null;
  trackWallet: (address: string | null) => void;

  activeView: CenterView;
  setActiveView: (view: CenterView) => void;

  bottomTab: BottomTab;
  setBottomTab: (tab: BottomTab) => void;

  eventFilters: EventKind[];
  toggleFilter: (kind: EventKind) => void;
  resetFilters: () => void;

  viewOptions: ViewOptions;
  toggleViewOption: (key: keyof ViewOptions) => void;

  follow: boolean;
  setFollow: (value: boolean) => void;
  speed: 1 | 2 | 4;
  cycleSpeed: () => void;
  paused: boolean;
  setPaused: (value: boolean) => void;
  muted: boolean;
  setMuted: (value: boolean) => void;

  camera: CameraState;
  setCamera: (camera: CameraState) => void;
  resetCamera: () => void;

  mobilePanel: "world" | "events" | "tx" | "wallet";
  setMobilePanel: (panel: "world" | "events" | "tx" | "wallet") => void;

  city: CityLive;
  patchCity: (patch: Partial<CityLive>) => void;

  followId: string | null;
  setFollowId: (id: string | null) => void;

  camCommand: CamCommand;
  setCamCommand: (cam: CamCommand) => void;

  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

const DEFAULT_CAMERA: CameraState = { x: 0, y: 0, zoom: 1 };

const EMPTY_CITY: CityLive = {
  live: false,
  liveLabel: "INDEXING DELAY",
  liveReason: "Waiting for the first confirmed index run.",
  districts: {
    orbitx: {
      mint: "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
      symbol: "ORBITX",
      name: "OrbitX",
      kind: "orbitx",
    },
    hubs: [],
    tokens: [],
  },
  kols: [],
  rawEvents: [],
  flows: [],
  webglOk: true,
  webglLive: false,
  worldKey: 0,
};

export const useOrbitxStore = create<OrbitxState>((set) => ({
  snapshot: EMPTY_SNAPSHOT,
  setSnapshot: (snapshot) => set({ snapshot }),
  patchSnapshot: (patch) =>
    set((state) => ({ snapshot: { ...state.snapshot, ...patch } })),

  selectedWallet: null,
  trackWallet: (address) => set({ selectedWallet: address }),

  activeView: "world",
  setActiveView: (activeView) => set({ activeView }),

  bottomTab: "recent",
  setBottomTab: (bottomTab) => set({ bottomTab }),

  eventFilters: [...ALL_EVENT_KINDS],
  toggleFilter: (kind) =>
    set((state) => {
      const has = state.eventFilters.includes(kind);
      if (has && state.eventFilters.length === 1) return state;
      return {
        eventFilters: has
          ? state.eventFilters.filter((k) => k !== kind)
          : [...state.eventFilters, kind],
      };
    }),
  resetFilters: () => set({ eventFilters: [...ALL_EVENT_KINDS] }),

  viewOptions: { labels: true, trails: true, figures: true, grid: false },
  toggleViewOption: (key) =>
    set((state) => ({
      viewOptions: { ...state.viewOptions, [key]: !state.viewOptions[key] },
    })),

  follow: false,
  setFollow: (follow) => set((state) => ({ follow, paused: follow ? false : state.paused })),
  speed: 1,
  cycleSpeed: () =>
    set((state) => ({
      speed: state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1,
    })),
  paused: false,
  setPaused: (paused) => set({ paused }),
  muted: true,
  setMuted: (muted) => set({ muted }),

  camera: DEFAULT_CAMERA,
  setCamera: (camera) => set({ camera }),
  resetCamera: () => set({ camera: DEFAULT_CAMERA, follow: false, camCommand: { kind: "reset" }, followId: null }),

  mobilePanel: "world",
  setMobilePanel: (mobilePanel) => set({ mobilePanel }),

  city: EMPTY_CITY,
  patchCity: (patch) => set((state) => ({ city: { ...state.city, ...patch } })),

  followId: null,
  setFollowId: (followId) => set({ followId }),

  camCommand: null,
  setCamCommand: (camCommand) => set({ camCommand }),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
