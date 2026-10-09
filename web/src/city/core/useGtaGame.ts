import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLivePrices } from "@/hooks/useLivePrices";
import { GTAWorld, type HudState, type Quote } from "./World";
import { createInput, KeyboardInput, OrbitDrag, setTouchSprint, type InputState } from "./input";
import { GameAudio } from "./audio";

const MARKET_MINTS = [
  "So11111111111111111111111111111111111111112",
  "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPBAA7",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "EKpQGSJtjMFqKZ9KQanSqYXRcwiUd5R8ZEWHz5MCFG4rq",
];
const MARKET_SYMBOLS = ["SOL", "ORBITX", "BONK", "JUP", "WIF"];

const SETTINGS_KEY = "orbitxcity.gta.settings.v1";

export type GtaPhase = "title" | "howto" | "playing";

interface Settings { sound: boolean; quality: "high" | "low" }

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Settings>;
      return {
        sound: s.sound !== false,
        quality: s.quality === "low" ? "low" : "high",
      };
    }
  } catch { /* noop */ }
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  return { sound: true, quality: coarse ? "low" : "high" };
}

export function useGtaGame() {
  const [phase, setPhase] = useState<GtaPhase>("title");
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<GTAWorld | null>(null);
  const inputRef = useRef<InputState>(createInput());
  const audioRef = useRef<GameAudio>(new GameAudio());
  const kbRef = useRef<KeyboardInput | null>(null);
  const orbitRef = useRef<OrbitDrag | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const { prices, connected } = useLivePrices(MARKET_MINTS, 15_000);

  const quotes: Record<string, Quote> = useMemo(() => {
    const q: Record<string, Quote> = {};
    MARKET_MINTS.forEach((mint, i) => {
      const p = prices[mint];
      if (p && p.price > 0) q[MARKET_SYMBOLS[i]] = { price: p.price, change24h: p.priceChange24h };
    });
    return q;
  }, [prices]);

  // apply settings
  useEffect(() => {
    audioRef.current.setEnabled(settings.sound);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* noop */ }
  }, [settings]);

  // push live prices into the world (billboards)
  useEffect(() => {
    worldRef.current?.updatePrices(quotes);
  }, [quotes]);

  const start = useCallback(() => {
    audioRef.current.unlock();
    audioRef.current.setEnabled(loadSettings().sound);
    setPhase("playing");
    setPaused(false);
  }, []);

  // create / dispose world with phase (world stays alive under the how-to overlay)
  useEffect(() => {
    const active = phase === "playing" || phase === "howto";
    if (!active) {
      worldRef.current?.dispose();
      worldRef.current = null;
      kbRef.current?.dispose();
      kbRef.current = null;
      orbitRef.current?.dispose();
      orbitRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    const minimap = minimapRef.current;
    if (!canvas || !minimap) return;
    const input = inputRef.current;
    const audio = audioRef.current;
    const s = loadSettings();
    const world = new GTAWorld({
      canvas, minimap, input, audio,
      quality: s.quality,
      onHud: setHud,
    });
    worldRef.current = world;
    kbRef.current = new KeyboardInput(
      input,
      () => world.toggleEnterExit(),
      () => setPaused((p) => { const n = !p; world.setPaused(n); return n; }),
    );
    // orbit drag on canvas, but not when the gesture starts on HUD controls
    orbitRef.current = new OrbitDrag(canvas, (x, y) => {
      const el = document.elementFromPoint(x, y);
      return !(el?.closest("[data-hud]"));
    });
    // feed orbit deltas into world each frame via rAF hook
    let raf = 0;
    const pump = () => {
      raf = requestAnimationFrame(pump);
      const d = orbitRef.current?.consume();
      if (d && (d.dx !== 0 || d.dy !== 0)) world.addOrbit(d.dx, d.dy);
    };
    pump();
    // feed initial prices
    world.updatePrices(
      (() => {
        const q: Record<string, Quote> = {};
        MARKET_MINTS.forEach((mint, i) => {
          const p = prices[mint];
          if (p && p.price > 0) q[MARKET_SYMBOLS[i]] = { price: p.price, change24h: p.priceChange24h };
        });
        return q;
      })(),
    );
    return () => {
      cancelAnimationFrame(raf);
      world.dispose();
      worldRef.current = null;
      kbRef.current?.dispose();
      kbRef.current = null;
      orbitRef.current?.dispose();
      orbitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // pause → world
  useEffect(() => {
    worldRef.current?.setPaused(paused);
  }, [paused]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const n = !p;
      worldRef.current?.setPaused(n);
      return n;
    });
  }, []);

  const toTitle = useCallback(() => {
    setPaused(false);
    setPhase("title");
  }, []);

  const doAction = useCallback(() => {
    inputRef.current.action = true;
  }, []);

  /** Module teams: access the live world (player state, vehicle refs, scene). Null when not in-world. */
  const getWorld = useCallback(() => worldRef.current, []);

  const setSprintTouch = useCallback((v: boolean) => {
    setTouchSprint(v);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  return {
    phase, setPhase, paused, hud,
    settings, updateSettings,
    canvasRef, minimapRef, input: inputRef.current,
    audio: audioRef.current,
    quotes, pricesConnected: connected,
    start, togglePause, toTitle, doAction, setSprintTouch, getWorld,
  };
}

export type GtaApi = ReturnType<typeof useGtaGame>;
