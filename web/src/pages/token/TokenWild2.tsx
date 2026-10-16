import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  PawPrint, Heart, Cherry, TrendingUp, MousePointerClick, Shield, Flag, Fish,
  Eye, Flame, Music, Gem, RotateCw, Swords, Timer, Hammer, Dice5, Hand,
  Brain, Zap, Coins, Hash,
} from "lucide-react";

function Shell({ icon: Icon, title, sub, accent, children }: { icon: LucideIcon; title: string; sub: string; accent: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="truncate text-xs text-white/50">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

{/* W23 */}
export function BearBoss2() {
  const [hp, setHp] = useState(100);
  const [hits, setHits] = useState<{ id: number; dmg: number }[]>([]);
  const idRef = useRef(0);
  const attack = () => {
    if (hp <= 0) return;
    const dmg = 5 + Math.floor(Math.random() * 11);
    const id = ++idRef.current;
    setHits((h) => [...h.slice(-7), { id, dmg }]);
    setTimeout(() => setHits((h) => h.filter((x) => x.id !== id)), 800);
    setHp((v) => Math.max(0, v - dmg));
  };
  return (
    <Shell icon={PawPrint} title="Bear Boss 2" sub="Click the bear. Bring it down." accent="bg-amber-500/20 text-amber-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className={cn("h-full transition-all", hp > 30 ? "bg-red-500" : "bg-red-800")} style={{ width: `${hp}%` }} />
        </div>
        <button onClick={attack} disabled={hp <= 0} className="relative text-6xl transition-transform active:scale-90 disabled:opacity-40" aria-label="attack bear">
          🐻
          {hits.map((h) => (
            <span key={h.id} className="absolute -top-3 left-1/2 -translate-x-1/2 animate-pulse text-lg font-black text-red-400">-{h.dmg}</span>
          ))}
        </button>
        {hp <= 0 ? (
          <div className="text-center">
            <p className="font-bold text-green-400">BEAR DEFEATED! 🎉</p>
            <button onClick={() => setHp(100)} className="mt-2 rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">Fight again</button>
          </div>
        ) : <p className="text-sm text-white/60">{hp} HP left — click!</p>}
      </div>
    </Shell>
  );
}

{/* W24 */}
export function Tamagotchi2() {
  const [mood, setMood] = useState(() => Number(localStorage.getItem("orbitx-wild2-pet2-mood") ?? 50));
  const pet = mood >= 75 ? "😄" : mood >= 50 ? "🙂" : mood >= 25 ? "😟" : "😢";
  const act = (d: number, label: string) => {
    setMood((m) => { const v = Math.min(100, Math.max(0, m + d)); localStorage.setItem("orbitx-wild2-pet2-mood", String(v)); return v; });
    setLast(label);
  };
  const [last, setLast] = useState("Your pet remembers everything.");
  return (
    <Shell icon={Heart} title="Tamagotchi 2" sub="A second, needier pet" accent="bg-rose-500/20 text-rose-300">
      <div className="flex flex-col items-center gap-2 py-1">
        <div className="text-6xl">{pet}</div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-rose-400 transition-all" style={{ width: `${mood}%` }} />
        </div>
        <p className="text-xs text-white/50">Mood: {mood}/100</p>
        <div className="flex gap-2">
          <button onClick={() => act(15, "Yum! 🍖")} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">🍖 Feed</button>
          <button onClick={() => act(10, "Wee! 🎾")} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">🎾 Play</button>
          <button onClick={() => act(-20, "Hey! That hurt. 😠")} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">😠 Scold</button>
        </div>
        <p className="text-xs italic text-white/40">{last}</p>
      </div>
    </Shell>
  );
}

{/* W25 */}
export function SlotMachine2() {
  const EMOJI = ["🍒", "⭐", "💎", "🚀", "🐻", "🪙"];
  const [reels, setReels] = useState(["🍒", "⭐", "💎"]);
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState("Hit spin!");
  const [spins, setSpins] = useState(() => Number(localStorage.getItem("orbitx-wild2-slots-spins") ?? 0));
  const roll = () => EMOJI[Math.floor(Math.random() * EMOJI.length)];
  const spin = () => {
    if (spinning) return;
    setSpinning(true); setMsg("...");
    const id = setInterval(() => setReels([roll(), roll(), roll()]), 100);
    setTimeout(() => {
      clearInterval(id);
      const r = [roll(), roll(), roll()];
      setReels(r); setSpinning(false);
      setMsg(r[0] === r[1] && r[1] === r[2] ? "JACKPOT! 🎰🎉" : "No luck. Spin again?");
      setSpins((s) => { const v = s + 1; localStorage.setItem("orbitx-wild2-slots-spins", String(v)); return v; });
    }, 1000);
  };
  return (
    <Shell icon={Cherry} title="Slot Machine 2" sub="Three reels, zero rent money" accent="bg-purple-500/20 text-purple-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <div className="flex gap-2 text-5xl">
          {reels.map((r, i) => <div key={i} className={cn("rounded-xl bg-white/5 px-3 py-2", spinning && "animate-pulse")}>{r}</div>)}
        </div>
        <p className="text-sm font-semibold text-white/80">{msg}</p>
        <button onClick={spin} disabled={spinning} className="rounded-lg bg-purple-500/30 px-6 py-2 text-sm font-bold text-purple-100 hover:bg-purple-500/50 disabled:opacity-40">SPIN</button>
        <p className="text-xs text-white/40">Spins: {spins}</p>
      </div>
    </Shell>
  );
}

{/* W26 */}
export function PredictionGame2() {
  const [phase, setPhase] = useState<"pick" | "count" | "done">("pick");
  const [pick, setPick] = useState<"green" | "red" | null>(null);
  const [secs, setSecs] = useState(10);
  const [result, setResult] = useState<"green" | "red" | null>(null);
  const [score, setScore] = useState<{ w: number; l: number }>(() => JSON.parse(localStorage.getItem("orbitx-wild2-pred") ?? '{"w":0,"l":0}'));
  const choose = (p: "green" | "red") => {
    setPick(p); setPhase("count"); setSecs(10); setResult(null);
    const id = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(id);
          const r = Math.random() < 0.5 ? "green" : "red";
          setResult(r); setPhase("done");
          setScore((sc) => { const v = r === p ? { w: sc.w + 1, l: sc.l } : { w: sc.w, l: sc.l + 1 }; localStorage.setItem("orbitx-wild2-pred", JSON.stringify(v)); return v; });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };
  return (
    <Shell icon={TrendingUp} title="Prediction Game 2" sub="SIMULATED — pure luck, no alpha" accent="bg-emerald-500/20 text-emerald-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <p className="text-xs font-bold uppercase tracking-widest text-white/40">simulated market</p>
        {phase === "pick" && (
          <div className="flex gap-2">
            <button onClick={() => choose("green")} className="rounded-lg bg-green-500/30 px-5 py-2 font-bold text-green-200 hover:bg-green-500/50">🟢 GREEN</button>
            <button onClick={() => choose("red")} className="rounded-lg bg-red-500/30 px-5 py-2 font-bold text-red-200 hover:bg-red-500/50">🔴 RED</button>
          </div>
        )}
        {phase === "count" && <p className="text-4xl font-black tabular-nums">{secs}s</p>}
        {phase === "done" && (
          <>
            <p className="text-2xl">{result === "green" ? "🟢" : "🔴"} {result === pick ? "You called it! 🎯" : "Wrong side. 😅"}</p>
            <button onClick={() => setPhase("pick")} className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">Again</button>
          </>
        )}
        <p className="text-xs text-white/40">Record: {score.w}W / {score.l}L</p>
      </div>
    </Shell>
  );
}

{/* W27 */}
export function ClickerGame() {
  const [clicks, setClicks] = useState(0);
  const [left, setLeft] = useState(15);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("orbitx-wild2-clicker-best") ?? 0));
  useEffect(() => {
    if (!running) return;
    if (left <= 0) {
      setRunning(false);
      setBest((b) => { const v = Math.max(b, clicks); localStorage.setItem("orbitx-wild2-clicker-best", String(v)); return v; });
      return;
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [running, left, clicks]);
  const start = () => { setClicks(0); setLeft(15); setRunning(true); };
  const cps = clicks / Math.max(1, 15 - left);
  return (
    <Shell icon={MousePointerClick} title="Clicker Game" sub="Mash the ◈ for 15 seconds" accent="bg-cyan-500/20 text-cyan-300">
      <div className="flex flex-col items-center gap-2 py-1">
        <p className="text-sm text-white/60">{running ? `${left}s left` : left <= 0 ? "Time! Mash again?" : "Ready?"}</p>
        <button
          onClick={() => { if (!running && left > 0 && clicks === 0) start(); else if (running) setClicks((c) => c + 1); }}
          className="select-none text-7xl transition-transform active:scale-90"
          aria-label="click target"
        >◈</button>
        <p className="text-lg font-bold tabular-nums">{clicks} clicks · {cps.toFixed(1)} CPS</p>
        <p className="text-xs text-white/40">Best: {best} clicks</p>
        {!running && (left <= 0 || clicks > 0) && <button onClick={start} className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">Restart</button>}
      </div>
    </Shell>
  );
}

{/* W28 */}
export function TowerDefenseLite() {
  const cv = useRef<HTMLCanvasElement>(null);
  const g = useRef({ towers: [] as { x: number; y: number; cd: number }[], foes: [] as { x: number; hp: number }[], gold: 60, wave: 0, lives: 5, spawnN: 0, t: 0, over: false, win: false });
  const [hud, setHud] = useState({ gold: 60, wave: 0, lives: 5, end: "" });
  useEffect(() => {
    const id = setInterval(() => {
      const s = g.current;
      if (!s.over) {
        s.t++;
        if (s.foes.length === 0 && s.spawnN <= 0) {
          if (s.wave >= 5) { s.over = true; s.win = true; }
          else { s.wave++; s.spawnN = 2 + s.wave * 2; }
        }
        if (s.spawnN > 0 && s.t % 18 === 0) { s.foes.push({ x: -8, hp: 2 + s.wave }); s.spawnN--; }
        s.towers.forEach((tw) => { tw.cd--; if (tw.cd <= 0) { const f = s.foes.find((f) => Math.hypot(f.x - tw.x, 90 - tw.y) < 70); if (f) { f.hp -= 1; tw.cd = 9; } } });
        s.foes = s.foes.filter((f) => { f.x += 1.3; if (f.hp <= 0) { s.gold += 10; return false; } if (f.x > 300) { s.lives--; return false; } return true; });
        if (s.lives <= 0) { s.over = true; s.win = false; }
      }
      const c = cv.current?.getContext("2d");
      if (c) {
        c.fillStyle = "#0b1220"; c.fillRect(0, 0, 300, 170);
        c.fillStyle = "#1e293b"; c.fillRect(0, 80, 300, 20);
        s.towers.forEach((tw) => { c.fillStyle = "#2dd4bf"; c.beginPath(); c.arc(tw.x, tw.y, 7, 0, 7); c.fill(); });
        s.foes.forEach((f) => { c.fillStyle = "#ef4444"; c.fillRect(f.x - 5, 85, 10, 10); });
      }
      setHud({ gold: s.gold, wave: s.wave, lives: s.lives, end: s.win ? "Victory! All 5 waves cleared. 🏆" : s.over ? "Base overrun! 💀" : "" });
    }, 60);
    return () => clearInterval(id);
  }, []);
  const reset = () => { g.current = { towers: [], foes: [], gold: 60, wave: 0, lives: 5, spawnN: 0, t: 0, over: false, win: false }; };
  return (
    <Shell icon={Shield} title="Tower Defense Lite" sub="Stop the red squares" accent="bg-teal-500/20 text-teal-300">
      <canvas ref={cv} width={300} height={170} className="w-full cursor-crosshair rounded-lg border border-white/10"
        onClick={(e) => {
          const s = g.current; if (s.over) return;
          const r = cv.current!.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * 300, y = ((e.clientY - r.top) / r.height) * 170;
          if (s.gold < 20 || (y > 76 && y < 104)) return;
          s.gold -= 20; s.towers.push({ x, y, cd: 0 });
        }} />
      <div className="mt-2 flex items-center justify-between text-xs text-white/60">
        <span>🪙 {hud.gold} · ❤️ {hud.lives} · Wave {Math.max(1, hud.wave)}/5</span>
        {hud.end ? <button onClick={reset} className="rounded-lg bg-white/10 px-3 py-1 font-semibold hover:bg-white/20">Restart</button> : <span>Tap field: tower (20g)</span>}
      </div>
      {hud.end && <p className="mt-1 text-center text-sm font-bold text-white/80">{hud.end}</p>}
    </Shell>
  );
}

{/* W29 */}
export function RacingGame() {
  const RACERS = ["🐢", "🐇", "🦊", "🐌"];
  const [coins, setCoins] = useState(100);
  const [pos, setPos] = useState([0, 0, 0, 0]);
  const [racing, setRacing] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [msg, setMsg] = useState("Pick a racer — bet 10 coins.");
  const start = (i: number) => {
    if (racing || coins < 10) { if (coins < 10) setMsg("Broke! Resetting purse…"); return; }
    setRacing(true); setWinner(null); setCoins((c) => c - 10); setMsg(`${RACERS[i]} is off!`);
    const p = [0, 0, 0, 0];
    const id = setInterval(() => {
      let done = -1;
      for (let k = 0; k < 4; k++) { p[k] += 1 + Math.random() * 4; if (p[k] >= 100 && done < 0) done = k; }
      setPos([...p]);
      if (done >= 0) {
        clearInterval(id); setRacing(false); setWinner(done);
        if (done === i) { setCoins((c) => c + 25); setMsg(`${RACERS[done]} wins! +25 coins 🎉`); }
        else setMsg(`${RACERS[done]} wins. Your racer lost. 😅`);
      }
    }, 100);
  };
  return (
    <Shell icon={Flag} title="Racing Game" sub="Bet 10 game coins on a critter" accent="bg-orange-500/20 text-orange-300">
      <div className="flex flex-col gap-2 py-1">
        {RACERS.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <button onClick={() => start(i)} disabled={racing} className="text-2xl transition-transform hover:scale-125 disabled:opacity-60" aria-label={`bet on ${r}`}>{r}</button>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-orange-400 transition-all" style={{ width: `${Math.min(100, pos[i])}%` }} />
            </div>
            {winner === i && <span className="text-sm">🏆</span>}
          </div>
        ))}
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>🪙 {coins} coins</span><span>{msg}</span>
        </div>
        {coins < 10 && !racing && <button onClick={() => { setCoins(100); setMsg("Purse refilled. Back in the game!"); }} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">Refill coins</button>}
      </div>
    </Shell>
  );
}

{/* W30 */}
export function FishingGame() {
  const [phase, setPhase] = useState<"idle" | "wait" | "bite" | "caught" | "miss">("idle");
  const [last, setLast] = useState("The water is calm…");
  const [fish, setFish] = useState<string[]>(() => JSON.parse(localStorage.getItem("orbitx-wild2-fish") ?? "[]"));
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const cast = () => {
    clear(); setPhase("wait"); setLast("Waiting for a nibble… 🎣");
    timers.current.push(window.setTimeout(() => {
      setPhase("bite"); setLast("BITE! REEL NOW!! ⚡");
      timers.current.push(window.setTimeout(() => { setPhase((p) => { if (p === "bite") { setLast("It got away… 🫠"); return "miss"; } return p; }); }, 1500));
    }, 2000 + Math.random() * 3000));
  };
  const reel = () => {
    clear();
    if (phase !== "bite") { setPhase("miss"); setLast("Too soon! You scared it. 😅"); return; }
    const w = Math.random();
    const c = w < 0.5 ? "🐟 Common Carp" : w < 0.8 ? "🐠 Blue Tang" : w < 0.95 ? "🐡 Puffer (RARE!)" : "🦈 Shark (LEGENDARY!!)";
    setFish((f) => { const v = [...f, c]; localStorage.setItem("orbitx-wild2-fish", JSON.stringify(v)); return v; });
    setLast(`Caught: ${c}`); setPhase("caught");
  };
  return (
    <Shell icon={Fish} title="Fishing Game" sub="Reel in the 1.5s bite window" accent="bg-sky-500/20 text-sky-300">
      <div className="flex flex-col items-center gap-2 py-1">
        <div className={cn("text-5xl", phase === "bite" && "animate-bounce")}>{phase === "bite" ? "🐠💥" : phase === "wait" ? "🎣" : "🌊"}</div>
        <p className="text-sm font-semibold text-white/80">{last}</p>
        <div className="flex gap-2">
          <button onClick={cast} disabled={phase === "wait" || phase === "bite"} className="rounded-lg bg-sky-500/30 px-4 py-1.5 text-sm font-bold text-sky-100 hover:bg-sky-500/50 disabled:opacity-40">Cast</button>
          <button onClick={reel} disabled={phase !== "wait" && phase !== "bite"} className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-bold hover:bg-white/20 disabled:opacity-40">Reel!</button>
        </div>
        <p className="text-xs text-white/40">Catches ({fish.length}): {fish.slice(-3).join(" · ") || "none yet"}</p>
      </div>
    </Shell>
  );
}

{/* W31 */}
export function HideAndSeek() {
  const [hide, setHide] = useState(() => Math.floor(Math.random() * 5));
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const pick = (i: number) => {
    if (picked !== null || done) return;
    setPicked(i);
    if (i === hide) setScore((s) => s + 1);
    setTimeout(() => {
      if (round >= 3) setDone(true);
      else { setRound((r) => r + 1); setHide(Math.floor(Math.random() * 5)); setPicked(null); }
    }, 1300);
  };
  const reset = () => { setHide(Math.floor(Math.random() * 5)); setRound(1); setScore(0); setPicked(null); setDone(false); };
  return (
    <Shell icon={Eye} title="Hide and Seek" sub="Orbit is behind one box. Find him." accent="bg-indigo-500/20 text-indigo-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <p className="text-xs text-white/50">Round {Math.min(round, 3)} of 3 · Score: {score}</p>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <button key={i} onClick={() => pick(i)} disabled={picked !== null}
              className={cn("flex h-14 w-12 items-center justify-center rounded-lg text-2xl transition-all",
                picked === null ? "bg-white/10 hover:bg-white/20" : i === hide ? "bg-green-500/30" : picked === i ? "bg-red-500/30" : "bg-white/5")}>
              {picked !== null && i === hide ? "🪐" : "📦"}
            </button>
          ))}
        </div>
        {picked !== null && !done && <p className="text-sm font-semibold">{picked === hide ? "Found him! 🎉" : "Not this one…"}</p>}
        {done && (
          <div className="text-center">
            <p className="font-bold text-white">{score === 3 ? "Perfect seeker! 🏆" : score === 0 ? "Orbit is too sneaky. 🥷" : `You found him ${score}/3!`}</p>
            <button onClick={reset} className="mt-2 rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">Play again</button>
          </div>
        )}
      </div>
    </Shell>
  );
}

{/* W32 */}
export function FloorIsLava() {
  const [lava, setLava] = useState(() => Math.floor(Math.random() * 5));
  const [round, setRound] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [over, setOver] = useState<"win" | "lose" | null>(null);
  const pick = (i: number) => {
    if (revealed || over) return;
    setRevealed(true);
    if (i === lava) { setOver("lose"); return; }
    setTimeout(() => {
      if (round >= 5) setOver("win");
      else { setRound((r) => r + 1); setLava(Math.floor(Math.random() * 5)); setRevealed(false); }
    }, 800);
  };
  const reset = () => { setLava(Math.floor(Math.random() * 5)); setRound(1); setRevealed(false); setOver(null); };
  return (
    <Shell icon={Flame} title="Floor Is Lava" sub="Pick 5 safe tiles in a row" accent="bg-red-500/20 text-red-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <p className="text-xs text-white/50">Round {round} of 5</p>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <button key={i} onClick={() => pick(i)} disabled={revealed}
              className={cn("flex h-14 w-12 items-center justify-center rounded-lg text-2xl",
                revealed && i === lava ? "bg-orange-600/50" : revealed ? "bg-green-500/25" : "bg-white/10 hover:bg-white/20")}>
              {revealed ? (i === lava ? "🌋" : "✅") : "🟫"}
            </button>
          ))}
        </div>
        {over === "win" && <p className="font-bold text-green-400">You crossed! Feet intact. 🏆</p>}
        {over === "lose" && <p className="font-bold text-red-400">MOLTEN. ☠️</p>}
        {over && <button onClick={reset} className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">Try again</button>}
      </div>
    </Shell>
  );
}

{/* W33 */}
export function RhythmGame() {
  const [level, setLevel] = useState(1);
  const [seq, setSeq] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [showing, setShowing] = useState(false);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState("Press start, watch, repeat.");
  const start = (lv: number) => {
    const s = Array.from({ length: 4 }, () => Math.floor(Math.random() * 4));
    const speed = 620 - lv * 80;
    setSeq(s); setIdx(0); setShowing(true); setMsg(`Level ${lv} — watch…`);
    s.forEach((d, k) => {
      setTimeout(() => setLit(d), k * speed);
      setTimeout(() => setLit(null), k * speed + speed * 0.6);
    });
    setTimeout(() => { setShowing(false); setMsg("Your turn!"); }, s.length * speed + 100);
  };
  const tap = (d: number) => {
    if (showing || seq.length === 0) return;
    setLit(d); setTimeout(() => setLit(null), 120);
    if (d === seq[idx]) {
      const n = idx + 1; setIdx(n);
      if (n === seq.length) {
        const sc = score + level * 10; setScore(sc);
        if (level >= 5) { setMsg(`All 5 levels! Final score: ${sc} 🎶🏆`); setSeq([]); }
        else { const nl = level + 1; setLevel(nl); setTimeout(() => start(nl), 700); }
      }
    } else { setMsg("Wrong beat! Replay the level."); setTimeout(() => start(level), 700); }
  };
  const reset = () => { setLevel(1); setScore(0); setSeq([]); setMsg("Press start, watch, repeat."); };
  return (
    <Shell icon={Music} title="Rhythm Game" sub="Tap the dots in order" accent="bg-violet-500/20 text-violet-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <button key={i} onClick={() => tap(i)} disabled={showing}
              className={cn("h-12 w-12 rounded-full border-2 transition-all",
                lit === i ? "scale-110 border-violet-300 bg-violet-400 shadow-[0_0_20px_rgba(167,139,250,0.8)]" : "border-white/20 bg-white/5 hover:bg-white/10")} />
          ))}
        </div>
        <p className="text-sm text-white/70">{msg}</p>
        <div className="flex items-center gap-3">
          <button onClick={() => start(1)} disabled={showing || seq.length > 0} className="rounded-lg bg-violet-500/30 px-4 py-1.5 text-sm font-bold text-violet-100 hover:bg-violet-500/50 disabled:opacity-40">Start</button>
          <button onClick={reset} className="rounded-lg bg-white/10 px-4 py-1.5 text-sm hover:bg-white/20">Reset</button>
          <span className="text-xs text-white/40">Lvl {level} · {score} pts</span>
        </div>
      </div>
    </Shell>
  );
}

{/* W34 */}
export function TreasureHunt() {
  const [treasure, setTreasure] = useState(() => Math.floor(Math.random() * 9));
  const [opened, setOpened] = useState<number[]>([]);
  const [hint, setHint] = useState("Pick a chest…");
  const [best, setBest] = useState(99);
  const dist = (i: number) => Math.abs(Math.floor(i / 3) - Math.floor(treasure / 3)) + Math.abs((i % 3) - (treasure % 3));
  const open = (i: number) => {
    if (opened.includes(i)) return;
    if (i === treasure) { setOpened((o) => [...o, i]); setHint(`TREASURE in ${opened.length + 1} ${opened.length === 0 ? "try" : "tries"}! 💰`); return; }
    const d = dist(i);
    setHint(d < best ? "🔥 Warmer!" : d === best ? "😐 Same distance…" : "🧊 Colder!");
    setBest(Math.min(best, d));
    setOpened((o) => [...o, i]);
  };
  const reset = () => { setTreasure(Math.floor(Math.random() * 9)); setOpened([]); setHint("Pick a chest…"); setBest(99); };
  return (
    <Shell icon={Gem} title="Treasure Hunt" sub="One chest hides the loot" accent="bg-yellow-500/20 text-yellow-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <button key={i} onClick={() => open(i)} disabled={opened.includes(i) || opened.includes(treasure)}
              className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/10 text-3xl hover:bg-white/20 disabled:opacity-70">
              {i === treasure && opened.includes(i) ? "💰" : opened.includes(i) ? "❌" : "🧰"}
            </button>
          ))}
        </div>
        <p className="text-sm font-semibold text-white/80">{hint}</p>
        {opened.includes(treasure) && <button onClick={reset} className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">Hide it again</button>}
      </div>
    </Shell>
  );
}

{/* W35 */}
export function SpinWheel2() {
  const PRIZES = ["Nothing 🎭", "+10 Aura ✨", "Jeet Repellent 🧪", "Diamond Hands 💎", "Rug Insurance 🛡️", "Orbit Sticker 🪐", "Try Again 🔁", "Moon Ticket 🌙"];
  const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
  const [rot, setRot] = useState(0);
  const [prize, setPrize] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const spin = () => {
    if (spinning) return;
    setSpinning(true); setPrize(null);
    const idx = Math.floor(Math.random() * 8);
    const base = rot - (rot % 360);
    const next = base + 360 * 6 + (337.5 - idx * 45);
    setRot(next);
    setTimeout(() => { setPrize(PRIZES[idx]); setSpinning(false); }, 3100);
  };
  return (
    <Shell icon={RotateCw} title="Spin Wheel 2" sub="8 joke prizes, 0 refunds" accent="bg-pink-500/20 text-pink-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <div className="relative">
          <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 text-xl">🔻</div>
          <div className="relative h-40 w-40 overflow-hidden rounded-full border-4 border-white/20 transition-transform duration-[3000ms] ease-out"
            style={{ transform: `rotate(${rot}deg)`, background: `conic-gradient(${COLORS.map((c, i) => `${c} ${i * 45}deg ${(i + 1) * 45}deg`).join(", ")})` }}>
            {PRIZES.map((_, i) => (
              <span key={i} className="absolute left-1/2 top-1/2 text-xs" style={{ transform: `rotate(${i * 45 + 22.5}deg) translateY(-62px)` }}>🎁</span>
            ))}
          </div>
        </div>
        <p className="text-sm font-bold text-white/90">{spinning ? "Spinning…" : prize ? `You won: ${prize}` : "Give it a spin!"}</p>
        <button onClick={spin} disabled={spinning} className="rounded-lg bg-pink-500/30 px-6 py-2 text-sm font-bold text-pink-100 hover:bg-pink-500/50 disabled:opacity-40">SPIN</button>
      </div>
    </Shell>
  );
}

{/* W36 */}
export function PetBattles() {
  const [php, setPhp] = useState(30);
  const [ehp, setEhp] = useState(25);
  const [foe] = useState(() => ["🐍", "🦂", "🐺"][Math.floor(Math.random() * 3)]);
  const [log, setLog] = useState("A wild pet appears!");
  const over = php <= 0 || ehp <= 0;
  const attack = () => {
    if (over) return;
    const d = 4 + Math.floor(Math.random() * 5);
    const ne = Math.max(0, ehp - d);
    setEhp(ne);
    if (ne <= 0) { setLog(`You hit ${d}! Wild ${foe} fainted. YOU WIN! 🏆`); return; }
    const c = 3 + Math.floor(Math.random() * 5);
    setPhp((p) => Math.max(0, p - c));
    setLog(`You hit ${d} — foe counters for ${c}.`);
  };
  const heal = () => {
    if (over) return;
    const c = 3 + Math.floor(Math.random() * 5);
    setPhp((p) => Math.max(0, Math.min(30, p + 8) - c));
    setLog(`Healed +8, but foe hits ${c}.`);
  };
  const bar = (v: number, max: number, color: string) => (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10"><div className={cn("h-full transition-all", color)} style={{ width: `${(v / max) * 100}%` }} /></div>
  );
  return (
    <Shell icon={Swords} title="Pet Battles" sub="Your pet vs the wild" accent="bg-lime-500/20 text-lime-300">
      <div className="flex flex-col gap-2 py-1">
        <div className="flex items-center justify-between"><span className="text-3xl">🐶</span><span className="text-xs text-white/50">You: {php}/30</span></div>
        {bar(php, 30, "bg-green-400")}
        <div className="flex items-center justify-between"><span className="text-3xl">{foe}</span><span className="text-xs text-white/50">Wild: {ehp}/25</span></div>
        {bar(ehp, 25, "bg-red-400")}
        <p className="min-h-5 text-center text-xs italic text-white/60">{log}</p>
        <div className="flex justify-center gap-2">
          {!over ? (
            <>
              <button onClick={attack} className="rounded-lg bg-red-500/30 px-4 py-1.5 text-sm font-bold text-red-100 hover:bg-red-500/50">⚔️ Attack</button>
              <button onClick={heal} className="rounded-lg bg-green-500/30 px-4 py-1.5 text-sm font-bold text-green-100 hover:bg-green-500/50">💚 Heal</button>
            </>
          ) : (
            <button onClick={() => { setPhp(30); setEhp(25); setLog("A wild pet appears!"); }} className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">Battle again</button>
          )}
        </div>
        {over && <p className="text-center text-sm font-bold">{php <= 0 ? "Your pet fainted… 💀" : "Flawless victory! 🎉"}</p>}
      </div>
    </Shell>
  );
}

{/* W37 */}
export function SpeedrunTimer() {
  const [ms, setMs] = useState(0);
  const [run, setRun] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("orbitx-wild2-speedrun") ?? 0));
  const t0 = useRef(0);
  useEffect(() => {
    if (!run) return;
    t0.current = Date.now() - ms;
    const id = setInterval(() => setMs(Date.now() - t0.current), 31);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  const stop = () => {
    setRun(false);
    if (ms > 0) setBest((b) => { const v = b === 0 ? ms : Math.min(b, ms); localStorage.setItem("orbitx-wild2-speedrun", String(v)); return v; });
  };
  const fmt = (v: number) => `${(v / 1000).toFixed(2)}s`;
  return (
    <Shell icon={Timer} title="Speedrun Timer" sub="any% page scroll (glitchless)" accent="bg-slate-500/20 text-slate-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <p className="font-mono text-5xl font-black tabular-nums text-white">{fmt(ms)}</p>
        <div className="flex gap-2">
          {!run ? (
            <button onClick={() => setRun(true)} className="rounded-lg bg-green-500/30 px-5 py-2 text-sm font-bold text-green-100 hover:bg-green-500/50">▶ Start</button>
          ) : (
            <button onClick={stop} className="rounded-lg bg-red-500/30 px-5 py-2 text-sm font-bold text-red-100 hover:bg-red-500/50">⏹ Stop</button>
          )}
          <button onClick={() => { setRun(false); setMs(0); }} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">Reset</button>
        </div>
        <p className="text-xs text-white/40">Personal best: {best > 0 ? fmt(best) : "—"}</p>
      </div>
    </Shell>
  );
}

{/* W38 */}
export function WhackAJeet() {
  const [active, setActive] = useState(-1);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(20);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const pop = setInterval(() => setActive(Math.floor(Math.random() * 9)), 800);
    const tick = setInterval(() => setLeft((l) => { if (l <= 1) { setPlaying(false); setActive(-1); return 0; } return l - 1; }), 1000);
    return () => { clearInterval(pop); clearInterval(tick); };
  }, [playing]);
  const whack = (i: number) => { if (playing && i === active) { setScore((s) => s + 1); setActive(-1); } };
  const start = () => { setScore(0); setLeft(20); setPlaying(true); };
  return (
    <Shell icon={Hammer} title="Whack-a-Jeet" sub="Bonk the paper hands in 20s" accent="bg-orange-600/20 text-orange-300">
      <div className="flex flex-col items-center gap-2 py-1">
        <p className="text-xs text-white/50">{playing ? `${left}s left` : left <= 0 ? `Done! Score: ${score}` : "Ready to bonk?"}</p>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <button key={i} onClick={() => whack(i)} disabled={!playing}
              className={cn("flex h-14 w-14 items-center justify-center rounded-lg text-3xl",
                i === active ? "scale-105 bg-yellow-500/30" : "bg-white/5")}>
              {i === active ? "🧻" : "🕳️"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-bold">Score: {score}</p>
          {!playing && <button onClick={start} className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">{left <= 0 ? "Play again" : "Start"}</button>}
        </div>
      </div>
    </Shell>
  );
}

{/* W39 */}
export function DiceRoll() {
  const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const [d, setD] = useState<[number, number]>([1, 6]);
  const [tries, setTries] = useState(0);
  const [won, setWon] = useState(false);
  const [rolling, setRolling] = useState(false);
  const roll = () => {
    if (rolling || won) return;
    setRolling(true);
    let n = 0;
    const id = setInterval(() => {
      setD([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
      if (++n >= 6) {
        clearInterval(id);
        const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
        setD([a, b]); setTries((t) => t + 1); setRolling(false);
        if (a + b === 7) setWon(true);
      }
    }, 80);
  };
  return (
    <Shell icon={Dice5} title="Dice Roll" sub="Roll a 7 to win" accent="bg-yellow-600/20 text-yellow-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <div className="flex gap-3 text-6xl"><span>{faces[d[0] - 1]}</span><span>{faces[d[1] - 1]}</span></div>
        <p className="text-lg font-bold tabular-nums">Sum: {d[0] + d[1]}</p>
        {won ? (
          <div className="text-center">
            <p className="font-bold text-green-400">SEVEN! In {tries} {tries === 1 ? "try" : "tries"}! 🎲🎉</p>
            <button onClick={() => { setWon(false); setTries(0); }} className="mt-2 rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">Roll again</button>
          </div>
        ) : (
          <button onClick={roll} disabled={rolling} className="rounded-lg bg-yellow-500/30 px-6 py-2 text-sm font-bold text-yellow-100 hover:bg-yellow-500/50 disabled:opacity-40">🎲 ROLL</button>
        )}
        <p className="text-xs text-white/40">Attempts: {tries}</p>
      </div>
    </Shell>
  );
}

{/* W40 */}
export function RpsVsOrbit() {
  const MOVES = ["🪨", "📄", "✂️"] as const;
  const [you, setYou] = useState(0);
  const [orb, setOrb] = useState(0);
  const [msg, setMsg] = useState("Best of 5 — first to 3.");
  const [last, setLast] = useState<[number, number] | null>(null);
  const play = (m: number) => {
    if (you >= 3 || orb >= 3) return;
    const o = Math.floor(Math.random() * 3);
    setLast([m, o]);
    const win = (m - o + 3) % 3 === 1;
    const ny = you + (win ? 1 : 0), no = orb + (!win && m !== o ? 1 : 0);
    setYou(ny); setOrb(no);
    const end = ny >= 3 ? " — YOU WIN! 🏆" : no >= 3 ? " — Orbit wins. 🤖" : "";
    setMsg(m === o ? "Tie! Again." : win ? "You score!" : "Orbit scores!" + end);
    if (ny >= 3) setMsg("YOU WIN! 🏆");
    if (no >= 3) setMsg("Orbit wins. 🤖");
  };
  const reset = () => { setYou(0); setOrb(0); setMsg("Best of 5 — first to 3."); setLast(null); };
  return (
    <Shell icon={Hand} title="RPS vs Orbit" sub="Rock, paper, scissors. No mercy." accent="bg-red-600/20 text-red-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <p className="text-sm font-bold tabular-nums">You {you} — {orb} Orbit</p>
        {last && <p className="text-3xl">{MOVES[last[0]]} <span className="text-lg text-white/40">vs</span> {MOVES[last[1]]}</p>}
        <p className="text-sm text-white/70">{msg}</p>
        {you < 3 && orb < 3 ? (
          <div className="flex gap-2">
            {MOVES.map((m, i) => (
              <button key={i} onClick={() => play(i)} className="rounded-xl bg-white/10 px-4 py-2 text-3xl hover:bg-white/20" aria-label={`play ${m}`}>{m}</button>
            ))}
          </div>
        ) : (
          <button onClick={reset} className="rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20">Rematch</button>
        )}
      </div>
    </Shell>
  );
}

{/* W41 */}
export function MemoryMatch() {
  const EMOJI = ["🚀", "💎", "🐻", "🪙", "🌙", "⚡"];
  const fresh = () => [...EMOJI, ...EMOJI].sort(() => Math.random() - 0.5);
  const [cards, setCards] = useState<string[]>(fresh);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const flip = (i: number) => {
    if (open.length >= 2 || open.includes(i) || matched.includes(i)) return;
    const o = [...open, i];
    setOpen(o);
    if (o.length === 2) {
      setMoves((m) => m + 1);
      if (cards[o[0]] === cards[o[1]]) setMatched((m) => [...m, ...o]);
      setTimeout(() => setOpen([]), 700);
    }
  };
  const win = matched.length === 12;
  const reset = () => { setCards(fresh()); setOpen([]); setMatched([]); setMoves(0); };
  return (
    <Shell icon={Brain} title="Memory Match" sub="6 pairs, 12 cards" accent="bg-emerald-600/20 text-emerald-300">
      <div className="flex flex-col items-center gap-2 py-1">
        <div className="grid grid-cols-4 gap-2">
          {cards.map((c, i) => {
            const up = open.includes(i) || matched.includes(i);
            return (
              <button key={i} onClick={() => flip(i)} disabled={up}
                className={cn("flex h-14 w-14 items-center justify-center rounded-lg text-2xl",
                  up ? "bg-emerald-500/20" : "bg-white/10 hover:bg-white/20")}>
                {up ? c : "❓"}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/60">Moves: {moves}</span>
          {win ? <span className="font-bold text-green-400">Cleared in {moves} moves! 🏆</span> : null}
          <button onClick={reset} className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20">Shuffle</button>
        </div>
      </div>
    </Shell>
  );
}

{/* W42 */}
export function ReactionTest() {
  const [phase, setPhase] = useState<"idle" | "wait" | "go" | "early">("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [best, setBest] = useState(() => Number(localStorage.getItem("orbitx-wild2-reaction-best") ?? 0));
  const t0 = useRef(0);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const start = () => {
    setPhase("wait");
    timer.current = window.setTimeout(() => { t0.current = Date.now(); setPhase("go"); }, 1000 + Math.random() * 2500);
  };
  const click = () => {
    if (phase === "wait") { clearTimeout(timer.current); setPhase("early"); }
    else if (phase === "go") {
      const ms = Date.now() - t0.current;
      setTimes((t) => [...t, ms].slice(-3));
      setBest((b) => { const v = b === 0 ? ms : Math.min(b, ms); localStorage.setItem("orbitx-wild2-reaction-best", String(v)); return v; });
      setPhase("idle");
    } else start();
  };
  const last = times[times.length - 1];
  return (
    <Shell icon={Zap} title="Reaction Test" sub="Click when it turns green" accent="bg-fuchsia-500/20 text-fuchsia-300">
      <div className="flex flex-col items-center gap-2 py-1">
        <button onClick={click}
          className={cn("flex h-28 w-full items-center justify-center rounded-xl text-lg font-black transition-colors",
            phase === "go" ? "bg-green-500 text-white" : phase === "wait" ? "bg-red-500/70 text-white" : phase === "early" ? "bg-orange-500 text-white" : "bg-white/10 text-white/70")}>
          {phase === "go" ? "CLICK!" : phase === "wait" ? "Wait for green…" : phase === "early" ? "Too early! Click to retry" : "Click to start"}
        </button>
        <p className="text-sm font-bold tabular-nums">{last !== undefined ? `${last} ms` : "—"}</p>
        <p className="text-xs text-white/40">Attempts: {times.map((t) => `${t}ms`).join(" · ") || "none"} · Best: {best > 0 ? `${best}ms` : "—"}</p>
      </div>
    </Shell>
  );
}

{/* W43 */}
export function CoinFlipStreak() {
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("orbitx-wild2-flip-best") ?? 0));
  const [last, setLast] = useState("—");
  const [flipping, setFlipping] = useState(false);
  const flip = () => {
    if (flipping) return;
    setFlipping(true);
    setTimeout(() => {
      const h = Math.random() < 0.5;
      setLast(h ? "Heads 🪙" : "Tails");
      if (h) {
        const s = streak + 1; setStreak(s);
        setBest((b) => { const v = Math.max(b, s); localStorage.setItem("orbitx-wild2-flip-best", String(v)); return v; });
      } else setStreak(0);
      setFlipping(false);
    }, 400);
  };
  return (
    <Shell icon={Coins} title="Coin Flip Streak" sub="How many heads in a row?" accent="bg-yellow-300/20 text-yellow-200">
      <div className="flex flex-col items-center gap-3 py-1">
        <div className={cn("text-7xl transition-transform", flipping && "animate-spin")}>🪙</div>
        <p className="text-lg font-bold">{flipping ? "Flipping…" : last}</p>
        <button onClick={flip} disabled={flipping} className="rounded-lg bg-yellow-500/30 px-6 py-2 text-sm font-bold text-yellow-100 hover:bg-yellow-500/50 disabled:opacity-40">FLIP</button>
        <p className="text-sm text-white/60">Streak: <span className="font-bold text-white">{streak}</span> 🔥 · Best: <span className="font-bold text-white">{best}</span></p>
      </div>
    </Shell>
  );
}

{/* W44 */}
export function NumberGuess() {
  const [target] = useState(() => 1 + Math.floor(Math.random() * 50));
  const [guess, setGuess] = useState("");
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState("Orbit picked 1–50. Guess!");
  const [prev, setPrev] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const submit = () => {
    const g = Number(guess);
    if (!g || g < 1 || g > 50 || won) return;
    const t = tries + 1; setTries(t);
    if (g === target) { setWon(true); setHint(`Correct in ${t} ${t === 1 ? "try" : "tries"}! 🎉`); return; }
    const d = Math.abs(g - target);
    setHint(prev === null
      ? (d <= 5 ? "Hot! 🔥" : d <= 15 ? "Warm 🙂" : "Cold 🧊")
      : (d < Math.abs(prev - target) ? "Hotter! 🔥" : "Colder 🧊"));
    setPrev(g); setGuess("");
  };
  return (
    <Shell icon={Hash} title="Number Guess" sub="Hotter or colder, 1–50" accent="bg-blue-500/20 text-blue-300">
      <div className="flex flex-col items-center gap-3 py-1">
        <p className="text-sm font-semibold text-white/80">{hint}</p>
        {!won ? (
          <div className="flex gap-2">
            <input value={guess} onChange={(e) => setGuess(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="1–50" inputMode="numeric" className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-white outline-none placeholder:text-white/30" />
            <button onClick={submit} className="rounded-lg bg-blue-500/30 px-4 py-2 text-sm font-bold text-blue-100 hover:bg-blue-500/50">Guess</button>
          </div>
        ) : (
          <p className="text-4xl">🎯</p>
        )}
        <p className="text-xs text-white/40">Attempts: {tries}{prev !== null && !won ? ` · last: ${prev}` : ""}</p>
      </div>
    </Shell>
  );
}
