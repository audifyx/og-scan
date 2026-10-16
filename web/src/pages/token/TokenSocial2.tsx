import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  CalendarCheck,
  Compass,
  CreditCard,
  Dices,
  Fish,
  Flame,
  GraduationCap,
  Handshake,
  Heart,
  HeartHandshake,
  ImagePlus,
  Megaphone,
  MessageSquare,
  Palette,
  ScrollText,
  Smile,
  Star,
  Trophy,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* Shared shell + tiny localStorage hook for all S26–S50 widgets. */

function Shell({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/12 text-violet-300">
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

function useLocal<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const full = `orbitx-social2-${key}`;
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(full);
      return raw != null ? (JSON.parse(raw) as T) : init;
    } catch {
      return init;
    }
  });
  const set = useCallback(
    (v: T | ((p: T) => T)) => {
      setVal((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(full, JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [full]
  );
  return [val, set];
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function visitDays(): number {
  try {
    const raw = localStorage.getItem("orbitx-social2-visit-dates");
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? new Set(arr).size : 0;
  } catch {
    return 0;
  }
}

/* S26 — TradingCards: collectible card per holder tier, flips on click. */
const TIERS = [
  { name: "Rookie", min: 0, color: "from-slate-500 to-slate-700", emoji: "🌱" },
  { name: "Explorer", min: 3, color: "from-sky-500 to-blue-700", emoji: "🧭" },
  { name: "Believer", min: 7, color: "from-violet-500 to-purple-700", emoji: "💜" },
  { name: "Whale Whisperer", min: 14, color: "from-amber-500 to-orange-700", emoji: "🐋" },
  { name: "Diamond", min: 30, color: "from-cyan-300 to-teal-600", emoji: "💎" },
];

export function TradingCards() {
  const [flipped, setFlipped] = useState<number | null>(null);
  const days = useMemo(() => Math.max(visitDays(), 1), []);
  return (
    <Shell icon={CreditCard} title="Trading Cards" sub="Unlock tiers by visiting — tap a card to flip">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TIERS.map((t, i) => {
          const unlocked = days >= t.min;
          return (
            <button
              key={t.name}
              onClick={() => unlocked && setFlipped(flipped === i ? null : i)}
              className="[perspective:800px]"
              aria-label={`${t.name} card`}
            >
              <div
                className={cn(
                  "relative h-36 w-full transition-transform duration-500 [transform-style:preserve-3d]",
                  !unlocked && "opacity-40 saturate-0"
                )}
                style={{ transform: flipped === i ? "rotateY(180deg)" : "none" }}
              >
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-gradient-to-br p-2 [backface-visibility:hidden]",
                    t.color
                  )}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-xs font-extrabold text-white">{t.name}</span>
                  <span className="text-[10px] text-white/70">
                    {unlocked ? "Unlocked" : `${t.min} days`}
                  </span>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/80 p-2 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <span className="text-[11px] font-bold text-violet-300">{t.name}</span>
                  <span className="mt-1 text-center text-[10px] text-white/60">
                    {t.min === 0
                      ? "Welcome to OrbitX, citizen."
                      : `Held strong for ${t.min}+ visit days. Respect.`}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/40">Your visit days: {days}</p>
    </Shell>
  );
}

/* S27 — AmbassadorBoard: apply + approve-yourself demo flow. */
interface Ambassador {
  name: string;
  why: string;
  approved: boolean;
}

export function AmbassadorBoard() {
  const [list, setList] = useLocal<Ambassador[]>("ambassadors", []);
  const [name, setName] = useState("");
  const [why, setWhy] = useState("");
  const apply = () => {
    if (!name.trim()) return;
    setList((p) => [...p, { name: name.trim(), why: why.trim(), approved: false }]);
    setName("");
    setWhy("");
  };
  return (
    <Shell icon={Megaphone} title="Ambassador Board" sub="Rep OrbitX in your corner of the internet">
      <div className="mb-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name / handle"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50"
        />
        <input
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          placeholder="Why should you be an ambassador?"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50"
        />
        <button
          onClick={apply}
          className="w-full rounded-lg bg-violet-500/80 py-2 text-xs font-extrabold text-white hover:bg-violet-500"
        >
          Apply
        </button>
      </div>
      <div className="space-y-2">
        {list.length === 0 && (
          <p className="text-[11px] text-white/40">No applications yet — be the first.</p>
        )}
        {list.map((a, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-black/30 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{a.name}</span>
              {a.approved ? (
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  Approved
                </span>
              ) : (
                <button
                  onClick={() =>
                    setList((p) => p.map((x, j) => (j === i ? { ...x, approved: true } : x)))
                  }
                  className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-400/25"
                >
                  Approve (demo)
                </button>
              )}
            </div>
            {a.why && <p className="mt-1 text-[11px] text-white/50">{a.why}</p>}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S28 — WhaleNicknames: nickname demo whale wallets. */
const DEMO_WHALES = ["7xJ3kP…9qK2", "F4m9sD…2vB8", "Qw8RtY…5nM1", "Zx1CvB…7hJ4", "Lp3OeW…0tR6"];

export function WhaleNicknames() {
  const [names, setNames] = useLocal<Record<string, string>>("whale-nicknames", {});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <Shell icon={Fish} title="Whale Nicknames" sub="Demo wallets — give the big fish a name">
      <div className="space-y-2">
        {DEMO_WHALES.map((w) => (
          <div key={w} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
            <span className="font-mono text-[11px] text-sky-300">{w}</span>
            {names[w] ? (
              <span className="flex-1 truncate text-xs font-bold text-amber-300">
                “{names[w]}”
              </span>
            ) : (
              <input
                value={drafts[w] ?? ""}
                onChange={(e) => setDrafts((p) => ({ ...p, [w]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && drafts[w]?.trim())
                    setNames((p) => ({ ...p, [w]: drafts[w].trim() }));
                }}
                placeholder="Nickname… (Enter to save)"
                className="flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] outline-none placeholder:text-white/25 focus:border-violet-400/50"
              />
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S29 — UserTitles: earn titles by actions across widgets. */
const TITLES = [
  { name: "First Visit", desc: "Showed up", check: () => visitDays() >= 1 },
  { name: "Regular", desc: "5 visit days", check: () => visitDays() >= 5 },
  { name: "Veteran", desc: "14 visit days", check: () => visitDays() >= 14 },
  {
    name: "Shiller",
    desc: "Applied as ambassador",
    check: () => (localStorage.getItem("orbitx-social2-ambassadors") ?? "[]") !== "[]",
  },
  {
    name: "Whale Watcher",
    desc: "Named 3 whales",
    check: () => {
      try {
        return Object.keys(JSON.parse(localStorage.getItem("orbitx-social2-whale-nicknames") ?? "{}")).length >= 3;
      } catch {
        return false;
      }
    },
  },
  {
    name: "Artist",
    desc: "Submitted fan art",
    check: () => (localStorage.getItem("orbitx-social2-fan-art") ?? "[]") !== "[]",
  },
  {
    name: "Pollster",
    desc: "Voted in the poll",
    check: () => localStorage.getItem("orbitx-social2-poll-vote") != null,
  },
];

export function UserTitles() {
  const [earned, setEarned] = useState<string[]>([]);
  useEffect(() => {
    setEarned(TITLES.filter((t) => { try { return t.check(); } catch { return false; } }).map((t) => t.name));
  }, []);
  return (
    <Shell icon={Award} title="Your Titles" sub="Earned by what you do around here">
      <div className="flex flex-wrap gap-2">
        {TITLES.map((t) => {
          const has = earned.includes(t.name);
          return (
            <div
              key={t.name}
              title={t.desc}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold",
                has
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                  : "border-white/10 bg-black/30 text-white/30"
              )}
            >
              <Award className="h-3 w-3" />
              {t.name}
              {!has && <span className="opacity-60">🔒</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/40">
        {earned.length}/{TITLES.length} unlocked
      </p>
    </Shell>
  );
}

/* S30 — PortfolioRoast: harmless roast of your bag size. */
const ROASTS = [
  (b: string) => `A ${b} bag? Bold. The chart doesn't know you exist, but we do.`,
  (b: string) => `${b}? That's not a bag, that's a participation trophy with extra steps.`,
  (b: string) => `Holding ${b} and checking the price every 4 minutes. We see you. We ARE you.`,
  (b: string) => `${b} bag energy: diamond hands, paper bank account.`,
  (b: string) => `You call ${b} a bag? Bro that's a fanny pack. Respect the hustle though.`,
  (b: string) => `${b}. The whales sneeze harder than your entire position. Still early.`,
  (b: string) => `A ${b} bag and a dream. Honestly? That's the whole OrbitX origin story.`,
];

export function PortfolioRoast() {
  const [bag, setBag] = useState("");
  const [roast, setRoast] = useState("");
  const fire = () => {
    const b = bag.trim() || "mystery-sized";
    setRoast(ROASTS[Math.floor(Math.random() * ROASTS.length)](b));
  };
  return (
    <Shell icon={Flame} title="Portfolio Roast" sub="All love. Mostly.">
      <div className="flex gap-2">
        <input
          value={bag}
          onChange={(e) => setBag(e.target.value)}
          placeholder="Your bag size (e.g. 50k ORBITX)"
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50"
        />
        <button
          onClick={fire}
          className="rounded-lg bg-orange-500/80 px-4 py-2 text-xs font-extrabold text-white hover:bg-orange-500"
        >
          Roast me
        </button>
      </div>
      {roast && (
        <div className="mt-3 rounded-xl border border-orange-400/25 bg-orange-400/10 p-3">
          <p className="text-xs leading-relaxed text-orange-100">🔥 {roast}</p>
        </div>
      )}
    </Shell>
  );
}

/* S31 — BagWedding: marry your bag, get a certificate. */
export function BagWedding() {
  const [p1, setP1] = useState("You");
  const [p2, setP2] = useState("My Bag");
  const [married, setMarried] = useState(false);
  const [copied, setCopied] = useState(false);
  const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const text = `💍 BAG WEDDING CERTIFICATE\n\n${p1} and ${p2} were joined in diamond-handed matrimony on ${date}.\n\nThrough green candles and red, through FUD and FOMO, till rug or moon do us part.\n\n— The OrbitX Chapel of Eternal Holding —`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <Shell icon={Heart} title="Bag Wedding" sub="Till rug or moon do us part">
      {!married ? (
        <div className="space-y-2">
          <input value={p1} onChange={(e) => setP1(e.target.value)} placeholder="Partner one"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50" />
          <input value={p2} onChange={(e) => setP2(e.target.value)} placeholder="Partner two"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50" />
          <button onClick={() => setMarried(true)}
            className="w-full rounded-lg bg-rose-500/80 py-2 text-xs font-extrabold text-white hover:bg-rose-500">
            💒 Get Married
          </button>
        </div>
      ) : (
        <div>
          <div className="rounded-xl border-2 border-amber-400/40 bg-gradient-to-b from-amber-400/10 to-transparent p-4 text-center">
            <p className="text-[10px] uppercase tracking-widest text-amber-300/80">Certificate of Eternal Holding</p>
            <p className="mt-2 text-sm font-extrabold">{p1 || "You"} 💍 {p2 || "My Bag"}</p>
            <p className="mt-1 text-[11px] text-white/50">{date}</p>
            <p className="mt-2 text-[11px] italic text-white/60">“Through green candles and red, till rug or moon do us part.”</p>
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={copy} className="flex-1 rounded-lg border border-white/15 py-2 text-xs font-bold text-white/80 hover:bg-white/5">
              {copied ? "Copied!" : "Copy certificate text"}
            </button>
            <button onClick={() => setMarried(false)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/60 hover:bg-white/5">
              Redo
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* S32 — PixelCanvas: 16x16 community pixel grid. */
const PALETTE = ["#f43f5e", "#f97316", "#facc15", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6", "#ffffff", "#18181b"];

export function PixelCanvas() {
  const [cells, setCells] = useLocal<string[]>("pixel-canvas", Array(256).fill("#18181b"));
  const [color, setColor] = useState(PALETTE[5]);
  const [drag, setDrag] = useState(false);
  const paint = (i: number) => setCells((p) => p.map((c, j) => (j === i ? color : c)));
  return (
    <Shell icon={Palette} title="Pixel Canvas" sub="One grid, endless masterpieces">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PALETTE.map((c) => (
          <button key={c} onClick={() => setColor(c)} aria-label={`color ${c}`}
            className={cn("h-6 w-6 rounded-md border", color === c ? "border-white ring-2 ring-white/60" : "border-white/20")}
            style={{ backgroundColor: c }} />
        ))}
        <button onClick={() => setCells(Array(256).fill("#18181b"))}
          className="ml-auto rounded-md border border-white/15 px-2 py-1 text-[10px] font-bold text-white/70 hover:bg-white/5">
          Clear
        </button>
      </div>
      <div
        className="grid select-none grid-cols-[repeat(16,minmax(0,1fr))] gap-px overflow-hidden rounded-lg border border-white/10 bg-black/50 p-1"
        onMouseLeave={() => setDrag(false)}
      >
        {cells.map((c, i) => (
          <button key={i} aria-label={`pixel ${i}`}
            onMouseDown={() => { setDrag(true); paint(i); }}
            onMouseEnter={() => drag && paint(i)}
            onMouseUp={() => setDrag(false)}
            className="aspect-square w-full" style={{ backgroundColor: c }} />
        ))}
      </div>
    </Shell>
  );
}

/* S33 — FlashMob: countdown to the next coordinated buy flash mob. */
const MOB_DATE = new Date("2027-01-15T18:00:00Z").getTime();

function pad(n: number) { return String(n).padStart(2, "0"); }

export function FlashMob() {
  const [rsvps, setRsvps] = useLocal<number>("flashmob-rsvps", 128);
  const [joined, setJoined] = useLocal<boolean>("flashmob-joined", false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, MOB_DATE - now);
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  const join = () => { if (!joined) { setJoined(true); setRsvps((p) => p + 1); } };
  return (
    <Shell icon={Zap} title="Flash Mob" sub="Coordinated community buy — Jan 15, 2027">
      <div className="mb-3 grid grid-cols-4 gap-2 text-center">
        {[[d, "days"], [h, "hrs"], [m, "min"], [s, "sec"]].map(([v, l]) => (
          <div key={l as string} className="rounded-lg border border-white/10 bg-black/40 py-2">
            <p className="text-lg font-extrabold tabular-nums">{pad(v as number)}</p>
            <p className="text-[10px] uppercase text-white/40">{l}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/60"><span className="font-extrabold text-white">{rsvps}</span> degens in</p>
        <button onClick={join} disabled={joined}
          className={cn("rounded-lg px-4 py-2 text-xs font-extrabold text-white",
            joined ? "bg-emerald-500/40" : "bg-yellow-500/80 hover:bg-yellow-500")}>
          {joined ? "You're in ⚡" : "I'm in"}
        </button>
      </div>
    </Shell>
  );
}

/* S34 — HolderSpotlight: weekly rotating demo holder persona. */
const PERSONAS = [
  { name: "MoonMama", emoji: "🌙", trait: "Checks the chart once a day. Once.", quote: "Patience is a position." },
  { name: "DegenDave", emoji: "🎲", trait: "Bought the top. Twice. Still here.", quote: "Averaging down is a lifestyle." },
  { name: "ChartChad", emoji: "📈", trait: "Draws 47 lines on every chart.", quote: "The wedge is wedging." },
  { name: "QuietQuinn", emoji: "🤫", trait: "Never posts. Always holds.", quote: "…" },
];

export function HolderSpotlight() {
  const week = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const p = PERSONAS[week % PERSONAS.length];
  return (
    <Shell icon={Star} title="Holder Spotlight" sub={`Week #${week % 52} · demo persona`}>
      <div className="flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/15 text-2xl">{p.emoji}</span>
        <div>
          <p className="text-sm font-extrabold text-amber-200">{p.name}</p>
          <p className="text-[11px] text-white/50">{p.trait}</p>
          <p className="mt-1 text-[11px] italic text-white/70">“{p.quote}”</p>
        </div>
      </div>
    </Shell>
  );
}

/* S35 — CommunityRoles: pick your role, wear the badge. */
const ROLES = [
  { name: "Meme Lord", emoji: "🤣", color: "text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-400/10" },
  { name: "Chart Wizard", emoji: "🧙", color: "text-sky-300 border-sky-400/40 bg-sky-400/10" },
  { name: "Vibe Curator", emoji: "✨", color: "text-violet-300 border-violet-400/40 bg-violet-400/10" },
  { name: "Lore Keeper", emoji: "📜", color: "text-amber-300 border-amber-400/40 bg-amber-400/10" },
  { name: "Whale Spotter", emoji: "🐋", color: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10" },
];

export function CommunityRoles() {
  const [role, setRole] = useLocal<string | null>("my-role", null);
  const picked = ROLES.find((r) => r.name === role);
  return (
    <Shell icon={UserCheck} title="Community Roles" sub="Pick one. Wear it loud.">
      {picked && (
        <div className={cn("mb-3 flex items-center gap-2 rounded-xl border px-3 py-2", picked.color)}>
          <span className="text-xl">{picked.emoji}</span>
          <span className="text-sm font-extrabold">{picked.name}</span>
          <button onClick={() => setRole(null)} className="ml-auto text-[10px] text-white/40 underline">resign</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button key={r.name} onClick={() => setRole(r.name)}
            className={cn("flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/70 hover:bg-white/5",
              role === r.name && "border-violet-400/60 bg-violet-400/15 text-white")}>
            <span>{r.emoji}</span> {r.name}
          </button>
        ))}
      </div>
    </Shell>
  );
}

/* S36 — OriginStory: how you found ORBITX + distribution bars. */
const STORIES = ["Friend shilled me", "Saw a meme", "Chart surfing", "Telegram raid", "Pure luck"];

export function OriginStory() {
  const [counts, setCounts] = useLocal<Record<string, number>>("origin-counts", {});
  const [mine, setMine] = useLocal<string | null>("origin-mine", null);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const vote = (s: string) => {
    setCounts((p) => ({ ...p, [s]: (p[s] ?? 0) + (mine === s ? 0 : 1) }));
    if (mine && mine !== s) setCounts((p) => ({ ...p, [mine]: Math.max(0, (p[mine] ?? 1) - 1) }));
    setMine(s);
  };
  return (
    <Shell icon={Compass} title="Origin Story" sub="How did you find ORBITX?">
      <div className="space-y-1.5">
        {STORIES.map((s) => {
          const c = counts[s] ?? 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          return (
            <button key={s} onClick={() => vote(s)} className="block w-full text-left">
              <div className="flex items-center justify-between text-[11px]">
                <span className={cn("font-bold", mine === s ? "text-violet-300" : "text-white/70")}>
                  {s} {mine === s && "· you"}
                </span>
                <span className="text-white/40">{pct}%</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={cn("h-full rounded-full", mine === s ? "bg-violet-400" : "bg-white/30")} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/40">{total} stories told</p>
    </Shell>
  );
}

/* S37 — LoyaltyStreak: visit streak + 14-day calendar dots. */
export function LoyaltyStreak() {
  const [dates, setDates] = useLocal<string[]>("visit-dates", []);
  const [streak, setStreak] = useState(0);
  const last14 = useMemo(() => {
    const out: { iso: string; label: string }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      out.push({ iso, label: d.toLocaleDateString(undefined, { weekday: "narrow" }) });
    }
    return out;
  }, []);
  useEffect(() => {
    const t = todayISO();
    setDates((p) => (p.includes(t) ? p : [...p, t]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const set = new Set(dates);
    let s = 0;
    const d = new Date();
    if (!set.has(todayISO())) d.setDate(d.getDate() - 1); // streak alive if visited yesterday
    while (true) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (set.has(iso)) { s++; d.setDate(d.getDate() - 1); } else break;
    }
    setStreak(s);
  }, [dates]);
  const has = new Set(dates);
  return (
    <Shell icon={CalendarCheck} title="Loyalty Streak" sub="Show up. Stack days.">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">🔥</span>
        <p className="text-sm font-extrabold">{streak} day{streak === 1 ? "" : "s"}</p>
        <p className="text-[11px] text-white/40">current streak</p>
      </div>
      <div className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0,1fr))" }}>
        {last14.map((d) => (
          <div key={d.iso} className="flex flex-col items-center gap-1">
            <div title={d.iso} className={cn("h-6 w-full rounded-md", has.has(d.iso) ? "bg-orange-400" : "bg-white/10")} />
            <span className="text-[9px] text-white/30">{d.label}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S38 — NameGenerator: degen name generator with claim. */
const ADJ = ["Turbo", "Moon", "Degen", "Based", "Feral", "Laser", "Wrinkle", "Gigachad", "Sleepy", "Void"];
const NOUN = ["Ape", "Whale", "Wizard", "Goblin", "Knight", "Raccoon", "Oracle", "Bandit", "Sailor", "Ghost"];

export function NameGenerator() {
  const [name, setName] = useState("");
  const [claimed, setClaimed] = useLocal<string | null>("claimed-name", null);
  const reroll = () => {
    const a = ADJ[Math.floor(Math.random() * ADJ.length)];
    const n = NOUN[Math.floor(Math.random() * NOUN.length)];
    setName(`${a}${n}${Math.floor(Math.random() * 999)}`);
  };
  useEffect(() => { if (!name) reroll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Shell icon={Dices} title="Degen Name Generator" sub="Your on-chain alter ego awaits">
      <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-center">
        <p className="text-lg font-extrabold text-violet-200">{name || "…"}</p>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={reroll} className="flex-1 rounded-lg border border-white/15 py-2 text-xs font-bold text-white/80 hover:bg-white/5">
          🎲 Reroll
        </button>
        <button onClick={() => name && setClaimed(name)}
          className="flex-1 rounded-lg bg-violet-500/80 py-2 text-xs font-extrabold text-white hover:bg-violet-500">
          {claimed === name ? "Claimed ✓" : "Claim it"}
        </button>
      </div>
      {claimed && <p className="mt-2 text-[11px] text-white/40">Your name: <span className="font-bold text-white/70">{claimed}</span></p>}
    </Shell>
  );
}

/* S39 — AvatarFrame: emoji avatar + frame style preview. */
const EMOJIS = ["🦍", "🐋", "🧙", "👻", "🦝", "🐸", "🦁", "🤖"];
const FRAMES = [
  { name: "None", ring: "border-white/20", glow: "" },
  { name: "Gold", ring: "border-amber-400", glow: "shadow-[0_0_24px_rgba(251,191,36,0.5)]" },
  { name: "Diamond", ring: "border-cyan-300", glow: "shadow-[0_0_24px_rgba(103,232,249,0.6)]" },
  { name: "Laser", ring: "border-red-500", glow: "shadow-[0_0_24px_rgba(239,68,68,0.7)]" },
];

export function AvatarFrame() {
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [frame, setFrame] = useState(FRAMES[1]);
  return (
    <Shell icon={Smile} title="Avatar Frame" sub="Flex your PFP frame">
      <div className="flex items-center gap-4">
        <div className={cn("flex h-20 w-20 items-center justify-center rounded-full border-4 bg-black/50 text-4xl", frame.ring, frame.glow)}>
          {emoji}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)}
                className={cn("rounded-md px-1.5 py-1 text-lg", emoji === e ? "bg-violet-400/25" : "hover:bg-white/5")}>{e}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {FRAMES.map((f) => (
              <button key={f.name} onClick={() => setFrame(f)}
                className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold",
                  frame.name === f.name ? "border-violet-400/60 bg-violet-400/15 text-white" : "border-white/15 text-white/60")}>
                {f.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      {frame.name === "Laser" && <p className="mt-2 text-[11px] text-red-300/80">⚠️ Laser eyes engage maximum conviction.</p>}
    </Shell>
  );
}

/* S40 — FanArtWall: submit art description + emoji, like gallery. */
interface Art { emoji: string; desc: string; likes: number; }

export function FanArtWall() {
  const [arts, setArts] = useLocal<Art[]>("fan-art", []);
  const [emoji, setEmoji] = useState("🎨");
  const [desc, setDesc] = useState("");
  const submit = () => {
    if (!desc.trim()) return;
    setArts((p) => [{ emoji: emoji.trim() || "🎨", desc: desc.trim(), likes: 0 }, ...p]);
    setDesc("");
  };
  return (
    <Shell icon={ImagePlus} title="Fan Art Wall" sub="Describe your masterpiece">
      <div className="mb-3 flex gap-2">
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🎨"
          className="w-12 rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-center text-sm outline-none focus:border-violet-400/50" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Raj riding a rocket over the chart…"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50" />
        <button onClick={submit} className="rounded-lg bg-violet-500/80 px-3 py-2 text-xs font-extrabold text-white hover:bg-violet-500">Post</button>
      </div>
      {arts.length === 0 && <p className="text-[11px] text-white/40">Gallery is empty. Make history.</p>}
      <div className="grid grid-cols-2 gap-2">
        {arts.map((a, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-2">
            <p className="text-2xl">{a.emoji}</p>
            <p className="mt-1 line-clamp-3 text-[11px] text-white/70">{a.desc}</p>
            <button onClick={() => setArts((p) => p.map((x, j) => (j === i ? { ...x, likes: x.likes + 1 } : x)))}
              className="mt-1 text-[11px] font-bold text-rose-300 hover:text-rose-200">❤️ {a.likes}</button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S41 — CommunityPoll: vote + results bars. */
const POLL_Q = "Best time to check the chart?";
const POLL_OPTS = ["GM o'clock", "Lunch break", "3am (degen hours)", "Never. I just vibe."];

export function CommunityPoll() {
  const [votes, setVotes] = useLocal<Record<string, number>>("poll-votes", { "GM o'clock": 42, "Lunch break": 17, "3am (degen hours)": 66, "Never. I just vibe.": 25 });
  const [mine, setMine] = useLocal<string | null>("poll-vote", null);
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const vote = (o: string) => {
    if (mine) return;
    setVotes((p) => ({ ...p, [o]: (p[o] ?? 0) + 1 }));
    setMine(o);
  };
  return (
    <Shell icon={BarChart3} title="Community Poll" sub={POLL_Q}>
      <div className="space-y-1.5">
        {POLL_OPTS.map((o) => {
          const c = votes[o] ?? 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          return (
            <button key={o} onClick={() => vote(o)} disabled={!!mine} className="block w-full text-left disabled:cursor-default">
              <div className="flex items-center justify-between text-[11px]">
                <span className={cn("font-bold", mine === o ? "text-emerald-300" : "text-white/70")}>{o}{mine === o && " ✓"}</span>
                <span className="text-white/40">{pct}%</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={cn("h-full rounded-full", mine === o ? "bg-emerald-400" : "bg-white/30")} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/40">{total} votes{mine ? " · you voted" : " · tap to vote"}</p>
    </Shell>
  );
}

/* S42 — WelcomeCommittee: demo welcomes + write your own. */
const DEMO_WELCOMES = [
  { from: "MoonMama", text: "Welcome fren! Read the pinned post, then touch grass. Then come back." },
  { from: "DegenDave", text: "New here? Rule one: we buy. Rule two: see rule one." },
  { from: "QuietQuinn", text: "…welcome." },
];

export function WelcomeCommittee() {
  const [mine, setMine] = useLocal<string[]>("welcome-msgs", []);
  const [draft, setDraft] = useState("");
  const send = () => {
    if (!draft.trim()) return;
    setMine((p) => [draft.trim(), ...p]);
    setDraft("");
  };
  return (
    <Shell icon={Handshake} title="Welcome Committee" sub="Greet the newcomers">
      <div className="mb-3 space-y-2">
        {DEMO_WELCOMES.map((w, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-black/30 p-2">
            <p className="text-[11px] text-white/70">{w.text}</p>
            <p className="mt-1 text-[10px] text-white/40">— {w.from} <span className="rounded bg-white/10 px-1">demo</span></p>
          </div>
        ))}
        {mine.map((m, i) => (
          <div key={`m${i}`} className="rounded-lg border border-violet-400/25 bg-violet-400/[0.07] p-2">
            <p className="text-[11px] text-white/80">{m}</p>
            <p className="mt-1 text-[10px] text-white/40">— you</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a welcome message…"
          onKeyDown={(e) => e.key === "Enter" && send()}
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50" />
        <button onClick={send} className="rounded-lg bg-violet-500/80 px-3 py-2 text-xs font-extrabold text-white hover:bg-violet-500">Send</button>
      </div>
    </Shell>
  );
}

/* S43 — Traditions: community traditions checklist. */
const TRADITIONS = [
  { id: "gm", name: "GM Mondays", desc: "Everyone says GM. No exceptions." },
  { id: "meme", name: "Meme Fridays", desc: "Best meme of the week gets pinned." },
  { id: "chart", name: "Chart Sundays", desc: "Post your wildest TA. Wrong answers only." },
  { id: "burn", name: "Burn Remembrance", desc: "Pour one out for the burned supply." },
  { id: "moon", name: "Moon Watch", desc: "Full moon = community screenshot night." },
];

export function Traditions() {
  const [done, setDone] = useLocal<string[]>("traditions", []);
  const toggle = (id: string) => setDone((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Shell icon={ScrollText} title="Traditions" sub="The sacred rituals">
      <div className="space-y-2">
        {TRADITIONS.map((t) => (
          <label key={t.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 bg-black/30 p-2 hover:bg-white/[0.04]">
            <input type="checkbox" checked={done.includes(t.id)} onChange={() => toggle(t.id)} className="mt-0.5 accent-violet-400" />
            <div>
              <p className={cn("text-xs font-bold", done.includes(t.id) ? "text-white/40 line-through" : "text-white/90")}>{t.name}</p>
              <p className="text-[11px] text-white/50">{t.desc}</p>
            </div>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-white/40">{done.length}/{TRADITIONS.length} observed</p>
    </Shell>
  );
}

/* S44 — LoreKeeper: community lore entries + upvotes. */
interface Lore { text: string; votes: number; demo?: boolean; }

export function LoreKeeper() {
  const [lore, setLore] = useLocal<Lore[]>("lore", [
    { text: "Legend says the first ORBITX buy was made from a phone with 2% battery.", votes: 24, demo: true },
    { text: "The Burn Wallet is said to whisper 'soon' every full moon.", votes: 18, demo: true },
  ]);
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    setLore((p) => [...p, { text: draft.trim(), votes: 0 }]);
    setDraft("");
  };
  const sorted = [...lore].sort((a, b) => b.votes - a.votes);
  return (
    <Shell icon={BookOpen} title="Lore Keeper" sub="The sacred texts of OrbitX">
      <div className="mb-3 space-y-2">
        {sorted.map((l, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
            <button
              onClick={() => setLore((p) => p.map((x) => (x === l ? { ...x, votes: x.votes + 1 } : x)))}
              className="flex flex-col items-center rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold text-white/70 hover:bg-white/10"
            >
              ▲ {l.votes}
            </button>
            <div>
              <p className="text-[11px] text-white/80">{l.text}</p>
              {l.demo && <span className="mt-0.5 inline-block rounded bg-white/10 px-1 text-[9px] text-white/40">demo</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add your own lore…"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50" />
        <button onClick={add} className="rounded-lg bg-violet-500/80 px-3 py-2 text-xs font-extrabold text-white hover:bg-violet-500">Add</button>
      </div>
    </Shell>
  );
}

/* S45 — HallOfFame: top contributors by category (demo + you). */
const FAME: Record<string, { name: string; detail: string }[]> = {
  Shillers: [
    { name: "MoonMama", detail: "1,204 shills" },
    { name: "DegenDave", detail: "987 shills" },
  ],
  Memers: [
    { name: "MemeMachine", detail: "342 memes" },
    { name: "GoblinKing", detail: "301 memes" },
  ],
  Helpers: [
    { name: "QuietQuinn", detail: "512 answers" },
    { name: "ChartChad", detail: "408 answers" },
  ],
};

export function HallOfFame() {
  const [tab, setTab] = useState("Shillers");
  const [claimed] = useLocal<string | null>("claimed-name", null);
  const rows = [...FAME[tab], { name: claimed ?? "You", detail: "rising star" }];
  return (
    <Shell icon={Trophy} title="Hall of Fame" sub="Legends of the community · demo names">
      <div className="mb-3 flex gap-1">
        {Object.keys(FAME).map((c) => (
          <button key={c} onClick={() => setTab(c)}
            className={cn("rounded-full px-3 py-1 text-[11px] font-bold",
              tab === c ? "bg-amber-400/20 text-amber-200" : "text-white/50 hover:bg-white/5")}>
            {c}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
            <span className={cn("w-6 text-center text-sm font-extrabold",
              i === 0 ? "text-amber-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-white/30")}>
              {i + 1}
            </span>
            <span className="text-xs font-bold">{r.name}</span>
            {i >= FAME[tab].length && <span className="rounded bg-violet-400/20 px-1 text-[9px] font-bold text-violet-300">YOU</span>}
            <span className="ml-auto text-[11px] text-white/40">{r.detail}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S46 — NewbieGuide: 5-step checklist, confetti at 100%. */
const STEPS = [
  "Read the pinned community post",
  "Say GM in the chat",
  "Set your degen name (S38)",
  "Vote in the community poll",
  "Post your first meme or lore",
];

export function NewbieGuide() {
  const [done, setDone] = useLocal<boolean[]>("newbie-steps", [false, false, false, false, false]);
  const pct = Math.round((done.filter(Boolean).length / STEPS.length) * 100);
  return (
    <Shell icon={GraduationCap} title="Newbie Guide" sub="From lurker to legend in 5 steps">
      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-white/70">Progress</span>
          <span className="font-extrabold text-violet-300">{pct}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="space-y-1.5">
        {STEPS.map((s, i) => (
          <label key={i} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 hover:bg-white/[0.04]">
            <input type="checkbox" checked={!!done[i]} onChange={() => setDone((p) => p.map((d, j) => (j === i ? !d : d)))} className="accent-violet-400" />
            <span className={cn("text-xs", done[i] ? "text-white/40 line-through" : "text-white/85")}>{s}</span>
          </label>
        ))}
      </div>
      {pct === 100 && (
        <p className="mt-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 p-3 text-center text-sm font-extrabold">
          🎉🎊 You did it! Certified OrbitX citizen! 🎊🎉
        </p>
      )}
    </Shell>
  );
}

/* S47 — CommunityValues: vote on what matters most. */
const VALUES = ["Diamond hands", "Good vibes", "Help newcomers", "Dank memes", "Transparency", "Never financial advice", "Touch grass occasionally"];

export function CommunityValues() {
  const [votes, setVotes] = useLocal<Record<string, number>>("value-votes", { "Diamond hands": 88, "Good vibes": 64, "Help newcomers": 41, "Dank memes": 73, "Transparency": 52, "Never financial advice": 47, "Touch grass occasionally": 19 });
  const [mine, setMine] = useLocal<string | null>("value-vote", null);
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const vote = (v: string) => {
    if (mine) return;
    setVotes((p) => ({ ...p, [v]: (p[v] ?? 0) + 1 }));
    setMine(v);
  };
  const ranked = [...VALUES].sort((a, b) => (votes[b] ?? 0) - (votes[a] ?? 0));
  return (
    <Shell icon={HeartHandshake} title="Community Values" sub="What matters most here?">
      <div className="space-y-1.5">
        {ranked.map((v) => {
          const c = votes[v] ?? 0;
          const pct = total ? Math.round((c / total) * 100) : 0;
          return (
            <button key={v} onClick={() => vote(v)} disabled={!!mine} className="block w-full text-left disabled:cursor-default">
              <div className="flex items-center justify-between text-[11px]">
                <span className={cn("font-bold", mine === v ? "text-rose-300" : "text-white/70")}>{v}{mine === v && " ✓"}</span>
                <span className="text-white/40">{c}</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={cn("h-full rounded-full", mine === v ? "bg-rose-400" : "bg-white/30")} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

/* S48 — MeetTheTeam: demo team personas. */
const TEAM = [
  { name: "Nova", emoji: "🚀", role: "Chief Vibe Officer", fact: "Once GM'd 400 days in a row." },
  { name: "Satoshi Jr.", emoji: "🧠", role: "Chart Goblin", fact: "Sees wedges in cloud formations." },
  { name: "Pixel", emoji: "🎨", role: "Meme Smith", fact: "Has never posted a bad meme. Allegedly." },
  { name: "Hodlbot", emoji: "🤖", role: "Community Mod", fact: "Runs on pure diamond hands." },
];

export function MeetTheTeam() {
  return (
    <Shell icon={Users} title="Meet The Team" sub="The humans(?) behind OrbitX · demo personas">
      <div className="grid grid-cols-2 gap-2">
        {TEAM.map((t) => (
          <div key={t.name} className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
            <p className="text-3xl">{t.emoji}</p>
            <p className="mt-1 text-xs font-extrabold">{t.name}</p>
            <p className="text-[10px] font-bold text-violet-300">{t.role}</p>
            <p className="mt-1 text-[10px] italic text-white/50">{t.fact}</p>
            <span className="mt-1 inline-block rounded bg-white/10 px-1.5 text-[9px] text-white/40">DEMO</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S49 — FeedbackWall: submit feedback, upvote, sorted by votes. */
interface Feedback { text: string; votes: number; demo?: boolean; }

export function FeedbackWall() {
  const [items, setItems] = useLocal<Feedback[]>("feedback", [
    { text: "More meme contests please", votes: 12, demo: true },
  ]);
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    setItems((p) => [...p, { text: draft.trim(), votes: 0 }]);
    setDraft("");
  };
  const sorted = [...items].sort((a, b) => b.votes - a.votes);
  return (
    <Shell icon={MessageSquare} title="Feedback Wall" sub="Shape the community">
      <div className="mb-3 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your idea or feedback…"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50" />
        <button onClick={add} className="rounded-lg bg-violet-500/80 px-3 py-2 text-xs font-extrabold text-white hover:bg-violet-500">Post</button>
      </div>
      <div className="space-y-1.5">
        {sorted.map((f, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2">
            <button onClick={() => setItems((p) => p.map((x) => (x === f ? { ...x, votes: x.votes + 1 } : x)))}
              className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] font-bold text-white/70 hover:bg-white/10">
              ▲ {f.votes}
            </button>
            <p className="flex-1 text-[11px] text-white/80">{f.text}</p>
            {f.demo && <span className="rounded bg-white/10 px-1 text-[9px] text-white/40">demo</span>}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S50 — IdentityCard: your OrbitX Citizen ID from localStorage data. */
export function IdentityCard() {
  const [name, setName] = useLocal<string>("citizen-name", "");
  const [role] = useLocal<string | null>("my-role", null);
  const [claimed] = useLocal<string | null>("claimed-name", null);
  const days = useMemo(() => Math.max(visitDays(), 1), []);
  const tier = days >= 30 ? "Diamond" : days >= 14 ? "Whale Whisperer" : days >= 7 ? "Believer" : days >= 3 ? "Explorer" : "Rookie";
  let joined = "today";
  try {
    const raw = localStorage.getItem("orbitx-social2-visit-dates");
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    if (Array.isArray(arr) && arr.length) joined = [...arr].sort()[0];
  } catch { /* ignore */ }
  const displayName = name.trim() || claimed || "Anonymous Citizen";
  return (
    <Shell icon={BadgeCheck} title="Identity Card" sub="Your official OrbitX Citizen ID">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your citizen name…"
        className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50" />
      <div className="overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/20 via-black to-fuchsia-500/10">
        <div className="flex items-center justify-between bg-white/5 px-4 py-2">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-300">OrbitX Citizen ID</p>
          <BadgeCheck className="h-4 w-4 text-violet-300" />
        </div>
        <div className="space-y-1.5 p-4">
          <p className="text-lg font-extrabold">{displayName}</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><p className="text-white/40">Title</p><p className="font-bold">{role ?? "Member"}</p></div>
            <div><p className="text-white/40">Tier</p><p className="font-bold text-amber-300">{tier}</p></div>
            <div><p className="text-white/40">Joined</p><p className="font-bold">{joined}</p></div>
            <div><p className="text-white/40">Visit days</p><p className="font-bold">{days}</p></div>
          </div>
        </div>
        <div className="bg-white/5 px-4 py-1.5 text-center font-mono text-[10px] text-white/40">
          ID-{String(Math.abs([...displayName].reduce((a, c) => a + c.charCodeAt(0), 0))).padStart(6, "0")}-ORBX
        </div>
      </div>
    </Shell>
  );
}
