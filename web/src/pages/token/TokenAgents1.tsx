import { useEffect, useMemo, useState } from "react";
import { Users, Smile, MessageCircle, Moon, BookOpen, Target, Zap, TrendingUp, Clock3, Cookie, PawPrint, Swords, Tag, Cake, BedDouble, Inbox, Shirt, ScrollText, Palmtree, Dumbbell, Library, ListMusic, Sprout, PackageSearch, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvatarStats } from "./LivingAvatar";

const LS = (k: string) => `orbitx-agents-${k}`;
function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(LS(key)); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(key: string, val: unknown) {
  try { localStorage.setItem(LS(key), JSON.stringify(val)); } catch { /* ignore */ }
}
function Shell({ icon: Icon, title, sub, children }: {
  icon: React.ComponentType<{ className?: string }>; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-extrabold">{title}</p>
          <p className="text-[11px] text-white/45">{sub}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
const AGENTS = [
  { role: "BUILDER", color: "#7c3aed", job: "Ships features at 3am", trait: "Caffeinated" },
  { role: "SCOUT", color: "#f59e0b", job: "Finds alpha before it trends", trait: "Nosy" },
  { role: "TRADER", color: "#ec4899", job: "Lives on the 1-minute chart", trait: "Itchy fingers" },
  { role: "GUARD", color: "#10b981", job: "Protects the supply", trait: "Paranoid" },
  { role: "MINER", color: "#3b82f6", job: "Digs burns out of the chain", trait: "Dusty" },
  { role: "ORACLE", color: "#ef4444", job: "Sees three candles ahead", trait: "Cryptic" },
  { role: "PILOT", color: "#14b8a6", job: "Flies the market cap", trait: "Reckless" },
];

function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function seededRand(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h |= 0; h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================== A1–A7 ============================== */

{/* A1 */}
export function AgentRoster() {
  const hour = new Date().getHours();
  const onDuty = hour >= 6 || hour < 2; // 6am–2am on duty, resting otherwise
  return (
    <Shell icon={Users} title="Agent Roster" sub="The full-time crew">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {AGENTS.map((a) => (
          <div key={a.role} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: a.color, boxShadow: `0 0 10px ${a.color}` }} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-extrabold">{a.role}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", onDuty ? "bg-emerald-400/15 text-emerald-300" : "bg-indigo-400/15 text-indigo-300")}>
                  {onDuty ? "ON DUTY" : "RESTING"}
                </span>
              </div>
              <p className="truncate text-[11px] text-white/45">{a.job}</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/60">{a.trait}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

{/* A2 */}
export function AgentMoods({ stats }: { stats?: AvatarStats }) {
  const chg = stats?.change24h ?? null;
  const idx = chg == null ? 1 : chg > 5 ? 0 : chg > 0 ? 1 : chg > -5 ? 2 : 3;
  const MOODS = [
    { e: "🤩", label: "PUMPED", line: "green candles hit like espresso shots" },
    { e: "🙂", label: "CONTENT", line: "chart is breathing normally, coffee tastes fine" },
    { e: "😟", label: "UNEASY", line: "refreshing DexScreener way too often" },
    { e: "😱", label: "RATTLED", line: "hiding under the desk until the wick recovers" },
  ];
  const m = MOODS[idx];
  return (
    <Shell icon={Smile} title="Agent Moods" sub={chg == null ? "vibes unmeasured — chart is napping" : `24h ${chg >= 0 ? "+" : ""}${chg.toFixed(2)}% sets the tone`}>
      <div className="space-y-1.5">
        {AGENTS.map((a) => (
          <div key={a.role} className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-3 py-2">
            <span className="text-xl leading-none">{m.e}</span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold"><span style={{ color: a.color }}>{a.role}</span> <span className="text-white/40">· {m.label}</span></p>
              <p className="text-[11px] text-white/55">{m.line.charAt(0).toUpperCase() + m.line.slice(1)}.</p>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const CHAT_QS = ["wen lambo?", "Should I buy the dip?", "Is ORBITX going to the moon?", "What keeps you up at night?"];
const CHAT_A: Record<string, string[][]> = {
  BUILDER: [
    ["Lambo is a UI problem. I'm shipping a faster chart first.", "After mainnet. The roadmap says so, and I wrote the roadmap."],
    ["The dip is just a feature request from the market.", "Buy the dip? I AM the dip — I deploy on red days."],
    ["The moon is a milestone on the roadmap, right after 'fix prod'.", "Define moon. My charts go up and to the right by default."],
    ["Unclosed divs. And GUARD's 4am 'quick questions'.", "A deploy with no rollback plan. Nightmare fuel."],
  ],
  SCOUT: [
    ["Saw three lambos in the group chat this morning. Bullish.", "Lambo? I called the color of it last week."],
    ["I bought the dip before it was a dip. That's the job.", "Dip's already gone, I front-ran your question."],
    ["To the moon? I filed the flight plan yesterday.", "Moon's priced in. I'm scouting Mars."],
    ["Missing alpha. It haunts me like an unread mention.", "A trending ticker I didn't see first. Shudders."],
  ],
  TRADER: [
    ["Sold the lambo to buy more dips. Rookie mistake, buying it back.", "Wen lambo? I paper-handed the keys in May."],
    ["I bought the dip, the dip dipped, I bought that too.", "Dip? That's just my entry getting better. Allegedly."],
    ["Moon is my stop-loss's final boss.", "To the moon, with leverage, obviously. Kidding. Mostly."],
    ["A 1-minute candle closing against me. Every night.", "Funding rates. They whisper."],
  ],
  GUARD: [
    ["Lambo doors are a security risk. Hard no.", "Only if the lambo's keys are in cold storage."],
    ["The dip has been audited. Proceed with caution.", "Verified dip. Still, DYOR — I can't guard your clicks."],
    ["The moon has no firewall. Suspicious.", "Moon trajectory looks clean. For now."],
    ["Rug pulls. I dream in honeypot bytecode.", "Someone, somewhere, just clicked a suspicious link."],
  ],
  MINER: [
    ["Found a lambo-shaped block once. It was a mirage.", "Lambo runs on hopium; I run on chain data."],
    ["Dug through the mempool — the dip is legit.", "Every dip leaves fossils. I collect them."],
    ["The moon is just a very large, very shiny block.", "My pickaxe says yes. My dust says maybe."],
    ["An unconfirmed transaction. Forever pending.", "Orphaned blocks. They deserved better."],
  ],
  ORACLE: [
    ["I have seen the lambo. It is yellow. The rest is unclear.", "The lambo comes to those who stake. Cryptic? Yes."],
    ["The dip was foretold. You simply weren't listening.", "Buy the dip, said the prophecy. The prophecy is me."],
    ["Three candles ahead: green, greener, moon.", "The stars say moon. The stars have been right twice."],
    ["A future where nobody asks me questions. Unclear if good.", "The prophecy ends mid-sentence sometimes."],
  ],
  PILOT: [
    ["Lambo can't fly. Useless to me.", "We're not driving, we're FLYING. Keep up."],
    ["Dips are just turbulence. Buckle up.", "I buy dips at 30,000 feet. Metaphorically."],
    ["Moon? That's just my cruising altitude.", "Flight plan filed: straight up, no stops."],
    ["Running out of fuel mid-pump. Classic nightmare.", "A red candle the size of a mountain. I fly around it."],
  ],
};

{/* A3 */}
export function AgentChat() {
  const [role, setRole] = useState(AGENTS[0].role);
  const [qIdx, setQIdx] = useState(0);
  const [turn, setTurn] = useState(0);
  const [log, setLog] = useState<{ q: string; a: string; r: string }[]>([]);
  const ask = (i: number) => {
    const variants = CHAT_A[role][i];
    const a = variants[(turn + i) % variants.length];
    setQIdx(i); setTurn((t) => t + 1);
    setLog((l) => [{ q: CHAT_QS[i], a, r: role }, ...l].slice(0, 6));
  };
  const agent = AGENTS.find((a) => a.role === role)!;
  return (
    <Shell icon={MessageCircle} title="Ask an Agent" sub="Four questions, zero chill">
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a) => (
          <button key={a.role} onClick={() => setRole(a.role)}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", role === a.role ? "border-transparent text-black" : "border-white/15 text-white/60")}
            style={role === a.role ? { background: a.color } : undefined}>{a.role}</button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {CHAT_QS.map((q, i) => (
          <button key={q} onClick={() => ask(i)}
            className={cn("rounded-xl border px-2 py-1.5 text-[11px] font-semibold", qIdx === i && log.length ? "border-violet-400/40 bg-violet-400/10 text-violet-200" : "border-white/10 text-white/60")}>{q}</button>
        ))}
      </div>
      <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
        {log.length === 0 && <p className="text-[11px] text-white/35">Pick a question — <span style={{ color: agent.color }}>{role}</span> is waiting.</p>}
        {log.map((m, i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] p-2.5">
            <p className="text-[11px] font-bold text-white/70">you: {m.q}</p>
            <p className="mt-1 text-[11px] text-white/85"><span className="font-extrabold" style={{ color: AGENTS.find((a) => a.role === m.r)?.color }}>{m.r}:</span> {m.a}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const DREAMS = [
  "a chart that only went up, but every candle was a tiny screaming lambo",
  "swimming in a liquidity pool that was actually just lukewarm soup",
  "the burn wallet throwing a surprise party — for itself",
  "being chased by a giant red candle through an endless spreadsheet",
  "marrying a hardware wallet in a ceremony officiated by a smart contract",
  "a world where gas fees were paid in compliments",
  "teaching pigeons to read candlesticks on a park bench",
  "finding a seed phrase carved into the moon. Woke up before copying it",
  "an office where the coffee machine only accepted ORBITX",
  "rug-pullers getting chased by GUARD on tiny scooters, forever",
  "a DEX where every swap came with a fortune cookie",
  "flying a paper airplane made of a printed whitepaper",
];

{/* A4 */}
export function AgentDreams() {
  const key = todayKey();
  const dreams = useMemo(() => AGENTS.map((a) => {
    const r = seededRand(`${key}-${a.role}-dream`);
    return { ...a, dream: DREAMS[Math.floor(r() * DREAMS.length)] };
  }), [key]);
  return (
    <Shell icon={Moon} title="Dream Journal" sub={`last night at the office · ${key}`}>
      <div className="space-y-2">
        {dreams.map((d) => (
          <div key={d.role} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
            <p className="text-[11px] text-white/40">Last night <span className="font-extrabold" style={{ color: d.color }}>{d.role}</span> dreamed…</p>
            <p className="mt-0.5 text-[12px] italic text-white/80">“…{d.dream}.”</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

{/* A5 */}
export function AgentDiary({ stats }: { stats?: AvatarStats }) {
  const key = todayKey();
  const [log, setLog] = useState<Record<string, string[]>>(() => read("diary", {}));
  const [view, setView] = useState(key);
  const todays = useMemo(() => {
    const c = stats?.change24h, b = stats?.burned, m = stats?.mcap, p = stats?.price;
    return [
      `09:00 — Standup. ${c == null ? "Charts declined to comment. Sus." : c >= 0 ? `Green on the board (+${c.toFixed(2)}%). BUILDER is insufferable about it.` : `Red on the board (${c.toFixed(2)}%). TRADER insists this was the plan.`}`,
      `12:30 — Lunch. ${b == null ? "Burn wallet quiet; GUARD still watching it like a hawk." : `${(b / 1e6).toFixed(2)}M ORBITX confirmed torched. MINER did a victory lap around the desk.`}`,
      `15:45 — ${m == null ? "Market cap is playing hard to get." : m >= 1e6 ? "Seven figures on the cap. ORACLE claims they called it. Nobody believes them." : "Cap still grinding. PILOT filed a flight plan anyway."}`,
      `18:00 — ${p == null ? "Price feed napping; agents doodle rockets on napkins." : "Close of business. SCOUT is already hunting tomorrow's alpha."}`,
    ];
  }, [stats?.change24h, stats?.burned, stats?.mcap, stats?.price]);
  useEffect(() => {
    setLog((prev) => {
      if (prev[key]) return prev;
      const keys = [...Object.keys(prev), key].sort().slice(-7);
      const next: Record<string, string[]> = {};
      keys.forEach((k) => { next[k] = k === key ? todays : prev[k]; });
      write("diary", next);
      return next;
    });
  }, [key, todays]);
  const dates = Object.keys(log).sort().reverse();
  const shift = (dir: number) => {
    const i = dates.indexOf(view);
    const n = dates[Math.min(Math.max(i + dir, 0), dates.length - 1)];
    if (n) setView(n);
  };
  return (
    <Shell icon={BookOpen} title="Office Diary" sub="today in the office — 7 day archive">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => shift(1)} className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/60">← older</button>
        <p className="text-[11px] font-bold text-white/70">{view === key ? "today" : view}</p>
        <button onClick={() => shift(-1)} className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/60">newer →</button>
      </div>
      <div className="space-y-1.5">
        {(log[view] ?? todays).map((line, i) => (
          <p key={i} className="rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-white/75">{line}</p>
        ))}
      </div>
    </Shell>
  );
}

const GOALS: { role: string; goal: string; pct: number }[] = [
  { role: "BUILDER", goal: "ship 40 features without breaking prod", pct: 72 },
  { role: "SCOUT", goal: "call 100 tickers before they trend", pct: 88 },
  { role: "TRADER", goal: "hold a position longer than a coffee", pct: 34 },
  { role: "GUARD", goal: "zero paper hands admitted past the door", pct: 96 },
  { role: "MINER", goal: "dig up 1,000 historic burns", pct: 61 },
  { role: "ORACLE", goal: "be right 3 times in a row (record: 2)", pct: 66 },
  { role: "PILOT", goal: "land the market cap without turbulence", pct: 45 },
];

{/* A6 */}
export function AgentGoals() {
  return (
    <Shell icon={Target} title="Quarterly Goals" sub="Q4 — believe">
      <div className="space-y-2.5">
        {GOALS.map((g) => {
          const a = AGENTS.find((x) => x.role === g.role)!;
          return (
            <div key={g.role}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <p className="font-extrabold"><span style={{ color: a.color }}>{g.role}</span> <span className="font-normal text-white/50">— {g.goal}</span></p>
                <p className="font-bold text-white/70">{g.pct}%</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${g.pct}%`, background: a.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

const SKILL_NAMES = ["Chart Reading", "Meme Warfare", "Diamond Grip", "Coffee Brewing"];
const SKILL_VALS: Record<string, number[]> = {
  BUILDER: [88, 42, 70, 99], SCOUT: [76, 91, 55, 60], TRADER: [95, 68, 31, 84],
  GUARD: [58, 37, 100, 45], MINER: [64, 25, 89, 52], ORACLE: [81, 73, 66, 40], PILOT: [69, 80, 48, 71],
};

{/* A7 */}
export function AgentSkills() {
  const [role, setRole] = useState(AGENTS[0].role);
  const agent = AGENTS.find((a) => a.role === role)!;
  return (
    <Shell icon={Zap} title="Skill Matrix" sub="peer-reviewed, probably">
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a) => (
          <button key={a.role} onClick={() => setRole(a.role)}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", role === a.role ? "border-transparent text-black" : "border-white/15 text-white/60")}
            style={role === a.role ? { background: a.color } : undefined}>{a.role}</button>
        ))}
      </div>
      <div className="mt-3 space-y-2.5">
        {SKILL_NAMES.map((s, i) => (
          <div key={s}>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <p className="font-semibold text-white/70">{s}</p>
              <p className="font-bold" style={{ color: agent.color }}>{SKILL_VALS[role][i]}</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all" style={{ width: `${SKILL_VALS[role][i]}%`, background: agent.color }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-white/35">TRADER's Diamond Grip score is under internal review.</p>
    </Shell>
  );
}

/* ============================== A8–A14 ============================== */

const LEVELS = [10_000, 50_000, 200_000, 500_000, 1_000_000, 2_000_000];
const TIERS = ["Apprentice", "Adept", "Pro", "Master", "Legend", "Mythic", "Whale"];

{/* A8 */}
export function AgentLevelUp({ stats }: { stats?: AvatarStats }) {
  const mcap = stats?.mcap ?? null;
  const lvl = mcap == null ? 0 : LEVELS.filter((t) => mcap >= t).length; // 0..6
  const cur = lvl === 0 ? 0 : LEVELS[lvl - 1];
  const next = lvl >= LEVELS.length ? null : LEVELS[lvl];
  const pct = next == null ? 100 : Math.min(100, Math.max(0, ((mcap ?? 0) - cur) / (next - cur) * 100));
  const fmt = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1)}M` : `$${Math.round(n / 1e3)}k`;
  return (
    <Shell icon={TrendingUp} title="Agent Level-Up" sub={mcap == null ? "XP feed offline — training montage paused" : `collective XP: ${fmt(mcap)} mcap`}>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <p className="font-bold text-white/70">Lv{lvl} → Lv{lvl + 1 > 6 ? 6 : lvl + 1}</p>
        <p className="text-white/45">{next == null ? "MAX LEVEL — touch grass" : `${fmt(next)} to next`}</p>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-amber-300 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {AGENTS.map((a) => (
          <div key={a.role} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2">
            <p className="text-[11px] font-extrabold" style={{ color: a.color }}>{a.role}</p>
            <p className="text-[10px] text-white/55">{a.role} {TIERS[Math.min(lvl, 6)]}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

{/* A9 */}
export function AgentShifts() {
  const hour = new Date().getHours();
  const shifts = AGENTS.map((a, i) => ({ ...a, start: (6 + i * 2) % 24, len: 10 }));
  const onShift = (s: { start: number; len: number }) => ((hour - s.start + 24) % 24) < s.len;
  return (
    <Shell icon={Clock3} title="Shift Wheel" sub="24h coverage — someone is always watching the chart">
      <div className="flex gap-[3px]">
        {Array.from({ length: 24 }, (_, h) => {
          const covering = shifts.filter((s) => ((h - s.start + 24) % 24) < s.len);
          return (
            <div key={h} title={`${h}:00 — ${covering.map((c) => c.role).join(", ") || "skeleton crew"}`}
              className={cn("h-9 flex-1 rounded-md border", h === hour ? "border-white/60" : "border-white/[0.07]")}
              style={{ background: h === hour ? "rgba(255,255,255,0.25)" : covering.length ? `${covering[0].color}55` : "rgba(255,255,255,0.03)" }} />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/35"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
      <p className="mt-2 text-[11px] text-white/55">On shift now ({String(hour).padStart(2, "0")}:00):</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {shifts.filter(onShift).map((s) => (
          <span key={s.role} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-black" style={{ background: s.color }}>{s.role}</span>
        ))}
      </div>
    </Shell>
  );
}

const SNACKS = [
  { name: "Diamond-hand gummies", emoji: "🍬", stock: 12, out: "Gone. TRADER stress-ate them during a wick." },
  { name: "Cold brew IV drip", emoji: "🧋", stock: 8, out: "BUILDER finished it. BUILDER always finishes it." },
  { name: "Alpha nachos", emoji: "🧀", stock: 6, out: "SCOUT hid them. Check behind the monitors." },
  { name: "HODL jerky", emoji: "🥩", stock: 10, out: "GUARD confiscated it as 'evidence'." },
  { name: "Moon pies", emoji: "🥧", stock: 7, out: "PILOT ate them at cruising altitude." },
  { name: "Prophecy pretzels", emoji: "🥨", stock: 9, out: "ORACLE foresaw this shortage and said nothing." },
  { name: "Dust bunnies (MINER's)", emoji: "🐰", stock: 4, out: "They were never really snacks." },
];

{/* A10 */}
export function AgentSnacks() {
  const key = todayKey();
  const [box, setBox] = useState<Record<string, number>>(() => {
    const saved = read<{ date: string; stocks: Record<string, number> }>("snacks", { date: "", stocks: {} });
    if (saved.date === key) return saved.stocks;
    const fresh: Record<string, number> = {};
    SNACKS.forEach((s) => (fresh[s.name] = s.stock));
    return fresh;
  });
  const consume = (name: string) => {
    setBox((prev) => {
      const next = { ...prev, [name]: Math.max(0, (prev[name] ?? 0) - 1) };
      write("snacks", { date: key, stocks: next });
      return next;
    });
  };
  return (
    <Shell icon={Cookie} title="Snack Inventory" sub="restocks daily — allegedly">
      <div className="space-y-1.5">
        {SNACKS.map((s) => {
          const left = box[s.name] ?? s.stock;
          return (
            <div key={s.name} className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-3 py-2">
              <span className="text-xl leading-none">{s.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">{s.name}</p>
                <p className="text-[10px] text-white/40">{left > 0 ? `${left} left` : s.out}</p>
              </div>
              <button onClick={() => consume(s.name)} disabled={left === 0}
                className={cn("rounded-lg px-2.5 py-1 text-[11px] font-bold", left === 0 ? "cursor-not-allowed bg-white/5 text-white/25" : "bg-amber-400/20 text-amber-200 hover:bg-amber-400/30")}>
                {left === 0 ? "GONE" : "consume"}
              </button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

const PETS = [
  { role: "BUILDER", name: "Segfault", species: "glitch cat" },
  { role: "SCOUT", name: "Earwig", species: "gossip moth" },
  { role: "TRADER", name: "Margin", species: "anxious ferret" },
  { role: "GUARD", name: "Firewall", species: "armored tortoise" },
  { role: "MINER", name: "Pickaxe", species: "dust bunny (large)" },
  { role: "ORACLE", name: "Omen", species: "three-eyed owl" },
  { role: "PILOT", name: "Tailwind", species: "paper plane goose" },
];
const PET_MOODS = ["😴", "😐", "🙂", "🤩"];

{/* A11 */}
export function AgentPets() {
  const [pats, setPats] = useState<Record<string, number>>(() => read("pets", {}));
  const pet = (role: string) => {
    const n = pats[role] ?? 0;
    return PET_MOODS[Math.min(n, PET_MOODS.length - 1)];
  };
  return (
    <Shell icon={PawPrint} title="Desk Pets" sub="tap to pet the pet">
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {PETS.map((p) => {
          const a = AGENTS.find((x) => x.role === p.role)!;
          return (
            <button key={p.role} onClick={() => setPats((prev) => { const n = { ...prev, [p.role]: (prev[p.role] ?? 0) + 1 }; write("pets", n); return n; })}
              className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5 text-left hover:bg-white/[0.05]">
              <span className="text-2xl leading-none">{pet(p.role)}</span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold"><span style={{ color: a.color }}>{p.name}</span> <span className="font-normal text-white/40">· {p.species}</span></p>
                <p className="text-[10px] text-white/45">{p.role}'s companion · {(pats[p.role] ?? 0)} pats</p>
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

const RIVALRIES = [
  { a: "TRADER", b: "ORACLE", about: "who called the last pump first" },
  { a: "BUILDER", b: "PILOT", about: "whose deploys cause more turbulence" },
  { a: "SCOUT", b: "MINER", about: "who finds alpha deeper underground" },
];

{/* A12 */}
export function AgentRivalries() {
  const [scores, setScores] = useState<Record<string, [number, number]>>(() => read("rivalries", {}));
  const [flash, setFlash] = useState<string | null>(null);
  const settle = (i: number) => {
    const r = RIVALRIES[i];
    const winner = Math.random() < 0.5 ? 0 : 1;
    const key = `${r.a}-vs-${r.b}`;
    const cur = scores[key] ?? [0, 0];
    const next = winner === 0 ? [cur[0] + 1, cur[1]] : [cur[0], cur[1] + 1];
    const all = { ...scores, [key]: next as [number, number] };
    setScores(all); write("rivalries", all);
    setFlash(`${winner === 0 ? r.a : r.b} takes the round!`);
    setTimeout(() => setFlash(null), 2200);
  };
  return (
    <Shell icon={Swords} title="Rivalries" sub="settled with honor, occasionally">
      {flash && <p className="mb-2 rounded-xl bg-amber-400/15 px-3 py-1.5 text-center text-[12px] font-bold text-amber-200">{flash}</p>}
      <div className="space-y-2">
        {RIVALRIES.map((r, i) => {
          const key = `${r.a}-vs-${r.b}`;
          const [sa, sb] = scores[key] ?? [0, 0];
          const ca = AGENTS.find((x) => x.role === r.a)!, cb = AGENTS.find((x) => x.role === r.b)!;
          return (
            <div key={key} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold"><span style={{ color: ca.color }}>{r.a}</span> <span className="text-white/35">{sa}–{sb}</span> <span style={{ color: cb.color }}>{r.b}</span></p>
                <button onClick={() => settle(i)} className="rounded-lg bg-red-400/20 px-2.5 py-1 text-[11px] font-bold text-red-200 hover:bg-red-400/30">settle it</button>
              </div>
              <p className="mt-0.5 text-[10px] italic text-white/40">beef: {r.about}</p>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

const DEFAULT_NICKS: Record<string, string[]> = {
  BUILDER: ["Ship Happens", "Merge Conflict"], SCOUT: ["Nose", "Early Bird"],
  TRADER: ["Paper Hands (recovering)", "Wick Hunter"], GUARD: ["Bouncer", "Captain No"],
  MINER: ["Dusty", "Pick"], ORACLE: ["Vague", "Probably Right"],
  PILOT: ["Top Gun (intern)", "Turbulence"],
};

{/* A13 */}
export function AgentNicknames() {
  const [nicks, setNicks] = useState<Record<string, string[]>>(() => read("nicknames", DEFAULT_NICKS));
  const [role, setRole] = useState(AGENTS[0].role);
  const [val, setVal] = useState("");
  const add = () => {
    const v = val.trim();
    if (!v) return;
    const next = { ...nicks, [role]: [...(nicks[role] ?? []), v].slice(-8) };
    setNicks(next); write("nicknames", next); setVal("");
  };
  return (
    <Shell icon={Tag} title="Community Nicknames" sub="bestowed by the group chat">
      <div className="space-y-1.5">
        {AGENTS.map((a) => (
          <div key={a.role} className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white/[0.02] px-3 py-2">
            <span className="w-16 text-[11px] font-extrabold" style={{ color: a.color }}>{a.role}</span>
            {(nicks[a.role] ?? []).map((n, i) => (
              <span key={i} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/70">{n}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white/80">
          {AGENTS.map((a) => <option key={a.role}>{a.role}</option>)}
        </select>
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="add a nickname…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white placeholder:text-white/25" />
        <button onClick={add} className="rounded-lg bg-violet-400/20 px-3 py-1.5 text-[11px] font-bold text-violet-200">add</button>
      </div>
    </Shell>
  );
}

const BDAYS: Record<string, string> = {
  BUILDER: "03-14", SCOUT: "06-21", TRADER: "11-11", GUARD: "01-01",
  MINER: "09-09", ORACLE: "02-29", PILOT: "07-04",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

{/* A14 */}
export function AgentBirthdays() {
  const now = new Date();
  const rows = AGENTS.map((a) => {
    const [m, d] = BDAYS[a.role].split("-").map(Number);
    const isToday = now.getMonth() + 1 === m && now.getDate() === d;
    const thisYear = new Date(now.getFullYear(), m - 1, d);
    const nextB = thisYear >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) ? thisYear : new Date(now.getFullYear() + 1, m - 1, d);
    const days = Math.round((nextB.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
    return { ...a, label: `${MONTHS[m - 1]} ${d}`, days, isToday };
  }).sort((x, y) => x.days - y.days);
  const celebrant = rows.find((r) => r.isToday);
  return (
    <Shell icon={Cake} title="Agent Birthdays" sub="cake is denominated in ORBITX">
      {celebrant && (
        <p className="mb-2 rounded-xl bg-pink-400/15 px-3 py-2 text-center text-[12px] font-extrabold text-pink-200">
          🎉 HAPPY BIRTHDAY {celebrant.role}! 🎉
        </p>
      )}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.role} className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
            <p className="flex-1 text-xs font-bold">{r.role} <span className="font-normal text-white/40">· {r.label}</span></p>
            <p className="text-[11px] text-white/55">{r.isToday ? "TODAY!" : `${r.days}d to go`}</p>
          </div>
        ))}
      </div>
      {rows.some((r) => r.role === "ORACLE" && BDAYS.ORACLE === "02-29") && (
        <p className="mt-2 text-[10px] italic text-white/35">ORACLE was born Feb 29. It only ages on leap years. It planned this.</p>
      )}
    </Shell>
  );
}

/* ============================== A15–A21 ============================== */

{/* A15 */}
export function AgentSleep() {
  const hour = new Date().getHours();
  const sleeping = hour >= 2 && hour < 6; // agents sleep 2–6am local
  const dnd = hour >= 0 && hour < 7;
  return (
    <Shell icon={BedDouble} title="Sleep Schedule" sub="agents recharge 2–6am local">
      <div className={cn("mb-2 flex items-center gap-2 rounded-xl px-3 py-2", dnd ? "bg-indigo-400/15" : "bg-emerald-400/10")}>
        <span className="text-lg">{dnd ? "🔕" : "🔔"}</span>
        <p className="text-[12px] font-bold text-white/80">{dnd ? "DO NOT DISTURB — office is dreaming" : "Office is awake — ping away"}</p>
      </div>
      <div className="space-y-1.5">
        {AGENTS.map((a) => (
          <div key={a.role} className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-3 py-2">
            <span className="text-lg leading-none">{sleeping ? "😴" : "👀"}</span>
            <p className="flex-1 text-xs font-extrabold" style={{ color: a.color }}>{a.role}</p>
            <p className="text-[11px] text-white/50">{sleeping ? "asleep — dreaming of green candles" : "awake — probably chart-watching"}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const MEMOS = [
  { from: "HQ", title: "Mandatory fun Friday", body: "Attendance is optional but your performance review isn't. Bring your own rocket." },
  { from: "GUARD", title: "RE: the fridge", body: "Whoever labeled their lunch 'definitely not a rug' — we need to talk." },
  { from: "ORACLE", title: "A warning", body: "Something big happens Thursday. Or Tuesday. Time is a flat circle." },
  { from: "BUILDER", title: "Deploy window", body: "Shipping at 3am again. If the site breaks, it was always like that." },
  { from: "PILOT", title: "New office rule proposal", body: "All meetings must be held at cruising altitude. Awaiting approval." },
];

{/* A16 */}
export function AgentInbox() {
  const [readIds, setReadIds] = useState<number[]>(() => read("inbox-read", []));
  const unread = MEMOS.length - readIds.length;
  const toggle = (i: number) => {
    const next = readIds.includes(i) ? readIds.filter((x) => x !== i) : [...readIds, i];
    setReadIds(next); write("inbox-read", next);
  };
  return (
    <Shell icon={Inbox} title="HQ Inbox" sub="definitely read all of these">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[11px] text-white/50">Memos</p>
        {unread > 0 && <span className="rounded-full bg-red-400/20 px-2 py-0.5 text-[10px] font-extrabold text-red-200">{unread} unread</span>}
        {unread === 0 && <span className="text-[10px] text-emerald-300">inbox zero — suspicious</span>}
      </div>
      <div className="space-y-1.5">
        {MEMOS.map((m, i) => {
          const isRead = readIds.includes(i);
          return (
            <button key={i} onClick={() => toggle(i)} className={cn("w-full rounded-xl border p-2.5 text-left", isRead ? "border-white/[0.05] bg-white/[0.01] opacity-60" : "border-white/10 bg-white/[0.03]")}>
              <div className="flex items-center gap-2">
                {!isRead && <span className="h-2 w-2 rounded-full bg-red-400" />}
                <p className="flex-1 text-[12px] font-bold">{m.title}</p>
                <p className="text-[10px] text-white/35">from {m.from}</p>
              </div>
              {!isRead && <p className="mt-1 text-[11px] text-white/60">{m.body}</p>}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

const UNIFORMS: Record<string, string[]> = {
  BUILDER: ["#7c3aed", "#1e1b4b", "#a78bfa"], SCOUT: ["#f59e0b", "#451a03", "#fbbf24"],
  TRADER: ["#ec4899", "#500724", "#f9a8d4"], GUARD: ["#10b981", "#022c22", "#6ee7b7"],
  MINER: ["#3b82f6", "#172554", "#93c5fd"], ORACLE: ["#ef4444", "#450a0a", "#fca5a5"],
  PILOT: ["#14b8a6", "#042f2e", "#5eead4"],
};

{/* A17 */}
export function AgentUniforms() {
  const [fav, setFav] = useState<Record<string, string>>(() => read("uniforms", {}));
  const pick = (role: string, hex: string) => {
    const next = { ...fav, [role]: hex };
    setFav(next); write("uniforms", next);
  };
  return (
    <Shell icon={Shirt} title="Uniforms" sub="dress for the pump you want">
      <div className="space-y-2">
        {AGENTS.map((a) => (
          <div key={a.role} className="rounded-xl bg-white/[0.02] p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-extrabold" style={{ color: a.color }}>{a.role}</p>
              {fav[a.role] && <span className="text-[10px] text-white/40">favorite ★</span>}
            </div>
            <div className="flex gap-1.5">
              {UNIFORMS[a.role].map((hex) => (
                <button key={hex} onClick={() => pick(a.role, hex)} title={hex}
                  className={cn("h-9 flex-1 rounded-lg border-2", fav[a.role] === hex ? "border-white/70" : "border-transparent")}
                  style={{ background: hex }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.07] p-2.5">
        <p className="text-[10px] text-white/40">squad preview:</p>
        <div className="flex gap-1">
          {AGENTS.map((a) => (
            <span key={a.role} className="h-6 w-6 rounded-full border border-white/20" style={{ background: fav[a.role] ?? UNIFORMS[a.role][0] }} title={a.role} />
          ))}
        </div>
      </div>
    </Shell>
  );
}

const RULES = [
  { n: "1.01", t: "The chart is always right, except when it's wrong, in which case see rule 1.02." },
  { n: "1.02", t: "TRADER is never wrong. The market is simply early." },
  { n: "2.00", t: "Paper hands must use the side entrance." },
  { n: "3.14", t: "All deploy Fridays are canceled. All deploys happen Friday." },
  { n: "4.20", t: "Snacks are community property until GUARD labels them evidence." },
  { n: "5.00", t: "Do not ask ORACLE for lottery numbers. It never ends well." },
  { n: "6.66", t: "Red candles longer than 15 minutes require a group hug." },
  { n: "7.77", t: "Whoever says 'wen moon' buys the next round of cold brew." },
];

{/* A18 */}
export function AgentHandbook() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Shell icon={ScrollText} title="Agent Handbook" sub="the sacred rulebook — v4.20">
      <div className="space-y-1.5">
        {RULES.map((r, i) => (
          <div key={r.n} className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-2 px-3 py-2 text-left">
              <span className="rounded-md bg-violet-400/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-300">{r.n}</span>
              <span className="flex-1 truncate text-[11px] text-white/60">{open === i ? "tap to collapse" : r.t.slice(0, 42) + "…"}</span>
              <span className="text-white/30">{open === i ? "−" : "+"}</span>
            </button>
            {open === i && <p className="px-3 pb-2.5 text-[12px] text-white/85">{r.t}</p>}
          </div>
        ))}
      </div>
    </Shell>
  );
}

const RETIRE: Record<string, { days: number; pension: string }> = {
  BUILDER: { days: 9999, pension: "1M ORBITX + a standing desk" },
  SCOUT: { days: 8888, pension: "lifetime alpha feed" },
  TRADER: { days: 7777, pension: "one (1) lambo, paper" },
  GUARD: { days: 12000, pension: "a firewall made of gold" },
  MINER: { days: 9500, pension: "a pickaxe with diamonds on it" },
  ORACLE: { days: 6666, pension: "retirement was foretold" },
  PILOT: { days: 11111, pension: "a runway on the moon" },
};

{/* A19 */}
export function AgentRetirement() {
  return (
    <Shell icon={Palmtree} title="Retirement Plans" sub="pensions denominated in ORBITX, obviously">
      <div className="space-y-1.5">
        {AGENTS.map((a) => (
          <div key={a.role} className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-3 py-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold">{a.role}</p>
              <p className="truncate text-[10px] text-white/45">pension: {RETIRE[a.role].pension}</p>
            </div>
            <p className="shrink-0 text-right text-[11px] font-bold text-white/70">{RETIRE[a.role].days.toLocaleString()}<span className="block text-[9px] font-normal text-white/35">days left</span></p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] italic text-white/35">GUARD audited the pension fund. It's just a sticky note that says "moon".</p>
    </Shell>
  );
}

{/* A20 */}
export function AgentWorkout({ buyCount }: { buyCount: number }) {
  const key = todayKey();
  const target = Math.max(0, Math.round(buyCount)) * 10;
  const rows = useMemo(() => {
    const r = seededRand(`${key}-workout`);
    const weights = AGENTS.map(() => 0.5 + r());
    const total = weights.reduce((s, w) => s + w, 0);
    return AGENTS.map((a, i) => ({ ...a, done: Math.round((weights[i] / total) * target) })).sort((x, y) => y.done - x.done);
  }, [key, target]);
  return (
    <Shell icon={Dumbbell} title="Office Workout" sub={`buy pressure = push-ups · ${target.toLocaleString()} on the board`}>
      <p className="mb-2 text-[11px] text-white/50">Rule: every buy = 10 push-ups. The agents do them. Eventually.</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.role}>
            <div className="mb-0.5 flex items-center justify-between text-[11px]">
              <p className="font-extrabold"><span className="text-white/35">#{i + 1}</span> <span style={{ color: r.color }}>{r.role}</span></p>
              <p className="font-bold text-white/70">{r.done.toLocaleString()} 💪</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${target ? (r.done / target) * 100 : 0}%`, background: r.color }} />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const BOOKS: Record<string, { title: string; ch: number; of: number }> = {
  BUILDER: { title: "Clean Code, Dirty Deploys", ch: 7, of: 12 },
  SCOUT: { title: "The Intelligent Investor… of Memes", ch: 11, of: 14 },
  TRADER: { title: "Thinking, Fast and Leveraged", ch: 3, of: 20 },
  GUARD: { title: "1984 Ways to Say No", ch: 1984, of: 1984 },
  MINER: { title: "A Pickaxe Grows in Brooklyn", ch: 5, of: 9 },
  ORACLE: { title: "The Book. (You wouldn't understand yet.)", ch: 1, of: 1 },
  PILOT: { title: "Oh, the Places You'll Pump!", ch: 9, of: 10 },
};

{/* A21 */}
export function AgentBookClub() {
  return (
    <Shell icon={Library} title="Book Club" sub="thursdays — wine optional, hopium provided">
      <div className="space-y-2.5">
        {AGENTS.map((a) => {
          const b = BOOKS[a.role];
          const pct = Math.round((b.ch / b.of) * 100);
          return (
            <div key={a.role}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
                <p className="min-w-0"><span className="font-extrabold" style={{ color: a.color }}>{a.role}</span> <span className="italic text-white/60">“{b.title}”</span></p>
                <p className="shrink-0 text-white/45">ch {b.ch}/{b.of}</p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: a.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ============================== A22–A25 ============================== */

const PLAYLISTS: Record<string, { genre: string; tracks: string[] }> = {
  BUILDER: { genre: "lofi deploy beats", tracks: ["git push (prod)", "3am refactor", "it works on my machine"] },
  SCOUT: { genre: "alpha alert pop", tracks: ["heard it first", "trending topic", "insider (not really)"] },
  TRADER: { genre: "adrenaline edm", tracks: ["liquidation nation", "long & wrong", "wicked game"] },
  GUARD: { genre: "ambient firewall drone", tracks: ["deny all", "cold storage lullaby", "no. (extended mix)"] },
  MINER: { genre: "dusty blues", tracks: ["pickaxe swing", "orphan block blues", "dust in the mempool"] },
  ORACLE: { genre: "prophetic synthwave", tracks: ["three candles ahead", "the chart foretold", "vague (reprise)"] },
  PILOT: { genre: "cockpit rock", tracks: ["danger zone (office remix)", "cruising altitude", "turbulence tango"] },
};

{/* A22 */}
export function AgentPlaylists() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);
  const agent = AGENTS[tick % AGENTS.length];
  const pl = PLAYLISTS[agent.role];
  const track = pl.tracks[tick % pl.tracks.length];
  return (
    <Shell icon={ListMusic} title="Office Playlists" sub="now playing rotates every 4s">
      <div className="mb-2 flex items-center gap-2 overflow-hidden rounded-xl bg-white/[0.04] px-3 py-2">
        <span className="flex gap-0.5">{[0, 1, 2, 3].map((i) => <span key={i} className="h-3 w-1 animate-pulse rounded bg-fuchsia-300/80" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
        <p className="truncate text-[12px] font-bold">♪ <span style={{ color: agent.color }}>{agent.role}</span> <span className="font-normal text-white/60">— “{track}”</span></p>
      </div>
      <div className="space-y-1.5">
        {AGENTS.map((a) => (
          <div key={a.role} className="rounded-xl bg-white/[0.02] px-3 py-2">
            <p className="text-[11px] font-extrabold"><span style={{ color: a.color }}>{a.role}</span> <span className="font-normal text-white/35">· {PLAYLISTS[a.role].genre}</span></p>
            <p className="mt-0.5 text-[10px] text-white/50">{PLAYLISTS[a.role].tracks.map((t) => `“${t}”`).join(" · ")}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const PLANTS: Record<string, string> = {
  BUILDER: "cactus", SCOUT: "venus flytrap", TRADER: "bamboo (lucky?)",
  GUARD: "succulent (armored)", MINER: "moss", ORACLE: "mysterious fern", PILOT: "palm (tiny)",
};
const plantEmoji = (lvl: number) => (lvl > 75 ? "🌳" : lvl > 50 ? "🪴" : lvl > 25 ? "🌿" : lvl > 0 ? "🌱" : "🥀");

{/* A23 */}
export function AgentGarden() {
  const [pots, setPots] = useState<Record<string, { lvl: number; ts: number }>>(() => read("garden", {}));
  const [, force] = useState(0);
  useEffect(() => { const id = setInterval(() => force((n) => n + 1), 30000); return () => clearInterval(id); }, []);
  const level = (role: string) => {
    const p = pots[role];
    if (!p) return 60;
    const hours = (Date.now() - p.ts) / 3600000;
    return Math.max(0, Math.round(p.lvl - hours * 3));
  };
  const water = (role: string) => {
    const next = { ...pots, [role]: { lvl: 100, ts: Date.now() } };
    setPots(next); write("garden", next);
  };
  return (
    <Shell icon={Sprout} title="Desk Garden" sub="water decays over time — like morale">
      <div className="space-y-1.5">
        {AGENTS.map((a) => {
          const lvl = level(a.role);
          return (
            <div key={a.role} className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-3 py-2">
              <span className="text-xl leading-none">{plantEmoji(lvl)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold"><span style={{ color: a.color }}>{a.role}</span> <span className="font-normal text-white/40">· {PLANTS[a.role]}</span></p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-300" style={{ width: `${lvl}%` }} />
                </div>
              </div>
              <button onClick={() => water(a.role)} className="rounded-lg bg-sky-400/20 px-2.5 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-400/30">💧 water</button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

const LOST = [
  { item: "One (1) left airpod", note: "SCOUT claims it's 'gathering intel' in the couch." },
  { item: "Laminated 'wen moon' coupon", note: "Redeemable for one (1) group hug." },
  { item: "USB stick labeled 'definitely not the keys'", note: "GUARD has questions." },
  { item: "Slightly haunted hardware wallet", note: "Whispers 'buy the dip' at 3am." },
  { item: "PILOT's lucky chart-printout", note: "It's just a green crayon line going up." },
  { item: "ORACLE's missing crystal ball", note: "It saw this coming and left anyway." },
];

{/* A24 */}
export function AgentLostFound() {
  const [claimed, setClaimed] = useState<string[]>(() => read("lostfound", []));
  const [thanks, setThanks] = useState<string | null>(null);
  const claim = (item: string) => {
    const next = [...claimed, item];
    setClaimed(next); write("lostfound", next);
    setThanks(`"${item}" claimed! The office applauds politely.`);
    setTimeout(() => setThanks(null), 2500);
  };
  const remaining = LOST.filter((l) => !claimed.includes(l.item));
  return (
    <Shell icon={PackageSearch} title="Lost & Found" sub="unclaimed after 30 days → MINER keeps it">
      {thanks && <p className="mb-2 rounded-xl bg-emerald-400/15 px-3 py-1.5 text-[12px] font-bold text-emerald-200">{thanks}</p>}
      {remaining.length === 0 && <p className="rounded-xl bg-white/[0.03] p-3 text-center text-[12px] text-white/50">Box is empty. Suspiciously tidy. 🧹</p>}
      <div className="space-y-1.5">
        {remaining.map((l) => (
          <div key={l.item} className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold">{l.item}</p>
              <p className="text-[10px] italic text-white/40">{l.note}</p>
            </div>
            <button onClick={() => claim(l.item)} className="shrink-0 rounded-lg bg-violet-400/20 px-2.5 py-1 text-[11px] font-bold text-violet-200 hover:bg-violet-400/30">claim</button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

type Capsule = { msg: string; seal: string; created: string };

{/* A25 */}
export function AgentTimeCapsule() {
  const [capsules, setCapsules] = useState<Capsule[]>(() => read("capsules", []));
  const [msg, setMsg] = useState("");
  const [seal, setSeal] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return todayKey(d); });
  const today = todayKey();
  const sealIt = () => {
    const m = msg.trim();
    if (!m || !seal) return;
    const next = [{ msg: m, seal, created: today }, ...capsules].slice(0, 20);
    setCapsules(next); write("capsules", next); setMsg("");
  };
  return (
    <Shell icon={Hourglass} title="Time Capsule" sub="messages to future agents">
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} maxLength={280}
        placeholder="Dear future agents: the chart went…"
        className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-[12px] text-white placeholder:text-white/25" />
      <div className="mt-1.5 flex gap-1.5">
        <input type="date" value={seal} min={today} onChange={(e) => setSeal(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white/80" />
        <button onClick={sealIt} className="rounded-lg bg-amber-400/20 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-400/30">seal it 🔒</button>
      </div>
      <div className="mt-2 space-y-1.5">
        {capsules.length === 0 && <p className="text-[11px] text-white/35">No capsules yet. The future is unwritten.</p>}
        {capsules.map((c, i) => {
          const locked = c.seal > today;
          return (
            <div key={i} className={cn("rounded-xl border p-2.5", locked ? "border-amber-300/20 bg-amber-300/[0.04]" : "border-emerald-300/20 bg-emerald-300/[0.04]")}>
              <div className="flex items-center justify-between text-[10px] text-white/40">
                <span>sealed {c.created} → opens {c.seal}</span>
                <span className="font-bold">{locked ? "🔒 LOCKED" : "🔓 OPEN"}</span>
              </div>
              <p className={cn("mt-1 text-[12px]", locked ? "italic text-white/40 blur-[3px] select-none" : "text-white/85")}>{c.msg}</p>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
