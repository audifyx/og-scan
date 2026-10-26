/**
 * OS wave 4 components — Tasks, Calendar, mini calendar, shortcuts list,
 * quote of the day. All device-local (localStorage via osStore); no new
 * backend, no new Supabase tables, no money movement.
 *
 * Idea bank: #1161 (Tasks), #1176 (Calendar), #56 (mini calendar),
 * #19 (shortcuts), #1010 (quote widget).
 */
import { useState } from "react";
import type { OsCalEvent, OsTask } from "./osStore";

/** Local date → YYYY-MM-DD (no UTC shift, unlike toISOString). */
export function isoDay(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Days from today until an ISO date (negative = past). */
export function daysUntil(iso: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1).getTime();
  return Math.round((target - today) / 86400000);
}

/* ------------------------------------------------------------------ */
/* Tasks (#1161)                                                       */
/* ------------------------------------------------------------------ */

export function TasksApp({ tasks, onChange }: { tasks: OsTask[]; onChange: (t: OsTask[]) => void }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const shown = tasks
    .filter((t) => (filter === "all" ? true : filter === "done" ? t.done : !t.done))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.createdAt - b.createdAt);
  const openCount = tasks.filter((t) => !t.done).length;
  const add = () => {
    if (!title.trim()) return;
    onChange([
      {
        id: `task-${Date.now().toString(36)}`,
        title: title.trim(),
        done: false,
        priority,
        due: due || undefined,
        createdAt: Date.now(),
      },
      ...tasks,
    ]);
    setTitle("");
    setDue("");
  };
  return (
    <div className="oxos-tasks">
      <p className="oxos-hint">
        {openCount} open task{openCount === 1 ? "" : "s"} · device-local
      </p>
      <div className="oxos-tasks__form">
        <input
          className="oxos-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="New task…"
        />
        <input className="oxos-input" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <select
          className="oxos-input"
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
          aria-label="Priority"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <button type="button" className="oxos-btn" onClick={add} disabled={!title.trim()}>
          Add
        </button>
      </div>
      <div className="oxos-tasks__filters">
        {(["open", "done", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`oxos-btn oxos-btn--ghost${filter === f ? " is-on" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "open" ? "Open" : f === "done" ? "Done" : "All"}
          </button>
        ))}
      </div>
      <div className="oxos-tasks__list">
        {shown.map((t) => (
          <div key={t.id} className={`oxos-tasks__row${t.done ? " is-done" : ""}`}>
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => onChange(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
              aria-label="Done"
            />
            <span className="oxos-tasks__title">{t.title}</span>
            {t.due && <span className="oxos-tasks__due">{t.due}</span>}
            <span className={`oxos-tasks__pri oxos-tasks__pri--${t.priority}`}>{t.priority}</span>
            <button
              type="button"
              className="oxos-tasks__del"
              title="Delete task"
              onClick={() => onChange(tasks.filter((x) => x.id !== t.id))}
            >
              ✕
            </button>
          </div>
        ))}
        {!shown.length && <p className="oxos-hint">Nothing here — add a task above.</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar (#1176)                                                    */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${`${month + 1}`.padStart(2, "0")}-${`${d}`.padStart(2, "0")}`);
  return cells;
}

export function CalendarApp({ events, onChange }: { events: OsCalEvent[]; onChange: (e: OsCalEvent[]) => void }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(isoDay(now));
  const [title, setTitle] = useState("");
  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString([], { month: "long", year: "numeric" });
  const cells = monthGrid(cursor.y, cursor.m);
  const dayEvents = events.filter((e) => e.date === selected).sort((a, b) => a.title.localeCompare(b.title));
  const step = (dir: number) => {
    const next = new Date(cursor.y, cursor.m + dir, 1);
    setCursor({ y: next.getFullYear(), m: next.getMonth() });
  };
  const add = () => {
    if (!title.trim()) return;
    onChange([...events, { id: `ev-${Date.now().toString(36)}`, date: selected, title: title.trim() }]);
    setTitle("");
  };
  return (
    <div className="oxos-cal">
      <div className="oxos-cal__head">
        <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => step(-1)}>
          ←
        </button>
        <strong>{monthName}</strong>
        <button type="button" className="oxos-btn oxos-btn--ghost" onClick={() => step(1)}>
          →
        </button>
      </div>
      <div className="oxos-cal__grid">
        {WEEKDAYS.map((d) => (
          <span key={d} className="oxos-cal__wd">
            {d}
          </span>
        ))}
        {cells.map((iso, i) =>
          iso ? (
            <button
              key={iso}
              type="button"
              className={`oxos-cal__day${iso === isoDay(now) ? " is-today" : ""}${iso === selected ? " is-on" : ""}${events.some((e) => e.date === iso) ? " has-event" : ""}`}
              onClick={() => setSelected(iso)}
            >
              {Number(iso.slice(-2))}
            </button>
          ) : (
            <span key={`blank-${i}`} />
          ),
        )}
      </div>
      <h3 className="oxos-h3">{selected}</h3>
      <div className="oxos-cal__events">
        {dayEvents.map((e) => (
          <div key={e.id} className="oxos-row">
            <span className="oxos-row__meta">
              <span className="oxos-row__title">{e.title}</span>
            </span>
            <button
              type="button"
              className="oxos-btn oxos-btn--ghost"
              onClick={() => onChange(events.filter((x) => x.id !== e.id))}
            >
              Delete
            </button>
          </div>
        ))}
        {!dayEvents.length && <p className="oxos-hint">Nothing on this day — add one below.</p>}
      </div>
      <div className="oxos-cal__form">
        <input
          className="oxos-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="New event…"
        />
        <button type="button" className="oxos-btn" onClick={add} disabled={!title.trim()}>
          Add
        </button>
      </div>
      <p className="oxos-hint">Events are device-local.</p>
    </div>
  );
}

/** Compact read-only month view for the tray calendar panel (#56). */
export function MiniCal() {
  const now = new Date();
  const cells = monthGrid(now.getFullYear(), now.getMonth());
  const monthName = now.toLocaleDateString([], { month: "long", year: "numeric" });
  return (
    <div className="oxos-cal">
      <div className="oxos-cal__head">
        <strong>{monthName}</strong>
      </div>
      <div className="oxos-cal__grid">
        {WEEKDAYS.map((d) => (
          <span key={d} className="oxos-cal__wd">
            {d}
          </span>
        ))}
        {cells.map((iso, i) =>
          iso ? (
            <span key={iso} className={`oxos-cal__day${iso === isoDay(now) ? " is-today" : ""}`}>
              {Number(iso.slice(-2))}
            </span>
          ) : (
            <span key={`blank-${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shortcuts (#19) — only behaviors the OS actually implements.        */
/* ------------------------------------------------------------------ */

export function ShortcutsBody() {
  const rows: [string, string][] = [
    ["⌘K / Ctrl+K", "Open or close Start"],
    ["Esc", "Close Start"],
    ["Drag a window's title bar", "Move the window"],
    ["Drag a window's edge or corner", "Resize the window"],
    ["— (top-right of a window)", "Minimize the window"],
    ["▢ (top-right of a window)", "Maximize / restore the window"],
    ["✕ (top-right of a window)", "Close the window"],
    ["⌘ button (taskbar)", "Open the command bar"],
    ["Command bar: token <name>", "Search tokens, open one in the DEX"],
    ["Command bar: calc 2+2", "Calculator — tap the result to copy it"],
    ["Taskbar: Desktops (❐)", "Switch desktops, move windows, save layouts"],
    ["Taskbar: ▦", "Open the App Store"],
    ["Start search", "Find apps, settings sections, and tokens"],
  ];
  return (
    <div className="oxos-shortcuts">
      <h3 className="oxos-h3">Keyboard shortcuts</h3>
      <p className="oxos-hint">Every shortcut the OS actually supports — nothing listed here is aspirational.</p>
      <div className="oxos-shortcuts__list">
        {rows.map(([key, what]) => (
          <div key={key} className="oxos-shortcuts__row">
            <kbd>{key}</kbd>
            <span>{what}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quote of the day (#1010) — original lines, no fake attributions.    */
/* ------------------------------------------------------------------ */

export const QUOTES: string[] = [
  "Ship it, then make it better.",
  "The chart rewards the patient and punishes the rushed.",
  "Small positions, clear plans, no revenge trades.",
  "Build in public. The crowd finds what's real.",
  "A wallet you control is a wallet you own.",
  "Do the boring work: backup, verify, then transact.",
  "Every expert was once confused by their first swap.",
  "Risk first, reward second — always in that order.",
  "The best trade is sometimes no trade.",
  "Own the address. Own the app. Own the outcome.",
  "Volume is noise; conviction is signal.",
  "Write it down: plans beat feelings.",
  "Security is a habit, not a feature.",
  "One percent better every day compounds too.",
];

export function quoteOfDay(): string {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
