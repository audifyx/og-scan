import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle, Anvil, Bomb, BookOpen, Check, Copy, Crown, Dices, Drama, Flame,
  Gift, Gavel, Ghost, Heart, Hourglass, Lightbulb, Mail, Megaphone, MessageCircle,
  PartyPopper, PencilLine, Quote, Scale, ScrollText, Send, Sparkles, ThumbsDown,
  ThumbsUp, Wand2, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared shell + helpers                                               */
/* ------------------------------------------------------------------ */

function Shell({ icon: Icon, title, sub, children, accent = "bg-fuchsia-400/12 text-fuchsia-300" }: {
  icon: ComponentType<{ className?: string }>; title: string; sub?: string; children: ReactNode; accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", accent)}>
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
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV] as const;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const btn = "rounded-xl bg-fuchsia-400/15 px-3 py-2 text-xs font-bold text-fuchsia-200 transition hover:bg-fuchsia-400/25";
const ghostBtn = "rounded-xl bg-white/5 px-3 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10";
const inputCls = "w-full rounded-xl bg-white/5 px-3 py-2 text-xs outline-none placeholder:text-white/30 focus:ring-1 focus:ring-fuchsia-400/40";

function useCopy(): [string | null, (id: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (id: string, text: string) => {
    try { navigator.clipboard.writeText(text); } catch {}
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
  };
  return [copied, copy];
}

/* ------------------------------------------------------------------ */
/* W45 — W48                                                            */
/* ------------------------------------------------------------------ */

/* W45 */
export function ShillKit2() {
  const [name, setName] = useLocal("orbitx-wild3-shill-name", "");
  const [copied, copy] = useCopy();
  const me = name.trim() || "anon";
  const templates = useMemo(() => ([
    { id: "tweet", label: "🐦 Tweet", text: `gm CT ☀️\n\n$ORBITX has been holding strong while everything else bleeds.\nThe community actually builds here.\n\nI'm ${me} and I approve this shill. 🚀\n\n#ORBITX` },
    { id: "telegram", label: "📲 Telegram", text: `🚀 FAM\n\norbitx is about to melt faces.\ncharts clean, vibes clean, community unhinged (in a good way).\n\n-${me}` },
    { id: "discord", label: "🎮 Discord", text: `**📢 SHILL O'CLOCK**\n\ndegen intel: $ORBITX → the only chart I don't have to squint at\n\nalpha is temporary, ORBITX is forever.\n\ndropped by ${me} 🛸` },
    { id: "mom", label: "💬 SMS to mom", text: `hi mom it's ${me}. don't buy anything, just wanted to say your child is extremely early on something called ORBITX and the internet is proud of me. love u` },
  ]), [me]);
  return (
    <Shell icon={Megaphone} title="Shill Kit" sub="One-tap copy for 4 certified shill templates" accent="bg-rose-400/12 text-rose-300">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your shill name…" className={cn(inputCls, "mb-3")} />
      <div className="grid gap-2 sm:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-extrabold">{t.label}</span>
              <button onClick={() => copy(t.id, t.text)} className={cn(btn, "flex items-center gap-1 py-1.5")}>
                {copied === t.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === t.id ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="max-h-24 overflow-hidden whitespace-pre-wrap text-[11px] leading-snug text-white/60">{t.text}</pre>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* W46 */
const MEME_TEMPLATES = [
  { id: "drake", label: "Drake", emoji: "🚫👍", desc: "reject / approve" },
  { id: "distracted", label: "Distracted BF", emoji: "👫🚶", desc: "jeeting vs holding" },
  { id: "brain", label: "Expanding Brain", emoji: "🧠✨", desc: "escalating galaxy takes" },
  { id: "buttons", label: "Two Buttons", emoji: "🔴🔴", desc: "impossible choices" },
  { id: "stonks", label: "Stonks", emoji: "📈🤵", desc: "number go up" },
  { id: "crying", label: "Crying Jordan", emoji: "😭🏀", desc: "sold the bottom" },
];
export function MemeGen2() {
  const [tpl, setTpl] = useLocal("orbitx-wild3-meme-tpl", "drake");
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");
  const active = MEME_TEMPLATES.find((t) => t.id === tpl) ?? MEME_TEMPLATES[0];
  return (
    <Shell icon={PartyPopper} title="Meme Generator" sub="Pick a template, write captions, behold the meme" accent="bg-amber-400/12 text-amber-300">
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {MEME_TEMPLATES.map((t) => (
          <button key={t.id} onClick={() => setTpl(t.id)}
            className={cn("rounded-xl border px-2 py-2 text-center transition",
              tpl === t.id ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]")}>
            <div className="text-lg leading-none">{t.emoji}</div>
            <div className="mt-1 text-[10px] font-bold">{t.label}</div>
          </button>
        ))}
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input value={top} onChange={(e) => setTop(e.target.value)} placeholder="TOP TEXT" className={inputCls} />
        <input value={bottom} onChange={(e) => setBottom(e.target.value)} placeholder="bottom text" className={inputCls} />
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/20 via-black to-amber-500/20 p-4 text-center">
        <div className="text-3xl">{active.emoji}</div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-white/40">{active.label} · {active.desc}</div>
        <div className="mt-2 text-lg font-black uppercase leading-tight drop-shadow">{top || "TOP TEXT"}</div>
        <div className="mt-1 text-[11px] font-bold text-white/70">{bottom || "bottom text"}</div>
      </div>
    </Shell>
  );
}

/* W47 */
const ROAST_TEMPLATES = [
  (n: string) => `${n} bought the top so often the chart has a statue of them up there. 🗿`,
  (n: string) => `${n}'s portfolio is just a museum of red candles and bad decisions.`,
  (n: string) => `${n} says "diamond hands" but sells when the wifi buffers.`,
  (n: string) => `${n}'s idea of DYOR is reading the token emoji twice.`,
  (n: string) => `${n} has rugged themselves more times than any dev ever could.`,
  (n: string) => `${n}'s stop loss is just hope wearing a trench coat.`,
  (n: string) => `${n} paper-handed so hard they left origami on the blockchain.`,
  (n: string) => `${n} ape'd in because the logo "looked fast".`,
];
export function RoastBattle() {
  const [name, setName] = useState("");
  const [selfMode, setSelfMode] = useState(false);
  const [roast, setRoast] = useState<string | null>(null);
  const target = selfMode ? "you" : (name.trim() || "your friend");
  const fire = () => setRoast(pick(ROAST_TEMPLATES)(selfMode ? "You" : target));
  return (
    <Shell icon={Flame} title="Roast Battle" sub="Playful crypto roasts — all in good fun, never personal" accent="bg-orange-400/12 text-orange-300">
      <div className="mb-3 flex gap-2">
        <button onClick={() => { setSelfMode(false); setRoast(null); }} className={cn("flex-1 rounded-xl px-3 py-2 text-xs font-bold transition", !selfMode ? "bg-orange-400/20 text-orange-200" : "bg-white/5 text-white/60")}>Roast a friend</button>
        <button onClick={() => { setSelfMode(true); setRoast(null); }} className={cn("flex-1 rounded-xl px-3 py-2 text-xs font-bold transition", selfMode ? "bg-orange-400/20 text-orange-200" : "bg-white/5 text-white/60")}>Roast me instead</button>
      </div>
      {!selfMode && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Friend's name (or wallet nickname)…" className={cn(inputCls, "mb-3")} />}
      <button onClick={fire} className={cn(btn, "w-full !bg-orange-400/15 !text-orange-200 hover:!bg-orange-400/25")}>
        🔥 Generate roast for {selfMode ? "me" : target}
      </button>
      {roast && (
        <div className="mt-3 rounded-xl border border-orange-400/30 bg-orange-400/[0.07] p-3 text-sm leading-relaxed text-orange-100">
          <Quote className="mb-1 h-4 w-4 text-orange-300/60" />{roast}
        </div>
      )}
    </Shell>
  );
}

/* W48 */
const COMPLIMENTS = [
  "your entries are clean 👑", "diamond conviction 💎", "chart-reading wizard 🧙",
  "never fomo'd once today 🏆", "portfolio looking majestic 🦚", "calm during the dip 🧊",
  "shill game immaculate ✨", "future whale energy 🐋", "buys the fear, sells the euphoria 🧠",
  "your stop losses are poetry 📝",
];
export function ComplimentBomb() {
  const [name, setName] = useLocal("orbitx-wild3-compliment-name", "");
  const [burst, setBurst] = useState<{ id: string; text: string; left: string; delay: string }[]>([]);
  const drop = () => {
    const five = [...COMPLIMENTS].sort(() => Math.random() - 0.5).slice(0, 5);
    const me = name.trim();
    setBurst(five.map((c) => ({ id: uid(), text: me ? `${me}, ${c}` : c, left: `${8 + Math.random() * 70}%`, delay: `${Math.random() * 0.8}s` })));
    setTimeout(() => setBurst([]), 3600);
  };
  return (
    <Shell icon={Heart} title="Compliment Bomb" sub="Drop 5 floating compliments on someone's day" accent="bg-pink-400/12 text-pink-300">
      <div className="relative mb-3 min-h-[64px] overflow-hidden rounded-xl border border-white/10 bg-black/30 p-2">
        {burst.length === 0 && <p className="p-2 text-center text-[11px] text-white/30">press the button. feel the love. 💝</p>}
        {burst.map((b) => (
          <span key={b.id} style={{ left: b.left, animationDelay: b.delay }}
            className="absolute bottom-0 animate-bounce whitespace-nowrap rounded-full bg-pink-400/20 px-3 py-1 text-[11px] font-bold text-pink-200">{b.text}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Who deserves this? (optional)" className={cn(inputCls, "flex-1")} />
        <button onClick={drop} className={cn(btn, "!bg-pink-400/15 !text-pink-200 hover:!bg-pink-400/25")}>💣 Drop it</button>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W49 — W52                                                            */
/* ------------------------------------------------------------------ */

/* W49 */
const DARES = [
  "Shill ORBITX to one friend (screenshot or it didn't happen)",
  "Change your pfp to the ORBITX logo for 24h",
  "Post 'gm' in 3 different crypto group chats",
  "Buy $5 of ORBITX and hold it for a full week",
  "Explain market cap to a non-crypto friend without crying",
  "Write one genuine compliment in the Telegram chat",
  "Draw the ORBITX chart from memory (bonus points for accuracy)",
  "Tweet your wildest ORBITX price prediction with #ORBITX",
];
export function DareWheel() {
  const [dare, setDare] = useState<string | null>(null);
  const [done, setDone] = useLocal<string[]>("orbitx-wild3-dares-done", []);
  const [spinning, setSpinning] = useState(false);
  const spin = () => {
    setSpinning(true); setDare(null);
    setTimeout(() => { setDare(pick(DARES)); setSpinning(false); }, 900);
  };
  const toggle = (d: string) => setDone((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));
  return (
    <Shell icon={Dices} title="Dare Wheel" sub="Spin for a crypto dare. Check it off when conquered." accent="bg-red-400/12 text-red-300">
      <button onClick={spin} disabled={spinning} className={cn(btn, "w-full !bg-red-400/15 !text-red-200 hover:!bg-red-400/25")}>
        {spinning ? "🎡 Spinning…" : "🎡 SPIN THE WHEEL"}
      </button>
      {dare && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/[0.07] p-3">
          <input type="checkbox" checked={done.includes(dare)} onChange={() => toggle(dare)} className="mt-0.5 h-4 w-4 accent-red-400" />
          <p className={cn("text-sm leading-relaxed", done.includes(dare) && "text-white/40 line-through")}>{dare}</p>
        </div>
      )}
      {done.length > 0 && (
        <p className="mt-2 text-[11px] text-white/50">✅ Dares crushed: {done.length}/{DARES.length}</p>
      )}
    </Shell>
  );
}

/* W50 */
const TRUTHS = [
  "What's the worst trade you've ever made?", "How much of your bag is pure hopium?",
  "Have you ever bought something just because the logo looked cool?", "Biggest paper-hand moment — confess.",
  "Do you actually read whitepapers or just vibe?", "What's your most embarrassing crypto take?",
  "Ever shilled a coin you didn't hold?", "What's the lowest you've ever sold?",
  "Do you check charts in the bathroom? Be honest.", "What's your real portfolio allocation?",
];
const DARES10 = [
  "Send 'gm' to the last person you texted", "Hold a plank for 60 seconds before your next trade",
  "Post a chart screenshot with zero context", "Call a friend and say 'ORBITX' then hang up",
  "Do 10 pushups for every red candle today", "Rename your wifi to 'ORBITX to the moon'",
  "Sing the national anthem of your bags", "Text your group chat: 'we're so back'",
  "Draw your portfolio as an animal", "Apologize out loud to your wallet",
];
export function TruthOrDare() {
  const [mode, setMode] = useState<"truth" | "dare">("truth");
  const [card, setCard] = useState<string | null>(null);
  const [done, setDone] = useLocal("orbitx-wild3-tod-done", 0);
  const deck = mode === "truth" ? TRUTHS : DARES10;
  const draw = () => setCard(pick(deck.filter((d) => d !== card)));
  return (
    <Shell icon={MessageCircle} title="Truth or Dare" sub="10 truths, 10 dares. Draw a card, own it." accent="bg-sky-400/12 text-sky-300">
      <div className="mb-3 flex gap-2">
        <button onClick={() => { setMode("truth"); setCard(null); }} className={cn("flex-1 rounded-xl px-3 py-2 text-xs font-bold transition", mode === "truth" ? "bg-sky-400/20 text-sky-200" : "bg-white/5 text-white/60")}>🤔 Truth</button>
        <button onClick={() => { setMode("dare"); setCard(null); }} className={cn("flex-1 rounded-xl px-3 py-2 text-xs font-bold transition", mode === "dare" ? "bg-sky-400/20 text-sky-200" : "bg-white/5 text-white/60")}>😈 Dare</button>
      </div>
      <button onClick={draw} className={cn(btn, "w-full !bg-sky-400/15 !text-sky-200 hover:!bg-sky-400/25")}>🃏 Draw a card</button>
      {card && (
        <div className="mt-3 rounded-xl border border-sky-400/30 bg-sky-400/[0.07] p-4 text-center">
          <p className="text-sm font-bold leading-relaxed text-sky-100">{card}</p>
          <button onClick={() => { setDone((d) => d + 1); setCard(null); }} className={cn(ghostBtn, "mt-3")}>
            ✅ Done it ({done} completed)
          </button>
        </div>
      )}
      {!card && done > 0 && <p className="mt-2 text-center text-[11px] text-white/50">✅ Cards completed: {done}</p>}
    </Shell>
  );
}

/* W51 */
const WYR = [
  { a: "100x once", b: "2x forever" },
  { a: "Know the top before it tops", b: "Know the bottom before it bottoms" },
  { a: "One perfect entry per year", b: "Infinite mediocre entries" },
  { a: "Shill to 1M followers", b: "Whale wallet follows you" },
  { a: "Never pay gas fees again", b: "Never get frontrun again" },
  { a: "Diamond hands forever", b: "Perfect timing forever" },
];
export function WouldYouRather() {
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useLocal<("a" | "b")[]>("orbitx-wild3-wyr-picks", []);
  const q = WYR[idx];
  const vote = (side: "a" | "b") => setPicks((p) => [...p, side]);
  const aCount = picks.filter((p) => p === "a").length;
  const bCount = picks.filter((p) => p === "b").length;
  const total = aCount + bCount;
  const last = picks[picks.length - 1];
  return (
    <Shell icon={Scale} title="Would You Rather" sub="Crypto edition — your picks, your stats. No fake community." accent="bg-violet-400/12 text-violet-300">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button onClick={() => vote("a")} className="rounded-xl border border-violet-400/30 bg-violet-400/[0.08] p-3 text-sm font-extrabold text-violet-100 transition hover:bg-violet-400/[0.16]">A: {q.a}</button>
        <button onClick={() => vote("b")} className="rounded-xl border border-violet-400/30 bg-violet-400/[0.08] p-3 text-sm font-extrabold text-violet-100 transition hover:bg-violet-400/[0.16]">B: {q.b}</button>
      </div>
      {total > 0 ? (
        <div className="space-y-1.5">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="bg-violet-400 transition-all" style={{ width: `${(aCount / total) * 100}%` }} />
            <div className="bg-fuchsia-400 transition-all" style={{ width: `${(bCount / total) * 100}%` }} />
          </div>
          <p className="text-[11px] text-white/50">
            Your picks: A {aCount} ({Math.round((aCount / total) * 100)}%) · B {bCount} ({Math.round((bCount / total) * 100)}%) · total votes {total}
            {last && <span className="text-white/70"> — last pick: {last === "a" ? "A" : "B"}</span>}
          </p>
        </div>
      ) : (
        <p className="text-center text-[11px] text-white/30">Vote to build your personal split 📊</p>
      )}
      <button onClick={() => setIdx((i) => (i + 1) % WYR.length)} className={cn(ghostBtn, "mt-3 w-full")}>⏭ Next question</button>
    </Shell>
  );
}

/* W52 */
export function HotTakes() {
  const [draft, setDraft] = useState("");
  const [heat, setHeat] = useState(3);
  const [takes, setTakes] = useLocal<{ id: string; text: string; heat: number }[]>("orbitx-wild3-takes", []);
  const post = () => {
    if (!draft.trim()) return;
    setTakes((t) => [{ id: uid(), text: draft.trim(), heat }, ...t]);
    setDraft(""); setHeat(3);
  };
  return (
    <Shell icon={Flame} title="Hot Takes" sub="Anonymous take box — your takes stay on your device" accent="bg-orange-400/12 text-orange-300">
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Unleash your spiciest take…" className={cn(inputCls, "mb-2 resize-none")} />
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[11px] font-bold text-white/50">Heat:</span>
        <div className="flex gap-1">{[1, 2, 3, 4, 5].map((h) => (
          <button key={h} onClick={() => setHeat(h)} className={cn("text-lg transition", h <= heat ? "" : "opacity-25 grayscale")}>🔥</button>
        ))}</div>
        <button onClick={post} className={cn(btn, "ml-auto")}>Post take</button>
      </div>
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {takes.length === 0 && <p className="text-center text-[11px] text-white/30">No takes yet. The timeline awaits your genius.</p>}
        {takes.map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.04] p-2.5">
            <p className="text-xs leading-relaxed text-white/80">{t.text}</p>
            <span className="shrink-0 text-xs">{"🔥".repeat(t.heat)}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W53 — W56                                                            */
/* ------------------------------------------------------------------ */

/* W53 */
const UNPOPULAR = [
  "Checking charts every 5 minutes is a hobby, not a strategy.",
  "Most 'alpha' is just survivorship bias with better branding.",
  "Your favorite influencer sold before they tweeted.",
  "Diamond hands is sometimes just refusing to admit a mistake.",
  "Gas fees have humbled more traders than any bear market.",
  "Nobody actually understands tokenomics. Nobody.",
  "The best trade is often the one you didn't take.",
  "ORBITX is underrated and it's not even close.",
];
export function UnpopularOpinions() {
  const [stances, setStances] = useLocal<Record<number, "agree" | "disagree">>("orbitx-wild3-opinions", {});
  const toggle = (i: number, s: "agree" | "disagree") =>
    setStances((m) => { const next = { ...m }; if (next[i] === s) delete next[i]; else next[i] = s; return next; });
  return (
    <Shell icon={ThumbsDown} title="Unpopular Opinions" sub="Agree or disagree — your stances are saved locally" accent="bg-lime-400/12 text-lime-300">
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {UNPOPULAR.map((op, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-2.5">
            <p className="flex-1 text-xs leading-relaxed text-white/80">{op}</p>
            <button onClick={() => toggle(i, "agree")} className={cn("rounded-lg p-1.5 transition", stances[i] === "agree" ? "bg-lime-400/25 text-lime-200" : "bg-white/5 text-white/40 hover:bg-white/10")}><ThumbsUp className="h-3.5 w-3.5" /></button>
            <button onClick={() => toggle(i, "disagree")} className={cn("rounded-lg p-1.5 transition", stances[i] === "disagree" ? "bg-red-400/25 text-red-200" : "bg-white/5 text-white/40 hover:bg-white/10")}><ThumbsDown className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* W54 */
const CLUES = [
  "the chart wicks", "a whale moved at 3am", "the dev tweeted a rocket emoji", "gas spiked for no reason",
  "your group chat went quiet", "a random influencer mentioned it", "the volume doubled overnight",
  "someone drew lines on the chart", "the moon is in retrograde", "a Discord mod pinned something",
];
export function ConspiracyBoard() {
  const [c1, setC1] = useLocal("orbitx-wild3-consp-1", CLUES[0]);
  const [c2, setC2] = useLocal("orbitx-wild3-consp-2", CLUES[1]);
  const [result, setResult] = useState<string | null>(null);
  const connect = () => setResult(
    `🧵 RED STRING THEORY #${Math.floor(Math.random() * 9000 + 1000)}:\n"${c1}" + "${c2}" can only mean one thing: ORBITX is being accumulated by shadow whales ahead of a coordinated moon mission. The evidence is undeniable. Probably.`
  );
  return (
    <Shell icon={Zap} title="Conspiracy Board" sub="Connect two clues with red string. Trust the board." accent="bg-red-400/12 text-red-300">
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <select value={c1} onChange={(e) => setC1(e.target.value)} className="rounded-xl bg-white/5 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-red-400/40 [&>option]:bg-zinc-900">
          {CLUES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={c2} onChange={(e) => setC2(e.target.value)} className="rounded-xl bg-white/5 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-red-400/40 [&>option]:bg-zinc-900">
          {CLUES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <button onClick={connect} className={cn(btn, "w-full !bg-red-400/15 !text-red-200 hover:!bg-red-400/25")}>🧵 Connect the string</button>
      {result && <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-red-400/30 bg-red-400/[0.07] p-3 text-xs leading-relaxed text-red-100">{result}</pre>}
    </Shell>
  );
}

/* W55 */
type Prophecy = { id: string; text: string; date: string; sealed: boolean };
export function ProphecyWall() {
  const [draft, setDraft] = useState("");
  const [date, setDate] = useState("");
  const [list, setList] = useLocal<Prophecy[]>("orbitx-wild3-prophecies", []);
  const seal = () => {
    if (!draft.trim()) return;
    setList((l) => [{ id: uid(), text: draft.trim(), date: date || "someday", sealed: true }, ...l]);
    setDraft(""); setDate("");
  };
  const unseal = (id: string) => setList((l) => l.map((p) => (p.id === id ? { ...p, sealed: false } : p)));
  return (
    <Shell icon={ScrollText} title="Prophecy Wall" sub="Seal your price prophecy. Unseal it when destiny calls." accent="bg-indigo-400/12 text-indigo-300">
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="ORBITX hits $1 by…" className={cn(inputCls, "mb-2")} />
      <div className="mb-3 flex gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded-xl bg-white/5 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-400/40 [&::-webkit-calendar-picker-indicator]:invert" />
        <button onClick={seal} className={cn(btn, "!bg-indigo-400/15 !text-indigo-200 hover:!bg-indigo-400/25")}>🔮 Seal it</button>
      </div>
      <div className="max-h-36 space-y-2 overflow-y-auto">
        {list.length === 0 && <p className="text-center text-[11px] text-white/30">No prophecies yet. The future is unwritten.</p>}
        {list.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] p-2.5">
            {p.sealed ? (
              <>
                <span className="text-xs text-white/60">🔒 Sealed prophecy · reveals {p.date}</span>
                <button onClick={() => unseal(p.id)} className={ghostBtn}>Unseal</button>
              </>
            ) : (
              <span className="text-xs text-white/80">📜 {p.text} <span className="text-white/40">({p.date})</span></span>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* W56 */
export function TimeTraveler() {
  const [msg, setMsg] = useLocal("orbitx-wild3-timetravel-msg", "");
  const [sealedAt, setSealedAt] = useLocal<number | null>("orbitx-wild3-timetravel-at", null);
  const [draft, setDraft] = useState(msg);
  const seal = () => { setMsg(draft); setSealedAt(Date.now()); };
  const daysLeft = sealedAt ? Math.max(0, 365 - Math.floor((Date.now() - sealedAt) / 86400000)) : null;
  const reset = () => { setSealedAt(null); setMsg(""); setDraft(""); };
  return (
    <Shell icon={Hourglass} title="Time Traveler" sub="Write to your future self — delivered in 1 year" accent="bg-cyan-400/12 text-cyan-300">
      {sealedAt ? (
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-400/10 text-3xl">📮</div>
          <p className="text-sm font-extrabold">Message sealed & time-locked</p>
          <p className="mt-1 text-xs text-white/50">Delivering to future-you in <span className="font-bold text-cyan-300">{daysLeft} days</span></p>
          <p className="mt-2 truncate rounded-xl bg-white/[0.04] p-2 text-[11px] italic text-white/40">"{msg}"</p>
          <button onClick={reset} className={cn(ghostBtn, "mt-3")}>Write a new one</button>
        </div>
      ) : (
        <>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Dear future me, remember when ORBITX was just…" className={cn(inputCls, "mb-3 resize-none")} />
          <button onClick={seal} disabled={!draft.trim()} className={cn(btn, "w-full !bg-cyan-400/15 !text-cyan-200 hover:!bg-cyan-400/25 disabled:opacity-40")}>⏳ Seal for 1 year</button>
        </>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W57 — W60                                                            */
/* ------------------------------------------------------------------ */

/* W57 */
const VIBES = [
  { label: "immaculate ✨", pct: 98 }, { label: "feral but bullish 🐂", pct: 87 },
  { label: "caffeinated chaos ☕", pct: 76 }, { label: "suspiciously calm 😌", pct: 64 },
  { label: "degen o'clock 🕐", pct: 92 }, { label: "touching grass era 🌱", pct: 41 },
  { label: "main character energy 🎬", pct: 88 }, { label: "wen moon, but politely 🌙", pct: 70 },
];
export function VibeCheck() {
  const [vibe, setVibe] = useState<{ label: string; pct: number } | null>(null);
  const check = () => setVibe(pick(VIBES));
  return (
    <Shell icon={Sparkles} title="Vibe Check" sub="One button. Total clarity. Zero accountability." accent="bg-fuchsia-400/12 text-fuchsia-300">
      <button onClick={check} className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500/30 to-violet-500/30 px-4 py-4 text-base font-black tracking-wide text-white transition hover:from-fuchsia-500/40 hover:to-violet-500/40 active:scale-[0.98]">
        📡 CHECK THE VIBES
      </button>
      {vibe && (
        <div className="mt-3 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/[0.07] p-3">
          <p className="text-center text-sm font-extrabold">vibes: {vibe.label}</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-400 transition-all duration-700" style={{ width: `${vibe.pct}%` }} />
          </div>
          <p className="mt-1 text-center text-[11px] text-white/50">vibe-o-meter: {vibe.pct}%</p>
        </div>
      )}
    </Shell>
  );
}

/* W58 */
const PASTAS = [
  (n: string) => `WHAT'S UP IT'S YA BOI ${n.toUpperCase()} 🗣️\n\nLet me tell you about ORBITX. I didn't buy ORBITX. ORBITX bought ME. I was a normal person with hobbies and then the chart winked at me. Now I speak fluent candle. My family thinks I joined a cult. They're right. The cult of green candles. WE'RE SO EARLY.`,
  (n: string) => `🚨🚨 ATTENTION ALL DEGENS 🚨🚨\n\nThis is ${n} with a PUBLIC SERVICE ANNOUNCEMENT: ORBITX is not a token, it's a LIFESTYLE. I sold my couch to buy the dip. I now sit on the floor. The floor is fine. The floor is honest. The floor doesn't rug. ORBITX to the MOON and my couch to the curb.`,
  (n: string) => `ahem. *taps mic*\n\nmy name is ${n} and I have held ORBITX through dips that would make lesser traders weep into their ramen. I have seen things. I have seen red candles taller than my ambitions. And yet — AND YET — here I stand. Diamond-handed. Slightly unhinged. Ready. 🫡`,
];
export function CopypastaGen() {
  const [name, setName] = useLocal("orbitx-wild3-pasta-name", "");
  const [pasta, setPasta] = useState(0);
  const [copied, copy] = useCopy();
  const text = PASTAS[pasta % PASTAS.length](name.trim() || "Anon");
  const regen = () => setPasta((p) => p + 1);
  return (
    <Shell icon={BookOpen} title="Copypasta Generator" sub="Certified copypasta, personalized with your name" accent="bg-emerald-400/12 text-emerald-300">
      <div className="mb-2 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name…" className={cn(inputCls, "flex-1")} />
        <button onClick={regen} className={ghostBtn}>🎲 New</button>
        <button onClick={() => copy("pasta", text)} className={cn(btn, "!bg-emerald-400/15 !text-emerald-200 hover:!bg-emerald-400/25")}>
          {copied === "pasta" ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/75">{text}</pre>
    </Shell>
  );
}

/* W59 */
export function EmojiStory() {
  const [a, setA] = useState("🚀"); const [b, setB] = useState("💎"); const [c, setC] = useState("🌙");
  const story = useMemo(() => {
    const bag = ["your bag", "your stack", "your precious ORBITX", "your diamond stash"][Math.floor(Math.random() * 4)];
    return `Once upon a time, ${a} launched ${bag} into the sky, ${b} kept it unshakable through every storm, and ${c} watched it land exactly where it belonged.`;
  }, [a, b, c]);
  const shuffle = () => {
    const pool = ["🚀", "💎", "🌙", "🐂", "🔥", "🛸", "👑", "⚡", "🌊", "🦍", "💰", "🪐"];
    setA(pick(pool)); setB(pick(pool)); setC(pick(pool));
  };
  return (
    <Shell icon={Wand2} title="Emoji Story" sub="Three emojis. One legendary bag tale." accent="bg-purple-400/12 text-purple-300">
      <div className="mb-3 flex items-center justify-center gap-2">
        {[[a, setA], [b, setB], [c, setC]].map(([v, setV], i) => (
          <input key={i} value={v as string} onChange={(e) => setV(e.target.value)} maxLength={4}
            className="h-14 w-14 rounded-2xl bg-white/5 text-center text-2xl outline-none focus:ring-1 focus:ring-purple-400/40" />
        ))}
        <button onClick={shuffle} className={ghostBtn}>🎲</button>
      </div>
      <p className="rounded-xl border border-purple-400/30 bg-purple-400/[0.07] p-3 text-sm italic leading-relaxed text-purple-100">"{story}"</p>
    </Shell>
  );
}

/* W60 */
const PICKUP_LINES = [
  "Are you a bull market? Because you make my heart pump.",
  "Is your name ORBITX? Because I'm in your orbit now.",
  "You must be a private key, because I've been looking for you everywhere.",
  "Are we in a liquidity pool? Because we're making waves together.",
  "Girl, are you a stop loss? Because you just saved me.",
  "I must be a validator — I can't stop confirming how great you are.",
  "Are you gas fees? Because you're taking my breath away.",
  "Call me a whale, because I'm about to make a big move.",
  "You + me = the only merger that matters.",
  "Are you the dip? Because I want to buy you dinner.",
  "Forget diamond hands — I'd hold onto you forever.",
  "Is your wallet non-custodial? Because only I hold the keys to your heart.",
];
export function PickupLines() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * PICKUP_LINES.length));
  const [copied, copy] = useCopy();
  const next = () => setIdx((i) => (i + 1 + Math.floor(Math.random() * (PICKUP_LINES.length - 1))) % PICKUP_LINES.length);
  return (
    <Shell icon={Heart} title="Pickup Lines" sub="Crypto rizz, served fresh. Use responsibly." accent="bg-rose-400/12 text-rose-300">
      <div className="mb-3 rounded-xl border border-rose-400/30 bg-rose-400/[0.07] p-4 text-center">
        <p className="text-sm font-bold italic leading-relaxed text-rose-100">"{PICKUP_LINES[idx]}"</p>
        <p className="mt-1 text-[11px] text-white/40">line {idx + 1} of {PICKUP_LINES.length}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={next} className={cn(ghostBtn, "flex-1")}>⏭ Next line</button>
        <button onClick={() => copy("line", PICKUP_LINES[idx])} className={cn(btn, "flex-1 !bg-rose-400/15 !text-rose-200 hover:!bg-rose-400/25")}>
          {copied === "line" ? "Copied! 💘" : "📋 Copy"}
        </button>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W61 — W64                                                            */
/* ------------------------------------------------------------------ */

/* W61 */
const BREAKUP_TONES = {
  savage: { label: "🔥 Savage", closer: "blocked, muted, and thriving without you" },
  polite: { label: "🕊️ Polite", closer: "wishing you well on someone else's chart" },
  dramatic: { label: "🎭 Dramatic", closer: "*storms out while a single tear hits a green candle*" },
} as const;
type Tone = keyof typeof BREAKUP_TONES;
export function BreakupLetter() {
  const [name, setName] = useLocal("orbitx-wild3-breakup-name", "");
  const [tone, setTone] = useState<Tone>("savage");
  const me = name.trim() || "a reformed trader";
  const letter = `Dear Paper Hands,\n\nWe need to talk. It's not me, it's your stop loss.\n\nI gave you conviction. I gave you diamond-grade memes. And what did you give me? A market sell at the exact local bottom. Iconic. Tragic. Unforgivable.\n\nI'm leaving you for someone new: a cold, emotionless DCA bot who never panic-sells at 3am.\n\nDon't call. Don't text. Don't check the chart — it's up 40% since you left.\n\n${BREAKUP_TONES[tone].closer},\n${me} 💔`;
  const [copied, copy] = useCopy();
  return (
    <Shell icon={Mail} title="Breakup Letter" sub="It's time to end it with your paper hands" accent="bg-stone-400/12 text-stone-300">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sign as…" className={cn(inputCls, "mb-2")} />
      <div className="mb-2 flex gap-1.5">
        {(Object.keys(BREAKUP_TONES) as Tone[]).map((t) => (
          <button key={t} onClick={() => setTone(t)}
            className={cn("flex-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition",
              tone === t ? "bg-stone-400/25 text-stone-100" : "bg-white/5 text-white/50 hover:bg-white/10")}>
            {BREAKUP_TONES[t].label}
          </button>
        ))}
      </div>
      <pre className="mb-2 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/75">{letter}</pre>
      <button onClick={() => copy("breakup", letter)} className={cn(btn, "w-full")}>
        {copied === "breakup" ? "Copied — send it with love 💔" : "📋 Copy letter"}
      </button>
    </Shell>
  );
}

/* W62 */
const SORRY_CLOSINGS = [
  "Sincerely sorry,\nyour trader 🙏",
  "With deep regret and shallow pockets,\nyour degen 🤝",
  "Never aping after midnight again (probably),\nme 💸",
];
export function ApologyGenerator() {
  const [what, setWhat] = useLocal("orbitx-wild3-apology-what", "");
  const [when, setWhen] = useLocal("orbitx-wild3-apology-when", "");
  const [excuse, setExcuse] = useLocal("orbitx-wild3-apology-excuse", "");
  const [sincerity, setSincerity] = useState(70);
  const [copied, copy] = useCopy();
  const w = what.trim() || "[unspeakable act]"; const t = when.trim() || "that fateful night"; const ex = excuse.trim() || "the group chat told me to";
  const closing = SORRY_CLOSINGS[sincerity > 85 ? 0 : sincerity > 50 ? 1 : 2];
  const letter = `Dear Wallet,\n\nI owe you an apology. What I did — ${w} — was wrong, and I knew it ${t}.\n\nYou trusted me with your private keys and your dreams, and I repaid you with chaos. My only defense: ${ex}. I know. Weak.\n\nI promise to do better: smaller sizes, real stop losses, and absolutely no trading after midnight.\n\nPlease forgive me. You are the best wallet a degen could ask for.\n\nSincerity level: ${sincerity}% (scientifically measured)\n\n${closing}`;
  return (
    <Shell icon={PencilLine} title="Apology Generator" sub="Mad-libs style — say sorry to your wallet" accent="bg-teal-400/12 text-teal-300">
      <div className="mb-2 grid gap-2">
        <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What did you do? (e.g. aped into a memecoin)" className={inputCls} />
        <input value={when} onChange={(e) => setWhen(e.target.value)} placeholder="When? (e.g. at 3am last Tuesday)" className={inputCls} />
        <input value={excuse} onChange={(e) => setExcuse(e.target.value)} placeholder="Your excuse? (e.g. the vibes were strong)" className={inputCls} />
      </div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-bold text-white/50">Sincerity:</span>
        <input type="range" min={0} max={100} value={sincerity} onChange={(e) => setSincerity(+e.target.value)} className="flex-1 accent-teal-400" />
        <span className="text-[11px] font-extrabold text-teal-300">{sincerity}%</span>
      </div>
      <pre className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/75">{letter}</pre>
      <button onClick={() => copy("apology", letter)} className={cn(btn, "w-full !bg-teal-400/15 !text-teal-200 hover:!bg-teal-400/25")}>
        {copied === "apology" ? "Copied 🙏" : "📋 Copy apology"}
      </button>
    </Shell>
  );
}

/* W63 */
const MIC_DROPS = ["*drops mic, moonwalks off stage* 🎤🌙", "*mic drop so hard the chart pumps 2%* 📉➡️📈", "*bows, trips, recovers like nothing happened* 🕺"];
export function VictorySpeech() {
  const [dip, setDip] = useLocal("orbitx-wild3-speech-dip", "");
  const [skeptic, setSkeptic] = useLocal("orbitx-wild3-speech-skeptic", "");
  const [food, setFood] = useLocal("orbitx-wild3-speech-food", "");
  const [shout, setShout] = useLocal("orbitx-wild3-speech-shout", "");
  const [micDrop, setMicDrop] = useState(0);
  const [copied, copy] = useCopy();
  const d = dip.trim() || "the dip"; const s = skeptic.trim() || "my doubters"; const f = food.trim() || "ramen"; const h = shout.trim();
  const speech = `*walks to podium, adjusts tie*\n\nI'd like to thank ${d} — without you, I'd never have gotten in this cheap.\n\nTo ${s}: I told you. I TOLD you. But I forgive you.\n\nTo my loyal ${f}: you kept me alive through the bear market. This trophy is half yours.${h ? `\n\nSpecial shoutout to ${h} — you know what you did.` : ""}\n\nAnd finally, to ORBITX: to the moon isn't a destination, it's a lifestyle.\n\n${MIC_DROPS[micDrop % MIC_DROPS.length]}`;
  return (
    <Shell icon={Crown} title="Victory Speech" sub="Your acceptance speech for when the portfolio moons" accent="bg-yellow-400/12 text-yellow-300">
      <div className="mb-2 grid gap-2 sm:grid-cols-2">
        <input value={dip} onChange={(e) => setDip(e.target.value)} placeholder="Thank the dip…" className={inputCls} />
        <input value={skeptic} onChange={(e) => setSkeptic(e.target.value)} placeholder="Shout out skeptics…" className={inputCls} />
        <input value={food} onChange={(e) => setFood(e.target.value)} placeholder="Survival food…" className={inputCls} />
        <input value={shout} onChange={(e) => setShout(e.target.value)} placeholder="Special shoutout…" className={inputCls} />
      </div>
      <pre className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/75">{speech}</pre>
      <div className="flex gap-2">
        <button onClick={() => copy("speech", speech)} className={cn(btn, "flex-1 !bg-yellow-400/15 !text-yellow-200 hover:!bg-yellow-400/25")}>
          {copied === "speech" ? "Copied 🏆" : "📋 Copy speech"}
        </button>
        <button onClick={() => setMicDrop((m) => m + 1)} className={ghostBtn}>🎤 Mic drop</button>
      </div>
    </Shell>
  );
}

/* W64 */
const CAUSES = ["rugged", "jeeted too early", "fomo'd the top", "forgot the seed phrase", "trust in a dev with an anime pfp", "leverage. just leverage."];
export function EulogyForBag() {
  const [token, setToken] = useLocal("orbitx-wild3-eulogy-token", "");
  const [cause, setCause] = useLocal("orbitx-wild3-eulogy-cause", CAUSES[0]);
  const [flowers, setFlowers] = useLocal<number>("orbitx-wild3-eulogy-flowers", 0);
  const [copied, copy] = useCopy();
  const t = token.trim() || "a beloved shitcoin";
  const eulogy = `🕊️ In Loving Memory of ${t}\n\nWe gather here today to mourn a position taken too soon and held too long.\n\nCause of death: ${cause}.\n\n${t} taught us many things: that green candles lie, that "community-driven" means the devs left, and that hope is not a strategy.\n\nIt is survived by a screenshot of the all-time high and a lesson we will absolutely not learn.\n\nRest in pieces. You will be averaged down in our hearts forever. 🪦`;
  return (
    <Shell icon={Ghost} title="Eulogy for a Bag" sub="Say goodbye to a dead position, with dignity" accent="bg-slate-400/12 text-slate-300">
      <div className="mb-2 grid gap-2 sm:grid-cols-2">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token name…" className={inputCls} />
        <select value={cause} onChange={(e) => setCause(e.target.value)} className="rounded-xl bg-white/5 px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-slate-400/40 [&>option]:bg-zinc-900">
          {CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <pre className="mb-2 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/75">{eulogy}</pre>
      <div className="flex gap-2">
        <button onClick={() => setFlowers((f) => f + 1)} className={cn(ghostBtn, "flex-1")}>
          🌸 Lay flowers {flowers > 0 && `(${flowers})`}
        </button>
        <button onClick={() => copy("eulogy", eulogy)} className={cn(btn, "flex-1")}>
          {copied === "eulogy" ? "Copied 🕊️" : "📋 Copy eulogy"}
        </button>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* W65 — W66                                                            */
/* ------------------------------------------------------------------ */

/* W65 */
const VERDICTS = [
  "the court finds this token GUILTY of wasting your time. DIVORCE GRANTED. 🔨",
  "irreconcilable red candles. The marriage is dissolved. You keep the memes. 🔨",
  "grounds accepted: emotional damage. This token is hereby CANCELLED from your portfolio. 🔨",
  "the judge has seen the chart. Verdict: DIVORCED. May your next bag treat you better. 🔨",
];
export function DivorceCourt() {
  const [token, setToken] = useLocal("orbitx-wild3-divorce-token", "");
  const [grounds, setGrounds] = useLocal("orbitx-wild3-divorce-grounds", "");
  const [verdict, setVerdict] = useState<string | null>(null);
  const [banging, setBanging] = useState(false);
  const rule = () => {
    setBanging(true); setVerdict(null);
    setTimeout(() => { setVerdict(pick(VERDICTS)); setBanging(false); }, 700);
  };
  return (
    <Shell icon={Gavel} title="Divorce Court" sub="Judge Orbit presides over your token breakup" accent="bg-amber-400/12 text-amber-300">
      <div className="mb-2 grid gap-2 sm:grid-cols-2">
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token to divorce…" className={inputCls} />
        <input value={grounds} onChange={(e) => setGrounds(e.target.value)} placeholder="Grounds (e.g. rugged me twice)" className={inputCls} />
      </div>
      <button onClick={rule} disabled={banging} className={cn(btn, "w-full !bg-amber-400/15 !text-amber-200 hover:!bg-amber-400/25")}>
        {banging ? "🔨 BANGING GAVEL…" : "⚖️ Bring down the gavel"}
      </button>
      {verdict && (
        <div className="mt-3 animate-pulse rounded-xl border border-amber-400/40 bg-amber-400/[0.08] p-3 text-center">
          <p className="text-xs font-bold text-white/50">Case: {token.trim() || "John Doe Token"} vs You</p>
          <p className="mt-1 text-sm font-extrabold leading-relaxed text-amber-100">{verdict}</p>
          {grounds.trim() && <p className="mt-1 text-[11px] italic text-white/40">Grounds cited: "{grounds.trim()}"</p>}
        </div>
      )}
    </Shell>
  );
}

/* W66 */
export function ShillMadLibs() {
  const [adj, setAdj] = useLocal("orbitx-wild3-madlib-adj", "");
  const [noun, setNoun] = useLocal("orbitx-wild3-madlib-noun", "");
  const [verb, setVerb] = useLocal("orbitx-wild3-madlib-verb", "");
  const [place, setPlace] = useLocal("orbitx-wild3-madlib-place", "");
  const [copied, copy] = useCopy();
  const A = adj.trim() || "astronomical"; const N = noun.trim() || "rocket"; const V = verb.trim() || "moonwalk"; const P = place.trim() || "the group chat";
  const tweet = `🚀 BREAKING: ORBITX just went full ${A} mode.\n\nThe ${N} is fueled, the charts are ready to ${V}, and honestly? ${P} has never been this right about anything.\n\nThis is not financial advice. This is financial PROPHECY. 🔮\n\n#ORBITX #WAGMI`;
  return (
    <Shell icon={Drama} title="Shill Mad Libs" sub="Four words in, one legendary shill out" accent="bg-pink-400/12 text-pink-300">
      <div className="mb-2 grid grid-cols-2 gap-2">
        <input value={adj} onChange={(e) => setAdj(e.target.value)} placeholder="Adjective (e.g. spicy)" className={inputCls} />
        <input value={noun} onChange={(e) => setNoun(e.target.value)} placeholder="Noun (e.g. lambo)" className={inputCls} />
        <input value={verb} onChange={(e) => setVerb(e.target.value)} placeholder="Verb (e.g. teleport)" className={inputCls} />
        <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Place (e.g. the moon)" className={inputCls} />
      </div>
      <pre className="mb-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-white/75">{tweet}</pre>
      <div className="flex gap-2">
        <button onClick={() => copy("madlib", tweet)} className={cn(btn, "flex-1 !bg-pink-400/15 !text-pink-200 hover:!bg-pink-400/25")}>
          {copied === "madlib" ? "Copied! 🚀" : "📋 Copy shill"}
        </button>
        <button onClick={() => { setAdj(""); setNoun(""); setVerb(""); setPlace(""); }} className={ghostBtn}>Clear</button>
      </div>
    </Shell>
  );
}
