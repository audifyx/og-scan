/**
 * Candle predictor — guess the next candle's direction on REAL price data,
 * win paper CITY. Stake is debited up front; correct guesses pay
 * stake × payoutMultiplier.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CANDLE_PREDICTOR } from "../data/catalog";
import { feedToken } from "../data/mints";
import { CandlestickChart, formatUsd, usePriceCandles } from "../hooks/usePriceCandles";
import { formatCity, paperWallet, usePaperWallet } from "../store/paperWallet";

type Phase = "idle" | "betting" | "locked" | "settled";

export function CandlePredictor() {
  const { wallet } = usePaperWallet();
  const { candles, liveCandle, price, live, lastUpdated } = usePriceCandles(
    CANDLE_PREDICTOR.mint,
    CANDLE_PREDICTOR.candleMs
  );
  const [stake, setStake] = useState(25);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pick, setPick] = useState<"up" | "down" | null>(null);
  const [openPrice, setOpenPrice] = useState(0);
  const [result, setResult] = useState<{ win: boolean; payout: number; text: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const candleIdxRef = useRef<number>(0);
  /** True once the bet settled normally — blocks the void/refund safety net. */
  const settledRef = useRef(false);

  const token = feedToken(CANDLE_PREDICTOR.mint);
  const msLeft = CANDLE_PREDICTOR.candleMs - (Date.now() % CANDLE_PREDICTOR.candleMs);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const secsLeft = Math.max(0, Math.ceil((CANDLE_PREDICTOR.candleMs - (now % CANDLE_PREDICTOR.candleMs)) / 1000));

  const settleKey = useMemo(() => candles.length, [candles.length]);

  // Auto-settle when the candle we're betting on closes.
  useEffect(() => {
    if (phase !== "locked" || !pick) return;
    if (settleKey <= candleIdxRef.current) return; // candle not closed yet
    const closed = candles[candles.length - 1];
    if (!closed) return;
    // Normal settle wins the race — disarm the void/refund timer below.
    settledRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const wentUp = closed.close >= closed.open;
    const win = (pick === "up" && wentUp) || (pick === "down" && !wentUp);
    const payout = win ? Math.round(stake * CANDLE_PREDICTOR.payoutMultiplier * 100) / 100 : 0;
    if (win) {
      paperWallet.win(payout, `Candle predictor — ${token.symbol} ${pick.toUpperCase()} hit @ ${formatUsd(closed.close)}`, "predictor:candle");
    } else {
      paperWallet.lose(0, `Candle predictor — ${token.symbol} ${pick.toUpperCase()} missed @ ${formatUsd(closed.close)}`, "predictor:candle");
    }
    setResult({
      win,
      payout,
      text: win
        ? `Candle closed ${wentUp ? "UP" : "DOWN"} at ${formatUsd(closed.close)} — you called ${pick.toUpperCase()}. +${formatCity(payout)} CITY`
        : `Candle closed ${wentUp ? "UP" : "DOWN"} at ${formatUsd(closed.close)} — you called ${pick.toUpperCase()}. Stake lost.`,
    });
    setPhase("settled");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleKey, phase, pick]);

  const place = (dir: "up" | "down") => {
    const s = Math.min(Math.max(1, Math.floor(stake)), CANDLE_PREDICTOR.maxStake, Math.floor(wallet.balance));
    if (s < 1) return;
    try {
      paperWallet.placeWager(s, `Candle predictor — ${token.symbol} ${dir.toUpperCase()}`, "predictor:candle");
    } catch {
      return;
    }
    setStake(s);
    setPick(dir);
    setOpenPrice(price);
    setResult(null);
    candleIdxRef.current = candles.length;
    setPhase("locked");
    // Safety net: force-settle at candle close even if the feed stalls.
    // Guarded by settledRef so a normal settle can never be double-refunded.
    if (timerRef.current) clearTimeout(timerRef.current);
    settledRef.current = false;
    timerRef.current = setTimeout(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      setPhase((p) => (p === "locked" ? "settled" : p));
      setResult((r) => r ?? { win: false, payout: 0, text: "Feed stalled — candle voided, stake returned." });
      paperWallet.adjust(s, "Candle predictor — voided (feed stall), stake refunded", "predictor:candle");
    }, msLeft + 5000);
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const visible = [...candles.slice(-14), ...(liveCandle ? [liveCandle] : [])];
  const canBet = live && phase !== "locked" && wallet.balance >= 1;

  return (
    <div>
      <div className="ox-eco-row" style={{ justifyContent: "space-between" }}>
        <div className="ox-eco-section-title">Candle predictor · {token.symbol}/USD</div>
        <div className="ox-eco-candown">{phase === "locked" ? `${secsLeft}s` : "—"}</div>
      </div>

      <div className="ox-eco-kv">
        <span>Live price</span>
        <b>{formatUsd(price)}</b>
      </div>
      <CandlestickChart candles={visible} highlight={phase === "locked" ? visible.length - 1 : undefined} />

      {!live && (
        <div className="ox-eco-note warn">
          Waiting for the live price feed (DexScreener). No mock data — the game
          only starts when real prices arrive.
        </div>
      )}

      {result && <div className={`ox-eco-status ${result.win ? "win" : "lose"}`}>{result.text}</div>}

      <div className="ox-eco-row">
        <input
          className="ox-eco-input"
          type="number"
          min={1}
          max={Math.min(CANDLE_PREDICTOR.maxStake, Math.floor(wallet.balance))}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          disabled={phase === "locked"}
          aria-label="Stake in CITY"
        />
        <span className="ox-eco-section-title">CITY stake · pays ×{CANDLE_PREDICTOR.payoutMultiplier}</span>
      </div>

      <div className="ox-eco-pick">
        <button className="ox-eco-btn up" disabled={!canBet} onClick={() => place("up")}>
          ▲ UP
        </button>
        <button className="ox-eco-btn down" disabled={!canBet} onClick={() => place("down")}>
          ▼ DOWN
        </button>
      </div>

      {phase === "locked" && pick && (
        <div className="ox-eco-note">
          Locked <b>{pick.toUpperCase()}</b> from {formatUsd(openPrice)}. Settles when this
          candle closes ({secsLeft}s). Correct call pays {formatCity(Math.round(stake * CANDLE_PREDICTOR.payoutMultiplier))} CITY.
        </div>
      )}

      <div className="ox-eco-kv">
        <span>Feed updated</span>
        <b>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "—"}</b>
      </div>
    </div>
  );
}
