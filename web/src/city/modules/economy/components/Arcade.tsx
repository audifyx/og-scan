/**
 * Arcade — two minigames on REAL price data, paying paper CITY.
 *  1. Chart guesser — identify which token a mystery chart belongs to.
 *  2. Paper-trading speedrun — 60s long/short on live ORBITX price.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLivePrices } from "@/hooks/useLivePrices";
import { SPEEDRUN_DURATION_MS, SPEEDRUN_START_CITY } from "../data/catalog";
import { FEED_TOKENS, ORBITX_MINT, feedToken } from "../data/mints";
import { formatUsd } from "../hooks/usePriceCandles";
import { formatCity, paperWallet } from "../store/paperWallet";

/* ------------------------------------------------------------------ */
/* Chart guesser                                                       */
/* ------------------------------------------------------------------ */

const GUESS_SAMPLES_NEEDED = 12; // ~2 min of live sampling at 10s polls
const GUESS_REWARD = 50;

function ChartGuesser() {
  const { prices, connected } = useLivePrices(FEED_TOKENS.map((t) => t.mint), 10_000);
  const [series, setSeries] = useState<Record<string, number[]>>({});
  const [round, setRound] = useState(0);
  const [mystery, setMystery] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  // Sample each poll into per-mint history.
  useEffect(() => {
    const next: Record<string, number[]> = { ...series };
    let changed = false;
    for (const t of FEED_TOKENS) {
      const p = prices[t.mint]?.price;
      if (p && p > 0) {
        next[t.mint] = [...(next[t.mint] ?? []), p].slice(-60);
        changed = true;
      }
    }
    if (changed) setSeries(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices]);

  const readyMints = FEED_TOKENS.filter((t) => (series[t.mint]?.length ?? 0) >= GUESS_SAMPLES_NEEDED);

  useEffect(() => {
    if (mystery == null && readyMints.length > 0) {
      const pick = readyMints[Math.floor(Math.random() * readyMints.length)];
      setMystery(pick.mint);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyMints.length, round]);

  const guess = (mint: string) => {
    if (!mystery) return;
    const correct = mint === mystery;
    if (correct) {
      setScore((s) => s + 1);
      paperWallet.earn(GUESS_REWARD, `Arcade chart guess — nailed ${feedToken(mystery).symbol}`, "arcade:chart-guess");
      setVerdict(`✅ Correct — that was ${feedToken(mystery).symbol}. +${GUESS_REWARD} CITY`);
    } else {
      setVerdict(`❌ Nope — that was ${feedToken(mystery).symbol} (you said ${feedToken(mint).symbol}).`);
    }
    setMystery(null);
    setRound((r) => r + 1);
  };

  const chart = useMemo(() => {
    if (!mystery) return null;
    const data = series[mystery] ?? [];
    if (data.length < 2) return null;
    const base = data[0] || 1;
    const pct = data.map((p) => ((p - base) / base) * 100);
    const min = Math.min(...pct);
    const max = Math.max(...pct);
    const span = max - min || 1;
    const W = 320;
    const H = 120;
    const pts = pct.map((v, i) => `${(i / (pct.length - 1)) * W},${8 + (1 - (v - min) / span) * (H - 16)}`).join(" ");
    return { pts, min, max };
  }, [series, mystery]);

  return (
    <div>
      <div className="ox-eco-row" style={{ justifyContent: "space-between" }}>
        <div className="ox-eco-section-title">Chart guesser · +{GUESS_REWARD} CITY</div>
        <div className="ox-eco-section-title">streak score: {score}</div>
      </div>

      {!connected || readyMints.length === 0 ? (
        <div className="ox-eco-note">
          Collecting live price data… ({Math.max(...FEED_TOKENS.map((t) => series[t.mint]?.length ?? 0))}/
          {GUESS_SAMPLES_NEEDED} samples). Charts are normalized to % change so you
          judge the shape, not the price level. No mock data.
        </div>
      ) : mystery && chart ? (
        <>
          <svg width={320} height={120} className="ox-eco-chart" viewBox="0 0 320 120">
            <polyline points={chart.pts} fill="none" stroke="#6ee7ff" strokeWidth={2} />
          </svg>
          <div className="ox-eco-kv">
            <span>Range</span>
            <b>
              {chart.min >= 0 ? "+" : ""}
              {chart.min.toFixed(2)}% → {chart.max >= 0 ? "+" : ""}
              {chart.max.toFixed(2)}%
            </b>
          </div>
          <div className="ox-eco-pick">
            {FEED_TOKENS.map((t) => (
              <button key={t.mint} className="ox-eco-btn ghost" onClick={() => guess(t.mint)}>
                {t.symbol}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="ox-eco-note">Dealing the next mystery chart…</div>
      )}

      {verdict && <div className="ox-eco-status">{verdict}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Paper-trading speedrun                                              */
/* ------------------------------------------------------------------ */

type Side = "long" | "short" | null;

function Speedrun() {
  const { prices, connected } = useLivePrices([ORBITX_MINT], 5_000);
  const price = prices[ORBITX_MINT]?.price ?? 0;
  const [running, setRunning] = useState(false);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [side, setSide] = useState<Side>(null);
  const [entry, setEntry] = useState(0);
  const [trades, setTrades] = useState(0);
  const [done, setDone] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const equityRef = useRef<number[]>([]);
  /** Realized bankroll — rebased on every open/flip/flat so PnL is never lost. */
  const bankrollRef = useRef(SPEEDRUN_START_CITY);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // Mark-to-market virtual equity.
  const equity = useMemo(() => {
    if (!running) return SPEEDRUN_START_CITY;
    if (!price || !side || !entry) return bankrollRef.current;
    const ret = side === "long" ? (price - entry) / entry : (entry - price) / entry;
    return bankrollRef.current * (1 + ret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, price, side, entry, tick]);

  useEffect(() => {
    if (running && price > 0) {
      equityRef.current = [...equityRef.current.slice(-240), equity];
    }
  }, [running, price, equity]);

  // Time up → settle into the paper wallet.
  useEffect(() => {
    if (!running) return;
    if (now < endsAt) return;
    realize();
    setSide(null);
    const pnl = Math.round((bankrollRef.current - SPEEDRUN_START_CITY) * 100) / 100;
    paperWallet.adjust(
      pnl,
      `Arcade speedrun — 60s ORBITX paper trade, ${trades} trades, ${pnl >= 0 ? "+" : ""}${formatCity(pnl)} CITY`,
      "arcade:speedrun"
    );
    setDone(
      pnl >= 0
        ? `🏁 Finished green: +${formatCity(pnl)} CITY banked (${trades} trades).`
        : `🏁 Finished red: ${formatCity(pnl)} CITY (${trades} trades). Run it back.`
    );
    setRunning(false);
    setSide(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, running]);

  /** Realize current mark-to-market into the bankroll. */
  const realize = () => {
    if (side && entry && price > 0) {
      const ret = side === "long" ? (price - entry) / entry : (entry - price) / entry;
      bankrollRef.current = Math.max(0, bankrollRef.current * (1 + ret));
    }
  };

  const start = () => {
    if (!price) return;
    bankrollRef.current = SPEEDRUN_START_CITY;
    setRunning(true);
    setEndsAt(Date.now() + SPEEDRUN_DURATION_MS);
    setSide(null);
    setEntry(0);
    setTrades(0);
    setDone(null);
    setTick((t) => t + 1);
    equityRef.current = [SPEEDRUN_START_CITY];
  };

  const open = (s: "long" | "short") => {
    if (!running || !price) return;
    realize(); // bank any open PnL before flipping
    setSide(s);
    setEntry(price);
    setTrades((t) => t + 1);
    setTick((t) => t + 1);
  };
  const flat = () => {
    if (!running || !price || !side) return;
    realize();
    setSide(null);
    setEntry(0);
    setTrades((t) => t + 1);
    setTick((t) => t + 1);
  };

  const secs = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const eqPts = useMemo(() => {
    const d = equityRef.current;
    if (d.length < 2) return "";
    const min = Math.min(...d);
    const max = Math.max(...d);
    const span = max - min || 1;
    return d.map((v, i) => `${(i / (d.length - 1)) * 320},${8 + (1 - (v - min) / span) * 104}`).join(" ");
  }, [equity]);

  return (
    <div>
      <div className="ox-eco-row" style={{ justifyContent: "space-between" }}>
        <div className="ox-eco-section-title">Speedrun · ORBITX · 60s</div>
        <div className="ox-eco-candown">{running ? `${secs}s` : "—"}</div>
      </div>

      <div className="ox-eco-kv">
        <span>Live ORBITX</span>
        <b>{formatUsd(price)}</b>
      </div>
      <div className="ox-eco-kv">
        <span>Virtual bankroll</span>
        <b style={{ color: equity >= SPEEDRUN_START_CITY ? "#22e58a" : "#ff4d6d" }}>
          {formatCity(Math.round(equity * 100) / 100)} CITY
        </b>
      </div>
      {eqPts && (
        <svg width={320} height={120} className="ox-eco-chart" viewBox="0 0 320 120">
          <polyline points={eqPts} fill="none" stroke={equity >= SPEEDRUN_START_CITY ? "#22e58a" : "#ff4d6d"} strokeWidth={2} />
        </svg>
      )}

      {done && <div className="ox-eco-status">{done}</div>}

      {!running ? (
        <>
          {!connected || !price ? (
            <div className="ox-eco-note warn">Waiting for the live ORBITX feed — no mock prices.</div>
          ) : (
            <button className="ox-eco-btn" onClick={start}>
              Start 60s speedrun (1,000 CITY virtual)
            </button>
          )}
          <div className="ox-eco-note">
            Trade ORBITX against the live price for 60 seconds. PnL settles into
            your paper CITY wallet at the buzzer. Position: {side ?? "flat"}.
          </div>
        </>
      ) : (
        <div className="ox-eco-pick">
          <button className="ox-eco-btn up" onClick={() => open("long")}>
            LONG {side === "long" ? "●" : ""}
          </button>
          <button className="ox-eco-btn ghost" onClick={flat}>
            FLAT
          </button>
          <button className="ox-eco-btn down" onClick={() => open("short")}>
            SHORT {side === "short" ? "●" : ""}
          </button>
        </div>
      )}
    </div>
  );
}

export function Arcade() {
  const [tab, setTab] = useState<"guess" | "speed">("guess");
  return (
    <div>
      <div className="ox-eco-tabs" style={{ padding: 0 }}>
        <button className={`ox-eco-tab ${tab === "guess" ? "active" : ""}`} onClick={() => setTab("guess")}>
          📈 Chart guesser
        </button>
        <button className={`ox-eco-tab ${tab === "speed" ? "active" : ""}`} onClick={() => setTab("speed")}>
          ⚡ Speedrun
        </button>
      </div>
      {tab === "guess" ? <ChartGuesser /> : <Speedrun />}
    </div>
  );
}
