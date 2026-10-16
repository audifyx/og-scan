import { useEffect, useMemo, useRef, useState } from "react";
import {
  TrendingUp, Cake, Gamepad2, Hand, Lightbulb, ThumbsUp,
  Award, Heart, Siren, Flame, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LS = (k: string) => `orbitx-fun-${k}`;
const INITIAL_SUPPLY = 1_000_000_000;
const LAUNCH_PRICE = 0.0000032;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function write(key: string, val: unknown) {
  try { localStorage.setItem(LS(key), JSON.stringify(val)); } catch { /* ignore */ }
}
function fmtUsd(n: number): string {
  if (!isFinite(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}
function Shell({ icon: Icon, title, sub, children }: {
  icon: React.ComponentType<{ className?: string }>; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-fuchsia-400/15 text-fuchsia-300">
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

/* ---------------- 1. Regret calculator ---------------- */
function damageFor(mult: number): string {
  if (mult < 1) return "You dodged a bullet. Barely.";
  if (mult < 2) return "Mild tingling. You'll survive.";
  if (mult < 5) return "Noticeable sting. Ice helps.";
  if (mult < 10) return "Significant emotional damage.";
  if (mult < 50) return "You need to sit down.";
  if (mult < 100) return "Devastating. Tell your therapist.";
  return "CATASTROPHIC. You could have retired. I'm so sorry.";
}
export function RegretCalculator({ price }: { price: number | null | undefined }) {
  const [usd, setUsd] = useState("100");
  const amt = parseFloat(usd);
  const valid = isFinite(amt) && amt > 0 && price != null && price > 0;
  const now = valid ? (amt / LAUNCH_PRICE) * (price as number) : 0;
  const mult = valid && amt > 0 ? now / amt : 0;
  return (
    <Shell icon={TrendingUp} title="Regret calculator" sub="What if you bought at launch?">
      <div className="flex gap-2">
        <input value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" placeholder="100"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white placeholder:text-white/25 focus:border-fuchsia-300/40 focus:outline-none" />
        <span className="flex items-center rounded-xl bg-white/[0.05] px-3 text-xs font-bold text-white/50">USD</span>
      </div>
      {valid && (
        <div className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-center">
          <p className="text-2xl font-black text-fuchsia-300">{fmtUsd(now)}</p>
          <p className="text-xs text-white/50">{mult.toFixed(1)}x your money</p>
          <p className="mt-1 text-[11px] italic text-white/40">{damageFor(mult)}</p>
        </div>
      )}
    </Shell>
  );
}

/* ---------------- 2. Token age ---------------- */
const GENESIS = Date.UTC(2026, 8, 1, 0, 0, 0);
export function TokenAge() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - GENESIS) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (
    <Shell icon={Cake} title="Token age" sub="ORBITX has existed for">
      <p className="text-center font-mono text-xl font-black tabular-nums text-teal-200">
        {d}d {h}h {m}m {sec}s <span className="text-sm text-white/40">old</span>
      </p>
    </Shell>
  );
}

/* ---------------- 3. Konami code ---------------- */
const SEQ = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
export function KonamiCode({ onTrigger }: { onTrigger: () => void }) {
  const pos = useRef(0);
  const taps = useRef(0);
  const tapTimer = useRef(0);
  const cb = useRef(onTrigger);
  cb.current = onTrigger;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      pos.current = k === SEQ[pos.current] ? pos.current + 1 : (k === SEQ[0] ? 1 : 0);
      if (pos.current === SEQ.length) { pos.current = 0; cb.current(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const tap = () => {
    window.clearTimeout(tapTimer.current);
    taps.current += 1;
    if (taps.current >= 5) { taps.current = 0; cb.current(); return; }
    tapTimer.current = window.setTimeout(() => { taps.current = 0; }, 2000);
  };
  return (
    <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="flex items-center gap-2 text-xs font-bold text-white/50">
        <Gamepad2 className="h-4 w-4" /> Psst — something's hidden here…
      </span>
      <button onClick={tap} aria-label="easter egg"
        className="h-3 w-3 rounded-full bg-white/15 transition hover:bg-fuchsia-400/60 active:scale-125" />
    </div>
  );
}

/* ---------------- 4. Do not press ---------------- */
const PRESS_MSGS = [
  "Seriously?",
  "I told you not to.",
  "This is why we can't have nice things.",
  "Stop. Just… stop.",
  "I'm telling everyone.",
  "Wow. Okay. Commitment. I respect it.",
  "Orbit has officially given up on you.",
  "The button is tired. Let it rest.",
];
export function DoNotPress() {
  const [count, setCount] = useState(() => read<number>("do-not-press", 0));
  const press = () => {
    const n = count + 1;
    setCount(n);
    write("do-not-press", n);
  };
  const msg = count === 0 ? "Go on. You know you want to."
    : count <= PRESS_MSGS.length ? PRESS_MSGS[count - 1]
    : `${count} presses. Orbit has left the chat.`;
  return (
    <Shell icon={Hand} title="Mystery button" sub="Definitely nothing happens">
      <button onClick={press}
        className="w-full rounded-2xl border-b-4 border-red-800 bg-gradient-to-b from-red-500 to-red-600 py-4 text-lg font-black uppercase tracking-widest text-white shadow-[0_6px_20px_rgba(239,68,68,0.4)] transition active:translate-y-1 active:border-b-0">
        Do not press
      </button>
      <p className="mt-2 text-center text-xs italic text-white/50">
        {count > 0 && <span className="mr-1 rounded-full bg-white/10 px-2 py-0.5 font-bold not-italic">{count}</span>}
        “{msg}” — Orbit
      </p>
    </Shell>
  );
}

/* ---------------- 5. Suggestion box ---------------- */
interface Idea { id: string; text: string; votes: number; }
export function SuggestionBox() {
  const [ideas, setIdeas] = useState<Idea[]>(() => read<Idea[]>("ideas", []));
  const [voted, setVoted] = useState<string[]>(() => read<string[]>("ideas-voted", []));
  const [draft, setDraft] = useState("");
  const save = (next: Idea[]) => { setIdeas(next); write("ideas", next); };
  const add = () => {
    const t = draft.trim().slice(0, 120);
    if (!t) return;
    const id = `${Date.now()}`;
    save([{ id, text: t, votes: 1 }, ...ideas]);
    setVoted((v) => { const n = [...v, id]; write("ideas-voted", n); return n; });
    setDraft("");
  };
  const upvote = (id: string) => {
    if (voted.includes(id)) return;
    save(ideas.map((i) => (i.id === id ? { ...i, votes: i.votes + 1 } : i)));
    setVoted((v) => { const n = [...v, id]; write("ideas-voted", n); return n; });
  };
  const top = useMemo(() => [...ideas].sort((a, b) => b.votes - a.votes).slice(0, 5), [ideas]);
  return (
    <Shell icon={Lightbulb} title="Suggestion box" sub="Vote the next crazy feature">
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your wildest idea…"
          maxLength={120} onKeyDown={(e) => e.key === "Enter" && add()}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-amber-300/40 focus:outline-none" />
        <button onClick={add} className="rounded-xl bg-amber-400/20 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/30">Add</button>
      </div>
      <div className="mt-2 space-y-1.5">
        {top.length === 0 && <p className="py-2 text-center text-xs text-white/30">No ideas yet. Be the first degenerate.</p>}
        {top.map((i, idx) => (
          <div key={i.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
            <span className="text-xs font-black text-amber-300">#{idx + 1}</span>
            <p className="min-w-0 flex-1 truncate text-xs text-white/75">{i.text}</p>
            <button onClick={() => upvote(i.id)} disabled={voted.includes(i.id)}
              className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold",
                voted.includes(i.id) ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-white/60 hover:bg-white/15")}>
              <ThumbsUp className="h-3 w-3" />{i.votes}
            </button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ---------------- 6. Badges ---------------- */
export interface BadgeDef { id: string; name: string; desc: string; emoji: string; }
export const BADGE_DEFS: BadgeDef[] = [
  { id: "first-visit", name: "First Visit", desc: "You showed up", emoji: "👋" },
  { id: "diamond-week", name: "Diamond Week", desc: "7 days in orbit", emoji: "💠" },
  { id: "diamond-month", name: "Diamond Month", desc: "30 days in orbit", emoji: "💎" },
  { id: "early-adopter", name: "Early Adopter", desc: "Here in week one of October", emoji: "🌱" },
  { id: "night-owl", name: "Night Owl", desc: "Visited between 12–5am", emoji: "🦉" },
  { id: "shiller", name: "Shiller", desc: "Shared ORBITX", emoji: "📢" },
  { id: "alert-setter", name: "Alert Setter", desc: "Set a price alert", emoji: "🔔" },
  { id: "konami-master", name: "Konami Master", desc: "Cracked the code", emoji: "🎮" },
];
export function unlockBadge(id: string) {
  const cur = read<string[]>("badges", []);
  if (cur.includes(id)) return;
  const next = [...cur, id];
  write("badges", next);
  window.dispatchEvent(new CustomEvent<string>("orbitx-badge-unlocked", { detail: id }));
}
function firstSeen(): number | null {
  try {
    const raw = localStorage.getItem("orbitx-avatar-memory-v1");
    return raw ? (JSON.parse(raw).firstSeen ?? null) : null;
  } catch { return null; }
}
export function Badges() {
  const [unlocked, setUnlocked] = useState<string[]>(() => read<string[]>("badges", []));
  useEffect(() => {
    const grant = (id: string) => setUnlocked((u) => {
      if (u.includes(id)) return u;
      unlockBadge(id);
      return [...u, id];
    });
    grant("first-visit");
    const fs = firstSeen();
    if (fs) {
      const days = (Date.now() - fs) / 86400000;
      if (days >= 7) grant("diamond-week");
      if (days >= 30) grant("diamond-month");
      const oct1 = Date.UTC(2026, 9, 1), oct8 = Date.UTC(2026, 9, 8);
      if (fs >= oct1 && fs < oct8) grant("early-adopter");
    }
    const hr = new Date().getHours();
    if (hr >= 0 && hr < 5) grant("night-owl");
    const onEvt = (id: string) => () => grant(id);
    const shared = onEvt("shiller"), alerted = onEvt("alert-setter"), konami = onEvt("konami-master");
    const synced = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setUnlocked((u) => (u.includes(id) ? u : [...u, id]));
    };
    window.addEventListener("orbitx-shared", shared);
    window.addEventListener("orbitx-alert-set", alerted);
    window.addEventListener("orbitx-konami", konami);
    window.addEventListener("orbitx-badge-unlocked", synced);
    return () => {
      window.removeEventListener("orbitx-shared", shared);
      window.removeEventListener("orbitx-alert-set", alerted);
      window.removeEventListener("orbitx-konami", konami);
      window.removeEventListener("orbitx-badge-unlocked", synced);
    };
  }, []);
  return (
    <Shell icon={Award} title="Achievements" sub={`${unlocked.length}/${BADGE_DEFS.length} unlocked`}>
      <div className="grid grid-cols-4 gap-2">
        {BADGE_DEFS.map((b) => {
          const has = unlocked.includes(b.id);
          return (
            <div key={b.id} title={`${b.name} — ${b.desc}`}
              className={cn("flex flex-col items-center rounded-2xl border p-2 text-center transition",
                has ? "border-amber-300/40 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                    : "border-white/10 bg-black/30 opacity-40 grayscale")}>
              <span className="text-2xl">{has ? b.emoji : "🔒"}</span>
              <p className="mt-1 text-[9px] font-bold leading-tight text-white/70">{b.name}</p>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ---------------- 7. Tamagotchi ---------------- */
export function Tamagotchi({ buyCount }: { buyCount: number }) {
  const [decay, setDecay] = useState(0);
  const prev = useRef(buyCount);
  useEffect(() => {
    if (buyCount > prev.current) setDecay(0);
    prev.current = buyCount;
  }, [buyCount]);
  useEffect(() => {
    const id = setInterval(() => setDecay((d) => d + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const happy = Math.max(0, Math.min(100, 20 + buyCount * 8 - decay));
  const face = happy < 30 ? "😭" : happy < 60 ? "😐" : happy < 85 ? "🙂" : "🤩";
  const status = happy < 30 ? "Starving for buys…" : happy < 60 ? "A little peckish" : happy < 85 ? "Feeling good" : "ABSOLUTELY THRIVING";
  return (
    <Shell icon={Heart} title="Orbit's mood" sub="Feed him buys to keep him happy">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{face}</span>
        <div className="flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div className={cn("h-full rounded-full transition-all duration-1000",
              happy < 30 ? "bg-red-500" : happy < 60 ? "bg-amber-400" : "bg-gradient-to-r from-teal-400 to-emerald-400")}
              style={{ width: `${happy}%` }} />
          </div>
          <p className="mt-1 text-[11px] font-bold text-white/60">{status} · {happy}/100</p>
        </div>
      </div>
    </Shell>
  );
}

/* ---------------- 8. Whale siren ---------------- */
export function WhaleSiren({ lastBigBuy }: { lastBigBuy: { amountUsd: number; time: number } | null }) {
  const [show, setShow] = useState(false);
  const seen = useRef<number>(read<number>("whale-last", 0));
  useEffect(() => {
    if (!lastBigBuy || lastBigBuy.amountUsd < 5000 || lastBigBuy.time <= seen.current) return;
    seen.current = lastBigBuy.time;
    write("whale-last", lastBigBuy.time);
    setShow(true);
    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
  }, [lastBigBuy]);
  if (!show || !lastBigBuy) return null;
  return (
    <div className="animate-pulse rounded-3xl border-2 border-red-400/60 bg-gradient-to-r from-red-600/30 via-red-500/20 to-red-600/30 p-4 text-center shadow-[0_0_30px_rgba(239,68,68,0.5)]">
      <p className="text-2xl">🚨🐋🚨</p>
      <p className="mt-1 text-sm font-black uppercase tracking-widest text-red-200">Whale alert</p>
      <p className="text-xs font-bold text-white/70">{fmtUsd(lastBigBuy.amountUsd)} buy just hit the pool</p>
    </div>
  );
}

/* ---------------- 9. Supply countdown ---------------- */
export function SupplyCountdown({ burned }: { burned: number | null }) {
  const remaining = INITIAL_SUPPLY - (burned ?? 0);
  const [disp, setDisp] = useState(remaining);
  const ref = useRef(remaining);
  useEffect(() => {
    const from = ref.current, to = remaining, start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
      ref.current = v;
      setDisp(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [remaining]);
  const pct = Math.min(100, ((burned ?? 0) / 500_000_000) * 100);
  return (
    <Shell icon={Flame} title="Supply countdown" sub="Every burn shrinks the pie">
      <p className="text-center font-mono text-2xl font-black tabular-nums text-orange-300">
        {Math.round(disp).toLocaleString("en-US")}
      </p>
      <p className="mt-1 text-center text-[11px] text-white/45">
        burned <span className="font-bold text-orange-200">{pct.toFixed(1)}%</span> of the way to 500M
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </Shell>
  );
}

/* ---------------- 10. Loading tips ---------------- */
const TIPS = [
  "Tip #47: green means go.",
  "Tip #12: never trade on an empty stomach.",
  "Tip #88: the chart is not your enemy. Probably.",
  "Tip #3: diamond hands are just hands that forgot to sell.",
  "Tip #51: if you're reading this, you're early.",
  "Tip #7: buy the rumor, buy the news, just buy.",
  "Tip #66: red candles are just green candles in disguise.",
  "Tip #29: Orbit believes in you. Mostly.",
  "Tip #99: past performance does not predict future moons.",
  "Tip #5: touch grass, then touch the buy button.",
  "Tip #13: unlucky for bears.",
  "Tip #1: have fun. That's the whole tip.",
];
export function LoadingTips() {
  const [i, setI] = useState(() => Math.floor(Math.random() * TIPS.length));
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % TIPS.length), 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <Quote className="h-4 w-4 shrink-0 text-white/30" />
      <p key={i} className="animate-[thoughtIn_0.4s_ease-out text-xs italic text-white/55">{TIPS[i]}</p>
      <style>{`@keyframes thoughtIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
