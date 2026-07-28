'use client';
import { useEffect, useRef, useState, createContext, useContext } from 'react';
import clsx from 'clsx';
import { GAME_META } from '@/lib/games/match-meta';

type GameProps = { onDone: (score: number) => void };
const rnd = (n: number) => Math.floor(Math.random() * n);

const AttemptCtx = createContext<{ attempt: number; max: number; history: number[]; retry: (s: number) => void }>({ attempt: 1, max: 1, history: [], retry: () => {} });

const cta = 'w-full bg-gradient-to-r from-cyan to-purple text-black font-black py-4 rounded-2xl text-base shadow-lg shadow-cyan/10 active:scale-[0.98] transition-transform disabled:opacity-50';
const opt = 'rounded-2xl py-3.5 font-bold border transition-all active:scale-[0.97]';
const optIdle = 'bg-white/[0.04] text-gray-100 border-white/10 hover:border-cyan/50 hover:bg-white/[0.07]';

function InfoHeader({ game }: { game: string }) {
  const m = GAME_META.find(g => g.id === game);
  if (!m) return null;
  return (
    <div className="text-center mb-4">
      <div className="text-4xl mb-1">{m.emoji}</div>
      <p className="font-black text-white">{m.label}</p>
      <p className="text-[11px] text-gray-500 mt-0.5 max-w-xs mx-auto">{m.desc}</p>
    </div>
  );
}

function ScoreResult({ score, detail, onDone }: { score: number; detail?: string; onDone: (s: number) => void }) {
  const good = score >= 600;
  const ctx = useContext(AttemptCtx);
  const last = ctx.attempt >= ctx.max;
  return (
    <div className="space-y-4 animate-pop text-center">
      {detail && <p className="text-gray-300 text-sm">{detail}</p>}
      <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
        <div className={clsx('absolute inset-0 rounded-full blur-xl opacity-40', good ? 'bg-win' : 'bg-cyan')} />
        <div className={clsx('absolute inset-0 rounded-full border-4', good ? 'border-win/60' : 'border-cyan/50')} />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-widest text-gray-400">Try {ctx.attempt}/{ctx.max}</p>
          <p className="text-4xl font-black text-white leading-none mt-1">{score}</p>
          <p className="text-xs text-gray-500 mt-1">/ 1000</p>
        </div>
      </div>
      {ctx.history.length > 0 && <p className="text-[11px] text-gray-500">Earlier tries: {ctx.history.join(' · ')}</p>}
      {last ? (
        <button onClick={() => onDone(score)} className={cta}>Submit final score →</button>
      ) : (
        <div className="space-y-2">
          <button onClick={() => onDone(score)} className={cta}>Keep this score →</button>
          <button onClick={() => ctx.retry(score)} className="w-full py-3 rounded-2xl font-bold border border-white/15 text-white bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] transition-transform">Try again ({ctx.max - ctx.attempt} left)</button>
        </div>
      )}
    </div>
  );
}

const SUITS = [{ s: '♠', r: false }, { s: '♥', r: true }, { s: '♦', r: true }, { s: '♣', r: false }];
const RVAL: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
function Card({ rank, suit, big }: { rank: number; suit: number; big?: boolean }) {
  const su = SUITS[suit];
  return (
    <div className={clsx('rounded-lg bg-gradient-to-b from-white to-gray-200 flex flex-col items-center justify-center font-black shadow animate-pop', big ? 'w-16 h-24 text-2xl' : 'w-11 h-16 text-base', su.r ? 'text-loss' : 'text-black')}>
      <span>{RVAL[rank] || rank}</span><span>{su.s}</span>
    </div>
  );
}

/* ---------- Coinflip (3D flip) ---------- */
function Coinflip({ onDone }: GameProps) {
  const [phase, setPhase] = useState<'pick' | 'flip' | 'done'>('pick');
  const [side, setSide] = useState<'heads' | 'tails'>('heads');
  const [rot, setRot] = useState(0);
  const [landed, setLanded] = useState<'heads' | 'tails'>('heads');
  const flip = (s: 'heads' | 'tails') => {
    setSide(s); setPhase('flip');
    const r = Math.random() < 0.5 ? 'heads' : 'tails';
    setRot(1800 + (r === 'tails' ? 180 : 0));
    setTimeout(() => { setLanded(r); setPhase('done'); }, 1700);
  };
  if (phase === 'done') return <ScoreResult score={landed === side ? 1000 : 0} detail={`Landed ${landed.toUpperCase()} — you called ${side.toUpperCase()}`} onDone={onDone} />;
  return (
    <div className="text-center space-y-5">
      <div className="h-28 flex items-center justify-center" style={{ perspective: 700 }}>
        <div className="relative w-24 h-24 preserve3d" style={{ transform: `rotateY(${rot}deg)`, transition: phase === 'flip' ? 'transform 1.6s cubic-bezier(.2,.7,.2,1)' : 'none' }}>
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border-4 border-amber-200 flex items-center justify-center text-3xl font-black text-amber-900 backface-hidden">H</div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 border-4 border-slate-200 flex items-center justify-center text-3xl font-black text-slate-900 backface-hidden" style={{ transform: 'rotateY(180deg)' }}>T</div>
        </div>
      </div>
      {phase === 'pick' ? (
        <><p className="text-sm text-gray-400">Call the flip</p>
        <div className="grid grid-cols-2 gap-3"><button onClick={() => flip('heads')} className={clsx(opt, optIdle, 'text-lg')}>HEADS</button><button onClick={() => flip('tails')} className={clsx(opt, optIdle, 'text-lg')}>TAILS</button></div></>
      ) : <p className="text-gray-400 animate-pulse">Flipping…</p>}
    </div>
  );
}

/* ---------- Dice (tumbling) ---------- */
function Dice({ onDone }: GameProps) {
  const [val, setVal] = useState<number | null>(null);
  const [face, setFace] = useState(1);
  const [rolling, setRolling] = useState(false);
  const roll = () => {
    setRolling(true);
    const iv = setInterval(() => setFace(rnd(100) + 1), 60);
    setTimeout(() => { clearInterval(iv); const v = rnd(100) + 1; setFace(v); setVal(v); setRolling(false); }, 950);
  };
  if (val !== null) return <ScoreResult score={Math.round(val / 100 * 1000)} detail={`You rolled ${val} / 100`} onDone={onDone} />;
  return <div className="text-center space-y-5"><div className={clsx('mx-auto w-24 h-24 rounded-2xl bg-white text-black flex items-center justify-center text-4xl font-black shadow-xl', rolling && 'animate-shake')}>{face}</div><button onClick={roll} disabled={rolling} className={cta}>{rolling ? 'Rolling…' : 'ROLL'}</button></div>;
}

/* ---------- Lucky 7s ---------- */
function Sevens({ onDone }: GameProps) {
  const [d, setD] = useState<[number, number] | null>(null);
  const [f, setF] = useState<[number, number]>([1, 1]);
  const [rolling, setRolling] = useState(false);
  const roll = () => { setRolling(true); const iv = setInterval(() => setF([rnd(6) + 1, rnd(6) + 1]), 70); setTimeout(() => { clearInterval(iv); const r: [number, number] = [rnd(6) + 1, rnd(6) + 1]; setF(r); setD(r); setRolling(false); }, 950); };
  if (d) { const t = d[0] + d[1]; return <ScoreResult score={Math.round((t - 2) / 10 * 1000)} detail={`${d[0]} + ${d[1]} = ${t}`} onDone={onDone} />; }
  return <div className="text-center space-y-5"><div className="flex justify-center gap-3">{f.map((x, i) => <div key={i} className={clsx('w-16 h-16 rounded-xl bg-white text-black flex items-center justify-center text-2xl font-black shadow', rolling && 'animate-shake')}>{x}</div>)}</div><button onClick={roll} disabled={rolling} className={cta}>{rolling ? 'Rolling…' : 'ROLL BOTH'}</button></div>;
}

/* ---------- Slots (staggered reels) ---------- */
function Slots({ onDone }: GameProps) {
  const SYM = ['🍒', '🍋', '🔔', '⭐', '7️⃣', '💎', '🍀'];
  const [reels, setReels] = useState([0, 0, 0]);
  const [spinning, setSpinning] = useState<boolean[]>([false, false, false]);
  const [done, setDone] = useState<number[] | null>(null);
  const spin = () => {
    setDone(null); setSpinning([true, true, true]);
    const ivs = [0, 1, 2].map(i => setInterval(() => setReels(r => { const n = [...r]; n[i] = rnd(7); return n; }), 70));
    const stop = (i: number, ms: number) => setTimeout(() => { clearInterval(ivs[i]); const fin = rnd(7); setReels(r => { const n = [...r]; n[i] = fin; return n; }); setSpinning(s => { const n = [...s]; n[i] = false; return n; }); if (i === 2) setTimeout(() => setDone(rs => rs ?? null), 0); }, ms);
    stop(0, 700); stop(1, 1000);
    setTimeout(() => { clearInterval(ivs[2]); const fin = rnd(7); setReels(r => { const n = [...r]; n[2] = fin; const a = n[0], b = n[1], c = fin; let s = 200 + Math.max(a, b, c) * 30; if (a === b && b === c) s = 1000; else if (a === b || b === c || a === c) s = 600; setDone([a, b, c, s]); return n; }); setSpinning([false, false, false]); }, 1300);
  };
  if (done) { const [a, b, c, s] = done; return <ScoreResult score={s} detail={`${SYM[a]} ${SYM[b]} ${SYM[c]}`} onDone={onDone} />; }
  const anySpin = spinning.some(Boolean);
  return <div className="text-center space-y-5"><div className="flex justify-center gap-2">{reels.map((r, i) => <div key={i} className={clsx('w-16 h-20 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-3xl', spinning[i] && 'animate-shake')}>{SYM[r]}</div>)}</div><button onClick={spin} disabled={anySpin} className={cta}>{anySpin ? 'Spinning…' : 'SPIN'}</button></div>;
}

/* ---------- Crash (live multiplier) ---------- */
function Crash({ onDone }: GameProps) {
  const [mult, setMult] = useState(1);
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');
  const [score, setScore] = useState(0);
  const crashAt = useRef(0); const timer = useRef<any>(null); const live = useRef(1);
  const start = () => {
    crashAt.current = 1 + Math.pow(Math.random(), 2.2) * 9; setPhase('run'); live.current = 1; setMult(1);
    timer.current = setInterval(() => { live.current = Math.round((live.current + 0.05) * 100) / 100; setMult(live.current); if (live.current >= crashAt.current) { clearInterval(timer.current); setMult(crashAt.current); setScore(0); setPhase('done'); } }, 80);
  };
  const cashout = () => { clearInterval(timer.current); setScore(Math.min(1000, Math.round((live.current - 1) / 9 * 1000))); setPhase('done'); };
  useEffect(() => () => clearInterval(timer.current), []);
  if (phase === 'done') return <ScoreResult score={score} detail={score === 0 ? `💥 Crashed at ${crashAt.current.toFixed(2)}x` : `Cashed out at ${mult.toFixed(2)}x`} onDone={onDone} />;
  if (phase === 'run') {
    const h = Math.min(100, (mult - 1) / 9 * 100);
    return <div className="text-center space-y-4">
      <div className="relative h-40 rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden flex items-end justify-center">
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan/40 to-purple/20" style={{ height: `${h}%`, transition: 'height .08s linear' }} />
        <div className="absolute left-2 text-3xl" style={{ bottom: `calc(${h}% - 12px)`, transition: 'bottom .08s linear' }}>🚀</div>
        <div className="relative z-10 mb-2 text-5xl font-black text-white tabular-nums">{mult.toFixed(2)}x</div>
      </div>
      <button onClick={cashout} className={clsx(cta, 'animate-pulse')}>CASH OUT</button>
    </div>;
  }
  return <div className="text-center space-y-5"><div className="text-7xl">🚀</div><button onClick={start} className={cta}>LAUNCH</button></div>;
}

/* ---------- Plinko (animated drop) ---------- */
function Plinko({ onDone }: GameProps) {
  const MULT = [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6];
  const [phase, setPhase] = useState<'idle' | 'drop' | 'done'>('idle');
  const [bucket, setBucket] = useState(4);
  const [y, setY] = useState(0); const [x, setX] = useState(50);
  const drop = () => {
    let r = 0; for (let i = 0; i < 8; i++) if (Math.random() >= 0.5) r++;
    setBucket(r); setPhase('drop'); setY(0); setX(50);
    requestAnimationFrame(() => { setY(100); setX(6 + (r / 8) * 88); });
    setTimeout(() => setPhase('done'), 1200);
  };
  if (phase === 'done') { const m = MULT[bucket]; return <ScoreResult score={Math.min(1000, Math.round(m / 5.6 * 1000))} detail={`Landed in the ${m}x bucket`} onDone={onDone} />; }
  return <div className="text-center space-y-4">
    <div className="relative h-40 rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
      {[0, 1, 2, 3].map(row => <div key={row} className="flex justify-center gap-4 mt-3" style={{ paddingLeft: row % 2 ? 16 : 0 }}>{Array.from({ length: 6 }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/30" />)}</div>)}
      {phase !== 'idle' && <div className="absolute w-3 h-3 rounded-full bg-cyan shadow-[0_0_10px_#3D8BFF]" style={{ top: `${y}%`, left: `${x}%`, transition: 'top 1.1s ease-in, left 1.1s ease-in' }} />}
      <div className="absolute bottom-0 left-0 right-0 flex text-[9px] text-gray-500">{MULT.map((m, i) => <span key={i} className="flex-1 text-center">{m}x</span>)}</div>
    </div>
    <button onClick={drop} disabled={phase === 'drop'} className={cta}>{phase === 'drop' ? 'Dropping…' : 'DROP BALL'}</button>
  </div>;
}

/* ---------- Mines ---------- */
function Mines({ onDone }: GameProps) {
  const N = 25, BOMBS = 5;
  const [mines] = useState<Set<number>>(() => { const s = new Set<number>(); while (s.size < BOMBS) s.add(rnd(N)); return s; });
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [boom, setBoom] = useState(false);
  const gems = revealed.size;
  const score = Math.min(1000, Math.round(gems / 12 * 1000));
  const [done, setDone] = useState(false);
  const pick = (i: number) => {
    if (done || revealed.has(i)) return;
    if (mines.has(i)) { setBoom(true); setTimeout(() => setDone(true), 1100); return; }
    { const nx = new Set(revealed); nx.add(i); setRevealed(nx); }
    if (revealed.size + 1 >= N - BOMBS) setDone(true);
  };
  if (done) return <ScoreResult score={boom ? 0 : score} detail={boom ? '💥 You hit a mine!' : `${gems} gems collected 💎`} onDone={onDone} />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: N }).map((_, i) => {
          const open = revealed.has(i); const isBomb = boom && mines.has(i);
          return <button key={i} onClick={() => pick(i)} disabled={done}
            className={clsx('aspect-square rounded-lg flex items-center justify-center text-lg font-bold transition-all',
              isBomb ? 'bg-loss/30 border border-loss/50 animate-shake' : open ? 'bg-win/20 border border-win/40' : 'bg-white/[0.05] border border-white/10 hover:border-cyan/40 active:scale-95')}>
            {isBomb ? '💣' : open ? '💎' : ''}
          </button>;
        })}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">💎 {gems} · score {score}</span>
        <button onClick={() => setDone(true)} disabled={gems === 0 || done} className="bg-win/20 text-win font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40">Cash out</button>
      </div>
      {boom && <p className="text-center text-loss font-bold animate-pop">💥 You hit a mine!</p>}
    </div>
  );
}

/* ---------- Wheel (rotating) ---------- */
function Wheel({ onDone }: GameProps) {
  const [rot, setRot] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'spin' | 'done'>('idle');
  const [score, setScore] = useState(0);
  const spin = () => { setPhase('spin'); const turns = 4 + Math.random() * 3; const deg = turns * 360 + rnd(360); setRot(r => r + deg); const s = rnd(1001); setScore(s); setTimeout(() => setPhase('done'), 2600); };
  if (phase === 'done') return <ScoreResult score={score} detail="The wheel stopped." onDone={onDone} />;
  return <div className="text-center space-y-5">
    <div className="relative w-40 h-40 mx-auto">
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 text-cyan text-xl">▼</div>
      <div className="w-40 h-40 rounded-full border-4 border-white/20" style={{ background: 'conic-gradient(#3D8BFF 0 45deg,#A855F7 45deg 90deg,#22C55E 90deg 135deg,#FFD15C 135deg 180deg,#F0616E 180deg 225deg,#3D8BFF 225deg 270deg,#A855F7 270deg 315deg,#22C55E 315deg 360deg)', transform: `rotate(${rot}deg)`, transition: phase === 'spin' ? 'transform 2.5s cubic-bezier(.15,.9,.2,1)' : 'none' }} />
    </div>
    <button onClick={spin} disabled={phase === 'spin'} className={cta}>{phase === 'spin' ? 'Spinning…' : 'SPIN THE WHEEL'}</button>
  </div>;
}

/* ---------- High Card (flip) ---------- */
function HighCard({ onDone }: GameProps) {
  const [c, setC] = useState<{ r: number; s: number } | null>(null);
  const [flipping, setFlipping] = useState(false);
  const draw = () => { setFlipping(true); setTimeout(() => { setC({ r: rnd(13) + 2, s: rnd(4) }); }, 250); setTimeout(() => setFlipping(false), 600); };
  if (c && !flipping) return <ScoreResult score={Math.round((c.r - 2) / 12 * 1000)} detail={`You drew ${RVAL[c.r] || c.r}${SUITS[c.s].s}`} onDone={onDone} />;
  return <div className="text-center space-y-5"><div className="flex justify-center h-24 items-center">{c ? <Card rank={c.r} suit={c.s} big /> : <div className="w-16 h-24 rounded-lg bg-gradient-to-br from-purple/40 to-cyan/40 border border-white/20 flex items-center justify-center text-2xl">🂠</div>}</div><button onClick={draw} disabled={flipping} className={cta}>{flipping ? 'Drawing…' : 'DRAW CARD'}</button></div>;
}

/* ---------- Card War (sequential) ---------- */
function War({ onDone }: GameProps) {
  const [rounds, setRounds] = useState<{ a: number; b: number }[]>([]);
  const [running, setRunning] = useState(false);
  const [wins, setWins] = useState(0);
  const [done, setDone] = useState(false);
  const deal = () => {
    setRunning(true); setRounds([]); setWins(0); setDone(false);
    let i = 0, w = 0;
    const iv = setInterval(() => {
      const a = rnd(13) + 2, b = rnd(13) + 2; if (a > b) w++;
      setRounds(r => [...r, { a, b }]); i++;
      if (i >= 5) { clearInterval(iv); setWins(w); setTimeout(() => setDone(true), 900); }
    }, 500);
  };
  if (done) return <ScoreResult score={Math.round(wins / 5 * 1000)} detail={`You won ${wins} of 5 rounds`} onDone={onDone} />;
  if (!running) return <div className="text-center space-y-5"><div className="text-5xl">⚔️</div><p className="text-xs text-gray-500">Five card battles. Win the most.</p><button onClick={deal} className={cta}>DEAL</button></div>;
  return <div className="space-y-3">
    {rounds.map((r, i) => <div key={i} className="flex items-center justify-center gap-3 animate-pop">
      <Card rank={r.a} suit={rnd(4)} /><span className={clsx('font-black', r.a > r.b ? 'text-win' : r.a < r.b ? 'text-loss' : 'text-gray-400')}>{r.a > r.b ? 'WIN' : r.a < r.b ? 'LOSS' : 'TIE'}</span><Card rank={r.b} suit={rnd(4)} />
    </div>)}
    {rounds.length >= 5 && <p className="text-center font-black text-white pt-1">You won {wins} of 5</p>}
  </div>;
}

/* ---------- Blackjack ---------- */
function Blackjack({ onDone }: GameProps) {
  const [hand, setHand] = useState<{ r: number; s: number }[]>(() => [{ r: rnd(10) + 2, s: rnd(4) }, { r: rnd(10) + 2, s: rnd(4) }]);
  const [stood, setStood] = useState(false);
  const total = hand.reduce((a, c) => a + c.r, 0);
  const bust = total > 21; const fin = bust || stood;
  if (fin) { const s = bust ? 0 : total === 21 ? 1000 : Math.round(total / 21 * 1000); return <ScoreResult score={s} detail={bust ? `BUST at ${total}` : `You stood on ${total}`} onDone={onDone} />; }
  return <div className="text-center space-y-5">
    <div className="flex justify-center gap-2 flex-wrap min-h-[64px]">{hand.map((c, i) => <Card key={i} rank={c.r} suit={c.s} />)}</div>
    <p className="text-3xl font-black text-white">{total}</p>
    <div className="grid grid-cols-2 gap-3"><button onClick={() => setHand([...hand, { r: rnd(10) + 2, s: rnd(4) }])} className={clsx(opt, optIdle, 'text-lg')}>HIT</button><button onClick={() => setStood(true)} className={clsx(opt, 'bg-cyan text-black border-cyan text-lg')}>STAND</button></div>
  </div>;
}

/* ---------- Darts (dartboard + crosshair) ---------- */
function Darts({ onDone }: GameProps) {
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [hit, setHit] = useState<number | null>(null);
  const st = useRef({ p: 0, d: 1 }); const raf = useRef<number | null>(null);
  useEffect(() => { const tick = () => { const s = st.current; s.p += s.d * 2.2; if (s.p >= 100) { s.p = 100; s.d = -1; } if (s.p <= 0) { s.p = 0; s.d = 1; } setPos(s.p); raf.current = requestAnimationFrame(tick); }; raf.current = requestAnimationFrame(tick); return () => { if (raf.current) cancelAnimationFrame(raf.current); }; }, []);
  const fire = () => { if (raf.current) cancelAnimationFrame(raf.current); const dist = Math.abs(pos - 50); setHit(pos); setScore(Math.max(0, Math.round(1000 - dist * 20))); };
  if (score !== null) return <ScoreResult score={score} detail={score >= 950 ? '🎯 Bullseye!' : 'Nice throw.'} onDone={onDone} />;
  return <div className="space-y-5 text-center">
    <div className="relative w-32 h-32 mx-auto rounded-full" style={{ background: 'radial-gradient(circle, #F0616E 0 12%, #fff 12% 22%, #22C55E 22% 38%, #1B2233 38% 60%, #F0616E 60% 74%, #1B2233 74% 100%)' }}>
      <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan shadow-[0_0_8px_#3D8BFF]" style={{ left: `calc(${pos}% - 4px)` }} />
    </div>
    <button onClick={fire} className={cta}>THROW 🎯</button>
  </div>;
}

/* ---------- Rocket Race (tap) ---------- */
function Race({ onDone }: GameProps) {
  const [phase, setPhase] = useState<'idle' | 'go' | 'done'>('idle');
  const [taps, setTaps] = useState(0); const [left, setLeft] = useState(4);
  useEffect(() => { if (phase !== 'go') return; if (left <= 0) { setPhase('done'); return; } const t = setTimeout(() => setLeft(l => l - 1), 1000); return () => clearTimeout(t); }, [phase, left]);
  if (phase === 'done') return <ScoreResult score={Math.min(1000, taps * 40)} detail={`${taps} taps`} onDone={onDone} />;
  if (phase === 'go') return <div className="text-center space-y-4">
    <div className="relative h-10 rounded-full bg-white/[0.05] border border-white/10 overflow-hidden">
      <div className="absolute top-1 text-2xl flex items-center" style={{ left: `${Math.min(88, taps * 4)}%`, transition: 'left .1s' }}>🚀<span className="flame text-amber-400 -ml-1">🔥</span></div>
    </div>
    <p className="text-sm text-gray-400">{left}s left · {taps} taps</p>
    <button onClick={() => setTaps(t => t + 1)} className={clsx(cta, 'py-7 text-xl select-none')}>BOOST! 🔥</button>
  </div>;
  return <div className="text-center space-y-5"><div className="text-6xl">🏁</div><button onClick={() => { setTaps(0); setLeft(4); setPhase('go'); }} className={cta}>START</button></div>;
}

/* ---------- Penalty Shootout ---------- */
function Penalty({ onDone }: GameProps) {
  const [shot, setShot] = useState(0); const [goals, setGoals] = useState(0);
  const [anim, setAnim] = useState<{ dir: number; keeper: number; scored: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const kick = (dir: number) => {
    if (busy) return; setBusy(true);
    const keeper = rnd(3); const scored = dir !== keeper;
    setAnim({ dir, keeper, scored });
    setTimeout(() => {
      const g = goals + (scored ? 1 : 0); const s = shot + 1; setGoals(g); setShot(s); setAnim(null); setBusy(false);
    }, 900);
  };
  if (shot >= 5 && !anim) return <ScoreResult score={Math.round(goals / 5 * 1000)} detail={`${goals} / 5 scored`} onDone={onDone} />;
  const cornerX = (c: number) => (c === 0 ? '18%' : c === 1 ? '50%' : '82%');
  return <div className="text-center space-y-5">
    <div className="relative h-28 rounded-2xl bg-gradient-to-b from-win/10 to-transparent border border-white/10 overflow-hidden">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3/4 h-12 border-2 border-white/40 rounded-t-md" />
      {anim && <div className="absolute text-2xl" style={{ left: cornerX(anim.keeper), top: 8, transform: 'translateX(-50%)', transition: 'all .4s' }}>🧤</div>}
      <div className="absolute text-2xl" style={{ left: anim ? cornerX(anim.dir) : '50%', bottom: anim ? '52px' : '6px', transform: 'translateX(-50%)', transition: 'all .8s cubic-bezier(.3,.7,.3,1)' }}>⚽</div>
    </div>
    <p className="text-sm text-gray-400">Shot {Math.min(shot + 1, 5)} of 5 · {goals} scored {anim && (anim.scored ? '· ⚽ GOAL!' : '· 🧤 Saved!')}</p>
    <div className="grid grid-cols-3 gap-2"><button onClick={() => kick(0)} disabled={busy} className={clsx(opt, optIdle)}>◀ Left</button><button onClick={() => kick(1)} disabled={busy} className={clsx(opt, optIdle)}>▲ Mid</button><button onClick={() => kick(2)} disabled={busy} className={clsx(opt, optIdle)}>Right ▶</button></div>
  </div>;
}

/* ---------- RPS ---------- */
function RPS({ onDone }: GameProps) {
  const H = [{ k: 'rock', e: '✊' }, { k: 'paper', e: '✋' }, { k: 'scissors', e: '✌️' }];
  const [me, setMe] = useState<number | null>(null);
  const [opp, setOpp] = useState<number | null>(null);
  const [shooting, setShooting] = useState(false);
  const play = (i: number) => {
    setMe(i); setShooting(true);
    const iv = setInterval(() => setOpp(rnd(3)), 90);
    setTimeout(() => { clearInterval(iv); const o = rnd(3); setOpp(o); setShooting(false); }, 1100);
  };
  if (me !== null && opp !== null && !shooting) {
    const r = (me - opp + 3) % 3; const s = r === 1 ? 1000 : r === 0 ? 500 : 0;
    return <ScoreResult score={s} detail={`${H[me].e} vs ${H[opp].e} — ${r === 1 ? 'You win!' : r === 0 ? 'Draw' : 'You lose'}`} onDone={onDone} />;
  }
  if (me !== null) return <div className="text-center py-6"><div className="flex items-center justify-center gap-8 text-5xl"><span>{H[me].e}</span><span className="text-gray-500 text-2xl">vs</span><span className="animate-shake">{opp !== null ? H[opp].e : '✊'}</span></div><p className="mt-4 text-gray-400 animate-pulse">Shoot!</p></div>;
  return <div className="text-center space-y-4"><p className="text-sm text-gray-400">Throw your hand</p><div className="grid grid-cols-3 gap-3">{H.map((h, i) => <button key={h.k} onClick={() => play(i)} className={clsx(opt, optIdle, 'text-4xl py-5')}>{h.e}</button>)}</div></div>;
}

/* ---------- Even/Odd & Red/Black ---------- */
function EvenOdd({ onDone }: GameProps) {
  const [n, setN] = useState<number | null>(null); const [p, setP] = useState<'even' | 'odd'>('even'); const [rolling, setRolling] = useState(false); const [face, setFace] = useState(0);
  const go = (x: 'even' | 'odd') => { setP(x); setRolling(true); const iv = setInterval(() => setFace(rnd(100)), 60); setTimeout(() => { clearInterval(iv); const v = rnd(100); setFace(v); setN(v); setRolling(false); }, 900); };
  if (n !== null && !rolling) { const par = n % 2 === 0 ? 'even' : 'odd'; return <ScoreResult score={par === p ? 1000 : 0} detail={`${n} (${par.toUpperCase()}) — you called ${p.toUpperCase()}`} onDone={onDone} />; }
  if (rolling || n !== null) return <div className="text-center py-6"><div className="text-6xl font-black text-white animate-shake">{face}</div></div>;
  return <div className="text-center space-y-4"><div className="text-6xl">🔢</div><p className="text-sm text-gray-400">Call it</p><div className="grid grid-cols-2 gap-3"><button onClick={() => go('even')} className={clsx(opt, optIdle, 'text-lg')}>EVEN</button><button onClick={() => go('odd')} className={clsx(opt, optIdle, 'text-lg')}>ODD</button></div></div>;
}
function RedBlack({ onDone }: GameProps) {
  const [res, setRes] = useState<'red' | 'black' | null>(null); const [p, setP] = useState<'red' | 'black'>('red'); const [rot, setRot] = useState(0); const [spin, setSpin] = useState(false);
  const go = (x: 'red' | 'black') => { setP(x); setSpin(true); const r = Math.random() < 0.5 ? 'red' : 'black'; setRot(v => v + 1440 + (r === 'black' ? 180 : 0)); setTimeout(() => { setRes(r); setSpin(false); }, 1800); };
  if (res && !spin) return <ScoreResult score={res === p ? 1000 : 0} detail={`Landed ${res.toUpperCase()} — you called ${p.toUpperCase()}`} onDone={onDone} />;
  return <div className="text-center space-y-5">
    <div className="w-32 h-32 mx-auto rounded-full border-4 border-white/20" style={{ background: 'conic-gradient(#F0616E 0 90deg,#1B2233 90deg 180deg,#F0616E 180deg 270deg,#1B2233 270deg 360deg)', transform: `rotate(${rot}deg)`, transition: spin ? 'transform 1.7s cubic-bezier(.15,.9,.2,1)' : 'none' }} />
    {!spin && res === null ? <><p className="text-sm text-gray-400">Pick a color</p><div className="grid grid-cols-2 gap-3"><button onClick={() => go('red')} className={clsx(opt, 'bg-loss/20 text-loss border-loss/40 text-lg')}>RED</button><button onClick={() => go('black')} className={clsx(opt, 'bg-white/10 text-white border-white/25 text-lg')}>BLACK</button></div></> : <p className="text-gray-400 animate-pulse">Spinning…</p>}
  </div>;
}

const GAMES: Record<string, (p: GameProps) => JSX.Element> = {
  coinflip: Coinflip, dice: Dice, sevens: Sevens, slots: Slots, crash: Crash, plinko: Plinko, mines: Mines,
  wheel: Wheel, highcard: HighCard, war: War, blackjack: Blackjack, darts: Darts, race: Race, penalty: Penalty,
  rps: RPS, evenodd: EvenOdd, redblack: RedBlack,
};

export function PlayGame({ game, onDone }: { game: string; onDone: (score: number) => void }) {
  const C = GAMES[game] || Dice;
  const MAX = 3;
  const [attempt, setAttempt] = useState(1);
  const [history, setHistory] = useState<number[]>([]);
  const [k, setK] = useState(0);
  const retry = (sc: number) => { setHistory(h => [...h, sc]); setAttempt(a => a + 1); setK(x => x + 1); };
  return (
    <AttemptCtx.Provider value={{ attempt, max: MAX, history, retry }}>
      <div className="rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent border border-white/10 p-5">
        <InfoHeader game={game} />
        <div className="flex items-center justify-center gap-1.5 mb-2">
          {Array.from({ length: MAX }).map((_, i) => <span key={i} className={clsx('h-1.5 rounded-full transition-all', i < attempt ? 'w-6 bg-cyan' : 'w-3 bg-white/15')} />)}
        </div>
        <p className="text-center text-[11px] text-gray-500 mb-3">You get {MAX} tries · keep any try, or your 3rd is final.</p>
        <div className="min-h-[230px] flex flex-col justify-center"><C key={k} onDone={onDone} /></div>
      </div>
    </AttemptCtx.Provider>
  );
}
