// TokenSocial3.tsx — Competition & Games social widgets (S51–S75)
// React + Tailwind + Vite. Each widget is standalone; localStorage keys prefixed "orbitx-social3-".

import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Target, TrendingUp, Megaphone, Diamond, Medal, ClipboardList, Copy, Radio, Scale, Timer,
  Swords, Gauge, Spade, Star, Ticket, Disc3, Cherry, Dices, Coins, Scissors, Brain, Keyboard,
  LayoutGrid, Gamepad2, Crown, Play, RotateCcw, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- shared ---------- */
function read<T>(key: string, fb: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fb;
  } catch {
    return fb;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable — ignore */
  }
}
const inputCls =
  "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-amber-400/50";
const btnPrimary =
  "rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-black hover:bg-amber-300 disabled:opacity-40";
const btnGhost =
  "rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10 disabled:opacity-40";

function Shell({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-extrabold">{title}</h3>
          {sub && <p className="text-[11px] text-white/40">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function DemoTag() {
  return (
    <span className="mb-2 inline-block rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
      Demo data
    </span>
  );
}

/* S51 */
export function PredictionWall({ price }: { price?: number | null }) {
  const [preds, setPreds] = useState<{ id: number; target: number; date: string }[]>(() =>
    read("orbitx-social3-predictions", [])
  );
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => write("orbitx-social3-predictions", preds), [preds]);
  const ranked =
    price != null
      ? [...preds].sort((a, b) => Math.abs(a.target - price) - Math.abs(b.target - price))
      : preds;
  const post = () => {
    const t = parseFloat(target);
    if (!t || t <= 0) return;
    setPreds(p => [{ id: Date.now(), target: t, date: date || "open" }, ...p]);
    setTarget("");
    setDate("");
  };
  return (
    <Shell icon={Target} title="Prediction Wall" sub="Closest prediction to the live price takes the crown">
      <div className="mb-3 flex gap-2">
        <input
          value={target}
          onChange={e => setTarget(e.target.value)}
          type="number"
          min="0"
          step="any"
          placeholder="Target price"
          className={inputCls}
        />
        <input value={date} onChange={e => setDate(e.target.value)} type="date" className={inputCls} />
        <button onClick={post} className={btnPrimary}>
          Post
        </button>
      </div>
      <div className="max-h-44 space-y-2 overflow-auto">
        {ranked.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
            <span className="font-extrabold text-amber-300">${p.target.toLocaleString()}</span>
            <span className="text-white/40">{p.date}</span>
            {i === 0 && price != null && ranked.length > 1 && (
              <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                closest
              </span>
            )}
          </div>
        ))}
        {preds.length === 0 && <p className="text-xs text-white/40">No predictions yet — post the first one.</p>}
      </div>
    </Shell>
  );
}

/* S52 */
const PNL_DEMO: Record<"24h" | "7d" | "all", { name: string; pnl: number }[]> = {
  "24h": [
    { name: "Vox", pnl: 38.2 },
    { name: "You", pnl: 21.4 },
    { name: "Mira", pnl: 14.8 },
    { name: "Juno", pnl: -6.3 },
    { name: "Kai", pnl: -12.1 },
  ],
  "7d": [
    { name: "Mira", pnl: 112.6 },
    { name: "Vox", pnl: 87.3 },
    { name: "You", pnl: 44.9 },
    { name: "Rex", pnl: -18.4 },
    { name: "Nyx", pnl: -33.0 },
  ],
  all: [
    { name: "Vox", pnl: 842.1 },
    { name: "Mira", pnl: 655.4 },
    { name: "Juno", pnl: 301.2 },
    { name: "You", pnl: 188.7 },
    { name: "Zed", pnl: -96.5 },
  ],
};
export function LeaderboardPNL() {
  const [tab, setTab] = useState<"24h" | "7d" | "all">("24h");
  const rows = [...PNL_DEMO[tab]].sort((a, b) => b.pnl - a.pnl);
  return (
    <Shell icon={TrendingUp} title="PNL Leaderboard" sub="Top paper traders">
      <DemoTag />
      <div className="mb-2 flex gap-1">
        {(["24h", "7d", "all"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold",
              tab === t ? "bg-amber-400 text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            {t === "all" ? "All-time" : t}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className={cn(
              "flex items-center justify-between rounded-xl px-3 py-2 text-xs",
              r.name === "You" ? "bg-amber-400/10 ring-1 ring-amber-400/30" : "bg-white/5"
            )}
          >
            <span className="flex items-center gap-2 font-bold">
              <span className="w-5 text-white/40">#{i + 1}</span>
              {r.name}
            </span>
            <span className={cn("font-extrabold", r.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {r.pnl >= 0 ? "+" : ""}
              {r.pnl}%
            </span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S53 */
export function LeaderboardShill() {
  const [mine, setMine] = useState(() => read<number>("orbitx-social3-share-count", 0));
  const shout = () =>
    setMine(m => {
      const n = m + 1;
      write("orbitx-social3-share-count", n);
      return n;
    });
  const rows = [
    { name: "Mira", n: 214 },
    { name: "Vox", n: 167 },
    { name: "You", n: mine },
    { name: "Juno", n: 98 },
    { name: "Kai", n: 41 },
  ].sort((a, b) => b.n - a.n);
  return (
    <Shell icon={Megaphone} title="Shill Leaderboard" sub="Ranked by shares & shouts (your count is saved locally)">
      <button onClick={shout} className={cn(btnPrimary, "mb-3")}>
        +1 Shill (I shared ORBITX)
      </button>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className={cn(
              "flex items-center justify-between rounded-xl px-3 py-2 text-xs",
              r.name === "You" ? "bg-amber-400/10 ring-1 ring-amber-400/30" : "bg-white/5"
            )}
          >
            <span className="flex items-center gap-2 font-bold">
              <span className="w-5 text-white/40">#{i + 1}</span>
              {r.name}
              {r.name !== "You" && <span className="text-[10px] font-normal text-white/30">demo</span>}
            </span>
            <span className="font-extrabold text-amber-300">{r.n}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S54 */
export function LeaderboardHolding() {
  const [days, setDays] = useState<string[]>(() => read<string[]>("orbitx-social3-visit-days", []));
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    setDays(prev => {
      if (prev.includes(today)) return prev;
      const next = [...prev, today];
      write("orbitx-social3-visit-days", next);
      return next;
    });
  }, []);
  const rows = [
    { name: "DiamondDan", n: 412 },
    { name: "Vox", n: 301 },
    { name: "Mira", n: 188 },
    { name: "You", n: days.length },
    { name: "Juno", n: 45 },
  ].sort((a, b) => b.n - a.n);
  return (
    <Shell icon={Diamond} title="Diamond Hands Board" sub="Ranked by days holding / visiting (yours tracked locally)">
      <DemoTag />
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className={cn(
              "flex items-center justify-between rounded-xl px-3 py-2 text-xs",
              r.name === "You" ? "bg-amber-400/10 ring-1 ring-amber-400/30" : "bg-white/5"
            )}
          >
            <span className="flex items-center gap-2 font-bold">
              <span className="w-5 text-white/40">#{i + 1}</span>
              {r.name}
            </span>
            <span className="font-extrabold text-sky-300">{r.n} days</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S55 */
const BRACKET_PLAYERS = ["Vox", "Mira", "Juno", "Kai", "Rex", "Nyx", "Zed", "Ash"];
type Bracket = { qf: (string | null)[]; sf: (string | null)[]; champ: string | null };
const EMPTY_BRACKET: Bracket = { qf: [null, null, null, null], sf: [null, null], champ: null };
export function TournamentBracket() {
  const [w, setW] = useState<Bracket>(() => read<Bracket>("orbitx-social3-bracket", EMPTY_BRACKET));
  useEffect(() => write("orbitx-social3-bracket", w), [w]);
  const setQf = (i: number, name: string) =>
    setW(p => ({ ...p, qf: p.qf.map((x, j) => (j === i ? name : x)) }));
  const setSf = (i: number, name: string) =>
    setW(p => ({ ...p, sf: p.sf.map((x, j) => (j === i ? name : x)) }));
  const setChamp = (name: string) => setW(p => ({ ...p, champ: name }));
  const match = (
    a: string | null,
    b: string | null,
    winner: string | null,
    onPick: (n: string) => void,
    locked: boolean
  ) => (
    <div className="grid grid-cols-2 gap-1">
      {[a, b].map((p, i) => (
        <button
          key={i}
          disabled={!p || locked}
          onClick={() => p && onPick(p)}
          className={cn(
            "rounded-lg px-2 py-1.5 text-xs font-bold disabled:opacity-40",
            winner === p
              ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40"
              : "bg-white/5 text-white/70 hover:bg-white/10"
          )}
        >
          {p ?? "—"}
        </button>
      ))}
    </div>
  );
  return (
    <Shell icon={Medal} title="Tournament Bracket" sub="Tap a name to advance them — demo players">
      <DemoTag />
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/40">Quarterfinals</p>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map(i => (
              <div key={i}>
                {match(BRACKET_PLAYERS[i * 2], BRACKET_PLAYERS[i * 2 + 1], w.qf[i], n => setQf(i, n), false)}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/40">Semifinals</p>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map(i => (
              <div key={i}>
                {match(w.qf[i * 2], w.qf[i * 2 + 1], w.sf[i], n => setSf(i, n), !w.qf[i * 2] || !w.qf[i * 2 + 1])}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/40">Final</p>
          {match(w.sf[0], w.sf[1], w.champ, setChamp, !w.sf[0] || !w.sf[1])}
        </div>
        {w.champ && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-400/10 py-2 text-sm font-extrabold text-amber-300 ring-1 ring-amber-400/30">
            <Crown className="h-4 w-4" /> {w.champ} is champion!
          </div>
        )}
        <button onClick={() => setW(EMPTY_BRACKET)} className={cn(btnGhost, "inline-flex items-center gap-1")}>
          <RotateCcw className="h-3 w-3" /> Reset bracket
        </button>
      </div>
    </Shell>
  );
}

/* S56 */
export function BracketChallenge() {
  const [pick, setPick] = useState<string | null>(() =>
    read<string | null>("orbitx-social3-bracket-pick", null)
  );
  const [result, setResult] = useState<string | null>(null);
  const [score, setScore] = useState(() => read("orbitx-social3-bracket-score", { w: 0, l: 0 }));
  const choose = (n: string) => {
    setPick(n);
    write("orbitx-social3-bracket-pick", n);
    setResult(null);
  };
  const simulate = () => {
    const champ = BRACKET_PLAYERS[Math.floor(Math.random() * BRACKET_PLAYERS.length)];
    setResult(champ);
    if (pick) {
      const win = champ === pick;
      setScore(s => {
        const n = { w: s.w + (win ? 1 : 0), l: s.l + (win ? 0 : 1) };
        write("orbitx-social3-bracket-score", n);
        return n;
      });
    }
  };
  return (
    <Shell icon={ClipboardList} title="Bracket Challenge" sub="Pick the champion, then simulate the tournament">
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        {BRACKET_PLAYERS.map(n => (
          <button
            key={n}
            onClick={() => choose(n)}
            className={cn(
              "rounded-lg px-2 py-1.5 text-xs font-bold",
              pick === n ? "bg-amber-400 text-black" : "bg-white/5 text-white/70 hover:bg-white/10"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={simulate} disabled={!pick} className={btnPrimary}>
          Simulate tournament
        </button>
        <span className="text-xs text-white/50">
          Record: <b className="text-emerald-400">{score.w}W</b> – <b className="text-rose-400">{score.l}L</b>
        </span>
      </div>
      {result && (
        <p className="mt-2 text-xs">
          Simulated champion: <b className="text-amber-300">{result}</b>{" "}
          {pick &&
            (result === pick ? (
              <span className="font-bold text-emerald-400">— you called it! 🎯</span>
            ) : (
              <span className="text-white/50">— your pick ({pick}) missed.</span>
            ))}
        </p>
      )}
    </Shell>
  );
}

/* S57 */
const COPY_FEED = [
  { trader: "Vox", action: "Bought 2.4M ORBITX", when: "2m ago" },
  { trader: "Mira", action: "Sold 800K ORBITX", when: "11m ago" },
  { trader: "Juno", action: "Added LP · 5 SOL / 1.1M ORBITX", when: "26m ago" },
  { trader: "Kai", action: "Bought 300K ORBITX", when: "41m ago" },
];
export function CopyTradeFeed() {
  const [following, setFollowing] = useState<string[]>(() =>
    read<string[]>("orbitx-social3-following", [])
  );
  const toggle = (n: string) =>
    setFollowing(f => {
      const next = f.includes(n) ? f.filter(x => x !== n) : [...f, n];
      write("orbitx-social3-following", next);
      return next;
    });
  return (
    <Shell icon={Copy} title="Copy-Trade Feed" sub="Top trader moves — simulated feed, not real trades">
      <DemoTag />
      <div className="space-y-2">
        {COPY_FEED.map(m => (
          <div key={m.trader} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
            <div className="text-xs">
              <p className="font-bold">
                {m.trader} <span className="font-normal text-white/50">{m.action}</span>
              </p>
              <p className="text-[10px] text-white/30">{m.when}</p>
            </div>
            <button
              onClick={() => toggle(m.trader)}
              className={cn(following.includes(m.trader) ? btnPrimary : btnGhost)}
            >
              {following.includes(m.trader) ? "Following" : "Follow"}
            </button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S58 */
type Sig = { id: number; side: "bull" | "bear"; text: string; up: number; down: number };
export function SignalRoom() {
  const [sigs, setSigs] = useState<Sig[]>(() => read<Sig[]>("orbitx-social3-signals", []));
  const [side, setSide] = useState<"bull" | "bear">("bull");
  const [text, setText] = useState("");
  useEffect(() => write("orbitx-social3-signals", sigs), [sigs]);
  const post = () => {
    if (!text.trim()) return;
    setSigs(s => [{ id: Date.now(), side, text: text.trim().slice(0, 140), up: 0, down: 0 }, ...s]);
    setText("");
  };
  const vote = (id: number, d: 1 | -1) =>
    setSigs(s =>
      s.map(x =>
        x.id === id ? { ...x, up: x.up + (d === 1 ? 1 : 0), down: x.down + (d === -1 ? 1 : 0) } : x
      )
    );
  const ranked = [...sigs].sort((a, b) => b.up - b.down - (a.up - a.down));
  return (
    <Shell icon={Radio} title="Signal Room" sub="Post a call, vote on the crowd's">
      <div className="mb-2 flex gap-1">
        {(["bull", "bear"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-bold capitalize",
              side === s
                ? s === "bull"
                  ? "bg-emerald-400 text-black"
                  : "bg-rose-400 text-black"
                : "bg-white/5 text-white/60"
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="mb-3 flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Your signal + reasoning…"
          maxLength={140}
          className={inputCls}
        />
        <button onClick={post} className={btnPrimary}>
          Post
        </button>
      </div>
      <div className="max-h-44 space-y-2 overflow-auto">
        {ranked.map(s => (
          <div key={s.id} className="rounded-xl bg-white/5 px-3 py-2">
            <p className="text-xs">
              <span
                className={cn(
                  "mr-1 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase",
                  s.side === "bull" ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"
                )}
              >
                {s.side}
              </span>
              {s.text}
            </p>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <button onClick={() => vote(s.id, 1)} className="font-bold text-emerald-400 hover:underline">
                ▲ agree ({s.up})
              </button>
              <button onClick={() => vote(s.id, -1)} className="font-bold text-rose-400 hover:underline">
                ▼ disagree ({s.down})
              </button>
              <span className="text-white/30">
                net {s.up - s.down >= 0 ? "+" : ""}
                {s.up - s.down}
              </span>
            </div>
          </div>
        ))}
        {sigs.length === 0 && <p className="text-xs text-white/40">No signals yet — drop the first call.</p>}
      </div>
    </Shell>
  );
}

/* S59 */
export function DebateClub() {
  const [votes, setVotes] = useState(() => read("orbitx-social3-debate", { bull: 12, bear: 9 }));
  const [mine, setMine] = useState<"bull" | "bear" | null>(() =>
    read<"bull" | "bear" | null>("orbitx-social3-debate-mine", null)
  );
  const vote = (s: "bull" | "bear") => {
    setVotes(v => {
      const n = { ...v };
      if (mine) n[mine] = Math.max(0, n[mine] - 1);
      n[s] += 1;
      write("orbitx-social3-debate", n);
      return n;
    });
    setMine(s);
    write("orbitx-social3-debate-mine", s);
  };
  const total = votes.bull + votes.bear;
  const pct = total ? Math.round((votes.bull / total) * 100) : 50;
  return (
    <Shell icon={Scale} title="Debate Club" sub="Bulls vs bears — pick your side">
      <div className="mb-2 h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mb-3 text-center text-xs font-bold">
        <span className="text-emerald-400">{pct}% bull</span> <span className="text-white/30">·</span>{" "}
        <span className="text-rose-400">{100 - pct}% bear</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-emerald-400/5 p-3 ring-1 ring-emerald-400/20">
          <p className="mb-1 text-xs font-extrabold text-emerald-300">🐂 Top bull case</p>
          <p className="mb-2 text-[11px] text-white/60">
            "Buy pressure is climbing and burns keep shrinking supply."
          </p>
          <button onClick={() => vote("bull")} className={cn(btnPrimary, mine === "bull" && "ring-2 ring-white/40")}>
            Vote bull ({votes.bull})
          </button>
        </div>
        <div className="rounded-xl bg-rose-400/5 p-3 ring-1 ring-rose-400/20">
          <p className="mb-1 text-xs font-extrabold text-rose-300">🐻 Top bear case</p>
          <p className="mb-2 text-[11px] text-white/60">"Hype cycles fade — show me volume before I believe."</p>
          <button
            onClick={() => vote("bear")}
            className={cn(
              "rounded-xl bg-rose-400 px-3 py-2 text-xs font-extrabold text-black hover:bg-rose-300",
              mine === "bear" && "ring-2 ring-white/40"
            )}
          >
            Vote bear ({votes.bear})
          </button>
        </div>
      </div>
    </Shell>
  );
}

/* S60 */
export function PriceGuessing({ price }: { price?: number | null }) {
  const [guess, setGuess] = useState("");
  const [guesses, setGuesses] = useState<{ g: number; t: string }[]>(() =>
    read("orbitx-social3-guesses", [])
  );
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => write("orbitx-social3-guesses", guesses), [guesses]);
  const end = new Date();
  end.setMinutes(60, 0, 0);
  const left = Math.max(0, end.getTime() - now);
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const submit = () => {
    const g = parseFloat(guess);
    if (!g || g <= 0) return;
    setGuesses(x => [{ g, t: new Date().toLocaleTimeString() }, ...x].slice(0, 8));
    setGuess("");
  };
  const ranked =
    price != null
      ? [...guesses].sort((a, b) => Math.abs(a.g - price) - Math.abs(b.g - price))
      : guesses;
  return (
    <Shell icon={Timer} title="Price Guessing" sub={`Guess the price at the top of the hour · ${mm}:${ss} left`}>
      <div className="mb-3 flex gap-2">
        <input
          value={guess}
          onChange={e => setGuess(e.target.value)}
          type="number"
          min="0"
          step="any"
          placeholder="Your guess"
          className={inputCls}
        />
        <button onClick={submit} className={btnPrimary}>
          Lock in
        </button>
      </div>
      <div className="space-y-1.5">
        {ranked.map((x, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-1.5 text-xs">
            <span className="font-bold">${x.g.toLocaleString()}</span>
            <span className="text-white/30">{x.t}</span>
            {i === 0 && price != null && ranked.length > 1 && (
              <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                closest
              </span>
            )}
          </div>
        ))}
        {guesses.length === 0 && <p className="text-xs text-white/40">No guesses yet this hour.</p>}
      </div>
    </Shell>
  );
}

/* S61 */
export function TradingDuel() {
  const [round, setRound] = useState(1);
  const [score, setScore] = useState({ you: 0, vox: 0 });
  const [cur, setCur] = useState(() => 10 + Math.floor(Math.random() * 90));
  const [last, setLast] = useState<{ next: number; youWin: boolean } | null>(null);
  const over = round > 3;
  const play = (dir: 1 | -1) => {
    if (over) return;
    const next = 10 + Math.floor(Math.random() * 90);
    const youWin = dir === 1 ? next > cur : next < cur;
    const voxDir = Math.random() > 0.5 ? 1 : -1;
    const voxWin = voxDir === 1 ? next > cur : next < cur;
    setLast({ next, youWin });
    setScore(s => ({ you: s.you + (youWin ? 1 : 0), vox: s.vox + (voxWin ? 1 : 0) }));
    setCur(next);
    setRound(r => r + 1);
  };
  const reset = () => {
    setRound(1);
    setScore({ you: 0, vox: 0 });
    setCur(10 + Math.floor(Math.random() * 90));
    setLast(null);
  };
  const winner = over
    ? score.you > score.vox
      ? "You win the duel! 🏆"
      : score.vox > score.you
        ? "Vox takes it — rematch?"
        : "Dead heat!"
    : null;
  return (
    <Shell icon={Swords} title="Trading Duel" sub="You vs Vox — 3 rounds of higher / lower">
      <DemoTag />
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-bold">
          You <b className="text-amber-300">{score.you}</b>
        </span>
        <span className="rounded-xl bg-white/5 px-4 py-2 text-2xl font-extrabold">{over ? "🏁" : cur}</span>
        <span className="font-bold">
          Vox <b className="text-amber-300">{score.vox}</b>
        </span>
      </div>
      {last && !over && (
        <p className="mb-2 text-center text-xs text-white/50">
          Last: {last.next} — you were {last.youWin ? "right ✅" : "wrong ❌"}
        </p>
      )}
      {over ? (
        <div className="text-center">
          <p className="mb-2 text-sm font-extrabold">{winner}</p>
          <button onClick={reset} className={cn(btnPrimary, "inline-flex items-center gap-1")}>
            <RotateCcw className="h-3 w-3" /> Rematch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => play(1)} className={btnPrimary}>
            ▲ Higher
          </button>
          <button onClick={() => play(-1)} className="rounded-xl bg-rose-400 px-3 py-2 text-xs font-extrabold text-black hover:bg-rose-300">
            ▼ Lower
          </button>
        </div>
      )}
    </Shell>
  );
}

/* S62 */
export function SpeedrunBoard() {
  const [mine, setMine] = useState<number[]>(() => read<number[]>("orbitx-social3-speedrun", []));
  const [input, setInput] = useState("");
  const submit = () => {
    const t = parseFloat(input);
    if (!t || t <= 0) return;
    setMine(m => {
      const n = [...m, t].slice(-5);
      write("orbitx-social3-speedrun", n);
      return n;
    });
    setInput("");
  };
  const rows = [
    ...[
      { name: "Vox", t: 41.2 },
      { name: "Mira", t: 55.8 },
      { name: "Juno", t: 63.0 },
    ].map(d => ({ ...d, demo: true })),
    ...mine.map((t, i) => ({ name: `You #${i + 1}`, t, demo: false })),
  ].sort((a, b) => a.t - b.t);
  return (
    <Shell icon={Gauge} title="Speedrun Board" sub="Fastest paper 2x — demo times, submit yours">
      <DemoTag />
      <div className="mb-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          type="number"
          min="0"
          step="any"
          placeholder="Your time (seconds)"
          className={inputCls}
        />
        <button onClick={submit} className={btnPrimary}>
          Submit
        </button>
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div
            key={`${r.name}-${i}`}
            className={cn(
              "flex items-center justify-between rounded-xl px-3 py-2 text-xs",
              !r.demo ? "bg-amber-400/10 ring-1 ring-amber-400/30" : "bg-white/5"
            )}
          >
            <span className="flex items-center gap-2 font-bold">
              <span className="w-5 text-white/40">#{i + 1}</span>
              {r.name}
              {r.demo && <span className="text-[10px] font-normal text-white/30">demo</span>}
            </span>
            <span className="font-extrabold text-amber-300">{r.t.toFixed(1)}s</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S63 */
export function PokerNight() {
  const [rsvp, setRsvp] = useState(() => read<boolean>("orbitx-social3-poker-rsvp", false));
  const [buyin, setBuyin] = useState(() => read<string>("orbitx-social3-poker-buyin", "0.5"));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = (() => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
    return d.getTime();
  })();
  const left = Math.max(0, target - now);
  const dd = Math.floor(left / 86400000);
  const hh = String(Math.floor((left % 86400000) / 3600000)).padStart(2, "0");
  const mm = String(Math.floor((left % 3600000) / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const toggle = () =>
    setRsvp(r => {
      write("orbitx-social3-poker-rsvp", !r);
      return !r;
    });
  const pick = (b: string) => {
    setBuyin(b);
    write("orbitx-social3-poker-buyin", b);
  };
  return (
    <Shell icon={Spade} title="Poker Night" sub="Friday 8pm · demo event, no real buy-in">
      <p className="mb-3 text-center text-2xl font-extrabold tabular-nums">
        {dd}d : {hh}h : {mm}m : {ss}s
      </p>
      <div className="mb-3 flex gap-1.5">
        {["0.1", "0.25", "0.5", "1"].map(b => (
          <button
            key={b}
            onClick={() => pick(b)}
            className={cn(
              "flex-1 rounded-lg px-2 py-1.5 text-xs font-bold",
              buyin === b ? "bg-amber-400 text-black" : "bg-white/5 text-white/60"
            )}
          >
            {b} SOL
          </button>
        ))}
      </div>
      <button onClick={toggle} className={cn(rsvp ? btnGhost : btnPrimary, "w-full")}>
        {rsvp ? "You're in ✓ — tap to cancel" : "RSVP — I'm in"}
      </button>
    </Shell>
  );
}

/* S64 */
const FANTASY_TRADERS = [
  { name: "Vox", pnl: 38.2 },
  { name: "Mira", pnl: 14.8 },
  { name: "Kai", pnl: 22.9 },
  { name: "Juno", pnl: -6.3 },
  { name: "Nyx", pnl: 9.4 },
  { name: "Rex", pnl: -11.5 },
];
export function FantasyBags() {
  const [team, setTeam] = useState<string[]>(() => read<string[]>("orbitx-social3-fantasy", []));
  const toggle = (n: string) =>
    setTeam(t => {
      const next = t.includes(n) ? t.filter(x => x !== n) : t.length < 3 ? [...t, n] : t;
      write("orbitx-social3-fantasy", next);
      return next;
    });
  const score = FANTASY_TRADERS.filter(t => team.includes(t.name)).reduce((a, t) => a + t.pnl, 0);
  return (
    <Shell icon={Star} title="Fantasy Bags" sub="Draft 3 traders — score = their demo PNL · resets weekly">
      <DemoTag />
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {FANTASY_TRADERS.map(t => (
          <button
            key={t.name}
            onClick={() => toggle(t.name)}
            className={cn(
              "rounded-xl px-2 py-2 text-xs",
              team.includes(t.name)
                ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            )}
          >
            <p className="font-bold">{t.name}</p>
            <p className={cn("font-extrabold", t.pnl >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {t.pnl >= 0 ? "+" : ""}
              {t.pnl}%
            </p>
          </button>
        ))}
      </div>
      <p className="text-xs text-white/50">
        Your squad ({team.length}/3): <b className="text-white">{team.join(", ") || "—"}</b> · Score:{" "}
        <b className={cn(score >= 0 ? "text-emerald-400" : "text-rose-400")}>
          {score >= 0 ? "+" : ""}
          {score.toFixed(1)}%
        </b>
      </p>
    </Shell>
  );
}

/* S65 */
export function RaffleDrum() {
  const [entered, setEntered] = useState(() => read<boolean>("orbitx-social3-raffle", false));
  const [drawing, setDrawing] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const enter = () => {
    setEntered(true);
    write("orbitx-social3-raffle", true);
  };
  const draw = () => {
    if (drawing) return;
    setDrawing(true);
    setWinner(null);
    setTimeout(() => {
      const pool = entered ? ["You", "Vox", "Mira", "Juno", "Kai"] : ["Vox", "Mira", "Juno", "Kai"];
      setWinner(pool[Math.floor(Math.random() * pool.length)]);
      setDrawing(false);
    }, 1600);
  };
  return (
    <Shell icon={Ticket} title="Raffle Drum" sub="Enter once — winner drawn from the drum">
      <div className="mb-3 flex justify-center">
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/30 to-amber-600/10 text-3xl ring-1 ring-amber-400/30",
            drawing && "animate-spin"
          )}
        >
          🎰
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={enter} disabled={entered} className={cn(btnPrimary, "flex-1")}>
          {entered ? "Entered ✓" : "Enter raffle"}
        </button>
        <button onClick={draw} disabled={drawing} className={cn(btnGhost, "flex-1")}>
          {drawing ? "Drawing…" : "Draw winner"}
        </button>
      </div>
      {winner && <p className="mt-2 text-center text-sm font-extrabold text-amber-300">🎉 {winner} wins the raffle!</p>}
    </Shell>
  );
}

/* S66 */
const PRIZES = ["10 pts", "2x XP", "Mystery", "50 pts", "Retry", "100 pts", "Shoutout", "5 pts"];
const WHEEL_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
export function SpinWheel() {
  const [deg, setDeg] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    const idx = Math.floor(Math.random() * PRIZES.length);
    const target = deg - (deg % 360) + 360 * 5 + (360 - (idx * 45 + 22.5));
    setDeg(target);
    setTimeout(() => {
      setResult(PRIZES[idx]);
      setSpinning(false);
    }, 3100);
  };
  const gradient = `conic-gradient(${WHEEL_COLORS.map((c, i) => `${c} ${i * 45}deg ${(i + 1) * 45}deg`).join(",")})`;
  return (
    <Shell icon={Disc3} title="Spin Wheel" sub="8 prizes — just for fun">
      <div className="mb-3 flex justify-center">
        <div className="relative h-40 w-40">
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-xl">🔻</div>
          <div
            className="h-full w-full rounded-full ring-2 ring-amber-400/40 transition-transform duration-[3000ms] ease-out"
            style={{ transform: `rotate(${deg}deg)`, background: gradient }}
          />
          <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-lg ring-1 ring-white/20">
            🎡
          </div>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap justify-center gap-1">
        {PRIZES.map((p, i) => (
          <span
            key={i}
            className={cn(
              "rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold",
              result === p && "bg-amber-400/20 text-amber-300"
            )}
          >
            {p}
          </span>
        ))}
      </div>
      <button onClick={spin} disabled={spinning} className={cn(btnPrimary, "flex w-full items-center justify-center gap-1")}>
        <Play className="h-3 w-3" /> {spinning ? "Spinning…" : "Spin"}
      </button>
      {result && <p className="mt-2 text-center text-sm font-extrabold text-amber-300">You won: {result}!</p>}
    </Shell>
  );
}

/* S67 */
const SLOT_EMOJI = ["🍒", "🍋", "💎", "🚀", "🌙", "⭐"];
const rndEmoji = () => SLOT_EMOJI[Math.floor(Math.random() * SLOT_EMOJI.length)];
export function SlotMachine() {
  const [reels, setReels] = useState(["🍒", "🍋", "💎"]);
  const [spinning, setSpinning] = useState(false);
  const [spins, setSpins] = useState(() => read<number>("orbitx-social3-slot-spins", 0));
  const [msg, setMsg] = useState("Hit spin — three of a kind wins the jackpot!");
  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setMsg("Rolling…");
    let n = 0;
    const t = setInterval(() => {
      setReels([rndEmoji(), rndEmoji(), rndEmoji()]);
      if (++n >= 8) {
        clearInterval(t);
        const f = [rndEmoji(), rndEmoji(), rndEmoji()];
        setReels(f);
        setSpinning(false);
        setSpins(s => {
          const x = s + 1;
          write("orbitx-social3-slot-spins", x);
          return x;
        });
        setMsg(
          f[0] === f[1] && f[1] === f[2]
            ? "🎰 JACKPOT! Three of a kind!"
            : f[0] === f[1] || f[1] === f[2] || f[0] === f[2]
              ? "Nice — a pair! Spin again."
              : "No luck — spin again."
        );
      }
    }, 90);
  };
  return (
    <Shell icon={Cherry} title="Slot Machine" sub="Pure luck — no real prizes">
      <div className="mb-3 flex justify-center gap-2">
        {reels.map((r, i) => (
          <div
            key={i}
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl bg-black/50 text-4xl ring-1 ring-white/10",
              spinning && "animate-pulse"
            )}
          >
            {r}
          </div>
        ))}
      </div>
      <button onClick={spin} disabled={spinning} className={cn(btnPrimary, "w-full")}>
        {spinning ? "Spinning…" : "Spin"}
      </button>
      <p className="mt-2 text-center text-xs font-bold text-amber-300">{msg}</p>
      <p className="mt-1 text-center text-[11px] text-white/30">Total spins: {spins}</p>
    </Shell>
  );
}

/* S68 */
const DICE = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
export function DiceDuel() {
  const [score, setScore] = useState({ you: 0, vox: 0 });
  const [last, setLast] = useState<{ y: number; o: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const roll = () => {
    if (over) return;
    const y = 1 + Math.floor(Math.random() * 6);
    const o = 1 + Math.floor(Math.random() * 6);
    setLast({ y, o });
    const ny = score.you + (y > o ? 1 : 0);
    const no = score.vox + (o > y ? 1 : 0);
    setScore({ you: ny, vox: no });
    if (ny === 3) setOver("You win the duel! 🏆");
    else if (no === 3) setOver("Vox takes it — roll again?");
  };
  const reset = () => {
    setScore({ you: 0, vox: 0 });
    setLast(null);
    setOver(null);
  };
  return (
    <Shell icon={Dices} title="Dice Duel" sub="Roll vs Vox — best of 5 (first to 3)">
      <div className="mb-2 flex items-center justify-center gap-6">
        <div className="text-center">
          <p className="text-5xl">{last ? DICE[last.y - 1] : "🎲"}</p>
          <p className="mt-1 text-xs font-bold">You · {score.you}</p>
        </div>
        <span className="text-xs font-extrabold text-white/30">VS</span>
        <div className="text-center">
          <p className="text-5xl">{last ? DICE[last.o - 1] : "🎲"}</p>
          <p className="mt-1 text-xs font-bold">Vox · {score.vox}</p>
        </div>
      </div>
      {over ? (
        <div className="text-center">
          <p className="mb-2 text-sm font-extrabold text-amber-300">{over}</p>
          <button onClick={reset} className={cn(btnPrimary, "inline-flex items-center gap-1")}>
            <RotateCcw className="h-3 w-3" /> New duel
          </button>
        </div>
      ) : (
        <button onClick={roll} className={cn(btnPrimary, "w-full")}>
          Roll dice
        </button>
      )}
    </Shell>
  );
}

/* S69 */
export function CoinFlipStreak() {
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => read<number>("orbitx-social3-flip-best", 0));
  const [last, setLast] = useState<"H" | "T" | null>(null);
  const [flipping, setFlipping] = useState(false);
  const flip = () => {
    if (flipping) return;
    setFlipping(true);
    setTimeout(() => {
      const r = Math.random() > 0.5 ? "H" : "T";
      const ns = last === null || r === last ? streak + 1 : 1;
      setStreak(ns);
      setLast(r);
      setFlipping(false);
      if (ns > best) {
        setBest(ns);
        write("orbitx-social3-flip-best", ns);
      }
    }, 500);
  };
  return (
    <Shell icon={Coins} title="Coin Flip Streak" sub="Same side in a row builds your streak">
      <div className="mb-3 flex justify-center">
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-2xl font-extrabold text-black shadow-lg",
            flipping && "animate-bounce"
          )}
        >
          {flipping ? "?" : (last ?? "?")}
        </div>
      </div>
      <div className="mb-3 flex items-center justify-center gap-4 text-xs">
        <span>
          Streak: <b className="text-amber-300">{streak}</b>
        </span>
        <span className="text-white/30">·</span>
        <span>
          Best: <b className="text-amber-300">{best}</b>
        </span>
      </div>
      <button onClick={flip} disabled={flipping} className={cn(btnPrimary, "w-full")}>
        {flipping ? "Flipping…" : "Flip coin"}
      </button>
    </Shell>
  );
}

/* S70 */
const RPS = ["🪨", "📄", "✂️"];
export function RockPaperScissors() {
  const [score, setScore] = useState({ you: 0, cpu: 0 });
  const [last, setLast] = useState<{ y: number; c: number; msg: string } | null>(null);
  const over = score.you >= 5 || score.cpu >= 5;
  const play = (m: number) => {
    if (over) return;
    const c = Math.floor(Math.random() * 3);
    const d = (m - c + 3) % 3;
    const msg = d === 0 ? "Tie!" : d === 1 ? "You take the round!" : "CPU takes the round.";
    setLast({ y: m, c, msg });
    if (d === 1) setScore(s => ({ ...s, you: s.you + 1 }));
    else if (d === 2) setScore(s => ({ ...s, cpu: s.cpu + 1 }));
  };
  const reset = () => {
    setScore({ you: 0, cpu: 0 });
    setLast(null);
  };
  return (
    <Shell icon={Scissors} title="Rock Paper Scissors" sub="Vs the computer — first to 5">
      <div className="mb-2 flex items-center justify-center gap-3 text-xs font-bold">
        <span>
          You <b className="text-amber-300">{score.you}</b>
        </span>
        <span className="text-white/30">·</span>
        <span>
          CPU <b className="text-amber-300">{score.cpu}</b>
        </span>
      </div>
      {last && (
        <p className="mb-2 text-center text-xs text-white/60">
          {RPS[last.y]} vs {RPS[last.c]} — {last.msg}
        </p>
      )}
      {over ? (
        <div className="text-center">
          <p className="mb-2 text-sm font-extrabold text-amber-300">
            {score.you >= 5 ? "You win! 🏆" : "CPU wins — run it back?"}
          </p>
          <button onClick={reset} className={cn(btnPrimary, "inline-flex items-center gap-1")}>
            <RotateCcw className="h-3 w-3" /> Play again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {RPS.map((e, i) => (
            <button key={i} onClick={() => play(i)} className="rounded-xl bg-white/5 py-3 text-3xl hover:bg-white/10">
              {e}
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

/* S71 */
const QUIZ = [
  { q: "What is the ORBITX token symbol?", opts: ["ORBT", "ORBITX", "OBX", "ORX"], a: 1 },
  { q: "How many decimals does ORBITX use?", opts: ["6", "9", "8", "18"], a: 0 },
  { q: "Which bot posts ORBITX buy alerts to Telegram?", opts: ["@OrbitxBot", "@OrbitxSupportbot", "@SolanaAlerts", "@OrbitXNews"], a: 1 },
  { q: "How often does the buy bot check X for new posts?", opts: ["Every 12s", "Every 30s", "Every 90s", "Every 5m"], a: 2 },
  { q: "What does the buy bot detect on-chain?", opts: ["Only sells", "Buys and burns", "Only mints", "Airdrops"], a: 1 },
];
export function TriviaNight() {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [best, setBest] = useState(() => read<number>("orbitx-social3-trivia-best", 0));
  const done = idx >= QUIZ.length;
  const answer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ns = score + (i === QUIZ[idx].a ? 1 : 0);
    if (i === QUIZ[idx].a) setScore(ns);
    setTimeout(() => {
      if (idx + 1 >= QUIZ.length && ns > best) {
        setBest(ns);
        write("orbitx-social3-trivia-best", ns);
      }
      setIdx(x => x + 1);
      setPicked(null);
    }, 900);
  };
  const reset = () => {
    setIdx(0);
    setScore(0);
    setPicked(null);
  };
  return (
    <Shell icon={Brain} title="Trivia Night" sub={`5 ORBITX questions · best: ${best}/5`}>
      {done ? (
        <div className="text-center">
          <p className="mb-1 text-3xl font-extrabold text-amber-300">{score}/5</p>
          <p className="mb-3 text-xs text-white/50">
            {score === 5 ? "Perfect — true OrbitX maxi! 🏆" : score >= 3 ? "Solid! One more run?" : "Brush up and try again!"}
          </p>
          <button onClick={reset} className={cn(btnPrimary, "inline-flex items-center gap-1")}>
            <RotateCcw className="h-3 w-3" /> Play again
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-1 text-[11px] text-white/40">
            Question {idx + 1} of {QUIZ.length}
          </p>
          <p className="mb-2 text-sm font-bold">{QUIZ[idx].q}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUIZ[idx].opts.map((o, i) => (
              <button
                key={i}
                onClick={() => answer(i)}
                disabled={picked !== null}
                className={cn(
                  "rounded-xl px-2 py-2 text-xs font-bold disabled:opacity-100",
                  picked === null
                    ? "bg-white/5 text-white/80 hover:bg-white/10"
                    : i === QUIZ[idx].a
                      ? "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/40"
                      : picked === i
                        ? "bg-rose-400/20 text-rose-300 ring-1 ring-rose-400/40"
                        : "bg-white/5 text-white/40"
                )}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* S72 */
const TYPE_PHRASE = "OrbitX traders ride the momentum and never sell the dip";
export function TypingRace() {
  const [input, setInput] = useState("");
  const [start, setStart] = useState<number | null>(null);
  const [result, setResult] = useState<{ wpm: number; secs: number } | null>(null);
  const [best, setBest] = useState(() => read<number>("orbitx-social3-type-best", 0));
  const onChange = (v: string) => {
    if (result) return;
    const s = start ?? (v.length > 0 ? Date.now() : null);
    if (start === null && s !== null) setStart(s);
    setInput(v.slice(0, TYPE_PHRASE.length));
    if (v === TYPE_PHRASE && s !== null) {
      const secs = Math.max(0.1, (Date.now() - s) / 1000);
      const wpm = Math.round(TYPE_PHRASE.length / 5 / (secs / 60));
      setResult({ wpm, secs });
      if (wpm > best) {
        setBest(wpm);
        write("orbitx-social3-type-best", wpm);
      }
    }
  };
  const reset = () => {
    setInput("");
    setStart(null);
    setResult(null);
  };
  const correct = [...input].filter((c, i) => c === TYPE_PHRASE[i]).length;
  return (
    <Shell icon={Keyboard} title="Typing Race" sub={`Type it fast · best: ${best} WPM`}>
      <p className="mb-2 rounded-xl bg-white/5 p-3 font-mono text-xs leading-relaxed">
        {[...TYPE_PHRASE].map((c, i) => (
          <span
            key={i}
            className={cn(
              i < input.length
                ? input[i] === c
                  ? "text-emerald-400"
                  : "text-rose-400"
                : "text-white/50"
            )}
          >
            {c}
          </span>
        ))}
      </p>
      <input
        value={input}
        onChange={e => onChange(e.target.value)}
        placeholder="Start typing…"
        className={inputCls}
        autoComplete="off"
      />
      {result && (
        <div className="mt-2 text-center">
          <p className="text-sm font-extrabold text-amber-300">
            {result.wpm} WPM · {result.secs.toFixed(1)}s
          </p>
          <button onClick={reset} className={cn(btnGhost, "mt-2 inline-flex items-center gap-1")}>
            <RotateCcw className="h-3 w-3" /> Race again
          </button>
        </div>
      )}
      {!result && input.length > 0 && (
        <p className="mt-1 text-[11px] text-white/40">
          {correct}/{TYPE_PHRASE.length} correct
        </p>
      )}
    </Shell>
  );
}

/* S73 */
const MEMO_EMOJI = ["🚀", "💎", "🌙", "🔥", "⚡", "🪐", "💰", "⭐"];
function shuffledDeck() {
  const d = [...MEMO_EMOJI, ...MEMO_EMOJI];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
export function MemoryMatch() {
  const [deck, setDeck] = useState<string[]>(shuffledDeck);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState(() => read<number>("orbitx-social3-memory-best", 0));
  const won = found.length === MEMO_EMOJI.length;
  const flip = (i: number) => {
    if (won || open.includes(i) || open.length === 2 || found.includes(deck[i])) return;
    const no = [...open, i];
    setOpen(no);
    if (no.length === 2) {
      const nm = moves + 1;
      setMoves(nm);
      if (deck[no[0]] === deck[no[1]]) {
        const nf = [...found, deck[no[0]]];
        setFound(nf);
        setOpen([]);
        if (nf.length === MEMO_EMOJI.length && (best === 0 || nm < best)) {
          setBest(nm);
          write("orbitx-social3-memory-best", nm);
        }
      } else {
        setTimeout(() => setOpen([]), 650);
      }
    }
  };
  const reset = () => {
    setDeck(shuffledDeck());
    setOpen([]);
    setFound([]);
    setMoves(0);
  };
  return (
    <Shell icon={LayoutGrid} title="Memory Match" sub={`Find all 8 pairs · moves: ${moves} · best: ${best || "—"}`}>
      <div className="mb-2 grid grid-cols-4 gap-1.5">
        {deck.map((e, i) => {
          const face = open.includes(i) || found.includes(e);
          return (
            <button
              key={i}
              onClick={() => flip(i)}
              disabled={face}
              className={cn(
                "flex h-12 items-center justify-center rounded-xl text-2xl",
                face ? "bg-white/10" : "bg-white/5 hover:bg-white/10"
              )}
            >
              {face ? e : "❔"}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/50">{won ? "🎉 Cleared! Play again?" : `${found.length}/8 pairs found`}</p>
        <button onClick={reset} className={cn(btnGhost, "inline-flex items-center gap-1")}>
          <RotateCcw className="h-3 w-3" /> Shuffle
        </button>
      </div>
    </Shell>
  );
}

/* S74 */
export function SnakeGame() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => read<number>("orbitx-social3-snake-best", 0));
  const [running, setRunning] = useState(false);
  const g = useRef<{ s: [number, number][]; d: [number, number]; f: [number, number] } | null>(null);
  const scoreRef = useRef(0);
  const N = 16;
  const C = 12;
  const turn = (x: number, y: number) => {
    const st = g.current;
    if (!st) return;
    if (st.d[0] !== -x || st.d[1] !== -y) st.d = [x, y];
  };
  const start = () => {
    g.current = {
      s: [
        [8, 8],
        [7, 8],
        [6, 8],
      ],
      d: [1, 0],
      f: [Math.floor(Math.random() * N), Math.floor(Math.random() * N)],
    };
    scoreRef.current = 0;
    setScore(0);
    setRunning(true);
  };
  useEffect(() => {
    if (!running) return;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) {
      setRunning(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") turn(0, -1);
      else if (e.key === "ArrowDown") turn(0, 1);
      else if (e.key === "ArrowLeft") turn(-1, 0);
      else if (e.key === "ArrowRight") turn(1, 0);
    };
    window.addEventListener("keydown", onKey);
    const t = setInterval(() => {
      const st = g.current;
      if (!st) return;
      const h: [number, number] = [st.s[0][0] + st.d[0], st.s[0][1] + st.d[1]];
      if (h[0] < 0 || h[1] < 0 || h[0] >= N || h[1] >= N || st.s.some(p => p[0] === h[0] && p[1] === h[1])) {
        setRunning(false);
        setBest(b => {
          const nb = Math.max(b, scoreRef.current);
          write("orbitx-social3-snake-best", nb);
          return nb;
        });
        return;
      }
      st.s.unshift(h);
      if (h[0] === st.f[0] && h[1] === st.f[1]) {
        scoreRef.current += 1;
        setScore(scoreRef.current);
        st.f = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
      } else {
        st.s.pop();
      }
      ctx.fillStyle = "#0b0f1a";
      ctx.fillRect(0, 0, N * C, N * C);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(st.f[0] * C, st.f[1] * C, C, C);
      ctx.fillStyle = "#34d399";
      st.s.forEach(p => ctx.fillRect(p[0] * C + 1, p[1] * C + 1, C - 2, C - 2));
    }, 130);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  return (
    <Shell icon={Gamepad2} title="Snake" sub={`Arrow keys or pad · score: ${score} · best: ${best}`}>
      <div className="mb-2 flex justify-center">
        <canvas ref={canvas} width={N * C} height={N * C} className="rounded-xl ring-1 ring-white/10" />
      </div>
      {!running && (
        <button onClick={start} className={cn(btnPrimary, "mb-2 flex w-full items-center justify-center gap-1")}>
          <Play className="h-3 w-3" /> {score > 0 || best > 0 ? "Play again" : "Start"}
        </button>
      )}
      <div className="mx-auto grid w-36 grid-cols-3 gap-1">
        <span />
        <button onClick={() => turn(0, -1)} className={btnGhost}>
          ▲
        </button>
        <span />
        <button onClick={() => turn(-1, 0)} className={btnGhost}>
          ◀
        </button>
        <button onClick={() => turn(0, 1)} className={btnGhost}>
          ▼
        </button>
        <button onClick={() => turn(1, 0)} className={btnGhost}>
          ▶
        </button>
      </div>
    </Shell>
  );
}

/* S75 */
const CHESS_OPTS = ["1. Qxh7#", "1. Qxg7+", "1. Nxh7"];
export function ChessPuzzle() {
  const [picked, setPicked] = useState<number | null>(null);
  const [streak, setStreak] = useState(() => read<number>("orbitx-social3-chess-streak", 0));
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === 0) {
      const n = streak + 1;
      setStreak(n);
      write("orbitx-social3-chess-streak", n);
    } else {
      setStreak(0);
      write("orbitx-social3-chess-streak", 0);
    }
  };
  return (
    <Shell icon={Crown} title="Chess Puzzle" sub={`Mate in 1 · streak: ${streak}`}>
      <div className="mb-3 rounded-xl bg-white/5 p-3 font-mono text-xs leading-relaxed text-white/70">
        <p>
          <b className="text-white">White:</b> Kg1, Qd3, Nf6
        </p>
        <p>
          <b className="text-white">Black:</b> Kh8, pawns g7 h7
        </p>
        <p className="mt-1 text-white/50">White to move — find mate in 1.</p>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {CHESS_OPTS.map((o, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            disabled={picked !== null}
            className={cn(
              "rounded-xl px-2 py-2 font-mono text-xs font-bold disabled:opacity-100",
              picked === null
                ? "bg-white/5 text-white/80 hover:bg-white/10"
                : i === 0
                  ? "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/40"
                  : picked === i
                    ? "bg-rose-400/20 text-rose-300 ring-1 ring-rose-400/40"
                    : "bg-white/5 text-white/40"
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="mt-2 text-center">
          <p
            className={cn(
              "flex items-center justify-center gap-1 text-xs font-extrabold",
              picked === 0 ? "text-emerald-400" : "text-rose-400"
            )}
          >
            {picked === 0 && <Check className="h-3 w-3" />}
            {picked === 0
              ? "Correct! Qxh7# — the knight on f6 covers the king's escape."
              : "Not quite — the right move was 1. Qxh7#."}
          </p>
          <button onClick={() => setPicked(null)} className={cn(btnGhost, "mt-2")}>
            Try again
          </button>
        </div>
      )}
    </Shell>
  );
}
