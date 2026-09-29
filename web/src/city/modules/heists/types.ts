/**
 * ORBITXCITY — heists module shared types.
 * Self-contained: no imports from other modules. UI, engine, net and world
 * hooks all speak these shapes.
 */

export type HeistKind = "store" | "bank" | "casino" | "truck" | "data";

export type HeistStage =
  | "planning"
  | "casing"
  | "crew"
  | "setup"
  | "execution"
  | "getaway"
  | "cooldown"
  | "complete"
  | "failed";

export type CrewRole = "leader" | "driver" | "hacker" | "muscle" | "lookout" | "ghost";

export type Approach = "silent" | "loud" | "smart";

/* ---------------- crew ---------------- */

export interface CrewMember {
  id: string;
  name: string;
  /** true for the local player */
  isPlayer: boolean;
  /** true for LocalNet-simulated remote players (v1 co-op) */
  simulated?: boolean;
  role: CrewRole | null;
  /** 1-5 */
  skill: number;
  /** agreed cut, 0-100 (percent of loot) */
  cut: number;
  ready: boolean;
}

export interface RoleMeta {
  role: CrewRole;
  label: string;
  icon: string;
  blurb: string;
  /** which stat the role leans on */
  stat: string;
}

/* ---------------- templates ---------------- */

export interface CasingTask {
  id: string;
  label: string;
  hint: string;
  done: boolean;
}

export interface StageObjective {
  id: string;
  label: string;
  done: boolean;
  optional?: boolean;
}

export interface StageDef {
  stage: HeistStage;
  label: string;
  objectives: string[];
  tip?: string;
}

export interface PremiumEntry {
  /** whole ORBITX burned on entry (backend-signed, no popup) */
  amount: number;
  sku: string;
  label: string;
}

export interface HeistTemplate {
  id: string;
  kind: HeistKind;
  name: string;
  tagline: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  minCrew: number;
  maxCrew: number;
  suggestedRoles: CrewRole[];
  approaches: Approach[];
  /** paper CITY */
  baseLootCity: number;
  /** heat added on a loud finish, 0-100 */
  heatGain: number;
  cooldownSec: number;
  casing: Array<Omit<CasingTask, "done">>;
  stages: StageDef[];
  /** real-ORBITX entry fee; null = paper CITY only */
  premiumEntry?: PremiumEntry | null;
  /** heist can drop intel items */
  intelReward?: boolean;
  locationLabel: string;
}

/* ---------------- plan & session ---------------- */

export interface HeistPlan {
  templateId: string;
  approach: Approach;
  crew: CrewMember[];
  casing: CasingTask[];
  startedAt: number;
}

export type SessionStatus = "active" | "complete" | "failed";

export interface HeistSession {
  id: string;
  plan: HeistPlan;
  stage: HeistStage;
  objectives: StageObjective[];
  /** paper CITY grabbed so far */
  lootCollected: number;
  /** 0-100 */
  heat: number;
  /** 0-100, casino/vault alarm */
  alarm: number;
  startedAt: number;
  updatedAt: number;
  status: SessionStatus;
  failReason?: string;
  /** 0-1 escape progress during getaway */
  getawayProgress: number;
  log: string[];
}

export interface LootPayout {
  memberId: string;
  name: string;
  cut: number;
  amount: number;
}

export interface HeistResult {
  sessionId: string;
  templateId: string;
  templateName: string;
  success: boolean;
  /** paper CITY */
  totalLoot: number;
  payouts: LootPayout[];
  heatAftermath: number;
  intelGained: IntelItem[];
  durationSec: number;
  failReason?: string;
}

/* ---------------- intel / data heists ---------------- */

export type IntelEffectKind = "casing-boost" | "heat-cut" | "casino-schedule" | "fence-bonus";

export interface IntelEffect {
  kind: IntelEffectKind;
  /** 0-1 strength */
  magnitude: number;
  label: string;
}

export interface IntelItem {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  crewId: string;
  /** paper CITY fence value */
  valueCity: number;
  expiresAt: number;
  effect: IntelEffect;
  used?: boolean;
}

export interface RivalCrew {
  id: string;
  name: string;
  territory: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  color: string;
  blurb: string;
}

export interface Fence {
  id: string;
  name: string;
  specialty: string;
  /** tier -> price multiplier */
  demand: Record<number, number>;
  /** fence fee 0-1 */
  cut: number;
}

export interface DataOp {
  id: string;
  crewId: string;
  name: string;
  objectives: string[];
  guardCount: number;
  intelDrops: number;
}

/* ---------------- armored trucks ---------------- */

export interface TruckWaypoint {
  x: number;
  z: number;
}

export type TruckStatus = "roaming" | "breached" | "looted" | "fled";

export interface ArmoredTruck {
  id: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  guards: number;
  lootEstimate: number;
  status: TruckStatus;
  route: TruckWaypoint[];
  wp: number;
  spawnedAt: number;
}

export interface BreachResult {
  success: boolean;
  guardsDown: number;
  lootSpilled: number;
  heatSpike: number;
  log: string[];
}

/* ---------------- co-op / net ---------------- */

export interface NetMessage {
  v: 1;
  kind: string;
  from: string;
  fromName: string;
  at: number;
  payload: Record<string, unknown>;
}

export interface NetAdapter {
  readonly peerId: string;
  /** true when remote peers are simulated locally (v1) */
  readonly simulated: boolean;
  host(): Promise<string>;
  join(code: string): Promise<void>;
  send(kind: string, payload: Record<string, unknown>): void;
  onMessage(cb: (m: NetMessage) => void): () => void;
  leave(): void;
  dispose(): void;
}

export interface CoopSnapshot {
  code: string | null;
  isHost: boolean;
  members: CrewMember[];
  started: boolean;
  simulated: boolean;
}

/* ---------------- world adapter (duck-typed, satisfied by core) ---------------- */

export interface HeistPlayerState {
  onFoot: boolean;
  x: number;
  z: number;
  heading: number;
  speed: number;
  speedKmh: number;
  isNight: boolean;
}

export interface HeistWorldLike {
  getPlayerState(): HeistPlayerState;
  teleport(x: number, z: number, heading?: number): void;
  scene: import("three").Scene;
}

/* ---------------- director snapshot (for React UI) ---------------- */

export interface DirectorSnapshot {
  session: HeistSession | null;
  lastResult: HeistResult | null;
  trucks: ArmoredTruck[];
  intel: IntelItem[];
  balance: number;
  coop: CoopSnapshot | null;
  /** ambient city heat 0-100 from recent heist activity */
  ambientHeat: number;
  billingReady: boolean;
}
