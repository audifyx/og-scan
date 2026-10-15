import { useState } from "react";

const TOKENS = [
  { sym: "OAPE", name: "Orbital APE", grade: "A+", price: "$0.000842", chg: "+18.47%", traders: "1,248", mint: "DISABLED", freeze: "ENABLED", up: true },
  { sym: "SNOVA", name: "StellarNova", grade: "A", price: "$0.02134", chg: "+12.19%", traders: "982", mint: "DISABLED", freeze: "ENABLED", up: true },
  { sym: "QLEAF", name: "Quantum Leaf", grade: "B+", price: "$0.1567", chg: "+9.32%", traders: "764", mint: "ENABLED", freeze: "ENABLED", up: true },
  { sym: "HYPE", name: "Hyperion Core", grade: "B", price: "$1.245", chg: "+6.71%", traders: "612", mint: "DISABLED", freeze: "ENABLED", up: true },
  { sym: "LFX", name: "Lunar Flux", grade: "C+", price: "$0.00321", chg: "-2.18%", traders: "321", mint: "ENABLED", freeze: "ENABLED", up: false },
  { sym: "ECHO", name: "Echo Token", grade: "B-", price: "$0.0789", chg: "+4.05%", traders: "267", mint: "DISABLED", freeze: "DISABLED", up: true },
];

const RUNNERS = [
  { sym: "OAPE", name: "Orbital APE", chg: "+18.47%", vol: "$2.34M" },
  { sym: "SNOVA", name: "StellarNova", chg: "+12.19%", vol: "$1.87M" },
  { sym: "QLEAF", name: "Quantum Leaf", chg: "+9.32%", vol: "$1.23M" },
];

const TABS = ["ALL TOKENS", "TRENDING", "VOLUME SPIKE", "NEW LAUNCHES"];
const TFS = ["1m", "5m", "15m", "1h", "4h", "1D"];

export default function TradeTerminal() {
  const [tab, setTab] = useState("TRENDING");
  const [tf, setTf] = useState("5m");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [amount, setAmount] = useState("1,000");

  return (
    <div className="mh-trade">
      {/* ── Left: Token Discovery ── */}
      <aside className="mh-trade__left">
        <div className="mh-panel">
          <div className="mh-panel__head">
            <div>
              <div className="mh-panel__title">TOKEN DISCOVERY</div>
              <div className="mh-panel__sub">Scanner · Real-time</div>
            </div>
          </div>
          <div className="mh-tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`mh-tab ${tab === t ? "is-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <table className="mh-tokens">
            <thead>
              <tr>
                <th>TOKEN</th><th>SAFETY</th><th>PRICE</th><th>24H %</th>
                <th>ORGANIC TRADERS</th><th>MINT / FREEZE</th>
              </tr>
            </thead>
            <tbody>
              {TOKENS.map((t) => (
                <tr key={t.sym}>
                  <td>
                    <div className="mh-token"><span className="mh-token__icon">{t.sym[0]}</span>
                    <div><div className="mh-token__name">{t.name}</div><div className="mh-token__sym">{t.sym}</div></div></div>
                  </td>
                  <td><span className={`mh-grade mh-grade--${t.grade[0]}`}>{t.grade}</span></td>
                  <td className="mh-mono">{t.price}</td>
                  <td className={`mh-mono ${t.up ? "up" : "down"}`}>{t.chg}</td>
                  <td className="mh-mono">{t.traders}</td>
                  <td className="mh-mint">
                    <div>MINT: {t.mint}</div><div>FREEZE: {t.freeze}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="mh-viewall">VIEW ALL TOKENS →</button>
        </div>

        <div className="mh-panel">
          <div className="mh-panel__head">
            <div>
              <div className="mh-panel__title">TRENDING RUNNERS</div>
              <div className="mh-panel__sub">Live momentum · 5m</div>
            </div>
            <span>🔥</span>
          </div>
          {RUNNERS.map((r, i) => (
            <div key={r.sym} className="mh-runner">
              <span className="mh-runner__rank">{i + 1}</span>
              <span className="mh-runner__icon">{r.sym[0]}</span>
              <span className="mh-runner__name">{r.sym} / {r.name}</span>
              <span className="mh-mono up">{r.chg}</span>
              <span className="mh-mono mh-dim">Vol: {r.vol}</span>
            </div>
          ))}
          <button className="mh-viewall">VIEW RUNNER BOARD →</button>
        </div>
      </aside>

      {/* ── Center: Chart ── */}
      <section className="mh-trade__center">
        <div className="mh-panel mh-chart-head">
          <div className="mh-pair">
            <span className="mh-pair__icon">👾</span>
            <div>
              <div className="mh-pair__name">OAPE / SOL ▾</div>
              <div className="mh-pair__sub">Orbital APE</div>
            </div>
          </div>
          <div className="mh-pair__price">
            <div className="mh-mono mh-price">$0.000842</div>
            <div className="mh-mono up">+18.47% (24H)</div>
          </div>
          <div className="mh-stats">
            <div><label>24H HIGH</label><span className="mh-mono">$0.000965</span></div>
            <div><label>24H LOW</label><span className="mh-mono">$0.000691</span></div>
            <div><label>24H VOL</label><span className="mh-mono">$2.34M</span></div>
            <div><label>LIQUIDITY</label><span className="mh-mono">$1.12M</span></div>
          </div>
        </div>

        <div className="mh-panel mh-chart">
          <div className="mh-chart__toolbar">
            {TFS.map((t) => (
              <button key={t} className={`mh-tf ${tf === t ? "is-active" : ""}`} onClick={() => setTf(t)}>{t}</button>
            ))}
            <button className="mh-tf">📈 Indicators</button>
          </div>
          <div className="mh-chart__canvas">
            <div className="mh-chart__placeholder">
              <div className="mh-candles">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="mh-candle" style={{
                    height: `${20 + Math.abs(Math.sin(i * 0.7)) * 60}px`,
                    background: Math.sin(i * 0.5) > 0 ? "#22c55e" : "#a855f7",
                  }} />
                ))}
              </div>
              <div className="mh-chart__times">
                {["14:00", "14:15", "14:30", "14:45", "15:00", "15:15"].map((t) => <span key={t}>{t}</span>)}
              </div>
            </div>
          </div>
          <div className="mh-chart__tabs">
            {["OVERVIEW", "ORDER BOOK", "TRADES", "INFO", "CONTRACT"].map((t, i) => (
              <button key={t} className={`mh-ctab ${i === 0 ? "is-active" : ""}`}>{t}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Right: Order Entry ── */}
      <aside className="mh-trade__right">
        <div className="mh-panel">
          <div className="mh-panel__title">ORDER ENTRY</div>
          <div className="mh-panel__sub">Dex · OrbitX AMM</div>
          <div className="mh-side-toggle">
            <button className={`mh-side ${side === "BUY" ? "is-buy" : ""}`} onClick={() => setSide("BUY")}>BUY</button>
            <button className={`mh-side ${side === "SELL" ? "is-sell" : ""}`} onClick={() => setSide("SELL")}>SELL</button>
          </div>
          <div className="mh-side-toggle">
            <button className={`mh-otype ${orderType === "MARKET" ? "is-active" : ""}`} onClick={() => setOrderType("MARKET")}>MARKET</button>
            <button className={`mh-otype ${orderType === "LIMIT" ? "is-active" : ""}`} onClick={() => setOrderType("LIMIT")}>LIMIT</button>
          </div>
          <label className="mh-field"><span>AMOUNT</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className="mh-mono" />
          </label>
          <label className="mh-field"><span>RECEIVE (EST.)</span>
            <div className="mh-field__row"><input value="0.842" readOnly className="mh-mono" /><span>SOL ▾</span></div>
          </label>
          <div className="mh-pcts">{["25%", "50%", "75%", "MAX"].map((p) => <button key={p} className="mh-pct">{p}</button>)}</div>
          <label className="mh-field"><span>SLIPPAGE TOLERANCE</span>
            <div className="mh-slips">{["0.1%", "0.5%", "1.0%"].map((s) => <button key={s} className={`mh-slip ${s === "0.5%" ? "is-active" : ""}`}>{s}</button>)}</div>
          </label>
          <button className={`mh-submit ${side === "BUY" ? "is-buy" : "is-sell"}`}>
            {side} OAPE
          </button>
          <div className="mh-est">Expected Output: 0.842 SOL (+/- 0.5% slippage)</div>
        </div>
      </aside>
    </div>
  );
}
