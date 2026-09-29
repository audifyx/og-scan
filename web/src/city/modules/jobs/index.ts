/**
 * OrbitXCity jobs module — public entry (pure TS, no JSX — the React shell
 * lives in JobsModule.tsx so this barrel stays build-safe as index.ts).
 *
 * Usage (integrator): mount <JobsModule api={api} /> anywhere in the GTA
 * screen. It renders its own floating 💼 button (data-hud so core orbit-drag
 * ignores it), the job board sheet, the active job panel, and the toast
 * stack. Everything is additive: jobs never touch player/vehicle control.
 */
import type { ComponentType } from "react";
import type { JobId, JobMeta, JobProps } from "./types";

import TaxiJob, { TAXI_META } from "./TaxiJob";
import TraderJob, { TRADER_META } from "./TraderJob";
import DetectiveJob, { DETECTIVE_META } from "./DetectiveJob";
import RepoJob, { REPO_META } from "./RepoJob";
import PaparazziJob, { PAPARAZZI_META } from "./PaparazziJob";
import CriticJob, { CRITIC_META } from "./CriticJob";
import FoodTruckJob, { FOODTRUCK_META } from "./FoodTruckJob";
import RestaurantJob, { RESTAURANT_META } from "./RestaurantJob";
import RealEstateJob, { REALESTATE_META } from "./RealEstateJob";
import InstructorJob, { INSTRUCTOR_META } from "./InstructorJob";
import LifeguardJob, { LIFEGUARD_META } from "./LifeguardJob";

export interface JobEntry {
  meta: JobMeta;
  Component: ComponentType<JobProps>;
}

export const JOBS: JobEntry[] = [
  { meta: TAXI_META, Component: TaxiJob },
  { meta: TRADER_META, Component: TraderJob },
  { meta: DETECTIVE_META, Component: DetectiveJob },
  { meta: REPO_META, Component: RepoJob },
  { meta: PAPARAZZI_META, Component: PaparazziJob },
  { meta: CRITIC_META, Component: CriticJob },
  { meta: FOODTRUCK_META, Component: FoodTruckJob },
  { meta: RESTAURANT_META, Component: RestaurantJob },
  { meta: REALESTATE_META, Component: RealEstateJob },
  { meta: INSTRUCTOR_META, Component: InstructorJob },
  { meta: LIFEGUARD_META, Component: LifeguardJob },
];

export function getJob(id: JobId): JobEntry | undefined {
  return JOBS.find((j) => j.meta.id === id);
}

export { default as JobsModule } from "./JobsModule";

export type { JobId, JobMeta, JobProps, Buff, Toast } from "./types";
export { getCity, fmtCity, jobLevel, jobXp } from "./wallet";
