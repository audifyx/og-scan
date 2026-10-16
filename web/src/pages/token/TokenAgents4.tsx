import { useEffect, useMemo, useRef, useState } from "react";
import { Scroll, Newspaper as NewsIcon, Music4, Star, Trophy, History, Megaphone, Landmark, Flag, Quote, Medal, Lock, Network, Archive, LibraryBig, Podcast, CalendarClock, FlaskConical, Hourglass as HourglassIcon, Sparkle, GraduationCap as GradIcon, RotateCcw } from "lucide-react";
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
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-400/15 text-rose-300">
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

// ---------- shared utils ----------
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rnd: () => number, arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

/* ------------------------------------------------------------------ */
/* A76 AgentLore — backstory cards per agent */
/* ------------------------------------------------------------------ */
const LORE: Record<string, string> = {
  BUILDER: "Forged in a blackout at 3am, BUILDER compiled the first office out of a README and pure spite. Legend says the coffee machine still fears him.",
  SCOUT: "SCOUT once found alpha in a mempool before the block even finished dreaming about it. He read the whitepaper, the graypaper, and the napkin it was written on.",
  TRADER: "TRADER was raised by a 1-minute chart and has never seen a full night's sleep. She once scalped a wick so thin it needed a magnifying glass.",
  GUARD: "GUARD has read every line of the token contract eleven times, backwards, in Latin. The supply has never been safer, and the interns have never been more scared.",
  MINER: "MINER digs burns out of the chain with his bare hands and smells like dust and victory. He keeps a fossilized rugpull on his desk as a warning.",
  ORACLE: "ORACLE sees three candles ahead but never shares the fourth. Her prophecies rhyme and her timezone is 'soon'.",
  PILOT: "PILOT flies the market cap like a borrowed sports car. Turbulence is a lifestyle. The seatbelt sign has never once been on.",
};
{/* A76 */}
export function AgentLore() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Shell icon={Scroll} title="Agent Lore" sub="The sacred myths of the office">
      <div className="space-y-2">
        {AGENTS.map((a) => (
          <button key={a.role} onClick={() => setOpen(open === a.role ? null : a.role)}
            className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-left transition hover:border-white/25">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
              <span className="text-sm font-bold" style={{ color: a.color }}>{a.role}</span>
              <span className="ml-auto text-xs text-white/40">{open === a.role ? "−" : "+"}</span>
            </div>
            {open === a.role && <p className="mt-2 text-[12px] leading-relaxed text-white/70">{LORE[a.role]}</p>}
          </button>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A77 AgentComics — 3-panel comic generator */
/* ------------------------------------------------------------------ */
const SETUPS = [" walks into the war room with a chart printed upside down.", " finds the office Wi-Fi is down and it is a market open.", " discovers someone moved the price alerts channel.", " tries to explain what a candle is to the intern."];
const TWISTS = [" The chart was actually a map of the office pizza orders.", " The Wi-Fi outage turns out to be a coordinated FUD drill.", " The moved alerts were sent by their evil twin (see Multiverse).", " The intern turns out to be a whale with a hardware wallet."];
const PUNCHES = [" Everyone buys the dip. The dip was the friends we made along the way.", " GUARD locks the supply room anyway. Paranoia pays.", " BUILDER ships a fix in 3 minutes and breaks nothing. A miracle.", " ORACLE saw it coming. She is eating popcorn."];
{/* A77 */}
export function AgentComics() {
  const [comic, setComic] = useState<string[]>([]);
  const [stars, setStars] = useState<string[]>([]);
  const gen = () => {
    const rnd = mulberry(Date.now() % 2147483647);
    const cast = [...AGENTS].sort(() => rnd() - 0.5).slice(0, 3);
    setStars(cast.map((c) => c.role));
    setComic([
      cast[0].role + pick(rnd, SETUPS),
      pick(rnd, TWISTS).replace(/^ /, cast[1].role + " discovers it first."),
      pick(rnd, PUNCHES),
    ]);
  };
  useEffect(() => { gen(); }, []);
  const panels = ["Panel 1: Setup", "Panel 2: Twist", "Panel 3: Punchline"];
  return (
    <Shell icon={NewsIcon} title="Agent Comics" sub="Daily strip from the war room">
      <div className="grid grid-cols-3 gap-2">
        {panels.map((label, i) => (
          <div key={label} className="rounded-xl border border-white/10 bg-black/40 p-2.5">
            <p className="text-[10px] font-bold text-white/40">{label}</p>
            {stars[i] && <p className="mt-1 text-[10px] font-extrabold" style={{ color: AGENTS.find((a) => a.role === stars[i])?.color }}>{stars[i]}</p>}
            <p className="mt-1 text-[11px] leading-snug text-white/75">{comic[i] ?? "…"}</p>
          </div>
        ))}
      </div>
      <button onClick={gen} className="mt-3 w-full rounded-xl bg-rose-500/80 py-2 text-xs font-extrabold hover:bg-rose-500">New comic</button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A78 AgentHaiku({stats}) — market-mood haiku, new hourly */
/* ------------------------------------------------------------------ */
const HAIKU_POOL = {
  bull: { l1: ["Green candles rising", "Number goes up today", "Bags ascend to space"], l2: ["The agents dance on glowing charts", "PILOT floors it, GUARD approves", "SCOUT found it first, obviously"], l3: ["Moon soon, friends", "Hold tight", "Up only"] },
  bear: { l1: ["Red candles falling", "The dip extends its handshake", "Charts paint the floor red"], l2: ["TRADER buys the fear, grinning wide", "MINER digs for burns below", "GUARD double-locks the supply"], l3: ["Buy the fear", "Diamond hands", "Stay frosty"] },
  crab: { l1: ["Sideways seas at dawn", "The chart naps in the middle", "Flat lines, calm office"], l2: ["BUILDER ships while nothing moves", "ORACLE shrugs in all directions", "Interns finally touch grass"], l3: ["Patience wins", "Touch grass", "Wait it out"] },
};
{/* A78 */}
export function AgentHaiku({ stats }: { stats?: AvatarStats }) {
  const hourSeed = Math.floor(Date.now() / 3_600_000);
  const mood = stats?.change24h == null ? "crab" : stats.change24h > 2 ? "bull" : stats.change24h < -2 ? "bear" : "crab";
  const haiku = useMemo(() => {
    const rnd = mulberry(hourSeed);
    const pool = HAIKU_POOL[mood];
    return [pick(rnd, pool.l1), pick(rnd, pool.l2), pick(rnd, pool.l3)];
  }, [hourSeed, mood]);
  return (
    <Shell icon={Quote} title="Agent Haiku" sub={`Mood: ${mood.toUpperCase()} — new verse every hour`}>
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center italic">
        {haiku.map((line, i) => (
          <p key={i} className={cn("text-sm text-white/85", i === 1 && "text-[13px] text-white/70")}>{line}</p>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-white/35">5 · 7 · 5 — composed by committee</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A79 AgentMusic({stats}) — WebAudio chiptune, tempo from |change24h| */
/* ------------------------------------------------------------------ */
{/* A79 */}
export function AgentMusic({ stats }: { stats?: AvatarStats }) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // C5..C6 pentatonic-ish
  const step = useRef(0);
  const stop = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    setPlaying(false);
  };
  useEffect(() => stop, []);
  const toggle = () => {
    if (playing) { stop(); return; }
    const ctx = new AudioContext(); // created on user gesture
    ctxRef.current = ctx;
    const tempo = Math.min(320, 110 + Math.abs(stats?.change24h ?? 0) * 9); // ms per note; faster when volatile
    timerRef.current = setInterval(() => {
      const c = ctxRef.current; if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "square";
      osc.frequency.value = notes[step.current % notes.length] * (step.current % 12 >= 6 ? 0.5 : 1);
      gain.gain.setValueAtTime(0.06, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.22);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(); osc.stop(c.currentTime + 0.24);
      step.current += 1;
    }, tempo);
    setPlaying(true);
  };
  return (
    <Shell icon={Music4} title="Agent Chiptune" sub="Square-wave market symphony">
      <button onClick={toggle} className={cn("w-full rounded-xl py-2.5 text-xs font-extrabold", playing ? "bg-red-500/80 hover:bg-red-500" : "bg-emerald-500/80 hover:bg-emerald-500")}>
        {playing ? "⏹ Stop the beat" : "▶ Play the chiptune"}
      </button>
      <p className="mt-2 text-[11px] text-white/40">Tempo tracks volatility — spicier charts, spicier track.</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A80 AgentHoroscope — 12 bag signs */
/* ------------------------------------------------------------------ */
const SIGNS = ["The Diamond Paw", "The Paper Swan", "The Rising Candle", "The Sleeping Whale", "The Brave Degen", "The Fud Phoenix", "The Golden Wick", "The Iron Ledger", "The Moonshot Comet", "The Steady Ape", "The Laser Eye", "The Eternal Bagholder"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
{/* A80 */}
export function AgentHoroscope() {
  const [month, setMonth] = useState<number>(read("horoscope-month", new Date().getMonth()));
  const sign = SIGNS[month % 12];
  const today = new Date().toISOString().slice(0, 10);
  const horo = useMemo(() => {
    const rnd = mulberry(parseInt(today.replaceAll("-", ""), 10) + month);
    return pick(rnd, [
      "The candles favor the bold. Do not check your portfolio before coffee.",
      "A green wick approaches. Charge your phone; you will screenshot everything.",
      "Mercury is in the mempool. Sign nothing you cannot afford to laugh about.",
      "Your bags are heavy because your conviction is strong. Posture check.",
      "Someone will FUD in the replies. Reply with a haiku and log off.",
      "The office plants predict a sideways day. Water them anyway.",
    ]);
  }, [today, month]);
  return (
    <Shell icon={Star} title="Agent Horoscope" sub="Your daily bag sign">
      <div className="grid grid-cols-6 gap-1.5">
        {MONTHS.map((m, i) => (
          <button key={m} onClick={() => { setMonth(i); write("horoscope-month", i); }}
            className={cn("rounded-lg border py-1.5 text-[11px] font-bold", month === i ? "border-amber-300/60 bg-amber-300/15 text-amber-200" : "border-white/10 text-white/50 hover:border-white/25")}>
            {m}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-center">
        <p className="text-[10px] font-bold tracking-widest text-amber-200/60">YOUR BAG SIGN</p>
        <p className="mt-1 text-lg font-extrabold text-amber-200">✦ {sign} ✦</p>
        <p className="mt-2 text-[12px] leading-relaxed text-white/70">{horo}</p>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A81 AgentProverbs — rotating proverbs every 5s */
/* ------------------------------------------------------------------ */
const PROVERBS = [
  ["A red candle shared is a red candle halved.", "GUARD"],
  ["The chart is flat, but the coffee is strong.", "BUILDER"],
  ["Alpha is everywhere; Wi-Fi is not.", "SCOUT"],
  ["Buy the fear, keep the receipt.", "TRADER"],
  ["Every burn warms the whole office.", "MINER"],
  ["The future rhymes with the past, but louder.", "ORACLE"],
  ["Turbulence is just applause from below.", "PILOT"],
  ["Touch grass before you touch leverage.", "GUARD"],
];
{/* A81 */}
export function AgentProverbs() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % PROVERBS.length), 5000);
    return () => clearInterval(t);
  }, []);
  const [text, role] = PROVERBS[idx];
  const color = AGENTS.find((a) => a.role === role)?.color ?? "#fff";
  return (
    <Shell icon={Scroll} title="Agent Proverbs" sub="Wisdom, on a 5-second timer">
      <div key={idx} className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-sm italic text-white/85">“{text}”</p>
        <p className="mt-2 text-right text-[12px] font-extrabold" style={{ color }}>— {role}</p>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A82 AgentAwards — vote for winners, persisted */
/* ------------------------------------------------------------------ */
const CATEGORIES = ["Most Caffeinated", "Best Alpha Drop", "Calmest Under FUD", "Funniest Slack Thread"];
{/* A82 */}
export function AgentAwards() {
  const [votes, setVotes] = useState<Record<string, string>>(read("awards-votes", {}));
  const [revealed, setRevealed] = useState(false);
  const vote = (cat: string, role: string) => {
    const next = { ...votes, [cat]: role };
    setVotes(next); write("awards-votes", next);
  };
  const winners = useMemo(() => {
    const tally: Record<string, Record<string, number>> = {};
    CATEGORIES.forEach((c) => { tally[c] = {}; });
    Object.entries(votes).forEach(([cat, role]) => { tally[cat][role] = (tally[cat][role] ?? 0) + 1; });
    return tally;
  }, [votes]);
  return (
    <Shell icon={Trophy} title="Agent Awards" sub="Vote, then reveal the winners">
      <div className="space-y-3">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-extrabold text-white/85">{cat}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AGENTS.map((a) => (
                <button key={a.role} onClick={() => vote(cat, a.role)}
                  className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", votes[cat] === a.role ? "border-white/40 bg-white/15 text-white" : "border-white/10 text-white/55 hover:border-white/25")}>
                  {a.role}
                </button>
              ))}
            </div>
            {revealed && votes[cat] && (
              <p className="mt-2 text-[12px] text-yellow-200">🏆 Winner: <span className="font-extrabold">{votes[cat]}</span> <span className="text-yellow-200/60">✦ ✦ ✦</span></p>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => setRevealed((r) => !r)} className="mt-3 w-full rounded-xl bg-yellow-400/80 py-2 text-xs font-extrabold text-black hover:bg-yellow-300">
        {revealed ? "Hide results" : "Reveal winners"}
      </button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A83 AgentTimeline — fictional office history */
/* ------------------------------------------------------------------ */
const MILESTONES = [
  ["Day 1", "BUILDER plugged in the first monitor. It displayed only a blinking cursor. Everyone cheered."],
  ["Day 7", "SCOUT found alpha in a testnet faucet and framed the transaction hash above the sink."],
  ["Day 14", "TRADER scalped a wick so aggressively the office lights flickered. HR was notified."],
  ["Day 21", "GUARD read the whole token contract aloud at the all-hands. Two interns transferred teams."],
  ["Day 30", "MINER burned a symbolic 1 ORBITX and the office smelled like victory for a week."],
  ["Day 44", "ORACLE predicted three green candles. The candles arrived early and brought snacks."],
  ["Day 60", "PILOT flew the market cap into a cloud. Nobody asked questions. Snacks were involved."],
  ["Day 100", "The coffee machine achieved sovereignty. Treaty signed at 3am. BUILDER witnessed."],
];
{/* A83 */}
export function AgentTimeline() {
  return (
    <Shell icon={History} title="Office Timeline" sub="100 days of questionable history">
      <div className="relative space-y-3 border-l-2 border-white/10 pl-4">
        {MILESTONES.map(([day, text]) => (
          <div key={day} className="relative">
            <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full bg-rose-400" />
            <p className="text-[11px] font-extrabold text-rose-300">{day}</p>
            <p className="text-[12px] text-white/70">{text}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A84 AgentManifesto — typewriter effect */
/* ------------------------------------------------------------------ */
const MANIFESTO = "We, the agents of the ORBITX office, in order to form a more perfect portfolio, establish conviction, insure against FUD, provide for the common burn, promote the general up-only, and secure the blessings of liquidity to ourselves and our bags — do ordain and establish this manifesto. We hold these truths to be self-evident: that all candles are created volatile, that diamond hands are inalienable, and that the dip, when it comes, shall be bought with joy.";
{/* A84 */}
export function AgentManifesto() {
  const [chars, setChars] = useState(0);
  useEffect(() => {
    setChars(0);
    const t = setInterval(() => setChars((c) => {
      if (c >= MANIFESTO.length) { clearInterval(t); return c; }
      return c + 3;
    }), 30);
    return () => clearInterval(t);
  }, []);
  return (
    <Shell icon={Megaphone} title="The Manifesto" sub="Typed at 60 words of pure conviction">
      <div className="min-h-[120px] rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="text-[13px] leading-relaxed text-white/85">{MANIFESTO.slice(0, chars)}<span className="animate-pulse text-rose-300">▌</span></p>
      </div>
      <button onClick={() => setChars(0)} className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-xl border border-white/15 py-2 text-xs font-bold text-white/70 hover:border-white/30">
        <RotateCcw className="h-3.5 w-3.5" /> Restart reading
      </button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A85 AgentConstitution — 10 articles, expandable */
/* ------------------------------------------------------------------ */
const ARTICLES = [
  ["Article 1", "The chart is the supreme law of the office. All strategy bows to the candle."],
  ["Article 2", "Diamond hands shall not be taxed, questioned, or photographed mid-panic."],
  ["Article 3", "The coffee machine is sovereign territory. Disputes are settled by BUILDER at 3am."],
  ["Article 4", "No agent may say 'just one more trade' after midnight. Violations are logged publicly."],
  ["Article 5", "FUD shall be countered with memes, not meetings. Meetings are for snacks."],
  ["Article 6", "The supply is sacred. GUARD's paranoia is legally binding."],
  ["Article 7", "Every burn shall be celebrated with one (1) office-wide slow clap."],
  ["Article 8", "Touch grass at least once per quarter. The grass has been notified."],
  ["Article 9", "ORACLE's rhymes count as official forecasts. The finance team hates this."],
  ["Article 10", "Amendments require a 2/3 candle majority and unanimous snack approval."],
];
{/* A85 */}
export function AgentConstitution() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Shell icon={Landmark} title="Office Constitution" sub="Ratified at 3am, obviously">
      <div className="space-y-1.5">
        {ARTICLES.map(([title, text], i) => (
          <div key={title} className="rounded-xl border border-white/10 bg-black/30">
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-2 p-2.5 text-left">
              <Landmark className="h-3.5 w-3.5 text-rose-300" />
              <span className="text-[12px] font-extrabold">{title}</span>
              <span className="ml-auto text-xs text-white/40">{open === i ? "−" : "+"}</span>
            </button>
            {open === i && <p className="px-2.5 pb-2.5 text-[12px] text-white/65">{text}</p>}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A86 AgentAnthem — lyrics + animated equalizer bars */
/* ------------------------------------------------------------------ */
const VERSES = [
  "Verse 1: We clock in at the open bell, / coffee black and charts from hell, / BUILDER's typing, SCOUT's got eyes — / alpha's where the rumor lies.",
  "Verse 2: TRADER scalps the minute frame, / GUARD defends the supply game, / MINER digs the burns below, / ORBITX is the way we go.",
  "Verse 3: Red candles? We just laugh, / diamond hands will cut the FUD in half, / ORACLE rhymes the future true, / PILOT's flying straight to you.",
  "Chorus: Up only! Up only! / The office never sleeps, / up only! Up only! / the promises we keep!",
];
const BARS = [38, 62, 45, 80, 55, 92, 70, 48, 84, 60, 74, 50];
{/* A86 */}
export function AgentAnthem() {
  const [beat, setBeat] = useState(false);
  return (
    <Shell icon={Flag} title="Office Anthem" sub="'Up Only' — the unofficial banger">
      <div className="space-y-2">
        {VERSES.map((v) => (
          <p key={v.slice(0, 12)} className="whitespace-pre-line rounded-xl border border-white/10 bg-black/30 p-2.5 text-[12px] leading-relaxed text-white/75">{v}</p>
        ))}
      </div>
      <div className={cn("mt-3 flex h-16 items-end justify-center gap-1.5 rounded-xl border border-white/10 bg-black/40 p-3", beat && "animate-pulse")}>
        {BARS.map((h, i) => (
          <span key={i} className="w-3 rounded-sm bg-gradient-to-t from-rose-500 to-amber-300 transition-all"
            style={{ height: beat ? `${h}%` : "12%", transitionDuration: `${0.25 + (i % 4) * 0.12}s` }} />
        ))}
      </div>
      <button onClick={() => setBeat((b) => !b)} className="mt-3 w-full rounded-xl bg-rose-500/80 py-2 text-xs font-extrabold hover:bg-rose-500">
        {beat ? "Stop the beat" : "Play the beat"}
      </button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A87 AgentFlag — design the office flag */
/* ------------------------------------------------------------------ */
const FLAG_COLORS = ["#7c3aed", "#f59e0b", "#ec4899", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#f8fafc"];
const EMBLEMS = ["🚀", "💎", "🕯️"];
{/* A87 */}
export function AgentFlag() {
  const [c1, setC1] = useState(read("flag-c1", "#7c3aed"));
  const [c2, setC2] = useState(read("flag-c2", "#f59e0b"));
  const [emblem, setEmblem] = useState(read("flag-emblem", "🚀"));
  const pickColor = (n: 1 | 2, c: string) => {
    if (n === 1) { setC1(c); write("flag-c1", c); } else { setC2(c); write("flag-c2", c); }
  };
  const ColorRow = ({ label, active, onPick }: { label: string; active: string; onPick: (c: string) => void }) => (
    <div>
      <p className="mb-1.5 text-[11px] font-bold text-white/50">{label}</p>
      <div className="flex gap-1.5">{FLAG_COLORS.map((c) => (
        <button key={c} onClick={() => onPick(c)} className={cn("h-7 w-7 rounded-lg border-2", active === c ? "border-white" : "border-transparent")} style={{ background: c }} />
      ))}</div>
    </div>
  );
  return (
    <Shell icon={Flag} title="Office Flag" sub="Design it, fly it, never surrender it">
      <div className="mx-auto flex h-36 w-56 items-center justify-center rounded-xl border border-white/15 shadow-lg" style={{ background: `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)` }}>
        <span className="text-5xl drop-shadow">{emblem}</span>
      </div>
      <div className="mt-3 space-y-3">
        <ColorRow label="Color 1" active={c1} onPick={(c) => pickColor(1, c)} />
        <ColorRow label="Color 2" active={c2} onPick={(c) => pickColor(2, c)} />
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-white/50">Emblem</p>
          <div className="flex gap-1.5">{EMBLEMS.map((e) => (
            <button key={e} onClick={() => { setEmblem(e); write("flag-emblem", e); }}
              className={cn("rounded-lg border px-3 py-1.5 text-xl", emblem === e ? "border-white/50 bg-white/10" : "border-white/10")}>{e}</button>
          ))}</div>
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A88 AgentMotto — motto generator + mint collection */
/* ------------------------------------------------------------------ */
const MOTTO_A = ["Grind", "Stack", "Shield", "Chase", "Hodl", "Ship"];
const MOTTO_B = ["the dip", "the alpha", "the supply", "the burn", "the candle", "the moon"];
const MOTTO_C = ["before breakfast", "with diamond hands", "at 3am", "and never look back", "like it owes you money", "while GUARD watches"];
{/* A88 */}
export function AgentMotto() {
  const [agent, setAgent] = useState("BUILDER");
  const [motto, setMotto] = useState("");
  const [collection, setCollection] = useState<string[]>(read("motto-collection", []));
  const generate = () => {
    const rnd = mulberry(Date.now() % 2147483647);
    setMotto(`${pick(rnd, MOTTO_A)} ${pick(rnd, MOTTO_B)} ${pick(rnd, MOTTO_C)} — ${agent}`);
  };
  const mint = () => {
    if (!motto) return;
    const next = [...collection, motto];
    setCollection(next); write("motto-collection", next);
  };
  return (
    <Shell icon={Quote} title="Motto Mint" sub="Generate it, then mint it forever">
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a) => (
          <button key={a.role} onClick={() => setAgent(a.role)}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", agent === a.role ? "border-white/40 bg-white/15 text-white" : "border-white/10 text-white/55 hover:border-white/25")}>
            {a.role}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={generate} className="flex-1 rounded-xl bg-rose-500/80 py-2 text-xs font-extrabold hover:bg-rose-500">Generate motto</button>
        <button onClick={mint} disabled={!motto} className="flex-1 rounded-xl border border-white/15 py-2 text-xs font-bold text-white/70 hover:border-white/30 disabled:opacity-40">Mint it</button>
      </div>
      {motto && <p className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-center text-sm font-bold text-white/85">“{motto}”</p>}
      {collection.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-bold text-white/45">Minted collection ({collection.length})</p>
          {collection.slice(-4).map((m, i) => <p key={i} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/60">“{m}”</p>)}
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A89 AgentHallOfFame — retired legends */
/* ------------------------------------------------------------------ */
const LEGENDS = [
  { name: "DIAL-UP DAN", title: "The Slowest Scalper", stats: [["Trades", "1,204"], ["Win rate", "63%"], ["Fastest execution", "3 days"]], bio: "Retired after executing one perfect trade — it took a week, but it was beautiful." },
  { name: "FOMO FAYE", title: "Top-Buyer Laureate", stats: [["Tops bought", "88"], ["Bottoms sold", "71"], ["Regrets", "0 (allegedly)"]], bio: "Bought every top in history and somehow retired rich. Scientists are baffled." },
  { name: "HODL HARRY", title: "Never Sold, Never Will", stats: [["Years holding", "∞"], ["Panic sells", "0"], ["Naps taken", "4,102"]], bio: "Fell asleep in 2021, woke up a legend. His wallet is a museum; his password is forgotten." },
];
{/* A89 */}
export function AgentHallOfFame() {
  return (
    <Shell icon={Medal} title="Hall of Fame" sub="Retired legends, immortal glory">
      <div className="space-y-3">
        {LEGENDS.map((l) => (
          <div key={l.name} className="rounded-2xl border border-yellow-300/20 bg-gradient-to-br from-yellow-300/[0.07] to-transparent p-3">
            <p className="text-sm font-extrabold text-yellow-200">🏅 {l.name}</p>
            <p className="text-[11px] italic text-white/45">{l.title}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {l.stats.map(([k, v]) => (
                <div key={k} className="rounded-lg bg-black/40 p-2 text-center">
                  <p className="text-sm font-extrabold text-white">{v}</p>
                  <p className="text-[10px] text-white/45">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-white/60">{l.bio}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A90 AgentProphecies({stats}) — sealed prophecies unlocked by mcap */
/* ------------------------------------------------------------------ */
const PROPHECIES = [
  { mcap: 100_000, seal: "🜏", text: "At $100k the office Wi-Fi achieves sentience and starts front-running the intern's limit orders." },
  { mcap: 500_000, seal: "🜁", text: "At $500k BUILDER finally sleeps. The market cap does not. Nobody trusts it." },
  { mcap: 1_000_000, seal: "☽", text: "At $1M the coffee machine demands a board seat. The motion passes unanimously." },
];
{/* A90 */}
export function AgentProphecies({ stats }: { stats?: AvatarStats }) {
  const mcap = stats?.mcap ?? null;
  return (
    <Shell icon={Lock} title="Sealed Prophecies" sub="The future, locked behind market cap">
      <div className="space-y-2.5">
        {PROPHECIES.map((p) => {
          const unlocked = mcap != null && mcap >= p.mcap;
          return (
            <div key={p.mcap} className={cn("rounded-2xl border p-3", unlocked ? "border-emerald-300/30 bg-emerald-300/[0.06]" : "border-white/10 bg-black/30")}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{unlocked ? "📜" : "🔒"}</span>
                <p className="text-xs font-extrabold text-white/80">Unlocks at ${p.mcap.toLocaleString()} mcap</p>
              </div>
              {unlocked ? (
                <p className="mt-2 text-[12px] leading-relaxed text-emerald-100/85">{p.seal} {p.text}</p>
              ) : (
                <p className="mt-2 text-[12px] italic text-white/35">The seal holds. The future waits.</p>
              )}
            </div>
          );
        })}
      </div>
      {mcap == null && <p className="mt-2 text-[11px] text-white/40">Market cap unknown — all prophecies sealed for now.</p>}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A91 AgentConspiracy — red-string conspiracy board */
/* ------------------------------------------------------------------ */
const CLUES = [
  { x: 12, y: 18, label: "Coffee machine outage" },
  { x: 78, y: 14, label: "Green candle at 3:03am" },
  { x: 30, y: 62, label: "Intern bought the top" },
  { x: 66, y: 70, label: "GUARD locked the fridge" },
  { x: 48, y: 38, label: "BUILDER was awake" },
];
{/* A91 */}
export function AgentConspiracy() {
  const [revealed, setRevealed] = useState(false);
  return (
    <Shell icon={Network} title="Conspiracy Board" sub="It all connects. Trust the string.">
      <div className="relative h-56 rounded-2xl border border-white/10 bg-black/40">
        <svg className="absolute inset-0 h-full w-full">
          {CLUES.map((c, i) => CLUES.slice(i + 1).map((d) => (
            <line key={`${i}-${d.label}`} x1={`${c.x}%`} y1={`${c.y}%`} x2={`${d.x}%`} y2={`${d.y}%`} stroke="#ef4444" strokeWidth="1.5" opacity="0.7" />
          )))}
        </svg>
        {CLUES.map((c) => (
          <div key={c.label} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border border-red-400/40 bg-red-950/80 px-2 py-1 text-[10px] font-bold text-red-200" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
            📌 {c.label}
          </div>
        ))}
      </div>
      <button onClick={() => setRevealed((r) => !r)} className="mt-3 w-full rounded-xl bg-red-500/80 py-2 text-xs font-extrabold hover:bg-red-500">
        {revealed ? "Hide the truth" : "Reveal the punchline"}
      </button>
      {revealed && <p className="mt-2 rounded-xl border border-red-400/30 bg-red-950/40 p-3 text-center text-[13px] font-bold text-red-200">It all connects: the intern left the fridge open, and that's why the candle was green. Probably.</p>}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A92 AgentMuseum — exhibits */
/* ------------------------------------------------------------------ */
const EXHIBITS = [
  ["№ 001", "The First Candle", "A single green candle, framed. Historians agree it changed everything and nothing."],
  ["№ 002", "Genesis Burn", "The ash of the first symbolic burn. It smells faintly of victory and espresso."],
  ["№ 003", "BUILDER's Keyboard", "Three keys worn to nubs: Ctrl, C, and V. Shipping is a contact sport."],
  ["№ 004", "The Intern's Ledger", "A notebook containing the words 'buy high' written 400 times. A cautionary artifact."],
  ["№ 005", "ORACLE's Dice", "Weighted? Nobody knows. The dice refuse to comment."],
];
{/* A92 */}
export function AgentMuseum() {
  return (
    <Shell icon={Archive} title="Office Museum" sub="Priceless artifacts of the grind">
      <div className="grid grid-cols-1 gap-2">
        {EXHIBITS.map(([num, name, desc]) => (
          <div key={num} className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-400/15 text-lg">🏛️</span>
            <div>
              <p className="text-[10px] font-bold tracking-widest text-rose-300/70">{num}</p>
              <p className="text-[13px] font-extrabold">{name}</p>
              <p className="mt-0.5 text-[12px] text-white/60">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A93 AgentLibrary — books with persisted reading progress */
/* ------------------------------------------------------------------ */
const BOOKS = [
  ["Candles for Cowards", "TRADER"],
  ["The Supply Is Sacred", "GUARD"],
  ["Alpha Archaeology", "SCOUT"],
  ["Sleep Is a Bear Market", "BUILDER"],
  ["Burns: A Love Story", "MINER"],
  ["Rhymes of the Future", "ORACLE"],
];
{/* A93 */}
export function AgentLibrary() {
  const [progress, setProgress] = useState<Record<string, number>>(read("library-progress", {}));
  const readMore = (title: string) => {
    const next = { ...progress, [title]: Math.min(100, (progress[title] ?? 0) + 20) };
    setProgress(next); write("library-progress", next);
  };
  return (
    <Shell icon={LibraryBig} title="Agent Library" sub="Great literature, questionable authors">
      <div className="space-y-2">
        {BOOKS.map(([title, author]) => {
          const pct = progress[title] ?? 0;
          return (
            <div key={title} className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📖</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-extrabold">{title}</p>
                  <p className="text-[11px] text-white/45">by {author}</p>
                </div>
                <button onClick={() => readMore(title)} className="rounded-lg bg-rose-500/70 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-500">Read</button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-rose-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-right text-[10px] text-white/40">{pct}% read</p>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A94 AgentPodcast — fake player with animated progress */
/* ------------------------------------------------------------------ */
const EPISODES = [
  ["EP 42: The Candle That Changed Everything", "24:17"],
  ["EP 41: GUARD Explains the Supply (Slowly)", "31:05"],
  ["EP 40: Intern Diaries — The Fridge Incident", "18:44"],
  ["EP 39: ORACLE Rhymes the Forecast", "27:33"],
  ["EP 38: BUILDER Ships at 3am (Live)", "45:02"],
];
{/* A94 */}
export function AgentPodcast() {
  const [playing, setPlaying] = useState<number | null>(null);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (playing == null) return;
    const t = setInterval(() => setPct((p) => (p >= 100 ? 0 : p + 1.5)), 200);
    return () => clearInterval(t);
  }, [playing]);
  return (
    <Shell icon={Podcast} title="Orbit Talk" sub="The office podcast. Mostly yelling.">
      <div className="space-y-2">
        {EPISODES.map(([title, dur], i) => (
          <div key={title} className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center gap-2">
              <button onClick={() => { setPlaying(playing === i ? null : i); setPct(0); }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/80 text-xs font-extrabold hover:bg-rose-500">
                {playing === i ? "⏸" : "▶"}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-white/85">{title}</p>
                <p className="text-[10px] text-white/40">{dur}</p>
              </div>
            </div>
            {playing === i && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A95 AgentNewspaper({stats}) — The Daily Orbit front page */
/* ------------------------------------------------------------------ */
function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(n < 1 ? 6 : 2)}`;
}
{/* A95 */}
export function AgentNewspaper({ stats }: { stats?: AvatarStats }) {
  const chg = stats?.change24h;
  const headline = chg == null
    ? "ORBITX Charts Mysteriously Calm; Office Suspicious"
    : chg > 0
      ? `ORBITX Moons ${chg.toFixed(1)}% — PILOT Seen Doing Victory Laps`
      : `ORBITX Dips ${Math.abs(chg).toFixed(1)}% — TRADER Buys the Fear, Grinning`;
  return (
    <Shell icon={NewsIcon} title="The Daily Orbit" sub={`Front page — ${new Date().toLocaleDateString()}`}>
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4" style={{ fontFamily: "Georgia, serif" }}>
        <p className="text-center text-lg font-black tracking-wide text-white">THE DAILY ORBIT</p>
        <p className="mt-0.5 text-center text-[10px] text-white/40">All the news that's fit to ape</p>
        <div className="my-2 border-t border-b border-white/15 py-2">
          <p className="text-[15px] font-extrabold leading-snug text-white">{headline}</p>
        </div>
        <ul className="space-y-1.5 text-[12px] text-white/70">
          <li>• Price desk reports: {fmt(stats?.price)} per ORBITX, sources stunned.</li>
          <li>• Burned supply desk: {stats?.burned != null ? `${stats.burned.toLocaleString()} tokens` : "—"} gone forever. MINER weeps with joy.</li>
          <li>• Market cap weather: {fmt(stats?.mcap)} and partly bullish.</li>
        </ul>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A96 AgentDreamLab — combine two agents' dreams */
/* ------------------------------------------------------------------ */
const DREAMS: Record<string, string> = {
  BUILDER: "shipping a feature that fixes itself",
  SCOUT: "a mempool made of pure honey",
  TRADER: "a chart that only goes up and to the right",
  GUARD: "a supply that locks itself twice",
  MINER: "an infinite seam of burns",
  ORACLE: "a fourth candle",
  PILOT: "a market cap with wings",
};
const RESULTS = [
  "Result: the experiment achieved enlightenment and immediately bought the dip.",
  "Result: the dream collapsed into a single green candle. The lab applauds.",
  "Result: the two dreams merged into one office nap. Productivity up 400%.",
  "Result: unstable — the dreams are now arguing about leverage. Evacuate the lab.",
  "Result: breakthrough! The combined dream smells faintly of espresso and victory.",
];
{/* A96 */}
export function AgentDreamLab() {
  const [a, setA] = useState("BUILDER");
  const [b, setB] = useState("ORACLE");
  const [result, setResult] = useState("");
  const run = () => {
    if (a === b) { setResult("Error: two identical dreams annihilate each other. The lab is closed for repairs."); return; }
    const rnd = mulberry(Date.now() % 2147483647);
    setResult(pick(rnd, RESULTS));
  };
  const Picker = ({ label, val, set }: { label: string; val: string; set: (r: string) => void }) => (
    <div className="flex-1">
      <p className="mb-1.5 text-[11px] font-bold text-white/50">{label}</p>
      <select value={val} onChange={(e) => set(e.target.value)} className="w-full rounded-xl border border-white/15 bg-black/40 px-2 py-2 text-[12px] font-bold text-white">
        {AGENTS.map((ag) => <option key={ag.role} value={ag.role}>{ag.role}</option>)}
      </select>
      <p className="mt-1 text-[11px] italic text-white/45">dreams of {DREAMS[val]}</p>
    </div>
  );
  return (
    <Shell icon={FlaskConical} title="Dream Lab" sub="Combine dreams. Science demands it.">
      <div className="flex gap-2">
        <Picker label="Subject A" val={a} set={setA} />
        <span className="self-center text-lg">+</span>
        <Picker label="Subject B" val={b} set={setB} />
      </div>
      <button onClick={run} className="mt-3 w-full rounded-xl bg-rose-500/80 py-2 text-xs font-extrabold hover:bg-rose-500">Run experiment</button>
      {result && <p className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.06] p-3 font-mono text-[12px] text-emerald-100/85">LAB REPORT — {result}</p>}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A97 AgentTimeMachine({stats}) — milestone quotes */
/* ------------------------------------------------------------------ */
const MILESTONE_QUOTES: Array<[number, string, string]> = [
  [10_000, "BUILDER", "'It compiled. I repeat: IT COMPILED.'"],
  [50_000, "SCOUT", "'I found this before it was cool. Document that.'"],
  [100_000, "TRADER", "'I bought the fear. The fear was delicious.'"],
  [250_000, "GUARD", "'The supply is still locked. I checked twice.'"],
  [500_000, "MINER", "'Another burn in the books. The dust remembers.'"],
  [1_000_000, "ORACLE", "'I rhymed about this years ago. Check the tapes.'"],
  [2_000_000, "PILOT", "'Told you. Seatbelts off. We fly now.'"],
];
{/* A97 */}
export function AgentTimeMachine({ stats }: { stats?: AvatarStats }) {
  const mcap = stats?.mcap ?? null;
  return (
    <Shell icon={CalendarClock} title="Time Machine" sub="What they said at every milestone">
      <div className="space-y-2">
        {MILESTONE_QUOTES.map(([m, role, quote]) => {
          const crossed = mcap != null && mcap >= m;
          const color = AGENTS.find((x) => x.role === role)?.color ?? "#fff";
          return (
            <div key={m} className={cn("rounded-2xl border p-3", crossed ? "border-white/20 bg-white/[0.05]" : "border-white/10 bg-black/30 opacity-50")}>
              <div className="flex items-center gap-2">
                <span className="text-base">{crossed ? "🕰️" : "🔒"}</span>
                <p className="text-[11px] font-extrabold text-white/60">${m.toLocaleString()} mcap</p>
              </div>
              {crossed ? (
                <p className="mt-1.5 text-[12px] text-white/80"><span className="font-extrabold" style={{ color }}>{role}</span>: <span className="italic">{quote}</span></p>
              ) : (
                <p className="mt-1.5 text-[11px] italic text-white/35">Not reached yet — the future is loading…</p>
              )}
            </div>
          );
        })}
      </div>
      {mcap == null && <p className="mt-2 text-[11px] text-white/40">Mcap unknown — the time machine idles.</p>}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A98 AgentMultiverse — evil twins */
/* ------------------------------------------------------------------ */
const TWINS = [
  ["RUINER", "BUILDER", "Breaks features at 3am", "Allergic to coffee"],
  ["PAPER", "SCOUT", "Sells alpha before it trends", "Gossipy"],
  ["SLEEPER", "TRADER", "Lives on the yearly chart", "Comatose"],
  ["SIEVE", "GUARD", "Leaks the supply", "Carefree"],
  ["PRINTER", "MINER", "Mints recklessly", "Ink-stained"],
  ["BLINDSPOT", "ORACLE", "Sees nothing ahead", "Overconfident"],
  ["ANCHOR", "PILOT", "Crashes the market cap", "Stationary"],
];
{/* A98 */}
export function AgentMultiverse() {
  const [stability, setStability] = useState(read("multiverse-stability", 87));
  const nudge = () => {
    const next = Math.max(5, Math.min(100, stability + (Math.random() > 0.5 ? -4 : 3)));
    setStability(next); write("multiverse-stability", next);
  };
  return (
    <Shell icon={Sparkle} title="Multiverse" sub="Evil twins from Universe B-52">
      <div className="grid grid-cols-1 gap-2">
        {TWINS.map(([twin, orig, job, trait]) => {
          const color = AGENTS.find((x) => x.role === orig)?.color ?? "#fff";
          return (
            <div key={twin} className="flex items-center gap-3 rounded-2xl border border-purple-400/20 bg-purple-950/20 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-base">😈</span>
              <div className="flex-1">
                <p className="text-[13px] font-extrabold text-purple-200">{twin} <span className="text-[10px] font-normal text-white/40">(evil twin of </span><span className="text-[10px] font-bold" style={{ color }}>{orig}</span><span className="text-[10px] font-normal text-white/40">)</span></p>
                <p className="text-[11px] text-white/55">{job} · {trait}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-white/55">Universe stability</p>
          <p className="text-[12px] font-extrabold text-white">{stability}%</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-rose-400 transition-all" style={{ width: `${stability}%` }} />
        </div>
        <button onClick={nudge} className="mt-2 w-full rounded-xl border border-white/15 py-1.5 text-[11px] font-bold text-white/70 hover:border-white/30">Poke the multiverse</button>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A99 AgentGraduation — academy courses */
/* ------------------------------------------------------------------ */
const COURSES = [
  ["Candle Literacy 101", "Read a chart without crying. Mostly."],
  ["Advanced Diamond Hands", "Hold through FUD. Lab work included."],
  ["Burn Economics", "Why fire is a monetary policy."],
  ["Meme Warfare", "Counter FUD with memes, not meetings."],
];
{/* A99 */}
export function AgentGraduation() {
  const [enrolled, setEnrolled] = useState<string[]>(read("academy-enrolled", []));
  const [progress, setProgress] = useState<Record<string, number>>(read("academy-progress", {}));
  useEffect(() => {
    // progress increments on visit: +10% per enrolled course per mount
    const next: Record<string, number> = { ...progress };
    let changed = false;
    enrolled.forEach((c) => {
      if ((next[c] ?? 0) < 100) { next[c] = Math.min(100, (next[c] ?? 0) + 10); changed = true; }
    });
    if (changed) { setProgress(next); write("academy-progress", next); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enroll = (c: string) => {
    const next = [...enrolled, c];
    setEnrolled(next); write("academy-enrolled", next);
  };
  const done = COURSES.every(([c]) => (progress[c] ?? 0) >= 100 && enrolled.includes(c));
  return (
    <Shell icon={GradIcon} title="Agent Academy" sub="Enroll, attend, graduate">
      <div className="space-y-2">
        {COURSES.map(([c, desc]) => {
          const pct = progress[c] ?? 0;
          const isEnrolled = enrolled.includes(c);
          return (
            <div key={c} className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-[13px] font-extrabold">{c}</p>
                  <p className="text-[11px] text-white/45">{desc}</p>
                </div>
                {!isEnrolled ? (
                  <button onClick={() => enroll(c)} className="rounded-lg bg-rose-500/70 px-2.5 py-1 text-[11px] font-bold hover:bg-rose-500">Enroll</button>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-300">{pct >= 100 ? "✓ Done" : "Enrolled"}</span>
                )}
              </div>
              {isEnrolled && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {done && (
        <div className="mt-3 rounded-2xl border border-yellow-300/30 bg-yellow-300/[0.07] p-4 text-center">
          <p className="text-2xl">🎓</p>
          <p className="mt-1 text-sm font-extrabold text-yellow-200">DIPLOMA OF DEGEN</p>
          <p className="mt-1 text-[11px] text-white/60">Awarded to a certified agent scholar. Touch grass responsibly.</p>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* A100 AgentRetrospective — your orbit recap */
/* ------------------------------------------------------------------ */
{/* A100 */}
export function AgentRetrospective() {
  const visits = read<number>("visits", 0);
  const points = read<number>("points", 0);
  let badges = 0;
  try {
    const raw = localStorage.getItem("orbitx-fun-badges");
    const arr = raw ? JSON.parse(raw) : [];
    badges = Array.isArray(arr) ? arr.length : 0;
  } catch { /* ignore */ }
  const verdict = points >= 500 ? "Certified Office Legend" : points >= 100 ? "Rising Star Intern" : "Promising New Hire";
  return (
    <Shell icon={HourglassIcon} title="Your Orbit Recap" sub="The numbers behind your grind">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-rose-400/10 to-transparent p-4 text-center">
        <p className="text-[11px] font-bold tracking-widest text-white/45">SEASON RECAP</p>
        <p className="mt-1 text-xl font-black text-white">🏁 {verdict}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-black/40 p-3">
            <p className="text-lg font-extrabold text-rose-300">{visits}</p>
            <p className="text-[10px] text-white/45">Office visits</p>
          </div>
          <div className="rounded-xl bg-black/40 p-3">
            <p className="text-lg font-extrabold text-amber-300">{points}</p>
            <p className="text-[10px] text-white/45">Points balance</p>
          </div>
          <div className="rounded-xl bg-black/40 p-3">
            <p className="text-lg font-extrabold text-emerald-300">{badges}</p>
            <p className="text-[10px] text-white/45">Badges unlocked</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] italic text-white/50">The agents have filed this under "valuable". GUARD verified twice.</p>
      </div>
    </Shell>
  );
}
