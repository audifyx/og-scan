import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Award, BookOpen, Cake, CalendarDays, Camera, ChevronLeft, Clapperboard, Copy,
  Eye, Film, Flame, Gift, Heart, HeartHandshake, Laugh, Lock, Mail, MapPin,
  MessageCircle, Mic, Music, PartyPopper, PenLine, Play, Plus, Quote, Radio, Send,
  Sparkles, Sunrise, Target, ThumbsUp, Trash2, TrendingUp, UserPlus, Users,
  UsersRound, Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared shell + localStorage hook                                    */
/* ------------------------------------------------------------------ */

function Shell({ icon: Icon, title, sub, children }: {
  icon: ComponentType<{ className?: string }>; title: string; sub?: string; children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-400/12 text-rose-300">
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

function useLocal<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch { return init; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key, v]);
  return [v, setV] as const;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const DEMO = "demo";

/* ------------------------------------------------------------------ */
/* S76 — S78                                                           */
/* ------------------------------------------------------------------ */

/* S76 */
const FEED_DEMO = [
  { id: "d1", name: "Nova", time: "2h", text: "gm orbit fam, holding through the dip like a champ", likes: 24 },
  { id: "d2", name: "DegenDan", time: "4h", text: "just tipped my first $5 on a shill post, community works", likes: 41 },
  { id: "d3", name: "OrbitQueen", time: "6h", text: "the 3D office on /token is unhinged and I love it", likes: 18 },
  { id: "d4", name: "PaperHandsPete", time: "9h", text: "sold the bottom again, back to the rituals board", likes: 57 },
  { id: "d5", name: "Xeno", time: "12h", text: "who is coming to the NYC meetup? bring memes", likes: 12 },
  { id: "d6", name: "Luna", time: "1d", text: "gratitude jar hit 50 notes today, wholesome bull run", likes: 33 },
];
export function FriendFeed() {
  const [draft, setDraft] = useState("");
  const [mine, setMine] = useLocal("orbitx-social4-feed-mine", [] as { id: string; text: string; time: string }[]);
  const [liked, setLiked] = useLocal("orbitx-social4-feed-liked", [] as string[]);
  const toggle = (id: string) => setLiked(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);
  const post = () => {
    if (!draft.trim()) return;
    setMine(m => [{ id: uid(), text: draft.trim(), time: "now" }, ...m]);
    setDraft("");
  };
  return (
    <Shell icon={Users} title="Friend Feed" sub="Community posts — demo content, likes saved locally">
      <div className="mb-3 flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && post()}
          placeholder="Share something with the crew..." className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <button onClick={post} className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-400/20 text-rose-200 hover:bg-rose-400/30"><Send className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2">
        {[...mine.map(p => ({ ...p, name: "You" })), ...FEED_DEMO].slice(0, 8).map(p => {
          const isDemo = p.id.startsWith("d");
          const likes = (p as any).likes ?? 0;
          return (
            <div key={p.id} className="rounded-xl bg-white/5 p-2.5">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-bold">{p.name}</span>
                {isDemo && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">{DEMO}</span>}
                <span className="text-[10px] text-white/30">{p.time}</span>
              </div>
              <p className="text-xs text-white/80">{p.text}</p>
              <button onClick={() => toggle(p.id)}
                className={cn("mt-1.5 flex items-center gap-1 text-[11px]", liked.includes(p.id) ? "text-rose-400" : "text-white/40 hover:text-white/70")}>
                <Heart className={cn("h-3.5 w-3.5", liked.includes(p.id) && "fill-current")} />
                {likes + (liked.includes(p.id) ? 1 : 0)}
              </button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* S77 */
const DM_SEED = [
  { id: "c1", name: "Nova", seed: [{ from: "Nova", text: "gm! you coming to movie night?" }] },
  { id: "c2", name: "DegenDan", seed: [{ from: "DegenDan", text: "saw your kudos, respect" }] },
  { id: "c3", name: "OrbitQueen", seed: [{ from: "OrbitQueen", text: "check the meme of the day, it's you" }] },
];
export function DMs() {
  const [open, setOpen] = useState<string | null>(null);
  const [msgs, setMsgs] = useLocal("orbitx-social4-dms", {} as Record<string, { from: string; text: string }[]>);
  const [draft, setDraft] = useState("");
  const send = (id: string) => {
    if (!draft.trim()) return;
    setMsgs(m => ({ ...m, [id]: [...(m[id] ?? []), { from: "You", text: draft.trim() }] }));
    setDraft("");
  };
  const conv = DM_SEED.find(c => c.id === open);
  return (
    <Shell icon={MessageCircle} title="DMs" sub="Mock inbox — demo conversations, messages saved locally">
      {!conv ? (
        <div className="space-y-2">
          {DM_SEED.map(c => (
            <button key={c.id} onClick={() => setOpen(c.id)} className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-2.5 text-left hover:bg-white/10">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-400/20 text-xs font-extrabold text-rose-200">{c.name[0]}</span>
              <div className="min-w-0"><p className="text-xs font-bold">{c.name}</p><p className="truncate text-[11px] text-white/40">{[...(msgs[c.id] ?? []), ...c.seed].slice(-1)[0].text}</p></div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button onClick={() => setOpen(null)} className="mb-2 flex items-center gap-1 text-[11px] text-white/50 hover:text-white"><ChevronLeft className="h-3.5 w-3.5" /> Back</button>
          <div className="mb-2 max-h-40 space-y-1.5 overflow-y-auto">
            {[...conv.seed, ...(msgs[conv.id] ?? [])].map((m, i) => (
              <div key={i} className={cn("w-fit max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs", m.from === "You" ? "ml-auto bg-rose-400/25" : "bg-white/8")}>{m.text}</div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send(conv.id)}
              placeholder={`Message ${conv.name}...`} className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
            <button onClick={() => send(conv.id)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-400/20 text-rose-200 hover:bg-rose-400/30"><Send className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* S78 */
const GROUPS = [
  { id: "g1", name: "Shill Squad", desc: "coordinate the daily shill", members: 214 },
  { id: "g2", name: "Chart Watchers", desc: "ta but make it vibes", members: 89 },
  { id: "g3", name: "Wholesome Orbit", desc: "gratitude and good energy only", members: 342 },
];
export function GroupChats() {
  const [joined, setJoined] = useLocal("orbitx-social4-groups", [] as string[]);
  const toggle = (id: string) => setJoined(j => j.includes(id) ? j.filter(x => x !== id) : [...j, id]);
  return (
    <Shell icon={UsersRound} title="Group Chats" sub="Demo groups — join/leave saved locally">
      <div className="space-y-2">
        {GROUPS.map(g => {
          const inG = joined.includes(g.id);
          return (
            <div key={g.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-400/20 text-xs font-extrabold text-rose-200">{g.name[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">{g.name} <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">{DEMO}</span></p>
                <p className="truncate text-[11px] text-white/40">{g.desc} · {g.members + (inG ? 1 : 0)} members</p>
              </div>
              <button onClick={() => toggle(g.id)}
                className={cn("h-8 rounded-xl px-3 text-[11px] font-bold", inG ? "bg-white/10 text-white/60 hover:bg-white/15" : "bg-rose-400/25 text-rose-100 hover:bg-rose-400/35")}>
                {inG ? "Leave" : "Join"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/40">You're in {joined.length} of {GROUPS.length} groups.</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* S79 — S80                                                           */
/* ------------------------------------------------------------------ */

/* S79 */
export function EventsCalendar() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const presets: Record<string, string> = useMemo(() => ({
    [key(5)]: "Monthly AMA voice chat",
    [key(12)]: "Movie night — community pick",
    [key(19)]: "Charity drive deadline",
    [key(26)]: "IRL meetup day (demo cities)",
  }), []);
  const [custom, setCustom] = useLocal("orbitx-social4-events", {} as Record<string, string>);
  const [sel, setSel] = useState<number | null>(now.getDate());
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const days = new Date(year, month + 1, 0).getDate();
  const lead = new Date(year, month, 1).getDay();
  const all = { ...presets, ...custom };
  const selEvent = sel != null ? all[key(sel)] : null;
  return (
    <Shell icon={CalendarDays} title="Events Calendar" sub={`${now.toLocaleString("en", { month: "long" })} ${year} — presets + your events`}>
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-white/30">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="py-1">{d}</span>)}
        {Array.from({ length: lead }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = i + 1, has = !!all[key(d)], isSel = sel === d;
          return (
            <button key={d} onClick={() => setSel(d)}
              className={cn("relative aspect-square rounded-lg text-[11px] font-bold", isSel ? "bg-rose-400/40 text-white" : "bg-white/5 hover:bg-white/10", has && !isSel && "text-amber-300")}>
              {d}{has && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-300" />}
            </button>
          );
        })}
      </div>
      <div className="mt-2 min-h-9 rounded-xl bg-white/5 p-2.5 text-xs">
        {sel != null && (selEvent ? <p><span className="font-bold text-amber-300">{month + 1}/{sel}:</span> {selEvent}</p> : <p className="text-white/40">No event on {month + 1}/{sel}.</p>)}
      </div>
      {!adding ? (
        <button onClick={() => setAdding(true)} className="mt-2 flex h-8 items-center gap-1 rounded-xl bg-white/8 px-3 text-[11px] font-bold text-white/70 hover:bg-white/12"><Plus className="h-3.5 w-3.5" /> Add event</button>
      ) : (
        <div className="mt-2 flex gap-2">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Event name..."
            className="h-8 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
          <button onClick={() => { if (sel != null && label.trim()) { setCustom(c => ({ ...c, [key(sel)]: label.trim() })); setLabel(""); setAdding(false); } }}
            className="h-8 rounded-xl bg-rose-400/25 px-3 text-[11px] font-bold text-rose-100 hover:bg-rose-400/35">Save</button>
        </div>
      )}
    </Shell>
  );
}

/* S80 */
const MEETUPS = [
  { id: "m1", city: "New York City", when: "Sat, Oct 24 · 3pm", venue: "Rooftop bar TBD", rsvps: 42 },
  { id: "m2", city: "London", when: "Fri, Oct 30 · 7pm", venue: "Shoreditch pub TBD", rsvps: 31 },
  { id: "m3", city: "Singapore", when: "Sat, Nov 7 · 5pm", venue: "Marina hangout TBD", rsvps: 27 },
  { id: "m4", city: "Lagos", when: "Sun, Nov 15 · 2pm", venue: "Lekki cafe TBD", rsvps: 19 },
  { id: "m5", city: "Austin", when: "Sat, Nov 21 · 4pm", venue: "Downtown spot TBD", rsvps: 15 },
];
export function MeetupMap() {
  const [rsvp, setRsvp] = useLocal("orbitx-social4-meetup-rsvp", [] as string[]);
  const toggle = (id: string) => setRsvp(r => r.includes(id) ? r.filter(x => x !== id) : [...r, id]);
  return (
    <Shell icon={MapPin} title="Meetup Map" sub="Demo cities — RSVP saved locally">
      <div className="space-y-2">
        {MEETUPS.map(m => {
          const going = rsvp.includes(m.id);
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-400/15 text-rose-300"><MapPin className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">{m.city} <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">{DEMO}</span></p>
                <p className="truncate text-[11px] text-white/40">{m.when} · {m.venue} · {m.rsvps + (going ? 1 : 0)} going</p>
              </div>
              <button onClick={() => toggle(m.id)}
                className={cn("h-8 rounded-xl px-3 text-[11px] font-bold", going ? "bg-emerald-400/20 text-emerald-200" : "bg-white/8 text-white/70 hover:bg-white/12")}>
                {going ? "Going ✓" : "RSVP"}
              </button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* S81 — S83                                                           */
/* ------------------------------------------------------------------ */

/* S81 */
const DONO_AMOUNTS = [5, 25, 100];
export function CharityDrive() {
  const GOAL = 5000;
  const [raised, setRaised] = useLocal("orbitx-social4-charity-raised", 1200);
  const [donors, setDonors] = useLocal("orbitx-social4-charity-donors", ["Nova — $100", "Luna — $25"] as string[]);
  const [name, setName] = useState("");
  const pct = Math.min(100, Math.round((raised / GOAL) * 100));
  const donate = (amt: number) => {
    setRaised(r => r + amt);
    setDonors(d => [`${name.trim() || "You"} — $${amt}`, ...d].slice(0, 8));
  };
  return (
    <Shell icon={HeartHandshake} title="Charity Drive" sub="Demo fundraiser — amounts are pretend, progress is real">
      <div className="mb-1 flex items-baseline justify-between text-xs"><span className="font-extrabold text-emerald-300">${raised.toLocaleString()}</span><span className="text-white/40">of ${GOAL.toLocaleString()}</span></div>
      <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mb-3 flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
          className="h-9 w-28 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        {DONO_AMOUNTS.map(a => (
          <button key={a} onClick={() => donate(a)} className="h-9 flex-1 rounded-xl bg-emerald-400/20 text-xs font-bold text-emerald-100 hover:bg-emerald-400/30">+${a}</button>
        ))}
      </div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-white/40">Donor wall</p>
      <div className="space-y-1">
        {donors.map((d, i) => <p key={i} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70">🤝 {d}</p>)}
      </div>
    </Shell>
  );
}

/* S82 */
const GOALS = [
  { id: "g1", label: "1000 shouts this month", target: 1000 },
  { id: "g2", label: "500 welcome messages", target: 500 },
  { id: "g3", label: "250 study sessions", target: 250 },
];
export function CommunityGoals() {
  const [prog, setProg] = useLocal("orbitx-social4-goals", { g1: 640, g2: 210, g3: 98 } as Record<string, number>);
  return (
    <Shell icon={Target} title="Community Goals" sub="Your +1s push the community forward">
      <div className="space-y-3">
        {GOALS.map(g => {
          const v = prog[g.id] ?? 0;
          const pct = Math.min(100, Math.round((v / g.target) * 100));
          return (
            <div key={g.id}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-bold">{g.label}</span>
                <button onClick={() => setProg(p => ({ ...p, [g.id]: (p[g.id] ?? 0) + 1 }))}
                  className="flex h-7 items-center gap-1 rounded-xl bg-rose-400/20 px-2.5 text-[11px] font-bold text-rose-100 hover:bg-rose-400/30">
                  <Plus className="h-3.5 w-3.5" /> Contribute
                </button>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-0.5 text-[10px] text-white/40">{v.toLocaleString()} / {g.target.toLocaleString()} ({pct}%)</p>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* S83 */
const MEMES = [
  { t: "Doge", c: "much orbit, very moon, wow" },
  { t: "Distracted BF", c: "me / my bags / the chart" },
  { t: "Drake", c: "selling the bottom ❌ / diamond hands ✅" },
  { t: "This Is Fine", c: "portfolio down 40%: this is fine" },
  { t: "Success Kid", c: "bought before the pump" },
  { t: "Grumpy Cat", c: "no, I will not read the whitepaper" },
  { t: "Surprised Pikachu", c: "chart goes down after I buy??" },
];
export function MemeOfTheDay() {
  const { idx, dateLabel } = useMemo(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 0);
    const day = Math.floor((d.getTime() - start.getTime()) / 86400000);
    return { idx: day % MEMES.length, dateLabel: d.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" }) };
  }, []);
  const meme = MEMES[idx];
  return (
    <Shell icon={Laugh} title="Meme of the Day" sub={`Refreshing daily — ${dateLabel}`}>
      <div className="rounded-xl border-2 border-dashed border-white/15 bg-white/5 p-4 text-center">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">meme template #{idx + 1}</p>
        <p className="text-lg font-extrabold text-amber-300">{meme.t}</p>
        <p className="mt-2 text-sm italic text-white/80">"{meme.c}"</p>
      </div>
      <p className="mt-2 text-[10px] text-white/30">Text-based classic — pick changes automatically tomorrow.</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* S84 — S91                                                           */
/* ------------------------------------------------------------------ */

/* S84 */
const QUOTES = [
  "Diamond hands are just patience with a cape.",
  "The dip is a discount, not a verdict.",
  "Gm is a lifestyle, not a greeting.",
  "Stack slow, shine later.",
  "Bears hibernate. Bulls grind. Legends build.",
  "FOMO is expensive. Conviction is free.",
  "Every whale was once a shrimp with a plan.",
  "Touch grass, then touch the chart.",
];
export function QuoteWall() {
  const [mine, setMine] = useLocal("orbitx-social4-quotes", [] as string[]);
  const [shown, setShown] = useState(0);
  const [draft, setDraft] = useState("");
  const all = [...mine, ...QUOTES];
  return (
    <Shell icon={Quote} title="Quote Wall" sub="Inspirational degen wisdom">
      <div className="mb-3 rounded-xl bg-white/5 p-4 text-center">
        <p className="text-sm italic text-white/85">"{all[shown % all.length]}"</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setShown(s => s + 1)} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-rose-400/20 text-xs font-bold text-rose-100 hover:bg-rose-400/30">
          <Sparkles className="h-3.5 w-3.5" /> Random quote
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && (draft.trim() && (setMine(m => [draft.trim(), ...m]), setDraft("")))}
          placeholder="Add your own wisdom..." className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <button onClick={() => { if (draft.trim()) { setMine(m => [draft.trim(), ...m]); setDraft(""); } }}
          className="h-9 rounded-xl bg-white/10 px-3 text-[11px] font-bold text-white/70 hover:bg-white/15">Submit</button>
      </div>
    </Shell>
  );
}

/* S85 */
const RITUALS = ["Check the price", "Say gm in chat", "Touch grass", "Read one chart", "Help a newbie", "Drink water"];
export function DailyRituals() {
  const today = new Date().toISOString().slice(0, 10);
  const [streaks, setStreaks] = useLocal("orbitx-social4-rituals", {} as Record<string, { n: number; last: string }>);
  const toggle = (r: string) => setStreaks(s => {
    const cur = s[r];
    const doneToday = cur?.last === today;
    if (doneToday) return { ...s, [r]: { n: Math.max(0, cur.n - 1), last: "" } };
    const cont = cur?.last === new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    return { ...s, [r]: { n: (cont ? cur.n : 0) + 1, last: today } };
  });
  const done = RITUALS.filter(r => streaks[r]?.last === today).length;
  return (
    <Shell icon={Sunrise} title="Daily Rituals" sub={`Checklist + streaks — ${done}/${RITUALS.length} done today`}>
      <div className="space-y-1.5">
        {RITUALS.map(r => {
          const s = streaks[r] ?? { n: 0, last: "" };
          const doneToday = s.last === today;
          return (
            <button key={r} onClick={() => toggle(r)} className="flex w-full items-center gap-2.5 rounded-xl bg-white/5 p-2.5 text-left hover:bg-white/10">
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", doneToday ? "border-amber-300 bg-amber-300/30 text-amber-200" : "border-white/20 text-transparent")}>✓</span>
              <span className={cn("flex-1 text-xs font-bold", doneToday ? "text-white/50 line-through" : "text-white/85")}>{r}</span>
              {s.n > 0 && <span className="flex items-center gap-1 text-[10px] font-bold text-orange-300"><Flame className="h-3 w-3" />{s.n}d</span>}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

/* S86 */
export function GratitudeJar() {
  const [notes, setNotes] = useLocal("orbitx-social4-gratitude", [] as string[]);
  const [draft, setDraft] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const fill = Math.min(100, (notes.length / 20) * 100);
  return (
    <Shell icon={Gift} title="Gratitude Jar" sub="Write what you're grateful for — the jar fills up">
      <div className="mb-3 flex items-end justify-center gap-3">
        <div className="relative h-20 w-14 overflow-hidden rounded-b-2xl rounded-t-md border-2 border-white/20 bg-white/5">
          <div className="absolute bottom-0 w-full bg-gradient-to-t from-amber-400/70 to-amber-300/30 transition-all" style={{ height: `${fill}%` }} />
        </div>
        <div className="pb-1 text-[11px] text-white/40">{notes.length} note{notes.length === 1 ? "" : "s"} in the jar</div>
      </div>
      <div className="mb-2 flex gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && (draft.trim() && (setNotes(n => [draft.trim(), ...n]), setDraft("")))}
          placeholder="I'm grateful for..." className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <button onClick={() => { if (draft.trim()) { setNotes(n => [draft.trim(), ...n]); setDraft(""); } }}
          className="h-9 rounded-xl bg-rose-400/25 px-3 text-[11px] font-bold text-rose-100 hover:bg-rose-400/35">Drop in</button>
      </div>
      <button disabled={!notes.length} onClick={() => setPicked(notes[Math.floor(Math.random() * notes.length)])}
        className="flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-white/8 text-xs font-bold text-white/70 hover:bg-white/12 disabled:opacity-40">
        <Eye className="h-3.5 w-3.5" /> Read a random note
      </button>
      {picked && <p className="mt-2 rounded-xl bg-amber-300/10 p-2.5 text-center text-xs italic text-amber-100/90">"{picked}"</p>}
    </Shell>
  );
}

/* S87 */
export function TimeCapsule() {
  const [caps, setCaps] = useLocal("orbitx-social4-capsule", [] as { id: string; msg: string; open: string }[]);
  const [msg, setMsg] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const today = new Date().toISOString().slice(0, 10);
  const seal = () => {
    if (!msg.trim()) return;
    setCaps(c => [{ id: uid(), msg: msg.trim(), open: date }, ...c]);
    setMsg("");
  };
  return (
    <Shell icon={Lock} title="Time Capsule" sub="Write to your future self — sealed until the open date">
      <div className="mb-2 flex gap-2">
        <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Message to future you..."
          className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-32 rounded-xl bg-white/5 px-2 text-xs text-white/70 outline-none [color-scheme:dark]" />
      </div>
      <button onClick={seal} className="mb-3 flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-rose-400/20 text-xs font-bold text-rose-100 hover:bg-rose-400/30">
        <Lock className="h-3.5 w-3.5" /> Seal the capsule
      </button>
      <div className="space-y-1.5">
        {caps.length === 0 && <p className="text-[11px] text-white/30">No capsules sealed yet.</p>}
        {caps.map(c => {
          const ready = c.open <= today;
          return (
            <div key={c.id} className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5">
              <Lock className={cn("h-4 w-4 shrink-0", ready ? "text-emerald-300" : "text-white/40")} />
              <p className="flex-1 text-xs text-white/70">{ready ? `"${c.msg}"` : "Sealed — can't read until the open date"}</p>
              <span className="text-[10px] text-white/40">{c.open}</span>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* S88 */
const PALS = [
  { id: "p1", name: "StellarSue", trait: "chart poet" },
  { id: "p2", name: "MoonMarco", trait: "gm enthusiast" },
  { id: "p3", name: "RocketRae", trait: "meme scholar" },
];
const PAL_LINES = ["heyo pen pal! what's your orbit story?", "rate today's chart in one emoji", "sending you good vibes and green candles", "what's the best community memory you've got?"];
export function PenPals() {
  const [pal, setPal] = useLocal<string | null>("orbitx-social4-penpal", null);
  const [thread, setThread] = useLocal("orbitx-social4-penpal-thread", [] as { from: string; text: string }[]);
  const [draft, setDraft] = useState("");
  const match = () => { const p = PALS[Math.floor(Math.random() * PALS.length)]; setPal(p.id); setThread([{ from: p.name, text: PAL_LINES[Math.floor(Math.random() * PAL_LINES.length)] }]); };
  const cur = PALS.find(p => p.id === pal);
  const send = () => {
    if (!draft.trim() || !cur) return;
    const mine = { from: "You", text: draft.trim() };
    const reply = { from: cur.name, text: PAL_LINES[Math.floor(Math.random() * PAL_LINES.length)] };
    setThread(t => [...t, mine, reply]);
    setDraft("");
  };
  return (
    <Shell icon={Mail} title="Pen Pals" sub="Demo pen pals — exchange preset messages">
      {!cur ? (
        <div className="text-center">
          <p className="mb-2 text-xs text-white/50">Get matched with a demo pen pal from the community.</p>
          <button onClick={match} className="h-9 rounded-xl bg-rose-400/25 px-4 text-xs font-bold text-rose-100 hover:bg-rose-400/35">Find my pen pal</button>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-xs font-bold">{cur.name} <span className="font-normal text-white/40">· {cur.trait}</span> <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">{DEMO}</span></p>
          <div className="mb-2 max-h-36 space-y-1.5 overflow-y-auto">
            {thread.map((m, i) => <div key={i} className={cn("w-fit max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs", m.from === "You" ? "ml-auto bg-rose-400/25" : "bg-white/8")}>{m.text}</div>)}
          </div>
          <div className="flex gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Write back..." className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
            <button onClick={send} className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-400/20 text-rose-200 hover:bg-rose-400/30"><Send className="h-4 w-4" /></button>
          </div>
          <button onClick={() => { setPal(null); setThread([]); }} className="mt-2 text-[10px] text-white/40 hover:text-white/60">unmatch</button>
        </div>
      )}
    </Shell>
  );
}

/* S89 */
const TOPICS = [
  { id: "t1", name: "DeFi Basics", res: ["What is a DEX?", "How liquidity pools work", "Reading a block explorer"] },
  { id: "t2", name: "Chart Reading", res: ["Candlestick patterns 101", "Support & resistance", "Volume tells the truth"] },
  { id: "t3", name: "Wallet Safety", res: ["Seed phrase hygiene", "Spotting phishing", "Revoking approvals"] },
  { id: "t4", name: "Tokenomics", res: ["Supply vs demand", "Burn mechanics", "Vesting schedules"] },
];
export function StudyGroup() {
  const [joined, setJoined] = useLocal("orbitx-social4-study", [] as string[]);
  const [doneRes, setDoneRes] = useLocal("orbitx-social4-study-res", [] as string[]);
  const toggleR = (id: string) => setDoneRes(d => d.includes(id) ? d.filter(x => x !== id) : [...d, id]);
  return (
    <Shell icon={BookOpen} title="Study Group" sub="Learn together — join a topic, check off resources">
      <div className="space-y-2">
        {TOPICS.map(t => {
          const open = joined.includes(t.id);
          return (
            <div key={t.id} className="rounded-xl bg-white/5 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">{t.name}</p>
                <button onClick={() => setJoined(j => j.includes(t.id) ? j.filter(x => x !== t.id) : [...j, t.id])}
                  className={cn("h-7 rounded-xl px-2.5 text-[11px] font-bold", open ? "bg-white/10 text-white/60" : "bg-rose-400/25 text-rose-100 hover:bg-rose-400/35")}>
                  {open ? "Leave" : "Join"}
                </button>
              </div>
              {open && <div className="mt-1.5 space-y-1">
                {t.res.map(r => {
                  const key = `${t.id}:${r}`, done = doneRes.includes(key);
                  return (
                    <button key={key} onClick={() => toggleR(key)} className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-left hover:bg-white/10">
                      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px]", done ? "border-emerald-300 bg-emerald-300/30 text-emerald-200" : "border-white/20 text-transparent")}>✓</span>
                      <span className={cn("text-[11px]", done && "text-white/40 line-through")}>{r}</span>
                    </button>
                  );
                })}
              </div>}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* S90 */
export function BookClub() {
  const [progress, setProgress] = useLocal("orbitx-social4-book-progress", 35);
  return (
    <Shell icon={BookOpen} title="Book Club" sub="Currently reading (demo title): The Diamond Handbook">
      <div className="mb-3 rounded-xl bg-white/5 p-3 text-center">
        <p className="text-sm font-extrabold">📕 The Diamond Handbook</p>
        <p className="text-[11px] text-white/40">by A. Nonymous · demo pick</p>
      </div>
      <div className="mb-1 flex items-center justify-between text-xs"><span className="font-bold">Your progress</span><span className="font-extrabold text-rose-300">{progress}%</span></div>
      <input type="range" min={0} max={100} value={progress} onChange={e => setProgress(Number(e.target.value))} className="mb-3 w-full accent-rose-400" />
      <div className="rounded-xl bg-white/5 p-2.5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-white/40">Discussion prompt</p>
        <p className="text-xs text-white/80">Chapter 3 says "the chart tests your character, not your wallet" — what tested yours this week?</p>
      </div>
    </Shell>
  );
}

/* S91 */
const MOVIES = ["The Big Short", "Dune: Part Two", "The Social Network", "Wall-E"];
export function MovieNight() {
  const [votes, setVotes] = useLocal("orbitx-social4-movie-votes", {} as Record<string, number>);
  const [mine, setMine] = useLocal<string | null>("orbitx-social4-movie-mine", null);
  const [rsvp, setRsvp] = useLocal("orbitx-social4-movie-rsvp", false);
  const [now, setNow] = useState(Date.now());
  const target = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (((5 - d.getDay()) % 7) || 7));
    d.setHours(20, 0, 0, 0);
    return d.getTime();
  }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const diff = Math.max(0, target - now);
  const dd = Math.floor(diff / 86400000), hh = Math.floor((diff / 3600000) % 24), mm = Math.floor((diff / 60000) % 60), ss = Math.floor((diff / 1000) % 60);
  const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
  const vote = (m: string) => {
    if (mine === m) return;
    setVotes(v => ({ ...v, [m]: (v[m] ?? 0) + 1, ...(mine ? { [mine]: Math.max(0, (v[mine] ?? 1) - 1) } : {}) }));
    setMine(m);
  };
  return (
    <Shell icon={Clapperboard} title="Movie Night" sub="Vote the pick — Friday 8pm countdown">
      <p className="mb-2 flex items-center gap-1.5 rounded-xl bg-white/5 p-2 text-center text-xs font-extrabold text-amber-300">
        <Play className="h-3.5 w-3.5" /> {dd}d {hh}h {mm}m {ss}s to showtime
      </p>
      <div className="space-y-1.5">
        {MOVIES.map(m => {
          const v = votes[m] ?? 0;
          return (
            <button key={m} onClick={() => vote(m)} className={cn("w-full rounded-xl p-2 text-left", mine === m ? "bg-rose-400/25 ring-1 ring-rose-400/40" : "bg-white/5 hover:bg-white/10")}>
              <div className="mb-1 flex items-center justify-between text-xs"><span className="font-bold"><Film className="mr-1 inline h-3.5 w-3.5" />{m}</span><span className="text-white/40">{v} votes</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-rose-400/70 transition-all" style={{ width: `${(v / total) * 100}%` }} /></div>
            </button>
          );
        })}
      </div>
      <button onClick={() => setRsvp(r => !r)}
        className={cn("mt-2 h-9 w-full rounded-xl text-xs font-bold", rsvp ? "bg-emerald-400/20 text-emerald-200" : "bg-white/8 text-white/70 hover:bg-white/12")}>
        {rsvp ? "You're in 🍿" : "RSVP for movie night"}
      </button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* S92 — S100                                                          */
/* ------------------------------------------------------------------ */

/* S92 */
export function PlaylistShare() {
  const [songs, setSongs] = useLocal("orbitx-social4-playlist", [
    { id: "s1", title: "Green Candles", artist: "DJ Degen", votes: 12 },
    { id: "s2", title: "HODL Anthem", artist: "The Whales", votes: 9 },
  ] as { id: string; title: string; artist: string; votes: number }[]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const add = () => {
    if (!title.trim()) return;
    setSongs(s => [{ id: uid(), title: title.trim(), artist: artist.trim() || "Unknown", votes: 0 }, ...s]);
    setTitle(""); setArtist("");
  };
  const up = (id: string) => setSongs(s => s.map(x => x.id === id ? { ...x, votes: x.votes + 1 } : x).sort((a, b) => b.votes - a.votes));
  return (
    <Shell icon={Music} title="Playlist Share" sub="Community playlist — add a track, upvote bangers">
      <div className="mb-2 flex gap-2">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Song title"
          className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <input value={artist} onChange={e => setArtist(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Artist"
          className="h-9 w-28 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <button onClick={add} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-400/20 text-rose-200 hover:bg-rose-400/30"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="space-y-1.5">
        {songs.map(s => (
          <div key={s.id} className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-400/15 text-rose-300"><Music className="h-3.5 w-3.5" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{s.title}</p><p className="truncate text-[11px] text-white/40">{s.artist}</p></div>
            <button onClick={() => up(s.id)} className="flex h-7 items-center gap-1 rounded-xl bg-white/8 px-2.5 text-[11px] font-bold text-white/70 hover:bg-white/12">
              <ThumbsUp className="h-3 w-3" />{s.votes}
            </button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S93 */
const EMOJIS = ["🌅", "🎉", "🌙", "🔥", "🍕", "🚀", "🐳", "🌈"];
export function PhotoWall() {
  const [moments, setMoments] = useLocal("orbitx-social4-photowall", [
    { id: "w1", emoji: "🚀", caption: "first shill IRL — we did it", likes: 15 },
    { id: "w2", emoji: "🌅", caption: "gm from the coast", likes: 9 },
  ] as { id: string; emoji: string; caption: string; likes: number }[]);
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [caption, setCaption] = useState("");
  const [liked, setLiked] = useLocal("orbitx-social4-photowall-liked", [] as string[]);
  const share = () => {
    if (!caption.trim()) return;
    setMoments(m => [{ id: uid(), emoji, caption: caption.trim(), likes: 0 }, ...m]);
    setCaption("");
  };
  return (
    <Shell icon={Camera} title="Photo Wall" sub="Share a moment — emoji + caption, likes saved locally">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {EMOJIS.map(e => <button key={e} onClick={() => setEmoji(e)} className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-base", emoji === e ? "bg-rose-400/30 ring-1 ring-rose-400/50" : "bg-white/5 hover:bg-white/10")}>{e}</button>)}
      </div>
      <div className="mb-2 flex gap-2">
        <input value={caption} onChange={e => setCaption(e.target.value)} onKeyDown={e => e.key === "Enter" && share()} placeholder="Caption this moment..."
          className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <button onClick={share} className="h-9 rounded-xl bg-rose-400/25 px-3 text-[11px] font-bold text-rose-100 hover:bg-rose-400/35">Share</button>
      </div>
      <div className="columns-2 gap-2">
        {moments.map(m => (
          <div key={m.id} className="mb-2 break-inside-avoid rounded-xl bg-white/5 p-3 text-center">
            <p className="text-3xl">{m.emoji}</p>
            <p className="mt-1 text-[11px] text-white/75">{m.caption}</p>
            <button onClick={() => { const l = liked.includes(m.id); setLiked(x => l ? x.filter(i => i !== m.id) : [...x, m.id]); setMoments(ms => ms.map(x => x.id === m.id ? { ...x, likes: x.likes + (l ? -1 : 1) } : x)); }}
              className={cn("mt-1 flex items-center justify-center gap-1 text-[11px]", liked.includes(m.id) ? "text-rose-400" : "text-white/40")}>
              <Heart className={cn("h-3 w-3", liked.includes(m.id) && "fill-current")} />{m.likes}
            </button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S94 */
export function VoiceNotes() {
  const [notes, setNotes] = useLocal("orbitx-social4-voicenotes", [] as { id: string; secs: number; when: string }[]);
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const timer = useRef<number | null>(null);
  const toggleRec = () => {
    if (rec) {
      if (timer.current) clearInterval(timer.current);
      setRec(false);
      if (secs > 0) setNotes(n => [{ id: uid(), secs, when: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }) }, ...n]);
      setSecs(0);
    } else {
      setRec(true);
      timer.current = window.setInterval(() => setSecs(s => s + 1), 1000);
    }
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <Shell icon={Mic} title="Voice Notes" sub="Mock recorder — stores duration + timestamp only, no audio">
      <button onClick={toggleRec} className={cn("mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold",
        rec ? "bg-red-400/25 text-red-200 animate-pulse" : "bg-rose-400/20 text-rose-100 hover:bg-rose-400/30")}>
        <Mic className="h-4 w-4" />{rec ? `Recording… ${fmt(secs)} — tap to stop` : "Hold a thought — tap to record"}
      </button>
      <div className="space-y-1.5">
        {notes.length === 0 && <p className="text-[11px] text-white/30">No voice notes yet.</p>}
        {notes.map(n => (
          <div key={n.id} className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-400/15 text-rose-300"><Volume2 className="h-3.5 w-3.5" /></span>
            <div className="flex-1"><p className="text-xs font-bold">Voice note · {fmt(n.secs)}</p><p className="text-[10px] text-white/40">{n.when}</p></div>
            <button onClick={() => setNotes(x => x.filter(y => y.id !== n.id))} className="text-white/30 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S95 */
export function BirthdayBoard() {
  const [bdays, setBdays] = useLocal("orbitx-social4-birthdays", [
    { id: "b1", name: "Nova", month: 10, day: 28 },
    { id: "b2", name: "DegenDan", month: 11, day: 3 },
  ] as { id: string; name: string; month: number; day: number }[]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [cakes, setCakes] = useLocal("orbitx-social4-cakes", {} as Record<string, number>);
  const today = new Date();
  const upcoming = [...bdays].sort((a, b) => {
    const da = (new Date(today.getFullYear(), a.month - 1, a.day).getTime() - today.getTime() + 366 * 86400000) % (366 * 86400000);
    const db = (new Date(today.getFullYear(), b.month - 1, b.day).getTime() - today.getTime() + 366 * 86400000) % (366 * 86400000);
    return da - db;
  }).slice(0, 5);
  const add = () => {
    const d = new Date(date);
    if (!name.trim() || isNaN(d.getTime())) return;
    setBdays(b => [...b, { id: uid(), name: name.trim(), month: d.getMonth() + 1, day: d.getDate() }]);
    setName(""); setDate("");
  };
  return (
    <Shell icon={Cake} title="Birthday Board" sub="Add birthdays — send cake on the big day">
      <div className="mb-2 flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name"
          className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 w-32 rounded-xl bg-white/5 px-2 text-xs text-white/70 outline-none [color-scheme:dark]" />
        <button onClick={add} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-400/20 text-rose-200 hover:bg-rose-400/30"><Plus className="h-4 w-4" /></button>
      </div>
      <div className="space-y-1.5">
        {upcoming.map(b => (
          <div key={b.id} className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
            <span className="text-xl">🎂</span>
            <div className="flex-1"><p className="text-xs font-bold">{b.name}</p><p className="text-[10px] text-white/40">{b.month}/{b.day}{(cakes[b.id] ?? 0) > 0 ? ` · 🍰 x${cakes[b.id]}` : ""}</p></div>
            <button onClick={() => setCakes(c => ({ ...c, [b.id]: (c[b.id] ?? 0) + 1 }))}
              className="h-7 rounded-xl bg-amber-400/20 px-2.5 text-[11px] font-bold text-amber-100 hover:bg-amber-400/30">🍰 Send cake</button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S96 */
const NEWBIES = [
  { id: "n1", name: "ShrimpSteve", joined: "today" },
  { id: "n2", name: "OrbitOlive", joined: "today" },
  { id: "n3", name: "ChartChad", joined: "yesterday" },
  { id: "n4", name: "LunaLite", joined: "yesterday" },
];
export function WelcomeWagon() {
  const [welcomed, setWelcomed] = useLocal("orbitx-social4-welcomed", [] as string[]);
  const queue = NEWBIES.filter(n => !welcomed.includes(n.id));
  return (
    <Shell icon={UserPlus} title="Welcome Wagon" sub={`Demo new members — ${welcomed.length} welcomed so far`}>
      <div className="space-y-1.5">
        {queue.length === 0 && <p className="rounded-xl bg-emerald-400/10 p-3 text-center text-xs text-emerald-200">Everyone's been welcomed! 🎉</p>}
        {queue.map(n => (
          <div key={n.id} className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-400/20 text-xs font-extrabold text-rose-200">{n.name[0]}</span>
            <div className="flex-1"><p className="text-xs font-bold">{n.name} <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">{DEMO}</span></p><p className="text-[10px] text-white/40">joined {n.joined}</p></div>
            <button onClick={() => setWelcomed(w => [...w, n.id])}
              className="flex h-8 items-center gap-1 rounded-xl bg-rose-400/25 px-3 text-[11px] font-bold text-rose-100 hover:bg-rose-400/35">
              <PartyPopper className="h-3.5 w-3.5" /> Welcome
            </button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S97 */
const MEMBERS = ["Nova", "DegenDan", "OrbitQueen", "PaperHandsPete", "Xeno", "Luna"];
export function KudosBoard() {
  const [feed, setFeed] = useLocal("orbitx-social4-kudos", [
    { id: "k1", to: "Nova", msg: "best chart breakdowns in the game" },
  ] as { id: string; to: string; msg: string }[]);
  const [to, setTo] = useState(MEMBERS[0]);
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState("");
  const give = () => {
    const who = custom.trim() || to;
    if (!msg.trim()) return;
    setFeed(f => [{ id: uid(), to: who, msg: msg.trim() }, ...f].slice(0, 10));
    setMsg(""); setCustom("");
  };
  return (
    <Shell icon={Award} title="Kudos Board" sub="Give someone their flowers">
      <div className="mb-2 flex gap-2">
        <select value={to} onChange={e => setTo(e.target.value)} className="h-9 rounded-xl bg-white/5 px-2 text-xs text-white/80 outline-none [color-scheme:dark]">
          {MEMBERS.map(m => <option key={m}>{m}</option>)}
        </select>
        <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="or custom name"
          className="h-9 w-28 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
      </div>
      <div className="mb-3 flex gap-2">
        <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && give()} placeholder="They deserve kudos because..."
          className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <button onClick={give} className="h-9 rounded-xl bg-amber-400/20 px-3 text-[11px] font-bold text-amber-100 hover:bg-amber-400/30">Give 👏</button>
      </div>
      <div className="space-y-1.5">
        {feed.map(k => (
          <div key={k.id} className="rounded-xl bg-white/5 p-2.5 text-xs">
            <p><span className="font-bold text-amber-300">@{k.to}</span> <span className="text-white/40">—</span> <span className="text-white/80">{k.msg}</span></p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* S98 */
const TRACKS = [
  { t: "Green Candles", a: "DJ Degen" },
  { t: "Bull Market Boogie", a: "The Whales" },
  { t: "Diamond Hands", a: "Nova Beats" },
  { t: "Gm Sunrise", a: "Orbit Choir" },
];
export function CommunityRadio() {
  const [idx, setIdx] = useState(0);
  const [reqs, setReqs] = useLocal("orbitx-social4-radio-reqs", [] as string[]);
  const [req, setReq] = useState("");
  useEffect(() => { const t = setInterval(() => setIdx(i => (i + 1) % TRACKS.length), 20000); return () => clearInterval(t); }, []);
  const track = TRACKS[idx];
  return (
    <Shell icon={Radio} title="Community Radio" sub="Fake station — demo tracks rotate, requests saved locally">
      <div className="mb-3 rounded-xl bg-white/5 p-3">
        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-red-300">● On air</p>
        <p className="text-sm font-extrabold">{track.t}</p>
        <p className="text-[11px] text-white/40">{track.a}</p>
        <div className="mt-2 flex h-8 items-end gap-0.5">
          {[40, 70, 55, 90, 60, 80, 45, 75, 50, 85, 65, 95, 55, 70, 45].map((h, i) => (
            <div key={i} className="w-2 animate-pulse rounded-sm bg-rose-400/60" style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input value={req} onChange={e => setReq(e.target.value)} onKeyDown={e => e.key === "Enter" && (req.trim() && (setReqs(r => [req.trim(), ...r].slice(0, 5)), setReq("")))}
          placeholder="Request a song..." className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
        <button onClick={() => { if (req.trim()) { setReqs(r => [req.trim(), ...r].slice(0, 5)); setReq(""); } }}
          className="h-9 rounded-xl bg-rose-400/25 px-3 text-[11px] font-bold text-rose-100 hover:bg-rose-400/35">Request</button>
      </div>
      {reqs.length > 0 && <div className="mt-2 space-y-1">{reqs.map((r, i) => <p key={i} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-white/70">🎵 request: {r}</p>)}</div>}
    </Shell>
  );
}

/* S99 */
const STORY_DEMO = [
  { id: "st1", title: "The night the chart turned green", text: "We were all in voice chat, refreshing like maniacs. Then it happened — three green candles in a row. Someone screamed. Someone cried. PaperHandsPete bought the top. We love him anyway.", by: "Nova" },
  { id: "st2", title: "GM that saved the day", text: "I posted a gm at 6am and the whole channel lit up. Turns out one small word can flip a red morning into a green one. Degenerate? Maybe. Community? Absolutely.", by: "OrbitQueen" },
];
export function CampfireStories() {
  const [mine, setMine] = useLocal("orbitx-social4-stories", [] as { id: string; title: string; text: string; by: string }[]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [readId, setReadId] = useState<string | null>(null);
  const all = [...mine, ...STORY_DEMO];
  const reading = all.find(s => s.id === readId);
  const add = () => {
    if (!title.trim() || !text.trim()) return;
    setMine(m => [{ id: uid(), title: title.trim(), text: text.trim(), by: "You" }, ...m]);
    setTitle(""); setText("");
  };
  return (
    <Shell icon={Flame} title="Campfire Stories" sub="Write a short story — demo campfire tales included">
      {reading ? (
        <div>
          <button onClick={() => setReadId(null)} className="mb-2 flex items-center gap-1 text-[11px] text-white/50 hover:text-white"><ChevronLeft className="h-3.5 w-3.5" /> Back to the fire</button>
          <p className="mb-1 text-sm font-extrabold">{reading.title}</p>
          <p className="mb-2 text-[10px] text-white/40">by {reading.by}</p>
          <p className="rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-white/80">{reading.text}</p>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex gap-2">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Story title"
              className="h-9 flex-1 rounded-xl bg-white/5 px-3 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Tell your tale by the fire..." rows={2}
            className="mb-2 w-full rounded-xl bg-white/5 p-2.5 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-rose-400/40" />
          <button onClick={add} className="mb-3 flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-rose-400/20 text-xs font-bold text-rose-100 hover:bg-rose-400/30">
            <PenLine className="h-3.5 w-3.5" /> Add your story
          </button>
          <div className="space-y-1.5">
            {all.map(s => (
              <button key={s.id} onClick={() => setReadId(s.id)} className="w-full rounded-xl bg-white/5 p-2.5 text-left hover:bg-white/10">
                <p className="text-xs font-bold">🔥 {s.title} <span className="font-normal text-white/40">· {s.by}</span></p>
                <p className="truncate text-[11px] text-white/40">{s.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

/* S100 */
export function YearInReview() {
  const [copied, setCopied] = useState(false);
  const stats = useMemo(() => {
    const read = (k: string, fb: any) => {
      try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; } catch { return fb; }
    };
    const feedLikes: string[] = read("orbitx-social4-feed-liked", []);
    const feedMine: any[] = read("orbitx-social4-feed-mine", []);
    const gratitude: string[] = read("orbitx-social4-gratitude", []);
    const quotes: string[] = read("orbitx-social4-quotes", []);
    const playlist: any[] = read("orbitx-social4-playlist", []);
    const stories: any[] = read("orbitx-social4-stories", []);
    const rituals: Record<string, { n: number }> = read("orbitx-social4-rituals", {});
    const welcomed: string[] = read("orbitx-social4-welcomed", []);
    const groups: string[] = read("orbitx-social4-groups", []);
    const streaks = Object.values(rituals).map(r => r.n ?? 0);
    return [
      { label: "Feed posts published", value: feedMine.length },
      { label: "Posts liked", value: feedLikes.length },
      { label: "Gratitude notes", value: gratitude.length },
      { label: "Quotes submitted", value: quotes.length },
      { label: "Songs added to playlist", value: Math.max(0, playlist.length - 2) },
      { label: "Stories told", value: stories.length },
      { label: "Best ritual streak (days)", value: Math.max(0, ...streaks) },
      { label: "Newbies welcomed", value: welcomed.length },
      { label: "Groups joined", value: groups.length },
    ];
  }, []);
  const card = `MY ORBITX YEAR IN REVIEW 🚀\n${stats.map(s => `• ${s.label}: ${s.value}`).join("\n")}\nGenerated from my local orbitx-social4 stats.`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(card); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <Shell icon={TrendingUp} title="Year In Review" sub="Generated from your local activity across these widgets">
      <div className="mb-3 rounded-xl bg-gradient-to-br from-rose-500/20 via-amber-400/10 to-violet-500/20 p-4 text-center">
        <p className="text-lg font-extrabold">🚀 My OrbitX Year</p>
        <p className="text-[11px] text-white/50">wrapped from your orbitx-social4-* stats</p>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl bg-white/5 p-2 text-center">
            <p className="text-base font-extrabold text-amber-300">{s.value}</p>
            <p className="text-[10px] text-white/45">{s.label}</p>
          </div>
        ))}
      </div>
      <button onClick={copy} className="flex h-9 w-full items-center justify-center gap-1 rounded-xl bg-rose-400/20 text-xs font-bold text-rose-100 hover:bg-rose-400/30">
        <Copy className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy my year-in-review card"}
      </button>
    </Shell>
  );
}
