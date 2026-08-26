import type { EduNode } from "./types";
import { TELEGRAM_COMMANDS, LEARNING_PATHS, eduHref } from "./catalog";

export type SearchHit = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  category: string;
  difficulty?: string;
  time?: string;
  kind: "guide" | "tool" | "academy" | "command" | "path";
};

function score(q: string, ...fields: string[]): number {
  const n = q.trim().toLowerCase();
  if (!n) return 0;
  const tokens = n.split(/\s+/).filter((t) => t.length > 1);
  let s = 0;
  for (const f of fields) {
    const t = f.toLowerCase();
    if (t === n) s += 100;
    else if (t.startsWith(n)) s += 40;
    else if (t.includes(n)) s += 18;
    else {
      const hit = tokens.filter((tok) => t.includes(tok)).length;
      if (hit) s += hit * 8;
    }
  }
  return s;
}

export function searchEducation(q: string, nodes: EduNode[]): SearchHit[] {
  const query = q.trim();
  if (!query) return [];
  const hits: Array<SearchHit & { _s: number }> = [];

  for (const n of nodes) {
    if (!n.published) continue;
    const s = score(
      query,
      n.title,
      n.description,
      n.what,
      n.why,
      n.when,
      n.category,
      ...(n.tags ?? []),
      ...(n.features ?? []),
      ...(n.useCases ?? []),
    );
    if (s > 0) {
      hits.push({
        id: n.id,
        title: n.title,
        subtitle: n.description,
        href: eduHref(n),
        category: n.category,
        difficulty: n.difficulty,
        time: `${n.estimatedMinutes} min`,
        kind: n.kind === "workflow" ? "guide" : n.kind,
        _s: s,
      });
    }
  }

  for (const c of TELEGRAM_COMMANDS) {
    const s = score(query, c.command, c.does, c.example, c.scope);
    if (s > 0) {
      hits.push({
        id: `cmd-${c.command}`,
        title: c.command,
        subtitle: c.does,
        href: "/education/academy/telegram",
        category: "automation",
        kind: "command",
        _s: s + 8,
      });
    }
  }

  for (const p of LEARNING_PATHS) {
    const s = score(query, p.title, p.kicker, p.description, p.cta);
    if (s > 0) {
      hits.push({
        id: p.id,
        title: p.title,
        subtitle: p.description,
        href: `/education/path/${p.slug}`,
        category: "all",
        kind: "path",
        _s: s + 6,
      });
    }
  }

  hits.sort((a, b) => b._s - a._s);
  return hits.slice(0, 24).map(({ _s, ...rest }) => rest);
}
