/**
 * OrbitXCity — Events module: the weather machine.
 *
 * The firm that wins turf wars controls the city's weather. This file is
 * the full feature: state machine, transition engine, scene application
 * (fog, rain, lightning, heat haze, neon night), and the control rules.
 *
 * Authorization rule: ONLY the firm named by the integrator as
 * `weatherFirmId` may change the weather, and only members
 * (`playerInWeatherFirm`) see the control panel. Everyone else sees the
 * current weather in the HUD. Cooldowns prevent griefing.
 */

import * as THREE from "three";
import type { CityEffectHandle, EventsSceneHost } from "../types";

export type WeatherState = "clear" | "rain" | "storm" | "fog" | "heat" | "neon";

export interface WeatherInfo {
  state: WeatherState;
  label: string;
  description: string;
  icon: string;
  /** How this weather feels in gameplay. */
  gameplayNote: string;
}

export const WEATHER_INFO: Record<WeatherState, WeatherInfo> = {
  clear: {
    state: "clear",
    label: "Clear Skies",
    description: "Crisp daylight over the city.",
    icon: "☀️",
    gameplayNote: "Normal driving and visibility.",
  },
  rain: {
    state: "rain",
    label: "Rain",
    description: "Steady rain slicks the streets.",
    icon: "🌧️",
    gameplayNote: "Reduced traction — braking distances grow.",
  },
  storm: {
    state: "storm",
    label: "Thunderstorm",
    description: "Lightning splits the sky over the bay.",
    icon: "⛈️",
    gameplayNote: "Low traction + random lightning flashes. Chaos.",
  },
  fog: {
    state: "fog",
    label: "Fog Bank",
    description: "Thick fog rolls in off the water.",
    icon: "🌫️",
    gameplayNote: "Visibility drops hard — great for heists.",
  },
  heat: {
    state: "heat",
    label: "Heat Wave",
    description: "Shimmering heat, hazy air.",
    icon: "🥵",
    gameplayNote: "NPCs slow down; the city feels drowsy.",
  },
  neon: {
    state: "neon",
    label: "Neon Night",
    description: "Overdrive — the whole city glows electric.",
    icon: "🌃",
    gameplayNote: "Nightlife districts light up. Pure vibes.",
  },
};

export const WEATHER_DURATION_MS = 10 * 60 * 1000;
export const WEATHER_COOLDOWN_MS = 30 * 60 * 1000;
const TRANSITION_SEC = 20;

/** Can this firm/player change the weather right now? */
export function canControlWeather(
  weatherFirmId: string | null,
  playerInWeatherFirm: boolean,
  lastChangeAt: number,
  now: number = Date.now()
): { ok: boolean; reason: string } {
  if (!weatherFirmId) return { ok: false, reason: "No firm holds the weather machine — win a turf war to claim it." };
  if (!playerInWeatherFirm)
    return { ok: false, reason: `Weather is controlled by ${weatherFirmId}. Your firm doesn't hold the machine.` };
  const since = now - lastChangeAt;
  if (since < WEATHER_COOLDOWN_MS) {
    const mins = Math.ceil((WEATHER_COOLDOWN_MS - since) / 60000);
    return { ok: false, reason: `Weather machine recharging — ${mins}m remaining.` };
  }
  return { ok: true, reason: "" };
}

/* ------------------------------------------------------------------ */
/* Scene application — one persistent handle, blend between states      */
/* ------------------------------------------------------------------ */

interface RainDrop {
  points: THREE.Points;
  speed: number;
}

export function startWeatherController(host: EventsSceneHost): WeatherController {
  const group = new THREE.Group();
  host.scene.add(group);

  const controller = new WeatherController(host, group);
  return controller;
}

export class WeatherController implements CityEffectHandle {
  private host: EventsSceneHost;
  private group: THREE.Group;
  private current: WeatherState = "clear";
  private target: WeatherState = "clear";
  private blend = 1; // 1 = fully at current
  private rain: RainDrop | null = null;
  private lightningTimer = 0;
  private flash: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight | null = null;
  private origFog: THREE.Fog | null = null;
  private neonBoost = 0;
  private disposed = false;

  constructor(host: EventsSceneHost, group: THREE.Group) {
    this.host = host;
    this.group = group;
    this.flash = new THREE.DirectionalLight(0xffffff, 0);
    this.flash.position.set(50, 120, 30);
    group.add(this.flash);
    host.scene.fog?.clone?.();
  }

  getCurrent(): WeatherState {
    return this.current;
  }
  getTarget(): WeatherState {
    return this.target;
  }

  setWeather(next: WeatherState) {
    if (next === this.target) return;
    this.target = next;
    this.blend = 0;
    this.host.playSound("weather-switch", 0.6);
  }

  update(dt: number): boolean {
    if (this.disposed) return false;
    // blend toward target
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / TRANSITION_SEC);
      if (this.blend >= 1) this.current = this.target;
    }
    const active: WeatherState = this.blend < 1 ? this.target : this.current;
    const scene = this.host.scene;

    // --- fog ---
    const fogDensity: Record<WeatherState, number> = {
      clear: 0,
      rain: 0.0016,
      storm: 0.0028,
      fog: 0.011,
      heat: 0.002,
      neon: 0.004,
    };
    if (!scene.fog) scene.fog = new THREE.FogExp2(0x0b1020, 0);
    const fog = scene.fog as THREE.FogExp2;
    fog.density += (fogDensity[active] - fog.density) * Math.min(1, dt * 0.8);

    // --- sky / light tint ---
    const tint: Record<WeatherState, number> = {
      clear: 0x87b5e0,
      rain: 0x5a6a80,
      storm: 0x3a4152,
      fog: 0x8d99a8,
      heat: 0xe8c48a,
      neon: 0x1a0f2e,
    };
    const targetColor = new THREE.Color(tint[active]);
    if (scene.background instanceof THREE.Color) {
      (scene.background as THREE.Color).lerp(targetColor, Math.min(1, dt * 0.5));
    }

    // --- rain particles ---
    const wantRain = active === "rain" || active === "storm";
    if (wantRain && !this.rain) this.rain = this.makeRain();
    if (!wantRain && this.rain) {
      this.group.remove(this.rain.points);
      this.rain.points.geometry.dispose();
      (this.rain.points.material as THREE.Material).dispose();
      this.rain = null;
    }
    if (this.rain) {
      const attr = this.rain.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const p = new THREE.Vector3();
      this.host.getPlayerPosition(p);
      const speed = this.rain.speed * (active === "storm" ? 1.6 : 1);
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= speed * dt;
        if (arr[i + 1] < 0) {
          arr[i] = p.x + (Math.random() - 0.5) * 120;
          arr[i + 1] = 40 + Math.random() * 20;
          arr[i + 2] = p.z + (Math.random() - 0.5) * 120;
        }
      }
      attr.needsUpdate = true;
      this.rain.points.position.set(0, 0, 0);
    }

    // --- lightning ---
    if (active === "storm") {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 1.5 + Math.random() * 5;
        this.flash.intensity = 4 + Math.random() * 4;
        this.host.shakeCamera(0.12, 250);
      }
    }
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 14);

    // --- neon boost: raise emissive-driven lights' feel via ambient ---
    const wantNeon = active === "neon" ? 1 : 0;
    this.neonBoost += (wantNeon - this.neonBoost) * Math.min(1, dt * 0.6);
    if (this.neonBoost > 0.01 && !this.hemi) {
      this.hemi = new THREE.HemisphereLight(0x7c3aed, 0x0b1020, 0);
      this.group.add(this.hemi);
    }
    if (this.hemi) this.hemi.intensity = this.neonBoost * 0.9;

    return true; // persistent until disposed
  }

  private makeRain(): RainDrop {
    const count = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0x9db8d9, size: 0.35, transparent: true, opacity: 0.7 })
    );
    this.group.add(points);
    return { points, speed: 55 };
  }

  dispose() {
    this.disposed = true;
    this.host.scene.remove(this.group);
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh | THREE.Points;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    // leave scene fog/background as-is (world persists)
  }
}
