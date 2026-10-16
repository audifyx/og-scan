import { useEffect, useMemo, useState } from "react";
import { Sunrise, Timer, CloudSun, Languages, AudioLines, Newspaper, Gauge, Skull, Radar, TrendingDown, ShieldCheck, FileLock2, Sparkles, Pickaxe, Plane, ShieldAlert, Hammer, LineChart, Telescope, CloudLightning, Waves, Activity, Compass, Vote, BrainCircuit } from "lucide-react";
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
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
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

const fmtMoney = (n: number | null) =>
  n == null ? "—" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}k` : `$${n.toFixed(0)}`;
const fmtPrice = (n: number | null) => (n == null ? "—" : `$${n.toFixed(n < 0.01 ? 8 : 6)}`);

/* A26 */
export function MorningBriefing({ stats }: { stats?: AvatarStats }) {
  const today = new Date().toISOString().slice(0, 10);
  const [day, setDay] = useState(() => read("a26-day", ""));
  useEffect(() => {
    if (day !== today) { setDay(today); write("a26-day", today); }
  }, [today, day]);
  const ch = stats?.change24h ?? null;
  const outlook = ch == null ? "The agents are still rubbing sleep from their sensors." :
    ch > 10 ? "ORACLE muttered something about lift-off. PILOT already buckled in." :
    ch > 0 ? "Quietly green. SCOUT calls it 'suspiciously healthy'." :
    ch > -10 ? "A gentle dip. TRADER is licking his lips. GUARD is awake." :
    "Red day. The agents ordered extra coffee and blame nobody.";
  return (
    <Shell icon={Sunrise} title="Morning Briefing" sub="Today's agent situation report">
      <div className="space-y-1.5 text-[13px] text-white/70">
        <p>Price <b className="text-white">{fmtPrice(stats?.price ?? null)}</b> · 24h <b className={cn("font-bold", ch != null && ch >= 0 ? "text-emerald-300" : "text-rose-300")}>{ch == null ? "—" : `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%`}</b></p>
        <p>Burned so far <b className="text-white">{stats?.burned != null ? `${stats.burned.toFixed(1)}M ORBITX` : "—"}</b> — MINER is proud.</p>
        <p className="border-t border-white/10 pt-2 text-white/80">🛰️ <i>{outlook}</i></p>
      </div>
    </Shell>
  );
}

/* A27 */
export function StageETA({ stats }: { stats?: AvatarStats }) {
  const stages = [10000, 25000, 100000, 500000, 2000000];
  const labels = ["Egg", "Hatchling", "Rookie", "Veteran", "Cosmic"];
  const mcap = stats?.mcap ?? null;
  const ch = stats?.change24h ?? null;
  const next = mcap == null ? null : stages.find((s) => s > mcap);
  let eta: string;
  if (mcap == null) eta = "No market cap data — the agents refuse to guess blind.";
  else if (!next) eta = "COSMIC reached. PILOT has run out of sky and is asking for a bigger one.";
  else if (ch == null || ch <= 0) eta = `Next stage: ${labels[stages.indexOf(next)]} at ${fmtMoney(next)}. Needs a green streak first — rough estimate pending momentum.`;
  else {
    const days = Math.log(next / mcap) / Math.log(1 + ch / 100);
    eta = `Next stage: ${labels[stages.indexOf(next)]} at ${fmtMoney(next)} — at today's pace, roughly ${days < 1 ? "under a day" : `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`} away. Rough estimate, not a promise.`;
  }
  return (
    <Shell icon={Timer} title="Stage ETA" sub="Time to next evolution">
      <p className="text-[13px] text-white/70">{eta}</p>
      <div className="mt-2 flex gap-1">{stages.map((s, i) => (
        <div key={s} className={cn("h-1.5 flex-1 rounded-full", mcap != null && mcap >= s ? "bg-cyan-400" : "bg-white/10")} title={labels[i]} />
      ))}</div>
    </Shell>
  );
}

/* A28 */
export function MoodForecast({ stats }: { stats?: AvatarStats }) {
  const moods = useMemo(() => {
    const ch = stats?.change24h ?? 0;
    const hour = new Date().getHours();
    const out: { h: number; mood: string; emoji: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const hh = (hour + i) % 24;
      const sleepy = hh >= 2 && hh <= 6;
      const base = ch > 5 ? ["Hyped", "🚀"] : ch > 0 ? ["Pleased", "🙂"] : ch > -5 ? ["Neutral", "😐"] : ["Salty", "🌧️"];
      out.push({ h: hh, mood: sleepy ? "Sleepy" : base[0], emoji: sleepy ? "😴" : base[1] });
    }
    return out;
  }, [stats?.change24h]);
  return (
    <Shell icon={CloudSun} title="Mood Forecast" sub="Agent mood, next 8 hours">
      <div className="grid grid-cols-8 gap-1">
        {moods.map((m, i) => (
          <div key={i} className="rounded-xl bg-white/[0.04] p-1 text-center">
            <p className="text-[10px] text-white/45">{String(m.h).padStart(2, "0")}:00</p>
            <p className="text-lg">{m.emoji}</p>
            <p className="text-[9px] font-bold text-white/70">{m.mood}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* A29 */
const WHALES = [
  { act: "🐋 Whale bought", plain: "Someone with a big bag just added more.", agent: "SCOUT: 'New friend or exit liquidity in disguise?'" },
  { act: "🐋 Whale sold", plain: "Someone with a big bag just trimmed some.", agent: "TRADER: 'Their loss. Probably. Let's say it's their loss.'" },
  { act: "🐋 Whale split wallets", plain: "One big holder scattered coins across new wallets.", agent: "GUARD: 'Suspicious. Watching. Closely. From the bushes.'" },
  { act: "🐋 Whale burned", plain: "Someone torched tokens on purpose.", agent: "MINER: 'A sacrifice to the supply gods. We honor it.'" },
];
export function WhaleTranslator() {
  const [sel, setSel] = useState(0);
  const w = WHALES[sel];
  return (
    <Shell icon={Languages} title="Whale Translator" sub="What the whale meant, in plain English">
      <div className="flex flex-wrap gap-1.5">
        {WHALES.map((x, i) => (
          <button key={x.act} onClick={() => setSel(i)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", i === sel ? "bg-cyan-400/25 text-cyan-200" : "bg-white/[0.05] text-white/60")}>{x.act}</button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-white/80">🗣️ {w.plain}</p>
      <p className="text-[12px] text-white/45 italic">{w.agent}</p>
    </Shell>
  );
}

/* A30 */
export function ChartNarrator({ stats }: { stats?: AvatarStats }) {
  const ch = stats?.change24h ?? null;
  const tale = ch == null ? "The chart is off-grid today, so the narrator is improvising. Boldly." :
    ch > 15 ? "A violent green pillar erupted out of nowhere, like PILOT hit the turbo button by accident." :
    ch > 5 ? "A confident climb — steady green steps, the kind TRADER frames on his wall." :
    ch > 0 ? "Crab mode with ambitions: sideways, but sideways with a little grin." :
    ch > -5 ? "A slow bleed, nothing dramatic — like the chart is melting in the sun." :
    ch > -15 ? "A proper red washout. The candles formed a staircase and nobody liked the direction." :
    "A bloodbath candle that GUARD describes only as 'Tuesday'.";
  return (
    <Shell icon={AudioLines} title="Chart Narrator" sub="The tape, in words">
      <p className="text-[13px] text-white/80 italic">"{tale}"</p>
      <p className="mt-2 text-[12px] text-white/45">Price {fmtPrice(stats?.price ?? null)} · 24h {ch == null ? "—" : `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%`}</p>
    </Shell>
  );
}

/* A31 */
const HEADLINES = [
  "BREAKING: Orbit stays round, sources confirm",
  "Local agent finds $ORBITX under couch cushions, calls it 'alpha'",
  "MINER digs up another burn, dusts off shovel ceremonially",
  "ORACLE predicts prediction will be predicted soon",
  "PILOT denies flying the chart, admits 'light steering'",
  "GUARD blocks suspicious wallet; wallet was just a wallet",
  "BUILDER ships feature at 3am; nobody awake to review it",
  "SCOUT reports trend before trend exists, is smug",
];
export function NewsReader() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((p) => (p + 1) % HEADLINES.length), 4000); return () => clearInterval(t); }, []);
  return (
    <Shell icon={Newspaper} title="Agent Newswire" sub="The latest from Orbit City">
      <div className="flex items-center gap-2">
        <span className="animate-pulse rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-black text-red-300">LIVE-ish</span>
        <p className="text-[13px] text-white/85">📰 {HEADLINES[i]}</p>
      </div>
      <p className="mt-1 text-[10px] text-white/35">(Headlines are playful fiction. The ticker is real, the news is not.)</p>
    </Shell>
  );
}

/* A32 */
export function SentimentMeter({ stats }: { stats?: AvatarStats }) {
  const ch = stats?.change24h ?? 0;
  const score = Math.max(0, Math.min(100, Math.round(((ch + 20) / 40) * 100)));
  const label = score < 20 ? "Extreme Fear" : score < 40 ? "Fear" : score < 60 ? "Neutral" : score < 80 ? "Greed" : "Extreme Greed";
  return (
    <Shell icon={Gauge} title="Sentiment Meter" sub="Crowd temperature">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-40 overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-20 w-40 rounded-t-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 opacity-30" />
          <div className="absolute bottom-0 left-1/2 h-16 w-1 origin-bottom rounded bg-white transition-transform duration-1000" style={{ transform: `translateX(-50%) rotate(${(score / 100) * 180 - 90}deg)` }} />
          <div className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-white" />
        </div>
        <div><p className="text-3xl font-black">{score}</p><p className="text-[12px] font-bold text-white/60">{label}</p></div>
      </div>
      <p className="mt-1 text-[10px] text-white/35">For fun, not financial advice.</p>
    </Shell>
  );
}

/* A33 */
const CHAOS_QUOTES = [
  "Your 'community' is a group chat and a dream.",
  "Green candles are just red candles that lie.",
  "I eat hopium for breakfast. With FUD on top.",
  "The agents' plan has exactly one step: cope.",
];
export function RivalChaos({ stats }: { stats?: AvatarStats }) {
  const [i, setI] = useState(0);
  const chaos = stats?.change24h == null ? 50 : Math.max(0, Math.min(100, Math.round(Math.abs(stats.change24h) * 4)));
  useEffect(() => { const t = setInterval(() => setI((p) => (p + 1) % CHAOS_QUOTES.length), 5000); return () => clearInterval(t); }, []);
  return (
    <Shell icon={Skull} title="CHAOS — Rival Agent" sub="The agents' nemesis weighs in">
      <p className="text-[13px] text-white/75 italic">"The market is {stats?.change24h != null && stats.change24h >= 0 ? "green — which only means the crash will be fresher" : "red — which, unlike your bags, at least has momentum"}."</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-[11px] font-bold text-white/50">CHAOS LEVEL</p>
        <div className="h-2 flex-1 rounded-full bg-white/10"><div className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-red-500" style={{ width: `${chaos}%` }} /></div>
        <p className="text-[11px] font-black text-purple-300">{chaos}%</p>
      </div>
      <p className="mt-2 text-[12px] text-red-300/80">💀 "{CHAOS_QUOTES[i]}"</p>
    </Shell>
  );
}

/* A34 */
const PATTERNS = [
  { p: "Higher lows", d: "Buyers keep stepping in earlier. TRADER: 'The floor is getting a renovation.'" },
  { p: "Wick rejection", d: "Price poked down and got slapped back up. GUARD: 'We rejected it. You're welcome.'" },
  { p: "Golden cross", d: "Fast line overtakes slow line. ORACLE: 'The lines have crossed. Destiny is confused but optimistic.'" },
  { p: "Bull flag", d: "Sharp pop, then tight sideways. PILOT: 'Refueling mid-air. Standard procedure.'" },
  { p: "Double bottom", d: "Two bounces off the same floor. MINER: 'Dug twice, hit bedrock twice. It's load-bearing now.'" },
];
export function BuySignalDecoder() {
  const [sel, setSel] = useState(0);
  return (
    <Shell icon={Radar} title="Buy Signal Decoder" sub="What the patterns mean">
      <div className="flex flex-wrap gap-1.5">
        {PATTERNS.map((x, i) => (
          <button key={x.p} onClick={() => setSel(i)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", i === sel ? "bg-cyan-400/25 text-cyan-200" : "bg-white/[0.05] text-white/60")}>{x.p}</button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-white/80">{PATTERNS[sel].d}</p>
      <p className="mt-1 text-[10px] text-white/35">For fun, not financial advice.</p>
    </Shell>
  );
}

/* A35 */
export function DipAdvisor() {
  const [a, setA] = useState<number[]>([0, 0, 0]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const qs = ["Was it a red day?", "Did weak hands actually sell?", "Does the vibe still feel right?"];
  const opts = [["Yes", "No"], ["Yes", "No"], ["Yes", "No"]];
  return (
    <Shell icon={TrendingDown} title="Dip Advisor" sub="Is this a dip? The 3-question quiz">
      {qs.map((q, qi) => (
        <div key={q} className="mb-2">
          <p className="text-[12px] font-bold text-white/70">{qi + 1}. {q}</p>
          <div className="mt-1 flex gap-1.5">
            {opts[qi].map((o, oi) => (
              <button key={o} onClick={() => setA((p) => p.map((v, i) => (i === qi ? oi : v)))} className={cn("rounded-full px-3 py-1 text-[11px] font-bold", a[qi] === oi ? "bg-cyan-400/25 text-cyan-200" : "bg-white/[0.05] text-white/60")}>{o}</button>
            ))}
          </div>
        </div>
      ))}
      <button onClick={() => setVerdict(a[0] === 0 && a[2] === 0 ? "Verdict: certified dip. TRADER is already in." : a[0] === 1 ? "Verdict: not a dip — it's just Tuesday." : "Verdict: murky. GUARD advises sitting on your hands.")} className="mt-1 rounded-xl bg-cyan-400/20 px-3 py-1.5 text-[12px] font-black text-cyan-200">Get verdict</button>
      {verdict && <p className="mt-2 text-[13px] font-bold text-white/85">{verdict}</p>}
      <p className="mt-1 text-[10px] text-white/35">Not financial advice. Obviously.</p>
    </Shell>
  );
}

/* A36 */
const FUDS = [
  { f: "\"ORBITX is a ghost chain project\"", r: "GUARD: The chain has never ghosted anyone. The chain is right here. Say it to its face." },
  { f: "\"The devs dumped everything\"", r: "MINER: Checked the chain. The devs bought snacks. That's the whole scandal." },
  { f: "\"Nobody uses it\"", r: "SCOUT: 660 followers beg to differ. That's a village. Villages have economies." },
  { f: "\"It'll never recover\"", r: "ORACLE: I've seen three candles ahead. One of them is green and frankly enormous." },
];
export function FudShield() {
  const [wobble, setWobble] = useState(0);
  return (
    <Shell icon={ShieldCheck} title="FUD Shield" sub="GUARD's rebuttal armory">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[11px] font-bold text-white/50">SHIELD INTEGRITY</p>
        <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
          <div className={cn("h-2 rounded-full bg-emerald-400 transition-all", wobble > 0 && "animate-pulse")} style={{ width: "100%" }} />
        </div>
        <p className="text-[11px] font-black text-emerald-300">100%</p>
      </div>
      <div className="space-y-2">
        {FUDS.map((x, i) => (
          <button key={i} onClick={() => { setWobble((w) => w + 1); setTimeout(() => setWobble((w) => Math.max(0, w - 1)), 600); }} className="w-full rounded-xl bg-white/[0.04] p-2 text-left">
            <p className="text-[12px] font-bold text-rose-300">{x.f}</p>
            <p className="text-[12px] text-white/60">{x.r}</p>
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-white/35">(Tap a FUD card to bounce it off the shield. Wobble: {wobble})</p>
    </Shell>
  );
}

/* A37 */
const LEAKS = [
  "SCOUT overheard two whales arguing about who loves ORBITX more. Both lost.",
  "A new wallet has been quietly collecting for days. SCOUT named it 'The Patient One'.",
  "Burn #3 was not planned. It was destiny. MINER refuses to elaborate.",
  "ORACLE predicted the next green candle. Time withheld for dramatic purposes.",
  "BUILDER is cooking something. Smells like commits.",
];
export function AlphaLeaks() {
  const [open, setOpen] = useState<number[]>(() => read("a37-open", [] as number[]));
  const toggle = (i: number) => {
    const next = open.includes(i) ? open : [...open, i];
    setOpen(next); write("a37-open", next);
  };
  return (
    <Shell icon={FileLock2} title="Alpha Leaks" sub="SCOUT's sealed recon notes">
      <div className="space-y-1.5">
        {LEAKS.map((l, i) => (
          <button key={i} onClick={() => toggle(i)} className="w-full rounded-xl bg-white/[0.04] p-2 text-left text-[12px]">
            {open.includes(i) ? <span className="text-white/75">🔓 {l}</span> : <span className="font-bold text-amber-300/80">🔒 Sealed leak #{i + 1} — tap to unseal</span>}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-white/35">(Pure fiction from SCOUT's imagination. Treat accordingly.)</p>
    </Shell>
  );
}

/* A38 */
const PREDS = [
  { t: "ORBITX closes a day above its current 24h high", conf: 72 },
  { t: "A burn transaction surprises everyone on a Sunday", conf: 64 },
  { t: "CHAOS admits, once, that the agents were right", conf: 11 },
];
export function OraclePredictions() {
  return (
    <Shell icon={Sparkles} title="ORACLE Predictions" sub="Three candles ahead">
      <div className="space-y-2">
        {PREDS.map((p, i) => (
          <div key={i} className="rounded-xl bg-white/[0.04] p-2">
            <p className="text-[13px] text-white/80">🔮 {p.t}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 rounded-full bg-white/10"><div className="h-1.5 rounded-full bg-red-400/70" style={{ width: `${p.conf}%` }} /></div>
              <p className="text-[11px] font-black text-red-300">{p.conf}%</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/40 italic">Track record: right twice, wrong once, cryptic the other four times.</p>
    </Shell>
  );
}

/* A39 */
export function MinerReport({ stats }: { stats?: AvatarStats }) {
  const burned = stats?.burned ?? null;
  const pct = burned == null ? null : (burned / 1000) * 100;
  const blocks = burned == null ? 0 : Math.floor(burned * 7);
  return (
    <Shell icon={Pickaxe} title="MINER's Burn Report" sub="Fresh from the chain">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/[0.04] p-2"><p className="text-lg font-black text-white">{burned == null ? "—" : `${burned.toFixed(1)}M`}</p><p className="text-[10px] text-white/45">ORBITX burned</p></div>
        <div className="rounded-xl bg-white/[0.04] p-2"><p className="text-lg font-black text-white">{pct == null ? "—" : `${pct.toFixed(1)}%`}</p><p className="text-[10px] text-white/45">of 1B supply</p></div>
        <div className="rounded-xl bg-white/[0.04] p-2"><p className="text-lg font-black text-white">{blocks}</p><p className="text-[10px] text-white/45">blocks mined*</p></div>
      </div>
      <p className="mt-2 text-[11px] text-white/40 italic">⛏️ MINER: "Every burn is a tiny funeral for a token. I attend them all." *blocks mined is a fun metaphor, not a real count.</p>
    </Shell>
  );
}

/* A40 */
export function PilotLog({ stats }: { stats?: AvatarStats }) {
  const stages = [10000, 25000, 100000, 500000, 2000000];
  const mcap = stats?.mcap ?? null;
  const crossed = mcap == null ? [] : stages.filter((s) => mcap >= s);
  const names = ["$10k", "$25k", "$100k", "$500k", "$2M"];
  return (
    <Shell icon={Plane} title="PILOT's Flight Log" sub="Altitude = market cap milestones">
      {mcap == null ? <p className="text-[13px] text-white/60">Altimeter offline — PILOT is flying by vibes alone.</p> :
        crossed.length === 0 ? <p className="text-[13px] text-white/60">🛫 Takeoff roll in progress. First waypoint: $10k mcap.</p> :
        <div className="space-y-1.5">
          {crossed.map((s, i) => (
            <p key={s} className="text-[12px] text-white/75">✈️ <b className="text-cyan-200">{names[stages.indexOf(s)]}</b> cleared — PILOT: "{["Smooth climb", "Bit bumpy, kept the tray tables up", "Beautiful cruising altitude"][Math.min(i, 2)]}. Next waypoint locked."</p>
          ))}
        </div>}
      <p className="mt-2 text-[11px] text-white/40 italic">Current altitude: {fmtMoney(mcap)}</p>
    </Shell>
  );
}

/* A41 */
const PATROL = [
  "02:14 — Sweeped the holder list. Everyone behaving. Suspiciously.",
  "06:40 — Blocked a wallet with a name like a password. It was a password.",
  "11:05 — Interrogated a suspicious candle. It was just volatility.",
  "15:22 — Confiscated one (1) FUD headline. Shredded ceremoniously.",
  "21:48 — Final perimeter check. Supply intact. Naps now authorized.",
];
export function GuardDuty() {
  const [blocked, setBlocked] = useState(() => read("a41-blocked", 3));
  const tap = () => { const n = blocked + 1; setBlocked(n); write("a41-blocked", n); };
  return (
    <Shell icon={ShieldAlert} title="GUARD Patrol Log" sub="Today's watch (fictional)">
      <div className="space-y-1">
        {PATROL.map((p) => <p key={p} className="rounded-lg bg-white/[0.03] px-2 py-1 text-[11px] text-white/60">{p}</p>)}
      </div>
      <button onClick={tap} className="mt-2 w-full rounded-xl bg-emerald-400/15 py-2 text-[12px] font-black text-emerald-200">🛡️ Threats blocked today: {blocked} (tap to block another)</button>
    </Shell>
  );
}

/* A42 */
const SHIPLOG = [
  { v: "v2.14.0", d: "2026-10-15", t: "Rebuilt the DEX header. It has a stats strip now. You're welcome." },
  { v: "v2.13.2", d: "2026-10-14", t: "Chart card pool resolution cached. GeckoTerminal thanked us personally." },
  { v: "v2.13.0", d: "2026-10-12", t: "Shill button added. One tap. Maximum orbit." },
  { v: "v2.12.5", d: "2026-10-09", t: "Fixed the black page of death with an error boundary and a stern look." },
  { v: "v2.12.0", d: "2026-10-07", t: "Position posts gained live P&L cards. Flex responsibly." },
  { v: "v2.11.0", d: "2026-10-05", t: "Money tab: live on-chain buy pressure feed. Numbers go brr." },
];
export function BuilderChangelog() {
  return (
    <Shell icon={Hammer} title="BUILDER's Changelog" sub="Shipped at 3am, as is tradition">
      <div className="space-y-1.5">
        {SHIPLOG.map((s) => (
          <div key={s.v} className="rounded-xl bg-white/[0.03] p-2">
            <p className="text-[11px] font-black text-purple-300">{s.v} <span className="font-normal text-white/40">· {s.d}</span></p>
            <p className="text-[12px] text-white/70">{s.t}</p>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-white/35">(Fictional-but-plausible ship log from BUILDER's caffeine era.)</p>
    </Shell>
  );
}

/* A43 */
const SETUPS = [
  { s: "The Green Staircase", wr: 68, d: "Three higher lows in a row. TRADER goes in with pocket money." },
  { s: "Sunday Burn Surprise", wr: 81, d: "Burn tx on a quiet day. MINER's favorite holiday." },
  { s: "Crab With Ambitions", wr: 54, d: "Sideways with a grin. Small size, big dreams." },
  { s: "The Revenge Candle", wr: 47, d: "Yesterday's dip recovered overnight. Emotional damage repaired." },
  { s: "Whale Shadow Trade", wr: 59, d: "Follow the Patient One. Quietly. From a distance." },
];
export function TraderPlaybook() {
  const day = Math.floor(Date.now() / 86400000);
  const pick = SETUPS[day % SETUPS.length];
  return (
    <Shell icon={LineChart} title="TRADER's Playbook" sub="Five setups, one daily pick">
      <div className="space-y-1.5">
        {SETUPS.map((s) => (
          <div key={s.s} className={cn("rounded-xl p-2", s.s === pick.s ? "bg-pink-400/10 border border-pink-400/30" : "bg-white/[0.03]")}>
            <p className="text-[12px] font-bold text-white/80">{s.s} <span className="text-pink-300">{s.wr}% WR*</span></p>
            <p className="text-[11px] text-white/50">{s.d}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] font-bold text-white/85">📋 Today's play: {pick.s}</p>
      <p className="mt-1 text-[10px] text-white/35">*Win-rates are vibes-based. For fun, not financial advice.</p>
    </Shell>
  );
}

/* A44 */
const FINDINGS = [
  { t: "The Telegram group talks about ORBITX more than their own families", conf: "High" },
  { t: "Nobody sells on Sundays — suspicious, wholesome", conf: "Medium" },
  { t: "A chart pattern resembling a tiny rocket was spotted", conf: "Low" },
  { t: "The burn wallet has never once asked for attention", conf: "High" },
  { t: "CHAOS has been quiet, which means CHAOS is planning something", conf: "Medium" },
];
export function ScoutFindings() {
  return (
    <Shell icon={Telescope} title="SCOUT's Recon Notes" sub="Qualitative findings only">
      <div className="space-y-1.5">
        {FINDINGS.map((f, i) => (
          <div key={i} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.03] p-2">
            <p className="text-[12px] text-white/75">🔭 {f.t}</p>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black", f.conf === "High" ? "bg-amber-400/20 text-amber-200" : f.conf === "Medium" ? "bg-white/10 text-white/60" : "bg-white/5 text-white/40")}>{f.conf}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* A45 */
export function MarketWeather({ stats }: { stats?: AvatarStats }) {
  const ch = stats?.change24h ?? null;
  const icon = ch == null ? "🌫️" : ch > 10 ? "☀️" : ch > 0 ? "🌤️" : ch > -10 ? "🌧️" : "⛈️";
  const report = ch == null ? "Foggy with no visibility — the weather satellite is down." :
    ch > 10 ? "Sunny with a chance of green candles. Sunglasses advised." :
    ch > 0 ? "Partly bullish, mild tailwinds from the east chart." :
    ch > -10 ? "Light red drizzle. Umbrellas optional, diamond hands required." :
    "Severe FUD storm warning. All agents to the bunker (the group chat).";
  return (
    <Shell icon={CloudLightning} title="Market Weather" sub="Orbit City forecast">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{icon}</span>
        <div>
          <p className="text-[13px] font-bold text-white/85">{report}</p>
          <p className="text-[11px] text-white/45">Humidity: {ch == null ? "—" : `${Math.round(Math.abs(ch) * 3)}%`} hopium · Wind: chartward</p>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-white/35">For fun, not financial advice.</p>
    </Shell>
  );
}

/* A46 */
export function LiquidityTide({ stats }: { stats?: AvatarStats }) {
  const liq = stats?.liquidity ?? null;
  const mcap = stats?.mcap ?? null;
  const ratio = liq != null && mcap != null && mcap > 0 ? liq / mcap : null;
  const tide = ratio == null ? "Uncharted Waters" : ratio > 0.15 ? "High Tide" : ratio > 0.05 ? "Mid Tide" : "Low Tide";
  const pct = ratio == null ? 0 : Math.min(100, Math.round(ratio * 400));
  return (
    <Shell icon={Waves} title="Liquidity Tide" sub="How deep is the water?">
      <p className="text-center text-2xl font-black text-cyan-200">🌊 {tide}</p>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-center text-[11px] text-white/45">Liquidity {fmtMoney(liq)} · {pct}% of pool depth scale · Dead Calm below 5%</p>
    </Shell>
  );
}

/* A47 */
export function VolatilitySeismograph({ stats }: { stats?: AvatarStats }) {
  const ch = stats?.change24h ?? 0;
  const amp = Math.min(28, 4 + Math.abs(ch) * 1.6);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 120); return () => clearInterval(t); }, []);
  const pts = useMemo(() => {
    const n = 60; const arr: string[] = [];
    for (let i = 0; i < n; i++) {
      const j = Math.sin((i + tick) * 0.6) * amp * Math.random();
      arr.push(`${(i / (n - 1)) * 300},${50 + j}`);
    }
    return arr.join(" ");
  }, [tick, amp]);
  const mag = Math.min(9.9, Math.abs(ch) / 4).toFixed(1);
  return (
    <Shell icon={Activity} title="Volatility Seismograph" sub="The ground is moving">
      <svg viewBox="0 0 300 100" className="w-full rounded-xl bg-white/[0.03]">
        <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="2" />
        <line x1="0" y1="50" x2="300" y2="50" stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
      </svg>
      <p className="mt-1 text-[12px] text-white/60">Magnitude <b className="text-cyan-200">{mag}</b> — {Number(mag) > 5 ? "hold onto your hats" : Number(mag) > 2 ? "mild tremors" : "dead calm, eerily"}</p>
    </Shell>
  );
}

/* A48 */
export function FearGreedDial({ stats }: { stats?: AvatarStats }) {
  const ch = stats?.change24h ?? 0;
  const score = Math.max(0, Math.min(100, Math.round(((ch + 20) / 40) * 100)));
  const label = score < 25 ? "Extreme Fear" : score < 45 ? "Fear" : score < 55 ? "Neutral" : score < 75 ? "Greed" : "Extreme Greed";
  const r = 70; const circ = Math.PI * r;
  const off = circ - (score / 100) * circ;
  return (
    <Shell icon={Compass} title="Fear & Greed Dial" sub="Crowd psychology, quantified-ish">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 160 90" className="w-36">
          <defs><linearGradient id="fg48" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f43f5e" /><stop offset="50%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#34d399" />
          </linearGradient></defs>
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" strokeLinecap="round" />
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="url(#fg48)" strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off} className="transition-all duration-1000" />
          <text x="80" y="70" textAnchor="middle" fill="white" fontSize="22" fontWeight="900">{score}</text>
        </svg>
        <p className="text-[13px] font-black text-white/80">{label}</p>
      </div>
      <p className="mt-1 text-[10px] text-white/35">For fun, not financial advice.</p>
    </Shell>
  );
}

/* A49 */
const NARRATIVES = [
  { n: "AI Agents", s: 92 },
  { n: "Memes", s: 78 },
  { n: "DeFi", s: 54 },
  { n: "Burn Mechanics", s: 88 },
  { n: "Social Trading", s: 71 },
  { n: "Solana Summer", s: 63 },
];
export function NarrativeRadar() {
  const top = NARRATIVES.reduce((a, b) => (b.s > a.s ? b : a));
  return (
    <Shell icon={Radar} title="Narrative Radar" sub="What's hot in Orbit City">
      <div className="space-y-1.5">
        {NARRATIVES.map((x) => (
          <div key={x.n} className="flex items-center gap-2">
            <p className="w-28 text-[12px] font-bold text-white/70">{x.n}</p>
            <div className="h-2 flex-1 rounded-full bg-white/10"><div className="h-2 rounded-full bg-cyan-400/70" style={{ width: `${x.s}%` }} /></div>
            <p className="w-8 text-right text-[11px] font-black text-cyan-200">{x.s}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-white/60">📡 Top narrative: <b className="text-white">{top.n}</b> — SCOUT is already there.</p>
    </Shell>
  );
}

/* A50 */
const REASONS: Record<string, string> = {
  BUILDER: "Ships regardless of weather.",
  SCOUT: "Found alpha before the chart did.",
  TRADER: "The 1-minute chart winked at me.",
  GUARD: "Supply is intact. Everything else is noise.",
  MINER: "Burns don't lie. Candle colors do.",
  ORACLE: "Saw it in candle #3. Or #4. One of them.",
  PILOT: "Throttle is forward. Always forward.",
};
export function AgentConsensus({ stats }: { stats?: AvatarStats }) {
  const ch = stats?.change24h ?? null;
  const vote = ch == null ? "NEUTRAL" : ch > 3 ? "BULLISH" : ch < -3 ? "BEARISH" : "NEUTRAL";
  const flips = ch != null && ch < -3 ? ["GUARD", "ORACLE"] : [];
  return (
    <Shell icon={Vote} title="Agent Consensus" sub="The council has voted">
      <div className="space-y-1">
        {AGENTS.map((a) => {
          const v = flips.includes(a.role) ? (a.role === "GUARD" ? "BEARISH" : "NEUTRAL") : vote;
          return (
            <div key={a.role} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
              <p className="text-[12px] font-black" style={{ color: a.color }}>{a.role}</p>
              <p className={cn("text-[11px] font-black", v === "BULLISH" ? "text-emerald-300" : v === "BEARISH" ? "text-rose-300" : "text-amber-200")}>{v}</p>
              <p className="text-[11px] text-white/45 italic">— {REASONS[a.role]}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <BrainCircuit className="h-4 w-4 text-cyan-300" />
        <p className="text-[12px] font-bold text-white/80">Consensus: <span className="text-cyan-200">{flips.length ? "MIXED (CHAOS-adjacent)" : vote}</span></p>
      </div>
      <p className="mt-1 text-[10px] text-white/35">For fun, not financial advice.</p>
    </Shell>
  );
}
