const KEY = "orbitx.education.progress.v1";

export type LessonStatus = "not_started" | "in_progress" | "completed";

export type EducationProgress = {
  version: 1;
  started: Record<string, number>;
  completed: Record<string, number>;
};

export const LEVELS = ["Beginner", "Explorer", "Trader", "Power User", "OrbitX Expert"] as const;
export type OrbitXLevel = (typeof LEVELS)[number];

function empty(): EducationProgress {
  return { version: 1, started: {}, completed: {} };
}

export function loadProgress(): EducationProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as EducationProgress;
    if (parsed?.version !== 1) return empty();
    return {
      version: 1,
      started: parsed.started ?? {},
      completed: parsed.completed ?? {},
    };
  } catch {
    return empty();
  }
}

export function saveProgress(next: EducationProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("orbitx-edu-progress"));
  } catch {
    /* quota / private mode */
  }
}

export function lessonStatus(p: EducationProgress, id: string): LessonStatus {
  if (p.completed[id]) return "completed";
  if (p.started[id]) return "in_progress";
  return "not_started";
}

export function markStarted(id: string): EducationProgress {
  const p = loadProgress();
  if (!p.started[id] && !p.completed[id]) {
    p.started[id] = Date.now();
    saveProgress(p);
  }
  return p;
}

export function markCompleted(id: string): EducationProgress {
  const p = loadProgress();
  p.completed[id] = Date.now();
  delete p.started[id];
  saveProgress(p);
  return p;
}

export function toggleCompleted(id: string): EducationProgress {
  const p = loadProgress();
  if (p.completed[id]) {
    delete p.completed[id];
    p.started[id] = Date.now();
  } else {
    p.completed[id] = Date.now();
    delete p.started[id];
  }
  saveProgress(p);
  return p;
}

export function pathPercent(p: EducationProgress, ids: string[]): number {
  if (!ids.length) return 0;
  const done = ids.filter((id) => p.completed[id]).length;
  return Math.round((done / ids.length) * 100);
}

export function overallStats(p: EducationProgress, total: number) {
  const completed = Object.keys(p.completed).length;
  const started = Object.keys(p.started).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  let level: OrbitXLevel = "Beginner";
  if (pct >= 80) level = "OrbitX Expert";
  else if (pct >= 55) level = "Power User";
  else if (pct >= 35) level = "Trader";
  else if (pct >= 15) level = "Explorer";
  return { completed, started, total, pct, level };
}
