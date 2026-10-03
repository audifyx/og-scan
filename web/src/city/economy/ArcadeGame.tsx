/**
 * OrbitX City — playable arcade cabinet: "ORBITX CATCH".
 *
 * Catch falling ORBITX coins in your basket. 30 seconds, touch/mouse.
 * Entry costs 10 ORBITX — a REAL on-chain burn via burnPurchase().
 * High score persists per wallet; score pays CITY points on game over.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, X, Trophy, Coins, Timer } from "lucide-react";
import { useOrbitxBilling } from "@/tokenomics/useOrbitxBilling";
import { burnPurchase, burnReason } from "@/tokenomics/burnFlow";
import { useCityWallet } from "./useCityWallet";
import ReceiptModal, { type ReceiptRow } from "./ReceiptModal";
import { addCityPoints } from "../cityState";
import "./economy.css";

const ENTRY_ORBITX = 10;
const GAME_SECS = 30;

type Phase = "menu" | "paying" | "receipt" | "playing" | "over";

function highKey(wallet: string | null): string {
  return `oxc-arcade-high-${wallet ?? "anon"}`;
}

export default function ArcadeGame({ onClose }: { onClose: () => void }) {
  const billing = useOrbitxBilling();
  const wallet = useCityWallet();
  const [phase, setPhase] = useState<Phase>("menu");
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECS);
  const [high, setHigh] = useState(0);
  const [earned, setEarned] = useState(0);
  const [receipt, setReceipt] = useState<{ signature: string; rows: ReceiptRow[] } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const basketX = useRef(0.5); // 0..1
  const scoreRef = useRef(0);

  useEffect(() => {
    try {
      setHigh(Number(localStorage.getItem(highKey(wallet.address)) ?? 0) || 0);
    } catch { /* noop */ }
  }, [wallet.address]);

  const startPaid = useCallback(async () => {
    setError(null);
    setPhase("paying");
    try {
      const res = await burnPurchase(billing, {
        amount: ENTRY_ORBITX,
        itemId: "arcade-catch",
        label: "ORBITX Catch — arcade entry",
        reason: burnReason("arcade", "play", "orbitx-catch"),
        module: "arcade",
      });
      if (res.ok && !res.dryRun) {
        setReceipt({
          signature: res.signature,
          rows: [
            { label: "Game", value: "ORBITX Catch" },
            { label: "Entry burned", value: `${ENTRY_ORBITX} ORBITX` },
          ],
        });
        scoreRef.current = 0;
        setScore(0);
        setTimeLeft(GAME_SECS);
        setPhase("receipt");
      } else if (res.ok && res.dryRun) {
        setError("Verification mode is on — no real burn was made.");
        setPhase("menu");
      } else {
        setError(res.message);
        setPhase("menu");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
      setPhase("menu");
    }
  }, [billing]);

  // ── game loop ──
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let spawnT = 0;
    interface Coin { x: number; y: number; vy: number; r: number; spin: number }
    const coins: Coin[] = [];
    const W = () => canvas.clientWidth;
    const H = () => canvas.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      canvas.width = W() * dpr;
      canvas.height = H() * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener("resize", fit);

    const onMove = (clientX: number) => {
      const r = canvas.getBoundingClientRect();
      basketX.current = Math.max(0.06, Math.min(0.94, (clientX - r.left) / r.width));
    };
    const pd = (e: PointerEvent) => onMove(e.clientX);
    const pm = (e: PointerEvent) => { if (e.buttons) onMove(e.clientX); };
    canvas.addEventListener("pointerdown", pd);
    canvas.addEventListener("pointermove", pm);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const remain = Math.max(0, GAME_SECS - elapsed);
      setTimeLeft(Math.ceil(remain));
      if (remain <= 0) { endGame(); return; }

      // spawn (ramps up)
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(0.22, 0.55 - elapsed * 0.012);
        coins.push({
          x: 0.05 + Math.random() * 0.9,
          y: -0.05,
          vy: 0.28 + Math.random() * 0.22 + elapsed * 0.008,
          r: 0.028 + Math.random() * 0.012,
          spin: Math.random() * Math.PI * 2,
        });
      }

      const w = W(), h = H();
      const bx = basketX.current * w;
      const bw = Math.max(56, w * 0.2);
      const by = h - 34;

      ctx.clearRect(0, 0, w, h);
      // bg grid
      ctx.strokeStyle = "rgba(23,230,212,0.07)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 36) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }

      // coins
      for (let i = coins.length - 1; i >= 0; i--) {
        const cn = coins[i];
        cn.y += cn.vy * dt;
        cn.spin += dt * 6;
        const cx = cn.x * w, cy = cn.y * h, cr = cn.r * w;
        // catch?
        if (cn.y * h > by - 14 && cn.y * h < by + 16 && Math.abs(cx - bx) < bw / 2 + cr) {
          coins.splice(i, 1);
          scoreRef.current += 1;
          setScore(scoreRef.current);
          continue;
        }
        if (cn.y > 1.08) { coins.splice(i, 1); continue; }
        // diamond coin
        const sq = Math.abs(Math.cos(cn.spin)) * 0.7 + 0.3;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(sq, 1);
        ctx.fillStyle = "#17e6d4";
        ctx.shadowColor = "#17e6d4";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, -cr); ctx.lineTo(cr * 0.7, 0); ctx.lineTo(0, cr); ctx.lineTo(-cr * 0.7, 0);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // basket
      ctx.fillStyle = "#d9a441";
      ctx.shadowColor = "#d9a441";
      ctx.shadowBlur = 10;
      const bh = 18;
      ctx.beginPath();
      ctx.roundRect(bx - bw / 2, by - 8, bw, bh, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(tick);
    };

    const endGame = () => {
      cancelAnimationFrame(raf);
      const s = scoreRef.current;
      setScore(s);
      const pts = Math.floor(s / 5);
      setEarned(pts);
      if (pts > 0) addCityPoints(pts);
      try {
        const k = highKey(wallet.address);
        const prev = Number(localStorage.getItem(k) ?? 0) || 0;
        if (s > prev) {
          localStorage.setItem(k, String(s));
          setHigh(s);
        }
      } catch { /* noop */ }
      setPhase("over");
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      canvas.removeEventListener("pointerdown", pd);
      canvas.removeEventListener("pointermove", pm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className="oxe-overlay" role="dialog" aria-modal="true" aria-label="Arcade game">
      <div className="oxe-sheet oxe-sheet-wide">
        <div className="oxe-sheet-head">
          <div className="oxe-sheet-title">
            <Gamepad2 className="oxe-ic" />
            <div>
              <div className="oxe-t1">ORBITX CATCH</div>
              <div className="oxe-t2">Catch the falling coins · 30 seconds</div>
            </div>
          </div>
          <button className="oxe-x" onClick={onClose} aria-label="Close arcade">
            <X />
          </button>
        </div>

        {phase === "menu" && (
          <div className="oxe-arcade-menu">
            <div className="oxe-arcade-row">
              <span><Trophy size={15} /> High score</span>
              <b>{high}</b>
            </div>
            <div className="oxe-arcade-row">
              <span><Coins size={15} /> Entry fee</span>
              <b className="gold">{ENTRY_ORBITX} ORBITX burned</b>
            </div>
            <p className="oxe-t2">Drag or move your finger to slide the basket. Every 5 coins = 1 CITY point.</p>
            {error && <p className="oxe-err">{error}</p>}
            <button
              className="oxe-btn oxe-btn-primary oxe-btn-big"
              disabled={!wallet.connected}
              onClick={startPaid}
            >
              {wallet.connected ? `PLAY — burn ${ENTRY_ORBITX} ORBITX` : "Connect wallet to play"}
            </button>
          </div>
        )}

        {phase === "paying" && (
          <div className="oxe-arcade-menu">
            <p className="oxe-t1">Burning {ENTRY_ORBITX} ORBITX…</p>
            <p className="oxe-t2">Confirm in your wallet if prompted.</p>
          </div>
        )}

        {(phase === "playing" || phase === "over") && (
          <div className="oxe-arcade-game">
            <div className="oxe-arcade-hud">
              <span><Coins size={14} /> {score}</span>
              <span><Timer size={14} /> {timeLeft}s</span>
              <span><Trophy size={14} /> {high}</span>
            </div>
            {phase === "playing" ? (
              <canvas ref={canvasRef} className="oxe-arcade-canvas" />
            ) : (
              <div className="oxe-arcade-menu">
                <div className="oxe-t1">SCORE {score}</div>
                {score >= high && score > 0 && <div className="oxe-t2 gold">★ New high score ★</div>}
                <div className="oxe-arcade-row">
                  <span>CITY points earned</span>
                  <b className="cyan">+{earned}</b>
                </div>
                <div className="oxe-actions">
                  <button className="oxe-btn oxe-btn-primary" onClick={() => setPhase("menu")}>Play again</button>
                  <button className="oxe-btn" onClick={onClose}>Done</button>
                </div>
              </div>
            )}
          </div>
        )}

        {receipt && phase === "receipt" && (
          <ReceiptModal
            title="Arcade entry burned"
            subtitle="10 ORBITX burned on-chain. Good luck!"
            rows={receipt.rows}
            signature={receipt.signature}
            onClose={() => { setReceipt(null); setPhase("playing"); }}
          />
        )}
      </div>
    </div>
  );
}
