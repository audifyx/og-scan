import { useEffect, useRef } from "react";
import { cityAudio } from "./cityAudio";
import { virtualInput } from "./input";
import { useVehicleStore } from "./vehicleStore";

const STEP_INTERVAL_MS = 430;
const STEP_INTERVAL_SPRINT_MS = 300;
const ENGINE_IDLE_MS = 1500;

/**
 * Read normalized vehicle speed (0..1) from the vehicle store:
 * active car's |speed| / topSpeed while driving, else 0.
 */
function readCarSpeedNorm(): number {
  try {
    const s = useVehicleStore.getState();
    if (s.mode !== "driving" || !s.activeCarId) return 0;
    const body = s.cars[s.activeCarId];
    const spec = s.specs[s.activeCarId];
    if (!body || !spec || !spec.topSpeed) return 0;
    return Math.min(1, Math.abs(body.speed) / spec.topSpeed);
  } catch {
    return 0;
  }
}

/**
 * useCityAudioEvents — frame-level audio glue for OrbitX City.
 *
 * Runs a single rAF loop while the world is live:
 *  - Engine hum: polls normalized speed from the vehicle store
 *    (useVehicleStore: active car |speed| / topSpeed while driving).
 *    Starts the hum when speed > 0, pitches it with speed, stops after idle.
 *  - Footsteps: when the player is moving on foot (virtualInput axes active,
 *    not driving), fires cityAudio.footstep() on a walk-cycle cadence
 *    (faster while sprinting). This is a fallback — if the character worker
 *    calls cityAudio.footstep() directly on its own step events, the internal
 *    110ms throttle keeps both sources musical instead of stacking.
 *
 * Callers: mount once inside the world (CityAudioController does this).
 */
export function useCityAudioEvents(enabled: boolean): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    let raf = 0;
    let lastStepAt = 0;
    let lastEngineActiveAt = 0;
    let engineOn = false;

    // Vehicle store is live — register its speed source so engine hum follows
    // real physics (falls back to 0 / silence when on foot).
    cityAudio.registerVehicleSpeedSource(readCarSpeedNorm);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!enabledRef.current) {
        if (engineOn) {
          cityAudio.engineStop();
          engineOn = false;
        }
        return;
      }
      const now = performance.now();

      // Engine hum follows the vehicle speed source (0 when no car / no worker yet).
      const speed = cityAudio.getVehicleSpeed();
      if (speed > 0.03) {
        if (!engineOn) {
          cityAudio.engineStart();
          engineOn = true;
        }
        cityAudio.engineSetSpeed(speed);
        lastEngineActiveAt = now;
      } else if (engineOn && now - lastEngineActiveAt > ENGINE_IDLE_MS) {
        cityAudio.engineStop();
        engineOn = false;
      }

      // Footstep cadence for on-foot movement.
      const moving =
        !virtualInput.driving &&
        virtualInput.axisX * virtualInput.axisX + virtualInput.axisZ * virtualInput.axisZ > 0.04;
      if (moving) {
        const interval = virtualInput.sprint ? STEP_INTERVAL_SPRINT_MS : STEP_INTERVAL_MS;
        if (now - lastStepAt >= interval) {
          lastStepAt = now;
          cityAudio.footstep();
        }
      } else {
        lastStepAt = 0;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cityAudio.registerVehicleSpeedSource(null);
      if (engineOn) cityAudio.engineStop();
    };
  }, []);
}
