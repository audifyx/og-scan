import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Snowflake, Gift, Ghost, Hourglass, Timer, Sparkles, MousePointerClick,
  ShieldAlert, Users, Loader2, WifiOff, PhoneCall, MonitorX, Circle,
  AlarmClock, Sun, Droplets, Clock3, BatteryMedium, Brain, Radiation,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Internal card shell — dark card with icon, title, subtitle. */
function Shell({
  icon: Icon, iconClass, title, sub, children,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClass?: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-purple-500/20 text-purple-300", iconClass)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-sm leading-tight">{title}</h3>
          {sub && <p className="text-white/50 text-xs leading-tight">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function readLS(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeLS(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* private mode, whatever */ }
}

/* W89 */
export function SeasonSwitcher() {
  type Season = "christmas" | "halloween" | "none";
  const [season, setSeason] = useState<Season>(() => (readLS("orbitx-wild5-season", "none") as Season));
  const pick = (s: Season) => { setSeason(s); writeLS("orbitx-wild5-season", s); };
  const emoji = season === "christmas" ? "❄️" : "🦇";
  return (
    <Shell icon={Snowflake} title="Season Switcher" sub="festive nonsense, contained to this card">
      <div className="relative overflow-hidden rounded-xl bg-black/30 p-4 min-h-[110px]">
        <div className="flex gap-2 relative z-10">
          {(["christmas", "halloween", "none"] as Season[]).map((s) => (
            <button key={s} onClick={() => pick(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                season === s ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/20")}>
              {s === "christmas" ? "🎄 Christmas" : s === "halloween" ? "🎃 Halloween" : "None"}
            </button>
          ))}
        </div>
        {season !== "none" && (
          <div className="pointer-events-none absolute inset-0">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="absolute animate-[wild5fall_3.5s_linear_infinite]"
                style={{ left: `${4 + i * 8}%`, top: "-12%", animationDelay: `${i * 0.35}s` }}>
                {emoji}
              </span>
            ))}
          </div>
        )}
        <style>{`@keyframes wild5fall { to { transform: translateY(150px) rotate(40deg); } }`}</style>
      </div>
      <p className="text-white/40 text-xs mt-2">the seasons change. your bags don't.</p>
    </Shell>
  );
}

/* W90 */
export function AdventCalendar() {
  const now = new Date();
  const isDec = now.getMonth() === 11;
  const today = now.getDate();
  const [opened, setOpened] = useState<number[]>(() => {
    try { return JSON.parse(readLS("orbitx-wild5-advent", "[]")); } catch { return []; }
  });
  const open = (d: number) => {
    if (!isDec || d > today || opened.includes(d)) return;
    const next = [...opened, d];
    setOpened(next); writeLS("orbitx-wild5-advent", JSON.stringify(next));
  };
  if (!isDec) {
    return (
      <Shell icon={Gift} title="Advent Calendar" sub="patience is a virtue">
        <p className="text-white/60 text-sm">come back in december.</p>
        <div className="mt-3">
          <button onClick={() => open(1)} disabled
            className="w-12 h-12 rounded-lg bg-white/10 border border-white/15 text-lg opacity-50 cursor-not-allowed">1</button>
          <p className="text-white/40 text-xs mt-2">fine — one demo door, since you asked so nicely. it's decorative.</p>
        </div>
      </Shell>
    );
  }
  return (
    <Shell icon={Gift} title="Advent Calendar" sub="one door per day, no peeking">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 25 }).map((_, i) => {
          const d = i + 1, isOpen = opened.includes(d), can = d <= today && !isOpen;
          return (
            <button key={d} onClick={() => open(d)} disabled={!can}
              className={cn("h-11 rounded-lg text-sm font-bold border transition",
                isOpen ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                : can ? "bg-white/10 border-white/20 text-white hover:bg-white/20"
                : "bg-black/30 border-white/10 text-white/30 cursor-not-allowed")}>
              {isOpen ? "🎁" : d}
            </button>
          );
        })}
      </div>
      <p className="text-white/40 text-xs mt-2">behind every door: the same thing. hope.</p>
    </Shell>
  );
}

/* W91 */
export function HalloweenMode() {
  const [creepy, setCreepy] = useState(false);
  const last = new Date(new Date().getFullYear(), 9, 31);
  if (new Date() < last) last.setFullYear(last.getFullYear() - 1);
  const candles = Math.floor((Date.now() - last.getTime()) / 86400000);
  return (
    <Shell icon={Ghost} title="Halloween Mode" sub="spooky season never ends in crypto" iconClass="bg-orange-500/20 text-orange-300">
      <div className="rounded-xl bg-black/40 p-4 text-center">
        <div className="text-5xl animate-pulse">🎃</div>
        <p className={cn("text-white/80 text-sm mt-2", creepy && "italic tracking-[0.3em] uppercase")}
          style={creepy ? { fontFamily: "Georgia, serif" } : undefined}>
          the charts are scarier than any ghost
        </p>
        <p className="text-orange-300/80 text-xs mt-1">🕯️ spooky candle count: {candles} days since halloween</p>
        <button onClick={() => setCreepy((c) => !c)}
          className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500/20 text-orange-200 hover:bg-orange-500/30">
          {creepy ? "unspookify" : "creepy font: ON"}
        </button>
      </div>
    </Shell>
  );
}

/* W92 */
export function CountdownTo2099() {
  const target = useRef(new Date(2099, 0, 1).getTime());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, target.current - now);
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24;
  const m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <Shell icon={Hourglass} title="Countdown to 2099" sub="when your grandkids finally sell" iconClass="bg-amber-500/20 text-amber-300">
      <div className="grid grid-cols-4 gap-2 text-center">
        {[[d, "days"], [pad(h), "hrs"], [pad(m), "min"], [pad(s), "sec"]].map(([v, l]) => (
          <div key={l as string} className="rounded-lg bg-black/40 py-2">
            <div className="text-white font-mono font-bold text-lg">{v}</div>
            <div className="text-white/40 text-[10px] uppercase">{l}</div>
          </div>
        ))}
      </div>
      <p className="text-white/40 text-xs mt-2">plenty of time for "just one more dip".</p>
    </Shell>
  );
}

/* W93 */
export function MillisecondTicker() {
  const [t, setT] = useState("");
  useEffect(() => {
    const fmt = () => {
      const n = new Date();
      setT(`${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}:${String(n.getSeconds()).padStart(2, "0")}.${String(n.getMilliseconds()).padStart(3, "0")}`);
    };
    fmt();
    const id = setInterval(fmt, 47);
    return () => clearInterval(id);
  }, []);
  return (
    <Shell icon={Timer} title="Millisecond Ticker" sub="you're welcome" iconClass="bg-cyan-500/20 text-cyan-300">
      <div className="rounded-xl bg-black/40 p-3 text-center">
        <div className="text-white font-mono text-2xl font-bold tabular-nums">{t}</div>
        <p className="text-white/40 text-xs mt-1">47ms refresh. because 50 was too round.</p>
      </div>
    </Shell>
  );
}

/* W94 */
const FACTS = [
  "A group of jeets is called a disappointment.",
  "The average holder checks the chart 47 times per day. The productive ones: 46.",
  "Diamond hands were invented because paper hands kept dropping the chart.",
  "99% of 'utility' is a Discord server with announcements off.",
  "Satoshi's real identity: whoever didn't sell.",
  "The bull run is always 2 weeks away. It has been 2 weeks away since 2021.",
  "Buying high and selling low is technically a strategy. A bad one.",
  "Hopium is the only asset that never rugs. It just expires.",
  "Every candle has a wick. Every wick has a lesson. Every lesson is ignored.",
  "The floor is lava. The ceiling is a rumor.",
  "'DYOR' is Latin for 'I have no idea either'.",
  "Whales don't panic sell. They panic buy your panic sell.",
  "The best time to buy was 10 years ago. The second best time is during a meeting.",
  "Gas fees are just the blockchain's way of saying 'are you sure?'",
  "This fact machine has shipped more than most roadmaps.",
];
export function RandomFactMachine() {
  const [fact, setFact] = useState("press the button. knowledge awaits.");
  const spin = () => {
    let next = fact;
    while (next === fact) next = FACTS[Math.floor(Math.random() * FACTS.length)];
    setFact(next);
  };
  return (
    <Shell icon={Sparkles} title="Random Fact Machine" sub="100% certified* facts (*not certified)" iconClass="bg-pink-500/20 text-pink-300">
      <p className="text-white/80 text-sm min-h-[3.5rem] italic">"{fact}"</p>
      <button onClick={spin}
        className="mt-2 px-4 py-2 rounded-xl bg-pink-500/20 text-pink-200 text-sm font-bold hover:bg-pink-500/30 transition">
        gimme wisdom
      </button>
    </Shell>
  );
}

/* W95 */
export function UselessButton() {
  const [n, setN] = useState(() => parseInt(readLS("orbitx-wild5-useless", "0"), 10) || 0);
  const press = () => {
    const next = n + 1;
    setN(next); writeLS("orbitx-wild5-useless", String(next));
  };
  const milestone = n >= 100 ? "💯 100 presses. you are the product now."
    : n >= 50 ? "🏅 50 presses. nothing has happened. impressive."
    : n >= 10 ? "🥉 10 presses. the button respects your commitment."
    : null;
  return (
    <Shell icon={MousePointerClick} title="Useless Button" sub="it does nothing. you'll press it anyway." iconClass="bg-red-500/20 text-red-300">
      <button onClick={press}
        className="w-full py-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-100 font-bold text-sm hover:bg-red-500/30 active:scale-95 transition">
        DO NOT PRESS
      </button>
      <p className="text-white/50 text-xs mt-2">presses: <span className="text-white font-mono font-bold">{n}</span></p>
      {milestone && <p className="text-yellow-300/90 text-xs mt-1">{milestone}</p>}
    </Shell>
  );
}

/* W96 */
export function PatienceTester() {
  const [left, setLeft] = useState(30);
  const [won, setWon] = useState(false);
  useEffect(() => {
    if (won) return;
    if (left <= 0) { setWon(true); return; }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [left, won]);
  return (
    <Shell icon={ShieldAlert} title="Patience Tester" sub="do not click for 30 seconds" iconClass="bg-emerald-500/20 text-emerald-300">
      {won ? (
        <p className="text-emerald-300 text-sm font-semibold">🏆 you lasted. the bull run salutes you.</p>
      ) : (
        <>
          <div className="text-white font-mono text-3xl font-bold text-center">{left}s</div>
          <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
            <div className="h-full bg-emerald-400/70 transition-all" style={{ width: `${(left / 30) * 100}%` }} />
          </div>
          <button onClick={() => setLeft(30)}
            className="mt-3 w-full py-2 rounded-xl bg-white/10 text-white/70 text-xs font-bold hover:bg-white/20 transition">
            click me (resets the timer)
          </button>
        </>
      )}
    </Shell>
  );
}

/* W97 */
export function WaitingRoom() {
  const [line, setLine] = useState(4);
  useEffect(() => {
    if (line <= 0) return;
    const id = setTimeout(() => setLine((l) => l - 1), 8000);
    return () => clearTimeout(id);
  }, [line]);
  return (
    <Shell icon={Users} title="Waiting Room" sub="please hold, your trade is important to us" iconClass="bg-blue-500/20 text-blue-300">
      {line > 0 ? (
        <>
          <p className="text-white text-sm">you are <span className="font-mono font-bold text-blue-300 text-lg">#{line}</span> in line.</p>
          <p className="text-white/40 text-xs mt-1">estimated wait: yes.</p>
        </>
      ) : (
        <p className="text-white/80 text-sm">just kidding. there's no line. there never was. 🎪</p>
      )}
    </Shell>
  );
}

/* W98 */
const TIPS = [
  "tip: the chart goes up if you believe hard enough",
  "tip: closing the tab counts as a stop loss",
  "tip: red candles are just green candles in a costume",
  "tip: your portfolio is a mood ring for money",
];
export function LoadingScreenSim() {
  const [pct, setPct] = useState(0);
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPct((p) => (p >= 99 ? 99 : p + Math.ceil(Math.random() * 7))), 400);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <Shell icon={Loader2} title="Loading Screen Simulator" sub="it'll finish when the bull run does" iconClass="bg-indigo-500/20 text-indigo-300">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-indigo-300 animate-spin shrink-0" />
        <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-indigo-400/80 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-white font-mono text-xs w-9 text-right">{pct}%</span>
      </div>
      <p className="text-white/40 text-xs mt-2">{TIPS[tip]}</p>
    </Shell>
  );
}

/* W99 */
const QUALITIES = ["1080p", "720p", "480p", "360p", "240p", "144p"];
export function BufferingBar() {
  const [q, setQ] = useState(0);
  useEffect(() => {
    if (q >= QUALITIES.length - 1) return;
    const id = setTimeout(() => setQ((x) => x + 1), 3500);
    return () => clearTimeout(id);
  }, [q]);
  return (
    <Shell icon={WifiOff} title="Buffering Bar" sub="check your hopium connection" iconClass="bg-orange-500/20 text-orange-300">
      <div className="flex items-center gap-3">
        <Loader2 className="w-6 h-6 text-orange-300 animate-spin shrink-0" />
        <div>
          <p className="text-white text-sm font-semibold">buffering gains…</p>
          <p className="text-white/40 text-xs">quality auto-dropped to <span className="text-orange-300 font-mono font-bold">{QUALITIES[q]}</span></p>
        </div>
      </div>
      {q >= QUALITIES.length - 1 && (
        <p className="text-white/40 text-xs mt-2">minimum quality reached. your profits are now in 144p.</p>
      )}
    </Shell>
  );
}

/* W100 */
const DIAL_STEPS = ["dialing…", "handshaking…", "negotiating…", "CONNECTED at 56k"];
export function DialUpVisual() {
  const [step, setStep] = useState(-1);
  const start = useCallback(() => {
    setStep(0);
    DIAL_STEPS.slice(1).forEach((_, i) => setTimeout(() => setStep(i + 1), (i + 1) * 1400));
  }, []);
  return (
    <Shell icon={PhoneCall} title="Dial-Up Visual" sub="the original degen latency" iconClass="bg-yellow-500/20 text-yellow-300">
      <div className="rounded-xl bg-black/40 p-3 font-mono text-xs space-y-1.5 min-h-[92px]">
        {step === -1 && <p className="text-white/40">modem idle. like your portfolio.</p>}
        {DIAL_STEPS.slice(0, step + 1).map((s, i) => (
          <p key={i} className={i === DIAL_STEPS.length - 1 && step === i ? "text-emerald-300 font-bold" : "text-yellow-200/80"}>
            {i < step || (i === DIAL_STEPS.length - 1 && step === i) ? "✓" : "…"} {s}
          </p>
        ))}
      </div>
      <button onClick={start} disabled={step >= 0 && step < DIAL_STEPS.length - 1}
        className="mt-2 px-4 py-2 rounded-xl bg-yellow-500/20 text-yellow-200 text-xs font-bold hover:bg-yellow-500/30 transition disabled:opacity-40">
        {step === DIAL_STEPS.length - 1 ? "redial" : step === -1 ? "connect" : "connecting…"}
      </button>
    </Shell>
  );
}

/* W101 */
export function BSOD() {
  const [dead, setDead] = useState(true);
  useEffect(() => {
    if (!dead) return;
    const reboot = () => setDead(false);
    window.addEventListener("keydown", reboot);
    return () => window.removeEventListener("keydown", reboot);
  }, [dead]);
  return (
    <Shell icon={MonitorX} title="Blue Screen of Death" sub="authentic crash experience" iconClass="bg-sky-500/20 text-sky-300">
      {dead ? (
        <button onClick={() => setDead(false)} className="w-full text-left rounded-xl bg-[#1a3a8f] p-4 text-[#cfe3ff]">
          <p className="text-4xl mb-2">:(</p>
          <p className="text-sm font-semibold">Your bags ran into a problem and need to restart.</p>
          <p className="text-xs mt-2 opacity-80">Stop code: <span className="font-mono font-bold">BAG_DIED_TRYING</span></p>
          <p className="text-xs mt-3 underline opacity-70">press any key to reboot</p>
        </button>
      ) : (
        <p className="text-emerald-300 text-sm">✅ rebooted. same bags, new attitude.</p>
      )}
    </Shell>
  );
}

/* W102 */
export function NothingMachine() {
  const [prestige, setPrestige] = useState(0);
  return (
    <Shell icon={Circle} title="Nothing Machine" sub="does nothing, beautifully" iconClass="bg-slate-500/20 text-slate-300">
      <div className="flex flex-col items-center py-2">
        <div className="w-14 h-14 rounded-full border-2 border-white/20 animate-ping opacity-30" />
        <div className="w-14 h-14 rounded-full border border-white/30 -mt-14 flex items-center justify-center">
          <span className="text-white/40 text-xs">∅</span>
        </div>
        <p className="text-white/60 text-sm mt-3">features shipped: <span className="font-mono font-bold text-white">0</span></p>
        <p className="text-white/40 text-xs">prestige: <span className="font-mono font-bold text-amber-300">{prestige}</span></p>
        <button onClick={() => setPrestige((p) => p + 1)}
          className="mt-2 px-3 py-1.5 rounded-lg bg-white/10 text-white/70 text-xs font-bold hover:bg-white/20 transition">
          gaze into the void (+1 prestige)
        </button>
      </div>
    </Shell>
  );
}

/* W103 */
export function ProcrastinationStation() {
  const [days, setDays] = useState(() => parseInt(readLS("orbitx-wild5-snooze", "0"), 10) || 0);
  const snooze = () => {
    const next = days + 1;
    setDays(next); writeLS("orbitx-wild5-snooze", String(next));
  };
  const guilt = Math.min(100, days * 12);
  return (
    <Shell icon={AlarmClock} title="Procrastination Station" sub="i'll buy the dip tomorrow" iconClass="bg-rose-500/20 text-rose-300">
      <p className="text-white/80 text-sm">dip-buying delayed by <span className="font-mono font-bold text-rose-300">{days}</span> day{days === 1 ? "" : "s"}</p>
      <div className="mt-2">
        <div className="flex justify-between text-[10px] uppercase text-white/40 mb-1"><span>guilt meter</span><span>{guilt}%</span></div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-rose-400/80 transition-all" style={{ width: `${guilt}%` }} />
        </div>
      </div>
      <button onClick={snooze}
        className="mt-3 px-4 py-2 rounded-xl bg-rose-500/20 text-rose-200 text-sm font-bold hover:bg-rose-500/30 transition">
        snooze +1 day
      </button>
    </Shell>
  );
}

/* W104 */
export function NapTimer() {
  const [left, setLeft] = useState(20 * 60);
  const [running, setRunning] = useState(false);
  const done = left <= 0;
  useEffect(() => {
    if (!running || done) return;
    const id = setTimeout(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearTimeout(id);
  }, [running, done, left]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <Shell icon={Timer} title="Nap Timer" sub="20-minute power nap" iconClass="bg-teal-500/20 text-teal-300">
      {done ? (
        <p className="text-teal-200 text-sm font-semibold">⏰ wake up, we're rich (maybe).</p>
      ) : (
        <div className="text-white font-mono text-3xl font-bold text-center tabular-nums">{mm}:{ss}</div>
      )}
      <div className="flex gap-2 mt-3">
        <button onClick={() => setRunning((r) => !r)} disabled={done}
          className="flex-1 py-2 rounded-xl bg-teal-500/20 text-teal-200 text-xs font-bold hover:bg-teal-500/30 transition disabled:opacity-40">
          {running ? "pause" : "start"}
        </button>
        <button onClick={() => { setLeft(20 * 60); setRunning(false); }}
          className="flex-1 py-2 rounded-xl bg-white/10 text-white/70 text-xs font-bold hover:bg-white/20 transition">
          reset
        </button>
      </div>
    </Shell>
  );
}

/* W105 */
export function TouchGrassReminder() {
  const [last, setLast] = useState(() => parseInt(readLS("orbitx-wild5-grass", "0"), 10) || Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  const touch = () => { const t = Date.now(); setLast(t); writeLS("orbitx-wild5-grass", String(t)); };
  const mins = Math.floor((now - last) / 60000);
  const msg = mins < 1 ? "ok you're fine. for now."
    : mins < 60 ? "the sun is a free chart. go look at it."
    : mins < 1440 ? "your houseplants are filing a missing person report."
    : "scientists confirm: you have become furniture.";
  return (
    <Shell icon={Sun} title="Touch Grass Reminder" sub="outdoor activities: the original airdrop" iconClass="bg-green-500/20 text-green-300">
      <p className="text-white text-sm">time since grass: <span className="font-mono font-bold text-green-300">
        {mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}</span></p>
      <p className="text-white/50 text-xs mt-1 italic">{msg}</p>
      <button onClick={touch}
        className="mt-3 px-4 py-2 rounded-xl bg-green-500/20 text-green-200 text-sm font-bold hover:bg-green-500/30 transition">
        🌱 i touched grass
      </button>
    </Shell>
  );
}

/* W106 */
export function HydrationReminder() {
  const dayKey = new Date().toISOString().slice(0, 10);
  const lsKey = `orbitx-wild5-hydration-${dayKey}`;
  const [glasses, setGlasses] = useState(() => parseInt(readLS(lsKey, "0"), 10) || 0);
  const add = () => {
    const next = Math.min(12, glasses + 1);
    setGlasses(next); writeLS(lsKey, String(next));
  };
  const GOAL = 8;
  return (
    <Shell icon={Droplets} title="Hydration Reminder" sub="tears count as hydration" iconClass="bg-sky-500/20 text-sky-300">
      <div className="flex gap-1.5 flex-wrap">
        {Array.from({ length: GOAL }).map((_, i) => (
          <span key={i} className={cn("text-xl", i < glasses ? "" : "opacity-25 grayscale")}>💧</span>
        ))}
      </div>
      <p className="text-white/60 text-xs mt-2">{glasses}/{GOAL} glasses today{glasses >= GOAL ? " — hydrated legend 💪" : ""}</p>
      <button onClick={add}
        className="mt-2 px-4 py-2 rounded-xl bg-sky-500/20 text-sky-200 text-sm font-bold hover:bg-sky-500/30 transition">
        +1 glass
      </button>
    </Shell>
  );
}

/* W107 */
const SHAME = [
  [1, "already? the page just loaded."],
  [5, "five minutes. the chart hasn't moved. you have."],
  [15, "quarter of an hour. hopium levels critical."],
  [30, "thirty minutes. go touch grass (see W105)."],
  [60, "an hour. you're not early anymore, you're resident."],
];
export function ScreenTimeShame() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.floor(secs / 60);
  const shame = [...SHAME].reverse().find(([m]) => mins >= m);
  return (
    <Shell icon={Clock3} title="Screen Time Shame" sub="we're counting. yes, really." iconClass="bg-fuchsia-500/20 text-fuchsia-300">
      <p className="text-white text-sm">time on this page: <span className="font-mono font-bold text-fuchsia-300">{mins}m {secs % 60}s</span></p>
      {shame && <p className="text-fuchsia-200/80 text-xs mt-1 italic">"{shame[1]}"</p>}
      {!shame && <p className="text-white/40 text-xs mt-1">so far so good. suspicious, but good.</p>}
    </Shell>
  );
}

/* W108 */
export function BatteryAnxiety() {
  const [info, setInfo] = useState<{ level: number; charging: boolean } | null>(null);
  const [tried, setTried] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> };
        if (!nav.getBattery) { if (alive) setTried(true); return; }
        const b = await nav.getBattery();
        if (alive) { setInfo({ level: Math.round(b.level * 100), charging: b.charging }); setTried(true); }
      } catch { if (alive) setTried(true); }
    })();
    return () => { alive = false; };
  }, []);
  return (
    <Shell icon={BatteryMedium} title="Battery Anxiety" sub="real device data. scary." iconClass="bg-lime-500/20 text-lime-300">
      {info ? (
        <>
          <p className="text-white text-sm">battery: <span className="font-mono font-bold text-lime-300">{info.level}%</span>{info.charging ? " ⚡ charging" : ""}</p>
          <div className="h-2.5 rounded-full bg-white/10 mt-2 overflow-hidden">
            <div className={cn("h-full transition-all", info.level < 20 ? "bg-red-400" : "bg-lime-400/80")} style={{ width: `${info.level}%` }} />
          </div>
          {info.level < 20 && <p className="text-red-300/90 text-xs mt-1">below 20%. your phone is more anxious than your portfolio.</p>}
        </>
      ) : tried ? (
        <p className="text-white/60 text-sm italic">battery level: emotionally drained. (browser said no)</p>
      ) : (
        <p className="text-white/40 text-sm">reading battery…</p>
      )}
    </Shell>
  );
}

/* W109 */
const DREAD = [
  "if a candle closes and no one charts it, did it really pump?",
  "are we early, or is time just a social construct invented by exit liquidity?",
  "if you buy the dip and the dip keeps dipping, who dipped whom?",
  "does the blockchain remember your sells, or has it forgiven you?",
  "is diamond-hands a strategy or a cry for help?",
  "if hopium expired, would the bull run still come?",
];
export function ExistentialDread() {
  const [i, setI] = useState(0);
  return (
    <Shell icon={Brain} title="Existential Dread" sub="3am philosophical questions" iconClass="bg-violet-500/20 text-violet-300">
      <p className="text-white/85 text-sm min-h-[3.5rem] italic">"{DREAD[i]}"</p>
      <button onClick={() => setI((x) => (x + 1) % DREAD.length)}
        className="mt-2 px-4 py-2 rounded-xl bg-violet-500/20 text-violet-200 text-sm font-bold hover:bg-violet-500/30 transition">
        deeper
      </button>
    </Shell>
  );
}

/* W110 */
export function HeatDeathOfUniverse() {
  return (
    <Shell icon={Radiation} title="Heat Death of the Universe" sub="the ultimate long-term hold" iconClass="bg-red-500/20 text-red-300">
      <div className="rounded-xl bg-black/40 p-3 text-center">
        <div className="text-white font-mono font-bold text-lg">10<sup>100</sup> years</div>
        <p className="text-white/40 text-xs mt-1">until maximum entropy. no more candles. no more dips. just… vibes.</p>
      </div>
      <p className="text-red-200/80 text-xs mt-2">plenty of time to accumulate. probably.</p>
    </Shell>
  );
}
