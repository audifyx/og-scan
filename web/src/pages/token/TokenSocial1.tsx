import { useEffect, useRef, useState } from "react";
import {
  Megaphone, Zap, Image as ImageIcon, MessageSquare, Star, BarChart3, Smile,
  UserPlus, Flame, TrendingUp, PenLine, Copy, Trophy, Sparkles, CloudRain,
  Hash, Flag, Share2, Gauge, CalendarDays, Crown, LayoutGrid, Clock, Users,
  Repeat, Check, Send, Plus, Trash2, ChevronLeft, ChevronRight, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LS = "orbitx-social1-";

/* ---------- shared helpers ---------- */

function useLS<T>(key: string, init: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(LS + key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch {
      return init;
    }
  });
  const set = (nv: T | ((p: T) => T)) =>
    setV((p) => {
      const next = typeof nv === "function" ? (nv as (p: T) => T)(p) : nv;
      try {
        localStorage.setItem(LS + key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return [v, set];
}

function useMyId(): string {
  const [id] = useState(() => {
    let v = localStorage.getItem(LS + "my-id");
    if (!v) {
      v = "u" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(LS + "my-id", v);
    }
    return v;
  });
  return id;
}

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function streakOf(days: string[]): number {
  const set = new Set(days);
  let s = 0;
  const d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(dayKey(d))) {
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

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
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-400/12 text-teal-300">
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

const TEMPLATES = {
  bullish: `🚀 $ORBITX is going PARABOLIC. New ATH loading... You still have time but not much. #ORBITX #Solana`,
  funny: `Me: "just one more trade."\nAlso me at 3am watching the $ORBITX chart like it's Netflix 📈🍿`,
  serious: `$ORBITX — real community, real volume, real vision. Do your own research, then join us. orbitx.world`,
  degen: `APE IN. ASK QUESTIONS NEVER. $ORBITX TO THE MOON 🌙💎🙌 LFG!!!`,
};

/* ---------- S1 ShillKit ---------- */
export function ShillKit() {
  const [copied, setCopied] = useState<string | null>(null);
  const styles = [
    { k: "bullish", label: "Bullish", text: TEMPLATES.bullish },
    { k: "funny", label: "Funny", text: TEMPLATES.funny },
    { k: "serious", label: "Serious", text: TEMPLATES.serious },
    { k: "degen", label: "Degen", text: TEMPLATES.degen },
  ];
  return (
    <Shell icon={Megaphone} title="Shill Kit" sub="Copy-paste ammo for the timeline">
      {/* S1 */}
      <div className="grid gap-2">
        {styles.map((s) => (
          <button
            key={s.k}
            onClick={async () => {
              if (await copyText(s.text)) {
                setCopied(s.k);
                setTimeout(() => setCopied(null), 1500);
              }
            }}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 p-3 text-left transition hover:border-teal-300/40"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-teal-300">{s.label}</p>
              <p className="truncate text-[11px] text-white/50">{s.text.split("\n")[0]}</p>
            </div>
            {copied === s.k ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4 shrink-0 text-white/40" />
            )}
          </button>
        ))}
      </div>
    </Shell>
  );
}

/* ---------- S2 RaidButton ---------- */
export function RaidButton() {
  const [secs, setSecs] = useState(0);
  const [done, setDone] = useState(false);
  const [participants, setParticipants] = useLS<string[]>("raid-parts", []);
  const joined = participants.length > 0;
  useEffect(() => {
    if (secs <= 0) return;
    if (secs === 1) setDone(true);
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);
  const myId = useMyId();
  return (
    <Shell icon={Zap} title="Raid Button" sub="Coordinate a 60s shill raid">
      {/* S2 */}
      {done ? (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center">
          <p className="text-lg font-extrabold text-emerald-300">RAID COMPLETE</p>
          <p className="text-xs text-white/50">{participants.length} raiders deployed</p>
          <button
            onClick={() => { setDone(false); setParticipants([]); }}
            className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20"
          >
            Reset
          </button>
        </div>
      ) : secs > 0 ? (
        <div className="text-center">
          <p className="text-4xl font-black tabular-nums text-teal-300">{secs}s</p>
          <p className="mt-1 text-xs text-white/50">{participants.length} raiders joined</p>
          {!joined && (
            <button
              onClick={() => setParticipants((p) => [...p, myId])}
              className="mt-3 rounded-xl bg-teal-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-teal-300"
            >
              Join Raid
            </button>
          )}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-teal-400 transition-all duration-1000" style={{ width: `${(secs / 60) * 100}%` }} />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setSecs(60)}
          className="w-full rounded-xl bg-gradient-to-r from-teal-400 to-emerald-500 py-4 text-lg font-black text-black shadow-lg shadow-teal-500/20 transition hover:scale-[1.02]"
        >
          ⚡ START RAID
        </button>
      )}
    </Shell>
  );
}

/* ---------- S3 MemeGenerator ---------- */
const GRADS: [string, string][] = [
  ["#7c3aed", "#06b6d4"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#3b82f6"],
  ["#ec4899", "#8b5cf6"],
];
export function MemeGenerator() {
  const [gi, setGi] = useState(0);
  const [top, setTop] = useState("WHEN ORBITX");
  const [bottom, setBottom] = useState("HITS $1");
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const [a, b] = GRADS[gi];
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 5;
    ctx.font = "bold 30px Impact, Arial, sans-serif";
    ctx.textAlign = "center";
    const draw = (t: string, y: number) => {
      if (!t.trim()) return;
      const line = t.toUpperCase();
      ctx.strokeText(line, c.width / 2, y);
      ctx.fillText(line, c.width / 2, y);
    };
    draw(top, 55);
    draw(bottom, c.height - 30);
  }, [gi, top, bottom]);
  return (
    <Shell icon={ImageIcon} title="Meme Generator" sub="Make a quick ORBITX meme">
      {/* S3 */}
      <canvas ref={ref} width={400} height={280} className="w-full rounded-xl border border-white/10" />
      <div className="mt-2 flex gap-2">
        {GRADS.map(([a], i) => (
          <button
            key={i}
            onClick={() => setGi(i)}
            className={cn("h-8 flex-1 rounded-lg border-2", i === gi ? "border-white" : "border-transparent")}
            style={{ background: `linear-gradient(135deg, ${GRADS[i][0]}, ${GRADS[i][1]})` }}
            aria-label={`Background ${i + 1}`}
          />
        ))}
      </div>
      <input value={top} onChange={(e) => setTop(e.target.value)} placeholder="Top text"
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
      <input value={bottom} onChange={(e) => setBottom(e.target.value)} placeholder="Bottom text"
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
      <button
        onClick={() => {
          const c = ref.current;
          if (!c) return;
          const a = document.createElement("a");
          a.href = c.toDataURL("image/png");
          a.download = "orbitx-meme.png";
          a.click();
        }}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 py-2 text-sm font-extrabold text-black hover:bg-teal-300"
      >
        <Download className="h-4 w-4" /> Download Meme
      </button>
    </Shell>
  );
}

/* ---------- S4 ShoutWall ---------- */
interface Shout { id: string; name: string; msg: string; ts: number; by: string }
export function ShoutWall() {
  const [shouts, setShouts] = useLS<Shout[]>("shouts", []);
  const [name, setName] = useLS("shout-name", "Anon");
  const [msg, setMsg] = useState("");
  const myId = useMyId();
  const post = () => {
    if (!msg.trim()) return;
    setShouts((s) => [{ id: Math.random().toString(36).slice(2), name: name.trim() || "Anon", msg: msg.trim(), ts: Date.now(), by: myId }, ...s].slice(0, 50));
    setMsg("");
  };
  return (
    <Shell icon={MessageSquare} title="Shout Wall" sub="Leave your mark on the community">
      {/* S4 */}
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
          className="w-24 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
        <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && post()} placeholder="Shout something..."
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
        <button onClick={post} className="rounded-lg bg-teal-400 px-3 text-black hover:bg-teal-300" aria-label="Post shout">
          <Send className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {shouts.slice(0, 8).map((s) => (
          <div key={s.id} className="flex items-start justify-between gap-2 rounded-xl bg-black/30 p-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-teal-300">{s.name} <span className="font-normal text-white/30">· {timeAgo(s.ts)}</span></p>
              <p className="break-words text-xs text-white/80">{s.msg}</p>
            </div>
            {s.by === myId && (
              <button onClick={() => setShouts((p) => p.filter((x) => x.id !== s.id))} className="text-white/30 hover:text-red-400" aria-label="Delete shout">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        {shouts.length === 0 && <p className="py-4 text-center text-xs text-white/30">No shouts yet — be the first.</p>}
      </div>
    </Shell>
  );
}

/* ---------- S5 TestimonialBooth ---------- */
interface Testi { id: string; text: string; stars: number; ts: number }
export function TestimonialBooth() {
  const [list, setList] = useLS<Testi[]>("testimonials", []);
  const [text, setText] = useState("");
  const [stars, setStars] = useState(5);
  const [idx, setIdx] = useState(0);
  const save = () => {
    if (!text.trim()) return;
    setList((l) => [...l, { id: Math.random().toString(36).slice(2), text: text.trim(), stars, ts: Date.now() }]);
    setText("");
    setIdx(list.length);
  };
  const cur = list[idx];
  return (
    <Shell icon={Star} title="Testimonial Booth" sub="Record why you believe in ORBITX">
      {/* S5 */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}>
            <Star className={cn("h-5 w-5", n <= stars ? "fill-amber-400 text-amber-400" : "text-white/20")} />
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="ORBITX changed my life because..."
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
      <button onClick={save} className="mt-2 w-full rounded-xl bg-teal-400 py-2 text-sm font-extrabold text-black hover:bg-teal-300">
        Record Testimonial
      </button>
      {cur ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-0.5">
              {Array.from({ length: cur.stars }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setIdx((i) => (i - 1 + list.length) % list.length)} aria-label="Previous"><ChevronLeft className="h-4 w-4 text-white/50" /></button>
              <span className="text-[11px] text-white/40">{idx + 1}/{list.length}</span>
              <button onClick={() => setIdx((i) => (i + 1) % list.length)} aria-label="Next"><ChevronRight className="h-4 w-4 text-white/50" /></button>
            </div>
          </div>
          <p className="mt-1 text-xs italic text-white/80">"{cur.text}"</p>
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-white/30">No testimonials yet.</p>
      )}
    </Shell>
  );
}

/* ---------- S6 AnthemVoting ---------- */
const ANTHEMS = ["🚀 To The Moon", "💎 Diamond Orbit", "🔥 Burn Baby Burn", "🐂 Bull Run Anthem"];
export function AnthemVoting() {
  const [votes, setVotes] = useLS<number[]>("anthem-votes", [0, 0, 0, 0]);
  const [mine, setMine] = useLS<number | null>("anthem-mine", null);
  const total = votes.reduce((a, b) => a + b, 0);
  return (
    <Shell icon={BarChart3} title="Anthem Voting" sub="Pick the community anthem">
      {/* S6 */}
      <div className="space-y-2">
        {ANTHEMS.map((a, i) => {
          const pct = total ? Math.round((votes[i] / total) * 100) : 0;
          return (
            <button key={i} disabled={mine !== null} onClick={() => { setMine(i); setVotes((v) => v.map((x, j) => (j === i ? x + 1 : x))); }}
              className={cn("w-full rounded-xl border p-2.5 text-left transition", mine === i ? "border-teal-300/60 bg-teal-400/10" : "border-white/10 bg-black/30", mine === null && "hover:border-teal-300/40")}>
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{a}</span>
                <span className="tabular-nums text-white/50">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-white/40">
        {mine === null ? "You haven't voted yet — demo votes are stored locally." : `${total} vote${total === 1 ? "" : "s"} · stored on this device`}
      </p>
    </Shell>
  );
}

/* ---------- S7 ReactionBar ---------- */
const FLOAT_CSS = `@keyframes orbitx-float-up{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-90px) scale(1.5)}}@keyframes orbitx-fall{0%{opacity:1;transform:translateY(-10px) rotate(0)}100%{opacity:0;transform:translateY(180px) rotate(300deg)}}`;
const EMOJIS = ["🔥", "🚀", "💎", "🐂", "👀"];
export function ReactionBar() {
  const [counts, setCounts] = useLS<number[]>("reactions", [0, 0, 0, 0, 0]);
  const [floats, setFloats] = useState<{ id: number; e: string; left: number }[]>([]);
  const react = (i: number) => {
    setCounts((c) => c.map((x, j) => (j === i ? x + 1 : x)));
    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, e: EMOJIS[i], left: 10 + Math.random() * 80 }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1000);
  };
  return (
    <Shell icon={Smile} title="Reaction Bar" sub="Smash the reactions">
      {/* S7 */}
      <style>{FLOAT_CSS}</style>
      <div className="relative overflow-hidden rounded-xl bg-black/20 p-3">
        {floats.map((f) => (
          <span key={f.id} className="pointer-events-none absolute bottom-2 text-2xl" style={{ left: `${f.left}%`, animation: "orbitx-float-up 1s ease-out forwards" }}>
            {f.e}
          </span>
        ))}
        <div className="flex justify-around">
          {EMOJIS.map((e, i) => (
            <button key={e} onClick={() => react(i)} className="group relative rounded-xl p-2 transition hover:scale-125 hover:bg-white/10" aria-label={`React ${e}`}>
              <span className="text-3xl">{e}</span>
              <span className="absolute -right-1 -top-1 rounded-full bg-teal-400 px-1.5 text-[10px] font-bold text-black tabular-nums">{counts[i]}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-white/40">{counts.reduce((a, b) => a + b, 0)} total reactions · saved on this device</p>
    </Shell>
  );
}

/* ---------- S8 InviteTracker ---------- */
const TIERS = [
  { name: "Rookie", at: 0 },
  { name: "Hustler", at: 5 },
  { name: "Captain", at: 15 },
  { name: "Legend", at: 30 },
];
export function InviteTracker() {
  const [code, setCode] = useLS("invite-code", "");
  const [invites, setInvites] = useLS("invites", 0);
  if (!code) setCode("ORBIT-" + Math.random().toString(36).slice(2, 8).toUpperCase());
  const tierIdx = TIERS.reduce((acc, t, i) => (invites >= t.at ? i : acc), 0);
  const next = TIERS[tierIdx + 1];
  const prog = next ? Math.min(100, ((invites - TIERS[tierIdx].at) / (next.at - TIERS[tierIdx].at)) * 100) : 100;
  return (
    <Shell icon={UserPlus} title="Invite Tracker" sub="Grow the orbit, climb the tiers">
      {/* S8 */}
      <div className="rounded-xl border border-dashed border-teal-300/40 bg-teal-400/5 p-3 text-center">
        <p className="text-[11px] text-white/40">Your referral code</p>
        <p className="text-xl font-black tracking-widest text-teal-300">{code || "···"}</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-2xl font-black tabular-nums">{invites}</p>
          <p className="text-[11px] text-white/40">invites</p>
        </div>
        <button onClick={() => setInvites((i) => i + 1)} className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20">
          <Plus className="h-3.5 w-3.5" /> +1 (demo)
        </button>
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-[11px] font-bold">
          <span className="text-amber-300">{TIERS[tierIdx].name}</span>
          <span className="text-white/40">{next ? `${invites}/${next.at} → ${next.name}` : "Max tier!"}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all" style={{ width: `${prog}%` }} />
        </div>
      </div>
    </Shell>
  );
}

/* ---------- S9 ShareStreak ---------- */
export function ShareStreak() {
  const [days, setDays] = useLS<string[]>("share-days", []);
  const today = dayKey(new Date());
  const doneToday = days.includes(today);
  const streak = streakOf(days);
  return (
    <Shell icon={Flame} title="Share Streak" sub="Share daily to keep the flame alive">
      {/* S9 */}
      <div className="flex items-center gap-4">
        <span className={cn("text-5xl", streak > 0 ? "" : "opacity-30 grayscale")}>🔥</span>
        <div>
          <p className="text-3xl font-black tabular-nums">{streak}</p>
          <p className="text-[11px] text-white/40">day streak</p>
        </div>
      </div>
      <button
        disabled={doneToday}
        onClick={() => setDays((d) => [...d, today])}
        className={cn("mt-3 w-full rounded-xl py-2 text-sm font-extrabold", doneToday ? "bg-white/10 text-white/40" : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90")}
      >
        {doneToday ? "✓ Shared today" : "I shared ORBITX today"}
      </button>
      <p className="mt-2 text-center text-[11px] text-white/30">Streak days are stored on this device</p>
    </Shell>
  );
}

/* ---------- S10 ViralScore ---------- */
function readNum(key: string): number {
  try {
    const raw = localStorage.getItem(LS + key);
    if (!raw) return 0;
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0) : typeof v === "number" ? v : 0;
  } catch {
    return 0;
  }
}
export function ViralScore() {
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBump((b) => b + 1), 2000);
    return () => clearInterval(t);
  }, []);
  void bump;
  const shares = readNum("share-days");
  const shouts = (() => { try { return (JSON.parse(localStorage.getItem(LS + "shouts") || "[]") as unknown[]).length; } catch { return 0; } })();
  const reactions = readNum("reactions");
  const votes = readNum("anthem-votes");
  const invites = readNum("invites");
  const score = Math.min(100, shares * 6 + shouts * 8 + reactions * 2 + votes * 5 + invites * 6);
  const label = score >= 75 ? "VIRAL" : score >= 40 ? "HEATING UP" : score >= 10 ? "WARMING UP" : "DORMANT";
  return (
    <Shell icon={TrendingUp} title="Viral Score" sub="Your personal virality meter">
      {/* S10 */}
      <div className="flex items-end justify-between">
        <p className="text-4xl font-black tabular-nums text-teal-300">{score}</p>
        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-extrabold", score >= 75 ? "bg-emerald-400/20 text-emerald-300" : score >= 40 ? "bg-amber-400/20 text-amber-300" : "bg-white/10 text-white/40")}>
          {label}
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-teal-400 via-emerald-400 to-amber-300 transition-all duration-1000" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-white/40">Computed live from your local actions: {shares} share-days · {shouts} shouts · {reactions} reactions · {votes} votes · {invites} invites</p>
    </Shell>
  );
}

/* ---------- S11 TweetComposer ---------- */
export function TweetComposer() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const left = 280 - text.length;
  const tags = ["#ORBITX", "#Solana", "#MemeCoin", "#DeFi"];
  return (
    <Shell icon={PenLine} title="Tweet Composer" sub="Draft the perfect shill">
      {/* S11 */}
      <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} rows={4}
        placeholder="What's happening in the orbit?"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-teal-300/50" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button key={t} onClick={() => setText((p) => (p + " " + t).slice(0, 280))} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-teal-300 hover:bg-white/20">
            {t}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className={cn("text-xs font-bold tabular-nums", left < 20 ? "text-red-400" : left < 60 ? "text-amber-300" : "text-white/40")}>{left}</span>
        <button
          onClick={async () => { if (await copyText(text)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
          className="flex items-center gap-1.5 rounded-xl bg-teal-400 px-4 py-2 text-sm font-extrabold text-black hover:bg-teal-300"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy Tweet"}
        </button>
      </div>
    </Shell>
  );
}

/* ---------- S12 CopyTemplates ---------- */
const QUICK_LINES = [
  "Just bought more $ORBITX. Not financial advice, just conviction. 🚀",
  "Contract: 13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9",
  "$ORBITX chart looking primed. Watching closely. 👀",
  "The orbit grows every day. Are you in? #ORBITX",
  "Diamond hands only. 💎🙌 $ORBITX",
  "orbitx.world — go see for yourself.",
];
export function CopyTemplates() {
  const [copied, setCopied] = useState<number | null>(null);
  return (
    <Shell icon={Copy} title="Copy Templates" sub="One-click shill lines">
      {/* S12 */}
      <div className="grid gap-1.5">
        {QUICK_LINES.map((l, i) => (
          <button key={i}
            onClick={async () => { if (await copyText(l)) { setCopied(i); setTimeout(() => setCopied(null), 1200); } }}
            className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-3 py-2 text-left text-xs text-white/70 transition hover:bg-black/50 hover:text-white"
          >
            <span className="truncate">{l}</span>
            {copied === i ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 shrink-0 text-white/30" />}
          </button>
        ))}
      </div>
    </Shell>
  );
}

/* ---------- S13 RaidLeaderboard ---------- */
const FAKE_RAIDERS: [string, number][] = [
  ["OrbitWhale", 42], ["MoonBoyz", 37], ["DegenDana", 31], ["SolSniper", 24], ["ChartChad", 18],
];
export function RaidLeaderboard() {
  const [joins] = useLS<string[]>("raid-parts", []);
  const youCount = Math.max(joins.length, (() => { try { return parseInt(localStorage.getItem(LS + "raid-joins-count") || "0", 10) || 0; } catch { return 0; } })());
  const rows = [...FAKE_RAIDERS.map(([n, c]) => ({ name: n, count: c, you: false })), { name: "You", count: youCount, you: true }]
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  return (
    <Shell icon={Trophy} title="Raid Leaderboard" sub="Top raiders this week">
      {/* S13 */}
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={r.name} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs", r.you ? "border border-teal-300/40 bg-teal-400/10 font-bold" : "bg-black/30")}>
            <span className={cn("w-5 text-center font-black tabular-nums", i === 0 ? "text-amber-300" : i === 1 ? "text-white/70" : i === 2 ? "text-orange-400" : "text-white/30")}>
              {i + 1}
            </span>
            <span className="flex-1">{r.name}</span>
            <span className="tabular-nums text-white/60">{r.count} raids</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-white/30">Names are demo placeholders · "You" counts your raid joins</p>
    </Shell>
  );
}

/* ---------- S14 ShillOfTheDay ---------- */
const DAILY_SHILLS = [
  "🌅 GM orbit fam! Another day, another chance to accumulate $ORBITX before the world wakes up.",
  "📊 The $ORBITX chart is coiling like a spring. Patience pays the patient. #ORBITX",
  "🤝 Community is the real utility. 660+ strong on X and growing daily. Join the orbit.",
  "🔥 Burn check: supply keeps shrinking while conviction keeps growing. $ORBITX",
  "💎 They laughed at diamond hands until the hands started printing. $ORBITX",
  "🚀 Every dip is just a discount the market hands to the brave. $ORBITX",
  "🧠 DYOR, then ape responsibly. orbitx.world has everything you need.",
];
export function ShillOfTheDay() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const shill = DAILY_SHILLS[dayOfYear % DAILY_SHILLS.length];
  const [copied, setCopied] = useState(false);
  return (
    <Shell icon={Sparkles} title="Shill of the Day" sub={now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}>
      {/* S14 */}
      <div className="rounded-xl border border-amber-300/30 bg-amber-400/5 p-3">
        <p className="text-sm leading-relaxed text-white/85">{shill}</p>
      </div>
      <button
        onClick={async () => { if (await copyText(shill)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2 text-sm font-extrabold text-black hover:bg-amber-300"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy Today's Shill"}
      </button>
      <p className="mt-1.5 text-center text-[11px] text-white/30">Deterministic — same pick all day, new one tomorrow</p>
    </Shell>
  );
}

/* ---------- S15 EmojiRain ---------- */
const RAIN_EMOJIS = ["🚀", "🔥", "💎", "🌙", "🐂", "💰", "⚡", "👀"];
export function EmojiRain() {
  const [drops, setDrops] = useState<{ id: number; e: string; left: number; delay: number }[]>([]);
  const raining = drops.length > 0;
  const start = () => {
    const ds = Array.from({ length: 24 }, (_, i) => ({
      id: Date.now() + i,
      e: RAIN_EMOJIS[Math.floor(Math.random() * RAIN_EMOJIS.length)],
      left: Math.random() * 95,
      delay: Math.random() * 0.8,
    }));
    setDrops(ds);
    setTimeout(() => setDrops([]), 3000);
  };
  return (
    <Shell icon={CloudRain} title="Emoji Rain" sub="Make it rain, degen">
      {/* S15 */}
      <style>{FLOAT_CSS}</style>
      <div className="relative h-40 overflow-hidden rounded-xl bg-black/20">
        {drops.map((d) => (
          <span key={d.id} className="absolute top-0 text-2xl" style={{ left: `${d.left}%`, animation: `orbitx-fall 1.8s ease-in ${d.delay}s forwards` }}>
            {d.e}
          </span>
        ))}
        {!raining && <p className="absolute inset-0 flex items-center justify-center text-xs text-white/30">Hit the button. Trust.</p>}
      </div>
      <button onClick={start} disabled={raining} className="mt-2 w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 py-2.5 text-sm font-extrabold text-white transition hover:opacity-90 disabled:opacity-50">
        {raining ? "🌧 Raining..." : "🌧 Trigger Emoji Rain"}
      </button>
    </Shell>
  );
}

/* ---------- S16 HashtagTracker ---------- */
export function HashtagTracker() {
  const [tags, setTags] = useLS<Record<string, number>>("hashtags", {});
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim().replace(/^#+/, "");
    if (!t) return;
    setTags((p) => ({ ...p, ["#" + t]: (p["#" + t] || 0) + 1 }));
    setInput("");
  };
  const sorted = Object.entries(tags).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  return (
    <Shell icon={Hash} title="Hashtag Tracker" sub="Log every hashtag you deploy">
      {/* S16 */}
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="#ORBITX"
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
        <button onClick={add} className="rounded-lg bg-teal-400 px-3 text-black hover:bg-teal-300" aria-label="Add hashtag"><Plus className="h-4 w-4" /></button>
      </div>
      {top && (
        <div className="mt-2 rounded-xl border border-amber-300/30 bg-amber-400/5 p-2.5 text-center">
          <p className="text-[11px] text-white/40">Most used</p>
          <p className="text-lg font-black text-amber-300">{top[0]} <span className="text-sm text-white/50">×{top[1]}</span></p>
        </div>
      )}
      <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
        {sorted.map(([t, c]) => (
          <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/70">{t} <span className="text-teal-300">{c}</span></span>
        ))}
        {sorted.length === 0 && <p className="w-full py-2 text-center text-xs text-white/30">No hashtags tracked yet.</p>}
      </div>
    </Shell>
  );
}

/* ---------- S17 SocialMilestones ---------- */
export function SocialMilestones() {
  const [shareDays] = useLS<string[]>("share-days", []);
  const [shouts] = useLS<Shout[]>("shouts", []);
  const [reactions] = useLS<number[]>("reactions", [0, 0, 0, 0, 0]);
  const [invites] = useLS("invites", 0);
  const [votes] = useLS<number[]>("anthem-votes", [0, 0, 0, 0, 0]);
  const [mine] = useLS<number | null>("anthem-mine", null);
  const streak = streakOf(shareDays);
  const ms = [
    { label: "First share", done: shareDays.length >= 1 },
    { label: "5 shouts on the wall", done: shouts.length >= 5 },
    { label: "10 reactions smashed", done: reactions.reduce((a, b) => a + b, 0) >= 10 },
    { label: "Vote for the anthem", done: mine !== null || votes.reduce((a, b) => a + b, 0) > 0 },
    { label: "First invite", done: invites >= 1 },
    { label: "3-day share streak", done: streak >= 3 },
  ];
  const doneCount = ms.filter((m) => m.done).length;
  return (
    <Shell icon={Flag} title="Social Milestones" sub={`${doneCount}/${ms.length} unlocked`}>
      {/* S17 */}
      <div className="space-y-1.5">
        {ms.map((m) => (
          <div key={m.label} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs", m.done ? "bg-emerald-400/10 text-white/80" : "bg-black/30 text-white/40")}>
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border", m.done ? "border-emerald-400 bg-emerald-400/30" : "border-white/20")}>
              {m.done && <Check className="h-3 w-3 text-emerald-300" />}
            </span>
            <span className={cn(m.done && "font-bold")}>{m.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all" style={{ width: `${(doneCount / ms.length) * 100}%` }} />
      </div>
    </Shell>
  );
}

/* ---------- S18 ReferralCard ---------- */
export function ReferralCard() {
  const [name, setName] = useLS("refcard-name", "OrbitFan");
  const [code] = useLS("invite-code", "ORBIT-XXXX");
  const [invites] = useLS("invites", 0);
  const [copied, setCopied] = useState(false);
  const card = `🚀 ${name} invites you to the ORBITX orbit!\nUse code ${code} at orbitx.world\n${invites} people already joined via this link.\n#ORBITX #Solana`;
  return (
    <Shell icon={Share2} title="Referral Card" sub="Your shareable invite card">
      {/* S18 */}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your display name"
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
      <div className="mt-2 rounded-xl border border-teal-300/30 bg-gradient-to-br from-teal-500/15 to-emerald-500/5 p-4">
        <p className="text-lg font-black">🚀 {name || "OrbitFan"}</p>
        <p className="text-xs text-white/60">invites you to the ORBITX orbit</p>
        <p className="mt-2 inline-block rounded-lg bg-black/40 px-2.5 py-1 font-mono text-sm font-bold tracking-widest text-teal-300">{code}</p>
        <p className="mt-2 text-[11px] text-white/40">{invites} joined via this link · orbitx.world</p>
      </div>
      <button
        onClick={async () => { if (await copyText(card)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 py-2 text-sm font-extrabold text-black hover:bg-teal-300"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy Card Text"}
      </button>
    </Shell>
  );
}

/* ---------- S19 HypeMeter ---------- */
interface HypeVote { id: string; v: number }
export function HypeMeter() {
  const [votes, setVotes] = useLS<HypeVote[]>("hype-votes", []);
  const [val, setVal] = useState(7);
  const myId = useMyId();
  const avg = votes.length ? (votes.reduce((a, b) => a + b.v, 0) / votes.length).toFixed(1) : "—";
  const mine = votes.find((x) => x.id === myId)?.v;
  const submit = () => setVotes((v) => {
    const rest = v.filter((x) => x.id !== myId);
    return [...rest, { id: myId, v: val }];
  });
  return (
    <Shell icon={Gauge} title="Hype Meter" sub="How hyped are you, 1–10?">
      {/* S19 */}
      <div className="text-center">
        <p className="text-5xl font-black tabular-nums text-orange-400">{mine ?? val}</p>
        <input type="range" min={1} max={10} value={val} onChange={(e) => setVal(Number(e.target.value))}
          className="mt-2 w-full accent-orange-400" aria-label="Hype level" />
        <div className="flex justify-between text-[10px] text-white/40"><span>1 · meh</span><span>10 · MAXIMUM</span></div>
      </div>
      <button onClick={submit} className="mt-2 w-full rounded-xl bg-orange-500 py-2 text-sm font-extrabold text-white hover:bg-orange-400">
        {mine ? "Update My Hype" : "Submit Hype"}
      </button>
      <p className="mt-2 text-center text-xs text-white/50">Community avg: <span className="font-black text-orange-300">{avg}</span> · {votes.length} vote{votes.length === 1 ? "" : "s"}</p>
    </Shell>
  );
}

/* ---------- S20 ContentCalendar ---------- */
export function ContentCalendar() {
  const [posted, setPosted] = useLS<string[]>("posted-days", []);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const toggle = (k: string) => setPosted((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const streak = streakOf(posted);
  return (
    <Shell icon={CalendarDays} title="Content Calendar" sub="Tap a day to mark it posted">
      {/* S20 */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const k = dayKey(d);
          const on = posted.includes(k);
          const isToday = k === dayKey(new Date());
          return (
            <button key={k} onClick={() => toggle(k)}
              className={cn("rounded-lg border py-2 text-center transition",
                on ? "border-emerald-400/50 bg-emerald-400/20" : "border-white/10 bg-black/30 hover:border-white/30",
                isToday && "ring-1 ring-teal-300")}>
              <p className="text-[9px] uppercase text-white/40">{d.toLocaleDateString(undefined, { weekday: "narrow" })}</p>
              <p className="text-xs font-black tabular-nums">{d.getDate()}</p>
              {on && <Check className="mx-auto h-3 w-3 text-emerald-300" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-white/50">🔥 <span className="font-black text-orange-300">{streak}</span> day posting streak</p>
    </Shell>
  );
}

/* ---------- S21 MemeContest ---------- */
interface Entry { id: string; desc: string; votes: number; ts: number }
export function MemeContest() {
  const [entries, setEntries] = useLS<Entry[]>("meme-entries", []);
  const [voted, setVoted] = useLS<string[]>("meme-voted", []);
  const [desc, setDesc] = useState("");
  const submit = () => {
    if (!desc.trim()) return;
    setEntries((e) => [...e, { id: Math.random().toString(36).slice(2), desc: desc.trim(), votes: 0, ts: Date.now() }]);
    setDesc("");
  };
  const vote = (id: string) => {
    if (voted.includes(id)) return;
    setVoted((v) => [...v, id]);
    setEntries((e) => e.map((x) => (x.id === id ? { ...x, votes: x.votes + 1 } : x)));
  };
  const sorted = [...entries].sort((a, b) => b.votes - a.votes);
  return (
    <Shell icon={Crown} title="Meme Contest" sub="Weekly meme battle — one vote each">
      {/* S21 */}
      <div className="flex gap-2">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Describe your meme idea..."
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
        <button onClick={submit} className="rounded-lg bg-teal-400 px-3 text-black hover:bg-teal-300" aria-label="Submit entry"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
        {sorted.map((e, i) => (
          <div key={e.id} className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs", i === 0 && e.votes > 0 ? "border border-amber-300/40 bg-amber-400/10" : "bg-black/30")}>
            {i === 0 && e.votes > 0 && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" />}
            <span className="flex-1">{e.desc}</span>
            <span className="tabular-nums text-white/50">{e.votes}</span>
            <button onClick={() => vote(e.id)} disabled={voted.includes(e.id)}
              className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", voted.includes(e.id) ? "bg-white/10 text-white/40" : "bg-teal-400/20 text-teal-300 hover:bg-teal-400/30")}>
              {voted.includes(e.id) ? "Voted" : "Vote"}
            </button>
          </div>
        ))}
        {entries.length === 0 && <p className="py-3 text-center text-xs text-white/30">No entries yet — submit the first meme.</p>}
      </div>
      {sorted[0]?.votes > 0 && <p className="mt-1.5 text-center text-[11px] text-amber-300/80">👑 Weekly leader: "{sorted[0].desc.slice(0, 40)}"</p>}
    </Shell>
  );
}

/* ---------- S22 ShillBingo ---------- */
const BINGO_PHRASES = [
  "To the moon", "Diamond hands", "ATH incoming", "Just bought more", "Not financial advice",
  "Bullish AF", "Burn baby burn", "Orbit fam", "GM", "WAGMI",
  "HODL", "Ape in", "Chart looks primed", "Supply shock", "Community strong",
  "Dips are discounts", "LFG", "Send it", "Paper hands out", "Conviction play",
  "CEX soon", "Narrative forming", "Early still", "Trust the orbit", "Moon o'clock",
];
export function ShillBingo() {
  const [marked, setMarked] = useLS<number[]>("bingo-marked", []);
  const toggle = (i: number) => setMarked((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]));
  const set = new Set(marked);
  const lines: number[][] = [];
  for (let r = 0; r < 5; r++) lines.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) lines.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  const bingo = lines.some((l) => l.every((i) => set.has(i)));
  return (
    <Shell icon={LayoutGrid} title="Shill Bingo" sub="Mark phrases as you hear them">
      {/* S22 */}
      {bingo && (
        <div className="mb-2 rounded-xl border border-amber-300/50 bg-amber-400/15 p-2.5 text-center">
          <p className="text-sm font-black text-amber-300">🎉 BINGO! Certified shill lord 🎉</p>
        </div>
      )}
      <div className="grid grid-cols-5 gap-1.5">
        {BINGO_PHRASES.map((p, i) => (
          <button key={i} onClick={() => toggle(i)}
            className={cn("flex min-h-[3.25rem] items-center justify-center rounded-lg border p-1 text-center text-[9px] font-bold leading-tight transition",
              marked.includes(i) ? "border-teal-300/60 bg-teal-400/25 text-teal-200" : "border-white/10 bg-black/30 text-white/60 hover:border-white/30")}>
            {p}
          </button>
        ))}
      </div>
      <button onClick={() => setMarked([])} className="mt-2 w-full rounded-lg bg-white/10 py-1.5 text-xs font-bold text-white/60 hover:bg-white/20">
        Reset Card
      </button>
    </Shell>
  );
}

/* ---------- S23 TweetScheduler ---------- */
interface Scheduled { id: string; text: string; hour: number; ts: number }
export function TweetScheduler() {
  const [queue, setQueue] = useLS<Scheduled[]>("tweet-queue", []);
  const [text, setText] = useState("");
  const [hour, setHour] = useState(12);
  const save = () => {
    if (!text.trim()) return;
    setQueue((q) => [...q, { id: Math.random().toString(36).slice(2), text: text.trim(), hour, ts: Date.now() }].sort((a, b) => a.hour - b.hour));
    setText("");
  };
  return (
    <Shell icon={Clock} title="Tweet Scheduler" sub="Queue tweets for the perfect hour">
      {/* S23 */}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write your tweet..."
        className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
      <div className="mt-2 flex gap-2">
        <select value={hour} onChange={(e) => setHour(Number(e.target.value))}
          className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs outline-none">
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
          ))}
        </select>
        <button onClick={save} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-400 py-2 text-sm font-extrabold text-black hover:bg-teal-300">
          <Plus className="h-4 w-4" /> Schedule
        </button>
      </div>
      <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto">
        {queue.map((q) => (
          <div key={q.id} className="flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-2 text-xs">
            <span className="rounded bg-teal-400/20 px-1.5 py-0.5 font-mono font-bold text-teal-300">{String(q.hour).padStart(2, "0")}:00</span>
            <span className="flex-1 truncate text-white/70">{q.text}</span>
            <button onClick={() => setQueue((p) => p.filter((x) => x.id !== q.id))} className="text-white/30 hover:text-red-400" aria-label="Delete scheduled tweet">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {queue.length === 0 && <p className="py-2 text-center text-xs text-white/30">Queue is empty.</p>}
      </div>
      <p className="mt-1.5 text-center text-[11px] text-white/30">Reminder list only — posting happens in your X app</p>
    </Shell>
  );
}

/* ---------- S24 EngagementPods ---------- */
interface Pod { id: string; name: string; members: string[]; links: string[] }
export function EngagementPods() {
  const [pods, setPods] = useLS<Pod[]>("pods", []);
  const [name, setName] = useState("");
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});
  const myId = useMyId();
  const create = () => {
    if (!name.trim()) return;
    setPods((p) => [...p, { id: Math.random().toString(36).slice(2), name: name.trim(), members: [myId], links: [] }]);
    setName("");
  };
  const join = (id: string) => setPods((p) => p.map((x) => (x.id === id && !x.members.includes(myId) ? { ...x, members: [...x.members, myId] } : x)));
  const dropLink = (id: string) => {
    const l = (linkInputs[id] || "").trim();
    if (!l) return;
    setPods((p) => p.map((x) => (x.id === id ? { ...x, links: [...x.links.slice(-9), l] } : x)));
    setLinkInputs((s) => ({ ...s, [id]: "" }));
  };
  return (
    <Shell icon={Users} title="Engagement Pods" sub="Squads that like + reply together">
      {/* S24 */}
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="New pod name..."
          className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs outline-none focus:border-teal-300/50" />
        <button onClick={create} className="flex items-center gap-1 rounded-lg bg-teal-400 px-3 text-xs font-extrabold text-black hover:bg-teal-300">
          <Plus className="h-4 w-4" /> Create
        </button>
      </div>
      <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
        {pods.map((pod) => (
          <div key={pod.id} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold">{pod.name}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white/40">{pod.members.length} member{pod.members.length === 1 ? "" : "s"}</span>
                {pod.members.includes(myId) ? (
                  <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">In pod</span>
                ) : (
                  <button onClick={() => join(pod.id)} className="rounded-full bg-teal-400/20 px-2 py-0.5 text-[10px] font-bold text-teal-300 hover:bg-teal-400/30">Join</button>
                )}
              </div>
            </div>
            <div className="mt-1.5 flex gap-1.5">
              <input value={linkInputs[pod.id] || ""} onChange={(e) => setLinkInputs((s) => ({ ...s, [pod.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && dropLink(pod.id)}
                placeholder="Drop a post link for the pod..."
                className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] outline-none focus:border-teal-300/50" />
              <button onClick={() => dropLink(pod.id)} className="rounded-lg bg-white/10 px-2.5 text-[11px] font-bold hover:bg-white/20">Drop</button>
            </div>
            {pod.links.length > 0 && (
              <p className="mt-1.5 truncate text-[11px] text-teal-300/80">🔗 {pod.links[pod.links.length - 1]}</p>
            )}
          </div>
        ))}
        {pods.length === 0 && <p className="py-3 text-center text-xs text-white/30">No pods yet — start one.</p>}
      </div>
    </Shell>
  );
}

/* ---------- S25 ViralLoop ---------- */
export function ViralLoop() {
  const [shareDays] = useLS<string[]>("share-days", []);
  const [invites] = useLS("invites", 0);
  const [shouts] = useLS<Shout[]>("shouts", []);
  const [reactions] = useLS<number[]>("reactions", [0, 0, 0, 0, 0]);
  const steps = [
    { icon: Share2, label: "Share", desc: "Post ORBITX daily", count: shareDays.length, goal: 7 },
    { icon: Zap, label: "Earn", desc: "Reactions earned", count: reactions.reduce((a, b) => a + b, 0), goal: 25 },
    { icon: UserPlus, label: "Invite", desc: "Bring friends in", count: invites, goal: 5 },
    { icon: Repeat, label: "Repeat", desc: "Shouts on the wall", count: shouts.length, goal: 10 },
  ];
  return (
    <Shell icon={Repeat} title="Viral Loop" sub="The flywheel that grows the orbit">
      {/* S25 */}
      <div className="grid grid-cols-4 gap-1.5">
        {steps.map((s, i) => {
          const pct = Math.min(100, (s.count / s.goal) * 100);
          return (
            <div key={s.label} className="relative rounded-xl border border-white/10 bg-black/30 p-2 text-center">
              {i < 3 && <span className="absolute -right-2.5 top-1/2 z-10 -translate-y-1/2 text-teal-300/60">→</span>}
              <s.icon className="mx-auto h-4 w-4 text-teal-300" />
              <p className="mt-1 text-[10px] font-extrabold">{s.label}</p>
              <p className="text-sm font-black tabular-nums">{s.count}<span className="text-[10px] font-normal text-white/40">/{s.goal}</span></p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-teal-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-white/40">Progress reads live from your other widgets — complete the loop!</p>
    </Shell>
  );
}
