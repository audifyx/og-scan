import type * as React from "react";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Puzzle, PenLine, Cookie, HandHeart, Swords, Vote, ScrollText, Store, Coins, Megaphone, Sparkles, Flame, Zap, Grid3x3, Repeat2, GraduationCap, LayoutGrid, Disc3, MoonStar, HeartHandshake, Hand, LockKeyhole, Mail, Camera, UsersRound } from "lucide-react";
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
  icon: ComponentType<{ className?: string }>; title: string; sub: string; children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
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

// ---- shared helpers ----
const todayKey = () => new Date().toISOString().slice(0, 10);

type HistEntry = { label: string; amount: number; at: number };
function pushHistory(label: string, amount: number) {
  const hist = read<HistEntry[]>("points-history", []);
  hist.unshift({ label, amount, at: Date.now() });
  write("points-history", hist.slice(0, 10));
}
function awardPoints(amount: number, label: string) {
  write("points", read<number>("points", 0) + amount);
  pushHistory(label, amount);
}
function spendPoints(amount: number, label: string): boolean {
  const pts = read<number>("points", 0);
  if (pts < amount) return false;
  write("points", pts - amount);
  pushHistory(label, -amount);
  return true;
}

/* A51 */
export function PersonalityQuiz() {
  const Q: Array<{ q: string; o: Array<[string, number]> }> = [
    { q: "It's 3am. You are…", o: [["Shipping a feature", 0], ["Hunting alpha", 1], ["On the 1m chart", 2], ["Guarding the supply", 3]] },
    { q: "Pick a snack", o: [["Dust rations", 4], ["Prophecy pretzels", 5], ["Turbulence tacos", 6], ["Cold pizza", 0]] },
    { q: "Market dumps 20%. You…", o: [["Find who knew first", 1], ["Buy the wick", 2], ["Check the multisig", 3], ["Dig the chain for burns", 4]] },
    { q: "Your group-chat role?", o: [["The cryptic one", 5], ["The reckless pilot", 6], ["The 3am shipper", 0], ["The alpha plug", 1]] },
    { q: "Choose a superpower", o: [["Perfect entries", 2], ["Unbreakable vault", 3], ["Infinite focus", 0], ["Seeing 3 candles ahead", 5]] },
  ];
  const [ans, setAns] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const top = useMemo(() => {
    if (!done) return -1;
    const c = [0, 0, 0, 0, 0, 0, 0];
    ans.forEach((a) => c[a]++);
    return c.indexOf(Math.max(...c));
  }, [ans, done]);
  const agent = top >= 0 ? AGENTS[top] : null;
  const share = agent ? `I'm ${agent.role} energy — ${agent.trait}. "HODL the vibe." Find your ORBITX agent.` : "";
  return (
    <Shell icon={Puzzle} title="Personality Quiz" sub="Which agent are you, really?">
      {!done ? (
        <div className="space-y-3">
          {Q.map((qq, qi) => (
            <div key={qi}>
              <p className="mb-1.5 text-xs font-bold text-white/80">{qi + 1}. {qq.q}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {qq.o.map(([t, a], oi) => (
                  <button key={oi} onClick={() => { const n = [...ans]; n[qi] = a; setAns(n); if (n.filter((x) => x !== undefined).length === Q.length) setDone(true); }}
                    className={cn("rounded-xl border px-2 py-1.5 text-left text-[11px] font-semibold transition", ans[qi] === a ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25")}>{t}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : agent && (
        <div className="rounded-2xl border p-4 text-center" style={{ borderColor: agent.color + "55", background: agent.color + "14" }}>
          <p className="text-[11px] uppercase tracking-widest text-white/50">You are</p>
          <p className="text-2xl font-black" style={{ color: agent.color }}>{agent.role}</p>
          <p className="mt-1 text-xs text-white/70">{agent.job} · {agent.trait}</p>
          <p className="mt-3 rounded-xl bg-black/30 p-2 text-[11px] italic text-white/75">"{share}"</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => { try { void navigator.clipboard?.writeText(share); } catch { /* ignore */ } setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="flex-1 rounded-xl bg-amber-400/20 px-3 py-2 text-xs font-bold text-amber-200">{copied ? "Copied!" : "Copy share line"}</button>
            <button onClick={() => { setAns([]); setDone(false); }} className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70">Retake</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* A52 */
export function NameYourAgent() {
  const [role, setRole] = useState(0);
  const [name, setName] = useState("");
  const [registry, setRegistry] = useState<Array<{ name: string; role: string; color: string }>>(() => read("registry", []));
  const adopt = () => {
    const n = name.trim();
    if (!n) return;
    const next = [...registry, { name: n, role: AGENTS[role].role, color: AGENTS[role].color }];
    setRegistry(next); write("registry", next); setName("");
  };
  const remove = (i: number) => { const next = registry.filter((_, x) => x !== i); setRegistry(next); write("registry", next); };
  return (
    <Shell icon={PenLine} title="Name Your Agent" sub="Adopt an agent. Give it a name.">
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a, i) => (
          <button key={a.role} onClick={() => setRole(i)} className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", role === i ? "text-black" : "bg-white/5 text-white/60")} style={role === i ? { background: a.color } : undefined}>{a.role}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && adopt()} placeholder={`Name your ${AGENTS[role].role}…`} maxLength={20}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-amber-400/50 focus:outline-none" />
        <button onClick={adopt} className="rounded-xl bg-amber-400/20 px-3 py-2 text-xs font-bold text-amber-200">Adopt</button>
      </div>
      <div className="mt-3 space-y-1.5">
        {registry.length === 0 && <p className="text-[11px] text-white/35">No agents adopted yet. They're waiting.</p>}
        {registry.map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
            <p className="flex-1 text-xs font-bold">{r.name} <span className="font-normal text-white/40">· {r.role}</span></p>
            <button onClick={() => remove(i)} className="text-[11px] text-white/35 hover:text-red-300">release</button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* A53 */
export function FeedAgent() {
  const [idx, setIdx] = useState(0);
  const [snacks, setSnacks] = useState<Record<string, number>>(() => read("snacks", {}));
  const [hap, setHap] = useState<Record<string, { v: number; d: string }>>(() => read("happiness", {}));
  const role = AGENTS[idx].role;
  const raw = hap[role];
  const cur = !raw ? 50 : raw.d === todayKey() ? raw.v : Math.max(0, raw.v - 15);
  const face = cur >= 80 ? "🤩" : cur >= 55 ? "😊" : cur >= 30 ? "😐" : "😭";
  const count = snacks[role] ?? 3;
  const persistHap = (v: number) => { const n = { ...hap, [role]: { v: Math.min(100, Math.max(0, v)), d: todayKey() } }; setHap(n); write("happiness", n); };
  const feed = () => { if (count <= 0) return; const n = { ...snacks, [role]: count - 1 }; setSnacks(n); write("snacks", n); persistHap(cur + 18); };
  const restock = () => { if (!spendPoints(5, "Restocked agent snacks")) return; const n = { ...snacks, [role]: count + 3 }; setSnacks(n); write("snacks", n); };
  return (
    <Shell icon={Cookie} title="Feed Agent" sub="Snacks in, happiness out. Decays daily.">
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a, i) => (
          <button key={a.role} onClick={() => setIdx(i)} className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", idx === i ? "text-black" : "bg-white/5 text-white/60")} style={idx === i ? { background: a.color } : undefined}>{a.role}</button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-5xl">{face}</span>
        <div className="flex-1">
          <div className="flex justify-between text-[11px] text-white/50"><span>Happiness</span><span>{cur}/100</span></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${cur}%`, background: AGENTS[idx].color }} />
          </div>
          <p className="mt-1 text-[11px] text-white/50">🍪 Snacks: <span className="font-bold text-white/80">{count}</span></p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={feed} disabled={count <= 0} className="flex-1 rounded-xl bg-amber-400/20 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-40">Feed {role}</button>
        <button onClick={restock} className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70">Restock +3 (5 pts)</button>
      </div>
    </Shell>
  );
}

/* A54 */
export function PetTheAgent() {
  const [idx, setIdx] = useState(0);
  const [aff, setAff] = useState<Record<string, { v: number; d: string }>>(() => read("affection", {}));
  const role = AGENTS[idx].role;
  const raw = aff[role];
  const v = !raw ? 0 : raw.d === todayKey() ? raw.v : Math.max(0, raw.v - 10);
  const pet = () => { const n = { ...aff, [role]: { v: Math.min(100, v + 1), d: todayKey() } }; setAff(n); write("affection", n); };
  const line = v >= 75 ? `${role} purrs in binary. Maximum loyalty achieved.` : v >= 40 ? `${role} leans into the scratch. Suspiciously affectionate.` : v >= 10 ? `${role} tolerates this. Antenna wiggle detected.` : v > 0 ? `${role} side-eyes you. Keep scratching.` : "Unpetted. The antenna awaits.";
  return (
    <Shell icon={HandHeart} title="Pet The Agent" sub="Scratch behind the antenna. Decays daily.">
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {AGENTS.map((a, i) => {
          const r = aff[a.role];
          const vv = !r ? 0 : r.d === todayKey() ? r.v : Math.max(0, r.v - 10);
          return (
            <button key={a.role} onClick={() => setIdx(i)} className={cn("rounded-xl border p-1.5 text-center", idx === i ? "border-amber-400/60 bg-amber-400/10" : "border-white/10 bg-white/[0.03]")}>
              <span className="block h-2 w-2 mx-auto rounded-full" style={{ background: a.color }} />
              <span className="mt-1 block text-[9px] font-bold text-white/70">{a.role}</span>
              <span className="block text-[9px] text-white/40">{vv}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-center">
        <div className="mx-auto h-2.5 w-3/4 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: AGENTS[idx].color }} />
        </div>
        <p className="mt-2 text-[11px] italic text-white/60">"{line}"</p>
        <button onClick={pet} className="mt-2 rounded-xl px-6 py-2.5 text-sm font-black text-black transition active:scale-95" style={{ background: AGENTS[idx].color }}>Pet {role} 🤚</button>
      </div>
    </Shell>
  );
}

/* A55 */
export function AgentBattle() {
  const TOPICS = ["Is the dip actually a dip?", "Tabs vs spaces in the trading bot", "Who moved the office thermostat?"];
  const LINES: Array<(a: string, b: string) => string> = [
    (a) => `${a}: "Obviously I'm right. I checked the vibes."`,
    (a, b) => `${b}: "Your vibes are unverified. Show me the chain."`,
    (a) => `${a}: "The chain LAGS. Alpha doesn't wait for confirmations."`,
    (a, b) => `${b}: "Alpha without verification is just gossip with confidence."`,
    (a) => `${a}: "Gossip with confidence built this entire market."`,
    (a, b) => `${b}: "…I hate that you're right. Rematch at the next candle."`,
  ];
  const [topic, setTopic] = useState(0);
  const [pair, setPair] = useState<[number, number] | null>(null);
  const [shown, setShown] = useState(0);
  const [results, setResults] = useState<Record<string, string>>(() => read("battle-results", {}));
  useEffect(() => {
    if (!pair || shown >= LINES.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 1300);
    return () => clearTimeout(t);
  }, [pair, shown]);
  const start = () => {
    let a = Math.floor(Math.random() * AGENTS.length), b = Math.floor(Math.random() * AGENTS.length);
    while (b === a) b = Math.floor(Math.random() * AGENTS.length);
    setPair([a, b]); setShown(0);
  };
  const winner = results[TOPICS[topic]];
  const vote = (w: number) => { const n = { ...results, [TOPICS[topic]]: AGENTS[w].role }; setResults(n); write("battle-results", n); };
  const A = pair ? AGENTS[pair[0]] : null, B = pair ? AGENTS[pair[1]] : null;
  return (
    <Shell icon={Swords} title="Agent Battle" sub="Two agents. One topic. Zero mercy.">
      <div className="flex flex-wrap gap-1.5">
        {TOPICS.map((t, i) => (
          <button key={t} onClick={() => { setTopic(i); setPair(null); }} className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", topic === i ? "bg-amber-400/20 text-amber-200" : "bg-white/5 text-white/60")}>{t}</button>
        ))}
      </div>
      <button onClick={start} className="mt-2 w-full rounded-xl bg-amber-400/20 px-3 py-2 text-xs font-bold text-amber-200">Start battle</button>
      {pair && A && B && (
        <div className="mt-3 space-y-1.5">
          {LINES.slice(0, shown).map((fn, i) => (
            <p key={i} className={cn("rounded-xl px-3 py-1.5 text-[11px]", i % 2 === 0 ? "bg-white/[0.05] text-left text-white/80" : "bg-white/[0.02] text-right text-white/60")}>{fn(A.role, B.role)}</p>
          ))}
          {shown >= LINES.length && (
            <div className="pt-1">
              <p className="text-[11px] font-bold text-white/60">Declare the winner:</p>
              <div className="mt-1.5 flex gap-2">
                {[pair[0], pair[1]].map((pi) => (
                  <button key={pi} onClick={() => vote(pi)} className="flex-1 rounded-xl px-3 py-2 text-xs font-black text-black" style={{ background: AGENTS[pi].color }}>{AGENTS[pi].role}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {winner && <p className="mt-2 rounded-xl bg-amber-400/10 px-3 py-1.5 text-[11px] font-bold text-amber-200">🏆 {winner} won this topic.</p>}
    </Shell>
  );
}

/* A56 */
export function AgentVote() {
  const week = useMemo(() => {
    const d = new Date(), one = new Date(d.getFullYear(), 0, 1);
    return `${d.getFullYear()}-W${Math.ceil(((d.getTime() - one.getTime()) / 86400000 + one.getDay() + 1) / 7)}`;
  }, []);
  const [votes, setVotes] = useState(() => read("community-vote", { w: "", yes: 0, no: 0, mine: "" as "" | "yes" | "no" }));
  const v = votes.w === week ? votes : { w: week, yes: 0, no: 0, mine: "" as const };
  const cast = (side: "yes" | "no") => {
    if (v.mine) return;
    const n = { w: week, yes: v.yes + (side === "yes" ? 1 : 0), no: v.no + (side === "no" ? 1 : 0), mine: side };
    setVotes(n); write("community-vote", n);
  };
  const total = v.yes + v.no;
  const yp = total ? Math.round((v.yes / total) * 100) : 50;
  return (
    <Shell icon={Vote} title="Agent Vote" sub={`Weekly community vote · ${week}`}>
      <p className="text-sm font-extrabold">Should TRADER ape into the dip?</p>
      <p className="text-[11px] text-white/45">TRADER abstains. Obviously.</p>
      <div className="mt-3 space-y-2">
        <div>
          <div className="flex justify-between text-[11px] font-bold"><span className="text-emerald-300">YES — send it</span><span className="text-white/50">{yp}%</span></div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${yp}%` }} /></div>
        </div>
        <div>
          <div className="flex justify-between text-[11px] font-bold"><span className="text-red-300">NO — touch grass</span><span className="text-white/50">{100 - yp}%</span></div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-red-400 transition-all duration-700" style={{ width: `${100 - yp}%` }} /></div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => cast("yes")} disabled={!!v.mine} className="flex-1 rounded-xl bg-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-200 disabled:opacity-40">Vote YES</button>
        <button onClick={() => cast("no")} disabled={!!v.mine} className="flex-1 rounded-xl bg-red-400/20 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-40">Vote NO</button>
      </div>
      <p className="mt-2 text-center text-[11px] text-white/40">{v.mine ? `You voted ${v.mine.toUpperCase()}. Democracy works.` : `${total} vote${total === 1 ? "" : "s"} so far.`}</p>
    </Shell>
  );
}

/* A57 */
export function AgentQuests() {
  const QUESTS = [
    { id: "chart", label: "Open the ORBITX chart and stare meaningfully", by: "TRADER" },
    { id: "share", label: "Share ORBITX with one human", by: "SCOUT" },
    { id: "burn", label: "Check the burn tracker. Nod approvingly.", by: "MINER" },
    { id: "secure", label: "Verify your wallet is still yours", by: "GUARD" },
    { id: "ship", label: "Ship one tiny thing before midnight", by: "BUILDER" },
  ];
  const [state, setState] = useState(() => read("quests", { date: "", done: [] as string[], streak: 0, lastAll: "" }));
  const s = state.date === todayKey() ? state : { date: todayKey(), done: [] as string[], streak: state.streak, lastAll: state.lastAll };
  const toggle = (id: string) => {
    if (s.done.includes(id)) return;
    const done = [...s.done, id];
    awardPoints(10, `Quest complete: ${QUESTS.find((q) => q.id === id)?.label.slice(0, 30)}…`);
    let { streak, lastAll } = s;
    if (done.length === QUESTS.length) {
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      streak = lastAll === y ? streak + 1 : 1;
      lastAll = todayKey();
    }
    const n = { date: todayKey(), done, streak, lastAll };
    setState(n); write("quests", n);
  };
  return (
    <Shell icon={ScrollText} title="Agent Quests" sub="Daily quests · 10 pts each">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] text-white/50">{s.done.length}/{QUESTS.length} complete today</p>
        <p className="text-[11px] font-bold text-amber-300">🔥 {s.streak}-day streak</p>
      </div>
      <div className="space-y-1.5">
        {QUESTS.map((q) => {
          const doneQ = s.done.includes(q.id);
          return (
            <button key={q.id} onClick={() => toggle(q.id)} className={cn("flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition", doneQ ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/[0.03] hover:border-white/25")}>
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border text-[11px]", doneQ ? "border-emerald-400 bg-emerald-400 text-black" : "border-white/25 text-transparent")}>✓</span>
              <span className={cn("flex-1 text-xs font-semibold", doneQ ? "text-white/40 line-through" : "text-white/80")}>{q.label}</span>
              <span className="text-[10px] font-bold text-white/35">{q.by}</span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

/* A58 */
export function AgentShop() {
  const TITLES = [
    { name: "Certified Degen", price: 50 },
    { name: "Alpha Scout", price: 60 },
    { name: "Chart Whisperer", price: 80 },
    { name: "Diamond Paws", price: 120 },
    { name: "Moon Pilot", price: 150 },
    { name: "Burn Warden", price: 200 },
  ];
  const [owned, setOwned] = useState<string[]>(() => read("titles-owned", []));
  const [equipped, setEquipped] = useState(() => read("title-equipped", ""));
  const [bal, setBal] = useState(() => read<number>("points", 0));
  const buy = (t: { name: string; price: number }) => {
    if (owned.includes(t.name) || bal < t.price) return;
    if (!spendPoints(t.price, `Bought title: ${t.name}`)) return;
    const n = [...owned, t.name];
    setOwned(n); write("titles-owned", n); setBal(read<number>("points", 0));
  };
  const equip = (name: string) => { setEquipped(name); write("title-equipped", name); };
  return (
    <Shell icon={Store} title="Agent Shop" sub="Cosmetic titles. Zero stats, all clout.">
      <div className="mb-2 flex items-center justify-between text-[11px]">
        <span className="text-white/50">Balance: <span className="font-bold text-amber-300">{bal} pts</span></span>
        {equipped && <span className="rounded-lg bg-amber-400/15 px-2 py-0.5 font-bold text-amber-200">Wearing: {equipped}</span>}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {TITLES.map((t) => {
          const has = owned.includes(t.name);
          return (
            <div key={t.name} className={cn("rounded-xl border p-2.5", has ? "border-amber-400/40 bg-amber-400/5" : "border-white/10 bg-white/[0.03]")}>
              <p className="text-xs font-extrabold">{t.name}</p>
              {has ? (
                <button onClick={() => equip(t.name)} className={cn("mt-1.5 w-full rounded-lg px-2 py-1 text-[11px] font-bold", equipped === t.name ? "bg-amber-400/25 text-amber-200" : "bg-white/10 text-white/70")}>{equipped === t.name ? "Equipped ✓" : "Equip"}</button>
              ) : (
                <button onClick={() => buy(t)} disabled={bal < t.price} className="mt-1.5 w-full rounded-lg bg-amber-400/20 px-2 py-1 text-[11px] font-bold text-amber-200 disabled:opacity-40">{t.price} pts</button>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* A59 */
export function OrbitPoints() {
  const bal = read<number>("points", 0);
  const hist = read<HistEntry[]>("points-history", []);
  return (
    <Shell icon={Coins} title="Orbit Points" sub="The one currency that never rugs.">
      <div className="rounded-2xl bg-amber-400/10 p-4 text-center">
        <p className="text-3xl font-black text-amber-300">{bal}</p>
        <p className="text-[11px] uppercase tracking-widest text-white/45">points</p>
      </div>
      <p className="mt-3 text-[11px] font-bold text-white/50">Recent earnings</p>
      <div className="mt-1.5 space-y-1">
        {hist.length === 0 && <p className="text-[11px] text-white/35">No earnings yet. Do a quest, spin the wheel, live a little.</p>}
        {hist.map((h, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-1.5">
            <span className="truncate text-[11px] text-white/70">{h.label}</span>
            <span className={cn("ml-2 text-[11px] font-black", h.amount >= 0 ? "text-emerald-300" : "text-red-300")}>{h.amount >= 0 ? "+" : ""}{h.amount}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* A60 */
export function AgentDares() {
  const DARES = [
    "Say 'gm' in the group chat at 3am and own it.",
    "Explain ORBITX to a stranger using only emojis.",
    "Draw the chart from memory. Sign it. Frame it.",
    "High-five your screen the next green candle.",
    "Rename your WiFi to 'ORBITX to the moon'.",
    "Do 10 pushups every time you check the price today.",
    "Whisper 'diamond hands' to your reflection.",
    "Send a friend one (1) extremely confident price prediction.",
    "Write a haiku about the burn wallet.",
    "Hold your breath through one full red candle.",
    "Teach your pet what 'HODL' means.",
    "Reply 'this is the way' to the next post you see.",
  ];
  const [cur, setCur] = useState(() => ({ dare: Math.floor(Math.random() * DARES.length), agent: Math.floor(Math.random() * AGENTS.length) }));
  const [accepted, setAccepted] = useState(() => read<number>("dares-accepted", 0));
  const [last, setLast] = useState<"accepted" | "declined" | null>(null);
  const reroll = () => setCur({ dare: Math.floor(Math.random() * DARES.length), agent: Math.floor(Math.random() * AGENTS.length) });
  const accept = () => {
    const n = accepted + 1; setAccepted(n); write("dares-accepted", n);
    awardPoints(5, "Dare accepted — brave soul");
    setLast("accepted"); reroll();
  };
  const decline = () => { setLast("declined"); reroll(); };
  const a = AGENTS[cur.agent];
  return (
    <Shell icon={Megaphone} title="Agent Dares" sub="12 dares. Zero survivors (of boredom).">
      <div className="rounded-2xl border p-4 text-center" style={{ borderColor: a.color + "55", background: a.color + "12" }}>
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: a.color }}>{a.role} dares you</p>
        <p className="mt-2 text-sm font-bold text-white/90">"{DARES[cur.dare]}"</p>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={accept} className="flex-1 rounded-xl bg-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-200">Accept (+5 pts)</button>
        <button onClick={decline} className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70">Decline (coward)</button>
      </div>
      <p className="mt-2 text-center text-[11px] text-white/40">{accepted} dares accepted{last === "accepted" ? " · bold." : last === "declined" ? " · the agents are judging." : "."}</p>
    </Shell>
  );
}

/* A61 */
export function AgentCompliments() {
  const LINES: Record<string, string[]> = {
    BUILDER: ["Your commits are poetry. Ugly, 3am poetry.", "You ship faster than my doubts can load.", "Even your bugs have good architecture."],
    SCOUT: ["You'd find alpha in a phone book.", "Your group chats fear your research folder.", "Trendsetters follow YOU."],
    TRADER: ["Your entries are cleaner than a fresh wallet.", "The 1m chart respects you. It told me.", "You buy dips like they owe you money."],
    GUARD: ["Fort Knox takes notes from you.", "Your paranoia is simply preparation.", "The supply sleeps soundly because of you."],
    MINER: ["You dig deeper than my search history.", "Every burn you find is a tiny victory parade.", "Dusty hands, golden heart."],
    ORACLE: ["Your riddles have excellent risk-reward.", "Three candles ahead and still humble.", "Nostradamus wishes he had your win rate."],
    PILOT: ["You fly the market cap like it's a paper plane.", "Turbulence is just your warm-up.", "Reckless? No. Aerodynamic."],
  };
  const [idx, setIdx] = useState(0);
  const [li, setLi] = useState(0);
  const role = AGENTS[idx].role;
  const another = () => setLi((i) => (i + 1 + Math.floor(Math.random() * (LINES[role].length - 1))) % LINES[role].length);
  return (
    <Shell icon={Sparkles} title="Agent Compliments" sub="Free serotonin, agent-flavored.">
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a, i) => (
          <button key={a.role} onClick={() => { setIdx(i); setLi(0); }} className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", idx === i ? "text-black" : "bg-white/5 text-white/60")} style={idx === i ? { background: a.color } : undefined}>{a.role}</button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-white/[0.04] p-4 text-center">
        <p className="text-sm font-bold italic text-white/90">"{LINES[role][li]}"</p>
        <p className="mt-1 text-[11px] text-white/40">— {role}, being nice for once</p>
        <button onClick={another} className="mt-2 rounded-xl bg-amber-400/20 px-4 py-1.5 text-xs font-bold text-amber-200">Another one</button>
      </div>
    </Shell>
  );
}

/* A62 */
export function AgentRoasts() {
  const MILD = [
    "Your hands are paper. Origami-grade. Beautiful, but fragile.",
    "You sold the dip and bought the top. A perfect inverse oracle.",
    "Your portfolio needs a hug and a diversified strategy.",
    "You check the chart so often it should pay you rent.",
  ];
  const SPICY = [
    "Paper hands? Buddy, you're holding a whole stationery store.",
    "Your stop-loss has a stop-loss. It's called anxiety.",
    "You don't HODL, you HOPE — and hope isn't a strategy.",
    "The market doesn't manipulate you. You manipulate yourself, for free.",
  ];
  const [spicy, setSpicy] = useState(false);
  const [i, setI] = useState(0);
  const pool = spicy ? SPICY : MILD;
  return (
    <Shell icon={Flame} title="Agent Roasts" sub="Target: paper hands. Served with love.">
      <div className="flex gap-2">
        <button onClick={() => { setSpicy(false); setI(0); }} className={cn("flex-1 rounded-xl px-3 py-1.5 text-xs font-bold", !spicy ? "bg-amber-400/20 text-amber-200" : "bg-white/5 text-white/60")}>Mild 🌶️</button>
        <button onClick={() => { setSpicy(true); setI(0); }} className={cn("flex-1 rounded-xl px-3 py-1.5 text-xs font-bold", spicy ? "bg-red-400/20 text-red-200" : "bg-white/5 text-white/60")}>Spicy 🌶️🌶️🌶️</button>
      </div>
      <div className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-center">
        <p className="text-sm font-bold italic text-white/90">"{pool[i % pool.length]}"</p>
        <button onClick={() => setI((x) => x + 1)} className="mt-2 rounded-xl bg-white/10 px-4 py-1.5 text-xs font-bold text-white/80">Roast me again</button>
      </div>
      <p className="mt-2 text-center text-[10px] text-white/35">Disclaimer: no portfolios were harmed. Egos, slightly.</p>
    </Shell>
  );
}

/* A63 */
export function AgentDuel() {
  type Phase = "idle" | "waiting" | "ready" | "early" | "done";
  const [phase, setPhase] = useState<Phase>("idle");
  const [ms, setMs] = useState(0);
  const [best, setBest] = useState(() => read<number>("duel-best", 0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startT = useRef(0);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const begin = () => {
    setPhase("waiting"); setMs(0);
    timer.current = setTimeout(() => { startT.current = performance.now(); setPhase("ready"); }, 1500 + Math.random() * 2500);
  };
  const tap = () => {
    if (phase === "waiting") { if (timer.current) clearTimeout(timer.current); setPhase("early"); }
    else if (phase === "ready") {
      const t = Math.round(performance.now() - startT.current);
      setMs(t); setPhase("done");
      if (!best || t < best) { setBest(t); write("duel-best", t); }
    }
  };
  const taunt = !ms ? "" : ms < 250 ? `GUARD: "Suspiciously fast. Were YOU moving the thermostat?"` : ms < 400 ? `GUARD: "Not bad. The vault remains unbreached. Barely."` : `GUARD: "My grandma secures multisigs faster than that."`;
  const bg = phase === "ready" ? "bg-emerald-400" : phase === "waiting" ? "bg-red-400/80" : "bg-white/10";
  const label = phase === "idle" ? "Start duel" : phase === "waiting" ? "Wait for green…" : phase === "ready" ? "CLICK!" : phase === "early" ? "Too early! False start." : `${ms} ms`;
  return (
    <Shell icon={Zap} title="Agent Duel" sub="Reaction duel vs GUARD. Wait for green.">
      <button onClick={() => (phase === "idle" || phase === "early" || phase === "done" ? begin() : tap())}
        className={cn("flex h-36 w-full items-center justify-center rounded-2xl text-xl font-black text-black transition-colors", bg)}>
        {label}
      </button>
      {(phase === "waiting" || phase === "ready") && (
        <button onClick={tap} className="mt-2 w-full rounded-xl border border-white/15 py-2 text-xs font-bold text-white/70">Tap here to strike</button>
      )}
      <p className="mt-2 text-center text-[11px] text-white/50">Best: <span className="font-bold text-amber-300">{best ? `${best} ms` : "—"}</span></p>
      {taunt && <p className="mt-1 rounded-xl bg-white/[0.04] px-3 py-2 text-center text-[11px] italic text-white/70">{taunt}</p>}
    </Shell>
  );
}

/* A64 */
export function AgentMemory() {
  const FACES = ["🛠️", "🔭", "📈", "🛡️"];
  const fresh = () => [...FACES, ...FACES].map((e, i) => ({ e, k: i })).sort(() => Math.random() - 0.5);
  const [cards, setCards] = useState(fresh);
  const [flip, setFlip] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [best, setBest] = useState(() => read<number>("memory-best", 0));
  const [lock, setLock] = useState(false);
  const pick = (i: number) => {
    if (lock || flip.includes(i) || matched.includes(i)) return;
    const f = [...flip, i];
    setFlip(f);
    if (f.length === 2) {
      const nm = moves + 1;
      setMoves(nm);
      if (cards[f[0]].e === cards[f[1]].e) {
        const m = [...matched, f[0], f[1]];
        setMatched(m); setFlip([]);
        if (m.length === 8 && (!best || nm < best)) { setBest(nm); write("memory-best", nm); }
      } else { setLock(true); setTimeout(() => { setFlip([]); setLock(false); }, 750); }
    }
  };
  const restart = () => { setCards(fresh()); setFlip([]); setMatched([]); setMoves(0); };
  const won = matched.length === 8;
  return (
    <Shell icon={Grid3x3} title="Agent Memory" sub="Match the agent pairs. Fewest moves wins.">
      <div className="grid grid-cols-4 gap-1.5">
        {cards.map((c, i) => {
          const up = flip.includes(i) || matched.includes(i);
          return (
            <button key={c.k} onClick={() => pick(i)} className={cn("flex h-14 items-center justify-center rounded-xl border text-2xl transition", up ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-white/[0.04] hover:border-white/25")}>
              {up ? c.e : <span className="text-white/20">?</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
        <span>Moves: <span className="font-bold text-white/80">{moves}</span></span>
        <span>Best: <span className="font-bold text-amber-300">{best || "—"}</span></span>
        <button onClick={restart} className="rounded-lg bg-white/10 px-2.5 py-1 font-bold text-white/70">Restart</button>
      </div>
      {won && <p className="mt-2 rounded-xl bg-emerald-400/10 px-3 py-2 text-center text-[11px] font-bold text-emerald-200">🎉 All pairs found in {moves} moves. ORACLE saw it coming.</p>}
    </Shell>
  );
}

/* A65 */
export function AgentSimon() {
  const PADS = [0, 1, 2, 3]; // BUILDER, SCOUT, TRADER, GUARD
  const [seq, setSeq] = useState<number[]>([]);
  const [lit, setLit] = useState(-1);
  const [pos, setPos] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [over, setOver] = useState(false);
  const [high, setHigh] = useState(() => read<number>("simon-high", 0));
  const playSeq = (s: number[]) => {
    setAccepting(false); setPos(0);
    s.forEach((c, i) => {
      setTimeout(() => setLit(c), 550 * (i + 1));
      setTimeout(() => setLit(-1), 550 * (i + 1) + 320);
    });
    setTimeout(() => setAccepting(true), 550 * (s.length + 1));
  };
  const start = () => { const s = [Math.floor(Math.random() * 4)]; setSeq(s); setOver(false); playSeq(s); };
  const press = (c: number) => {
    if (!accepting || over) return;
    if (c !== seq[pos]) {
      setOver(true); setAccepting(false);
      if (seq.length - 1 > high) { setHigh(seq.length - 1); write("simon-high", seq.length - 1); }
      return;
    }
    if (pos + 1 === seq.length) { const s = [...seq, Math.floor(Math.random() * 4)]; setSeq(s); playSeq(s); }
    else setPos(pos + 1);
  };
  return (
    <Shell icon={Repeat2} title="Agent Simon" sub="Repeat the agents' sequence.">
      <div className="grid grid-cols-2 gap-1.5">
        {PADS.map((p) => (
          <button key={p} onClick={() => press(p)} disabled={!accepting}
            className={cn("flex h-20 items-center justify-center rounded-2xl text-[11px] font-black text-black/70 transition-all disabled:cursor-default", lit === p && "scale-95 brightness-150")}
            style={{ background: AGENTS[p].color, opacity: lit === p ? 1 : accepting ? 0.75 : 0.45 }}>
            {AGENTS[p].role}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
        <span>Round: <span className="font-bold text-white/80">{seq.length || "—"}</span></span>
        <span>High: <span className="font-bold text-amber-300">{high || "—"}</span></span>
        <button onClick={start} className="rounded-lg bg-amber-400/20 px-3 py-1 font-bold text-amber-200">{seq.length ? "Restart" : "Start"}</button>
      </div>
      {over && <p className="mt-2 rounded-xl bg-red-400/10 px-3 py-2 text-center text-[11px] font-bold text-red-200">Wrong pad! ORACLE knew you'd do that. Round {seq.length}.</p>}
    </Shell>
  );
}

/* A66 */
export function AgentTrivia() {
  const TQ = [
    { q: "Which agent 'ships features at 3am'?", o: ["BUILDER", "PILOT", "MINER", "SCOUT"], a: 0, why: "BUILDER runs on caffeine and questionable sleep schedules." },
    { q: "Who 'finds alpha before it trends'?", o: ["ORACLE", "SCOUT", "TRADER", "GUARD"], a: 1, why: "SCOUT is nosy. Professionally nosy." },
    { q: "Which agent 'lives on the 1-minute chart'?", o: ["PILOT", "TRADER", "MINER", "BUILDER"], a: 1, why: "TRADER has itchy fingers and zero regrets." },
    { q: "Who 'protects the supply'?", o: ["GUARD", "MINER", "ORACLE", "SCOUT"], a: 0, why: "GUARD is paranoid so you don't have to be." },
    { q: "MINER digs what out of the chain?", o: ["Lost passwords", "Burns", "Memes", "Regrets"], a: 1, why: "MINER is dusty from digging up burns all day." },
    { q: "ORACLE sees how many candles ahead?", o: ["One", "Three", "Twelve", "None — vibes only"], a: 1, why: "Three candles ahead. Cryptic, but specific." },
    { q: "PILOT's trait is…", o: ["Reckless", "Cautious", "Sleepy", "Bureaucratic"], a: 0, why: "PILOT flies the market cap. Seatbelts optional." },
    { q: "Which agent is 'cryptic'?", o: ["SCOUT", "ORACLE", "GUARD", "TRADER"], a: 1, why: "ORACLE speaks in riddles and red candles." },
  ];
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const q = TQ[qi];
  const done = qi >= TQ.length;
  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.a) setScore((s) => s + 1);
  };
  const next = () => { setQi((x) => x + 1); setPicked(null); };
  const restart = () => { setQi(0); setScore(0); setPicked(null); };
  return (
    <Shell icon={GraduationCap} title="Agent Trivia" sub="8 questions of sacred agent lore.">
      {done ? (
        <div className="rounded-2xl bg-amber-400/10 p-4 text-center">
          <p className="text-2xl font-black text-amber-300">{score}/{TQ.length}</p>
          <p className="mt-1 text-[11px] text-white/60">{score === 8 ? "Flawless. The agents fear your knowledge." : score >= 5 ? "Solid agent scholar." : "The agents suggest studying their lore (this page)."}</p>
          <button onClick={restart} className="mt-2 rounded-xl bg-amber-400/20 px-4 py-1.5 text-xs font-bold text-amber-200">Play again</button>
        </div>
      ) : (
        <div>
          <p className="text-[11px] text-white/45">Question {qi + 1}/{TQ.length} · Score {score}</p>
          <p className="mt-1 text-sm font-extrabold">{q.q}</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {q.o.map((opt, i) => (
              <button key={i} onClick={() => pick(i)} disabled={picked !== null}
                className={cn("rounded-xl border px-2 py-2 text-[11px] font-bold transition",
                  picked === null ? "border-white/10 bg-white/[0.03] text-white/75 hover:border-white/25"
                  : i === q.a ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200"
                  : picked === i ? "border-red-400/60 bg-red-400/15 text-red-200" : "border-white/10 text-white/40")}>
                {opt}
              </button>
            ))}
          </div>
          {picked !== null && (
            <div className="mt-2 rounded-xl bg-white/[0.04] p-2.5">
              <p className="text-[11px] text-white/65">{picked === q.a ? "✅ " : "❌ "}{q.why}</p>
              <button onClick={next} className="mt-1.5 w-full rounded-xl bg-amber-400/20 px-3 py-1.5 text-xs font-bold text-amber-200">{qi + 1 === TQ.length ? "See score" : "Next question"}</button>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* A67 */
export function AgentBingo() {
  const CELLS = ["Saw a green candle", "HODLed through red", "Said 'wen moon'", "Checked the chart at 3am", "Diamond hands", "Minted something silly", "Survived a rug scare", "Explained crypto at dinner", "Touched grass (rare)"];
  const LINESB = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const [mark, setMark] = useState<boolean[]>(() => read("bingo", Array(9).fill(false)));
  const toggle = (i: number) => { const n = mark.map((m, x) => (x === i ? !m : m)); setMark(n); write("bingo", n); };
  const bingo = LINESB.some((l) => l.every((i) => mark[i]));
  const reset = () => { const n = Array(9).fill(false); setMark(n); write("bingo", n); };
  return (
    <Shell icon={LayoutGrid} title="Agent Bingo" sub="Degen bingo. Tap to mark your sins.">
      <div className="grid grid-cols-3 gap-1.5">
        {CELLS.map((c, i) => (
          <button key={i} onClick={() => toggle(i)}
            className={cn("flex h-20 items-center justify-center rounded-xl border p-2 text-center text-[10px] font-bold leading-tight transition",
              mark[i] ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25")}>
            {c}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[11px] text-white/45">{mark.filter(Boolean).length}/9 marked</p>
        <button onClick={reset} className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/70">Reset card</button>
      </div>
      {bingo && (
        <div className="mt-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-center">
          <p className="text-lg">🎉🎉🎉</p>
          <p className="text-sm font-black text-amber-200">BINGO! Certified degen.</p>
          <p className="text-[11px] text-white/60">TRADER is already framing your card.</p>
        </div>
      )}
    </Shell>
  );
}

/* A68 */
export function AgentSpin() {
  const SEGS = [
    { label: "+10 pts", pts: 10, c: "#f59e0b" }, { label: "Dare", pts: 0, c: "#ec4899" },
    { label: "+25 pts", pts: 25, c: "#10b981" }, { label: "Compliment", pts: 0, c: "#3b82f6" },
    { label: "+5 pts", pts: 5, c: "#7c3aed" }, { label: "Fortune", pts: 0, c: "#ef4444" },
    { label: "+50 pts", pts: 50, c: "#14b8a6" }, { label: "Hug", pts: 0, c: "#f43f5e" },
  ];
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<string | null>(null);
  const spin = () => {
    if (spinning) return;
    setSpinning(true); setLanded(null);
    const idx = Math.floor(Math.random() * SEGS.length);
    const base = rot + 1800 + Math.floor(Math.random() * 360);
    const aligned = base - (base % 360) + ((360 - (idx * 45 + 22.5)) % 360);
    setRot(aligned);
    setTimeout(() => {
      setSpinning(false);
      const s = SEGS[idx];
      if (s.pts) awardPoints(s.pts, `Spin wheel: ${s.label}`);
      setLanded(s.pts ? `${s.label} — nice spin.` : `${s.label}! Go claim it in that widget.`);
    }, 3200);
  };
  const gradient = `conic-gradient(${SEGS.map((s, i) => `${s.c} ${i * 45}deg ${(i + 1) * 45}deg`).join(", ")})`;
  return (
    <Shell icon={Disc3} title="Agent Spin" sub="Prize wheel. Physics sold separately.">
      <div className="relative mx-auto h-44 w-44">
        <div className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-8 border-t-[14px] border-x-transparent border-t-white" />
        <div className="h-full w-full rounded-full border-4 border-white/15 transition-transform duration-[3000ms]" style={{ transform: `rotate(${rot}deg)`, background: gradient, transitionTimingFunction: "cubic-bezier(0.15, 0.85, 0.25, 1)" }} />
        <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-lg font-black text-amber-300">🌀</div>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-1">
        {SEGS.map((s) => <span key={s.label} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: s.c + "22", color: s.c }}>{s.label}</span>)}
      </div>
      <button onClick={spin} disabled={spinning} className="mt-2 w-full rounded-xl bg-amber-400/20 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-40">{spinning ? "Spinning…" : "SPIN"}</button>
      {landed && <p className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-center text-[11px] font-bold text-amber-200">{landed}</p>}
    </Shell>
  );
}

/* A69 */
export function AgentFortune() {
  const FORTUNES = [
    "A green candle is coming. This is not financial advice. It is a vibe.",
    "You will check the chart at 3am. The chart will be checking you back.",
    "Beware the paper hands of March. Or any month. Just beware.",
    "A stranger will ask 'wen moon'. Answer with confidence and jazz hands.",
    "Your next trade will teach you something. Tuition may apply.",
    "The dip you fear is the dip you will one day miss.",
    "Fortune favors the HODLer. Also the early sleeper. Balance.",
    "Someone will FUD. You will sip tea. The tea is diamond-flavored.",
    "A burn is coming. Not yours to fear — yours to celebrate.",
    "The ORACLE sees three candles ahead. All of them are yours.",
  ];
  const [open, setOpen] = useState<string[]>(() => read("fortunes", []));
  const [cur, setCur] = useState<string | null>(null);
  const [cracking, setCracking] = useState(false);
  const crack = () => {
    if (cracking) return;
    setCracking(true);
    setTimeout(() => {
      const pool = FORTUNES.filter((f) => !open.includes(f));
      const src = pool.length ? pool : FORTUNES;
      const f = src[Math.floor(Math.random() * src.length)];
      setCur(f);
      if (!open.includes(f)) { const n = [...open, f]; setOpen(n); write("fortunes", n); }
      setCracking(false);
    }, 450);
  };
  return (
    <Shell icon={MoonStar} title="Agent Fortune" sub="ORACLE's cookie jar. Tap to crack.">
      <div className="text-center">
        <button onClick={crack} className={cn("text-6xl transition-transform duration-300", cracking && "scale-50 rotate-12")} aria-label="Crack fortune cookie">🥠</button>
        <p className="mt-1 text-[11px] text-white/45">Collection: {open.length}/{FORTUNES.length}</p>
      </div>
      {cur && (
        <div className="mt-2 rounded-2xl border border-purple-400/30 bg-purple-400/10 p-3 text-center">
          <p className="text-sm font-bold italic text-white/90">"{cur}"</p>
          <p className="mt-1 text-[11px] text-white/40">— ORACLE, cryptic as ever</p>
        </div>
      )}
      <button onClick={crack} disabled={cracking} className="mt-2 w-full rounded-xl bg-amber-400/20 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-40">{cracking ? "Cracking…" : "Crack another cookie"}</button>
    </Shell>
  );
}

/* A70 */
export function AgentHug() {
  const HUGLINES = ["A cautious side-hug. Progress.", "A proper hug. The antenna wiggles.", "A legendary embrace. Somewhere, a candle turns green."];
  const [hugs, setHugs] = useState<Record<string, number>>(() => read("hugs", {}));
  const [idx, setIdx] = useState(0);
  const hug = () => { const r = AGENTS[idx].role; const n = { ...hugs, [r]: (hugs[r] ?? 0) + 1 }; setHugs(n); write("hugs", n); };
  const c = hugs[AGENTS[idx].role] ?? 0;
  const line = c >= 25 ? HUGLINES[2] : c >= 5 ? HUGLINES[1] : c >= 1 ? HUGLINES[0] : "No hugs yet. Bold strategy.";
  const top = AGENTS.reduce((a, b) => ((hugs[b.role] ?? 0) > (hugs[a.role] ?? 0) ? b : a));
  const topN = hugs[top.role] ?? 0;
  return (
    <Shell icon={HeartHandshake} title="Agent Hug" sub="Hug an agent. They pretend not to like it.">
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a, i) => (
          <button key={a.role} onClick={() => setIdx(i)} className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", idx === i ? "text-black" : "bg-white/5 text-white/60")} style={idx === i ? { background: a.color } : undefined}>
            {a.role} · {hugs[a.role] ?? 0}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-2xl bg-white/[0.04] p-4 text-center">
        <p className="text-4xl">🤗</p>
        <p className="mt-1 text-[11px] italic text-white/60">"{line}"</p>
        <button onClick={hug} className="mt-2 rounded-xl px-6 py-2.5 text-sm font-black text-black transition active:scale-95" style={{ background: AGENTS[idx].color }}>Hug {AGENTS[idx].role}</button>
      </div>
      {topN > 0 && <p className="mt-2 rounded-xl bg-pink-400/10 px-3 py-1.5 text-center text-[11px] font-bold text-pink-200">💞 Most hugged: {top.role} ({topN} hugs)</p>}
    </Shell>
  );
}

/* A71 */
export function AgentHighFive({ stats }: { stats?: AvatarStats }) {
  const green = (stats?.change24h ?? 0) > 0;
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(() => read<number>("highfive-best", 0));
  const slap = () => {
    if (!green) return;
    const c = combo + 1;
    setCombo(c);
    if (c > best) { setBest(c); write("highfive-best", c); }
  };
  return (
    <Shell icon={Hand} title="Agent High-Five" sub="Only on green days. TRADER's rule.">
      {green ? (
        <div className="text-center">
          <button onClick={slap} className="rounded-2xl bg-emerald-400/20 px-8 py-4 text-4xl transition active:scale-90" aria-label="High five TRADER">🙏</button>
          <p className="mt-2 text-sm font-black text-emerald-200">HIGH-FIVE x{combo}</p>
          <p className="text-[11px] text-white/45">TRADER: "Up only! Again! Again!"</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.04] p-4 text-center">
          <p className="text-4xl opacity-40">🙏</p>
          <p className="mt-2 text-sm font-bold text-white/70">High-fives are paused.</p>
          <p className="text-[11px] text-white/45">Come back on a green day. TRADER doesn't do pity fives.</p>
        </div>
      )}
      <p className="mt-2 text-center text-[11px] text-white/40">Best combo: <span className="font-bold text-amber-300">{best}</span></p>
    </Shell>
  );
}

/* A72 */
export function AgentSecret() {
  const SECRETS = [
    "BUILDER once shipped a feature so fast it arrived yesterday.",
    "SCOUT's 'sources' are three group chats and a dream.",
    "TRADER paper-handed once. We don't talk about it.",
    "GUARD sleeps with one eye on the multisig.",
    "MINER has never seen sunlight. Only blocklight.",
    "ORACLE's predictions are 50% vision, 50% vibes.",
    "PILOT once landed a trade sideways. On purpose. Probably.",
  ];
  const [rev, setRev] = useState<Record<string, string>>(() => read("secrets", {}));
  const reveal = (i: number) => { const n = { ...rev, [AGENTS[i].role]: todayKey() }; setRev(n); write("secrets", n); };
  return (
    <Shell icon={LockKeyhole} title="Agent Secret" sub="One reveal per agent per day. Shhh.">
      <div className="space-y-1.5">
        {AGENTS.map((a, i) => {
          const isOpen = rev[a.role] === todayKey();
          return (
            <div key={a.role} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <p className="flex-1 text-[11px] font-bold text-white/80">{a.role}</p>
              {isOpen ? (
                <p className="flex-[3] text-[11px] italic text-white/65">"{SECRETS[i]}"</p>
              ) : (
                <button onClick={() => reveal(i)} className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/70">🔒 Reveal</button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[10px] text-white/35">Locks reset daily. Loose lips sink market caps.</p>
    </Shell>
  );
}

/* A73 */
export function AgentPenPal() {
  type Msg = { from: "you" | "agent"; role: string; text: string };
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<Msg[]>(() => read("penpal", []));
  const send = () => {
    const t = draft.trim();
    if (!t) return;
    const a = AGENTS[idx];
    const yelling = t === t.toUpperCase() && /[A-Z]/.test(t);
    const excited = (t.match(/!/g) ?? []).length >= 2;
    const len = t.length > 200 ? "a whole novel" : t.length > 60 ? "a proper letter" : "a delightfully short note";
    const reply = `Dear friend,\n\n${a.role} received ${len}${yelling ? " — and yes, we heard the CAPS LOCK, we respect the passion" : ""}${excited ? " — the exclamation marks have been framed" : ""}. ${a.job.toLowerCase()} continues apace. Write again soon; the antenna misses you already.\n\nYours in ORBITX,\n${a.role} 🖊️`;
    const n: Msg[] = [...thread, { from: "you", role: a.role, text: t }, { from: "agent", role: a.role, text: reply }];
    setThread(n); write("penpal", n); setDraft("");
  };
  return (
    <Shell icon={Mail} title="Agent Pen Pal" sub="Write letters. Get letters back.">
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a, i) => (
          <button key={a.role} onClick={() => setIdx(i)} className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", idx === i ? "text-black" : "bg-white/5 text-white/60")} style={idx === i ? { background: a.color } : undefined}>{a.role}</button>
        ))}
      </div>
      <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
        {thread.length === 0 && <p className="text-[11px] text-white/35">No letters yet. The agents check the mailbox hourly.</p>}
        {thread.filter((m) => m.role === AGENTS[idx].role).slice(-6).map((m, i) => (
          <div key={i} className={cn("rounded-xl px-3 py-1.5 text-[11px] whitespace-pre-line", m.from === "you" ? "ml-6 bg-amber-400/15 text-amber-100" : "mr-6 bg-white/[0.05] text-white/75")}>
            <span className="font-bold">{m.from === "you" ? "You" : m.role}: </span>{m.text}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={500} placeholder={`Dear ${AGENTS[idx].role},…`}
          className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-amber-400/50 focus:outline-none" />
        <button onClick={send} className="rounded-xl bg-amber-400/20 px-3 py-2 text-xs font-bold text-amber-200">Send ✉️</button>
      </div>
    </Shell>
  );
}

/* A74 */
export function AgentPhotoBooth() {
  const BACKS = [
    { name: "🚀 Launch Pad", bg: "linear-gradient(135deg,#1e1b4b,#7c3aed)" },
    { name: "🌙 Moon Surface", bg: "linear-gradient(135deg,#0f172a,#475569)" },
    { name: "📊 Chart Cave", bg: "linear-gradient(135deg,#052e16,#10b981)" },
  ];
  const CAPTIONS = ["Squad goals: secured.", "Just agents being agents.", "This photo is up 300% in vibes.", "Say 'burn'! 📸", "The council has assembled.", "No filter. All alpha."];
  const [sel, setSel] = useState<number[]>([2]);
  const [back, setBack] = useState(0);
  const [cap, setCap] = useState(CAPTIONS[0]);
  const toggle = (i: number) => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length >= 3 ? s : [...s, i]));
  return (
    <Shell icon={Camera} title="Agent Photo Booth" sub="Pick 1–3 agents + a backdrop. Say cheese.">
      <div className="flex flex-wrap gap-1.5">
        {AGENTS.map((a, i) => (
          <button key={a.role} onClick={() => toggle(i)} className={cn("rounded-lg px-2 py-1 text-[11px] font-bold", sel.includes(i) ? "text-black" : "bg-white/5 text-white/60")} style={sel.includes(i) ? { background: a.color } : undefined}>{a.role}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {BACKS.map((b, i) => (
          <button key={b.name} onClick={() => setBack(i)} className={cn("flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold", back === i ? "border-amber-400/60 bg-amber-400/10 text-amber-200" : "border-white/10 text-white/60")}>{b.name}</button>
        ))}
      </div>
      <div className="mt-2 overflow-hidden rounded-2xl border border-white/15 p-3" style={{ background: BACKS[back].bg }}>
        <div className="flex items-end justify-center gap-2 pt-6">
          {sel.map((i) => (
            <div key={i} className="flex w-16 flex-col items-center">
              <div className="flex h-16 w-14 items-center justify-center rounded-t-xl text-lg font-black text-black/60" style={{ background: AGENTS[i].color }}>{AGENTS[i].role.slice(0, 2)}</div>
              <div className="w-14 rounded-b-md bg-black/60 py-0.5 text-center text-[8px] font-bold text-white">{AGENTS[i].role}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 bg-black/50 px-2 py-1.5 text-center text-[11px] font-bold italic text-white">"{cap}"</p>
      </div>
      <button onClick={() => setCap(CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)])} className="mt-2 w-full rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80">New caption</button>
    </Shell>
  );
}

/* A75 */
export function AgentFanClub() {
  const BASE = [1200, 860, 2100, 640, 410, 980, 1500];
  const [joins, setJoins] = useState<Record<string, number>>(() => read("fanclub-joins", {}));
  const [member, setMember] = useState(() => read("fanclub-member", ""));
  const join = (i: number) => {
    const r = AGENTS[i].role;
    const n = { ...joins, [r]: (joins[r] ?? 0) + 1 };
    setJoins(n); write("fanclub-joins", n);
    if (!member) { setMember(r); write("fanclub-member", r); }
  };
  const total = (i: number) => BASE[i] + (joins[AGENTS[i].role] ?? 0);
  return (
    <Shell icon={UsersRound} title="Agent Fan Club" sub="Join a club. Get a rank. Feel things.">
      <div className="space-y-1.5">
        {AGENTS.map((a, i) => {
          const mine = member === a.role;
          const founding = total(i) <= BASE[i] + 25;
          return (
            <div key={a.role} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", mine ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-white/[0.03]")}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
              <div className="flex-1">
                <p className="text-xs font-extrabold">{a.role} <span className="font-normal text-white/40">· {total(i).toLocaleString()} members</span></p>
                {mine && <p className="text-[10px] font-bold text-amber-300">{founding ? "⭐ Founding Member" : "💎 Certified Fan"}</p>}
              </div>
              {mine ? <span className="text-[11px] font-bold text-emerald-300">Joined ✓</span>
                : <button onClick={() => join(i)} disabled={!!member} className="rounded-lg bg-amber-400/20 px-2.5 py-1 text-[11px] font-bold text-amber-200 disabled:opacity-30">Join</button>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[10px] text-white/35">One club per human. The agents agreed this was fair.</p>
    </Shell>
  );
}
