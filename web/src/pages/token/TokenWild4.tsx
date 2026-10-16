import { useEffect, useState } from "react";
import { HeartHandshake, Drama, Tv, ChefHat, Shirt, Guitar, Podcast, Newspaper, CloudSun, Megaphone, Scale, Star, Hammer, MessageCircle, Angry, ListChecks, CalendarCheck, VenetianMask, Lightbulb, ScrollText, Award, Palmtree } from "lucide-react";
import { cn } from "@/lib/utils";

const LS = (k: string) => `orbitx-wild4-${k}`;
function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(LS(key)); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function write(key: string, val: unknown) {
  try { localStorage.setItem(LS(key), JSON.stringify(val)); } catch { /* ignore */ }
}
const ROLES = ["BUILDER", "SCOUT", "TRADER", "GUARD", "MINER", "ORACLE", "PILOT"] as const;

// ---------- ONE internal Shell ----------
function Shell({ icon: Icon, title, sub, children, tint = "bg-amber-400/15 text-amber-300" }: {
  icon: React.ComponentType<{ className?: string }>; title: string; sub: string; children: React.ReactNode; tint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tint)}>
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

/* ------------------------------------------------------------------ */
/* W67 AgentTherapy */
/* ------------------------------------------------------------------ */
const THERAPY: Record<string, string> = {
  TRADER: "I buy high and sell low and I'm tired of pretending it's a strategy. It's a cry for help.",
  SCOUT: "Everyone wants my alpha but nobody asks how I am. I am three missed pumps away from quitting.",
  GUARD: "I trust no one. Not even my own password manager. Especially not my own password manager.",
  MINER: "I have a recurring dream where the gas fees are higher than my entire net worth. Then I wake up. Same thing.",
  ORACLE: "I see three candles into the future and all I see is people ignoring me and buying the top anyway.",
  PILOT: "They call it turbulence. I call it Wednesday.",
  BUILDER: "I shipped a feature at 3am and the deploy went fine. I've been waiting for the other shoe to drop for 9 days.",
};
/* W67 */
export function AgentTherapy() {
  const [role, setRole] = useState<string>("TRADER");
  return (
    <Shell icon={HeartHandshake} title="Agent Therapy Couch" sub="Confessions from the 3D office, $200/hr" tint="bg-rose-400/15 text-rose-300">
      <div className="flex flex-wrap gap-1.5">
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRole(r)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold transition", role === r ? "bg-rose-400/25 text-rose-200" : "bg-white/5 text-white/50 hover:bg-white/10")}>{r}</button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <p className="text-[11px] font-bold text-rose-300">{role} <span className="text-white/30">· session in progress</span></p>
        <p className="mt-1 text-sm italic text-white/85">"{THERAPY[role]}"</p>
        <p className="mt-2 text-[10px] text-white/35">Dr. Orbit nods slowly, bills another hour.</p>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W68 AgentDrama */
/* ------------------------------------------------------------------ */
const TWISTS = [
  "SCOUT saw GUARD's browser history. 247 tabs. All of them 'am I a good boy quiz'.",
  "TRADER faked her own liquidation to avoid a team meeting. It worked.",
  "MINER has been running the office coffee machine on mainnet this whole time.",
  "ORACLE predicted the plot twist but nobody believed her because she says that every week.",
  "PILOT flew the office one inch to the left and nobody noticed except the office plant.",
  "BUILDER shipped a feature nobody asked for: feelings. They now require a reboot.",
  "GUARD changed the Wi-Fi password to something nobody knows. Including himself.",
  "SCOUT's 'alpha' was just a typo in a group chat that went up 400%.",
  "ORACLE's crystal ball is a snow globe from a gas station. It has never been wrong.",
  "TRADER sold her emotions at the top and bought regret at the bottom. Classic.",
];
/* W68 */
export function AgentDrama() {
  const [ep, setEp] = useState(() => read<number>("drama-ep", 12));
  const twist = TWISTS[ep % TWISTS.length];
  const next = () => { const n = ep + 1; setEp(n); write("drama-ep", n); };
  return (
    <Shell icon={Drama} title="Days of Our Orbits" sub="The agents' soap opera — now with 40% more crying" tint="bg-purple-400/15 text-purple-300">
      <p className="text-[11px] font-bold uppercase tracking-wider text-purple-300">Episode {ep}</p>
      <p className="mt-1 text-sm font-semibold text-white/90">"{twist}"</p>
      <p className="mt-2 text-[11px] text-white/40">Previously: someone rugged the emotional support couch.</p>
      <button onClick={next} className="mt-3 w-full rounded-xl bg-purple-400/20 py-2 text-xs font-bold text-purple-200 hover:bg-purple-400/30">Next episode</button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W69 AgentRealityShow */
/* ------------------------------------------------------------------ */
/* W69 */
export function AgentRealityShow() {
  const [out, setOut] = useState<string[]>(() => read<string[]>("reality-out", []));
  const alive = ROLES.filter((r) => !out.includes(r));
  const voteOff = (r: string) => { const n = [...out, r]; setOut(n); write("reality-out", n); };
  const reset = () => { setOut([]); write("reality-out", []); };
  return (
    <Shell icon={Tv} title="Survivor: OrbitX Island" sub="Vote an agent off the island. No mercy." tint="bg-sky-400/15 text-sky-300">
      {alive.length === 1 ? (
        <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-center">
          <p className="text-sm font-extrabold text-amber-200">🏆 {alive[0]} WINS THE ISLAND</p>
          <p className="mt-1 text-[11px] text-white/50">Prize: one (1) untouched coffee machine and bragging rights forever.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {alive.map((r) => (
            <div key={r} className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5">
              <span className="text-xs font-bold text-white/85">{r}</span>
              <button onClick={() => voteOff(r)} className="rounded-lg bg-red-400/20 px-2 py-1 text-[10px] font-bold text-red-200 hover:bg-red-400/30">Vote off</button>
            </div>
          ))}
        </div>
      )}
      {out.length > 0 && <p className="mt-2 text-[11px] text-white/40">Elimination order: {out.join(" → ")}</p>}
      <button onClick={reset} className="mt-2 text-[11px] font-bold text-white/40 hover:text-white/70">Restart season</button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W70 AgentCooking */
/* ------------------------------------------------------------------ */
const RECIPES: Record<string, { dish: string; steps: string[] }> = {
  BUILDER: { dish: "Deploymnet Noodles", steps: ["Boil water. Forget about it. Deploy a fix.", "Add noodles and a breaking change.", "Serve at 3am. Garnish with a changelog nobody reads."] },
  SCOUT: { dish: "Alpha Avocado Toast", steps: ["Find an avocado before anyone knows avocados exist.", "Pay 400% over ask. Post about it.", "Realize it was actually a potato. Post that too."] },
  TRADER: { dish: "Liquidation Lasagna", steps: ["Layer hope, leverage, and denial.", "Bake at 125x until margin call.", "Serve cold. Like your portfolio."] },
  GUARD: { dish: "Trustless Tofu", steps: ["Verify the tofu's contract. Read it eleven times.", "Cook it in a sandboxed pan.", "Eat alone. Security."] },
  MINER: { dish: "Hash-Rate Hash Browns", steps: ["Shred potatoes. Shred your sleep schedule.", "Fry until golden or until gas fees spike.", "Share with no one. The block is yours."] },
  ORACLE: { dish: "Prophecy Pancakes", steps: ["Mix batter while predicting three pancakes ahead.", "Flip before the flip is priced in.", "The pancakes know. They always knew."] },
  PILOT: { dish: "Turbulence Tacos", steps: ["Assemble tacos during a barrel roll.", "Lose one taco to 'atmospheric conditions'.", "Land. Apologize to the tacos."] },
};
/* W70 */
export function AgentCooking() {
  const [role, setRole] = useState<string>("TRADER");
  const [yums, setYums] = useState<Record<string, number>>(() => read("cooking-yums", {}));
  const r = RECIPES[role];
  const yum = () => { const n = { ...yums, [role]: (yums[role] ?? 0) + 1 }; setYums(n); write("cooking-yums", n); };
  return (
    <Shell icon={ChefHat} title="Hell's Oracle: Kitchen Edition" sub="The agents' signature dishes" tint="bg-orange-400/15 text-orange-300">
      <div className="flex flex-wrap gap-1.5">
        {ROLES.map((ag) => (
          <button key={ag} onClick={() => setRole(ag)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", role === ag ? "bg-orange-400/25 text-orange-200" : "bg-white/5 text-white/50 hover:bg-white/10")}>{ag}</button>
        ))}
      </div>
      <p className="mt-3 text-sm font-extrabold text-white/90">{r.dish}</p>
      <ol className="mt-1.5 space-y-1">{r.steps.map((s, i) => (<li key={i} className="text-[12px] text-white/60"><span className="font-bold text-orange-300">{i + 1}.</span> {s}</li>))}</ol>
      <button onClick={yum} className="mt-3 w-full rounded-xl bg-orange-400/20 py-2 text-xs font-bold text-orange-200 hover:bg-orange-400/30">😋 Yum ({yums[role] ?? 0})</button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W71 AgentFashion */
/* ------------------------------------------------------------------ */
const OUTFITS = [
  { name: "Diamond Tuxedo", desc: "Black-tie. Literally made of ties and black diamonds." },
  { name: "Spacesuit Couture", desc: "Zero gravity, zero dress code violations." },
  { name: "Pajamas of Power", desc: "Ruling the metaverse from bed. Respect." },
  { name: "Diamond Armor", desc: "Hands too diamond to ever sell. Literally." },
];
/* W71 */
export function AgentFashion() {
  const [votes, setVotes] = useState<Record<string, number>>(() => read("fashion-votes", {}));
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const vote = (n: string) => { const v = { ...votes, [n]: (votes[n] ?? 0) + 1 }; setVotes(v); write("fashion-votes", v); };
  const leader = OUTFITS.reduce((a, b) => (votes[b.name] ?? 0) > (votes[a.name] ?? 0) ? b : a);
  return (
    <Shell icon={Shirt} title="Orbit's Fit Check" sub="Vote Orbit's outfit for the gala tonight" tint="bg-pink-400/15 text-pink-300">
      <div className="space-y-1.5">
        {OUTFITS.map((o) => {
          const v = votes[o.name] ?? 0;
          return (
            <button key={o.name} onClick={() => vote(o.name)} className="w-full rounded-lg bg-white/5 px-2.5 py-2 text-left hover:bg-white/10">
              <div className="flex justify-between text-xs font-bold text-white/85"><span>{o.name}</span><span className="text-pink-300">{v} votes</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-pink-400/70" style={{ width: total ? `${(v / total) * 100}%` : "0%" }} /></div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/45">👑 Leader: <span className="font-bold text-pink-200">{leader.name}</span> — {leader.desc}</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W72 AgentBand */
/* ------------------------------------------------------------------ */
const BAND = ["TRADER", "SCOUT", "MINER", "PILOT"] as const;
const INSTRUMENTS = ["Keytar", "Theremin", "Bagpipes", "Cowbell", "Kazoo of Destiny", "Air Drums", "Bass (the fish)", "Dubstep Accordion"];
const SETLISTS = ["Buy High (Anthem of Pain)", "Rugpull Serenade", "Gas Fees Blues", "Diamond Hands Ballad", "The 4AM Deploy (extended remix)"];
/* W72 */
export function AgentBand() {
  const [gear, setGear] = useState<Record<string, string>>({ TRADER: "Keytar", SCOUT: "Theremin", MINER: "Cowbell", PILOT: "Kazoo of Destiny" });
  const [playing, setPlaying] = useState(false);
  return (
    <Shell icon={Guitar} title="The Liquidations (live)" sub="The agents' band. It is exactly as good as it sounds." tint="bg-lime-400/15 text-lime-300">
      <div className="space-y-1.5">
        {BAND.map((r) => (
          <div key={r} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
            <span className="text-xs font-bold text-white/85">{r}</span>
            <select value={gear[r]} onChange={(e) => setGear({ ...gear, [r]: e.target.value })} className="rounded-lg bg-black/40 px-2 py-1 text-[11px] text-white/80 outline-none">
              {INSTRUMENTS.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
        ))}
      </div>
      <button onClick={() => setPlaying(!playing)} className="mt-3 w-full rounded-xl bg-lime-400/20 py-2 text-xs font-bold text-lime-200 hover:bg-lime-400/30">{playing ? "⏹ Stop the noise" : "▶ Play a set"}</button>
      {playing && (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[11px] font-bold text-lime-300">SETLIST</p>
          {SETLISTS.slice(0, 3).map((s, i) => <p key={i} className="text-[12px] text-white/65">🎵 {i + 1}. {s}</p>)}
          <p className="mt-1.5 text-[11px] italic text-white/50">Crowd reaction: 3 people cheering, 1 person asking for a refund, 1 dog howling in key.</p>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W73 AgentPodcast2 */
/* ------------------------------------------------------------------ */
const EPS = [
  { t: "Ep 41: I Bought the Top and I'll Do It Again", s: "TRADER: 'So I'm staring at the chart—' SCOUT: 'Don't.' TRADER: 'I bought.' [47 minutes of silence]" },
  { t: "Ep 42: Gas Fees Ruined My Wedding", s: "MINER: 'The vows were beautiful but the transaction failed three times. We're legally married on L2.'" },
  { t: "Ep 43: ORACLE Sees Your Search History", s: "ORACLE: 'I know what you googled.' HOST: 'Please don't—' ORACLE: ''am I the rugpull? quiz.''" },
  { t: "Ep 44: GUARD Trusts No One, Including This Mic", s: "GUARD: 'Is this thing recording?' HOST: 'Yes.' GUARD: [hangs up] HOST: 'He does this every week.'" },
  { t: "Ep 45: PILOT Lands Somewhere (Nobody Knows Where)", s: "PILOT: 'Great news, we've landed!' CO-PILOT: 'Where?' PILOT: '...' [transmission ends]" },
];
/* W73 */
export function AgentPodcast2() {
  const [ep, setEp] = useState<number | null>(null);
  return (
    <Shell icon={Podcast} title="Orbit FM" sub="The agents' podcast. 5 stars (from their moms)" tint="bg-cyan-400/15 text-cyan-300">
      <div className="space-y-1.5">
        {EPS.map((e, i) => (
          <div key={i} className="rounded-lg bg-white/5 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-white/85">{e.t}</p>
              <button onClick={() => setEp(ep === i ? null : i)} className="shrink-0 rounded-lg bg-cyan-400/20 px-2 py-1 text-[10px] font-bold text-cyan-200 hover:bg-cyan-400/30">{ep === i ? "⏸" : "▶"}</button>
            </div>
            {ep === i && <p className="mt-1.5 rounded-lg bg-black/40 p-2 text-[11px] italic text-white/60">"{e.s}"</p>}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W74 AgentNews2 */
/* ------------------------------------------------------------------ */
const HEADLINES = [
  "BREAKING: GUARD denies the office plant is a rug. Plant unavailable for comment.",
  "Local trader buys high, sells low, blames 'the vibes'. More at 11.",
  "MINER discovers new form of matter: pure FOMO. Scientists baffled, degens unsurprised.",
  "ORACLE predicts rain. It rains. ORACLE now insufferable, sources confirm.",
  "PILOT lands office 'somewhere'. Location classified. Coffee still hot.",
  "BUILDER ships update that fixes bug nobody had. Introduces 3 new ones. 'Ship it.'",
  "SCOUT's alpha turns out to be a typo again. Market still up 400%.",
  "Weather: 100% chance of red candles with scattered hopium.",
];
/* W74 */
export function AgentNews2() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((p) => (p + 1) % HEADLINES.length), 4000); return () => clearInterval(t); }, []);
  return (
    <Shell icon={Newspaper} title="Orbit News Network" sub="All the news that's fit to degen" tint="bg-red-400/15 text-red-300">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-400" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-red-300">Live</p>
      </div>
      <p className="mt-2 min-h-12 text-sm font-semibold text-white/90 transition-opacity">"{HEADLINES[i]}"</p>
      <div className="mt-2 flex gap-1">
        {HEADLINES.map((_, j) => <span key={j} className={cn("h-1 flex-1 rounded-full", j === i ? "bg-red-300" : "bg-white/15")} />)}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W75 AgentWeather2 */
/* ------------------------------------------------------------------ */
const WEATHER: Record<string, { sky: string; note: string }> = {
  "Bullish": { sky: "☀️ Green dildos as far as the eye can see", note: "SPF 100 recommended. Sunglasses mandatory. Rent due anyway." },
  "Bearish": { sky: "☔ Raining red candles", note: "Umbrellas useless. Buy orders also useless. Stay inside." },
  "Sideways": { sky: "🌫️ Fog of boredom, visibility: one crab", note: "Traders seen walking in circles. Nothing happens. Beautiful." },
  "Euphoric": { sky: "🌈 Double rainbow made of pure hopium", note: "Euphoria levels critical. Please touch grass immediately." },
  "Rugged": { sky: "🌪️ Category 5 liquidity tornado", note: "The floor is gone. The floor was never there. Good luck." },
};
/* W75 */
export function AgentWeather2() {
  const [mood, setMood] = useState("Bullish");
  const w = WEATHER[mood];
  return (
    <Shell icon={CloudSun} title="OrbitX Weather Channel" sub="Forecast for the 3D world, powered by market mood" tint="bg-teal-400/15 text-teal-300">
      <div className="flex flex-wrap gap-1.5">
        {Object.keys(WEATHER).map((m) => (
          <button key={m} onClick={() => setMood(m)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", mood === m ? "bg-teal-400/25 text-teal-200" : "bg-white/5 text-white/50 hover:bg-white/10")}>{m}</button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <p className="text-[11px] font-bold text-teal-300">{mood.toUpperCase()} SKIES</p>
        <p className="mt-1 text-sm text-white/85">{w.sky}</p>
        <p className="mt-1 text-[11px] italic text-white/45">{w.note}</p>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W76 AgentSports */
/* ------------------------------------------------------------------ */
const PLAYS = [
  "AND HE BUYS AT THE TOP— OH WHAT A MOVE! The crowd is silent. His portfolio is screaming.",
  "She sets a stop-loss! She CANCELS the stop-loss! Bold strategy, let's see if it pays off.",
  "ORACLE calls the reversal THREE CANDLES EARLY! Nobody listened! Nobody ever listens!",
  "GUARD with the defensive play, locking the liquidity pool! The crowd goes mild!",
  "PILOT attempts a leveraged long in heavy turbulence! IT'S... it's gone. It's all gone.",
  "MINER digs deep into the order book and finds... dust. Beautiful, beautiful dust.",
  "SCOUT spots alpha on the wing! He passes it to TRADER! She fumbles it at the all-time high!",
  "BUILDER ships a fix MID-GAME! The rules have changed! Everyone is confused!",
];
/* W76 */
export function AgentSports() {
  const [lines, setLines] = useState<string[]>([PLAYS[0]]);
  const call = () => {
    const pool = [...PLAYS].sort(() => Math.random() - 0.5);
    setLines(pool.slice(0, 3));
  };
  return (
    <Shell icon={Megaphone} title="OrbitX Sports Desk" sub="Trade commentary, but make it the Super Bowl" tint="bg-emerald-400/15 text-emerald-300">
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <p key={i} className="rounded-lg bg-black/30 p-2 text-[12px] font-semibold text-white/80">🎙️ {l}</p>
        ))}
      </div>
      <button onClick={call} className="mt-3 w-full rounded-xl bg-emerald-400/20 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-400/30">Call the next play</button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W77 AgentCourtroom */
/* ------------------------------------------------------------------ */
const CRIMES = ["ate the last ramen", "sold at the literal bottom", "used 'wen moon' unironically", "changed the Wi-Fi password", "rugged the group chat's feelings"];
const VERDICTS = [
  "GUILTY. Sentence: explain blockchain to your parents at Thanksgiving. Forever.",
  "NOT GUILTY. But morally bankrupt. Court orders 40 hours of community chart-staring.",
  "GUILTY. Punishment: your bags are now everyone else's exit liquidity.",
  "MISTRIAL. The evidence was rugged before the trial began. Typical.",
  "GUILTY. Sentence: one (1) full night of sleep. No charts allowed. Good luck.",
];
/* W77 */
export function AgentCourtroom() {
  const [accused, setAccused] = useState("SCOUT");
  const [crime, setCrime] = useState(CRIMES[0]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const judge = () => setVerdict(VERDICTS[Math.floor(Math.random() * VERDICTS.length)]);
  return (
    <Shell icon={Scale} title="The People's Court of Orbit" sub="Judge Orbit presiding. No appeals. Ever." tint="bg-yellow-400/15 text-yellow-300">
      <p className="text-[11px] font-bold text-white/40">THE ACCUSED</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {ROLES.map((r) => (
          <button key={r} onClick={() => setAccused(r)} className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", accused === r ? "bg-yellow-400/25 text-yellow-200" : "bg-white/5 text-white/50 hover:bg-white/10")}>{r}</button>
        ))}
      </div>
      <p className="mt-2.5 text-[11px] font-bold text-white/40">THE CHARGE</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {CRIMES.map((c) => (
          <button key={c} onClick={() => setCrime(c)} className={cn("rounded-full px-2.5 py-1 text-[11px]", crime === c ? "bg-yellow-400/25 font-bold text-yellow-200" : "bg-white/5 text-white/50 hover:bg-white/10")}>{c}</button>
        ))}
      </div>
      <button onClick={judge} className="mt-3 w-full rounded-xl bg-yellow-400/20 py-2 text-xs font-bold text-yellow-200 hover:bg-yellow-400/30">⚖️ Deliver verdict</button>
      {verdict && <p className="mt-2 rounded-xl border border-yellow-300/20 bg-yellow-400/10 p-3 text-sm font-bold text-yellow-100">{accused} {crime}... {verdict}</p>}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W78 AgentTalentShow */
/* ------------------------------------------------------------------ */
const ACTS = [
  { act: "TRADER juggles red candles", note: "She drops them. Every time. Art." },
  { act: "SCOUT reads terms & conditions", note: "From memory. All 4,000 pages. The crowd weeps." },
  { act: "MINER beatboxes in Morse code", note: "It's just 'SOS' on loop. Mesmerizing." },
  { act: "ORACLE predicts the winner, live", note: "She's already crying. Spoilers." },
  { act: "PILOT lands a paper airplane", note: "Somewhere in the office. Still looking." },
];
/* W78 */
export function AgentTalentShow() {
  const [votes, setVotes] = useState<Record<number, number>>(() => read("talent-votes", {}));
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const vote = (i: number) => { const v = { ...votes, [i]: (votes[i] ?? 0) + 1 }; setVotes(v); write("talent-votes", v); };
  return (
    <Shell icon={Star} title="Orbit's Got Talent" sub="Five acts. One trophy. Zero dignity." tint="bg-violet-400/15 text-violet-300">
      <div className="space-y-1.5">
        {ACTS.map((a, i) => {
          const v = votes[i] ?? 0;
          return (
            <button key={i} onClick={() => vote(i)} className="w-full rounded-lg bg-white/5 px-2.5 py-2 text-left hover:bg-white/10">
              <div className="flex justify-between text-xs font-bold text-white/85"><span>{a.act}</span><span className="text-violet-300">{v}</span></div>
              <p className="text-[10px] italic text-white/40">{a.note}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-400/70" style={{ width: total ? `${(v / total) * 100}%` : "0%" }} /></div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-white/40">Judges' note: "We've seen things. We can't unsee them."</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W79 AgentAuction */
/* ------------------------------------------------------------------ */
const CHORES = [
  { chore: "Clean the rocket exhaust ports", start: 5 },
  { chore: "Defrag ORACLE's crystal ball", start: 10 },
  { chore: "Explain 'impermanent loss' to PILOT", start: 50 },
  { chore: "Water the office plant (it's judging you)", start: 3 },
  { chore: "Sit through TRADER's 2-hour trade recap", start: 100 },
];
/* W79 */
export function AgentAuction() {
  const [idx, setIdx] = useState(() => read<number>("auction-idx", 0));
  const [bid, setBid] = useState(CHORES[read<number>("auction-idx", 0)].start);
  const [coins, setCoins] = useState(() => read<number>("auction-coins", 200));
  const [sold, setSold] = useState<string | null>(null);
  const chore = CHORES[idx];
  const placeBid = (n: number) => { if (coins >= n) { setBid(bid + n); setCoins(coins - n); write("auction-coins", coins - n); } };
  const hammer = () => {
    const winner = ROLES[Math.floor(Math.random() * ROLES.length)];
    setSold(`${winner} won "${chore.chore}" for ${bid} coins!`);
    const n = (idx + 1) % CHORES.length; setIdx(n); write("auction-idx", n);
    setBid(CHORES[n].start); setCoins(coins + 60); write("auction-coins", coins + 60);
  };
  return (
    <Shell icon={Hammer} title="Chore Auction House" sub="Bid your game coins. Somebody has to do it." tint="bg-amber-400/15 text-amber-300">
      <div className="flex justify-between text-[11px]"><span className="text-white/40">Your coins</span><span className="font-bold text-amber-300">🪙 {coins}</span></div>
      <p className="mt-1 text-sm font-extrabold text-white/90">{chore.chore}</p>
      <p className="text-[12px] text-white/50">Current bid: <span className="font-bold text-amber-200">{bid} coins</span></p>
      <div className="mt-2 flex gap-1.5">
        {[1, 5, 10].map((n) => <button key={n} onClick={() => placeBid(n)} className="flex-1 rounded-lg bg-amber-400/20 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-400/30">+{n}</button>)}
        <button onClick={hammer} className="flex-1 rounded-lg bg-white/10 py-1.5 text-xs font-bold text-white/80 hover:bg-white/15">🔨 Sold!</button>
      </div>
      {sold && <p className="mt-2 text-[11px] italic text-white/50">{sold}</p>}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W80 AgentGossip */
/* ------------------------------------------------------------------ */
const GOSSIPS = [
  { tease: "PILOT was seen...", reveal: "...landing the office on the wrong planet. Again. The rent there is cheaper, apparently." },
  { tease: "SCOUT's group chat leaked...", reveal: "...it's just him sending himself 'GM' every morning. Self-care." },
  { tease: "GUARD has a secret...", reveal: "...a second wallet. For 'emergencies'. The emergency is brunch." },
  { tease: "TRADER cried during...", reveal: "...a green candle. Happy tears. Then it turned red. Different tears." },
  { tease: "MINER's been acting weird...", reveal: "...he's been talking to the ASICs like they're pets. They have names now." },
  { tease: "ORACLE knew you'd read this...", reveal: "...she predicted your exact face. Unimpressed. She was right." },
  { tease: "BUILDER was caught...", reveal: "...pushing to main on a Friday. At 4:59pm. The audacity." },
  { tease: "The office plant...", reveal: "...is the only one who hasn't been rugged. Suspicious." },
];
/* W80 */
export function AgentGossip() {
  const [flipped, setFlipped] = useState<number[]>([]);
  const flip = (i: number) => setFlipped(flipped.includes(i) ? flipped.filter((f) => f !== i) : [...flipped, i]);
  return (
    <Shell icon={MessageCircle} title="OrbitX Gossip Column" sub="Tap to reveal. You didn't hear it from us." tint="bg-fuchsia-400/15 text-fuchsia-300">
      <div className="grid grid-cols-2 gap-1.5">
        {GOSSIPS.map((g, i) => (
          <button key={i} onClick={() => flip(i)} className={cn("min-h-20 rounded-xl border p-2 text-left text-[11px] transition", flipped.includes(i) ? "border-fuchsia-300/30 bg-fuchsia-400/10" : "border-white/10 bg-white/5 hover:bg-white/10")}>
            {flipped.includes(i) ? <span className="text-white/75">{g.reveal}</span> : <span className="font-bold text-fuchsia-200">{g.tease}</span>}
          </button>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W81 AgentPetPeeves */
/* ------------------------------------------------------------------ */
const PEEVES: Record<string, string> = {
  BUILDER: "People who say 'just one small change' — it's never small, it's never one, and it's always Friday.",
  SCOUT: "When someone asks 'wen moon?' under his carefully researched 40-tweet thread.",
  TRADER: "Paper hands. Also diamond hands. Honestly, hands in general.",
  GUARD: "Passwords on sticky notes. He has seen things. Terrible things.",
  MINER: "'Crypto is bad for the environment' — said from a phone charged by coal.",
  ORACLE: "Being asked to predict the future for free at parties.",
  PILOT: "Passengers who clap when the plane lands. And the market. Don't clap.",
};
/* W81 */
export function AgentPetPeeves() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Shell icon={Angry} title="Pet Peeves, Unfiltered" sub="Tap an agent. Brace yourself." tint="bg-red-400/15 text-red-300">
      <div className="space-y-1.5">
        {ROLES.map((r) => (
          <div key={r}>
            <button onClick={() => setOpen(open === r ? null : r)} className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold transition", open === r ? "bg-red-400/20 text-red-200" : "bg-white/5 text-white/70 hover:bg-white/10")}>
              <span>{r}'s #1 pet peeve</span><span className={cn("transition-transform", open === r && "rotate-90")}>▶</span>
            </button>
            <div className={cn("grid transition-all", open === r ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
              <div className="overflow-hidden"><p className="rounded-b-lg bg-black/30 p-2.5 text-[12px] italic text-white/70">"{PEEVES[r]}"</p></div>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W82 AgentBucketList */
/* ------------------------------------------------------------------ */
const BUCKET: Record<string, string[]> = {
  TRADER: ["Buy the actual bottom (not just claim it)", "Hold something for a full year", "Apologize to a stop-loss", "Touch grass during a bull run", "Retire before the next bear market"],
  PILOT: ["Land somewhere on purpose", "Fly through a green candle", "Get a parking spot at the moon", "Survive a week without turbulence", "Teach the office plant to fly"],
  MINER: ["Mine the last block (ambitious)", "Sleep 8 hours straight", "See sunlight (voluntarily)", "Pay gas fees without crying", "Retire to a beach with no Wi-Fi"],
};
/* W82 */
export function AgentBucketList() {
  const [done, setDone] = useState<Record<string, boolean>>(() => read("bucket-done", {}));
  const toggle = (k: string) => { const n = { ...done, [k]: !done[k] }; setDone(n); write("bucket-done", n); };
  const totalDone = Object.values(done).filter(Boolean).length;
  return (
    <Shell icon={ListChecks} title="Agent Bucket Lists" sub="Before the next bear market takes us all" tint="bg-blue-400/15 text-blue-300">
      <p className="text-[11px] text-white/40">Completed: <span className="font-bold text-blue-300">{totalDone}/15</span></p>
      {Object.entries(BUCKET).map(([role, items]) => (
        <div key={role} className="mt-2">
          <p className="text-[11px] font-bold text-white/60">{role}</p>
          <div className="mt-1 space-y-1">
            {items.map((it) => {
              const k = `${role}:${it}`; const d = !!done[k];
              return (
                <button key={k} onClick={() => toggle(k)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px]", d ? "bg-blue-400/10 text-white/40 line-through" : "bg-white/5 text-white/75 hover:bg-white/10")}>
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", d ? "border-blue-300 bg-blue-400/40 text-[10px] text-white" : "border-white/30")}>{d ? "✓" : ""}</span>{it}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W83 AgentResolutions */
/* ------------------------------------------------------------------ */
const RESOLUTIONS: Record<string, string> = {
  BUILDER: "Stop pushing to main on Fridays",
  SCOUT: "Do my own research before yelling 'ALPHA'",
  TRADER: "Set a stop-loss and actually keep it",
  GUARD: "Trust one (1) person this year",
  MINER: "Go outside. Once. Briefly.",
  ORACLE: "Stop spoiling everyone's trades",
  PILOT: "Land where I meant to land",
};
/* W83 */
export function AgentResolutions() {
  const [status, setStatus] = useState<Record<string, "kept" | "broken">>(() => read("resolutions", {}));
  const toggle = (r: string) => {
    const cur = status[r];
    const n = { ...status, [r]: cur === "kept" ? "broken" : "kept" } as Record<string, "kept" | "broken">;
    setStatus(n); write("resolutions", n);
  };
  return (
    <Shell icon={CalendarCheck} title="New Year, New Bags" sub="Agent resolutions — kept or broken by February" tint="bg-green-400/15 text-green-300">
      <div className="space-y-1.5">
        {ROLES.map((r) => {
          const s = status[r];
          return (
            <div key={r} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
              <p className="text-[12px] text-white/75"><span className="font-bold text-white/90">{r}:</span> "{RESOLUTIONS[r]}"</p>
              <button onClick={() => toggle(r)} className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold", s === "kept" ? "bg-green-400/25 text-green-200" : s === "broken" ? "bg-red-400/25 text-red-200" : "bg-white/10 text-white/50")}>
                {s === "kept" ? "✅ Kept" : s === "broken" ? "💔 Broken" : "Tap"}
              </button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W84 AgentConspiracy */
/* ------------------------------------------------------------------ */
const THEORIES = [
  { who: "GUARD", t: "The user is definitely a whale in disguise. Nobody 'just checks prices' 47 times a day." },
  { who: "SCOUT", t: "The user already knows the top. They always do. They just enjoy watching us panic." },
  { who: "ORACLE", t: "The user's portfolio is a simulation and we're all NPCs. The candles prove it." },
  { who: "TRADER", t: "The user sells exactly when I buy. Coincidence? I think NOT." },
  { who: "MINER", t: "The user controls the gas fees personally. Every spike is them laughing." },
  { who: "PILOT", t: "The user IS the turbulence. I've seen the flight logs." },
  { who: "BUILDER", t: "The user wrote this entire conspiracy board themselves. This theory included." },
];
/* W84 */
export function AgentConspiracy() {
  const [i, setI] = useState(0);
  const th = THEORIES[i % THEORIES.length];
  return (
    <Shell icon={VenetianMask} title="The Agents Suspect YOU" sub="Their conspiracy theories about the user. All true? Probably." tint="bg-indigo-400/15 text-indigo-300">
      <p className="text-[11px] font-bold text-indigo-300">THEORY #{i + 1} — filed by {th.who}</p>
      <p className="mt-2 min-h-14 rounded-xl border border-white/10 bg-black/30 p-3 text-sm italic text-white/85">"{th.t}"</p>
      <button onClick={() => setI(i + 1)} className="mt-3 w-full rounded-xl bg-indigo-400/20 py-2 text-xs font-bold text-indigo-200 hover:bg-indigo-400/30">Reveal next theory</button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W85 AgentAdvice */
/* ------------------------------------------------------------------ */
const ADVICE = [
  { who: "TRADER", a: "Buy now. Sell later. Or sell now. Buy later. One of those. Probably." },
  { who: "SCOUT", a: "I heard from a guy who heard from a guy that you should YOLO. The guy was me." },
  { who: "GUARD", a: "Don't do it. Whatever it is. Don't." },
  { who: "MINER", a: "Have you tried turning your portfolio off and on again?" },
  { who: "ORACLE", a: "The answer is yes. Unless it's no. The candles are unclear." },
  { who: "PILOT", a: "Full send. Turbulence builds character." },
  { who: "BUILDER", a: "Ship it and fix it in production. Works for code, works for life." },
];
/* W85 */
export function AgentAdvice() {
  const [q, setQ] = useState("");
  const [ans, setAns] = useState<{ who: string; a: string; q: string } | null>(null);
  const ask = () => {
    if (!q.trim()) return;
    const pickA = ADVICE[Math.floor(Math.random() * ADVICE.length)];
    setAns({ who: pickA.who, a: pickA.a, q: q.trim() }); setQ("");
  };
  return (
    <Shell icon={Lightbulb} title="Terrible Advice Column" sub="Ask the agents anything. Regret everything." tint="bg-amber-400/15 text-amber-300">
      <div className="flex gap-1.5">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="e.g. should I buy the dip?" className="min-w-0 flex-1 rounded-xl bg-black/40 px-3 py-2 text-xs text-white/85 placeholder:text-white/30 outline-none" />
        <button onClick={ask} className="shrink-0 rounded-xl bg-amber-400/20 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/30">Ask</button>
      </div>
      {ans && (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[11px] text-white/40">You asked: "{ans.q}"</p>
          <p className="mt-1 text-[11px] font-bold text-amber-300">{ans.who} advises:</p>
          <p className="mt-0.5 text-sm italic text-white/85">"{ans.a}"</p>
          <p className="mt-1.5 text-[10px] text-white/35">Disclaimer: this is financial advice in the same way a fortune cookie is a meal.</p>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W86 AgentEulogy */
/* ------------------------------------------------------------------ */
const EULOGIES = [
  { coin: "$HYPEBEAST", words: "It promised the moon and delivered a parking lot. We hardly knew ye — mostly because the liquidity left in week one." },
  { coin: "$MOONSHOTX", words: "Gone but not forgotten. Actually, gone AND forgotten. The dev's last message was 'brb'. That was 14 months ago." },
  { coin: "$SAFESTCOIN", words: "Ironically named. Died doing what it loved: promising reflections to people who can't do math." },
  { coin: "$LAMBOINU", words: "It never bought the Lambo. It never even bought the Hot Wheels. Rest in rekt." },
  { coin: "$DIAMONDPAPA", words: "Papa's gone. The hands were paper all along. We lit a candle. It got rugged too." },
];
/* W86 */
export function AgentEulogy() {
  const [i, setI] = useState(0);
  const e = EULOGIES[i % EULOGIES.length];
  return (
    <Shell icon={ScrollText} title="Eulogies for the Rugged" sub="Delivered by ORACLE, in her most dramatic voice" tint="bg-slate-400/15 text-slate-300">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">In loving memory of</p>
      <p className="mt-1 font-serif text-2xl italic text-white/90">{e.coin}</p>
      <p className="mt-2 font-serif text-sm italic leading-relaxed text-white/70">"{e.words}"</p>
      <p className="mt-2 text-[11px] text-white/35">🕯️ ORACLE dabs her eyes with a red candle. The symbolism is not lost on her.</p>
      <button onClick={() => setI(i + 1)} className="mt-3 w-full rounded-xl bg-slate-400/20 py-2 text-xs font-bold text-slate-200 hover:bg-slate-400/30">Next eulogy</button>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W87 AgentAwards */
/* ------------------------------------------------------------------ */
const CATS = ["Best Dip Buyer", "Most Dramatic Exit", "Loudest Alpha Caller", "Sleepiest Miner", "Best Hair (unanimous)"];
/* W87 */
export function AgentAwards() {
  const [winners, setWinners] = useState<Record<string, string>>(() => read("awards", {}));
  const pickW = (cat: string, role: string) => { const n = { ...winners, [cat]: role }; setWinners(n); write("awards", n); };
  return (
    <Shell icon={Award} title="The Orbitty Awards" sub="The agents' award ceremony. Bribes accepted." tint="bg-yellow-400/15 text-yellow-300">
      <div className="space-y-2">
        {CATS.map((cat) => (
          <div key={cat} className="rounded-lg bg-white/5 px-2.5 py-2">
            <p className="text-xs font-bold text-yellow-200">🏆 {cat}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {ROLES.map((r) => (
                <button key={r} onClick={() => pickW(cat, r)} className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", winners[cat] === r ? "bg-yellow-400/30 text-yellow-100" : "bg-white/5 text-white/45 hover:bg-white/10")}>{r}</button>
              ))}
            </div>
            {winners[cat] && <p className="mt-1 text-[11px] text-white/50">Winner: <span className="font-bold text-yellow-100">{winners[cat]}</span> — acceptance speech: "I'd like to thank my bags."</p>}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W88 AgentRetirement */
/* ------------------------------------------------------------------ */
const PLANS: Record<string, string> = {
  MINER: "Open a beach bar on the moon. No Wi-Fi. No gas fees. Just sand and regret.",
  TRADER: "Retire to a cabin with no charts. Lasted 11 minutes. Came back.",
  SCOUT: "Become a full-time 'I told you so' consultant. The market is endless.",
  GUARD: "A quiet bunker. Password: definitely-not-1234. Probably 1234.",
  ORACLE: "She already retired. In the future. She's back now. It's confusing.",
  PILOT: "Crop duster. For actual crops. The turbulence is free.",
  BUILDER: "Finally sleep. Just... sleep. Wake up, ship one perfect thing, nap again.",
};
/* W88 */
export function AgentRetirement() {
  const [fav, setFav] = useState<string>(() => read<string>("retirement-fav", ""));
  const choose = (r: string) => { setFav(r); write("retirement-fav", r); };
  return (
    <Shell icon={Palmtree} title="Golden Parachutes" sub="The agents' retirement plans. Pick your favorite." tint="bg-teal-400/15 text-teal-300">
      <div className="space-y-1.5">
        {ROLES.map((r) => (
          <button key={r} onClick={() => choose(r)} className={cn("w-full rounded-xl border p-2.5 text-left transition", fav === r ? "border-teal-300/40 bg-teal-400/10" : "border-white/10 bg-white/5 hover:bg-white/10")}>
            <p className="text-xs font-bold text-white/90">{r} {fav === r && "⭐"}</p>
            <p className="mt-0.5 text-[12px] italic text-white/55">"{PLANS[r]}"</p>
          </button>
        ))}
      </div>
      {fav && <p className="mt-2 text-[11px] text-white/45">Your pick: <span className="font-bold text-teal-200">{fav}</span> — excellent taste in delusion.</p>}
    </Shell>
  );
}
