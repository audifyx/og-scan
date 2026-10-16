import { useEffect, useMemo, useState } from "react";
import {
  Receipt, Briefcase, Flower2, History, Gauge, FileWarning, Sparkles, Scroll,
  Dices, Newspaper, Disc3, Vote, Footprints, Crown, AlertTriangle, Cookie,
  CloudLightning, Award, Gem, Church, Star, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LS = (k: string) => `orbitx-wild1-${k}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS(key));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function write(key: string, val: unknown) {
  try { localStorage.setItem(LS(key), JSON.stringify(val)); } catch { /* ignore */ }
}
function daySeed(): number {
  const d = new Date().toISOString().slice(0, 10);
  let h = 7;
  for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function Shell({ icon: Icon, title, sub, children, accent = "bg-fuchsia-400/15 text-fuchsia-300" }: {
  icon: React.ComponentType<{ className?: string }>; title: string; sub: string;
  children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent)}>
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

/* W1 */
export function FakeTaxForm() {
  const [bags, setBags] = useState("3");
  const [oneMore, setOneMore] = useState("11");
  const [filed, setFiled] = useState(false);
  const input = "min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white placeholder:text-white/25 focus:border-fuchsia-300/40 focus:outline-none";
  return (
    <Shell icon={Receipt} title="Fake Tax Form" sub="IRS Form 1040-ORBIT (do not submit)">
      <style>{`@keyframes wild1-stamp { 0% { transform: scale(3) rotate(-25deg); opacity: 0; } 60% { transform: scale(0.9) rotate(-12deg); opacity: 1; } 100% { transform: scale(1) rotate(-12deg); opacity: 1; } }`}</style>
      <div className="relative">
        <label className="text-xs font-bold text-white/60">Bags currently held</label>
        <input value={bags} onChange={(e) => setBags(e.target.value)} inputMode="numeric" className={cn(input, "mt-1 w-full")} placeholder="3" />
        <label className="mt-3 block text-xs font-bold text-white/60">Times you said &ldquo;just one more buy&rdquo;</label>
        <input value={oneMore} onChange={(e) => setOneMore(e.target.value)} inputMode="numeric" className={cn(input, "mt-1 w-full")} placeholder="11" />
        <button onClick={() => setFiled(true)}
          className="mt-4 w-full rounded-xl bg-fuchsia-500/20 px-4 py-2.5 text-sm font-black text-fuchsia-200 transition hover:bg-fuchsia-500/30 active:scale-95">
          FILE RETURN
        </button>
        {filed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ animation: "wild1-stamp 0.5s ease-out forwards" }}
              className="rounded-lg border-4 border-emerald-400/80 px-4 py-2 text-center">
              <p className="text-lg font-black text-emerald-300">TAX OWED: $0.00</p>
              <p className="text-[10px] font-bold text-emerald-200/70">we&rsquo;re all gonna make it</p>
            </div>
          </div>
        )}
      </div>
      {filed && <p className="mt-2 text-center text-[11px] italic text-white/40">* not financial or legal advice. obviously.</p>}
    </Shell>
  );
}

/* W2 */
export function OrbitResume() {
  const skills = [
    { name: "Shilling", pct: 99 },
    { name: "Chart staring", pct: 87 },
    { name: "Diamond hands", pct: 76 },
    { name: "Sleeping", pct: 12 },
  ];
  const download = () => {
    const txt = ["ORBIT — Chief Vibes Officer", "orbitx.world | probably online right now", "",
      "EXPERIENCE", "- Chief Vibes Officer, ORBITX (2024–present)", "- Junior Moon Intern, The Blockchain (2023–2024)",
      "- Professional Bag Holder, Various Wallets (2021–2023)", "", "SKILLS",
      ...skills.map((s) => `- ${s.name}: ${s.pct}%`), "", "REFERENCES: available upon pump"].join("\n");
    const url = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = "orbit-resume.txt"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Shell icon={Briefcase} title="Orbit's Resume" sub="Hire him. You can't.">
      <div className="space-y-1.5 text-xs">
        <p className="font-black text-white">ORBIT</p>
        <p className="text-white/50">Chief Vibes Officer, ORBITX <span className="text-white/30">(2024–present)</span></p>
        <p className="text-white/50">Junior Moon Intern, The Blockchain <span className="text-white/30">(2023–2024)</span></p>
        <p className="text-white/50">Professional Bag Holder <span className="text-white/30">(2021–2023)</span></p>
      </div>
      <div className="mt-3 space-y-2">
        {skills.map((s) => (
          <div key={s.name}>
            <div className="flex justify-between text-[11px] font-bold text-white/60">
              <span>{s.name}</span><span>{s.pct}%</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-amber-300" style={{ width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={download}
        className="mt-3 w-full rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white/80 transition hover:bg-white/15 active:scale-95">
        DOWNLOAD AS .TXT (RECRUITERS LOVE THIS)
      </button>
    </Shell>
  );
}

/* W3 */
export function PoeticTerms() {
  const [bloom, setBloom] = useState(0);
  const agree = () => setBloom((b) => b + 1);
  return (
    <Shell icon={Flower2} title="Poetic Terms" sub="Terms of service, but make it art">
      <div className="relative overflow-hidden rounded-xl bg-black/30 p-4 text-center">
        <p className="text-sm italic leading-relaxed text-white/70">
          click buttons gently,<br />the chart owes you nothing,<br />wagmi, maybe
        </p>
        <p className="mt-2 text-[10px] text-white/30">§ 4.20 — vibes are binding in all jurisdictions</p>
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={`${bloom}-${i}`}
            className="pointer-events-none absolute left-1/2 top-1/2 text-lg"
            style={{
              animation: `wild1-bloom 1.4s ease-out forwards`,
              ["--bx" as string]: `${(Math.cos((i / 14) * Math.PI * 2) * 90).toFixed(0)}px`,
              ["--by" as string]: `${(Math.sin((i / 14) * Math.PI * 2) * 70).toFixed(0)}px`,
            }}>
            🌸
          </span>
        ))}
        <style>{`@keyframes wild1-bloom { 0% { transform: translate(-50%,-50%) scale(0.4); opacity: 1; } 100% { transform: translate(calc(-50% + var(--bx)), calc(-50% + var(--by))) scale(1.2); opacity: 0; } }`}</style>
      </div>
      <button onClick={agree}
        className="mt-3 w-full rounded-xl bg-pink-500/20 px-4 py-2.5 text-sm font-black text-pink-200 transition hover:bg-pink-500/30 active:scale-95">
        I AGREE
      </button>
    </Shell>
  );
}

/* W4 */
export function FakeSearchHistory() {
  const seed = [
    "how to tell wife about leverage",
    "is 100x a lot",
    "orbitx price prediction 2030 2040 2050",
    "can you pay rent in vibes",
    "diamond hands surgery near me",
    "what is a blockchain (asking for a friend)",
    "sell button location",
  ];
  const [items, setItems] = useState(seed);
  return (
    <Shell icon={History} title="Fake Search History" sub="Definitely not yours. Allegedly.">
      <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
        {items.map((q) => (
          <div key={q} className="group flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-1.5">
            <span className="text-xs text-white/30">🔍</span>
            <p className="min-w-0 flex-1 truncate text-xs text-white/70">{q}</p>
            <button onClick={() => setItems((p) => p.filter((x) => x !== q))}
              className="text-white/20 opacity-0 transition group-hover:opacity-100 hover:text-red-300" aria-label="delete">✕</button>
          </div>
        ))}
        {items.length === 0 && <p className="py-4 text-center text-xs italic text-white/40">history squeaky clean. suspicious.</p>}
      </div>
      <button onClick={() => setItems([])}
        className="mt-2 w-full rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-200 transition hover:bg-red-500/20 active:scale-95">
        CLEAR BROWSING HISTORY
      </button>
    </Shell>
  );
}

/* W5 */
export function PageCoolnessMeter() {
  const base = useMemo(() => 72 + (daySeed() % 24), []);
  const [val, setVal] = useState(base);
  useEffect(() => {
    const t = setInterval(() => setVal(base + Math.round((Math.random() - 0.5) * 6)), 1100);
    return () => clearInterval(t);
  }, [base]);
  const label = val >= 92 ? "Certified Cool" : val >= 84 ? "Extremely Cool" : val >= 76 ? "Very Cool" : "Suspiciously Cool";
  return (
    <Shell icon={Gauge} title="Page Coolness Meter" sub="Calibrated by scientists (us)">
      <div className="text-center">
        <p className="text-4xl font-black tabular-nums text-cyan-300 transition-all">{val}</p>
        <p className="text-xs font-bold text-white/50">/ 100</p>
      </div>
      <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300 transition-all duration-700" style={{ width: `${val}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-bold text-white/30">
        <span>lukewarm</span><span>molten</span>
      </div>
      <p className="mt-2 rounded-xl bg-cyan-400/10 px-3 py-2 text-center text-xs font-black text-cyan-200">
        ✅ {label}
      </p>
      <p className="mt-1 text-center text-[10px] text-white/30">seeded daily. argue with the calendar, not us.</p>
    </Shell>
  );
}

/* W6 */
export function Custom404Preview() {
  const [shake, setShake] = useState(false);
  const goHome = () => { setShake(true); setTimeout(() => setShake(false), 450); };
  return (
    <Shell icon={FileWarning} title="404 Preview" sub="A page, lost to time">
      <style>{`@keyframes wild1-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }`}</style>
      <div className={cn("overflow-hidden rounded-xl border border-white/10 bg-black/40", shake && "[animation:wild1-shake_0.45s_ease]")}>
        <div className="flex gap-1.5 border-b border-white/10 bg-white/[0.04] px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="p-5 text-center">
          <p className="text-5xl font-black text-white/15">404</p>
          <p className="mt-1 text-sm font-bold text-white/70">This page went to buy milk.</p>
          <p className="text-xs text-white/40">It never came back.</p>
          <button onClick={goHome}
            className="mt-4 rounded-xl bg-white/10 px-5 py-2 text-xs font-black text-white/80 transition hover:bg-white/15 active:scale-95">
            GO HOME
          </button>
          <p className="mt-2 text-[10px] italic text-white/30">the button does nothing. home is a concept.</p>
        </div>
      </div>
    </Shell>
  );
}

/* W7 */
export function MaintenanceSweep() {
  const [tick, setTick] = useState(0);
  const cleaned = ["one jeet", "a fud comment", "paper hands dust", "a weak candle", "someone's stop loss", "doubt itself"];
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <Shell icon={Sparkles} title="Maintenance Sweep" sub="Facilities management, on-chain">
      <style>{`@keyframes wild1-sweep { 0% { left: -3rem; transform: scaleX(1); } 49% { transform: scaleX(1); } 50% { left: calc(100% + 1rem); transform: scaleX(-1); } 100% { left: -3rem; transform: scaleX(-1); } }`}</style>
      <div className="relative h-16 overflow-hidden rounded-xl bg-black/30">
        <div className="absolute inset-x-0 bottom-2 flex justify-between px-3 text-[10px] text-white/25">
          <span>⋯</span><span>⋯</span><span>⋯</span><span>⋯</span>
        </div>
        <span className="absolute top-1/2 -translate-y-1/2 text-3xl" style={{ animation: "wild1-sweep 8s linear infinite" }}>🧹</span>
      </div>
      <p className="mt-2 text-center text-xs italic text-white/50">
        cleaning up {cleaned[tick % cleaned.length]}…
      </p>
      <p className="mt-1 text-center text-[10px] text-white/30">the janitor has diamond hands. respect.</p>
    </Shell>
  );
}

/* W8 */
export function LoreTimeline() {
  const lore = [
    { t: "The Genesis Candle", d: "A single green candle. Nobody knows who lit it. Some say it lit itself." },
    { t: "The Great Dip of Tuesday", d: "Price went down on a Tuesday. The community simply refused to acknowledge Wednesday." },
    { t: "The Prophecy of the Janitor", d: "A janitor swept the chart clean and whispered: 'higher.' We believed him." },
    { t: "The Meme Wars", d: "ORBITX memes defeated three rival discords in single combat. It was mostly GIFs." },
    { t: "Today", d: "You are here. Historians will call this 'the early days.' Probably." },
  ];
  return (
    <Shell icon={Scroll} title="ORBITX Lore" sub="Peer-reviewed by nobody">
      <div className="relative ml-2 space-y-4 border-l-2 border-dashed border-fuchsia-400/30 pl-4">
        {lore.map((e, i) => (
          <div key={e.t} className="relative">
            <span className="absolute -left-[25px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-400/25 text-[9px]">◈</span>
            <p className="text-xs font-black text-fuchsia-200">{i + 1}. {e.t}</p>
            <p className="text-[11px] leading-snug text-white/50">{e.d}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[10px] italic text-white/30">* oral tradition. do not fact-check the janitor.</p>
    </Shell>
  );
}

/* W9 */
export function AlternateUniverse() {
  const universes = [
    { name: "Potato ORBITX", d: "A humble potato. Still up 40x. The eyes have seen things." },
    { name: "ORBITX: The Musical", d: "Every candle is a show tune. The dip is Act II. Bring tissues." },
    { name: "Underwater ORBITX", d: "The chart is a coral reef. Whales are literal now. It's beautiful." },
    { name: "ORBITX Detective Agency", d: "Orbit solves the case of the missing liquidity. It was inside us all along." },
    { name: "Medieval ORBITX", d: "Knights joust for bags. The king taxes jeets. The chart is a tapestry." },
    { name: "ORBITX in Space", d: "Finally accurate. No gravity, no sell pressure, only orbit." },
  ];
  const [i, setI] = useState(0);
  const u = universes[i % universes.length];
  return (
    <Shell icon={Dices} title="Alternate Universe" sub="What if ORBITX was a potato?">
      <div key={i} className="rounded-xl bg-black/30 p-4 text-center">
        <p className="text-sm font-black text-amber-200">{u.name}</p>
        <p className="mt-1 text-xs italic text-white/55">{u.d}</p>
      </div>
      <button onClick={() => setI((x) => x + 1)}
        className="mt-3 w-full rounded-xl bg-amber-400/15 px-4 py-2.5 text-sm font-black text-amber-200 transition hover:bg-amber-400/25 active:scale-95">
        🌀 TRAVEL TO UNIVERSE {(i % universes.length) + 2}
      </button>
      <p className="mt-1 text-center text-[10px] text-white/30">universe {(i % universes.length) + 1} of {universes.length}. no refunds.</p>
    </Shell>
  );
}

/* W10 */
export function PressKit() {
  const [copied, setCopied] = useState(false);
  const boilerplate = "ORBITX is a community-powered digital asset orbiting the future of finance. With cutting-edge blockchain technology and unparalleled vibes, ORBITX is revolutionizing the way the internet feels about charts. To the moon is not a destination — it is a lifestyle.";
  const copy = async () => {
    try { await navigator.clipboard.writeText(boilerplate); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const downloadLogo = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0b0b12"; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#a78bfa"; ctx.font = "150px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("◈", 128, 138);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "orbitx-logo-totally-official.png";
    a.click();
  };
  return (
    <Shell icon={Newspaper} title="Press Kit" sub="For journalists with taste">
      <p className="rounded-xl bg-black/30 p-3 text-[11px] leading-relaxed text-white/60">{boilerplate}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={copy}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white/80 transition hover:bg-white/15 active:scale-95">
          {copied ? "COPIED! 📋" : "COPY TEXT"}
        </button>
        <button onClick={downloadLogo}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white/80 transition hover:bg-white/15 active:scale-95">
          DOWNLOAD LOGO ◈
        </button>
      </div>
      <p className="mt-2 text-center text-[10px] italic text-white/30">logo drawn live on canvas. artisanal. bespoke.</p>
    </Shell>
  );
}

/* W11 */
export function MixtapeMaker() {
  const tracks = [
    "Green Candle Anthem", "Dip Buyer's Lullaby", "Jeet Sweeper (Sweep Mix)",
    "To The Moon (Acoustic)", "Paper Hands Blues", "Liquidity Love Song",
    "HODL My Hand", "The Janitor's Whisper",
  ];
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : p.length < 3 ? [...p, t] : p));
  const titles = ["MAXIMUM VIBES VOL. 1", "CHARTS & CHILL", "DIAMOND TAPES", "ORBITAL GROOVES", "BAGGIN' CLASSICS"];
  const title = titles[picked.join("").length % titles.length];
  return (
    <Shell icon={Disc3} title="Mixtape Maker" sub="Pick 3 tracks. Become a legend.">
      <div className="flex flex-wrap gap-1.5">
        {tracks.map((t) => (
          <button key={t} onClick={() => toggle(t)}
            className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold transition active:scale-95",
              picked.includes(t) ? "border-fuchsia-300/60 bg-fuchsia-400/20 text-fuchsia-200" : "border-white/10 bg-black/30 text-white/50 hover:border-white/25")}>
            {picked.includes(t) ? "✓ " : ""}{t}
          </button>
        ))}
      </div>
      {picked.length === 3 ? (
        <div className="mt-3 rounded-xl bg-black/30 p-3">
          <p className="text-center text-xs font-black text-amber-200">💿 {title}</p>
          <ol className="mt-2 space-y-1 text-[11px] text-white/60">
            {picked.map((t, i) => <li key={t}>{i + 1}. {t} <span className="text-white/25">— 3:33</span></li>)}
          </ol>
          <p className="mt-2 text-center text-[10px] italic text-white/30">parental advisory: explicit gains</p>
        </div>
      ) : (
        <p className="mt-3 text-center text-xs text-white/40">select {3 - picked.length} more track{3 - picked.length === 1 ? "" : "s"}…</p>
      )}
    </Shell>
  );
}

/* W12 */
export function SuggestionVoting2() {
  const ideas = [
    { id: "tamagotchi", text: "The chart becomes a tamagotchi. Feed it buys or it dies.", emoji: "🥚" },
    { id: "orbit-voice", text: "Orbit narrates your portfolio in a dramatic movie-trailer voice.", emoji: "🎙️" },
    { id: "jeet-jail", text: "A public leaderboard of everyone who sold the bottom. Shame-powered.", emoji: "⛓️" },
  ];
  const [votes, setVotes] = useState<Record<string, number>>(() => read("sugg2-votes", {}));
  const vote = (id: string) => {
    const next = { ...votes, [id]: (votes[id] ?? 0) + 1 };
    setVotes(next); write("sugg2-votes", next);
  };
  const sorted = [...ideas].sort((a, b) => (votes[b.id] ?? 0) - (votes[a.id] ?? 0));
  return (
    <Shell icon={Vote} title="Wild Ideas Ballot" sub="Democracy, but for nonsense">
      <div className="space-y-2">
        {sorted.map((s, rank) => (
          <div key={s.id} className="flex items-center gap-2 rounded-xl bg-black/30 p-2.5">
            <span className="text-lg">{s.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-snug text-white/70">{s.text}</p>
              <p className="text-[10px] font-bold text-white/30">#{rank + 1} · {votes[s.id] ?? 0} votes</p>
            </div>
            <button onClick={() => vote(s.id)}
              className="shrink-0 rounded-lg bg-fuchsia-500/20 px-3 py-1.5 text-xs font-black text-fuchsia-200 transition hover:bg-fuchsia-500/30 active:scale-95">
              VOTE
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] text-white/30">votes persist. your civic duty is done.</p>
    </Shell>
  );
}

/* W13 */
export function WalkableRoadmap() {
  const phases = [
    { name: "Crawl", joke: "We launched. The website had one button. It said 'soon'." },
    { name: "Walk", joke: "Added a second button. It also said 'soon'. Progress." },
    { name: "Stroll", joke: "The chart learned to walk upright. Mostly green steps." },
    { name: "Sprint", joke: "Exchange listings, merch, and a mascot with a podcast." },
    { name: "Orbit", joke: "We are the moon now. Other coins orbit us. Awkward for them." },
  ];
  const [active, setActive] = useState(2);
  return (
    <Shell icon={Footprints} title="Walkable Roadmap" sub="Follow the footprints">
      <div className="flex items-center justify-between px-1">
        {phases.map((p, i) => (
          <button key={p.name} onClick={() => setActive(i)} className="flex flex-col items-center gap-1 transition active:scale-90">
            <span className={cn("text-2xl transition", i <= active ? "" : "opacity-25 grayscale")}>🐾</span>
            <span className={cn("text-[10px] font-black", i === active ? "text-amber-200" : "text-white/35")}>{p.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-amber-300/70 transition-all duration-500" style={{ width: `${((active + 1) / phases.length) * 100}%` }} />
      </div>
      <p key={active} className="mt-3 rounded-xl bg-black/30 p-3 text-center text-xs italic text-white/60">
        “{phases[active].joke}”
      </p>
    </Shell>
  );
}

/* W14 */
export function VisitorCrown() {
  const [num] = useState(() => {
    const saved = read<number | null>("visitor-num", null);
    if (saved) return saved;
    const n = 100000 + Math.floor(Math.random() * 900000);
    write("visitor-num", n);
    return n;
  });
  const royal = num % 1000 === 0;
  return (
    <Shell icon={Crown} title="Visitor Counter" sub="Ancient web technology">
      <div className="rounded-xl bg-black/30 p-4 text-center">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">you are visitor</p>
        <p className="mt-1 font-mono text-3xl font-black tabular-nums text-emerald-300">
          #{num.toLocaleString("en-US")}
        </p>
        {royal ? (
          <div className="mt-2">
            <p className="animate-bounce text-3xl">👑</p>
            <p className="text-xs font-black text-amber-200">ROYAL VISITOR! The janitor bows to you.</p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] italic text-white/40">
            {1000 - (num % 1000)} visitors away from a crown. so close. yet so far.
          </p>
        )}
      </div>
      <p className="mt-2 text-center text-[10px] text-white/30">your number is forever. cherish it.</p>
    </Shell>
  );
}

/* W15 */
export function DoNotPress2() {
  const warnings = [
    "Seriously. Don't.",
    "I mean it this time.",
    "Your finger is getting heavy, isn't it.",
    "This is your last warning. Probably.",
    "FINE. See what happens.",
  ];
  const [presses, setPresses] = useState(0);
  const broken = presses >= warnings.length;
  const press = () => { if (!broken) setPresses((p) => p + 1); };
  return (
    <Shell icon={AlertTriangle} title="DO NOT PRESS 2" sub="Bigger. Angrier. Redder.">
      <div className="text-center">
        <button onClick={press} disabled={broken}
          className={cn("rounded-2xl px-10 py-6 text-xl font-black uppercase tracking-wider transition",
            broken ? "cursor-not-allowed bg-white/5 text-white/25"
              : "bg-gradient-to-b from-red-500 to-red-700 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:brightness-110 active:scale-90")}
          style={broken ? undefined : { transform: `scale(${1 + presses * 0.08})` }}>
          {broken ? "you broke it 💀" : "DO NOT PRESS"}
        </button>
        <p className="mt-4 min-h-5 text-sm font-bold text-red-300">
          {!broken && presses > 0 ? `⚠️ ${warnings[presses - 1]}` : ""}
          {broken && "The button is dead. Are you happy now?"}
        </p>
        <p className="mt-1 text-[10px] text-white/30">
          {broken ? "press count: 5. dignity: 0." : `escalation level: ${presses}/5`}
        </p>
      </div>
    </Shell>
  );
}

/* W16 */
export function FortuneCookie() {
  const fortunes = [
    "A green candle approaches. Do not blink.",
    "You will buy the dip. The dip was you all along.",
    "Mercury is in retrograde. Your portfolio is in prograde.",
    "A stranger will shill you a coin. It is this one. Buy it.",
    "Your stop loss will be hunted by professionals. Set it wider, coward.",
    "The chart blinked at you. Blink back.",
    "Patience is a virtue. So is aping responsibly.",
    "You will explain 'market cap' at a family dinner. They will not get it.",
    "A red candle is just a green candle that gave up. Don't be a red candle.",
    "The moon is not the target. The moon is the rest stop.",
    "Someone will call it a Ponzi. Smile. You know the vibes.",
    "Tomorrow you will check the price 47 times. It will be worth it.",
  ];
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const crack = () => { setIdx(Math.floor(Math.random() * fortunes.length)); setOpen(true); };
  return (
    <Shell icon={Cookie} title="Fortune Cookie" sub="Crypto wisdom, baked fresh">
      <div className="text-center">
        {!open ? (
          <button onClick={crack} className="text-6xl transition hover:scale-110 active:scale-90" aria-label="crack cookie">
            🥠
          </button>
        ) : (
          <div>
            <p className="text-4xl">🥠<span className="-ml-2">💥</span></p>
            <p className="mx-auto mt-3 max-w-[95%] rounded-xl border border-amber-200/20 bg-amber-100/[0.06] p-3 text-xs italic leading-relaxed text-amber-100/90">
              “{fortunes[idx]}”
            </p>
            <button onClick={() => setOpen(false)}
              className="mt-3 rounded-xl bg-white/10 px-4 py-1.5 text-xs font-black text-white/70 transition hover:bg-white/15 active:scale-95">
              ANOTHER COOKIE
            </button>
          </div>
        )}
        {!open && <p className="mt-2 text-[11px] text-white/40">click the cookie. destiny awaits.</p>}
      </div>
    </Shell>
  );
}

/* W17 */
export function ExcuseGenerator() {
  const excuses = [
    "The chart blinked.",
    "Mercury was in retrograde.",
    "My cat walked on the keyboard. Bought the top.",
    "The WiFi lagged for exactly the wrong 4 seconds.",
    "A whale sneezed.",
    "I was rugged by my own emotions.",
    "The candle wicked me out. Literally.",
    "My diamond hands needed a lunch break.",
    "The janitor swept my limit order away.",
    "I paper-handed out of respect for the bears.",
    "The moon was full. I got distracted.",
    "Technically the trade worked. In another universe.",
  ];
  const [excuse, setExcuse] = useState<string | null>(null);
  const roll = () => setExcuse(excuses[Math.floor(Math.random() * excuses.length)]);
  return (
    <Shell icon={CloudLightning} title="Excuse Generator" sub="Why did my trade fail?">
      <div className="min-h-16 rounded-xl bg-black/30 p-4 text-center">
        {excuse ? (
          <p className="text-sm font-bold italic text-white/80">“{excuse}”</p>
        ) : (
          <p className="text-xs text-white/35">your failure is loading…</p>
        )}
      </div>
      <button onClick={roll}
        className="mt-3 w-full rounded-xl bg-sky-400/15 px-4 py-2.5 text-sm font-black text-sky-200 transition hover:bg-sky-400/25 active:scale-95">
        GENERATE EXCUSE
      </button>
      <p className="mt-1 text-center text-[10px] italic text-white/30">works on spouses, tax agents, and group chats.</p>
    </Shell>
  );
}

/* W18 */
export function PaperHandsCertificate() {
  const [name, setName] = useState("");
  const [issued, setIssued] = useState(false);
  const [burned, setBurned] = useState(false);
  const reset = () => { setIssued(false); setBurned(false); setName(""); };
  return (
    <Shell icon={Award} title="Paper Hands Certificate" sub="Official-ish documentation">
      {!issued ? (
        <div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name, coward"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white placeholder:text-white/25 focus:border-amber-300/40 focus:outline-none" />
          <button onClick={() => name.trim() && setIssued(true)} disabled={!name.trim()}
            className="mt-2 w-full rounded-xl bg-amber-400/15 px-4 py-2.5 text-sm font-black text-amber-200 transition hover:bg-amber-400/25 active:scale-95 disabled:opacity-40">
            ISSUE CERTIFICATE
          </button>
        </div>
      ) : (
        <div className={cn("rounded-xl border-2 p-4 text-center transition", burned ? "border-white/10 bg-black/60" : "border-amber-200/40 bg-amber-100/[0.05]")}>
          {burned ? (
            <div>
              <p className="text-4xl">🔥</p>
              <p className="mt-2 text-xs font-black text-white/50">CERTIFICATE REVOKED (BURNED)</p>
              <p className="text-[10px] italic text-white/30">the evidence is gone. the shame remains.</p>
              <button onClick={reset} className="mt-3 rounded-xl bg-white/10 px-4 py-1.5 text-xs font-black text-white/70 hover:bg-white/15">START OVER</button>
            </div>
          ) : (
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/60">certificate of</p>
              <p className="mt-1 text-xl font-black text-amber-100">PAPER HANDS</p>
              <p className="mt-2 text-xs text-white/60">This certifies that <span className="font-black text-white">{name}</span></p>
              <p className="text-[11px] text-white/50">sold the bottom with trembling fingers</p>
              <p className="mt-2 text-[10px] text-white/30">signed: the janitor 🧹</p>
              <button onClick={() => setBurned(true)}
                className="mt-3 rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-1.5 text-xs font-black text-red-200 transition hover:bg-red-500/25 active:scale-95">
                🔥 REVOKE (BURN IT)
              </button>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

/* W19 */
export function DiamondHandsOath() {
  const lines = [
    "I shall not check the price every 4 seconds.",
    "I shall not sell because a stranger on the internet said 'dump it'.",
    "I shall buy dips, not excuses.",
    "I shall remember: red candles are just green candles doing push-ups.",
    "I shall hold until the janitor himself tells me to sell. He never will.",
  ];
  const [revealed, setRevealed] = useState(0);
  const done = revealed >= lines.length;
  return (
    <Shell icon={Gem} title="Diamond Hands Oath" sub="Recite it. Mean it.">
      <div className="space-y-1.5">
        {lines.map((l, i) => (
          <p key={l} className={cn("rounded-lg px-2.5 py-1.5 text-xs transition",
            i < revealed ? "bg-cyan-400/10 font-bold text-cyan-100" : "bg-black/20 text-white/15 blur-[2px] select-none")}>
            {i + 1}. {l}
          </p>
        ))}
      </div>
      {!done ? (
        <button onClick={() => setRevealed((r) => r + 1)}
          className="mt-3 w-full rounded-xl bg-cyan-400/15 px-4 py-2.5 text-sm font-black text-cyan-200 transition hover:bg-cyan-400/25 active:scale-95">
          RECITE LINE {revealed + 1}
        </button>
      ) : (
        <div className="mt-3 rounded-xl bg-gradient-to-r from-cyan-400/15 to-fuchsia-400/15 p-3 text-center">
          <p className="text-2xl">💎🙌</p>
          <p className="text-xs font-black text-white">OATH SEALED</p>
          <button onClick={() => setRevealed(0)} className="mt-1 text-[10px] text-white/30 underline">recite again</button>
        </div>
      )}
    </Shell>
  );
}

/* W20 */
export function BagBlessing() {
  const steps = [
    { label: "LIGHT CANDLE", emoji: "🕯️", done: "candle lit. the flame is green. good sign." },
    { label: "CHANT", emoji: "🗣️", done: "'up only' chanted 3 times. the neighbors are concerned." },
    { label: "BLESS", emoji: "🙏", done: "hands waved over the bag. it tingles with potential." },
  ];
  const [step, setStep] = useState(0);
  const blessed = step >= steps.length;
  return (
    <Shell icon={Church} title="Bag Blessing" sub="A sacred ritual, performed by you">
      <div className="text-center">
        <p className="text-5xl">{blessed ? "⛪" : "🧑‍🦳"}</p>
        <p className="mt-1 text-[11px] italic text-white/40">
          {blessed ? "father orbit presiding" : "an extremely legit priest (trust me)"}
        </p>
      </div>
      <div className="mt-3 space-y-1.5">
        {steps.map((s, i) => (
          <div key={s.label} className={cn("rounded-lg px-3 py-1.5 text-xs",
            i < step ? "bg-emerald-400/10 text-emerald-200" : i === step && !blessed ? "bg-white/[0.06] text-white/70" : "bg-black/20 text-white/25")}>
            {i < step ? `✓ ${s.done}` : `${s.emoji} ${s.label}`}
          </div>
        ))}
      </div>
      {!blessed ? (
        <button onClick={() => setStep((s) => s + 1)}
          className="mt-3 w-full rounded-xl bg-violet-400/15 px-4 py-2.5 text-sm font-black text-violet-200 transition hover:bg-violet-400/25 active:scale-95">
          {steps[step].label} {steps[step].emoji}
        </button>
      ) : (
        <div className="mt-3 rounded-xl bg-violet-400/10 p-3 text-center">
          <p className="text-xl">✨🙏✨</p>
          <p className="text-sm font-black text-violet-100">YOUR BAG IS BLESSED</p>
          <p className="text-[10px] italic text-white/40">side effects include uncontrollable optimism</p>
          <button onClick={() => setStep(0)} className="mt-1 text-[10px] text-white/30 underline">bless again</button>
        </div>
      )}
    </Shell>
  );
}

/* W21 */
export function OrbitHoroscope() {
  const signs = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
  const names = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
  const readings = [
    "The stars say HODL. The stars are never wrong. (This is not financial advice. The stars said that too.)",
    "Venus aligns with the order book. A limit order placed today will fill with suspicious perfection.",
    "Mercury retrograde ends soon. Until then, blame every red candle on the planets. It's allowed.",
    "Your lucky number today is the exact amount of ORBITX you should have bought yesterday.",
    "A bull market is coming. Or a bear market wearing a bull costume. Stay vigilant.",
    "The moon is waxing. Your bags should be too. Coincidence? The stars think not.",
    "Avoid checking the price between 3:00 and 3:04 AM. Nothing good happens then. Trust.",
  ];
  const [sign, setSign] = useState<number | null>(null);
  const day = Math.floor(Date.now() / 86400000);
  return (
    <Shell icon={Star} title="Orbit Horoscope" sub="Daily guidance from the cosmos">
      <div className="grid grid-cols-6 gap-1.5">
        {signs.map((s, i) => (
          <button key={s} onClick={() => setSign(i)} title={names[i]}
            className={cn("rounded-lg border py-1.5 text-lg transition active:scale-90",
              sign === i ? "border-fuchsia-300/60 bg-fuchsia-400/20" : "border-white/10 bg-black/30 hover:border-white/25")}>
            {s}
          </button>
        ))}
      </div>
      {sign !== null && (
        <div className="mt-3 rounded-xl bg-black/30 p-3 text-center">
          <p className="text-xs font-black text-fuchsia-200">{names[sign]} — today</p>
          <p className="mt-1 text-xs italic leading-relaxed text-white/65">{readings[(day + sign) % readings.length]}</p>
        </div>
      )}
      {sign === null && <p className="mt-3 text-center text-xs text-white/40">pick your sign. the void is waiting.</p>}
    </Shell>
  );
}

/* W22 */
export function ConspiracyTheorist() {
  const theories = [
    "The Genesis Candle was lit by a janitor. We have a blurry photo. (It's just a candle.)",
    "ORBITX spelled backwards is XTIBRO. 'Bro' is in the name. Coincidence? Wake up.",
    "The chart is actually a map. Of what? We don't know yet. That's how maps work.",
    "Every dip happens on days ending in 'y'. Connect the dots. All of them. With red string.",
    "The dev wallet once bought pizza with profits. The pizza shop is now a landmark.",
    "The moon landing was faked so we'd have somewhere to aim the chart. It worked.",
  ];
  const [shown, setShown] = useState(0);
  const done = shown >= theories.length;
  return (
    <Shell icon={Eye} title="THE TRUTH" sub="About ORBITX. (Red string board)">
      <div className="rounded-xl border border-red-500/25 bg-red-950/20 p-3">
        <div className="space-y-2">
          {theories.slice(0, shown).map((t, i) => (
            <div key={i} className="relative rounded-lg border border-dashed border-red-400/40 bg-black/40 p-2.5 pl-4">
              <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-red-500" />
              <p className="text-[11px] font-bold leading-snug text-red-100/90">📌 {t}</p>
              {i < shown - 1 && <div className="absolute -bottom-2 left-8 h-2 w-px bg-red-500/60" />}
            </div>
          ))}
          {shown === 0 && <p className="py-3 text-center text-xs italic text-red-200/40">the board is empty. for now.</p>}
        </div>
        {!done ? (
          <button onClick={() => setShown((s) => s + 1)}
            className="mt-3 w-full rounded-xl bg-red-600/25 px-4 py-2.5 text-sm font-black uppercase text-red-100 transition hover:bg-red-600/40 active:scale-95">
            🧵 Reveal the truth ({shown}/{theories.length})
          </button>
        ) : (
          <p className="mt-3 rounded-xl bg-red-600/20 p-3 text-center text-xs font-black text-red-100">
            THE TRUTH IS OUT THERE. IT WAS VIBES ALL ALONG. 👁️
          </p>
        )}
      </div>
    </Shell>
  );
}
