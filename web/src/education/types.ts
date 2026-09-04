export type EduStatus = "live" | "coming_soon" | "desk";
export type EduKind = "tool" | "guide" | "workflow" | "academy";
export type Difficulty = "beginner" | "trader" | "creator" | "advanced";
export type EduCategory =
  | "trading"
  | "research"
  | "onchain"
  | "launch"
  | "automation"
  | "social"
  | "prediction"
  | "games"
  | "developer";

export type DemoKind =
  | "none"
  | "scanner"
  | "dex"
  | "launch"
  | "claim"
  | "telegram"
  | "mcp"
  | "wallet"
  | "workflow";

export type EduStep = {
  title: string;
  body: string;
  hotspot?: string;
};

export type EduNode = {
  id: string;
  kind: EduKind;
  title: string;
  slug: string;
  category: EduCategory;
  subcategory?: string;
  description: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  icon: string;
  href?: string;
  status: EduStatus;
  what: string;
  why: string;
  when: string;
  steps: EduStep[];
  features: string[];
  useCases: string[];
  related: string[];
  prerequisites: string[];
  next: string[];
  demo: DemoKind;
  tags: string[];
  published: boolean;
};

export type LearningPath = {
  id: string;
  slug: string;
  title: string;
  kicker: string;
  description: string;
  cta: string;
  tone: "beginner" | "trader" | "creator" | "power";
  nodes: string[];
};

export type WorkflowStage = {
  id: string;
  title: string;
  body: string;
  nodeId?: string;
  href?: string;
};

export type Workflow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  stages: WorkflowStage[];
};

export type DecisionIntent = {
  id: string;
  prompt: string;
  result: string;
  nodeIds: string[];
};

export type TelegramCommand = {
  command: string;
  scope: "group" | "dm";
  does: string;
  example: string;
};

export type MapCluster = {
  id: string;
  label: string;
  nodes: { id: string; label: string; href?: string; nodeId?: string }[];
};

export type ProgressSnapshot = {
  started: string[];
  completed: string[];
};
